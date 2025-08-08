/**
 * 插件系统类型定义
 */

import { BrowserWindow, ipcMain } from 'electron'

// 插件元数据接口
export interface PluginMetadata {
  name: string
  version: string
  description: string
  author: string
  main?: string // 主进程入口文件
  renderer?: string // 渲染进程入口文件
  dependencies?: string[]
  permissions?: PluginPermission[]
  engines?: {
    examaware?: string
    electron?: string
    node?: string
  }
}

// 插件权限枚举
export enum PluginPermission {
  FILE_SYSTEM = 'filesystem',
  NETWORK = 'network',
  WINDOW_MANAGEMENT = 'window-management',
  IPC = 'ipc',
  MENU = 'menu',
  NOTIFICATION = 'notification',
  CLIPBOARD = 'clipboard',
  SHELL = 'shell'
}

// 主进程插件接口
export interface MainPlugin {
  metadata: PluginMetadata
  activate(context: MainPluginContext): Promise<void> | void
  deactivate?(): Promise<void> | void
}

// 渲染进程插件接口
export interface RendererPlugin {
  metadata: PluginMetadata
  activate(context: RendererPluginContext): Promise<void> | void
  deactivate?(): Promise<void> | void
}

// 主进程插件上下文
export interface MainPluginContext {
  // 窗口管理
  windows: {
    getAll(): BrowserWindow[]
    getMain(): BrowserWindow | null
    create(options: any): BrowserWindow
  }
  
  // IPC 通信
  ipc: {
    handle(channel: string, handler: (...args: any[]) => any): void
    on(channel: string, handler: (...args: any[]) => void): void
    send(window: BrowserWindow, channel: string, ...args: any[]): void
    removeHandler(channel: string): void
    removeAllListeners(channel: string): void
  }
  
  // 文件系统
  fs: {
    readFile(path: string): Promise<string>
    writeFile(path: string, content: string): Promise<void>
    exists(path: string): Promise<boolean>
  }
  
  // 菜单管理
  menu: {
    addMenuItem(item: any): void
    removeMenuItem(id: string): void
  }
  
  // 事件系统
  events: {
    emit(event: string, ...args: any[]): void
    on(event: string, handler: (...args: any[]) => void): void
    off(event: string, handler: (...args: any[]) => void): void
    removeAllListeners(event?: string): void
  }
  
  // 插件间通信
  plugins: {
    get(name: string): MainPlugin | null
    getAll(): MainPlugin[]
    isActive(name: string): boolean
  }
}

// 渲染进程插件上下文
export interface RendererPluginContext {
  // Vue 应用实例
  app: any
  
  // 路由
  router: {
    addRoute(route: any): void
    removeRoute(name: string): void
    push(location: any): void
  }
  
  // 组件注册
  components: {
    register(name: string, component: any): void
    unregister(name: string): void
  }
  
  // 状态管理
  store: {
    registerModule(name: string, module: any): void
    unregisterModule(name: string): void
  }
  
  // IPC 通信
  ipc: {
    invoke(channel: string, ...args: any[]): Promise<any>
    send(channel: string, ...args: any[]): void
    on(channel: string, handler: (...args: any[]) => void): void
    off(channel: string, handler: (...args: any[]) => void): void
  }
  
  // UI 扩展
  ui: {
    addToolbarButton(button: any): void
    removeToolbarButton(id: string): void
    addSidebarPanel(panel: any): void
    removeSidebarPanel(id: string): void
    showNotification(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void
  }
  
  // 事件系统
  events: {
    emit(event: string, ...args: any[]): void
    on(event: string, handler: (...args: any[]) => void): void
    off(event: string, handler: (...args: any[]) => void): void
  }
  
  // 插件间通信
  plugins: {
    get(name: string): RendererPlugin | null
    getAll(): RendererPlugin[]
    isActive(name: string): boolean
  }
}

// 插件配置
export interface PluginConfig {
  enabled: boolean
  settings?: Record<string, any>
}

// 插件状态
export enum PluginStatus {
  INACTIVE = 'inactive',
  ACTIVATING = 'activating',
  ACTIVE = 'active',
  DEACTIVATING = 'deactivating',
  ERROR = 'error'
}

// 插件信息
export interface PluginInfo {
  metadata: PluginMetadata
  status: PluginStatus
  config: PluginConfig
  error?: string
  path: string
}