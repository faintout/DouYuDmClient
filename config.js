const { ipcRenderer } = require('electron');

let config = {};

// 加载配置
async function loadConfig() {
  config = await ipcRenderer.invoke('get-config');
  
  // 填充表单（直接使用配置文件的值，不提供默认值）
  document.getElementById('backgroundOpacity').value = config.backgroundOpacity;
  document.getElementById('opacityValue').textContent = `${config.backgroundOpacity}%`;
  
  document.getElementById('backgroundColor').value = config.backgroundColor;
  document.getElementById('backgroundColorText').value = config.backgroundColor;
  document.getElementById('colorPickerDisplay').style.background = config.backgroundColor;
  
  document.getElementById('textColor').value = config.textColor;
  document.getElementById('textColorText').value = config.textColor;
  document.getElementById('textColorDisplay').style.background = config.textColor;
  
  document.getElementById('socketUrl').value = config.socketUrl;
  document.getElementById('roomId').value = config.roomId;
  
  // 消息类型
  document.getElementById('typeConnected').checked = config.messageTypes.connected;
  document.getElementById('typeUenter').checked = config.messageTypes.uenter;
  document.getElementById('typeChatmsg').checked = config.messageTypes.chatmsg;
  document.getElementById('typeGift').checked = config.messageTypes.gift;
  
  // 显示选项
  document.getElementById('showTime').checked = config.displayOptions.showTime;
  document.getElementById('showNickname').checked = config.displayOptions.showNickname;
  document.getElementById('showLevel').checked = config.displayOptions.showLevel;
  
  // 重连配置
  if (config.reconnect) {
    document.getElementById('reconnectEnabled').checked = config.reconnect.enabled !== false;
    document.getElementById('reconnectMaxRetries').value = config.reconnect.maxRetries || -1;
    document.getElementById('reconnectInterval').value = config.reconnect.retryInterval || 3000;
  } else {
    // 默认值
    document.getElementById('reconnectEnabled').checked = true;
    document.getElementById('reconnectMaxRetries').value = -1;
    document.getElementById('reconnectInterval').value = 3000;
  }
}

// 背景透明度滑块
document.getElementById('backgroundOpacity').addEventListener('input', (e) => {
  const value = e.target.value;
  document.getElementById('opacityValue').textContent = `${value}%`;
});

// 背景颜色选择器
document.getElementById('backgroundColor').addEventListener('input', (e) => {
  const color = e.target.value;
  document.getElementById('backgroundColorText').value = color;
  document.getElementById('colorPickerDisplay').style.background = color;
});

document.getElementById('backgroundColorText').addEventListener('input', (e) => {
  const color = e.target.value;
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    document.getElementById('backgroundColor').value = color;
    document.getElementById('colorPickerDisplay').style.background = color;
  }
});

document.getElementById('colorPickerDisplay').addEventListener('click', () => {
  document.getElementById('backgroundColor').click();
});

// 文字颜色选择器
document.getElementById('textColor').addEventListener('input', (e) => {
  const color = e.target.value;
  document.getElementById('textColorText').value = color;
  document.getElementById('textColorDisplay').style.background = color;
});

document.getElementById('textColorText').addEventListener('input', (e) => {
  const color = e.target.value;
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    document.getElementById('textColor').value = color;
    document.getElementById('textColorDisplay').style.background = color;
  }
});

document.getElementById('textColorDisplay').addEventListener('click', () => {
  document.getElementById('textColor').click();
});

// 保存配置
document.getElementById('saveBtn').addEventListener('click', async () => {
  // 先读取完整的旧配置
  const oldConfig = await ipcRenderer.invoke('get-config');
  
  // 只更新表单中的字段，保留其他字段（如 windowSize）
  const newConfig = {
    ...oldConfig, // 保留所有旧配置
    backgroundOpacity: parseInt(document.getElementById('backgroundOpacity').value),
    backgroundColor: document.getElementById('backgroundColorText').value,
    textColor: document.getElementById('textColorText').value,
    socketUrl: document.getElementById('socketUrl').value.trim(),
    roomId: document.getElementById('roomId').value.trim(),
    messageTypes: {
      connected: document.getElementById('typeConnected').checked,
      uenter: document.getElementById('typeUenter').checked,
      chatmsg: document.getElementById('typeChatmsg').checked,
      gift: document.getElementById('typeGift').checked
    },
    displayOptions: {
      showTime: document.getElementById('showTime').checked,
      showNickname: document.getElementById('showNickname').checked,
      showLevel: document.getElementById('showLevel').checked
    },
    reconnect: {
      enabled: document.getElementById('reconnectEnabled').checked,
      maxRetries: parseInt(document.getElementById('reconnectMaxRetries').value),
      retryInterval: parseInt(document.getElementById('reconnectInterval').value)
    }
  };
  
  // 验证Socket URL
  if (!newConfig.socketUrl || !/^wss?:\/\/.+/.test(newConfig.socketUrl)) {
    alert('请输入有效的Socket连接地址（格式：ws://或wss://开头）！');
    return;
  }
  
  // 验证房间号
  if (!newConfig.roomId || !/^\d+$/.test(newConfig.roomId)) {
    alert('请输入有效的房间号！');
    return;
  }
  
  // 验证颜色格式
  if (!/^#[0-9A-Fa-f]{6}$/.test(newConfig.backgroundColor)) {
    alert('请输入有效的背景颜色（格式：#000000）！');
    return;
  }
  
  if (!/^#[0-9A-Fa-f]{6}$/.test(newConfig.textColor)) {
    alert('请输入有效的文字颜色（格式：#ffffff）！');
    return;
  }
  
  // 验证重连间隔
  if (newConfig.reconnect.retryInterval < 1000) {
    alert('重连间隔不能少于 1000 毫秒（1秒）！');
    return;
  }
  
  const result = await ipcRenderer.invoke('update-config', newConfig);
  if (!result || !result.success) {
    alert(`配置保存失败：${result?.error || '未知错误'}`);
    return;
  }

  ipcRenderer.send('close-config');
});

// 取消
document.getElementById('cancelBtn').addEventListener('click', () => {
  ipcRenderer.send('close-config');
});

// 标题栏关闭按钮
document.getElementById('closeBtn').addEventListener('click', () => {
  ipcRenderer.send('close-config');
});

// 初始化
loadConfig();
