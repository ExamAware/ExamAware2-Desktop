import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    electronAPI: {
      minimize: () => void
      close: () => void
      maximize: () => void
      isMaximized: () => Promise<boolean>
      setupListeners: () => void
      platform: string
      onOpenFileAtStartup: (callback: (filePath: string) => void) => void
    }
    api: {
      fileApi: unknown
      readFile: (filePath: string) => Promise<string | null>
      saveFile: (filePath: string, content: string) => Promise<boolean>
      saveFileDialog: () => Promise<string | null>
      openFileDialog: () => Promise<string | null>
      ipc: {
        invoke: (channel: string, ...args: any[]) => Promise<any>
        on: (channel: string, listener: (...args: any[]) => void) => void
        off: (channel: string, listener: (...args: any[]) => void) => void
        removeAllListeners: (channel: string) => void
      }
      plugins: {
        getInstalledPlugins: () => Promise<any[]>
        getActivePlugins: () => Promise<any[]>
        activatePlugin: (pluginId: string) => Promise<boolean>
        deactivatePlugin: (pluginId: string) => Promise<boolean>
        installPlugin: (pluginPath: string) => Promise<boolean>
        uninstallPlugin: (pluginId: string) => Promise<boolean>
        getPluginConfig: (pluginId: string) => Promise<any>
        updatePluginConfig: (pluginId: string, config: any) => Promise<boolean>
        createPluginTemplate: (templatePath: string, pluginName: string) => Promise<boolean>
        validatePlugin: (pluginPath: string) => Promise<{ valid: boolean; errors: string[] }>
        packagePlugin: (pluginPath: string, outputPath: string) => Promise<boolean>
        sendToPlugin: (pluginId: string, message: any) => Promise<any>
        onPluginMessage: (callback: (pluginId: string, message: any) => void) => void
        removePluginMessageListener: () => void
      }
    }
  }
}
