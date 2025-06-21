<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { TaskQueue } from '@renderer/core/taskQueue'
import { getSortedExamConfig } from '@renderer/core/parser'
import type { ExamConfig, ExamInfo } from '@renderer/core/configTypes'
import { NotifyPlugin, DialogPlugin, Dialog } from 'tdesign-vue-next'
import { useTimeSync, getSyncedTime } from '@renderer/utils/timeUtils'
const { ipcRenderer } = window.electron
import CurrentExamCard from '@renderer/components/CurrentExamCard.vue'

const configData = ref<ExamConfig>()
const loading = ref(true) // 添加加载状态
const taskQueue = new TaskQueue(getSyncedTime) // 使用同步时间函数
const nowExamInfo = ref<ExamInfo>()
const currentExamIndex = ref(0)
const { currentTime, syncStatus, performSync } = useTimeSync()

// 解析考试信息并添加到任务队列
const parseExamInfosToTasks = (examInfos: ExamInfo[]) => {
  if (!examInfos || examInfos.length === 0) return

  // 设置当前考试为第一场
  nowExamInfo.value = examInfos[0]
  currentExamIndex.value = 0

  // 为每场考试添加结束任务，自动切换到下一场
  examInfos.forEach((exam, index) => {
    const endTime = new Date(exam.end).getTime()
    const now = getSyncedTime() // 获取当前同步时间

    // 如果考试已经结束，跳过任务添加
    if (now >= endTime) {
      return
    }

    // 考试结束时的任务
    taskQueue.addTask(endTime, () => {
      console.log(`考试 "${exam.name}" 已结束`)
      NotifyPlugin.info({
        title: '考试结束',
        content: `${exam.name} 已结束`,
        placement: 'bottom-right',
        closeBtn: true
      })

      // 如果有下一场考试，自动切换
      if (index < examInfos.length - 1) {
        currentExamIndex.value = index + 1
        nowExamInfo.value = examInfos[index + 1]
        NotifyPlugin.info({
          title: '已切换到下一场考试',
          content: `当前考试: ${examInfos[index + 1].name}`,
          placement: 'bottom-right',
          closeBtn: true
        })
      }
    })

    // 考试提前提醒任务
    if (exam.alertTime > 0) {
      const alertTimeMs = exam.alertTime * 60 * 1000 // 转换为毫秒
      const alertAt = endTime - alertTimeMs

      // 如果提醒时间已经过去，跳过任务添加
      if (now >= alertAt) {
        return
      }

      taskQueue.addTask(alertAt, () => {
        NotifyPlugin.warning({
          title: '考试即将结束',
          content: `${exam.name} 将在 ${exam.alertTime} 分钟后结束`,
          placement: 'bottom-right',
          closeBtn: true
        })
      })
    }
  })
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

onMounted(() => {
  performSyncAndUpdateStatus().catch(console.error) // 执行时间同步

  ipcRenderer.on('load-config', (event, data) => {
    const readedConfigData = JSON.parse(data)
    console.log('Config data loaded:', readedConfigData)

    try {
      const parsed = getSortedExamConfig(readedConfigData as ExamConfig)
      if (parsed) {
        console.log('Parsed config:', parsed)
        configData.value = parsed

        // 找到当前时间最接近的考试
        const now = getSyncedTime()
        let closestExamIndex = 0
        let closestTimeDiff = Infinity

        parsed.examInfos.forEach((exam, index) => {
          const startTime = new Date(exam.start).getTime()
          const endTime = new Date(exam.end).getTime()

          // 如果考试正在进行或即将开始
          if (now < endTime) {
            const timeDiff = Math.abs(startTime - now)
            if (timeDiff < closestTimeDiff) {
              closestTimeDiff = timeDiff
              closestExamIndex = index
            }
          }
        })

        // 设置当前考试
        currentExamIndex.value = closestExamIndex
        nowExamInfo.value = parsed.examInfos[closestExamIndex]

        // 解析考试信息并创建任务
        parseExamInfosToTasks(parsed.examInfos)
      } else {
        console.error('Failed to parse config')
      }
    } catch (error) {
      NotifyPlugin.error({
        title: '配置解析失败',
        content: '请检查配置文件的格式和内容',
        placement: 'bottom-right',
        closeBtn: true
      })
    }

    // 数据加载完成
    loading.value = false
  })
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
      // 重新解析任务队列
      taskQueue.stop() // 清除现有任务
      parseExamInfosToTasks(configData.value.examInfos)
    }
  } catch (error) {
    console.error('时间同步失败:', error)
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

// 获取行的类名，用于高亮当前考试
const getRowClassName = ({ row, rowIndex }) => {
  return row.index === currentExamIndex.value ? 'current-exam-row' : '';
};

// 处理行点击事件
const handleRowClick = ({ row }) => {
  switchToExam(row.index);
};

</script>

<template>
</template>

<style scoped>
</style>
