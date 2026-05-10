package main

import (
	"os"
	"path/filepath"
)

// executablePath 返回当前进程可执行文件路径（尽量解析符号链接）。
func executablePath() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		return resolved, nil
	}
	return exe, nil
}
