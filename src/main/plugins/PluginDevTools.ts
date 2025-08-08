/**
 * 插件开发工具
 * 提供插件开发、调试和测试的辅助功能
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import { fileApi } from '../fileUtils'
import type { PluginMetadata } from './types'
import { TemplateEngine } from './TemplateEngine'

export class PluginDevTools {
  private devPluginsDir: string
  private templateEngine: TemplateEngine

  constructor() {
    this.devPluginsDir = path.join(app.getPath('userData'), 'dev-plugins')
    const templatesDir = path.join(__dirname, 'templates')
    this.templateEngine = new TemplateEngine(templatesDir)
  }

  /**
   * 创建插件模板
   */
  async createPluginTemplate(options: {
    name: string
    description: string
    author: string
    hasMain?: boolean
    hasRenderer?: boolean
    permissions?: string[]
  }): Promise<string> {
    const pluginDir = path.join(this.devPluginsDir, options.name)

    // 确保目录存在
    await fs.mkdir(pluginDir, { recursive: true })

    // 创建插件清单
    const manifest: PluginMetadata = {
      name: options.name,
      version: '1.0.0',
      description: options.description,
      author: options.author,
      main: options.hasMain ? 'main.js' : undefined,
      renderer: options.hasRenderer ? 'renderer.js' : undefined,
      permissions: options.permissions as any,
      engines: {
        examaware: '^1.0.0',
        electron: '^31.0.0',
        node: '^20.0.0'
      }
    }

    await fileApi.writeFile(
      path.join(pluginDir, 'plugin.json'),
      JSON.stringify(manifest, null, 2)
    )

    // 准备模板变量
    const templateVariables = {
      pluginName: options.name,
      pascalCasePluginName: this.toPascalCase(options.name),
      lowerCasePluginName: options.name.toLowerCase(),
      description: options.description,
      author: options.author,
      hasMain: options.hasMain,
      hasRenderer: options.hasRenderer,
      permissions: options.permissions || []
    }

    // 创建主进程文件
    if (options.hasMain) {
      const mainContent = await this.templateEngine.renderTemplate('main.js.template', templateVariables)
      await fileApi.writeFile(path.join(pluginDir, 'main.js'), mainContent)
    }

    // 创建渲染进程文件
    if (options.hasRenderer) {
      const rendererContent = await this.templateEngine.renderTemplate('renderer.js.template', templateVariables)
      await fileApi.writeFile(path.join(pluginDir, 'renderer.js'), rendererContent)
    }

    // 创建README文件
    const readmeContent = await this.templateEngine.renderTemplate('README.md.template', templateVariables)
    await fileApi.writeFile(path.join(pluginDir, 'README.md'), readmeContent)

    // 创建package.json
    const packageJsonContent = await this.templateEngine.renderTemplate('package.json.template', templateVariables)
    await fileApi.writeFile(path.join(pluginDir, 'package.json'), packageJsonContent)

    return pluginDir
  }

  /**
   * 获取可用的模板列表
   * @returns 模板文件名列表
   */
  async getAvailableTemplates(): Promise<string[]> {
    return await this.templateEngine.getAvailableTemplates()
  }

  /**
   * 检查模板是否存在
   * @param templateName 模板文件名
   * @returns 是否存在
   */
  async templateExists(templateName: string): Promise<boolean> {
    return await this.templateEngine.templateExists(templateName)
  }

  /**
   * 使用自定义模板创建插件
   * @param templateName 模板名称
   * @param options 插件选项
   * @param outputPath 输出路径
   * @returns 创建的插件目录路径
   */
  async createPluginFromTemplate(
    templateName: string,
    options: {
      name: string
      description: string
      author: string
      [key: string]: any
    },
    outputPath?: string
  ): Promise<string> {
    const pluginDir = outputPath || path.join(this.devPluginsDir, options.name)
    
    // 确保插件目录存在
    await fs.mkdir(pluginDir, { recursive: true })

    // 准备模板变量
    const templateVariables = {
      pluginName: options.name,
      pascalCasePluginName: this.toPascalCase(options.name),
      lowerCasePluginName: options.name.toLowerCase(),
      description: options.description,
      author: options.author
    }
    
    // 添加额外的选项，但排除已定义的基本属性
    const { name, description, author, ...extraOptions } = options
    Object.assign(templateVariables, extraOptions)

    // 渲染模板
    const content = await this.templateEngine.renderTemplate(templateName, templateVariables)
    
    // 确定输出文件名（去掉.template后缀）
    const outputFileName = templateName.replace('.template', '')
    await fs.writeFile(path.join(pluginDir, outputFileName), content)

    return pluginDir
  }









  /**
   * 转换为PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
  }

  /**
   * 验证插件
   */
  async validatePlugin(pluginPath: string): Promise<{
    valid: boolean
    errors: string[]
    warnings: string[]
  }> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // 检查plugin.json
      const manifestPath = path.join(pluginPath, 'plugin.json')
      const manifestContent = await fileApi.readFile(manifestPath)
      const manifest = JSON.parse(manifestContent)

      // 验证必需字段
      if (!manifest.name) errors.push('缺少插件名称')
      if (!manifest.version) errors.push('缺少版本号')
      if (!manifest.description) errors.push('缺少描述')
      if (!manifest.author) errors.push('缺少作者信息')

      // 检查主进程文件
      if (manifest.main) {
        const mainPath = path.join(pluginPath, manifest.main)
        try {
          await fs.access(mainPath)
        } catch {
          errors.push(`主进程文件不存在: ${manifest.main}`)
        }
      }

      // 检查渲染进程文件
      if (manifest.renderer) {
        const rendererPath = path.join(pluginPath, manifest.renderer)
        try {
          await fs.access(rendererPath)
        } catch {
          errors.push(`渲染进程文件不存在: ${manifest.renderer}`)
        }
      }

      // 检查权限
      if (manifest.permissions && manifest.permissions.length > 5) {
        warnings.push('插件请求了过多权限，可能存在安全风险')
      }

    } catch (error: any) {
      errors.push(`无法读取插件清单: ${error.message}`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 打包插件
   */
  async packagePlugin(pluginPath: string, outputPath: string): Promise<boolean> {
    try {
      // TODO: 实现插件打包逻辑
      // 可以使用 archiver 或其他压缩库
      console.log(`Packaging plugin from ${pluginPath} to ${outputPath}`)
      return true
    } catch (error: any) {
      console.error('Failed to package plugin:', error)
      return false
    }
  }

  /**
   * 生成插件文档
   */
  async generateDocs(pluginPath: string): Promise<string> {
    try {
      const manifestPath = path.join(pluginPath, 'plugin.json')
      const manifestContent = await fileApi.readFile(manifestPath)
      const manifest = JSON.parse(manifestContent)

      let docs = `# ${manifest.name} 插件文档\n\n`
      docs += `**版本**: ${manifest.version}\n`
      docs += `**作者**: ${manifest.author}\n`
      docs += `**描述**: ${manifest.description}\n\n`

      if (manifest.permissions) {
        docs += `## 权限要求\n\n`
        manifest.permissions.forEach(permission => {
          docs += `- ${permission}\n`
        })
        docs += '\n'
      }

      if (manifest.main) {
        docs += `## 主进程功能\n\n`
        docs += `入口文件: ${manifest.main}\n\n`
      }

      if (manifest.renderer) {
        docs += `## 渲染进程功能\n\n`
        docs += `入口文件: ${manifest.renderer}\n\n`
      }

      return docs
    } catch (error: any) {
      throw new Error(`生成文档失败: ${error.message}`)
    }
  }
}

// 导出单例实例
export const pluginDevTools = new PluginDevTools()
