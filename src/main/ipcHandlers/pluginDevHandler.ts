/**
 * 插件开发相关的IPC处理器
 */

import { ipcMain, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { pluginDevServer } from '../plugins/PluginDevServer'
import { pluginDevTools } from '../plugins/PluginDevTools'
import { pluginManager } from '../plugins/PluginManager'

/**
 * 注册插件开发相关的IPC处理器
 */
export function registerPluginDevHandlers(): void {
  // 获取开发服务器状态
  ipcMain.handle('plugin-dev:get-status', async () => {
    return {
      running: pluginDevServer.isRunning(),
      pluginsDir: pluginDevServer.getDevPluginsDir()
    }
  })

  // 获取开发中的插件列表
  ipcMain.handle('plugin-dev:get-plugins', async () => {
    try {
      const pluginsDir = pluginDevServer.getDevPluginsDir()
      const entries = await fs.readdir(pluginsDir, { withFileTypes: true })
      const pluginDirs = entries.filter(entry => entry.isDirectory())

      const plugins: Array<{
        name: string
        version: string
        description: string
        active: boolean
      }> = []
      for (const dir of pluginDirs) {
        try {
          const manifestPath = path.join(pluginsDir, dir.name, 'plugin.json')
          let manifest: any = {}
          
          try {
            const manifestContent = await fs.readFile(manifestPath, 'utf-8')
            manifest = JSON.parse(manifestContent)
          } catch (manifestError) {
            console.warn(`Failed to read plugin manifest for ${dir.name}:`, manifestError)
            // 使用默认值继续处理
          }

          // 检查插件是否已激活
          const pluginInfo = pluginManager.getPlugin(dir.name)
          const isActive = pluginInfo?.status === 'active'

          plugins.push({
            name: dir.name || '未知插件',
            version: manifest.version || '1.0.0',
            description: manifest.description || '开发中的插件',
            active: isActive || false
          })
        } catch (error) {
          console.error(`Failed to process plugin ${dir.name}:`, error)
          // 即使出错也添加基本信息
          plugins.push({
            name: dir.name || '未知插件',
            version: '1.0.0',
            description: '插件加载失败',
            active: false
          })
        }
      }

      return plugins
    } catch (error) {
      console.error('Failed to get dev plugins:', error)
      return []
    }
  })

  // 创建插件模板
  ipcMain.handle('plugin-dev:create-template', async (event, pluginName: string, options: any) => {
    try {
      const pluginDir = await pluginDevTools.createPluginTemplate({
        name: pluginName,
        description: options.name || pluginName,
        author: options.author || 'Unknown',
        hasMain: options.hasMain || false,
        hasRenderer: options.hasRenderer !== false, // 默认为true
        permissions: options.permissions || ['ipc']
      })

      console.log(`Plugin template created: ${pluginDir}`)
      return true
    } catch (error) {
      console.error('Failed to create plugin template:', error)
      return false
    }
  })

  // 触发插件重载（通过修改文件时间戳）
  ipcMain.handle('plugin-dev:touch-plugin', async (event, pluginName: string) => {
    try {
      const pluginsDir = pluginDevServer.getDevPluginsDir()
      const pluginDir = path.join(pluginsDir, pluginName)
      const manifestPath = path.join(pluginDir, 'plugin.json')

      // 检查插件目录是否存在
      await fs.access(pluginDir)

      // 修改plugin.json的时间戳来触发重载
      const now = new Date()
      await fs.utimes(manifestPath, now, now)

      return true
    } catch (error) {
      console.error(`Failed to touch plugin ${pluginName}:`, error)
      throw error
    }
  })

  // 打开插件目录
  ipcMain.handle('plugin-dev:open-directory', async (event, pluginName: string) => {
    try {
      const pluginsDir = pluginDevServer.getDevPluginsDir()
      const pluginDir = path.join(pluginsDir, pluginName)

      // 检查目录是否存在
      await fs.access(pluginDir)

      // 在文件管理器中打开目录
      await shell.openPath(pluginDir)

      return true
    } catch (error) {
      console.error(`Failed to open plugin directory ${pluginName}:`, error)
      throw error
    }
  })

  // 验证插件
  ipcMain.handle('plugin-dev:validate-plugin', async (event, pluginName: string) => {
    try {
      const pluginsDir = pluginDevServer.getDevPluginsDir()
      const pluginDir = path.join(pluginsDir, pluginName)

      const result = await pluginDevTools.validatePlugin(pluginDir)
      return result
    } catch (error) {
      console.error(`Failed to validate plugin ${pluginName}:`, error)
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: []
      }
    }
  })

  // 打包插件
  ipcMain.handle('plugin-dev:package-plugin', async (event, pluginName: string, outputPath?: string) => {
    try {
      const pluginsDir = pluginDevServer.getDevPluginsDir()
      const pluginDir = path.join(pluginsDir, pluginName)

      const defaultOutputPath = path.join(pluginsDir, `${pluginName}.zip`)
      const finalOutputPath = outputPath || defaultOutputPath

      const success = await pluginDevTools.packagePlugin(pluginDir, finalOutputPath)
      return { success, outputPath: finalOutputPath }
    } catch (error) {
      console.error(`Failed to package plugin ${pluginName}:`, error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  // 生成插件文档
  ipcMain.handle('plugin-dev:generate-docs', async (event, pluginName: string) => {
    try {
      const pluginsDir = pluginDevServer.getDevPluginsDir()
      const pluginDir = path.join(pluginsDir, pluginName)

      const docsPath = await pluginDevTools.generateDocs(pluginDir)
      return { success: true, docsPath }
    } catch (error) {
      console.error(`Failed to generate docs for plugin ${pluginName}:`, error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  // 启动开发服务器
  ipcMain.handle('plugin-dev:start-server', async () => {
    try {
      if (!pluginDevServer.isRunning()) {
        await pluginDevServer.start()
      }
      return true
    } catch (error) {
      console.error('Failed to start plugin dev server:', error)
      return false
    }
  })

  // 停止开发服务器
  ipcMain.handle('plugin-dev:stop-server', async () => {
    try {
      if (pluginDevServer.isRunning()) {
        await pluginDevServer.stop()
      }
      return true
    } catch (error) {
      console.error('Failed to stop plugin dev server:', error)
      return false
    }
  })

  try {
    ipcMain.removeHandler('plugin-dev:touch-plugin')
  } catch (e) {
    // 忽略移除不存在处理器的错误
  }

  ipcMain.handle('plugin-dev:touch-plugin', async (event, pluginName: string) => {
    try {
      // 先停用插件
      await pluginManager.deactivatePlugin(pluginName)
      // 再激活插件
      const success = await pluginManager.activatePlugin(pluginName)
      console.log(`Plugin ${pluginName} touched: ${success ? 'success' : 'failed'}`)
      return success
    } catch (error) {
      console.error(`Failed to touch plugin ${pluginName}:`, error)
      return false
    }
  })

  console.log('Plugin development IPC handlers registered')
}
