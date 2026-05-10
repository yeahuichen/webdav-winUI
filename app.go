package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/net/webdav"
)

// GlobalAuth 暴露给前端的认证配置（与磁盘 JSON 字段一致）
type GlobalAuth struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// ShareMount 单个挂载点（与前端列表项对应）
type ShareMount struct {
	ID     int64  `json:"id"`
	Folder string `json:"folder"`
	Port   int    `json:"port"`
	Status string `json:"status"` // "running" | "stopped"
}

type persistedShare struct {
	ID     int64  `json:"id"`
	Folder string `json:"folder"`
	Port   int    `json:"port"`
}

type persistedConfig struct {
	Username     string           `json:"username"`
	Password     string           `json:"password"`
	Shares       []persistedShare `json:"shares,omitempty"`
	RunningPorts []int            `json:"runningPorts,omitempty"`
}

// App struct
type App struct {
	ctx      context.Context
	servers  map[int]*http.Server
	mu       sync.RWMutex
	authUser string
	authPass string
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		servers: make(map[int]*http.Server),
	}
}

func (a *App) configPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	appDir := filepath.Join(dir, "webdav-winUI")
	if err := os.MkdirAll(appDir, 0o700); err != nil {
		return "", err
	}
	return filepath.Join(appDir, "config.json"), nil
}

func (a *App) readPersistedConfig() (persistedConfig, error) {
	path, err := a.configPath()
	if err != nil {
		return persistedConfig{}, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return persistedConfig{}, nil
		}
		return persistedConfig{}, err
	}
	var cfg persistedConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return persistedConfig{}, err
	}
	return cfg, nil
}

func (a *App) writePersistedConfig(cfg persistedConfig) error {
	path, err := a.configPath()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}

func (a *App) applyPersistedAuth(cfg persistedConfig) {
	a.mu.Lock()
	a.authUser = cfg.Username
	a.authPass = cfg.Password
	a.mu.Unlock()
}

func (a *App) restoreRunningMounts(cfg persistedConfig) {
	runningSet := make(map[int]struct{}, len(cfg.RunningPorts))
	for _, p := range cfg.RunningPorts {
		runningSet[p] = struct{}{}
	}
	for _, sh := range cfg.Shares {
		if _, ok := runningSet[sh.Port]; !ok {
			continue
		}
		st, err := os.Stat(sh.Folder)
		if err != nil || !st.IsDir() {
			fmt.Printf("跳过恢复挂载（路径不可用）: %s\n", sh.Folder)
			continue
		}
		if err := a.StartWebDAV(sh.Folder, sh.Port); err != nil {
			fmt.Printf("恢复挂载失败 %s:%d: %v\n", sh.Folder, sh.Port, err)
		}
	}
}

// startup is called when the app starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.initSystemTray()
	cfg, err := a.readPersistedConfig()
	if err != nil {
		fmt.Printf("读取配置失败: %v\n", err)
		cfg = persistedConfig{}
	}
	a.applyPersistedAuth(cfg)
	a.restoreRunningMounts(cfg)
}

// shutdown 在应用退出时调用：停止所有 WebDAV 并释放托盘等资源。
func (a *App) shutdown(ctx context.Context) {
	a.stopAllWebDAVServers()
	a.shutdownSystemTray()
}

func (a *App) stopAllWebDAVServers() {
	a.mu.Lock()
	ports := make([]int, 0, len(a.servers))
	for p := range a.servers {
		ports = append(ports, p)
	}
	a.mu.Unlock()
	for _, p := range ports {
		if err := a.StopWebDAV(p); err != nil {
			fmt.Printf("退出时停止 WebDAV 端口 %d: %v\n", p, err)
		}
	}
}

// SelectDirectory 打开系统文件夹选择对话框，取消时返回空字符串。
func (a *App) SelectDirectory() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "选择共享文件夹",
	})
}

