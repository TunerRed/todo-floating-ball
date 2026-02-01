package platform

import (
	"os"
	"strings"

	"golang.org/x/sys/windows/registry"
)

const (
	RegistryKey = `Software\Microsoft\Windows\CurrentVersion\Run`
	AppName     = "TodoFloatingBall"
)

func SetAutoStart(enable bool) error {
	k, err := registry.OpenKey(registry.CURRENT_USER, RegistryKey, registry.QUERY_VALUE|registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()

	if enable {
		exe, err := os.Executable()
		if err != nil {
			return err
		}
		// Ensure paths with spaces are quoted
		if !strings.HasPrefix(exe, "\"") {
			exe = "\"" + exe + "\""
		}
		return k.SetStringValue(AppName, exe)
	} else {
		// Ignore error if key doesn't exist
		err := k.DeleteValue(AppName)
		if err == registry.ErrNotExist {
			return nil
		}
		return err
	}
}

func IsAutoStartEnabled() bool {
	k, err := registry.OpenKey(registry.CURRENT_USER, RegistryKey, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer k.Close()

	val, _, err := k.GetStringValue(AppName)
	if err != nil {
		return false
	}

	exe, err := os.Executable()
	if err != nil {
		return false
	}

	// Normalize paths for comparison (simple check)
	// Registry value might be quoted
	val = strings.Trim(val, "\"")
	exe = strings.Trim(exe, "\"")

	return strings.EqualFold(val, exe)
}
