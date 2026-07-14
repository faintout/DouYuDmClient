const { ipcRenderer } = require('electron');

function logToMain(level, ...args) {
  ipcRenderer.send('renderer-log', level, ...args);
}

// 配置对象，从主进程获取
let config = {};

let ws = null;
let reconnectTimer = null;
let currentWsUrl = null; // 当前连接的URL
let retryCount = 0; // 当前重试次数
const maxMessages = 100; // 最多保留100条消息

// 加载配置
async function loadConfig() {
  // 从主进程获取配置
  config = await ipcRenderer.invoke('get-config');
  console.log('已加载配置:', config);
  logToMain('info', '已加载配置', {
    socketUrl: config.socketUrl,
    roomId: config.roomId
  });
  applyConfig();
}

// 应用配置
function applyConfig() {
  const container = document.getElementById('container');
  const opacity = config.backgroundOpacity / 100;
  const bgColor = hexToRgb(config.backgroundColor || '#000000');
  
  if (bgColor) {
    container.style.backgroundColor = `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, ${opacity})`;
  } else {
    container.style.backgroundColor = `rgba(0, 0, 0, ${opacity})`;
  }
  
  document.body.style.color = config.textColor || '#ffffff';
  
  // 检查配置是否完整
  const hasSocketUrl = config.socketUrl && config.socketUrl.trim() !== '';
  const hasRoomId = config.roomId && config.roomId.trim() !== '';
  
  if (!hasSocketUrl || !hasRoomId) {
    console.log('配置不完整，无法连接');
    
    // 显示提示信息到页面
    const messageList = document.getElementById('messageList');
    messageList.innerHTML = ''; // 清空现有消息
    
    const tipDiv = document.createElement('div');
    tipDiv.className = 'config-tip';
    tipDiv.style.padding = '20px';
    tipDiv.style.textAlign = 'center';
    tipDiv.style.color = '#ff6b6b';
    
    let tipMessage = '<h3>⚠️ 配置缺失</h3>';
    if (!hasSocketUrl) {
      tipMessage += '<p>❌ Socket连接地址未配置</p>';
    }
    if (!hasRoomId) {
      tipMessage += '<p>❌ 房间号未配置</p>';
    }
    tipMessage += '<p style="margin-top: 15px; color: #ffd93d;">💡 请右键打开配置窗口进行设置</p>';
    
    tipDiv.innerHTML = tipMessage;
    messageList.appendChild(tipDiv);
    
    // 如果已有连接，关闭它
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('关闭现有 WebSocket 连接');
      ws.close();
    }
    return;
  }
  
  // 检查 WebSocket 连接地址或房间号是否改变
  const newUrl = `${config.socketUrl}${config.roomId}`;
  
  // 如果 URL 或房间号改变，或者没有连接，则重新连接
  if (currentWsUrl !== newUrl || !ws || ws.readyState === WebSocket.CLOSED) {
    console.log('=== 连接状态检查 ===');
    console.log('当前 URL:', currentWsUrl);
    console.log('新 URL:', newUrl);
    console.log('WebSocket 状态:', ws ? ws.readyState : 'null');
    console.log('URL 是否改变:', currentWsUrl !== newUrl);
    
    // 清除重连定时器
    clearReconnectTimer();
    
    // 重置重试计数
    retryCount = 0;
    
    // 重新连接（connectWebSocket 内部会关闭旧连接）
    connectWebSocket();
  } else {
    console.log('WebSocket 已连接，URL 未改变，跳过重连');
    showCurrentConnectionStatus();
  }
}

function showCurrentConnectionStatus() {
  if (!ws) {
    addSystemMessage('disconnected', '当前没有 WebSocket 连接');
    return;
  }

  if (ws.readyState === WebSocket.CONNECTING) {
    addSystemMessage('connecting', `正在连接到房间 ${config.roomId}...`);
    return;
  }

  if (ws.readyState === WebSocket.OPEN) {
    addSystemMessage('connected', `已连接到房间 ${config.roomId}`);
    return;
  }

  addSystemMessage('disconnected', '连接已断开');
}

