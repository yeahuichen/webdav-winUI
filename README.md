# WebDAV Manager 🚀

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Go](https://img.shields.io/badge/Go-1.21+-00ADD8.svg?logo=go)
![Wails](https://img.shields.io/badge/Wails-v2-red.svg)
![React](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react)
![License](https://img.shields.io/badge/license-MIT-green.svg)

一个轻量、美观且开箱即用的 Windows 本地 WebDAV 桌面管理工具。基于 `hacdias/webdav` 核心与 Wails 框架构建，让你能以最直观的图形界面，一键将本地任意文件夹映射为 WebDAV 服务。



## ✨ 核心特性 (Features)

* **⚡️ 极简操作：** 告别繁琐的命令行配置，纯 GUI 界面，一键选择本地磁盘目录即可创建共享。
* **🔌 智能端口分配：** 自动检测并分配未被占用的本地端口（如 `127.0.0.1:10234`），支持多实例独立运行。
* **原生级体验：** 使用 Wails 构建，拥有接近原生 Windows 应用程序的启动速度和极低的内存占用。
* **🤖 AI 智能助手集成：** 内置大模型交互能力，可根据当前运行的网络环境，一键生成多端（macOS/iOS/Windows）挂载教程或 Nginx 反代配置代码。

## 🛠 技术栈 (Tech Stack)

* **后端 / 核心引擎:** [Go](https://go.dev/) + [hacdias/webdav](https://github.com/hacdias/webdav)
* **桌面端框架:** [Wails v2](https://wails.io/)
* **前端 UI:** [React](https://reactjs.org/) + [Tailwind CSS v3](https://tailwindcss.com/) + Lucide Icons

## 🚀 快速上手 (Quick Start)

### 作为用户直接使用
1. 前往 [Releases](#) 页面下载最新的 `WebDAV-Manager.exe`。
2. 双击运行，无需安装额外的运行环境。
3. 点击“新建共享”，选择目标文件夹，即可开启你的 WebDAV 服务。

### 作为开发者本地编译
确保你的开发环境已安装 Go (1.21+)、Node.js 和 Wails CLI。

```bash
# 1. 克隆仓库
git clone [https://github.com/yeahuichan/webdav-winUI.git]
cd 你的仓库名

# 2. 安装前端依赖
cd frontend
npm install

# 3. 回到根目录，启动热更新开发模式
cd ..
wails dev

# 4. 编译打包为 Windows .exe 执行文件
wails build
