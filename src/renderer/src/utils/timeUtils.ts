import { ref, onMounted, onUnmounted } from 'vue'

const { ipcRenderer } = window.electron

// 缓存上次同步信息
let lastSyncInfo = {
  offset: 0,
  manualOffset: 0,
  lastSyncTime: 0
}

// 获取同步后的当前时间
export function getSyncedTime(): number {
  // 如果未连接到主进程或者没有进行过同步，则使用本地时间
  if (!lastSyncInfo.lastSyncTime) {
    return Date.now()
  }

  // 应用偏移计算时间
  return Date.now() + lastSyncInfo.offset + lastSyncInfo.manualOffset
}

// 获取时间同步状态
export async function getTimeSyncInfo() {
  try {
    const info = await ipcRenderer.invoke('time:get-sync-info')
    lastSyncInfo = info
    return info
  } catch (error) {
    console.error('获取时间同步信息失败:', error)
    return null
  }
}

// 执行时间同步
export async function syncTime() {
  try {
    const result = await ipcRenderer.invoke('time:sync-now')
    lastSyncInfo = result
    return result
  } catch (error) {
    console.error('时间同步失败:', error)
    throw error
  }
}

// 更新时间同步配置
export async function updateTimeSyncConfig(config) {
  try {
    return await ipcRenderer.invoke('time:update-config', config)
  } catch (error) {
    console.error('更新时间同步配置失败:', error)
    throw error
  }
}

// 组合式函数，提供响应式的时间同步状态
export function useTimeSync() {
  const syncInfo = ref()
  const syncStatus = ref('pending')
  const isLoading = ref(false)
  const currentTime = ref(getSyncedTime())
  let intervalId: NodeJS.Timeout | null = null

  // 加载同步信息
  const loadSyncInfo = async () => {
    try {
      isLoading.value = true
      syncInfo.value = await getTimeSyncInfo()
      syncStatus.value = syncInfo.value?.syncStatus || 'pending'
    } catch (error) {
      syncStatus.value = 'error'
    } finally {
      isLoading.value = false
    }
  }

  // 执行同步
  const performSync = async () => {
    try {
      isLoading.value = true
      syncStatus.value = 'pending'
      syncInfo.value = await syncTime()
      syncStatus.value = 'success'
    } catch (error: unknown) {
      // 明确声明 error 类型为 unknown
      if (error instanceof Error) {
        // 检查 error 是否为 Error 实例
        syncStatus.value = 'error'
        syncInfo.value = { ...syncInfo.value, errorMessage: error.message } // 安全访问 message
      } else {
        syncStatus.value = 'error'
        syncInfo.value = { ...syncInfo.value, errorMessage: '未知错误' } // 处理非 Error 类型的错误
      }
    } finally {
      isLoading.value = false
    }
  }

  // 更新配置
  const updateConfig = async (config) => {
    try {
      isLoading.value = true
      const result = await updateTimeSyncConfig(config)
      syncInfo.value = await getTimeSyncInfo()
      return result
    } catch (error) {
      throw error
    } finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    // 加载初始同步信息
    loadSyncInfo()

    // 设置定时器更新当前时间
    intervalId = setInterval(() => {
      currentTime.value = getSyncedTime()
    }, 1000)
  })

  onUnmounted(() => {
    if (intervalId !== null) {
      clearInterval(intervalId) // 修复：确保 intervalId 不为空时才清除定时器
    }
  })

  return {
    syncInfo,
    syncStatus,
    isLoading,
    currentTime,
    loadSyncInfo,
    performSync,
    updateConfig,
    getSyncedTime
  }
}
