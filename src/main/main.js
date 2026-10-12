/*
 * @Author: harrio
 * @Date: 2026-10-12 14:28:25
 * @LastEditors: harrio
 * @LastEditTime: 2026-10-12 16:12:37
 * @Description: 
 */
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

// 创建主窗口
let mainWindow = null;
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: 800,
    minHeight: 560,
    frame: false, // 无边框窗口
    titleBarStyle: 'hidden', // 隐藏标题栏
    backgroundColor: '#000', // 设置背景颜色
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'), // 预加载脚本路径 __dirname：当前文件所在目录
      contextIsolation: true, // 启用上下文隔离（推荐）
      nodeIntegration: false // 禁用 Node.js 集成（推荐），提高安全性
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html')); // loadFile: 加载本地 HTML 文件

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
    height: 160,
    x: Math.round((width - 760) / 2), // 居中显示
    y: Math.round(height - 180), // 底部显示
    frame: false,
    transparent: true, // 透明窗口
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

// app就绪后创建窗口
app.whenReady().then(() => {
  createMainWindow();
  createOverlayWindow();
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
