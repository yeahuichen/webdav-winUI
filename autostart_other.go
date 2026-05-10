//go:build !windows

package main

import "fmt"

// GetAutostartEnabled 非 Windows 平台始终为 false。
func (a *App) GetAutostartEnabled() (bool, error) {
	return false, nil
}

// SetAutostartEnabled 非 Windows 平台不支持。
func (a *App) SetAutostartEnabled(enabled bool) error {
	if enabled {
		return fmt.Errorf("开机自启仅支持 Windows")
	}
	return nil
}
