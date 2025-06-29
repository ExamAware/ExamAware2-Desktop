import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import type { ExamConfig } from '@renderer/core/configTypes'
import { ExamConfigManager } from '@renderer/core/configManager'
import { FileOperationManager } from '@renderer/core/fileOperations'
import { MessageService } from '@renderer/core/messageService'
import { getSyncedTime } from '@renderer/utils/timeUtils'

/**
 * 考试编辑器状态管理
 */
export function useExamEditor() {
  // 状态
  const configManager = new ExamConfigManager()
  const currentExamIndex = ref<number | null>(null)
  const windowTitle = ref('ExamAware Editor')
  const showAboutDialog = ref(false)

  // 响应式配置
  const examConfig = reactive<ExamConfig>(configManager.getConfig())

  // 计算属性
  const currentExam = computed(() => {
    if (currentExamIndex.value === null || !examConfig.examInfos[currentExamIndex.value]) {
      return null
    }
    return examConfig.examInfos[currentExamIndex.value]
  })

  const hasExams = computed(() => examConfig.examInfos.length > 0)

  // 配置变更监听器
  const configListener = (newConfig: ExamConfig) => {
    console.log('useExamEditor: configListener called with:', newConfig)
    console.log('useExamEditor: current examConfig before update:', examConfig)

    // 使用响应式替换
    examConfig.examName = newConfig.examName || ''
    examConfig.message = newConfig.message || ''
    examConfig.examInfos = [...(newConfig.examInfos || [])]

    console.log('useExamEditor: examConfig after update:', examConfig)
  }

  // 方法
  const addExam = () => {
    const newIndex = configManager.addExamInfo()
    currentExamIndex.value = newIndex
  }

  const deleteExam = (index: number) => {
    configManager.deleteExamInfo(index)
    if (currentExamIndex.value === index) {
      currentExamIndex.value = null
    } else if (currentExamIndex.value !== null && currentExamIndex.value > index) {
      currentExamIndex.value--
    }
  }

  const updateExam = (index: number, examInfo: Partial<typeof examConfig.examInfos[0]>) => {
    configManager.updateExamInfo(index, examInfo)
  }

  const switchToExam = (index: number) => {
    if (index >= 0 && index < examConfig.examInfos.length) {
      currentExamIndex.value = index
    }
  }

  const updateConfig = (newConfig: Partial<ExamConfig>) => {
    configManager.updateConfig(newConfig)
  }

  const newProject = () => {
    configManager.reset()
    currentExamIndex.value = null
    windowTitle.value = 'ExamAware Editor - 新项目'
  }

  const saveProject = () => {
    try {
      const content = configManager.exportToJson()
      FileOperationManager.saveToLocalStorage('examConfig', content)
      MessageService.success('项目已保存')
      console.log('项目已保存到本地存储')
    } catch (error) {
      MessageService.error('保存失败')
      console.error('保存失败:', error)
    }
  }

  const saveProjectAs = () => {
    try {
      const content = configManager.exportToJson()
      const examName = examConfig.examInfos[0]?.name || 'exam'
      FileOperationManager.exportJsonFileAs(content, `${examName}.json`)
      MessageService.success('项目已另存为文件')
    } catch (error) {
      MessageService.error('另存为失败')
      console.error('另存为失败:', error)
    }
  }

  const exportProject = () => {
    try {
      const content = configManager.exportToJson()
      const examName = examConfig.examInfos[0]?.name || 'exam'
      FileOperationManager.exportJsonFile(content, `${examName}.json`)
      MessageService.success('项目已导出')
    } catch (error) {
      MessageService.error('导出失败')
      console.error('导出失败:', error)
    }
  }

  const importProject = async () => {
    try {
      const content = await FileOperationManager.importJsonFile()
      if (content) {
        const success = configManager.loadFromJson(content)
        if (success) {
          currentExamIndex.value = null
          windowTitle.value = 'ExamAware Editor - 已导入项目'
          MessageService.success('项目导入成功')
          console.log('项目导入成功')
        } else {
          MessageService.error('项目导入失败：文件格式不正确')
          console.error('项目导入失败：文件格式不正确')
        }
      }
    } catch (error) {
      MessageService.error('导入失败')
      console.error('导入失败:', error)
    }
  }

  const openProject = async () => {
    try {
      const content = await FileOperationManager.importJsonFile()
      if (content) {
        const success = configManager.loadFromJson(content)
        if (success) {
          currentExamIndex.value = null

          // 获取项目名称并添加到最近文件
          const projectName = examConfig.examInfos[0]?.name || '未命名项目'
          const timestamp = new Date(getSyncedTime()).toLocaleString()
          const fileName = `${projectName} (${timestamp})`
          FileOperationManager.addToRecentFiles(fileName)

          windowTitle.value = `ExamAware Editor - ${projectName}`
          MessageService.success('项目打开成功')
          console.log('项目打开成功')
        } else {
          MessageService.error('项目打开失败：文件格式不正确')
          console.error('项目打开失败：文件格式不正确')
        }
      }
    } catch (error) {
      MessageService.error('打开失败')
      console.error('打开失败:', error)
    }
  }

  const closeProject = () => {
    configManager.reset()
    currentExamIndex.value = null
    windowTitle.value = 'ExamAware Editor'
    MessageService.info('项目已关闭')
    console.log('项目已关闭')
  }
  const undoAction = () => {
    console.log('撤销操作')
    // TODO: 实现撤销功能
  }

  const redoAction = () => {
    console.log('重做操作')
    // TODO: 实现重做功能
  }

  const cutAction = () => {
    console.log('剪切操作')
    // TODO: 实现剪切功能
  }

  const copyAction = () => {
    console.log('复制操作')
    // TODO: 实现复制功能
  }

  const pasteAction = () => {
    console.log('粘贴操作')
    // TODO: 实现粘贴功能
  }

  const findAction = () => {
    console.log('查找操作')
    // TODO: 实现查找功能
  }

  const replaceAction = () => {
    console.log('替换操作')
    // TODO: 实现替换功能
  }

  const openAboutDialog = () => {
    showAboutDialog.value = true
  }

  const closeAboutDialog = () => {
    showAboutDialog.value = false
  }

  const openGithub = () => {
    window.open('https://github.com/ExamAware/')
  }

  // 生命周期
  onMounted(() => {
    configManager.addListener(configListener)
    configManager.loadFromLocalStorage()
  })

  onUnmounted(() => {
    configManager.removeListener(configListener)
  })

  return {
    // 状态
    examConfig,
    currentExamIndex,
    windowTitle,
    showAboutDialog,

    // 计算属性
    currentExam,
    hasExams,

    // 方法
    addExam,
    deleteExam,
    updateExam,
    switchToExam,
    updateConfig,
    newProject,
    saveProject,
    saveProjectAs,
    exportProject,
    importProject,
    openProject,
    closeProject,
    undoAction,
    redoAction,
    cutAction,
    copyAction,
    pasteAction,
    findAction,
    replaceAction,
    openAboutDialog,
    closeAboutDialog,
    openGithub,

    // 管理器实例（用于高级操作）
    configManager,
  }
}
