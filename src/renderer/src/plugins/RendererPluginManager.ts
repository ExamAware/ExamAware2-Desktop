/**
 * 渲染进程插件管理器
 */

import { EventEmitter } from './EventEmitter'
import type { App } from 'vue'
import type { NavigationFailure, NavigationGuardWithThis, NavigationHookAfter, RouteLocationAsRelativeTyped, RouteLocationNormalizedLoaded, RouteLocationRaw, RouteLocationResolved, RouteMap, Router, RouteRecord, RouteRecordNameGeneric } from 'vue-router'
import type {
  PluginInfo,
  RendererPlugin,
  RendererPluginContext,
  ToolbarButton,
  SidebarPanel,
  NotificationOptions,
  PluginEventType,
  PluginConfig
} from './types'
import { PluginStatus } from './types'

export class RendererPluginManager extends EventEmitter {
  private plugins: Map<string, PluginInfo> = new Map()
  private activePlugins: Map<string, RendererPlugin> = new Map()
  private app: App | null = null
  private router: Router | null = null
  private store: any = null
  private uiExtensions: Map<string, any> = new Map()

  constructor() {
    super()
  }

  /**
   * 初始化插件管理器
   */
  async initialize(app: App, router: Router, store?: any): Promise<void> {
    this.app = app
    this.router = router
    this.store = store

    try {
      // 从主进程获取插件信息
      await this.loadPluginsFromMain()
      
      // 监听主进程插件事件
      this.setupMainProcessListeners()
      
      console.log('Renderer plugin manager initialized successfully')
    } catch (error) {
      console.error('Failed to initialize renderer plugin manager:', error)
    }
  }

  /**
   * 从主进程加载插件信息
   */
  private async loadPluginsFromMain(): Promise<void> {
    try {
      if (!window.api?.ipc) {
        console.warn('IPC not available, skipping plugin loading')
        return
      }
      
      const pluginInfos: PluginInfo[] = await window.api.ipc.invoke('plugins:get-all') || []
      
      for (const pluginInfo of pluginInfos) {
        this.plugins.set(pluginInfo.metadata.name, pluginInfo)
        
        // 如果插件已激活且有渲染进程代码，则加载它
        if (pluginInfo.status === PluginStatus.ACTIVE && pluginInfo.metadata.renderer) {
          await this.loadRendererPlugin(pluginInfo)
        }
      }
    } catch (error) {
      console.error('Failed to load plugins from main process:', error)
    }
  }

  /**
   * 加载渲染进程插件
   */
  private async loadRendererPlugin(pluginInfo: PluginInfo): Promise<void> {
    try {
      if (!pluginInfo.metadata.renderer) {
        return
      }

      // 动态导入插件模块
      const pluginUrl = `plugin://${pluginInfo.metadata.name}/${pluginInfo.metadata.renderer}`
      const pluginModule = await import(/* @vite-ignore */ pluginUrl)
      const plugin: RendererPlugin = pluginModule.default || pluginModule

      if (plugin && typeof plugin.activate === 'function') {
        // 创建插件上下文
        const context = this.createPluginContext(pluginInfo.metadata.name)
        
        // 激活插件
        await plugin.activate(context)
        
        this.activePlugins.set(pluginInfo.metadata.name, plugin)
        
        console.log(`Renderer plugin loaded: ${pluginInfo.metadata.name}`)
      }
    } catch (error) {
      console.error(`Failed to load renderer plugin ${pluginInfo.metadata.name}:`, error)
    }
  }

  /**
   * 卸载渲染进程插件
   */
  private async unloadRendererPlugin(pluginName: string): Promise<void> {
    try {
      const plugin = this.activePlugins.get(pluginName)
      if (plugin && plugin.deactivate) {
        await plugin.deactivate()
      }
      
      this.activePlugins.delete(pluginName)
      
      // 清理UI扩展
      this.cleanupUIExtensions(pluginName)
      
      console.log(`Renderer plugin unloaded: ${pluginName}`)
    } catch (error) {
      console.error(`Failed to unload renderer plugin ${pluginName}:`, error)
    }
  }

