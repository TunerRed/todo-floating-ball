import { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, screen, dialog } from 'electron'
import { release } from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import Store from 'electron-store'

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

// The built directory structure
//
// ├─┬ dist-electron
// │ └─┬ main.js
// │   └── preload.js
// ├─┬ dist
// │ └── index.html
//
process.env.DIST = path.join(__dirname, '../dist')
process.env.PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

if (!process.env.PUBLIC) {
  process.env.PUBLIC = process.env.DIST
}

let winMain: BrowserWindow | null = null
let winBall: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

// Store setup
interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  dueDate: string;
  reminderDays: number;
}

interface AppConfig {
  startOnBoot: boolean;
  windowWidth: number;
  windowHeight: number;
  floatingOpacity: number;
  ballColor?: string;
  ballReminderColor?: string;
  customIconPath?: string;
  mainWindowIcon?: string;
  ballWindowIcon?: string;
  refreshInterval?: number;
}

const store = new Store<{
  todos: TodoItem[];
  config: AppConfig;
  windowPos: { x: number; y: number };
  dockedSide?: 'left' | 'right';
}>({
  defaults: {
    todos: [],
    config: { 
      startOnBoot: false,
      windowWidth: 1080,
      windowHeight: 720,
      floatingOpacity: 0.8,
      ballColor: '#2ecc71',
      ballReminderColor: '#e74c3c',
      refreshInterval: 60000
    },
    windowPos: { x: -1, y: -1 }
  }
});

const preload = path.join(__dirname, 'preload.js')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = path.join(process.env.DIST, 'index.html')

// Logger setup
const logFile = path.join(app.getPath('userData'), 'app.log');
function log(msg: string) {
  const time = new Date().toISOString();
  const logMsg = `[${time}] ${msg}\n`;
  console.log(logMsg);
  try {
    fs.appendFileSync(logFile, logMsg);
  } catch (e) {
    // ignore
  }
}

function createMainWindow() {
  log('Creating Main Window');
  if (winMain) {
    log('Main Window already exists, restoring');
    if (winMain.isMinimized()) winMain.restore()
    winMain.show()
    winMain.focus()
    return
  }

  const savedConfig = store.get('config')
  let iconPath = path.join(process.env.PUBLIC || '', 'icon.ico')
  if (savedConfig && savedConfig.mainWindowIcon) {
    iconPath = savedConfig.mainWindowIcon
  }
  
  const width = savedConfig?.windowWidth || 900;
  const height = savedConfig?.windowHeight || 600;

  winMain = new BrowserWindow({
    title: '我的待办',
    icon: iconPath,
    width: width,
    height: height,
    show: false, // Hide initially
    autoHideMenuBar: true, // Hide menu bar
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })
  
  // Remove menu completely if autoHide isn't enough for user preference
  winMain.setMenuBarVisibility(false);

  if (url) {
    winMain.loadURL(url + '#/main')
  } else {
    winMain.loadFile(indexHtml, { hash: 'main' })
  }


  // winMain.webContents.openDevTools()

  // Handle close to tray
  winMain.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      winMain?.hide()
    }
  })

  winMain.once('ready-to-show', () => {
    winMain?.show()
  })
}

