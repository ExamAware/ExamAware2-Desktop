import { BrowserWindow, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { is } from '@electron-toolkit/utils'

export function createPlayerWindow(configPath: string): BrowserWindow {
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

  fs.readFile(configPath, 'utf-8', (err, data) => {
    if (err) {
      console.error('Failed to read config file:', err)
      return
    }
    setTimeout(() => {
      playerWindow.webContents.send('load-config', data)
      console.log('Config file loaded:', data)
    }, 1000)
  })

  return playerWindow
}