  /**
   * 创建插件上下文
   */
  private createPluginContext(pluginName: string): RendererPluginContext {
    return {
      app: this.app!,
      router: this.router!,
      store: this.store || {},
      api: (window as any).api,
      pluginId: pluginName,
      config: {},
      
      registerComponent: (name: string, component: any) => {
        if (this.app) {
          this.app.component(name, component)
          this.trackUIExtension(pluginName, 'component', name)
        }
      },
      
      addRoute: (route: any) => {
        if (this.router) {
          this.router.addRoute(route)
          this.trackUIExtension(pluginName, 'route', route.name)
        }
      },
      
      addToolbarButton: (button: ToolbarButton) => {
        this.addToolbarButton(pluginName, button)
      },
      
      addSidebarPanel: (panel: SidebarPanel) => {
        this.addSidebarPanel(pluginName, panel)
      },
      
      showNotification: (notification: NotificationOptions) => {
        this.showNotification(notification.message, notification.type || 'info')
      },
      
      addEventListener: (event: string, handler: (...args: any[]) => void) => {
        this.on(`plugin:${pluginName}:${event}`, handler)
      },
      
      removeEventListener: (event: string, handler: (...args: any[]) => void) => {
        this.off(`plugin:${pluginName}:${event}`, handler)
      }
    }
  }

  /**
   * 跟踪UI扩展
   */
  private trackUIExtension(pluginName: string, type: string, id: string): void {
    const key = `${pluginName}:${type}`
    if (!this.uiExtensions.has(key)) {
      this.uiExtensions.set(key, [])
    }
    this.uiExtensions.get(key)!.push(id)
  }

  /**
   * 清理UI扩展
   */
  private cleanupUIExtensions(pluginName: string): void {
    for (const [key, ids] of this.uiExtensions.entries()) {
      if (key.startsWith(`${pluginName}:`)) {
        const [, type] = key.split(':')
        
        switch (type) {
          case 'route':
            ids.forEach(id => this.router?.removeRoute(id))
            break
          case 'store-module':
            ids.forEach(id => this.store?.unregisterModule?.(id))
            break
          case 'toolbar-button':
            ids.forEach(id => this.removeToolbarButtonById(id))
            break
          case 'sidebar-panel':
            ids.forEach(id => this.removeSidebarPanelById(id))
            break
        }
        
        this.uiExtensions.delete(key)
      }
    }
  }

  /**
   * 添加工具栏按钮
   */
  private addToolbarButton(pluginName: string, button: any): void {
    // 发送事件给主界面组件
    this.emit('ui:add-toolbar-button', { pluginName, button })
    this.trackUIExtension(pluginName, 'toolbar-button', button.id)
  }

  /**
   * 移除工具栏按钮
   */
  private removeToolbarButton(pluginName: string, id: string): void {
    this.emit('ui:remove-toolbar-button', { pluginName, id })
  }

  /**
   * 根据ID移除工具栏按钮
   */
  private removeToolbarButtonById(id: string): void {
    this.emit('ui:remove-toolbar-button-by-id', id)
  }

  /**
   * 添加侧边栏面板
   */
  private addSidebarPanel(pluginName: string, panel: any): void {
    this.emit('ui:add-sidebar-panel', { pluginName, panel })
    this.trackUIExtension(pluginName, 'sidebar-panel', panel.id)
  }

  /**
   * 移除侧边栏面板
   */
  private removeSidebarPanel(pluginName: string, id: string): void {
    this.emit('ui:remove-sidebar-panel', { pluginName, id })
  }

  /**
   * 根据ID移除侧边栏面板
   */
  private removeSidebarPanelById(id: string): void {
    this.emit('ui:remove-sidebar-panel-by-id', id)
  }

