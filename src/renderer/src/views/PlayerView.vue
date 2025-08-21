<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { TaskQueue } from '@renderer/core/taskQueue'
import type { ExamConfig, ExamInfo } from '@renderer/core/configTypes'
import { NotifyPlugin, DialogPlugin } from 'tdesign-vue-next'
import { useTimeSync, getSyncedTime } from '@renderer/utils/timeUtils'
import { useExamValidation } from '@renderer/composables/useExamValidation'
import { useConfigLoader } from '@renderer/composables/useConfigLoader'
import { parseExamConfig, validateExamConfig, hasExamTimeOverlap, getSortedExamConfig } from '@renderer/core/parser'
import { RecentFileManager } from '@renderer/core/recentFileManager'
const ipcRenderer = window.api.ipc

// 使用新的配置加载器
const {
  loading,
  loaded,
  error: configError,
  config: configData,
  source: configSource,
  isReady,
  loadFromIPC,
  reload: reloadConfig,
  smartLoad
} = useConfigLoader(ipcRenderer)

const taskQueue = new TaskQueue(getSyncedTime) // 使用同步时间函数
const nowExamInfo = ref<ExamInfo>()
const currentExamIndex = ref(0)
const { syncStatus, performSync } = useTimeSync()

// 解析考试信息并添加到任务队列
const parseExamInfosToTasks = (examInfos: ExamInfo[], config: ExamConfig) => {
  console.log('开始解析考试信息并添加定时任务...', { examInfos, config })

  if (!examInfos || examInfos.length === 0) {
    console.error('考试配置为空')
    NotifyPlugin.error({
      title: '配置错误',
      content: '考试配置为空',
      placement: 'bottom-right',
      closeBtn: true
    })
    return
  }

  // === 严格配置验证：有任何错误都不加载 ===
  console.log('开始严格配置验证...')

  // 1. 基础验证
  if (!validateExamConfig(config)) {
    console.error('配置验证失败：基础验证不通过')
    NotifyPlugin.error({
      title: '配置文件错误',
      content: '考试配置基础信息不完整，无法加载。请检查考试名称、开始时间、结束时间等必填项。',
      placement: 'bottom-right',
      closeBtn: true
    })
    return
  }

  // 2. 时间重叠检查 - 改为错误而非警告
  if (hasExamTimeOverlap(config)) {
    console.error('配置验证失败：考试时间有重叠')
    NotifyPlugin.error({
      title: '配置文件错误',
      content: '检测到考试时间有重叠，这会导致显示混乱。请在编辑器中修正时间安排后重新导入。',
      placement: 'bottom-right',
      closeBtn: true
    })
    return
  }

  // 3. 详细验证
  const { validate } = useExamValidation(config)
  const validationResult = validate()

  console.log('配置详细验证结果:', validationResult)

  // 有任何错误都不加载
  if (!validationResult.isValid) {
    console.error('详细配置验证失败:', validationResult.errors)
    NotifyPlugin.error({
      title: '配置文件错误',
      content: `配置文件存在错误，无法加载：${validationResult.errors.slice(0, 2).join('；')}${validationResult.errors.length > 2 ? '等' : ''}。请在编辑器中修正后重新导入。`,
      placement: 'bottom-right',
      closeBtn: true
    })
    return
  }

  // 有任何警告也不加载（严格模式）
  if (validationResult.warnings.length > 0) {
    console.error('配置验证失败：存在警告项', validationResult.warnings)
    NotifyPlugin.error({
      title: '配置文件问题',
      content: `配置文件存在问题，无法加载：${validationResult.warnings.slice(0, 2).join('；')}${validationResult.warnings.length > 2 ? '等' : ''}。请在编辑器中完善后重新导入。`,
      placement: 'bottom-right',
      closeBtn: true
    })
    return
  }

  console.log('配置验证通过，开始清理现有任务并添加新任务...')

  // 清理现有任务，避免重复添加
  taskQueue.clear()

  // 使用排序后的配置确保考试按时间顺序执行
  const sortedConfig = getSortedExamConfig(config)
  const sortedExamInfos = sortedConfig.examInfos

  console.log('使用排序后的考试信息:', sortedExamInfos)

  // 设置当前考试为第一场
  nowExamInfo.value = sortedExamInfos[0]
  currentExamIndex.value = 0

      // 为每场考试添加结束任务，自动切换到下一场
      let taskCount = 0
      sortedExamInfos.forEach((exam, index) => {
        const endTime = new Date(exam.end).getTime() // 修正：应该是 exam.end 而不是 exam.start
        const now = getSyncedTime() // 获取当前同步时间

        console.log(`处理考试 "${exam.name}": 结束时间=${new Date(exam.end).toLocaleString()}, 当前时间=${new Date(now).toLocaleString()}`)

        // 如果考试已经结束，跳过任务添加
        if (now >= endTime) {
          console.log(`考试 "${exam.name}" 已结束，跳过任务添加`)
          return
        }

        // 考试结束时的任务
        taskQueue.addTask(endTime, () => {
          try {
            console.log(`考试 "${exam.name}" 已结束`)
            NotifyPlugin.info({
              title: '考试结束',
              content: `${exam.name} 已结束`,
              placement: 'bottom-right',
              closeBtn: true
            })

            // 如果有下一场考试，自动切换
            if (index < sortedExamInfos.length - 1) {
              currentExamIndex.value = index + 1
              nowExamInfo.value = sortedExamInfos[index + 1]
              console.log(`自动切换到下一场考试: ${sortedExamInfos[index + 1].name}`)
              NotifyPlugin.info({
                title: '已切换到下一场考试',
                content: `当前考试: ${sortedExamInfos[index + 1].name}`,
                placement: 'bottom-right',
                closeBtn: true
              })
            }
          } catch (error) {
            console.error('考试结束任务执行失败:', error)
          }
        })
        taskCount++
        console.log(`已添加考试结束任务: ${exam.name} (${new Date(endTime).toLocaleString()})`)

        // 考试提前提醒任务
        if (exam.alertTime > 0) {
          const alertTimeMs = exam.alertTime * 60 * 1000 // 转换为毫秒
          const alertAt = endTime - alertTimeMs

          console.log(`检查提醒任务: 提醒时间=${new Date(alertAt).toLocaleString()}, 当前时间=${new Date(now).toLocaleString()}`)

          // 如果提醒时间已经过去，跳过任务添加
          if (now >= alertAt) {
            console.log(`考试 "${exam.name}" 的提醒时间已过，跳过提醒任务添加`)
            return
          }

          taskQueue.addTask(alertAt, () => {
            try {
              console.log(`考试 "${exam.name}" 提醒任务执行`)
              NotifyPlugin.warning({
                title: '考试即将结束',
                content: `${exam.name} 将在 ${exam.alertTime} 分钟后结束`,
                placement: 'bottom-right',
                closeBtn: true
              })
              // TODO: 全屏提醒
            } catch (error) {
              console.error('考试提醒任务执行失败:', error)
            }
          })
          taskCount++
          console.log(`已添加考试提醒任务: ${exam.name} (${new Date(alertAt).toLocaleString()})`)
        }
      })

      console.log(`任务队列设置完成，共添加 ${taskCount} 个任务`)
      console.log(`任务队列中的任务数量:`, taskQueue.getTaskCount())
      console.log(`任务队列详情:`, taskQueue.getTaskDetails())

      // 如果没有任务被添加，给出明确的提示
      if (taskCount === 0) {
        console.warn('⚠️ 没有任务被添加到队列中！可能的原因：')
        console.warn('1. 所有考试都已结束')
        console.warn('2. 考试时间配置有误')
        console.warn('3. 时间同步问题')

        NotifyPlugin.warning({
          title: '提示',
          content: '当前时间段没有需要处理的考试任务',
          placement: 'bottom-right',
          closeBtn: true
        })
      }

      // 显示任务添加成功的通知
      if (taskCount > 0) {
        NotifyPlugin.success({
          title: '定时任务设置成功',
          content: `已设置 ${taskCount} 个定时任务，包括考试结束和提醒任务`,
          placement: 'bottom-right',
          closeBtn: true
        })
      }
}

