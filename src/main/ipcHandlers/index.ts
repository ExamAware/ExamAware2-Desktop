import { ipcMain, dialog } from 'electron'
import { createEditorWindow } from '../windows/editorWindow'
import { createPlayerWindow } from '../windows/playerWindow'

export function registerIpcHandlers(): void {
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
}
