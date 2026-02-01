# Todo Floating Ball
[中文版](README_zh.md)

A lightweight Windows desktop todo application featuring a floating ball interface, built with [Wails](https://wails.io/) (Go + React).

## Features

- **Floating Ball Interface**
  - **Always-on-top**: Keeps your tasks accessible.
  - **Auto-Docking**: Automatically snaps to the left or right screen edge when dragged near it (similar to assistive touch).
  - **Interactive**: 
    - Click to expand/collapse when docked.
    - Right-click to open the quick menu.
    - Drag to move.
  - **Status Indication**: Visual feedback (color changes) for expired or upcoming tasks.

- **Task Management**
  - Add, delete, and toggle completion status of todos.
  - Set due dates for tasks.
  - Persistent storage (tasks are saved locally).

- **System Integration**
  - **System Tray**: Minimize to tray, quick access context menu.
  - **Native Experience**: Uses Windows API for seamless window management (ToolWindow style, transparency).
  - **Customizable**: Settings for reminder colors and floating ball behavior.

## Tech Stack

- **Backend**: Go (Wails Framework)
- **Frontend**: React, TypeScript, Vite
- **Platform**: Windows (Win32 API integration)

## Prerequisites

- [Go](https://go.dev/) 1.18+ (Project uses 1.23)
- [Node.js](https://nodejs.org/) (npm)
- [Wails CLI](https://wails.io/docs/gettingstarted/installation)

## Getting Started

### Installation

1. Clone the repository.
2. Install Wails CLI if you haven't already:
   ```bash
   go install github.com/wailsapp/wails/v2/cmd/wails@latest
   ```
3. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

### Development

To run the application in development mode with hot reload:

```bash
wails dev
```

### Build

To build the production binary:

```bash
wails build
```

The executable will be generated in the `build/bin` directory.

## Project Structure

- **main.go**: Application entry point and configuration.
- **app.go**: Core application logic, including window management and docking behavior.
- **frontend/**: React frontend application.
- **platform/**: Windows-specific API implementations (User32, etc.).

## License

MIT