// 切换到指定考试
const switchToExam = (index: number) => {
  if (configData.value?.examInfos && index >= 0 && index < configData.value.examInfos.length) {
    currentExamIndex.value = index
    nowExamInfo.value = configData.value.examInfos[index]
  }
}

// 计算当前考试状态
const examStatus = computed(() => {
  if (!nowExamInfo.value) return { status: 'unknown', message: '未知状态' }

  const now = getSyncedTime() // 使用同步后的时间
  const startTime = new Date(nowExamInfo.value.start).getTime()
  const endTime = new Date(nowExamInfo.value.end).getTime()

  if (now < startTime) {
    return {
      status: 'pending',
      message: `将于 ${new Date(startTime).toLocaleString()} 开始`
    }
  } else if (now >= startTime && now < endTime) {
    return {
      status: 'inProgress',
      message: `将于 ${new Date(endTime).toLocaleString()} 结束`
    }
  } else {
    return {
      status: 'completed',
      message: '已结束'
    }
  }
})

// 格式化时间为 HH:MM:SS
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

// 处理配置数据的通用函数
const handleConfigData = (data: string) => {
  console.log('Processing config data:', data)

  if (!data) {
    console.error('No config data received')
    NotifyPlugin.error({
      title: '考试档案数据错误',
      content: '未收到考试档案数据，请重新导入.exam.json文件',
      placement: 'bottom-right',
      closeBtn: true
    })
    return
  }

  try {
    // 使用新的配置加载器来处理数据
    smartLoad(data).then((config) => {
      console.log('Configuration loaded successfully via smartLoad')
      NotifyPlugin.success({
        title: '考试档案加载成功',
        content: `考试档案加载成功，包含 ${config.examInfos.length} 场考试，大屏准备就绪`,
        placement: 'bottom-right',
        closeBtn: true
      })

      // 设置当前考试和任务队列
      setupExamAndTasks(config)
    }).catch((error) => {
      console.error('Config loading failed:', error)
      NotifyPlugin.error({
        title: '配置处理失败',
        content: error.message || '配置数据处理失败',
        placement: 'bottom-right',
        closeBtn: true
      })
    })
  } catch (error) {
    console.error('Config processing error:', error)
    NotifyPlugin.error({
      title: '考试档案处理失败',
      content: '考试档案文件(.exam.json)处理时发生错误，请检查文件格式是否正确',
      placement: 'bottom-right',
      closeBtn: true
    })
  }
}

