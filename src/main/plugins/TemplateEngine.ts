import * as fs from 'fs/promises'
import * as path from 'path'

/**
 * 简单的模板引擎，支持变量替换和条件渲染
 */
export class TemplateEngine {
  private templatesDir: string

  constructor(templatesDir: string) {
    this.templatesDir = templatesDir
  }

  /**
   * 渲染模板文件
   * @param templateName 模板文件名
   * @param variables 模板变量
   * @returns 渲染后的内容
   */
  async renderTemplate(templateName: string, variables: Record<string, any>): Promise<string> {
    const templatePath = path.join(this.templatesDir, templateName)
    
    try {
      const templateContent = await fs.readFile(templatePath, 'utf-8')
      return this.processTemplate(templateContent, variables)
    } catch (error) {
      throw new Error(`Failed to read template ${templateName}: ${error.message}`)
    }
  }

  /**
   * 处理模板内容，替换变量和处理条件
   * @param template 模板内容
   * @param variables 变量对象
   * @returns 处理后的内容
   */
  private processTemplate(template: string, variables: Record<string, any>): string {
    let result = template

    // 处理条件渲染 {{#condition}}...{{/condition}}
    result = this.processConditionals(result, variables)

    // 处理变量替换 {{variableName}}
    result = this.processVariables(result, variables)

    return result
  }

  /**
   * 处理条件渲染
   * @param template 模板内容
   * @param variables 变量对象
   * @returns 处理后的内容
   */
  private processConditionals(template: string, variables: Record<string, any>): string {
    const conditionalRegex = /{{#(\w+)}}([\s\S]*?){{\/(\w+)}}/g
    
    return template.replace(conditionalRegex, (match, startCondition, content, endCondition) => {
      if (startCondition !== endCondition) {
        throw new Error(`Mismatched conditional tags: ${startCondition} and ${endCondition}`)
      }
      
      const conditionValue = variables[startCondition]
      return conditionValue ? content : ''
    })
  }

  /**
   * 处理变量替换
   * @param template 模板内容
   * @param variables 变量对象
   * @returns 处理后的内容
   */
  private processVariables(template: string, variables: Record<string, any>): string {
    const variableRegex = /{{(\w+)}}/g
    
    return template.replace(variableRegex, (match, variableName) => {
      const value = variables[variableName]
      return value !== undefined ? String(value) : match
    })
  }

  /**
   * 检查模板文件是否存在
   * @param templateName 模板文件名
   * @returns 是否存在
   */
  async templateExists(templateName: string): Promise<boolean> {
    const templatePath = path.join(this.templatesDir, templateName)
    try {
      await fs.access(templatePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取所有可用的模板文件
   * @returns 模板文件名列表
   */
  async getAvailableTemplates(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.templatesDir)
      return files.filter(file => file.endsWith('.template'))
    } catch {
      return []
    }
  }
}