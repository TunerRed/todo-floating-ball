# 待办事项悬浮球 (Todo Floating Ball)

一个基于 [Wails](https://wails.io/) (Go + React) 构建的轻量级 Windows 桌面待办事项应用，拥有独特的悬浮球交互界面。

## 功能特性

- **悬浮球界面**
  - **窗口置顶**: 始终显示在屏幕最上层，方便快速查看。
  - **自动吸附**: 拖动至屏幕左/右边缘附近时自动吸附隐藏（类似辅助触控球）。
  - **交互操作**:
    - 吸附状态下点击可展开/收起。
    - 右键点击呼出快捷菜单。
    - 支持拖拽移动。
  - **状态指示**: 根据任务状态（过期或即将到期）改变悬浮球颜色提醒。

- **任务管理**
  - 添加、删除、完成/取消完成待办事项。
  - 支持设置截止日期。
  - 数据持久化存储（本地 JSON 文件）。

- **系统集成**
  - **系统托盘**: 支持最小化到托盘，托盘右键菜单（打开/退出）。
  - **原生体验**: 集成 Windows API 实现流畅的窗口管理（工具窗口样式、透明效果）。
  - **个性化**: 支持设置提醒颜色和悬浮球行为。

## 技术栈

- **后端**: Go (Wails 框架)
- **前端**: React, TypeScript, Vite
- **平台**: Windows (Win32 API 集成)

## 环境要求

- [Go](https://go.dev/) 1.18+ (本项目使用 1.23)
- [Node.js](https://nodejs.org/) (npm)
- [Wails CLI](https://wails.io/docs/gettingstarted/installation)

## 快速开始

### 安装

1. 克隆代码仓库。
2. 安装 Wails CLI（如果尚未安装）：
   ```bash
   go install github.com/wailsapp/wails/v2/cmd/wails@latest
   ```
3. 安装前端依赖：
   ```bash
   cd frontend
   npm install
   cd ..
   ```

### 开发模式

以开发模式运行应用（支持热重载）：

```bash
wails dev
```

### 构建

构建生产环境可执行文件：

```bash
wails build
```

生成的可执行文件位于 `build/bin` 目录下。

## 项目结构

- **main.go**: 应用程序入口及配置。
- **app.go**: 核心应用逻辑，包含窗口管理和吸附行为实现。
- **frontend/**: React 前端应用代码。
- **platform/**: Windows 特定 API 实现 (User32 等)。

## 许可证

MIT