// 十六进制转RGB
function hexToRgb(hex) {
  if (!hex) return null;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// 从URL获取房间号
function getRoomIdFromUrl(url) {
  const match = url.match(/roomId=(\d+)/);
  return match ? match[1] : null;
}

// 连接 WebSocket
function connectWebSocket() {
  // 检查配置是否完整
  if (!config.socketUrl || config.socketUrl.trim() === '') {
    console.log('Socket URL 为空，跳过 WebSocket 连接');
    return;
  }
  
  if (!config.roomId || config.roomId.trim() === '') {
    console.log('房间号为空，跳过 WebSocket 连接');
    return;
  }
  
  // 关闭已有连接
  if (ws) {
    console.log('关闭旧的 WebSocket 连接');
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null; // 移除所有事件处理
    ws.close();
    ws = null;
  }
  
  // 清空之前的弹幕（在关闭连接后清空）
  clearMessages();

  const url = `${config.socketUrl}${config.roomId}`;
  currentWsUrl = url;
  console.log('正在连接 WebSocket:', url);
  console.log('房间号:', config.roomId);
  logToMain('info', '正在连接 WebSocket', { url, roomId: config.roomId });
  
  // 显示"连接中"状态，包含房间号
  addSystemMessage('connecting', `正在连接到房间 ${config.roomId}...`);
  
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('WebSocket 连接成功，房间号:', config.roomId);
    logToMain('info', 'WebSocket 连接成功', { roomId: config.roomId });
    
    // 重置重试次数
    retryCount = 0;
    
    // 清除重连定时器
    clearReconnectTimer();
    
    // 显示"已连接"状态，包含房间号
    addSystemMessage('connected', `已连接到房间 ${config.roomId}`);
  };

  ws.onmessage = (event) => {
    // 使用 setTimeout 0 将消息处理放到下一个事件循环，避免阻塞
    setTimeout(() => {
      try {
        const data = JSON.parse(event.data);
        console.log('收到消息:', data.type, '房间号:', config.roomId);
        handleMessage(data);
      } catch (error) {
        console.error('解析消息失败:', error);
        // 显示解析错误
        addSystemMessage('error', `消息解析失败: ${error.message}`);
      }
    }, 0);
  };

  ws.onerror = (error) => {
    console.error('WebSocket 错误:', error, '房间号:', config.roomId);
    logToMain('error', 'WebSocket 错误', { roomId: config.roomId, url: currentWsUrl });
    addSystemMessage('error', '连接发生错误');
  };

  ws.onclose = () => {
    console.log('WebSocket 连接关闭，房间号:', config.roomId);
    logToMain('info', 'WebSocket 连接关闭', { roomId: config.roomId, url: currentWsUrl });
    addSystemMessage('disconnected', '连接已断开');
    scheduleReconnect();
  };
}

