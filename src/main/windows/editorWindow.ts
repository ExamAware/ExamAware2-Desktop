import { BrowserWindow, shell } from 'electron'
import * as path from 'path'
import { is } from '@electron-toolkit/utils'

export function createEditorWindow(): BrowserWindow {
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

  return editorWindow
}
