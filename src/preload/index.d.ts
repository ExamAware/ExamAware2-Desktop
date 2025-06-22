import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    electronAPI: {
      minimize: () => void
      close: () => void
      maximize: () => void
    }
    api: unknown
  }
}
