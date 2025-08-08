/**
 * 主进程插件管理器
 */

import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { EventEmitter } from 'events'
import {
  MainPlugin,
  PluginMetadata,
  PluginInfo,
  PluginStatus,
  PluginConfig,
  MainPluginContext,
  PluginPermission
} from './types'
import { fileApi } from '../fileUtils'

export class PluginManager extends EventEmitter {
  private plugins: Map<string, PluginInfo> = new Map()
  private activePlugins: Map<string, MainPlugin> = new Map()
  private pluginsDir: string
  private configPath: string
  private globalConfig: Record<string, PluginConfig> = {}

  constructor() {
    super()
    this.pluginsDir = path.join(app.getPath('userData'), 'plugins')
    this.configPath = path.join(app.getPath('userData'), 'plugin-config.json')
  }

  /**
   * 初始化插件管理器
   */
  async initialize(): Promise<void> {
    try {
      // 确保插件目录存在
      await this.ensurePluginsDirectory()

      // 加载插件配置
      await this.loadConfig()

      // 扫描并加载插件
      await this.scanPlugins()

      // 注册IPC处理器
      this.registerIpcHandlers()

      console.log('Plugin manager initialized successfully')
    } catch (error) {
      console.error('Failed to initialize plugin manager:', error)
    }
  }

  /**
   * 确保插件目录存在
   */
  private async ensurePluginsDirectory(): Promise<void> {
    try {
      await fs.access(this.pluginsDir)
    } catch {
      await fs.mkdir(this.pluginsDir, { recursive: true })
    }
  }

  /**
   * 加载插件配置
   */
  private async loadConfig(): Promise<void> {
    try {
      const configContent = await fileApi.readFile(this.configPath)
      this.globalConfig = JSON.parse(configContent)
    } catch {
      // 配置文件不存在或损坏，使用默认配置
      this.globalConfig = {}
    }
  }

  /**
   * 保存插件配置
   */
  private async saveConfig(): Promise<void> {
    try {
      await fileApi.writeFile(this.configPath, JSON.stringify(this.globalConfig, null, 2))
    } catch (error) {
      console.error('Failed to save plugin config:', error)
    }
  }

