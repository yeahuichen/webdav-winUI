//go:build windows

package main

import (
	"path/filepath"
	"strings"

	"golang.org/x/sys/windows/registry"
)

const runRegistryPath = `Software\Microsoft\Windows\CurrentVersion\Run`
const runValueName = "webdav-winUI"

func exePathForAutostart() (string, error) {
	exe, err := executablePath()
	if err != nil {
		return "", err
	}
	return filepath.Abs(exe)
}

func normalizeRunValue(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, `"`)
	s = strings.TrimSuffix(s, `"`)
	return filepath.Clean(s)
}

// windowsRegistryRunCommand 供 HKCU\...\Run 使用：外层双引号 + 路径内单反斜杠（与 strconv.Quote 的 Go 转义不同）。
func windowsRegistryRunCommand(absExe string) string {
	return `"` + strings.ReplaceAll(absExe, `"`, `\"`) + `"`
}

// GetAutostartEnabled 是否已在当前用户「启动」注册表中注册本程序。
func (a *App) GetAutostartEnabled() (bool, error) {
	exe, err := exePathForAutostart()
	if err != nil {
		return false, err
	}
	k, err := registry.OpenKey(registry.CURRENT_USER, runRegistryPath, registry.READ)
	if err != nil {
		return false, err
	}
	defer k.Close()
	val, _, err := k.GetStringValue(runValueName)
	if err != nil {
		if err == registry.ErrNotExist {
			return false, nil
		}
		return false, err
	}
	norm := normalizeRunValue(val)
	match := strings.EqualFold(norm, filepath.Clean(exe))
	return match, nil
}

// SetAutostartEnabled 写入或删除注册表中的开机启动项。
func (a *App) SetAutostartEnabled(enabled bool) error {
	if !enabled {
		k, err := registry.OpenKey(registry.CURRENT_USER, runRegistryPath, registry.SET_VALUE)
		if err != nil {
			return err
		}
		defer k.Close()
		if _, _, err := k.GetStringValue(runValueName); err == registry.ErrNotExist {
			return nil
		}
		return k.DeleteValue(runValueName)
	}
	exe, err := exePathForAutostart()
	if err != nil {
		return err
	}
	k, err := registry.OpenKey(registry.CURRENT_USER, runRegistryPath, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	quoted := windowsRegistryRunCommand(exe)
	return k.SetStringValue(runValueName, quoted)
}