// GetGlobalAuth 返回当前全局 WebDAV 账户与密码。
func (a *App) GetGlobalAuth() GlobalAuth {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return GlobalAuth{Username: a.authUser, Password: a.authPass}
}

// SetGlobalAuth 保存全局账户与密码到内存并写入配置文件。
func (a *App) SetGlobalAuth(username, password string) error {
	a.mu.Lock()
	a.authUser = strings.TrimSpace(username)
	a.authPass = password
	a.mu.Unlock()
	cfg, err := a.readPersistedConfig()
	if err != nil {
		return err
	}
	a.mu.RLock()
	cfg.Username = a.authUser
	cfg.Password = a.authPass
	a.mu.RUnlock()
	return a.writePersistedConfig(cfg)
}

// GetPersistedShares 返回磁盘中的挂载列表，并根据当前进程内实际服务状态标记 running/stopped。
func (a *App) GetPersistedShares() ([]ShareMount, error) {
	cfg, err := a.readPersistedConfig()
	if err != nil {
		return nil, err
	}
	out := make([]ShareMount, 0, len(cfg.Shares))
	for _, sh := range cfg.Shares {
		status := "stopped"
		a.mu.RLock()
		if _, ok := a.servers[sh.Port]; ok {
			status = "running"
		}
		a.mu.RUnlock()
		out = append(out, ShareMount{
			ID:     sh.ID,
			Folder: sh.Folder,
			Port:   sh.Port,
			Status: status,
		})
	}
	return out, nil
}

// SaveSharesState 将挂载列表与「运行中」端口集合写入配置文件。
func (a *App) SaveSharesState(mounts []ShareMount) error {
	cfg, err := a.readPersistedConfig()
	if err != nil {
		return err
	}
	shares := make([]persistedShare, 0, len(mounts))
	var running []int
	for _, m := range mounts {
		shares = append(shares, persistedShare{
			ID:     m.ID,
			Folder: m.Folder,
			Port:   m.Port,
		})
		if m.Status == "running" {
			running = append(running, m.Port)
		}
	}
	cfg.Shares = shares
	cfg.RunningPorts = running
	return a.writePersistedConfig(cfg)
}

func basicAuthMiddleware(user, pass string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, p, ok := r.BasicAuth()
		if !ok || u != user || p != pass {
			w.Header().Set("WWW-Authenticate", `Basic realm="WebDAV"`)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// StartWebDAV 暴露给前端的启动服务方法
func (a *App) StartWebDAV(folderPath string, port int) error {
	if _, exists := a.servers[port]; exists {
		return fmt.Errorf("端口 %d 已被占用", port)
	}

	handler := &webdav.Handler{
		FileSystem: webdav.Dir(folderPath),
		LockSystem: webdav.NewMemLS(),
	}

	var mux http.Handler = handler
	a.mu.RLock()
	u, p := a.authUser, a.authPass
	a.mu.RUnlock()
	if strings.TrimSpace(u) != "" {
		mux = basicAuthMiddleware(u, p, handler)
	}

	serve := http.NewServeMux()
	serve.Handle("/", mux)

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: serve,
	}

	a.servers[port] = server

	go func() {
		if err := server.ListenAndServe(); err != http.ErrServerClosed {
			fmt.Printf("WebDAV 服务启动失败: %v\n", err)
		}
	}()

	return nil
}

// StopWebDAV 暴露给前端的停止服务方法
func (a *App) StopWebDAV(port int) error {
	server, exists := a.servers[port]
	if !exists {
		return fmt.Errorf("端口 %d 上没有运行的服务", port)
	}

	if err := server.Close(); err != nil {
		return fmt.Errorf("停止服务失败: %w", err)
	}

	delete(a.servers, port)
	return nil
}

// GetLocalIP 暴露给前端的获取本地局域网 IP 方法
func (a *App) GetLocalIP() string {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return "127.0.0.1"
	}
	defer conn.Close()

	localAddr := conn.LocalAddr().(*net.UDPAddr)
	return localAddr.IP.String()
}