  /**
   * 扫描插件目录
   */
  private async scanPlugins(): Promise<void> {
    try {
      const entries = await fs.readdir(this.pluginsDir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory()) {
          await this.loadPlugin(entry.name)
        }
      }
    } catch (error) {
      console.error('Failed to scan plugins:', error)
    }
  }

  /**
   * 加载单个插件
   */
  private async loadPlugin(pluginName: string): Promise<void> {
    const pluginPath = path.join(this.pluginsDir, pluginName)
    const manifestPath = path.join(pluginPath, 'plugin.json')

    try {
      // 读取插件清单
      const manifestContent = await fileApi.readFile(manifestPath)
      const metadata: PluginMetadata = JSON.parse(manifestContent)

      // 验证插件清单
      if (!this.validateMetadata(metadata)) {
        throw new Error('Invalid plugin metadata')
      }

      // 获取插件配置
      const config = this.globalConfig[metadata.name] || {
        enabled: false,
        settings: {}
      }

      // 创建插件信息
      const pluginInfo: PluginInfo = {
        metadata,
        status: PluginStatus.INACTIVE,
        config,
        path: pluginPath
      }

      this.plugins.set(metadata.name, pluginInfo)

      // 如果插件已启用，则激活它
      if (config.enabled) {
        await this.activatePlugin(metadata.name)
      }

      console.log(`Plugin loaded: ${metadata.name}`)
    } catch (error) {
      console.error(`Failed to load plugin ${pluginName}:`, error)
    }
  }

  /**
   * 验证插件元数据
   */
  private validateMetadata(metadata: PluginMetadata): boolean {
    return !!(metadata.name && metadata.version && metadata.description)
  }

  /**
   * 激活插件
   */
  async activatePlugin(pluginName: string): Promise<boolean> {
    const pluginInfo = this.plugins.get(pluginName)
    if (!pluginInfo) {
      console.error(`Plugin not found: ${pluginName}`)
      return false
    }

    if (pluginInfo.status === PluginStatus.ACTIVE) {
      return true
    }

    try {
      pluginInfo.status = PluginStatus.ACTIVATING

      // 检查依赖
      if (!await this.checkDependencies(pluginInfo.metadata)) {
        throw new Error('Dependencies not satisfied')
      }

      // 加载主进程代码
      let plugin: MainPlugin | null = null
      if (pluginInfo.metadata.main) {
        const mainPath = path.join(pluginInfo.path, pluginInfo.metadata.main)
        const pluginModule = require(mainPath)
        plugin = pluginModule.default || pluginModule
      }

      if (plugin) {
        // 创建插件上下文
        const context = this.createPluginContext(pluginName)

        // 激活插件
        await plugin.activate(context)

        this.activePlugins.set(pluginName, plugin)
      }

      pluginInfo.status = PluginStatus.ACTIVE
      pluginInfo.config.enabled = true

      // 保存配置
      this.globalConfig[pluginName] = pluginInfo.config
      await this.saveConfig()

      this.emit('plugin-activated', pluginName)
      console.log(`Plugin activated: ${pluginName}`)

      return true
    } catch (error) {
      pluginInfo.status = PluginStatus.ERROR
      pluginInfo.error = (error as Error).message
      console.error(`Failed to activate plugin ${pluginName}:`, error)
      return false
    }
  }

  /**
   * 停用插件
   */
  async deactivatePlugin(pluginName: string): Promise<boolean> {
    const pluginInfo = this.plugins.get(pluginName)
    const plugin = this.activePlugins.get(pluginName)

    if (!pluginInfo || !plugin) {
      return false
    }

    try {
      pluginInfo.status = PluginStatus.DEACTIVATING

      // 停用插件
      if (plugin.deactivate) {
        await plugin.deactivate()
      }

      this.activePlugins.delete(pluginName)
      pluginInfo.status = PluginStatus.INACTIVE
      pluginInfo.config.enabled = false

      // 清理插件菜单项
      const mainWindow = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('index.html'))
      if (mainWindow) {
        mainWindow.webContents.send('plugin:remove-all-editor-menu-items', {
          pluginName
        })
      }

      // 保存配置
      this.globalConfig[pluginName] = pluginInfo.config
      await this.saveConfig()

      this.emit('plugin-deactivated', pluginName)
      console.log(`Plugin deactivated: ${pluginName}`)

      return true
    } catch (error) {
      pluginInfo.status = PluginStatus.ERROR
      pluginInfo.error = (error as Error).message
      console.error(`Failed to deactivate plugin ${pluginName}:`, error)
      return false
    }
  }

  /**
   * 检查插件依赖
   */
  private async checkDependencies(metadata: PluginMetadata): Promise<boolean> {
    if (!metadata.dependencies) {
      return true
    }

    for (const dep of metadata.dependencies) {
      const depPlugin = this.plugins.get(dep)
      if (!depPlugin || depPlugin.status !== PluginStatus.ACTIVE) {
        console.error(`Dependency not satisfied: ${dep}`)
        return false
      }
    }

    return true
  }

  /**
   * 创建插件上下文
   */
  private createPluginContext(pluginName: string): MainPluginContext {
    return {
      windows: {
        getAll: () => BrowserWindow.getAllWindows(),
        getMain: () => BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('index.html')) || null,
        create: (options) => new BrowserWindow(options)
      },

      ipc: {
        handle: (channel, handler) => {
          ipcMain.handle(`plugin:${pluginName}:${channel}`, handler)
        },
        on: (channel, handler) => {
          ipcMain.on(`plugin:${pluginName}:${channel}`, handler)
        },
        send: (window, channel, ...args) => {
          window.webContents.send(`plugin:${pluginName}:${channel}`, ...args)
        },
        removeHandler: (channel) => {
          ipcMain.removeHandler(`plugin:${pluginName}:${channel}`)
        },
        removeAllListeners: (channel) => {
          ipcMain.removeAllListeners(`plugin:${pluginName}:${channel}`)
        }
      },

      fs: {
        readFile: fileApi.readFile,
        writeFile: fileApi.writeFile,
        exists: async (path) => {
          try {
            await fs.access(path)
            return true
          } catch {
            return false
          }
        }
      },

      menu: {
        addMenuItem: (item) => {
          // 通过IPC通知渲染进程添加菜单项到Editor菜单
          const mainWindow = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('index.html'))
          if (mainWindow) {
            mainWindow.webContents.send('plugin:add-editor-menu-item', {
              pluginName,
              menuItem: item
            })
          }
        },
        removeMenuItem: (id) => {
          // 通过IPC通知渲染进程移除菜单项
          const mainWindow = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('index.html'))
          if (mainWindow) {
            mainWindow.webContents.send('plugin:remove-editor-menu-item', {
              pluginName,
              menuItemId: id
            })
          }
        }
      },

      events: {
        emit: (event, ...args) => this.emit(`plugin:${pluginName}:${event}`, ...args),
        on: (event, handler) => this.on(`plugin:${pluginName}:${event}`, handler),
        off: (event, handler) => this.off(`plugin:${pluginName}:${event}`, handler),
        removeAllListeners: (event?: string) => {
          if (event) {
            this.removeAllListeners(`plugin:${pluginName}:${event}`)
          } else {
            // 移除所有以插件名为前缀的事件监听器
            const events = this.eventNames()
            const pluginPrefix = `plugin:${pluginName}:`
            events.forEach(eventName => {
              if (typeof eventName === 'string' && eventName.startsWith(pluginPrefix)) {
                this.removeAllListeners(eventName)
              }
            })
          }
        }
      },

      plugins: {
        get: (name) => this.activePlugins.get(name) || null,
        getAll: () => Array.from(this.activePlugins.values()),
        isActive: (name) => this.activePlugins.has(name)
      }
    }
  }

  /**
   * 注册IPC处理器
   */
  private registerIpcHandlers(): void {
    // 获取所有插件信息
    ipcMain.handle('plugins:get-all', () => {
      return Array.from(this.plugins.values())
    })

    // 激活插件
    ipcMain.handle('plugins:activate', async (_, pluginName: string) => {
      return await this.activatePlugin(pluginName)
    })

    // 停用插件
    ipcMain.handle('plugins:deactivate', async (_, pluginName: string) => {
      return await this.deactivatePlugin(pluginName)
    })

    // 安装插件
    ipcMain.handle('plugins:install', async () => {
      return await this.installPlugin()
    })

    // 卸载插件
    ipcMain.handle('plugins:uninstall', async (_, pluginName: string) => {
      return await this.uninstallPlugin(pluginName)
    })

    // 更新插件配置
    ipcMain.handle('plugins:update-config', async (_, pluginName: string, config: PluginConfig) => {
      return await this.updatePluginConfig(pluginName, config)
    })
  }

  /**
   * 安装插件
   */
  private async installPlugin(): Promise<boolean> {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Plugin Archive', extensions: ['zip', 'tar.gz'] },
          { name: 'Plugin Directory', extensions: [] }
        ]
      })

      if (result.canceled || !result.filePaths[0]) {
        return false
      }

      // TODO: 实现插件安装逻辑
      console.log('Installing plugin from:', result.filePaths[0])

      return true
    } catch (error) {
      console.error('Failed to install plugin:', error)
      return false
    }
  }

  /**
   * 卸载插件
   */
  private async uninstallPlugin(pluginName: string): Promise<boolean> {
    try {
      // 先停用插件
      await this.deactivatePlugin(pluginName)

      // 删除插件文件
      const pluginInfo = this.plugins.get(pluginName)
      if (pluginInfo) {
        await fs.rm(pluginInfo.path, { recursive: true, force: true })
        this.plugins.delete(pluginName)
        delete this.globalConfig[pluginName]
        await this.saveConfig()
      }

      console.log(`Plugin uninstalled: ${pluginName}`)
      return true
    } catch (error) {
      console.error(`Failed to uninstall plugin ${pluginName}:`, error)
      return false
    }
  }

  /**
   * 更新插件配置
   */
  private async updatePluginConfig(pluginName: string, config: PluginConfig): Promise<boolean> {
    try {
      const pluginInfo = this.plugins.get(pluginName)
      if (!pluginInfo) {
        return false
      }

      pluginInfo.config = { ...pluginInfo.config, ...config }
      this.globalConfig[pluginName] = pluginInfo.config
      await this.saveConfig()

      return true
    } catch (error) {
      console.error(`Failed to update plugin config ${pluginName}:`, error)
      return false
    }
  }

  /**
   * 重新扫描单个插件
   */
  async rescanPlugin(pluginName: string): Promise<void> {
    await this.loadPlugin(pluginName)
  }

  /**
   * 获取插件信息
   */
  getPlugin(name: string): PluginInfo | null {
    return this.plugins.get(name) || null
  }

  /**
   * 获取所有插件
   */
  getAllPlugins(): PluginInfo[] {
    return Array.from(this.plugins.values())
  }

  /**
   * 获取活跃插件
   */
  getActivePlugins(): MainPlugin[] {
    return Array.from(this.activePlugins.values())
  }
}

// 导出单例实例
export const pluginManager = new PluginManager()
