const { ipcRenderer } = require('electron');

// 配置对象，从主进程获取
let config = {};

let ws = null;
let reconnectTimer = null;
const maxMessages = 100; // 最多保留100条消息

// 加载配置
async function loadConfig() {
  // 从主进程获取配置
  config = await ipcRenderer.invoke('get-config');
  console.log('已加载配置:', config);
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
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    // 如果当前连接的 URL 和新配置的 URL 不同，重新连接
    if (ws.url !== newUrl) {
      console.log('检测到 Socket URL 或房间号变化，重新连接...');
      console.log('旧 URL:', ws.url);
      console.log('新 URL:', newUrl);
      connectWebSocket();
    }
  } else if (!ws || ws.readyState === WebSocket.CLOSED) {
    connectWebSocket();
  }
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
  
  if (ws) {
    ws.close();
  }

  const url = `${config.socketUrl}${config.roomId}`;
  console.log('正在连接 WebSocket:', url);
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('WebSocket 连接成功');
    clearReconnectTimer();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleMessage(data);
    } catch (error) {
      console.error('解析消息失败:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket 错误:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket 连接关闭');
    scheduleReconnect();
  };
}

// 处理重连
function scheduleReconnect() {
  clearReconnectTimer();
  reconnectTimer = setTimeout(() => {
    console.log('尝试重连...');
    connectWebSocket();
  }, 3000);
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

// 处理消息
function handleMessage(data) {
  const { type } = data;
  
  // 检查是否应该显示此类型消息
  if (!config.messageTypes[type]) {
    return;
  }

  addMessage(data);
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
      
    default:
      div.innerHTML = `<div>${JSON.stringify(data)}</div>`;
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
  config = newConfig;
  applyConfig();
});

// 初始化
loadConfig();
