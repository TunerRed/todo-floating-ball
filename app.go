package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"
	"todo-ball/models"
	"todo-ball/platform"
	"todo-ball/storage"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx   context.Context
	Store *storage.Storage
	Mode  string

	// Internal state
	currentDockState string

	// Icons
	IconConfig IconConfig

	// Flags
	shouldQuit bool
}

func NewApp(mode string, iconConfig IconConfig) *App {
	store, err := storage.NewStorage()
	if err != nil {
		// Ignore for now
	}
	return &App{
		Store:            store,
		Mode:             mode,
		currentDockState: "none",
		IconConfig:       iconConfig,
	}
}

const UpdateEventName = "Local\\TodoBallUpdateEvent"
const QuitEventName = "Local\\TodoBallQuitEvent"

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	if a.Mode == "ball" {
		// Start docking detection loop
		a.startDockingLoop()

		// Create Event for IPC
		go func() {
			hEvent, err := platform.CreateEvent(UpdateEventName)
			if err == nil && hEvent != 0 {
				defer platform.CloseHandle(hEvent)
				for {
					// Wait for signal
					platform.WaitForSingleObject(hEvent, platform.INFINITE)
					// Reload data
					a.Store.LoadTodos()
					a.Store.LoadConfig()
					// Emit event to frontend
					runtime.EventsEmit(a.ctx, "todos_updated")
				}
			}
		}()

		// Apply Win32 tweaks
		go func() {
			var hwnd uintptr
			// Retry loop to find window
			for i := 0; i < 20; i++ {
				hwnd = platform.FindWindow("悬浮球")
				if hwnd != 0 {
					break
				}
				time.Sleep(100 * time.Millisecond)
			}

			if hwnd != 0 {
				platform.MakeFrameless(hwnd) // Force remove caption/border
				platform.HideFromTaskbar(hwnd)
				platform.SetTopMost(hwnd)
				// platform.SetWindowCircular(hwnd, 80, 80) // Disable region to allow resizing
			}
		}()
	} else {
		// Main window logic
		go func() {
			time.Sleep(500 * time.Millisecond)
			hwnd := platform.FindWindow("待办事项")
			if hwnd != 0 {
				iconPath := a.IconConfig.MainWindowIcon
				if iconPath == "" {
					iconPath = GetAppIconPath()
				}
				platform.SetWindowIcon(hwnd, iconPath, platform.ICON_SMALL)
				platform.SetWindowIcon(hwnd, iconPath, platform.ICON_BIG)
			}

			// Listen for Quit Event
			go func() {
				hEvent, err := platform.CreateEvent(QuitEventName)
				if err == nil && hEvent != 0 {
					defer platform.CloseHandle(hEvent)
					for {
						status, _ := platform.WaitForSingleObject(hEvent, platform.INFINITE)
						if status == platform.WAIT_OBJECT_0 {
							a.shouldQuit = true
							runtime.Quit(a.ctx)
							return
						}
					}
				}
			}()

			// Launch ball if not running
			ballHwnd := platform.FindWindow("悬浮球")
			if ballHwnd == 0 {
				exe, err := os.Executable()
				if err == nil {
					// Log launch attempt
					if logFile, err := os.OpenFile("startup.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err == nil {
						logFile.WriteString(fmt.Sprintf("%s Launching ball subprocess: %s\n", time.Now().Format(time.RFC3339), exe))
						logFile.Close()
					}

					cmd := exec.Command(exe, "-mode", "ball")
					cmd.Dir = filepath.Dir(exe)
					if err := cmd.Start(); err != nil {
						if logFile, err := os.OpenFile("startup.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err == nil {
							logFile.WriteString(fmt.Sprintf("%s Failed to start ball: %s\n", time.Now().Format(time.RFC3339), err.Error()))
							logFile.Close()
						}
					}
				}
			}
		}()
	}
}

// GetTodos returns the list of todo items
func (a *App) GetTodos() []models.TodoItem {
	return a.Store.GetTodos()
}

// AddTodo adds a new todo item
func (a *App) AddTodo(title string, dueTimeStr string, reminderDays int) {
	dueDate, _ := time.Parse(time.RFC3339, dueTimeStr)

	item := models.TodoItem{
		ID:           fmt.Sprintf("%d", time.Now().UnixNano()),
		Title:        title,
		Completed:    false,
		DueDate:      dueDate,
		ReminderDays: reminderDays,
	}
	// Wait for save to complete before notifying
	if err := a.Store.AddTodo(item); err == nil {
		a.notifyUpdate()
	}
}

// ToggleTodo toggles the completed status of a todo item
func (a *App) ToggleTodo(id string) {
	// Wait for save to complete before notifying
	if err := a.Store.ToggleTodo(id); err == nil {
		a.notifyUpdate()
	}
}

