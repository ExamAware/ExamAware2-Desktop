import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
// const path = require('path')
// import { path.join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import * as fs from 'fs'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 720,
    height: 480,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: true
    }
    // titleBarStyle: 'hidden',
    // titleBarOverlay: {
    //   color: 'rgba(0,0,0,0)',
    //   height: 35,
    //   symbolColor: 'white'
    // }
  })

  mainWindow.setAspectRatio(720 / 480) // 固定宽高比
  mainWindow.setMinimumSize(720, 480) // 最小尺寸

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const route = 'mainpage'

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    // 🚧 Use ['ENV_NAME'] avoid vite:define plugin
    const url = process.env['ELECTRON_RENDERER_URL']

    mainWindow.loadURL(`${url}#/${route}`)
  } else {
    mainWindow.loadFile(path.resolve(__dirname, '../renderer/index.html'), { hash: route })
  }
}

function createEditorWindow(): void {
  const editorWindow = new BrowserWindow({
    width: 920,
    height: 700,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  editorWindow.on('ready-to-show', () => {
    editorWindow.show()
  })

  editorWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const route = 'editor'

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = process.env['ELECTRON_RENDERER_URL']
    editorWindow.loadURL(`${url}#/${route}`)
  } else {
    editorWindow.loadFile(path.resolve(__dirname, '../renderer/index.html'), { hash: route })
  }
}

function createPlayerWindow(configPath: string): void {
  const playerWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  playerWindow.on('ready-to-show', () => {
    playerWindow.show()
  })

  playerWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const route = 'playerview'

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = process.env['ELECTRON_RENDERER_URL']
    playerWindow.loadURL(`${url}#/${route}`)
  } else {
    playerWindow.loadFile(path.resolve(__dirname, '../renderer/index.html'), { hash: route })
  }

  // 读取配置文件并发送给渲染进程
  fs.readFile(configPath, 'utf-8', (err, data) => {
    if (err) {
      console.error('Failed to read config file:', err)
      return
    }
    // 延迟发送事件，确保渲染进程有足够时间挂载组件
    setTimeout(() => {
      playerWindow.webContents.send('load-config', data)
      console.log('Config file loaded:', data)
    }, 1000) // 延迟1秒
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('org.examaware')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Handle open editor window request
  ipcMain.on('open-editor-window', () => {
    createEditorWindow()
  })

  ipcMain.on('open-player-window', (event, configPath) => {
    createPlayerWindow(configPath)
  })

  ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    })
    if (result.canceled) {
      return null
    } else {
      return result.filePaths[0]
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
