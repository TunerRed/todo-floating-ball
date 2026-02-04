package main

import (
	"context"
	"embed"
	"encoding/json"
	"flag"
	"os"

	"path/filepath"

	"todo-ball/platform"

	"github.com/energye/systray"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed icon.ico
var iconData []byte

// GetAppIconPath returns the path to the app icon.
// It tries to find icon.ico in the app directory.
// If not found, it extracts the embedded icon to a temp file.
func GetAppIconPath() string {
	appDir := getAppDir()
	iconPath := filepath.Join(appDir, "icon.ico")
	if _, err := os.Stat(iconPath); err == nil {
		return iconPath
	}

	// Extract to temp
	tempDir := os.TempDir()
	tempIconPath := filepath.Join(tempDir, "todo-ball-icon.ico")

	// Only write if not exists or size differs (simple check)
	if info, err := os.Stat(tempIconPath); err != nil || info.Size() != int64(len(iconData)) {
		os.WriteFile(tempIconPath, iconData, 0644)
	}

	return tempIconPath
}

type IconConfig struct {
	TrayIcon       string `json:"tray_icon"`
	MainWindowIcon string `json:"main_window_icon"`
	TaskbarIcon    string `json:"taskbar_icon"`
}

func getAppDir() string {
	exe, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(exe)
}

func loadIconConfig() IconConfig {
	defaultIcon := GetAppIconPath()

	// Default
	config := IconConfig{
		TrayIcon:       defaultIcon,
		MainWindowIcon: defaultIcon,
		TaskbarIcon:    defaultIcon,
	}

	appDir := getAppDir()
	configPath := filepath.Join(appDir, "icon_config.json")
	data, err := os.ReadFile(configPath)
	if err == nil {
		json.Unmarshal(data, &config)
	}

	// Resolve relative paths
	resolvePath := func(path string) string {
		fullPath := path
		if path != "" && !filepath.IsAbs(path) {
			fullPath = filepath.Join(appDir, path)
		}

		// Check if file exists, if not use default
		if _, err := os.Stat(fullPath); err != nil {
			return defaultIcon
		}
		return fullPath
	}

	config.TrayIcon = resolvePath(config.TrayIcon)
	config.MainWindowIcon = resolvePath(config.MainWindowIcon)
	config.TaskbarIcon = resolvePath(config.TaskbarIcon)

	return config
}

func main() {
	iconConfig := loadIconConfig()
	modePtr := flag.String("mode", "main", "Application mode: 'main' or 'ball'")
	flag.Parse()
	mode := *modePtr

	// Single Instance Check using Mutex
	// Using updated mutex names to avoid conflicts with ghost processes
	if mode == "main" {
		_, err := platform.CreateMutex("Global\\TodoBallMainMutex_v2")
		if err != nil {
			// Already running, show it and exit
			hwnd := platform.FindWindow("待办事项")
			if hwnd != 0 {
				platform.ShowNormal(hwnd)
				platform.SetForegroundWindow(hwnd)
			}
			// If window not found but mutex exists, it might be a ghost process or different user.
			// We exit anyway to strictly enforce single instance.
			os.Exit(0)
		}
	} else if mode == "ball" {
		_, err := platform.CreateMutex("Global\\TodoBallFloatMutex_v2")
		if err != nil {
			// Already running, exit
			os.Exit(0)
		}
	}

	app := NewApp(mode, iconConfig)

	// Start System Tray in a goroutine (Only in Main mode)
	if mode == "main" {
		println("Initializing System Tray...")
		// Note: On Windows this works in a goroutine as long as it has its own message loop (which systray.Run provides)
		go func() {
			systray.Run(func() {
				println("System Tray Ready")

				// Try to load from config first
				var trayIconBytes []byte
				if iconConfig.TrayIcon != "" {
					trayIconBytes, _ = os.ReadFile(iconConfig.TrayIcon)
				}

				if len(trayIconBytes) > 0 {
					systray.SetIcon(trayIconBytes)
				} else if len(iconData) > 0 {
					systray.SetIcon(iconData)
				} else {
					println("Error: No icon data available")
				}

				systray.SetTitle("待办事项")
				systray.SetTooltip("待办事项")

				mOpen := systray.AddMenuItem("显示主界面", "Show Main Window")
				mOpen.Click(func() {
					app.OpenMain()
				})

				mQuit := systray.AddMenuItem("退出", "Quit Application")
				mQuit.Click(func() {
					systray.Quit()
					app.FullQuit()
				})

			}, func() {
				// Cleanup
			})
		}()
	}

	w := 1080
	h := 720
	// Load size from config if available
	if app.Store.Config.WindowWidth > 0 && app.Store.Config.WindowHeight > 0 {
		w = app.Store.Config.WindowWidth
		h = app.Store.Config.WindowHeight
	}

	// Override for ball mode
	if mode == "ball" {
		w = 100
		h = 80
	}

	frameless := false
	resizable := false
	alwaysOnTop := false
	title := "待办事项"

	// Wails options
	appOptions := &options.App{
		Title:         title,
		Width:         w,
		Height:        h,
		DisableResize: !resizable,
		Frameless:     frameless,
		AlwaysOnTop:   alwaysOnTop,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 255, G: 255, B: 255, A: 255},
		OnStartup:        app.startup,
		OnBeforeClose:    app.BeforeClose,
		OnShutdown: func(ctx context.Context) {
			if mode == "main" {
				systray.Quit()
			}
		},
		Bind: []interface{}{
			app,
		},
	}

	if mode == "ball" {
		appOptions.Width = 80
		appOptions.Height = 80
		appOptions.Frameless = true
		appOptions.AlwaysOnTop = true
		appOptions.BackgroundColour = &options.RGBA{R: 0, G: 0, B: 0, A: 0}
		appOptions.Windows = &windows.Options{
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
		}
		appOptions.Title = "悬浮球"
	} else {
		// Main mode
		appOptions.Windows = &windows.Options{
			// WebviewIsTransparent: false,
			// WindowIsTranslucent:  false,
		}
	}

	// Check for local WebView2 Fixed Version
	// Users can place the Fixed Version Runtime in a "WebView2" subfolder next to the exe
	appDir := getAppDir()
	webView2Dir := filepath.Join(appDir, "WebView2")
	if info, err := os.Stat(webView2Dir); err == nil && info.IsDir() {
		// Search for msedgewebview2.exe to find the correct root
		var browserPath string
		filepath.Walk(webView2Dir, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if info.Name() == "msedgewebview2.exe" {
				browserPath = filepath.Dir(path)
				return filepath.SkipDir // Found it
			}
			return nil
		})

		if browserPath != "" {
			println("Using local WebView2 runtime at:", browserPath)
			appOptions.Windows.WebviewBrowserPath = browserPath
		} else {
			// Fallback to the dir itself if scan fails
			println("Using local WebView2 runtime at:", webView2Dir)
			appOptions.Windows.WebviewBrowserPath = webView2Dir
		}
	}

	err := wails.Run(appOptions)

	if err != nil {
		println("Error:", err.Error())
	}
}