// 设置考试和任务队列的函数，增强错误处理
const setupExamAndTasks = (config: ExamConfig) => {
  try {
    console.log('开始设置考试和任务队列...', config)

    // === 严格验证：确保配置无任何问题 ===
    if (!validateExamConfig(config)) {
      throw new Error('配置基础验证失败')
    }

    // 时间重叠检查 - 严格模式
    if (hasExamTimeOverlap(config)) {
      throw new Error('配置包含时间重叠的考试，无法安全加载')
    }

    // 获取排序后的配置
    const sortedConfig = getSortedExamConfig(config)

    console.log('配置验证通过，使用排序后的考试信息:', sortedConfig.examInfos)

    // 智能定位当前考试：优先找正在进行的考试
    const now = getSyncedTime()
    let targetExamIndex = 0
    let foundCurrentExam = false

    console.log('开始智能定位当前考试，当前时间:', new Date(now).toLocaleString())

    // 第一步：寻找正在进行的考试
    for (let i = 0; i < sortedConfig.examInfos.length; i++) {
      const exam = sortedConfig.examInfos[i]
      const startTime = new Date(exam.start).getTime()
      const endTime = new Date(exam.end).getTime()

      console.log(`检查考试 "${exam.name}": 开始=${new Date(startTime).toLocaleString()}, 结束=${new Date(endTime).toLocaleString()}`)

      // 如果考试正在进行中
      if (now >= startTime && now < endTime) {
        targetExamIndex = i
        foundCurrentExam = true
        console.log(`找到正在进行的考试: "${exam.name}" (索引: ${i})`)
        break
      }
    }

    // 第二步：如果没有正在进行的考试，找最近的未开始考试
    if (!foundCurrentExam) {
      console.log('没有找到正在进行的考试，寻找最近的未开始考试...')
      for (let i = 0; i < sortedConfig.examInfos.length; i++) {
        const exam = sortedConfig.examInfos[i]
        const startTime = new Date(exam.start).getTime()

        // 如果考试还未开始
        if (now < startTime) {
          targetExamIndex = i
          foundCurrentExam = true
          console.log(`找到最近的未开始考试: "${exam.name}" (索引: ${i})`)
          break
        }
      }
    }

    // 第三步：如果所有考试都已结束，选择最后一场考试
    if (!foundCurrentExam) {
      targetExamIndex = sortedConfig.examInfos.length - 1
      console.log('所有考试已完成，显示最后一场考试')
    }

    // 设置当前考试
    currentExamIndex.value = targetExamIndex
    nowExamInfo.value = sortedConfig.examInfos[targetExamIndex]

    console.log(`最终设置当前考试: "${nowExamInfo.value?.name}" (索引: ${targetExamIndex})`)

    // 解析考试信息并创建任务 - 确保任务队列被正确填充
    console.log('开始创建定时任务队列...')
    parseExamInfosToTasks(sortedConfig.examInfos, sortedConfig)

  } catch (error) {
    console.error('设置考试和任务队列时出错:', error)
    NotifyPlugin.error({
      title: '配置加载失败',
      content: `${error instanceof Error ? error.message : String(error)}。请检查配置文件并重新导入。`,
      placement: 'bottom-right',
      closeBtn: true
    })
    // 清理状态，防止显示错误数据
    taskQueue.clear()
    nowExamInfo.value = undefined
    currentExamIndex.value = 0
  }
}

