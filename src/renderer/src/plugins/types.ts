// 渲染进程插件类型定义
import type { App } from 'vue'
import type { Router } from 'vue-router'
import type { Pinia } from 'pinia'

// 插件清单接口
export interface PluginManifest {
  name: string
  version: string
  description: string
  author: string
  main?: string
  renderer?: string
  permissions: string[]
  compatibility: {
    examaware: string
    electron: string
    node: string
  }
  config?: Record<string, any>
}

// 插件信息接口
export interface PluginInfo {
  metadata: PluginManifest
  status: PluginStatus
  config: Record<string, any>
  error?: string
  path: string
}

// 渲染进程插件接口
export interface RendererPlugin {
  activate(context: RendererPluginContext): Promise<void> | void
  deactivate(): Promise<void> | void
}

// 渲染进程插件上下文
export interface RendererPluginContext {
  app: App
  router: Router
  store: Pinia
  api: any // window.api
  pluginId: string
  config: Record<string, any>
  
  // 工具方法
  registerComponent(name: string, component: any): void
  addRoute(route: any): void
  addToolbarButton(button: ToolbarButton): void
  addSidebarPanel(panel: SidebarPanel): void
  showNotification(notification: NotificationOptions): void
  addEventListener(event: string, handler: Function): void
  removeEventListener(event: string, handler: Function): void
}

// UI 扩展接口
export interface ToolbarButton {
  id: string
  label: string
  icon?: string
  tooltip?: string
  action: () => void
  position?: 'left' | 'right'
}

export interface SidebarPanel {
  id: string
  title: string
  icon?: string
  component: any
  position?: number
}

export interface NotificationOptions {
  title: string
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  duration?: number
}

// 插件权限枚举
export enum PluginPermission {
  IPC = 'ipc',
  WINDOW_MANAGEMENT = 'window-management',
  FILE_SYSTEM = 'file-system',
  NOTIFICATION = 'notification',
  MENU = 'menu',
  ROUTER = 'router',
  COMPONENT = 'component',
  STORE = 'store',
  UI_EXTENSION = 'ui-extension'
}

// 插件状态枚举
export enum PluginStatus {
  INACTIVE = 'inactive',
  ACTIVE = 'active',
  ERROR = 'error',
  LOADING = 'loading'
}

// 插件事件类型
export type PluginEventType = 
  | 'plugin-activated'
  | 'plugin-deactivated'
  | 'plugin-installed'
  | 'plugin-uninstalled'
  | 'plugin-error'
  | 'plugin-message'
  | 'plugin-notification'
  | 'show-plugin-info'
  | 'open-plugin-settings'
  | 'app-ready'
  | 'theme-changed'
  | 'window-created'
  | 'window-closed'

// 插件验证结果
export interface PluginValidationResult {
  valid: boolean
  errors: string[]
  warnings?: string[]
}

// 插件开发工具接口
export interface PluginDevTools {
  createTemplate(templatePath: string, pluginName: string): Promise<boolean>
  validatePlugin(pluginPath: string): Promise<PluginValidationResult>
  packagePlugin(pluginPath: string, outputPath: string): Promise<boolean>
  generateDocs(pluginPath: string): Promise<string>
}

// 插件元数据接口
export interface PluginMetadata {
  name: string
  version: string
  description: string
  author: string
  homepage?: string
  repository?: string
  license?: string
  keywords?: string[]
}

// 插件配置接口
export interface PluginConfig {
  enabled: boolean
  settings: Record<string, any>
  [key: string]: any
}

// 插件元数据扩展接口
export interface PluginMetadataExtended extends PluginMetadata {
  id: string
  path: string
  status: PluginStatus
  config: PluginConfig
}