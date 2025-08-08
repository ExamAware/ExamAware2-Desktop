import { app, BrowserWindow, protocol } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createMainWindow } from './windows/mainWindow'
import { createEditorWindow } from './windows/editorWindow'
import { registerIpcHandlers } from './ipcHandlers'
import { registerTimeSyncHandlers } from './ipcHandlers/timeServiceHandler'
import { registerPluginDevHandlers } from './ipcHandlers/pluginDevHandler'
import { initializeTimeSync } from './ntpService/timeService'
import { pluginManager } from './plugins/PluginManager'
import { pluginDevServer } from './plugins/PluginDevServer'
import * as path from 'path'
import * as fs from 'fs'

// 用于存储启动时的文件路径
let fileToOpen: string | null = null

// 注册自定义协议
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'plugin',
    privileges: {
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
])

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('org.examaware')

  // 注册plugin://协议处理器
  protocol.registerFileProtocol('plugin', (request, callback) => {
    const url = request.url.substr(9) // 移除 'plugin://' 前缀
    const [pluginName, ...pathParts] = url.split('/')
    const filePath = pathParts.join('/')
    
    // 构建插件文件的完整路径
    const pluginsDir = process.env.NODE_ENV === 'development' 
      ? pluginDevServer.getDevPluginsDir()
      : path.join(app.getPath('userData'), 'plugins')
    
    const fullPath = path.join(pluginsDir, pluginName, filePath)
    
    // 检查文件是否存在
    if (fs.existsSync(fullPath)) {
      callback({ path: fullPath })
    } else {
      callback({ error: -6 }) // FILE_NOT_FOUND
    }
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  registerTimeSyncHandlers()
  registerPluginDevHandlers()

  // 初始化时间同步服务
  initializeTimeSync()

  // 初始化插件管理器
  await pluginManager.initialize()

  // 在开发模式下启动插件开发服务器
  if (process.env.NODE_ENV === 'development') {
    try {
      await pluginDevServer.start()
      console.log('Plugin development server started')
    } catch (error) {
      console.error('Failed to start plugin development server:', error)
    }
  }

  // 如果有文件要打开，直接打开编辑器
  if (fileToOpen) {
    createEditorWindow(fileToOpen)
    fileToOpen = null
  } else {
    createMainWindow()
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

// 处理打开文件的请求（macOS）
app.on('open-file', (event, path) => {
  event.preventDefault()
  if (path.endsWith('.exam.json') || path.endsWith('.json')) {
    if (app.isReady()) {
      createEditorWindow(path)
    } else {
      fileToOpen = path
    }
  }
})

// 处理从命令行打开文件（Windows/Linux）
if (process.argv.length > 1) {
  const filePath = process.argv[process.argv.length - 1]
  if (filePath.endsWith('.exam.json') || filePath.endsWith('.json')) {
    fileToOpen = filePath
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
