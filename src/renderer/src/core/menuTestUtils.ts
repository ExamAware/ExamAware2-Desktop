/**
 * 菜单功能测试工具
 */
export class MenuTestUtils {
  /**
   * 测试所有文件操作功能
   */
  static async testFileOperations() {
    console.group('📁 测试文件操作功能')

    try {
      // 测试本地存储
      console.log('✅ 测试本地存储...')
      const testData = JSON.stringify({ test: 'data' })
      localStorage.setItem('test_exam_config', testData)
      const retrieved = localStorage.getItem('test_exam_config')
      console.log('本地存储测试:', retrieved === testData ? '通过' : '失败')
      localStorage.removeItem('test_exam_config')

      // 测试最近文件功能
      console.log('✅ 测试最近文件功能...')
      const { FileOperationManager } = await import('../core/fileOperations')
      FileOperationManager.addToRecentFiles('测试文件1.json')
      FileOperationManager.addToRecentFiles('测试文件2.json')
      const recentFiles = FileOperationManager.getRecentFiles()
      console.log('最近文件列表:', recentFiles)

      console.log('✅ 所有文件操作测试完成')
    } catch (error) {
      console.error('❌ 文件操作测试失败:', error)
    }

    console.groupEnd()
  }

  /**
   * 测试菜单配置
   */
  static async testMenuConfig() {
    console.group('🍔 测试菜单配置')

    try {
      const { MenuConfigManager } = await import('../core/menuManager')

      const handlers = {
        onNew: () => console.log('新建项目'),
        onOpen: () => console.log('打开项目'),
        onSave: () => console.log('保存项目'),
        onAbout: () => console.log('关于'),
        onGithub: () => console.log('GitHub'),
      }

      const menuManager = new MenuConfigManager(handlers)
      const config = menuManager.getMenuConfig()

      console.log('✅ 菜单配置生成成功')
      console.log('菜单项数量:', config.items?.length || 0)
      console.log('文件菜单子项:', config.items?.[0]?.children?.length || 0)

    } catch (error) {
      console.error('❌ 菜单配置测试失败:', error)
    }

    console.groupEnd()
  }

  /**
   * 运行所有测试
   */
  static async runAllTests() {
    console.log('🚀 开始菜单功能测试...')

    await this.testFileOperations()
    await this.testMenuConfig()

    console.log('✅ 所有测试完成！')
  }
}