// 防止重复弹窗
let hasShownConfigSuccess = false
let hasShownTaskSuccess = false

function showConfigSuccess(config) {
  if (!hasShownConfigSuccess) {
    NotifyPlugin.success({
      title: '考试档案加载成功',
      content: `考试档案"${config.examName}"加载成功，包含 ${config.examInfos.length} 场考试，大屏准备就绪`,
      placement: 'bottom-right',
      duration: 4000,
      closeBtn: true
    })
    hasShownConfigSuccess = true
  }
}

function showTaskSuccess(taskCount) {
  if (!hasShownTaskSuccess && taskCount > 0) {
    NotifyPlugin.success({
      title: '定时任务设置成功',
      content: `已设置 ${taskCount} 个定时任务，包括考试结束和提醒任务`,
      placement: 'bottom-right',
      duration: 3000,
      closeBtn: true
    })
    hasShownTaskSuccess = true
  }
}

// 暴露到 window 对象用于调试
if (typeof window !== 'undefined') {
  (window as any).debugPlayerView = {
    get config() { return configData.value },
    get currentExam() { return nowExamInfo.value },
    get examIndex() { return currentExamIndex.value },
    get taskQueue() { return taskQueue },
    get taskCount() { return taskQueue.getTaskCount() },
    get taskDetails() { return taskQueue.getTaskDetails() },
    get syncStatus() { return syncStatus.value },
    get loading() { return loading.value },
    get source() { return configSource.value },
    get recentFiles() { return RecentFileManager.getRecentFiles() },
    reloadConfig: () => reloadConfig(),
    getCurrentConfig: () => configData.value,
    getLoadingState: () => loading.value,
    loadFromUrl: (url: string) => smartLoad(url),
    loadFromFile: (path: string) => smartLoad(path),
    loadDirect: (data: string) => smartLoad(data),
    clearRecentFiles: () => {
      RecentFileManager.clearRecentFiles()
      console.log('已清除最近文件列表')
    },
    // 任务队列调试方法
    clearTasks: () => {
      taskQueue.clear()
      console.log('已清空任务队列')
    },
    addTestTask: (delaySeconds: number = 5) => {
      const executeTime = getSyncedTime() + (delaySeconds * 1000)
      taskQueue.addTask(executeTime, () => {
        console.log(`测试任务执行: ${new Date().toLocaleString()}`)
        NotifyPlugin.info({
          title: '测试任务',
          content: '这是一个测试任务',
          placement: 'bottom-right'
        })
      })
      console.log(`已添加测试任务，将在 ${delaySeconds} 秒后执行`)
    },
    getConfigLoader: () => ({ configData, loading, configError, configSource })
  }
}

