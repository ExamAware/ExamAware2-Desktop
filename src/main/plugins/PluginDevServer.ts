/**
 * 插件开发服务器
 * 提供插件热重载和开发环境支持
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { watch } from 'chokidar'
import { app, BrowserWindow } from 'electron'
import { EventEmitter } from 'events'
import { pluginManager } from './PluginManager'
import { fileApi } from '../fileUtils'
import type { PluginMetadata } from './types'

export class PluginDevServer extends EventEmitter {
  private watcher: any = null
  private devPluginsDir: string
  private isWatching = false
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private readonly DEBOUNCE_DELAY = 500 // 500ms防抖延迟

  constructor() {
    super()
    // 使用项目根目录下的plugins文件夹作为开发目录
    this.devPluginsDir = path.join(process.cwd(), 'plugins')
  }

  /**
   * 启动开发服务器
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      console.log('Plugin dev server is already running')
      return
    }

    try {
      // 确保开发插件目录存在
      await this.ensureDevPluginsDirectory()
      
      // 初始加载所有开发插件
      await this.loadAllDevPlugins()
      
      // 启动文件监听
      await this.startWatching()
      
      this.isWatching = true
      console.log(`Plugin dev server started, watching: ${this.devPluginsDir}`)
      
      this.emit('started')
    } catch (error) {
      console.error('Failed to start plugin dev server:', error)
      throw error
    }
  }

  /**
   * 停止开发服务器
   */
  async stop(): Promise<void> {
    if (!this.isWatching) {
      return
    }

    try {
      // 停止文件监听
      if (this.watcher) {
        await this.watcher.close()
        this.watcher = null
      }

      // 清理防抖定时器
      this.debounceTimers.forEach(timer => clearTimeout(timer))
      this.debounceTimers.clear()

      this.isWatching = false
      console.log('Plugin dev server stopped')
      
      this.emit('stopped')
    } catch (error) {
      console.error('Error stopping plugin dev server:', error)
    }
  }

  /**
   * 确保开发插件目录存在
   */
  private async ensureDevPluginsDirectory(): Promise<void> {
    try {
      await fs.access(this.devPluginsDir)
    } catch {
      console.log(`Creating dev plugins directory: ${this.devPluginsDir}`)
      await fs.mkdir(this.devPluginsDir, { recursive: true })
    }
  }

  /**
   * 启动文件监听
   */
  private async startWatching(): Promise<void> {
    this.watcher = watch(this.devPluginsDir, {
      ignored: /(^|[\/\\])\../, // 忽略隐藏文件
      persistent: true,
      ignoreInitial: true,
      depth: 2 // 限制监听深度
    })

    this.watcher
      .on('add', (filePath: string) => this.handleFileChange('add', filePath))
      .on('change', (filePath: string) => this.handleFileChange('change', filePath))
      .on('unlink', (filePath: string) => this.handleFileChange('unlink', filePath))
      .on('addDir', (dirPath: string) => this.handleDirChange('addDir', dirPath))
      .on('unlinkDir', (dirPath: string) => this.handleDirChange('unlinkDir', dirPath))
      .on('error', (error: Error) => {
        console.error('Plugin dev server watcher error:', error)
        this.emit('error', error)
      })

    console.log('File watcher started for plugin development')
  }

  /**
   * 处理文件变化
   */
  private handleFileChange(event: string, filePath: string): void {
    const pluginName = this.getPluginNameFromPath(filePath)
    if (!pluginName) return

    console.log(`Plugin file ${event}: ${filePath}`)
    
    // 使用防抖处理，避免频繁重载
    this.debounceReload(pluginName, () => {
      this.reloadPlugin(pluginName, event, filePath)
    })
  }

  /**
   * 处理目录变化
   */
  private handleDirChange(event: string, dirPath: string): void {
    const pluginName = this.getPluginNameFromPath(dirPath)
    if (!pluginName) return

    console.log(`Plugin directory ${event}: ${dirPath}`)
    
    if (event === 'addDir') {
      // 新增插件目录，尝试加载
      this.debounceReload(pluginName, () => {
        this.loadDevPlugin(pluginName)
      })
    } else if (event === 'unlinkDir') {
      // 删除插件目录，卸载插件
      this.unloadPlugin(pluginName)
    }
  }

  /**
   * 防抖重载
   */
  private debounceReload(pluginName: string, callback: () => void): void {
    // 清除之前的定时器
    const existingTimer = this.debounceTimers.get(pluginName)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // 设置新的定时器
    const timer = setTimeout(() => {
      callback()
      this.debounceTimers.delete(pluginName)
    }, this.DEBOUNCE_DELAY)

    this.debounceTimers.set(pluginName, timer)
  }

  /**
   * 从文件路径获取插件名称
   */
  private getPluginNameFromPath(filePath: string): string | null {
    const relativePath = path.relative(this.devPluginsDir, filePath)
    const parts = relativePath.split(path.sep)
    return parts[0] || null
  }

  /**
   * 重载插件
   */
  private async reloadPlugin(pluginName: string, event: string, filePath: string): Promise<void> {
    try {
      console.log(`Reloading plugin: ${pluginName}`)
      
      // 先卸载现有插件
      await this.unloadPlugin(pluginName)
      
      // 等待一小段时间确保资源清理完成
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 重新加载插件
      await this.loadDevPlugin(pluginName)
      
      // 通知渲染进程插件已重载
      this.notifyRenderer('plugin-reloaded', { pluginName, event, filePath })
      
      console.log(`Plugin ${pluginName} reloaded successfully`)
    } catch (error) {
      console.error(`Failed to reload plugin ${pluginName}:`, error)
      this.notifyRenderer('plugin-reload-error', { pluginName, error: error instanceof Error ? error.message : String(error) })
    }
  }

  /**
   * 加载开发插件
   */
  private async loadDevPlugin(pluginName: string): Promise<void> {
    const pluginDir = path.join(this.devPluginsDir, pluginName)
    const manifestPath = path.join(pluginDir, 'plugin.json')

    try {
      // 检查插件清单文件是否存在
      await fs.access(manifestPath)
      
      // 读取插件清单
      const manifestContent = await fileApi.readFile(manifestPath)
      const manifest: PluginMetadata = JSON.parse(manifestContent)
      
      // 验证插件清单
      if (!this.validateManifest(manifest)) {
        throw new Error(`Invalid plugin manifest: ${pluginName}`)
      }
      
      // 检查插件是否已经存在，如果存在则先停用
      const existingPlugin = pluginManager.getPlugin(pluginName)
      if (existingPlugin && existingPlugin.status === 'active') {
        await pluginManager.deactivatePlugin(pluginName)
      }
      
      // 使用插件管理器加载插件
      // 注意：这里需要临时将开发插件复制到插件管理器的目录中
      await this.copyToPluginManager(pluginName, pluginDir)
      
      // 重新扫描插件
      await pluginManager.rescanPlugin(pluginName)
      
      // 激活插件
      const success = await pluginManager.activatePlugin(pluginName)
      if (!success) {
        throw new Error(`Failed to activate plugin: ${pluginName}`)
      }
      
      console.log(`Dev plugin loaded: ${pluginName}`)
    } catch (error) {
      console.error(`Failed to load dev plugin ${pluginName}:`, error)
      throw error
    }
  }

  /**
   * 卸载插件
   */
  private async unloadPlugin(pluginName: string): Promise<void> {
    try {
      await pluginManager.deactivatePlugin(pluginName)
      console.log(`Plugin unloaded: ${pluginName}`)
    } catch (error) {
      console.error(`Failed to unload plugin ${pluginName}:`, error)
    }
  }

  /**
   * 加载所有开发插件
   */
  private async loadAllDevPlugins(): Promise<void> {
    try {
      const entries = await fs.readdir(this.devPluginsDir, { withFileTypes: true })
      const pluginDirs = entries.filter(entry => entry.isDirectory())

      for (const dir of pluginDirs) {
        try {
          await this.loadDevPlugin(dir.name)
        } catch (error) {
          console.error(`Failed to load dev plugin ${dir.name}:`, error)
        }
      }
    } catch (error) {
      console.error('Failed to load dev plugins:', error)
    }
  }

  /**
   * 验证插件清单
   */
  private validateManifest(manifest: PluginMetadata): boolean {
    return !!(manifest.name && manifest.version && manifest.description)
  }

  /**
   * 将开发插件复制到插件管理器目录
   */
  private async copyToPluginManager(pluginName: string, sourceDir: string): Promise<void> {
    const targetDir = path.join(app.getPath('userData'), 'plugins', pluginName)
    
    try {
      // 确保目标目录存在
      await fs.mkdir(targetDir, { recursive: true })
      
      // 复制插件文件
      await this.copyDirectory(sourceDir, targetDir)
    } catch (error) {
      console.error(`Failed to copy plugin ${pluginName}:`, error)
      throw error
    }
  }

  /**
   * 递归复制目录
   */
  private async copyDirectory(source: string, target: string): Promise<void> {
    const entries = await fs.readdir(source, { withFileTypes: true })
    
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name)
      const targetPath = path.join(target, entry.name)
      
      if (entry.isDirectory()) {
        await fs.mkdir(targetPath, { recursive: true })
        await this.copyDirectory(sourcePath, targetPath)
      } else {
        await fs.copyFile(sourcePath, targetPath)
      }
    }
  }

  /**
   * 通知渲染进程
   */
  private notifyRenderer(event: string, data: any): void {
    const windows = BrowserWindow.getAllWindows()
    windows.forEach(window => {
      window.webContents.send('plugin-dev-server', { event, data })
    })
  }

  /**
   * 获取开发插件目录
   */
  getDevPluginsDir(): string {
    return this.devPluginsDir
  }

  /**
   * 检查是否正在监听
   */
  isRunning(): boolean {
    return this.isWatching
  }
}

export const pluginDevServer = new PluginDevServer()