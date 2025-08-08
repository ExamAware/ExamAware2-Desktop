import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { fileApi } from '../main/fileUtils'

// Custom APIs for renderer
const api = {
  fileApi,
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  saveFile: (filePath: string, content: string) => ipcRenderer.invoke('save-file', filePath, content),
  saveFileDialog: () => ipcRenderer.invoke('save-file-dialog'),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  ipc: {
    send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, listener: (...args: any[]) => void) => ipcRenderer.on(channel, listener),
    off: (channel: string, listener: (...args: any[]) => void) => ipcRenderer.off(channel, listener),
    removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
  },
  plugins: {
    getInstalledPlugins: () => ipcRenderer.invoke('plugin:get-installed'),
    getActivePlugins: () => ipcRenderer.invoke('plugin:get-active'),
    activatePlugin: (pluginId: string) => ipcRenderer.invoke('plugin:activate', pluginId),
    deactivatePlugin: (pluginId: string) => ipcRenderer.invoke('plugin:deactivate', pluginId),
    installPlugin: (pluginPath: string) => ipcRenderer.invoke('plugin:install', pluginPath),
    uninstallPlugin: (pluginId: string) => ipcRenderer.invoke('plugin:uninstall', pluginId),
    getPluginConfig: (pluginId: string) => ipcRenderer.invoke('plugin:get-config', pluginId),
    updatePluginConfig: (pluginId: string, config: any) => ipcRenderer.invoke('plugin:update-config', pluginId, config),
    createPluginTemplate: (templatePath: string, pluginName: string) => ipcRenderer.invoke('plugin:create-template', templatePath, pluginName),
    validatePlugin: (pluginPath: string) => ipcRenderer.invoke('plugin:validate', pluginPath),
    packagePlugin: (pluginPath: string, outputPath: string) => ipcRenderer.invoke('plugin:package', pluginPath, outputPath),
    sendToPlugin: (pluginId: string, message: any) => ipcRenderer.invoke('plugin:send-message', pluginId, message),
    onPluginMessage: (callback: (pluginId: string, message: any) => void) => {
      ipcRenderer.on('plugin:message', (_, pluginId, message) => callback(pluginId, message))
    },
    removePluginMessageListener: () => {
      ipcRenderer.removeAllListeners('plugin:message')
    },
    // 插件开发相关API
    getDevPlugins: () => ipcRenderer.invoke('plugin-dev:get-plugins'),
    getDevServerStatus: () => ipcRenderer.invoke('plugin-dev:get-status'),
    loadDevPlugin: (pluginPath: string) => ipcRenderer.invoke('plugin-dev:load-plugin', pluginPath),
    unloadDevPlugin: (pluginName: string) => ipcRenderer.invoke('plugin-dev:unload-plugin', pluginName),
    reloadDevPlugin: (pluginName: string) => ipcRenderer.invoke('plugin-dev:reload-plugin', pluginName),
    touchPlugin: (pluginName: string) => ipcRenderer.invoke('plugin-dev:touch-plugin', pluginName)
  }
}

// 窗口控制 API
const windowAPI = {
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  maximize: () => ipcRenderer.send('window-maximize'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  setupListeners: () => ipcRenderer.send('setup-window-listeners'),
  platform: process.platform, // 在 preload 中可以安全访问 process
  onOpenFileAtStartup: (callback: (filePath: string) => void) => {
    ipcRenderer.on('open-file-at-startup', (_event, filePath) => callback(filePath))
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('electronAPI', windowAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.electronAPI = windowAPI
  // @ts-ignore (define in dts)
  window.api = api
}