onMounted(async () => {
  console.log('PlayerView mounted, starting initialization...')

  // 检查 IPC 是否可用
  if (!ipcRenderer) {
    console.error('IPC renderer not available')
    NotifyPlugin.error({
      title: '系统通信错误',
      content: '无法与主程序通信，请重启应用程序',
      placement: 'bottom-right',
      closeBtn: true
    })
    return
  }

  console.log('IPC renderer available, setting up listeners...')

  // 执行时间同步
  performSyncAndUpdateStatus().catch(console.error)

  // 监听配置加载事件（兼容旧的加载方式）
  ipcRenderer.on('load-config', (_event, data) => {
    console.log('Received load-config event with data:', data)
    handleConfigData(data)
  })

  try {
    // 使用新的配置加载器从 IPC 加载配置
    console.log('Attempting to load config via new loader...')
    await loadFromIPC(30000) // 30秒超时
    console.log('Config loaded successfully via new loader!')

    // 配置加载成功后的处理
    if (configData.value) {
      console.log('开始处理加载的配置:', configData.value)

      // 记录到最近文件列表（如果有配置名称的话）
      if (configData.value.examName) {
        const configIdentifier = `${configData.value.examName}_${new Date().toISOString().split('T')[0]}`
        RecentFileManager.addRecentFile(configIdentifier)
        console.log('已添加到最近文件列表:', configIdentifier)
      }

      // 设置考试和任务
      setupExamAndTasks(configData.value)

      // 显示成功加载的通知
      showConfigSuccess(configData.value)
    } else {
      console.warn('配置加载器返回了空配置')
      NotifyPlugin.warning({
        title: '未找到考试档案',
        content: '未找到有效的考试档案文件(.exam.json)，请确保档案文件已正确拷贝到大屏设备',
        placement: 'bottom-right',
        closeBtn: true
      })
    }
  } catch (error) {
    console.error('Config loading failed:', error)
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    NotifyPlugin.error({
      title: '考试档案加载失败',
      content: `考试档案文件(.exam.json)加载失败：${errorMessage}。请检查文件是否损坏或格式是否正确。`,
      placement: 'bottom-right',
      closeBtn: true,
      duration: 15000
    })
  }
})

onUnmounted(() => {
  taskQueue.stop()
})

// 监听当前考试变化
watch(currentExamIndex, (newIndex) => {
  if (configData.value?.examInfos) {
    nowExamInfo.value = configData.value.examInfos[newIndex]
  }
})

// 当时间同步状态变化时，更新任务队列的时间函数
watch(syncStatus, () => {
  taskQueue.updateTimeFunction(getSyncedTime)
})

