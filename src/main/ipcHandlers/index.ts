import { ipcMain, dialog, BrowserWindow } from 'electron'
import { createEditorWindow } from '../windows/editorWindow'
import { createPlayerWindow } from '../windows/playerWindow'

export function registerIpcHandlers(): void {
  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Handle open editor window request
  ipcMain.on('open-editor-window', () => {
    createEditorWindow()
  })

  ipcMain.on('open-player-window', (_event, configPath) => {
    createPlayerWindow(configPath)
  })

  // 窗口控制处理程序
  ipcMain.on('window-minimize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) {
      window.minimize()
    }
  })

  ipcMain.on('window-close', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) {
      window.close()
    }
  })

  ipcMain.on('window-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize()
      } else {
        window.maximize()
      }
    }
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
}