// DeleteTodo deletes a todo item
func (a *App) DeleteTodo(id string) {
	// Wait for save to complete before notifying
	if err := a.Store.DeleteTodo(id); err == nil {
		a.notifyUpdate()
	}
}

// GetConfig returns the application configuration
func (a *App) GetConfig() models.AppConfig {
	a.Store.LoadConfig() // Reload from disk to ensure freshness

	// Sync with actual registry state
	enabled := platform.IsAutoStartEnabled()
	if a.Store.Config.StartOnBoot != enabled {
		a.Store.Config.StartOnBoot = enabled
		// Update stored config to match reality, but don't trigger save yet to avoid IO loop?
		// Actually, we should probably save it if it's different, or just return the corrected value.
		// Let's just return the corrected value.
	}

	return a.Store.Config
}

// OpenMain opens the main window (launches executable in main mode if not running)
func (a *App) OpenMain() {
	if a.Mode == "main" {
		runtime.WindowShow(a.ctx)
		return
	}

	// In ball mode, try to find main window
	hwnd := platform.FindWindow("待办事项")
	if hwnd != 0 {
		platform.ShowNormal(hwnd)
		platform.SetForegroundWindow(hwnd)
	} else {
		// Launch main
		exe, err := os.Executable()
		if err == nil {
			cmd := exec.Command(exe, "-mode", "main")
			cmd.Start()
		}
	}
}

// FullQuit quits both processes
func (a *App) FullQuit() {
	a.shouldQuit = true

	// Signal global quit event so other process knows to actually quit, not hide
	hEvent, err := platform.CreateEvent(QuitEventName)
	if err == nil && hEvent != 0 {
		platform.SetEvent(hEvent)
		platform.CloseHandle(hEvent)
	}

	if a.Mode == "main" {
		// Kill ball if exists
		ballHwnd := platform.FindWindow("悬浮球")
		if ballHwnd != 0 {
			platform.PostQuitMessage(ballHwnd)
		}
	} else {
		// Kill main if exists
		mainHwnd := platform.FindWindow("待办事项")
		if mainHwnd != 0 {
			platform.PostQuitMessage(mainHwnd)
		}
	}
	runtime.Quit(a.ctx)
}

// SetBallMenuState adjusts window size/transparency for menu
func (a *App) SetBallMenuState(open bool) {
	if a.Mode != "ball" {
		return
	}
	hwnd := platform.FindWindow("悬浮球")
	if hwnd != 0 {
		if open {
			platform.SetWindowPos(hwnd, 0, 0, 100, 160, platform.SWP_NOMOVE|platform.SWP_NOZORDER)
			platform.SetWindowLong(hwnd, platform.GWL_EXSTYLE, platform.WS_EX_LAYERED|platform.WS_EX_TOOLWINDOW)
		} else {
			platform.SetWindowPos(hwnd, 0, 0, 100, 80, platform.SWP_NOMOVE|platform.SWP_NOZORDER)
			platform.SetWindowLong(hwnd, platform.GWL_EXSTYLE, platform.WS_EX_LAYERED|platform.WS_EX_TOOLWINDOW)
		}
	}
}

// GetImageBase64 reads an image file and returns base64 string
func (a *App) GetImageBase64(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return base64.StdEncoding.EncodeToString(data)
}

func (a *App) BeforeClose(ctx context.Context) (prevent bool) {
	if a.Mode == "ball" {
		// If ball is closing (e.g. Alt+F4), trigger full quit
		if !a.shouldQuit {
			a.FullQuit()
			return true // Prevent immediate close, let FullQuit handle it
		}
		return false
	}

	// Main mode
	if a.shouldQuit {
		return false
	}

	// Check if global quit event is signaled
	hEvent, err := platform.OpenEvent(QuitEventName)
	if err == nil && hEvent != 0 {
		status, _ := platform.WaitForSingleObject(hEvent, 0)
		platform.CloseHandle(hEvent)
		if status == platform.WAIT_OBJECT_0 {
			// Quit event signaled, allow exit
			return false
		}
	}

	// Otherwise hide
	runtime.WindowHide(a.ctx)
	return true
}

func (a *App) notifyUpdate() {
	hEvent, err := platform.OpenEvent(UpdateEventName)
	if err == nil && hEvent != 0 {
		platform.SetEvent(hEvent)
		platform.CloseHandle(hEvent)
	}
}

