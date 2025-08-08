import { ref, nextTick, type Component } from 'vue'
import type { CodeLayoutInstance } from 'vue-code-layout'
import { LayoutManager } from '@renderer/core/layoutManager'
import { MenuConfigManager } from '@renderer/core/menuManager'
import SideExamsPanel from '@renderer/components/SideExamsPanel.vue'
import SideExamInfoPanel from '@renderer/components/SideExamInfoPanel.vue'
import SettingsPanel from '@renderer/components/SettingsPanel.vue'
import ValidationPanel from '@renderer/components/ValidationPanel.vue'

const { ipcRenderer } = window.electron || {}

/**
 * 布局管理组合式函数
 */
export function useLayoutManager() {
  const codeLayout = ref<CodeLayoutInstance>()

  // 面板组件配置
  const panelComponents: Record<string, Component> = {
    'explorer.examlist': SideExamsPanel,
    'explorer.examinfo': SideExamInfoPanel,
    'settings.general': SettingsPanel,
    'bottom.validation': ValidationPanel,
  }

  let layoutManager: LayoutManager | null = null
  let menuManager: MenuConfigManager | null = null

  const initializeLayout = (onAddExam: () => void) => {
    layoutManager = new LayoutManager(panelComponents, onAddExam)

    if (codeLayout.value) {
      layoutManager.setCodeLayout(codeLayout.value)
      layoutManager.initializeLayout()
    }
  }

  const initializeMenu = (handlers: {
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
  }) => {
    menuManager = new MenuConfigManager(handlers)
    
    // 设置菜单更新回调
    let menuUpdateCallback: (() => void) | null = null
    menuManager.setMenuUpdateCallback(() => {
      menuUpdateCallback?.()
    })
    
    // 监听插件菜单项添加
    if (ipcRenderer) {
      ipcRenderer.on('plugin:add-editor-menu-item', (event, data) => {
        console.log('Received plugin:add-editor-menu-item', data)
        const { pluginName, menuItem } = data
        menuManager?.addPluginMenuItem(pluginName, menuItem)
      })
      
      // 监听插件菜单项移除
      ipcRenderer.on('plugin:remove-editor-menu-item', (event, data) => {
        const { pluginName, menuItemId } = data
        menuManager?.removePluginMenuItem(pluginName, menuItemId)
      })
      
      // 监听插件停用时清理所有菜单项
      ipcRenderer.on('plugin:remove-all-editor-menu-items', (event, data) => {
        const { pluginName } = data
        menuManager?.removeAllPluginMenuItems(pluginName)
      })
    }
    
    return {
      menuConfig: menuManager.getMenuConfig(),
      setMenuUpdateCallback: (callback: () => void) => {
        menuUpdateCallback = callback
      }
    }
  }

  const getPanelComponent = (name: string) => {
    return layoutManager?.getPanelComponent(name) || 'div'
  }

  const addPanelComponent = (name: string, component: Component) => {
    panelComponents[name] = component
    layoutManager?.addPanelComponent(name, component)
  }

  const setupLayout = async (
    onAddExam: () => void,
    menuHandlers: {
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
    }
  ) => {
    await nextTick()
    initializeLayout(onAddExam)
    const menuResult = initializeMenu(menuHandlers)
    return menuResult
  }

  return {
    codeLayout,
    setupLayout,
    getPanelComponent,
    addPanelComponent,
    layoutManager: () => layoutManager,
    menuManager: () => menuManager,
  }
}
