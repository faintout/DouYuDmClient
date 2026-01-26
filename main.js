const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const defaultConfig = require('./config.json');


let mainWindow;
let configWindow = null;
let lockedSize = null; // 锁定的窗口尺寸

// 配置文件路径（用户数据目录，打包后可写）
const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'config.json');




// 检查配置文件是否存在，不存在则创建默认配置
function initConfig() {
  try {
    // 确保用户数据目录存在
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    if (!fs.existsSync(configPath)) {
      console.log('配置文件不存在，创建默认配置:', configPath);
      // 创建默认配置文件
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      console.log('默认配置文件已创建');
    } else {
      console.log('配置文件存在:', configPath);
    }
  } catch (error) {
    console.error('创建失败', error);
  }
}

// 加载配置（直接从文件读取）
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);
      console.log('配置已加载');
      return config;
    } else {
      console.error('配置文件不存在:', configPath);
      return {
        error: '配置文件不存在，请创建 config.json'
      };
    }
  } catch (error) {
    console.error('加载配置失败:', error);
    return {
      error: '加载配置失败: ' + error.message
    };
  }
}

// 保存配置（直接写入文件）
function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log('配置已保存:', configPath);
    return true;
  } catch (error) {
    console.error('保存配置失败:', error);
    return false;
  }
}

function createWindow() {
  // 加载配置以获取窗口大小
  const config = loadConfig();
  const windowWidth = config.windowSize?.width || 600;
  const windowHeight = config.windowSize?.height || 400;
  
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  // 设置窗口背景透明
  mainWindow.setBackgroundColor('#00000000');

  // 允许拖拽
  mainWindow.setMovable(true);
  mainWindow.setResizable(true);

  // 监听窗口大小变化，保存到配置（避免在锁定时保存）
  let resizeSaveTimer = null;
  mainWindow.on('resize', () => {
    // 如果窗口大小被锁定，不保存
    if (lockedSize) {
      return;
    }
    
    // 使用防抖，避免频繁保存
    if (resizeSaveTimer) {
      clearTimeout(resizeSaveTimer);
    }
    
    resizeSaveTimer = setTimeout(() => {
      const [width, height] = mainWindow.getSize();
      const currentConfig = loadConfig();
      currentConfig.windowSize = { width, height };
      saveConfig(currentConfig);
      console.log('窗口大小已保存:', { width, height });
    }, 500); // 500ms 后保存
  });

  // 开发时打开开发者工具
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function createConfigWindow() {
  if (configWindow) {
    configWindow.focus();
    return;
  }

  configWindow = new BrowserWindow({
    width: 400,
    height: 550,
    frame: false,
    parent: mainWindow,
    modal: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  configWindow.loadFile('config.html');
  configWindow.on('closed', () => {
    configWindow = null;
  });
}

app.whenReady().then(() => {
  // 初始化配置文件
  initConfig();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC 通信
ipcMain.handle('get-config', () => {
  // 每次都从文件读取最新配置
  return loadConfig();
});

ipcMain.handle('update-config', (event, newConfig) => {
  // 保存新配置到文件
  const success = saveConfig(newConfig);
  
  // 通知主窗口配置已更新
  if (success && mainWindow) {
    mainWindow.webContents.send('config-updated', newConfig);
  }
  
  return newConfig;
});

ipcMain.on('open-config', () => {
  createConfigWindow();
});

ipcMain.on('close-config', () => {
  if (configWindow) {
    configWindow.close();
  }
});

// 显示右键菜单
ipcMain.on('show-context-menu', () => {
  const template = [
    {
      label: '配置',
      click: () => {
        createConfigWindow();
      }
    },
    {
      type: 'separator'
    },
    {
      label: '退出',
      click: () => {
        app.quit();
      }
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  menu.popup(mainWindow);
});

ipcMain.on('move-window', (event, { deltaX, deltaY }) => {
  if (mainWindow) {
    const [x, y] = mainWindow.getPosition();
    
    if (lockedSize) {
      // 如果窗口大小被锁定，使用 setBounds 同时设置位置和大小
      mainWindow.setBounds({
        x: x + deltaX,
        y: y + deltaY,
        width: lockedSize.width,
        height: lockedSize.height
      });
    } else {
      // 正常移动
      mainWindow.setPosition(x + deltaX, y + deltaY);
    }
  }
});

// 锁定/解锁窗口大小
ipcMain.handle('lock-window-size', (event, lock) => {
  if (!mainWindow) return;

  if (lock) {
    // 保存当前尺寸
    const [width, height] = mainWindow.getSize();
    lockedSize = { width, height };
    console.log('锁定窗口大小:', lockedSize);
    
    // 禁用调整大小
    mainWindow.setResizable(false);
    
  } else {
    console.log('解锁窗口大小');
    
    lockedSize = null;
    
    // 恢复可调整大小
    mainWindow.setResizable(true);
  }
});