// CheckDocking checks if the window is near the edge of the screen
func (a *App) CheckDocking() string {
	if a.Mode != "ball" {
		return ""
	}

	// If mouse is down (dragging), don't dock
	state := platform.GetAsyncKeyState(platform.VK_LBUTTON)
	if state&0x8000 != 0 {
		return "none"
	}

	hwnd := platform.FindWindow("悬浮球")
	if hwnd == 0 {
		return "none"
	}

	rect := platform.GetWindowRect(hwnd)
	if rect == nil {
		return "none"
	}

	monitorRect, err := platform.GetMonitorRectForWindow(hwnd)
	if err != nil {
		return "none"
	}

	// Window width is 100. Ball is 80 (centered, so 10px padding on each side).
	// User requires at least 1/4 of ball (20px) to be off-screen.
	// Left side: Ball Left (rect.Left + 10) <= monitorRect.Left - 20
	// => rect.Left <= monitorRect.Left - 30
	if rect.Left <= monitorRect.Left-30 {
		return "left"
	}

	// Right side: Ball Right (rect.Left + 90) >= monitorRect.Right + 20
	// => rect.Left >= monitorRect.Right - 70
	if rect.Left >= monitorRect.Right-70 {
		return "right"
	}

	return "none"
}

// Dock snaps the window to the side and resizes it
func (a *App) Dock(side string) {
	if a.Mode != "ball" {
		return
	}
	hwnd := platform.FindWindow("悬浮球")
	if hwnd == 0 {
		return
	}

	monitorRect, err := platform.GetMonitorRectForWindow(hwnd)
	if err != nil {
		return
	}
	rect := platform.GetWindowRect(hwnd)
	if rect == nil {
		return
	}

	width := 10
	height := 100
	y := int(rect.Top)

	if y < int(monitorRect.Top) {
		y = int(monitorRect.Top)
	}
	if y+height > int(monitorRect.Bottom) {
		y = int(monitorRect.Bottom) - height
	}

	var x int
	if side == "left" {
		x = int(monitorRect.Left)
	} else {
		x = int(monitorRect.Right) - width
	}

	platform.SetWindowPos(hwnd, x, y, width, height, platform.SWP_NOZORDER)
}

func (a *App) startDockingLoop() {
	ticker := time.NewTicker(200 * time.Millisecond)
	go func() {
		for {
			select {
			case <-ticker.C:
				// If docked, do nothing (wait for user to undock)
				if a.currentDockState != "none" {
					continue
				}

				// Check docking status
				// Note: CheckDocking already checks for mouse button press
				status := a.CheckDocking()

				if status != "none" {
					// Need to dock
					a.Dock(status)
					a.currentDockState = status
					runtime.EventsEmit(a.ctx, "dock_state_change", status)
				}
			case <-a.ctx.Done():
				ticker.Stop()
				return
			}
		}
	}()
}

// Undock restores the window size and moves it away from the edge
func (a *App) Undock(side string) {
	if a.Mode != "ball" {
		return
	}
	hwnd := platform.FindWindow("悬浮球")
	if hwnd == 0 {
		return
	}

	rect := platform.GetWindowRect(hwnd)
	if rect == nil {
		return
	}

	// Restore size
	width := 80
	height := 80
	y := int(rect.Top)

	var x int
	if side == "left" {
		x = int(rect.Left)
	} else {
		x = int(rect.Right) - width
	}

	platform.SetWindowPos(hwnd, x, y, width, height, platform.SWP_NOZORDER)

	// Reset state
	a.currentDockState = "none"
	runtime.EventsEmit(a.ctx, "dock_state_change", "none")
}

// SetWindowSize wrapper
func (a *App) SetWindowSize(w, h int) {
	runtime.WindowSetSize(a.ctx, w, h)
}

// SetWindowPosition wrapper
func (a *App) SetWindowPosition(x, y int) {
	runtime.WindowSetPosition(a.ctx, x, y)
}

// GetMode returns the current app mode
func (a *App) GetMode() string {
	return a.Mode
}

// SelectFile opens a file dialog to select an image
func (a *App) SelectFile() string {
	selection, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Icon",
		Filters: []runtime.FileFilter{
			{DisplayName: "Images", Pattern: "*.png;*.jpg;*.jpeg;*.ico"},
		},
	})
	if err != nil {
		return ""
	}
	return selection
}

// UpdateConfig updates the app config
func (a *App) UpdateConfig(config models.AppConfig) error {
	// If in main mode, apply window size changes immediately
	if a.Mode == "main" && config.WindowWidth > 0 && config.WindowHeight > 0 {
		runtime.WindowSetSize(a.ctx, config.WindowWidth, config.WindowHeight)
	}

	// Apply AutoStart setting
	if err := platform.SetAutoStart(config.StartOnBoot); err != nil {
		fmt.Printf("Error setting auto-start: %v\n", err)
		return fmt.Errorf("设置开机自启失败: %w", err)
	}

	// Wait for save to complete before notifying
	if err := a.Store.UpdateConfig(config); err == nil {
		a.notifyUpdate()
	} else {
		return fmt.Errorf("保存配置失败: %w", err)
	}

	return nil
}