const performSyncAndUpdateStatus = async () => {
  try {
    await performSync()
    // 同步成功后，重新评估当前考试
    if (configData.value?.examInfos) {
      // 更新任务队列时间函数
      taskQueue.updateTimeFunction(getSyncedTime)
      // 找到当前时间最接近的考试
      updateCurrentExam()
      // 重新解析任务队列（parseExamInfosToTasks 内部会清理旧任务）
      parseExamInfosToTasks(configData.value.examInfos, configData.value)
    }
  } catch (error) {
    console.error('时间同步失败:', error)
    // 时间同步失败时的降级处理
    NotifyPlugin.warning({
      title: '时间同步失败',
      content: '将使用本地时间，考试时间可能不准确',
      placement: 'bottom-right',
      closeBtn: true
    })
  }
}

// 更新当前考试的辅助函数
const updateCurrentExam = () => {
  if (!configData.value?.examInfos) return

  const now = getSyncedTime()
  let closestExamIndex = 0
  let closestTimeDiff = Infinity
  let allExamsCompleted = true

  configData.value.examInfos.forEach((exam, index) => {
    const startTime = new Date(exam.start).getTime()
    const endTime = new Date(exam.end).getTime()

    // 如果有任何考试未结束，标记为不是所有考试都已完成
    if (now < endTime) {
      allExamsCompleted = false
    }

    // 如果考试正在进行
    if (now >= startTime && now < endTime) {
      closestExamIndex = index
      closestTimeDiff = 0 // 正在进行的考试优先级最高
    }
    // 如果考试即将开始且没有找到正在进行的考试
    else if (now < startTime && closestTimeDiff !== 0) {
      const timeDiff = Math.abs(startTime - now)
      if (timeDiff < closestTimeDiff) {
        closestTimeDiff = timeDiff
        closestExamIndex = index
      }
    }
  })

  // 如果所有考试都已结束，选择最后一场考试
  if (allExamsCompleted && configData.value.examInfos.length > 0) {
    closestExamIndex = configData.value.examInfos.length - 1
  }

  // 设置当前考试
  currentExamIndex.value = closestExamIndex
  nowExamInfo.value = configData.value.examInfos[closestExamIndex]
}

// // 监听当前时间变化，自动更新考试状态
// watch(currentTime, () => {
//   if (configData.value?.examInfos && !loading.value) {
//     // 定期检查当前的考试是否需要更新（例如当一场考试结束但任务未触发时）
//     // 为了避免过于频繁的更新，可以添加限流逻辑
//     if (currentTime.value % 30000 < 1000) {
//       // 大约每30秒检查一次
//       updateCurrentExam()
//     }
//   }
// })

const closeWindow = () => {
  DialogPlugin.confirm({
    header: '确认关闭',
    body: '确定要关闭当前放映窗口吗？',
    confirmBtn: '确认',
    cancelBtn: '取消',
    onConfirm: () => {
      // 直接关闭当前窗口
      window.close()
    }
  })
}

// 格式化考试数据用于表格显示
const formattedExamInfos = computed(() => {
  if (!configData.value?.examInfos) return [];

  return configData.value.examInfos.map((exam, index) => {
    const startDate = new Date(exam.start);
    const endDate = new Date(exam.end);
    const now = getSyncedTime();

    // 判断考试状态
    let status = 'pending';
    let statusText = '未开始';

    if (now > endDate.getTime()) {
      status = 'completed';
      statusText = '已结束';
    } else if (now >= startDate.getTime()) {
      status = 'inProgress';
      statusText = '进行中';
    }

    return {
      index,
      name: exam.name,
      date: startDate.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
      timeRange: `${formatHourMinute(startDate)} ~ ${formatHourMinute(endDate)}`,
      status,
      statusText,
      rawData: exam,
    };
  });
});

// 格式化时间为 HH:MM 格式
const formatHourMinute = (date: Date) => {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

// 获取状态对应的主题色
const getStatusTheme = (row) => {
  const statusThemeMap = {
    pending: 'primary',
    inProgress: 'success',
    completed: 'default'
  };
  return statusThemeMap[row.status] || 'default';
};
</script>

<template>
</template>

<style scoped>
</style>