  /**
   * 显示通知
   */
  private showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error'): void {
    this.emit('ui:show-notification', { message, type })
  }

  /**
   * 设置主进程监听器
   */
  private setupMainProcessListeners(): void {
    if (!window.api?.ipc) {
      console.warn('IPC not available, skipping main process listeners setup')
      return
    }
    
    // 监听插件激活事件
    window.api.ipc.on('plugin-activated', async (pluginName: string) => {
      const pluginInfo = this.plugins.get(pluginName)
      if (pluginInfo && pluginInfo.metadata.renderer) {
        await this.loadRendererPlugin(pluginInfo)
      }
    })

    // 监听插件停用事件
    window.api.ipc.on('plugin-deactivated', async (pluginName: string) => {
      await this.unloadRendererPlugin(pluginName)
    })
  }

  /**
   * 激活插件
   */
  async activatePlugin(pluginName: string): Promise<boolean> {
    try {
      if (!window.api?.ipc) {
        console.warn('IPC not available, cannot activate plugin')
        return false
      }
      
      const result = await window.api.ipc.invoke('plugins:activate', pluginName)
      return result || false
    } catch (error) {
      console.error(`Failed to activate plugin ${pluginName}:`, error)
      return false
    }
  }

  /**
   * 停用插件
   */
  async deactivatePlugin(pluginName: string): Promise<boolean> {
    try {
      if (!window.api?.ipc) {
        console.warn('IPC not available, cannot deactivate plugin')
        return false
      }
      
      const result = await window.api.ipc.invoke('plugins:deactivate', pluginName)
      return result || false
    } catch (error) {
      console.error(`Failed to deactivate plugin ${pluginName}:`, error)
      return false
    }
  }

  /**
   * 获取所有插件
   */
  async getAllPlugins(): Promise<PluginInfo[]> {
    try {
      if (!window.api?.ipc) {
        console.warn('IPC not available, cannot get plugins')
        return []
      }
      
      const plugins = await window.api.ipc.invoke('plugins:get-all')
      return plugins || []
    } catch (error) {
      console.error('Failed to get all plugins:', error)
      return []
    }
  }

  /**
   * 安装插件
   */
  async installPlugin(): Promise<boolean> {
    try {
      if (!window.api?.ipc) {
        console.warn('IPC not available, cannot install plugin')
        return false
      }
      
      const result = await window.api.ipc.invoke('plugins:install')
      return result || false
    } catch (error) {
      console.error('Failed to install plugin:', error)
      return false
    }
  }

  /**
   * 卸载插件
   */
  async uninstallPlugin(pluginName: string): Promise<boolean> {
    try {
      if (!window.api?.ipc) {
        console.warn('IPC not available, cannot uninstall plugin')
        return false
      }
      
      const result = await window.api.ipc.invoke('plugins:uninstall', pluginName)
      return result || false
    } catch (error) {
      console.error(`Failed to uninstall plugin ${pluginName}:`, error)
      return false
    }
  }

  /**
   * 更新插件配置
   */
  async updatePluginConfig(pluginName: string, config: PluginConfig): Promise<boolean> {
    try {
      if (!window.api?.ipc) {
        console.warn('IPC not available, cannot update plugin config')
        return false
      }
      
      const result = await window.api.ipc.invoke('plugins:update-config', pluginName, config)
      return result || false
    } catch (error) {
      console.error(`Failed to update plugin config ${pluginName}:`, error)
      return false
    }
  }

  /**
   * 获取插件信息
   */
  getPlugin(name: string): PluginInfo | null {
    return this.plugins.get(name) || null
  }

  /**
   * 获取活跃插件
   */
  getActivePlugins(): RendererPlugin[] {
    return Array.from(this.activePlugins.values())
  }
}

// 导出单例实例
export const rendererPluginManager = new RendererPluginManager()