// 处理重连
function scheduleReconnect() {
  // 检查是否启用重连
  if (!config.reconnect || !config.reconnect.enabled) {
    console.log('自动重连已禁用');
    return;
  }
  
  const maxRetries = config.reconnect.maxRetries || -1;
  const retryInterval = config.reconnect.retryInterval || 3000;
  
  // 检查是否达到最大重试次数（-1表示无限重试）
  if (maxRetries !== -1 && retryCount >= maxRetries) {
    console.log(`已达到最大重试次数 ${maxRetries}，停止重连`);
    addSystemMessage('error', `重连失败，已达到最大重试次数 ${maxRetries}`);
    return;
  }
  
  retryCount++;
  
  clearReconnectTimer();
  
  const retryText = maxRetries === -1 
    ? `第 ${retryCount} 次重连` 
    : `第 ${retryCount}/${maxRetries} 次重连`;
  
  console.log(`${retryInterval}ms 后尝试${retryText}...`);
  addSystemMessage('reconnecting', `${retryInterval / 1000}秒后尝试${retryText}...`);
  
  reconnectTimer = setTimeout(() => {
    console.log(`正在进行${retryText}...`);
    connectWebSocket();
  }, retryInterval);
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

// 清空消息列表
function clearMessages() {
  const messageList = document.getElementById('messageList');
  messageList.innerHTML = '';
  console.log('已清空弹幕消息');
}

// 添加系统消息
function addSystemMessage(type, message) {
  const messageList = document.getElementById('messageList');
  const messageItem = document.createElement('div');
  messageItem.className = `message-item system-message ${type}`;
  
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  
  let icon = '🔗';
  let colorClass = '';
  
  switch (type) {
    case 'connecting':
      icon = '🔄';
      colorClass = 'status-connecting';
      break;
    case 'connected':
      icon = '✅';
      colorClass = 'status-connected';
      break;
    case 'disconnected':
      icon = '❌';
      colorClass = 'status-disconnected';
      break;
    case 'reconnecting':
      icon = '🔄';
      colorClass = 'status-reconnecting';
      break;
    case 'error':
      icon = '⚠️';
      colorClass = 'status-error';
      break;
  }
  
  messageItem.innerHTML = `
    <div class="message-header ${colorClass}">
      <span class="message-time">${timeStr}</span>
      <span>${icon} ${message}</span>
    </div>
  `;
  
  messageList.appendChild(messageItem);
  
  // 限制消息数量
  const messages = messageList.children;
  if (messages.length > maxMessages) {
    messageList.removeChild(messages[0]);
  }
  
  // 滚动到底部
  const container = document.getElementById('container');
  container.scrollTop = container.scrollHeight;
}

// 处理消息
function handleMessage(data) {
  const { type } = data;
  
  // 检查是否应该显示此类型消息
  // 如果配置中没有该类型，或者该类型设置为 false，则不显示
  // 但 error 类型始终显示
  if (type !== 'error' && config.messageTypes && config.messageTypes[type] === false) {
    console.log('消息类型已被过滤:', type);
    return;
  }

  // 异步添加消息，避免阻塞
  requestAnimationFrame(() => {
    addMessage(data);
  });
}

// 添加消息到列表
function addMessage(data) {
  const messageList = document.getElementById('messageList');
  const messageItem = createMessageElement(data);
  
  messageList.appendChild(messageItem);
  
  // 限制消息数量
  const messages = messageList.children;
  if (messages.length > maxMessages) {
    messageList.removeChild(messages[0]);
  }
  
  // 滚动到底部
  const container = document.getElementById('container');
  container.scrollTop = container.scrollHeight;
}

// 创建消息元素
function createMessageElement(data) {
  const div = document.createElement('div');
  div.className = `message-item ${data.type}`;
  
  const showTime = config.displayOptions?.showTime !== false;
  const showNickname = config.displayOptions?.showNickname !== false;
  const showLevel = config.displayOptions?.showLevel !== false;
  
  switch (data.type) {
    case 'connected':
      div.innerHTML = `
        <div class="message-header">
          ${showTime ? `<span class="message-time">${data.time || ''}</span>` : ''}
          <span>🔗 ${data.message || '已连接'}</span>
        </div>
      `;
      break;
      
    case 'uenter':
      div.innerHTML = `
        <div class="message-header">
          ${showTime ? `<span class="message-time">${data.time || ''}</span>` : ''}
          ${showNickname ? `<span class="message-nickname">${escapeHtml(data.nickname || '')}</span>` : ''}
          ${showLevel ? `<span class="message-level">Lv.${data.level || ''}</span>` : ''}
          <span>进入房间</span>
        </div>
      `;
      break;
      
    case 'chatmsg':
      div.innerHTML = `
        <div class="message-header">
          ${showTime ? `<span class="message-time">${data.time || ''}</span>` : ''}
          ${showNickname ? `<span class="message-nickname">${escapeHtml(data.nickname || '')}</span>` : ''}
          ${showLevel ? `<span class="message-level">Lv.${data.level || ''}</span>` : ''}
        </div>
        <div class="message-content">${escapeHtml(data.content || '')}</div>
      `;
      break;
      
    case 'gift':
      div.innerHTML = `
        <div class="message-header">
          ${showTime ? `<span class="message-time">${data.time || ''}</span>` : ''}
          ${showNickname ? `<span class="message-nickname">${escapeHtml(data.nickname || '')}</span>` : ''}
        </div>
        <div class="message-gift-info">
          <span>🎁 送出</span>
          <span class="gift-name">${escapeHtml(data.giftName || '')}</span>
          <span class="gift-count">x${data.giftCount || ''}</span>
        </div>
      `;
      break;
      
    case 'error':
      div.innerHTML = `
        <div class="message-header status-error">
          ${showTime ? `<span class="message-time">${data.time || new Date().toLocaleTimeString('zh-CN', {hour12: false})}</span>` : ''}
          <span>⚠️ 错误</span>
        </div>
        <div class="message-content" style="color: #ff6b6b;">
          ${escapeHtml(data.message || JSON.stringify(data))}
        </div>
      `;
      break;
      
    default:
      // 显示所有未知类型的消息
      div.innerHTML = `
        <div class="message-header">
          ${showTime ? `<span class="message-time">${new Date().toLocaleTimeString('zh-CN', {hour12: false})}</span>` : ''}
          <span>📨 ${data.type || '未知消息'}</span>
        </div>
        <div class="message-content">
          ${data.message ? escapeHtml(data.message) : JSON.stringify(data)}
        </div>
      `;
  }
  
  return div;
}

// HTML 转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 右键菜单
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  ipcRenderer.send('show-context-menu');
});

// 窗口拖拽功能
const container = document.getElementById('container');
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

container.addEventListener('mousedown', async (e) => {
  // 只响应左键
  if (e.button === 0) {
    // 先锁定窗口大小（同步调用，避免延迟）
    await ipcRenderer.invoke('lock-window-size', true);
    
    isDragging = true;
    dragStartX = e.screenX;
    dragStartY = e.screenY;
    
    console.log('开始拖动');
  }
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const deltaX = e.screenX - dragStartX;
    const deltaY = e.screenY - dragStartY;
    
    ipcRenderer.send('move-window', { deltaX, deltaY });
    
    dragStartX = e.screenX;
    dragStartY = e.screenY;
  }
});

document.addEventListener('mouseup', async () => {
  if (isDragging) {
    isDragging = false;
    console.log('结束拖动');
    
    // 拖动结束后解锁窗口大小
    await ipcRenderer.invoke('lock-window-size', false);
  }
});

// 监听配置更新
ipcRenderer.on('config-updated', (event, newConfig) => {
  logToMain('info', '收到 config-updated', {
    socketUrl: newConfig.socketUrl,
    roomId: newConfig.roomId
  });
  config = newConfig;
  applyConfig();
});

// 初始化
loadConfig();
