import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderOpen, 
  Play, 
  Square, 
  Trash2, 
  Copy, 
  Plus, 
  Settings, 
  Monitor, 
  CheckCircle2,
  AlertCircle,
  X,
  Server,
  Info
} from 'lucide-react';

import {
  StartWebDAV,
  StopWebDAV,
  SelectDirectory,
  GetGlobalAuth,
  SetGlobalAuth,
  GetPersistedShares,
  SaveSharesState,
  GetAutostartEnabled,
  SetAutostartEnabled,
  GetLocalIP,
} from '../wailsjs/go/main/App';

// 定义共享项的 TypeScript 类型接口
interface ShareItem {
  id: number;
  folder: string;
  port: number;
  status: 'running' | 'stopped';
  url: string;
}

// 侧边栏导航组件的属性类型 (注意 active 是可选的 ?)
interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void; // 添加 onClick 属性类型
}

const INITIAL_SHARES: ShareItem[] = [];

export default function App() {
  // 为 State 添加类型注解
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings' | 'about'>('dashboard'); // 更新路由状态，包含 about
  const [shares, setShares] = useState<ShareItem[]>(INITIAL_SHARES);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newFolderPath, setNewFolderPath] = useState<string>('E:\\Downloads');
  const [newPort, setNewPort] = useState<number>(10236);
  const [toast, setToast] = useState<string | null>(null);
  const [globalUsername, setGlobalUsername] = useState('');
  const [globalPassword, setGlobalPassword] = useState('');
  const [authSaving, setAuthSaving] = useState(false);
  const [persistReady, setPersistReady] = useState(false);
  const persistLoadOk = useRef(false);
  const [autostart, setAutostart] = useState(false);
  const [autostartBusy, setAutostartBusy] = useState(false);
  const [localIp, setLocalIp] = useState('127.0.0.1');

  useEffect(() => {
    GetLocalIP().then(setLocalIp).catch(console.error);
  }, []);

  useEffect(() => {
    setShares(prev => prev.map(s => ({ ...s, url: `http://${localIp}:${s.port}` })));
  }, [localIp]);

  const generateNextPort = (): number => {
    const usedPorts = shares.map(s => s.port);
    let port = 10234;
    while (usedPorts.includes(port)) {
      port++;
    }
    return port;
  };

  const handleOpenModal = () => {
    setNewPort(generateNextPort());
    setNewFolderPath('E:\\New_Share_Folder');
    setIsModalOpen(true);
  };

  const handleBrowseFolder = async () => {
    try {
      const dir = await SelectDirectory();
      if (dir) setNewFolderPath(dir);
    } catch (e) {
      alert('选择文件夹失败: ' + e);
    }
  };

  const handleToggleAutostart = async () => {
    setAutostartBusy(true);
    try {
      await SetAutostartEnabled(!autostart);
      const next = await GetAutostartEnabled();
      setAutostart(next);
      showToast(next ? '已开启开机自启' : '已关闭开机自启');
    } catch (e) {
      alert('设置开机自启失败: ' + e);
    } finally {
      setAutostartBusy(false);
    }
  };

  const handleSaveGlobalAuth = async () => {
    setAuthSaving(true);
    try {
      await SetGlobalAuth(globalUsername, globalPassword);
      showToast('认证设置已保存');
    } catch (e) {
      alert('保存失败: ' + e);
    } finally {
      setAuthSaving(false);
    }
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    GetGlobalAuth()
      .then((auth) => {
        setGlobalUsername(auth.username ?? '');
        setGlobalPassword(auth.password ?? '');
      })
      .catch((err) => console.error('加载认证配置失败', err));
  }, []);

  useEffect(() => {
    GetPersistedShares()
      .then((list) => {
        setShares(
          list.map((m) => ({
            id: Number(m.id),
            folder: m.folder,
            port: m.port,
            status: m.status === 'running' ? 'running' : 'stopped',
            url: `http://${localIp}:${m.port}`,
          }))
        );
        persistLoadOk.current = true;
        setPersistReady(true);
      })
      .catch((err) => {
        console.error('加载挂载列表失败', err);
        persistLoadOk.current = false;
        setPersistReady(true);
      });
  }, []);

  useEffect(() => {
    if (!persistReady || !persistLoadOk.current) return;
    const payload = shares.map((s) => ({
      id: s.id,
      folder: s.folder,
      port: s.port,
      status: s.status,
    }));
    SaveSharesState(payload).catch((err) => console.error('保存挂载列表失败', err));
  }, [shares, persistReady]);

  useEffect(() => {
    GetAutostartEnabled()
      .then(setAutostart)
      .catch((err) => console.error('读取开机自启状态失败', err));
  }, []);

  const handleAddShare = () => {
    if (!newFolderPath) return;
    const newShare: ShareItem = {
      id: Date.now(),
      folder: newFolderPath,
      port: newPort,
      status: 'stopped',
      url: `http://${localIp}:${newPort}`
    };
    setShares([...shares, newShare]);
    setIsModalOpen(false);
    showToast('已成功创建新的 WebDAV 挂载点');
  };

  const toggleStatus = async (id: number) => {
    const share = shares.find(s => s.id === id);
    if (!share) return;

    if (share.status === 'stopped') {
      try {
        // 调用 Go 后端启动服务
        await StartWebDAV(share.folder, share.port);
        setShares(shares.map(s => s.id === id ? { ...s, status: 'running' } : s));
        showToast(`服务已启动: ${share.port}`);
      } catch (e) {
        alert("启动失败: " + e);
      }
    } else {
      try {
        // 调用 Go 后端停止服务
        await StopWebDAV(share.port);
        setShares(shares.map(s => s.id === id ? { ...s, status: 'stopped' } : s));
        showToast(`服务已停止: ${share.port}`);
      } catch (e) {
        alert("停止失败: " + e);
      }
    }
  };

  const deleteShare = async (id: number) => {
    const share = shares.find(s => s.id === id);
    if (share && share.status === 'running') {
      try {
        await StopWebDAV(share.port); // 删除前自动停止后台服务
      } catch (e) {
        console.error("停止服务失败", e);
      }
    }
    setShares(shares.filter(share => share.id !== id));
    showToast('挂载点已删除');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast('地址已复制到剪贴板');
    }).catch(() => {
      // 降级复制方案
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        showToast('地址已复制到剪贴板');
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
    });
  };

  // 渲染主内容区的函数
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <>
            {/* 顶部标题栏 */}
            <header className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-white/80 backdrop-blur-md z-10">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">服务看板</h2>
                <p className="text-sm text-gray-500 mt-1">管理并监控你的本地 WebDAV 共享服务。</p>
              </div>
              <button 
                onClick={handleOpenModal}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
              >
                <Plus size={16} />
                新建共享
              </button>
            </header>

            {/* 列表区 */}
            <main className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
              {shares.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <FolderOpen size={48} className="mb-4 opacity-50" />
                  <p>暂无共享的服务，点击右上角新建。</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {shares.map(share => (
                    <div 
                      key={share.id} 
                      className="bg-white border border-gray-200 rounded-lg p-5 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow group"
                    >
                      <div className="flex items-center gap-5">
                        {/* 状态指示器 */}
                        <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-gray-50 border border-gray-100">
                          {share.status === 'running' ? (
                            <span className="flex h-3 w-3 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                          ) : (
                            <span className="h-3 w-3 rounded-full bg-gray-300"></span>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 text-base">{share.folder}</h3>
                            {share.status === 'running' && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                                运行中
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 font-mono">
                              {share.url}
                            </code>
                            <button 
                              onClick={() => copyToClipboard(share.url)}
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                              title="复制链接"
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleStatus(share.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            share.status === 'running' 
                              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200' 
                              : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                          }`}
                        >
                          {share.status === 'running' ? (
                            <><Square size={14} className="fill-current" /> 停止</>
                          ) : (
                            <><Play size={14} className="fill-current" /> 启动</>
                          )}
                        </button>
                        
                        <button
                          onClick={() => deleteShare(share.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors ml-2 opacity-0 group-hover:opacity-100"
                          title="删除配置"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </main>
          </>
        );
      case 'settings':
        return (
          <>
            <header className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-white/80 backdrop-blur-md z-10">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">全局设置</h2>
                <p className="text-sm text-gray-500 mt-1">
                  配置 WebDAV 服务的默认行为。关闭主窗口将隐藏到任务栏通知区，不会停止服务；在托盘图标上右键可选择「退出」以结束程序。
                </p>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
              <div className="max-w-2xl bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="p-6 border-b border-gray-100">
                  <h3 className="text-lg font-medium text-gray-900">开机自启</h3>
                  <p className="mt-1 text-sm text-gray-500">随系统启动并自动恢复上次运行的 WebDAV 挂载点。</p>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      disabled={autostartBusy}
                      onClick={handleToggleAutostart}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ${
                        autostart ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                      role="switch"
                      aria-checked={autostart}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          autostart ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-sm font-medium text-gray-900">
                      {autostart ? '已开启' : '已关闭'}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    开启后会在当前用户登录时启动本程序；程序启动时会按上次运行中的挂载点自动拉起 WebDAV（文件夹不存在或端口占用时会跳过该项）。
                  </p>
                </div>
                
                <div className="p-6 border-b border-gray-100 rounded-b-lg">
                  <h3 className="text-lg font-medium text-gray-900">全局 WebDAV 认证</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    设置用户名与密码后，所有挂载点使用 HTTP 基本认证；用户名为空时不校验（便于本机调试）。
                  </p>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label htmlFor="global-dav-user" className="block text-sm font-medium text-gray-700 mb-1.5">用户名</label>
                      <input
                        id="global-dav-user"
                        type="text"
                        autoComplete="username"
                        value={globalUsername}
                        onChange={(e) => setGlobalUsername(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="例如: davuser"
                      />
                    </div>
                    <div>
                      <label htmlFor="global-dav-pass" className="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
                      <input
                        id="global-dav-pass"
                        type="password"
                        autoComplete="current-password"
                        value={globalPassword}
                        onChange={(e) => setGlobalPassword(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="访问 WebDAV 时使用的密码"
                      />
                    </div>
                    <p className="text-xs text-gray-500 flex items-start gap-1">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      修改认证后，已在运行的共享需先停止再启动才会应用新凭据。
                    </p>
                    <button
                      type="button"
                      onClick={handleSaveGlobalAuth}
                      disabled={authSaving}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm disabled:opacity-60 disabled:pointer-events-none"
                    >
                      {authSaving ? '保存中…' : '保存认证设置'}
                    </button>
                  </div>
                </div>
              </div>
            </main>
          </>
        );
      case 'about':
        return (
          <>
            <header className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-white/80 backdrop-blur-md z-10">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">关于程序</h2>
                <p className="text-sm text-gray-500 mt-1">
                  了解 WebDAV WinUI 的更多信息。
                </p>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
              <div className="max-w-2xl bg-white border border-gray-200 rounded-lg shadow-sm p-8">
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                    <Server size={40} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">WebDAV Manager</h3>
                  <p className="text-gray-500 mt-2">极简、美观的 Windows 本地 WebDAV 挂载工具</p>
                  
                  <div className="w-full h-px bg-gray-100 my-8"></div>
                  
                  <div className="space-y-6 w-full text-left">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                        <Monitor size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">版本信息</h4>
                        <p className="text-sm text-gray-500">v1.0.0 Stable</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                        <div className="w-5 h-5 flex items-center justify-center text-xs font-bold text-gray-500">A</div>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">作者</h4>
                        <p className="text-sm text-gray-500">yeahuichan</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                        <AlertCircle size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900">联系邮箱</h4>
                        <p className="text-sm text-gray-500">yeahui1128@gmail.com</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-12 text-xs text-gray-400">
                    Built with Wails & React. Powering local file sharing.
                  </div>
                </div>
              </div>
            </main>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-[#f3f3f3] text-gray-800 font-sans selection:bg-blue-200">
      
      {/* 侧边栏 */}
      <div className="w-64 bg-[#f3f3f3] border-r border-gray-200 flex flex-col p-4">
        <div className="flex items-center gap-3 mb-8 px-2 mt-2">
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white shadow-sm">
            <Server size={18} />
          </div>
          <h1 className="text-sm font-semibold tracking-wide">WebDAV Manager</h1>
        </div>

        <nav className="flex-1 space-y-1">
          <NavItem 
            icon={<Monitor size={18} />} 
            label="服务看板" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <NavItem 
            icon={<Settings size={18} />} 
            label="系统设置" 
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          />
          <NavItem 
            icon={<Info size={18} />} 
            label="关于程序" 
            active={activeTab === 'about'}
            onClick={() => setActiveTab('about')}
          />
        </nav>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white rounded-tl-xl border-t border-l border-gray-200 shadow-sm relative">
        {renderContent()}
      </div>

      {/* 新建配置的模态框 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-[480px] overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-semibold text-gray-800">新建 WebDAV 共享</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">目标文件夹</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FolderOpen size={16} className="text-gray-400" />
                    </div>
                    <input 
                      type="text" 
                      value={newFolderPath}
                      onChange={(e) => setNewFolderPath(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="例如: D:\Data"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleBrowseFolder}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md text-sm font-medium transition-colors shrink-0"
                  >
                    浏览...
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">分配端口 (自动)</label>
                <div className="flex gap-2 items-center">
                  <span className="text-gray-500 text-sm">http://{localIp}:</span>
                  <input 
                    type="number" 
                    value={newPort}
                    onChange={(e) => setNewPort(Number(e.target.value))}
                    className="block w-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                  <AlertCircle size={12} /> 端口已自动避开当前使用项
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                取消
              </button>
              <button 
                onClick={handleAddShare}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm"
              >
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast 提示 */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-800 text-white px-4 py-3 rounded-md shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-5">
          <CheckCircle2 size={18} className="text-green-400" />
          <span className="text-sm">{toast}</span>
        </div>
      )}

    </div>
  );
}

// 侧边栏导航组件
function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors mx-2 ${
      active ? 'bg-white text-blue-600 shadow-sm border border-gray-200/60' : 'text-gray-600 hover:bg-gray-200/50'
    }`}>
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}