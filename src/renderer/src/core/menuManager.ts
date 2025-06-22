import type { MenuOptions } from '@imengyu/vue3-context-menu'
import { FileOperationManager } from './fileOperations'

/**
 * 菜单配置管理器
 * 负责管理应用的菜单配置
 */
export class MenuConfigManager {
  private onNew?: () => void
  private onOpen?: () => void
  private onSave?: () => void
  private onSaveAs?: () => void
  private onImport?: () => void
  private onExport?: () => void
  private onClose?: () => void
  private onUndo?: () => void
  private onRedo?: () => void
  private onCut?: () => void
  private onCopy?: () => void
  private onPaste?: () => void
  private onFind?: () => void
  private onReplace?: () => void
  private onAbout?: () => void
  private onGithub?: () => void
  private onPresentation?: () => void
  private onAddExam?: () => void
  private onDeleteExam?: () => void
  private onNextExam?: () => void
  private onPrevExam?: () => void

  constructor(handlers: {
    onNew?: () => void
    onOpen?: () => void
    onSave?: () => void
    onSaveAs?: () => void
    onImport?: () => void
    onExport?: () => void
    onClose?: () => void
    onUndo?: () => void
    onRedo?: () => void
    onCut?: () => void
    onCopy?: () => void
    onPaste?: () => void
    onFind?: () => void
    onReplace?: () => void
    onAbout?: () => void
    onGithub?: () => void
    onPresentation?: () => void
    onAddExam?: () => void
    onDeleteExam?: () => void
    onNextExam?: () => void
    onPrevExam?: () => void
  }) {
    this.onNew = handlers.onNew
    this.onOpen = handlers.onOpen
    this.onSave = handlers.onSave
    this.onSaveAs = handlers.onSaveAs
    this.onImport = handlers.onImport
    this.onExport = handlers.onExport
    this.onClose = handlers.onClose
    this.onUndo = handlers.onUndo
    this.onRedo = handlers.onRedo
    this.onCut = handlers.onCut
    this.onCopy = handlers.onCopy
    this.onPaste = handlers.onPaste
    this.onFind = handlers.onFind
    this.onReplace = handlers.onReplace
    this.onAbout = handlers.onAbout
    this.onGithub = handlers.onGithub
    this.onPresentation = handlers.onPresentation
    this.onAddExam = handlers.onAddExam
    this.onDeleteExam = handlers.onDeleteExam
    this.onNextExam = handlers.onNextExam
    this.onPrevExam = handlers.onPrevExam
  }

  /**
   * 获取菜单配置
   */
  getMenuConfig(): MenuOptions {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const cmdKey = isMac ? '⌘' : 'Ctrl+'
    const recentFiles = FileOperationManager.getRecentFiles()

    return {
      x: 0,
      y: 0,
      items: [
        {
          label: '文件',
          children: [
            {
              label: '新建项目',
              shortcut: `${cmdKey}N`,
              onClick: () => this.onNew?.(),
            },
            {
              label: '打开项目...',
              shortcut: `${cmdKey}O`,
              onClick: () => this.onOpen?.(),
            },
            {
              label: '最近打开',
              children: recentFiles.length > 0 ? [
                ...recentFiles.map(file => ({
                  label: file,
                  onClick: () => {
                    // TODO: 实现打开特定文件的逻辑
                    console.log('打开最近文件:', file)
                  }
                })),
                { label: '清除列表', divided: true, onClick: () => FileOperationManager.clearRecentFiles() }
              ] : [
                { label: '无最近文件', disabled: true }
              ],
            },
            {
              label: '导入配置...',
              shortcut: `${cmdKey}I`,
              onClick: () => this.onImport?.(),
            },
            {
              label: '保存',
              shortcut: `${cmdKey}S`,
              divided: true,
              onClick: () => this.onSave?.(),
            },
            {
              label: '另存为...',
              shortcut: `${cmdKey}⇧S`,
              onClick: () => this.onSaveAs?.(),
            },
            {
              label: '导出配置...',
              shortcut: `${cmdKey}⇧E`,
              onClick: () => this.onExport?.(),
            },
            {
              label: '关闭项目',
              shortcut: `${cmdKey}W`,
              divided: true,
              onClick: () => this.onClose?.(),
            },
          ],
        },
        {
          label: '编辑',
          children: [
            {
              label: '撤销',
              shortcut: `${cmdKey}Z`,
              onClick: () => this.onUndo?.(),
            },
            {
              label: '重做',
              shortcut: `${cmdKey}⇧Z`,
              onClick: () => this.onRedo?.(),
            },
            {
              label: '剪切',
              shortcut: `${cmdKey}X`,
              divided: true,
              onClick: () => this.onCut?.(),
            },
            {
              label: '复制',
              shortcut: `${cmdKey}C`,
              onClick: () => this.onCopy?.(),
            },
            {
              label: '粘贴',
              shortcut: `${cmdKey}V`,
              onClick: () => this.onPaste?.(),
            },
            {
              label: '查找',
              shortcut: `${cmdKey}F`,
              divided: true,
              onClick: () => this.onFind?.(),
            },
            {
              label: '替换',
              shortcut: `${cmdKey}H`,
              onClick: () => this.onReplace?.(),
            },
          ],
        },
        {
          label: '考试',
          children: [
            {
              label: '添加考试',
              shortcut: `${cmdKey}E`,
              onClick: () => this.onAddExam?.(),
            },
            {
              label: '删除当前考试',
              shortcut: 'Delete',
              onClick: () => this.onDeleteExam?.(),
            },
            {
              label: '下一个考试',
              shortcut: `${cmdKey}↓`,
              onClick: () => this.onNextExam?.(),
            },
            {
              label: '上一个考试',
              shortcut: `${cmdKey}↑`,
              onClick: () => this.onPrevExam?.(),
            },
          ],
        },
        {
          label: '视图',
          children: [
            {
              label: '开始全屏放映',
              shortcut: 'F5',
              onClick: () => this.onPresentation?.(),
            },
          ],
        },
        {
          label: '帮助',
          children: [
            {
              label: 'GitHub 仓库',
              onClick: () => this.onGithub?.(),
            },
            {
              label: '关于 ExamAware',
              onClick: () => this.onAbout?.(),
            },
          ],
        },
      ],
      zIndex: 3,
      minWidth: 230,
    }
  }

  /**
   * 更新处理函数
   */
  updateHandlers(handlers: Partial<{
    onNew: () => void
    onOpen: () => void
    onSave: () => void
    onSaveAs: () => void
    onImport: () => void
    onExport: () => void
    onClose: () => void
    onUndo: () => void
    onRedo: () => void
    onCut: () => void
    onCopy: () => void
    onPaste: () => void
    onFind: () => void
    onReplace: () => void
    onAbout: () => void
    onGithub: () => void
    onPresentation: () => void
    onAddExam: () => void
    onDeleteExam: () => void
    onNextExam: () => void
    onPrevExam: () => void
    onShowShortcuts: () => void
  }>): void {
    Object.assign(this, handlers)
  }
}
