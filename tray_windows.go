//go:build windows

package main

import (
	_ "embed"
	stdruntime "runtime"
	"sync"

	"fyne.io/systray"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed build/windows/icon.ico
var trayIcon []byte

var (
	trayTeardown     func()
	trayTeardownOnce sync.Once
	trayInstallOnce  sync.Once
)

func (a *App) initSystemTray() {
	trayInstallOnce.Do(func() {
		go func() {
			// CRITICAL: Windows requires the tray icon to be created and its messages
			// pumped on the EXACT SAME OS thread. Wails startup runs in a random goroutine,
			// so we MUST lock this goroutine to an OS thread.
			stdruntime.LockOSThread()

			systray.Run(func() {
				systray.SetIcon(trayIcon)
				systray.SetTooltip("WebDAV Manager — 本地 WebDAV 服务")
				
				mShow := systray.AddMenuItem("打开主窗口", "从托盘恢复主界面")
				mQuit := systray.AddMenuItem("退出", "关闭程序并停止所有 WebDAV 服务")
				
				go func() {
					for {
						select {
						case <-mShow.ClickedCh:
							runtime.WindowShow(a.ctx)
							runtime.WindowUnminimise(a.ctx)
						case <-mQuit.ClickedCh:
							runtime.Quit(a.ctx)
							return
						}
					}
				}()
			}, func() {
				// Cleanup logic if needed
			})
		}()
	})
}

func (a *App) shutdownSystemTray() {
	systray.Quit()
}
