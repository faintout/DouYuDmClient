# 配置管理流程说明

## 配置文件位置

### 唯一配置源：config.json

**开发环境位置：** `项目根目录/config.json`

**打包后位置：** 用户数据目录（可读写）
- Windows: `C:\Users\用户名\AppData\Roaming\douyu-dm-client\config.json`
- macOS: `~/Library/Application Support/douyu-dm-client/config.json`
- Linux: `~/.config/douyu-dm-client/config.json`

所有配置都存储在这个 JSON 文件中，代码不再包含配置对象。打包后使用用户数据目录确保配置可以正常读写。

**文件内容示例：**
```json
{
  "backgroundColor": "#000000",
  "backgroundOpacity": 80,
  "textColor": "#ffffff",
  "socketUrl": "ws://139.9.106.182:8080/?roomId=",
  "roomId": "",
  "windowSize": {
    "width": 600,
    "height": 400
  },
  "messageTypes": {
    "connected": true,
    "uenter": true,
    "chatmsg": true,
    "gift": true
  },
  "displayOptions": {
    "showTime": true,
    "showNickname": true,
    "showLevel": true
  }
}
```

**特点：**
- ✅ 配置与代码完全分离
- ✅ 可以手动编辑配置文件
- ✅ 代码中不包含任何配置定义
- ✅ 首次运行时自动创建默认配置文件
- ✅ 打包后使用用户数据目录，确保可读写

## 配置流程

```
┌─────────────────────────────────────────────────────────────┐
│                      启动流程                                 │
└─────────────────────────────────────────────────────────────┘

1. 应用启动
   ↓
2. main.js 检查 config.json 是否存在
   ├─ 存在：直接读取使用
   └─ 不存在：显示错误提示
   ↓
3. renderer.js 通过 IPC 请求配置
   ↓
4. main.js 读取 config.json 并返回
   ↓
5. renderer.js 应用配置并连接 WebSocket

┌─────────────────────────────────────────────────────────────┐
│                      修改配置流程                             │
└─────────────────────────────────────────────────────────────┘

1. 用户打开配置窗口（config.html）
   ↓
2. config.js 通过 IPC 读取 config.json
   ↓
3. 用户修改配置
   ↓
4. 点击"确定"，config.js 发送新配置到主进程
   ↓
5. main.js 直接写入 config.json
   ↓
6. main.js 通知 renderer.js 配置已更新
   ↓
7. renderer.js 应用新配置（重新连接 WebSocket 等）

┌─────────────────────────────────────────────────────────────┐
│                      手动修改配置                             │
└─────────────────────────────────────────────────────────────┘

1. 关闭应用
   ↓
2. 编辑项目根目录的 config.json
   ↓
3. 保存文件
   ↓
4. 重新启动应用
   ↓
5. 应用自动加载新配置
```

## 文件职责

### config.json（配置文件）
- ✅ 存储所有配置项
- ✅ 可手动编辑
- ⚠️ 必须手动创建或确保存在

### main.js（主进程）
- ❌ 不存储配置对象
- ❌ 不包含任何配置定义
- ✅ 读取 config.json 文件
- ✅ 写入 config.json 文件
- ✅ 检查配置文件是否存在
- ✅ 通过 IPC 提供配置给渲染进程

### renderer.js（渲染进程 - 主窗口）
- ❌ 不存储配置对象
- ✅ 通过 IPC 从文件获取配置
- ✅ 应用配置（样式、WebSocket 连接等）
- ✅ 监听配置更新

### config.js（渲染进程 - 配置窗口）
- ❌ 不存储配置对象
- ✅ 通过 IPC 从文件获取配置
- ✅ 提供配置界面
- ✅ 通过 IPC 写入配置到文件

## 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| backgroundColor | String | '#000000' | 背景颜色（十六进制） |
| backgroundOpacity | Number | 80 | 背景透明度（0-100） |
| textColor | String | '#ffffff' | 文字颜色（十六进制） |
| socketUrl | String | 'ws://139.9.106.182:8080/?roomId=' | WebSocket 连接地址 |
| roomId | String | '' | 房间号 |
| windowSize.width | Number | 600 | 窗口宽度 |
| windowSize.height | Number | 400 | 窗口高度 |
| messageTypes.connected | Boolean | true | 显示连接消息 |
| messageTypes.uenter | Boolean | true | 显示用户进入消息 |
| messageTypes.chatmsg | Boolean | true | 显示弹幕消息 |
| messageTypes.gift | Boolean | true | 显示礼物消息 |
| displayOptions.showTime | Boolean | true | 显示时间 |
| displayOptions.showNickname | Boolean | true | 显示用户名 |
| displayOptions.showLevel | Boolean | true | 显示等级 |

## 注意事项

1. **配置完全存储在 config.json** - 代码中不包含任何配置定义
2. **每次读取都从文件加载** - 确保获取最新配置
3. **可以手动编辑 config.json** - 应用重启后生效
4. **配置验证在保存时进行** - `config.js` 中验证用户输入
5. **房间号为空时不连接** - 避免无效连接
6. **自动创建配置文件** - 首次运行时自动创建默认配置
7. **打包后使用用户数据目录** - 确保配置文件可读写

## 配置架构优势

```
之前：代码中硬编码配置 + 持久化文件
现在：只有 config.json 一个配置源

优势：
✅ 配置与代码完全分离
✅ 更易于手动修改和管理
✅ 配置文件可以版本控制
✅ 部署时只需替换 config.json
✅ 避免配置不一致问题
```
