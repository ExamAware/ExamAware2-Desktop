import type { MenuOptions } from '@imengyu/vue3-context-menu'

/**
 * 菜单配置管理器
 * 负责管理应用程序的菜单配置
 */
export class MenuConfigManager {
  private handlers: any
  private menuUpdateCallback: (() => void) | null = null
  private pluginMenuItems: Map<string, any[]> = new Map()

  constructor(handlers: {
    onNew: () => void
    onOpen: () => void
    onSave: () => void
    onSaveAs?: () => void
    onImport?: () => void
    onExport?: () => void
    onClose?: () => void
    onRestoreSession?: () => void
    onUndo?: () => void
    onRedo?: () => void
    onCut?: () => void
    onCopy?: () => void
    onPaste?: () => void
    onFind?: () => void
    onReplace?: () => void
    onAbout: () => void
    onGithub: () => void
    onPresentation?: () => void
    onAddExam?: () => void
    onDeleteExam?: () => void
    onNextExam?: () => void
    onPrevExam?: () => void
  }) {
    this.handlers = handlers
  }

  /**
   * 设置菜单更新回调
   */
  setMenuUpdateCallback(callback: () => void): void {
    this.menuUpdateCallback = callback
  }

  /**
   * 获取菜单配置
   */
  getMenuConfig(): MenuOptions {
    const baseMenu: MenuOptions = {
      items: [
        {
          label: '文件',
          children: [
            { label: '新建', onClick: this.handlers.onNew, shortcut: 'Ctrl+N' },
            { label: '打开', onClick: this.handlers.onOpen, shortcut: 'Ctrl+O' },
            { label: '保存', onClick: this.handlers.onSave, shortcut: 'Ctrl+S' },
            { label: '另存为', onClick: this.handlers.onSaveAs, shortcut: 'Ctrl+Shift+S' },
            { divided: true },
            { label: '导入', onClick: this.handlers.onImport },
            { label: '导出', onClick: this.handlers.onExport },
            { divided: true },
            { label: '关闭', onClick: this.handlers.onClose, shortcut: 'Ctrl+W' },
          ]
        },
        {
          label: '编辑',
          children: [
            { label: '撤销', onClick: this.handlers.onUndo, shortcut: 'Ctrl+Z' },
            { label: '重做', onClick: this.handlers.onRedo, shortcut: 'Ctrl+Y' },
            { divided: true },
            { label: '剪切', onClick: this.handlers.onCut, shortcut: 'Ctrl+X' },
            { label: '复制', onClick: this.handlers.onCopy, shortcut: 'Ctrl+C' },
            { label: '粘贴', onClick: this.handlers.onPaste, shortcut: 'Ctrl+V' },
            { divided: true },
            { label: '查找', onClick: this.handlers.onFind, shortcut: 'Ctrl+F' },
            { label: '替换', onClick: this.handlers.onReplace, shortcut: 'Ctrl+H' },
          ]
        },
        {
          label: '考试',
          children: [
            { label: '添加考试', onClick: this.handlers.onAddExam },
            { label: '删除考试', onClick: this.handlers.onDeleteExam },
            { divided: true },
            { label: '上一个考试', onClick: this.handlers.onPrevExam },
            { label: '下一个考试', onClick: this.handlers.onNextExam },
            { divided: true },
            { label: '开始放映', onClick: this.handlers.onPresentation },
          ]
        },
        {
          label: '帮助',
          children: [
            { label: '关于', onClick: this.handlers.onAbout },
            { label: 'GitHub', onClick: this.handlers.onGithub },
          ]
        }
      ]
    }

    // 添加插件菜单项
    this.addPluginMenuItemsToConfig(baseMenu)

    return baseMenu
  }

  /**
   * 添加插件菜单项
   */
  addPluginMenuItem(pluginName: string, menuItem: any): void {
    if (!this.pluginMenuItems.has(pluginName)) {
      this.pluginMenuItems.set(pluginName, [])
    }
    this.pluginMenuItems.get(pluginName)!.push(menuItem)
    this.notifyMenuUpdate()
  }

  /**
   * 移除插件菜单项
   */
  removePluginMenuItem(pluginName: string, menuItemId: string): void {
    const items = this.pluginMenuItems.get(pluginName)
    if (items) {
      const index = items.findIndex(item => item.id === menuItemId)
      if (index !== -1) {
        items.splice(index, 1)
        this.notifyMenuUpdate()
      }
    }
  }

  /**
   * 移除插件的所有菜单项
   */
  removeAllPluginMenuItems(pluginName: string): void {
    if (this.pluginMenuItems.has(pluginName)) {
      this.pluginMenuItems.delete(pluginName)
      this.notifyMenuUpdate()
    }
  }

  /**
   * 将插件菜单项添加到菜单配置中
   */
  private addPluginMenuItemsToConfig(menuConfig: MenuOptions): void {
    if (this.pluginMenuItems.size === 0) return

    // 创建插件菜单
    const pluginMenu = {
      label: '插件',
      children: [] as any[]
    }

    // 添加所有插件的菜单项
    for (const [pluginName, items] of this.pluginMenuItems) {
      if (items.length > 0) {
        pluginMenu.children.push({
          label: pluginName,
          children: items
        })
      }
    }

    // 如果有插件菜单项，添加到主菜单
    if (pluginMenu.children.length > 0) {
      // 在帮助菜单前插入插件菜单
      const helpIndex = menuConfig.items!.findIndex(item => item.label === '帮助')
      if (helpIndex !== -1) {
        menuConfig.items!.splice(helpIndex, 0, pluginMenu)
      } else {
        menuConfig.items!.push(pluginMenu)
      }
    }
  }

  /**
   * 通知菜单更新
   */
  private notifyMenuUpdate(): void {
    if (this.menuUpdateCallback) {
      this.menuUpdateCallback()
    }
  }
}