function createBallWindow() {
  if (winBall) return

  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const savedPos = store.get('windowPos')
  
  let x = savedPos.x
  let y = savedPos.y

  if (x === -1 || y === -1) {
    x = width - 150
    y = height - 150
  } else {
    // Check if position is too close to edge (dockable position) or docked
    // And adjust to 20px margin if so
    const targetDisplay = screen.getDisplayMatching({ x, y, width: 80, height: 80 })
    const workArea = targetDisplay.workArea
    
    // Clear any docked state
    store.delete('dockedSide')

    // Left Check
    if (x < workArea.x + 20) {
        x = workArea.x + 20
    }
    // Right Check
    else if (x + 80 > workArea.x + workArea.width - 20) {
        x = workArea.x + workArea.width - 100 // 80 width + 20 margin
    }
    
    // Top Check
    if (y < workArea.y + 20) {
        y = workArea.y + 20
    }
    // Bottom Check
    else if (y + 80 > workArea.y + workArea.height - 20) {
        y = workArea.y + workArea.height - 100
    }
  }

  winBall = new BrowserWindow({
    title: '悬浮球',
    icon: path.join(process.env.PUBLIC || '', 'icon.ico'),
    width: 80,
    height: 80,
    type: 'toolbar', // Helps with staying on top
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    x: x,
    y: y,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Always On Top (Standard)
  // This allows fullscreen apps (videos, games) to cover the ball
  winBall.setAlwaysOnTop(true);
  winBall.setVisibleOnAllWorkspaces(true);

  if (url) {
    winBall.loadURL(url + '#/ball')
  } else {
    winBall.loadFile(indexHtml, { hash: 'ball' })
  }
  
  // Save position on move
  winBall.on('moved', () => {
    if (winBall) {
      const pos = winBall.getBounds()
      store.set('windowPos', { x: pos.x, y: pos.y })
    }
  })
}

function getMenuTemplate() {
  return [
    { label: '显示主界面', click: () => createMainWindow() },
    { label: '退出', click: () => {
      isQuitting = true
      app.quit()
    }}
  ]
}

function createTray() {
  const iconPath = path.join(process.env.PUBLIC || '', 'icon.ico')
  tray = new Tray(nativeImage.createFromPath(iconPath))
  
  const contextMenu = Menu.buildFromTemplate(getMenuTemplate())
  
  tray.setToolTip('我的待办')
  tray.setContextMenu(contextMenu)
  
  tray.on('click', () => {
    createMainWindow()
  })
}

app.whenReady().then(() => {
  createTray()
  createBallWindow() // Always show ball
  createMainWindow() // Optional: Show main window on start? Usually just ball.
  
  ipcMain.on('show-ball-context-menu', () => {
    const menu = Menu.buildFromTemplate(getMenuTemplate())
    menu.popup({ window: winBall || undefined })
  })

  // Window Drag Handlers
  let dragOffset = { x: 0, y: 0 }
  ipcMain.on('window-move-start', (event, { x, y }) => {
    if (!winBall) return
    const bounds = winBall.getBounds()
    dragOffset = { x: x - bounds.x, y: y - bounds.y }
  })

  ipcMain.on('window-move', (event, { x, y }) => {
    if (!winBall) return
    winBall.setBounds({
      x: x - dragOffset.x,
      y: y - dragOffset.y,
      width: 80,
      height: 80
    })
  })
  
  ipcMain.on('window-move-end', () => {
    if (!winBall) return
    let pos = winBall.getBounds()
    
    // Docking Logic
    // If more than 1/4 (20px) outside screen
    // Ball width = 80
    // Left: x < -20
    // Right: x > workArea.width - 60
    
    const { workArea } = screen.getDisplayMatching(pos)
    const threshold = 20
    let docked = false

    if (pos.x <= workArea.x - 20) {
        // Dock Left
        winBall.setBounds({ x: workArea.x, y: pos.y, width: 15, height: 80 })
        winBall.webContents.send('ball-docked', 'left')
        docked = true
        store.set('dockedSide', 'left')
    } else if (pos.x >= (workArea.x + workArea.width) - 60) {
        // Dock Right
        winBall.setBounds({ x: workArea.x + workArea.width - 15, y: pos.y, width: 15, height: 80 })
        winBall.webContents.send('ball-docked', 'right')
        docked = true
        store.set('dockedSide', 'right')
    }

    if (docked) {
        store.set('windowPos', { x: pos.x, y: pos.y }) // Save original pos (kind of)
        return
    }

    // Edge Snapping Logic (if not docked)
    let snapped = false
    
    // Snap to Left
    if (Math.abs(pos.x - workArea.x) < threshold) {
      pos.x = workArea.x
      snapped = true
    }
    // Snap to Right
    else if (Math.abs((pos.x + pos.width) - (workArea.x + workArea.width)) < threshold) {
      pos.x = workArea.x + workArea.width - pos.width
      snapped = true
    }
    
    // Snap to Top
    if (Math.abs(pos.y - workArea.y) < threshold) {
      pos.y = workArea.y
      snapped = true
    }
    // Snap to Bottom
    else if (Math.abs((pos.y + pos.height) - (workArea.y + workArea.height)) < threshold) {
      pos.y = workArea.y + workArea.height - pos.height
      snapped = true
    }
    
    if (snapped) {
      winBall.setBounds(pos)
    }

    store.set('windowPos', { x: pos.x, y: pos.y })
    store.delete('dockedSide') // Clear docked state if normal move
    winBall.webContents.send('ball-restored') // Ensure UI is normal
  })

  ipcMain.on('undock-ball', () => {
      if (!winBall) return
      const bounds = winBall.getBounds()
      const { workArea } = screen.getDisplayMatching(bounds)
      const side = store.get('dockedSide') as string

      // Restore size
      const newBounds = {
          width: 80,
          height: 80,
          y: bounds.y,
          x: bounds.x
      }

      if (side === 'left') {
          newBounds.x = workArea.x + 20
      } else if (side === 'right') {
          newBounds.x = workArea.x + workArea.width - 100 // 80 width + 20 margin
      } else {
          // Fallback if side lost
          if (bounds.x < workArea.x + workArea.width / 2) {
              newBounds.x = workArea.x + 20
          } else {
              newBounds.x = workArea.x + workArea.width - 100
          }
      }

      winBall.setBounds(newBounds)
      winBall.webContents.send('ball-restored')
      store.delete('dockedSide')
      store.set('windowPos', { x: newBounds.x, y: newBounds.y })
  })


  // IPC Handlers
  ipcMain.handle('get-todos', () => {
    log('IPC: get-todos called');
    return store.get('todos')
  })

  ipcMain.handle('add-todo', (event, todo: TodoItem) => {
    log('IPC: add-todo called: ' + todo.title);
    const todos = store.get('todos')
    todos.push(todo)
    store.set('todos', todos)
    // Broadcast update
    winMain?.webContents.send('todos-updated')
    winBall?.webContents.send('todos-updated')
    return todos
  })

  ipcMain.handle('toggle-todo', (event, id: string) => {
    log('IPC: toggle-todo called: ' + id);
    const todos = store.get('todos')
    const index = todos.findIndex(t => t.id === id)
    if (index !== -1) {
      todos[index].completed = !todos[index].completed
      store.set('todos', todos)
      winMain?.webContents.send('todos-updated')
      winBall?.webContents.send('todos-updated')
    }
  })

  ipcMain.handle('delete-todo', (event, id: string) => {
    log('IPC: delete-todo called: ' + id);
    let todos = store.get('todos')
    todos = todos.filter(t => t.id !== id)
    store.set('todos', todos)
    winMain?.webContents.send('todos-updated')
    winBall?.webContents.send('todos-updated')
  })

  ipcMain.handle('get-config', () => {
    log('IPC: get-config called');
    return store.get('config')
  })

  ipcMain.handle('update-config', (event, config: AppConfig) => {
    log('IPC: update-config called');
    
    // Get old config to compare startOnBoot
    const oldConfig = store.get('config');
    
    store.set('config', config)
    
    // Apply Window Size immediately
    if (winMain && config.windowWidth && config.windowHeight) {
      winMain.setSize(config.windowWidth, config.windowHeight);
    }

    // Apply Opacity immediately
    if (winBall && config.floatingOpacity) {
        // BrowserWindow doesn't have simple setOpacity for CSS, but we can send event
        // Actually Ball.tsx polls config, so it should update automatically.
        // Or we can broadcast config-updated
        winBall.webContents.send('config-updated'); 
    }

    // Broadcast config update to Main window as well (for refresh interval)
    if (winMain) {
        winMain.webContents.send('config-updated');
    }

    // Handle Auto Start
    // Only update if changed to avoid system lag
    if (oldConfig?.startOnBoot !== config.startOnBoot) {
      log(`Updating login settings: startOnBoot changed from ${oldConfig?.startOnBoot} to ${config.startOnBoot}`);
      app.setLoginItemSettings({
        openAtLogin: config.startOnBoot,
        path: app.getPath('exe')
      })
    }
  })

  ipcMain.handle('open-main', () => {
    log('IPC: open-main called');
    createMainWindow()
  })

  ipcMain.handle('full-quit', () => {
    log('IPC: full-quit called');
    isQuitting = true
    app.quit()
  })

  ipcMain.handle('select-file', async () => {
    // If winMain doesn't exist, create it or use winBall if necessary, but dialog usually needs a window
    // or pass null
    const result = await dialog.showOpenDialog(winMain || winBall || undefined as any, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'ico'] }]
    })
    return result.canceled ? '' : result.filePaths[0]
  })

  ipcMain.handle('get-image-base64', (event, filepath) => {
    try {
      if (!filepath) return ''
      return fs.readFileSync(filepath, { encoding: 'base64' })
    } catch (e) {
      return ''
    }
  })

})

app.on('window-all-closed', () => {
  winMain = null
  winBall = null
  if (process.platform !== 'darwin') {
    // We don't quit here because of tray
  }
})

app.on('second-instance', () => {
  if (winMain) {
    if (winMain.isMinimized()) winMain.restore()
    winMain.focus()
  } else {
    createMainWindow()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length === 0) {
    createMainWindow()
  }
})
