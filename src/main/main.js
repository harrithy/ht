/*
 * @Author: harrio
 * @Date: 2026-10-12 14:28:25
 * @LastEditors: harrio
 * @LastEditTime: 2026-10-12 16:12:37
 * @Description: 
 */
const { app, BrowserWindow, ipcMain, screen, desktopCapturer } = require('electron');
const path = require('path');

// 禁用 GPU 磁盘缓存，防止 Windows 快速重启/多进程下的 0x5 文件独占拒绝访问报错
app.commandLine.appendSwitch('disable-gpu-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// 创建主窗口
let mainWindow = null;
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 740,
    minWidth: 920,
    minHeight: 620,
    frame: false, // 无边框窗口
    titleBarStyle: 'hidden', // 隐藏标题栏
    backgroundColor: '#000', // 设置背景颜色
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'), // 预加载脚本路径 __dirname：当前文件所在目录
      contextIsolation: true, // 启用上下文隔离（推荐）
      nodeIntegration: false // 禁用 Node.js 集成（推荐），提高安全性
    }
  });

  // 区分开发模式 (npm run dev 带 --dev 标志) 与本地启动 (npm start 直接加载构建包)
  const fs = require('fs');
  const isDev = process.argv.includes('--dev');
  const distPath = path.join(__dirname, '../../dist/index.html');

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    if (fs.existsSync(distPath)) {
      mainWindow.loadFile(distPath);
    } else {
      mainWindow.loadURL('http://127.0.0.1:5173');
    }
  }

  // 开发模式：如果 Vite 服务器有轻微启动延迟，失败后自动平滑重试
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    if (isDev && errorCode !== -3) { // 忽略中止错误
      console.log(`[Electron] 页面连接等待中 (${errorDescription})，1.5 秒后自动重试...`);
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL('http://127.0.0.1:5173');
        }
      }, 1500);
    }
  });

  // 开发模式：按 F12 呼出/隐藏开发者工具 (Console / Elements)
  if (!app.isPackaged) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      }
    });
  }

  mainWindow.on('closed', () => { // .on('closed'): 当窗口关闭时触发的事件,同步关闭
    mainWindow = null;
    if (overlayWindow) {
      overlayWindow.close();
    }
  });
}

// 创建悬浮窗
let overlayWindow = null;
function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();  // 抓取主屏幕的分辨率
  const { width, height } = primaryDisplay.workAreaSize; // 获取工作区的宽度和高度

  overlayWindow = new BrowserWindow({
    width: 760,
    height: 110,
    x: Math.round((width - 760) / 2), // 居中显示
    y: Math.round(height - 140), // 贴底显示
    frame: false,
    transparent: true, // 透明窗口
    backgroundColor: '#00000000', // 8位十六进制彻底指定全透明Alpha，消除Windows外层半透明遮罩
    alwaysOnTop: true, // 永远置顶在所有应用的窗口之上
    skipTaskbar: true, // 不显示在任务栏中
    resizable: true,   // 允许使用鼠标拉拽改变大小
    hasShadow: false,  // 无阴影
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlayWindow.loadFile(path.join(__dirname, '../renderer/overlay.html'));
  overlayWindow.setAlwaysOnTop(true, 'screen-saver'); // 设置窗口始终在最前面，'screen-saver' 模式确保在屏幕保护程序和全屏应用上方显示

  // 监听悬浮窗关闭事件，确保引用被清空
  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

// ==========================================
// 开发环境热重载 (Hot Reload)
// ==========================================
function setupHotReload() {
  if (app.isPackaged || !process.argv.includes('--dev')) return;

  const fs = require('fs');
  const rendererPath = path.join(__dirname, '../renderer');
  const mainFilePath = __filename;

  let rendererDebounce = null;
  // 1. 监听悬浮窗独立页面 (overlay.html) 变动 (React 主界面由 Vite HMR 毫秒级热刷新处理)
  const overlayHtmlPath = path.join(__dirname, '../renderer/overlay.html');
  if (fs.existsSync(overlayHtmlPath)) {
    fs.watch(overlayHtmlPath, () => {
      clearTimeout(rendererDebounce);
      rendererDebounce = setTimeout(() => {
        console.log('⚡ [Hot Reload] 悬浮窗 overlay.html 变动，正在热重载悬浮窗...');
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.reloadIgnoringCache();
        }
      }, 150);
    });
  }

  // 2. 监听主进程文件 (main.js)，变动时平滑自重启 Electron
  let mainDebounce = null;
  fs.watch(mainFilePath, () => {
    clearTimeout(mainDebounce);
    mainDebounce = setTimeout(() => {
      console.log('🔄 [Hot Reload] 主进程 main.js 变动，正在平滑重启应用...');
      app.relaunch();
      app.exit(0);
    }, 200);
  });
}

// app就绪后创建窗口
app.whenReady().then(() => {
  createMainWindow();
  createOverlayWindow();
  setupHotReload();
});

// 所有窗口关闭后彻底退出程序
app.on('window-all-closed', () => {
  app.quit();
});

// ==========================================
// IPC 事件监听与多窗口通讯
// ==========================================

ipcMain.on('window:minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.on('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

ipcMain.on('window:toggle-overlay', () => {
  if (!overlayWindow) {
    createOverlayWindow();
  } else {
    if (overlayWindow.isVisible()) {
      overlayWindow.hide();
    } else {
      overlayWindow.show();
    }
  }
});

ipcMain.on('overlay:set-click-through', (_event, enabled) => {
  if (overlayWindow) {
    overlayWindow.setIgnoreMouseEvents(enabled, { forward: true });
  }
});

ipcMain.on('overlay:set-opacity', (_event, opacity) => {
  if (overlayWindow) {
    const val = Math.max(0.2, Math.min(1.0, parseFloat(opacity) || 1.0));
    overlayWindow.setOpacity(val);
  }
});

// 广播翻译结果到悬浮窗与主窗口
ipcMain.on('translation:broadcast', (_event, data) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('translation:update', data);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('translation:update', data);
  }
});

ipcMain.handle('app:get-version', () => app.getVersion());

// 获取系统桌面音频/视频捕获源（用于内录系统正在播放的音视频声音）
ipcMain.handle('desktop-capturer:get-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen'] });
  return sources.map((s) => ({ id: s.id, name: s.name }));
});
