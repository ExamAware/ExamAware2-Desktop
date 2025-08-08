import { ref, nextTick, type Component } from 'vue'
import type { CodeLayoutInstance } from 'vue-code-layout'
import { LayoutManager } from '@renderer/core/layoutManager'
import { MenuConfigManager } from '@renderer/core/menuManager'
import SideExamsPanel from '@renderer/components/SideExamsPanel.vue'
import SideExamInfoPanel from '@renderer/components/SideExamInfoPanel.vue'
import SettingsPanel from '@renderer/components/SettingsPanel.vue'
import ValidationPanel from '@renderer/components/ValidationPanel.vue'

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
    return menuManager.getMenuConfig()
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
    return initializeMenu(menuHandlers)
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
