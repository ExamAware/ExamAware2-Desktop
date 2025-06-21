import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createMainWindow } from './windows/mainWindow'
import { registerIpcHandlers } from './ipcHandlers'
import { registerTimeSyncHandlers } from './ipcHandlers/timeServiceHandler'

app.whenReady().then(() => {
  electronApp.setAppUserModelId('org.examaware')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  registerTimeSyncHandlers()

  createMainWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
