# GitHub Actions CI/CD 构建指南

## 📋 概述

本项目配置了自动化的 GitHub Actions 工作流，支持在 Mac、Windows、Linux 三个平台自动构建并发布应用。

## 🚀 工作流说明

### 1. Release 工作流 (release.yml)
- **触发条件**：推送版本标签 (e.g., `v1.0.0`)
- **执行内容**：
  - 在三个平台上并行构建应用
  - 生成安装程序和便携版
  - 自动创建 GitHub Release 并上传产物
- **产物**：
  - **Windows**: `.exe` (NSIS 安装器) + 便携版
  - **macOS**: `.dmg` (磁盘镜像)
  - **Linux**: `.AppImage` + `.deb` (Debian 包)

### 2. Test Build 工作流 (test-build.yml)
- **触发条件**：
  - 推送到 `main` 或 `develop` 分支
  - 创建 Pull Request
- **执行内容**：验证构建是否成功（不上传产物）
- **目的**：及时发现构建问题

## 📦 使用方法

### 方式 1：自动发布 (推荐)

1. **创建版本标签**：
```bash
# 本地创建标签
git tag v1.0.2

# 推送标签到 GitHub
git push origin v1.0.2
```

2. **监控构建**：
   - 打开 GitHub 仓库的 `Actions` 标签页
   - 查看 "Build and Release" 工作流的进度
   - 构建完成后，Release 页面会自动出现新版本

3. **下载产物**：
   - 进入 [Releases](https://github.com/faintout/DouYuDmClient/releases) 页面
   - 下载对应平台的安装程序

### 方式 2：本地构建

```bash
# 安装依赖
npm install

# 构建所有平台
npm run build

# 仅构建特定平台
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux

# 产物位置
dist/                # 构建输出目录
```

## 🔧 技术细节

### 环境要求

| 组件 | 版本 |
|-----|-----|
| Node.js | 20 LTS |
| Electron | ^43.1.0 |
| electron-builder | ^26.15.3 |

### 构建流程

1. **检出代码** → 
2. **清理旧依赖** (Windows only) →
3. **安装依赖** (npm install) →
4. **编译应用** (electron-builder) →
5. **生成安装器** →
6. **上传产物** →
7. **创建 Release** (release 工作流)

### 超时设置

- 单个构建任务：**120 分钟**
- Release 创建：依赖构建完成

## 📊 配置说明

### package.json build 字段

```json
{
  "build": {
    "appId": "com.douyu.dmclient",
    "productName": "斗鱼弹幕客户端",
    "asar": true,
    "compression": "normal",
    "win": { /* Windows 配置 */ },
    "mac": { /* macOS 配置 */ },
    "linux": { /* Linux 配置 */ }
  }
}
```

### Windows 目标

- **NSIS**: 标准安装程序，支持自定义安装路径
- **Portable**: 无需安装的便携版本

### macOS 目标

- **DMG**: 磁盘镜像安装程序
- **ZIP**: 压缩版本

### Linux 目标

- **AppImage**: 通用 Linux 应用格式
- **DEB**: Debian/Ubuntu 包格式

## ⚙️ 常见问题

### Q1: 构建失败提示 "EPERM: operation not permitted"

**原因**：Windows 文件锁定问题

**解决**：工作流已包含自动清理步骤，重新运行工作流即可

### Q2: GitHub Actions 报 "Error: The operation was canceled"

**原因**：可能是网络超时或依赖下载失败

**解决**：
- 检查网络连接
- 重新推送标签以触发工作流
- 查看工作流日志了解具体错误

### Q3: 如何修改应用图标和名称

编辑 `package.json` 的 `build` 字段：

```json
{
  "build": {
    "productName": "新应用名称",
    "win": { "icon": "path/to/icon.ico" },
    "mac": { "icon": "path/to/icon.icns" },
    "linux": { "icon": "path/to/icon.png" }
  }
}
```

### Q4: 构建后应用无法启动

检查以下项：
1. `main.js` 是否正确配置
2. 所有资源文件是否在 `build.files` 中
3. 本地测试 `npm start` 是否正常

## 📝 版本管理

推荐使用 [Semantic Versioning](https://semver.org/):

```
v<主版本>.<次版本>.<修订版本>

例如：
v1.0.0  - 初始发布
v1.1.0  - 添加新功能
v1.0.1  - 修复 bug
v2.0.0  - 重大更新
```

## 🔍 监控和调试

### 查看工作流日志

1. 打开 GitHub 仓库 → Actions 标签页
2. 选择对应的工作流运行
3. 点击失败的 job 查看详细日志

### 本地构建调试

```bash
# 启用详细输出
DEBUG=electron-builder npm run build:win

# 检查生成的配置
npm run build:win 2>&1 | grep -i "configuration\|error"
```

## 📞 支持

如遇问题，请：
1. 检查工作流日志
2. 查阅本指南的常见问题
3. 提交 Issue 至 GitHub
4. 联系项目维护者

---

**最后更新**：2026-07-14

**相关文件**：
- `.github/workflows/release.yml` - 发布工作流
- `.github/workflows/test-build.yml` - 测试工作流
- `package.json` - 项目配置
