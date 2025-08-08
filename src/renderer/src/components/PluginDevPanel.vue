<template>
  <div class="plugin-dev-panel">
    <div class="dev-panel-header">
      <h3>插件开发环境</h3>
      <t-badge :count="devPlugins.length" :max-count="99">
        <t-icon name="code" size="20px" />
      </t-badge>
    </div>

    <div class="dev-status">
      <t-space align="center">
        <t-tag :theme="devServerRunning ? 'success' : 'default'" variant="light">
          <t-icon :name="devServerRunning ? 'check-circle' : 'time'" />
          {{ devServerRunning ? '开发服务器运行中' : '开发服务器未启动' }}
        </t-tag>
        <t-tag theme="primary" variant="light">
          监听目录: {{ devPluginsDir }}
        </t-tag>
      </t-space>
    </div>

    <div class="plugin-list" v-if="devPlugins.length > 0">
      <h4>开发中的插件</h4>
      <div class="plugin-grid">
        <div 
          v-for="plugin in devPlugins" 
          :key="plugin.name"
          class="plugin-card"
          :class="{ 'plugin-active': plugin.active, 'plugin-error': plugin.hasError }"
        >
          <div class="plugin-header">
            <div class="plugin-info">
              <h5>{{ plugin.name }}</h5>
              <p class="plugin-version">v{{ plugin.version }}</p>
            </div>
            <div class="plugin-status">
              <t-tag 
                :theme="plugin.active ? 'success' : plugin.hasError ? 'danger' : 'default'"
                size="small"
                variant="light"
              >
                {{ plugin.active ? '已激活' : plugin.hasError ? '错误' : '未激活' }}
              </t-tag>
            </div>
          </div>
          
          <p class="plugin-description">{{ plugin.description }}</p>
          
          <div class="plugin-actions">
            <t-button 
              size="small" 
              variant="text" 
              @click="reloadPlugin(plugin.name)"
              :loading="plugin.reloading"
            >
              <t-icon name="refresh" />
              重载
            </t-button>
            <t-button 
              size="small" 
              variant="text" 
              theme="primary"
              @click="openPluginDir(plugin.name)"
            >
              <t-icon name="folder-open" />
              打开目录
            </t-button>
          </div>
          
          <div class="plugin-logs" v-if="plugin.logs.length > 0">
            <t-collapse>
              <t-collapse-panel header="日志" :value="`logs-${plugin.name}`">
                <div class="log-list">
                  <div 
                    v-for="(log, index) in plugin.logs.slice(-5)" 
                    :key="index"
                    class="log-item"
                    :class="`log-${log.level}`"
                  >
                    <span class="log-time">{{ formatTime(log.time) }}</span>
                    <span class="log-message">{{ log.message }}</span>
                  </div>
                </div>
              </t-collapse-panel>
            </t-collapse>
          </div>
        </div>
      </div>
    </div>

    <div class="empty-state" v-else>
      <t-empty description="暂无开发中的插件">
        <template #image>
          <t-icon name="code" size="48px" />
        </template>
        <template #action>
          <t-button theme="primary" @click="createNewPlugin">
            <t-icon name="add" />
            创建新插件
          </t-button>
        </template>
      </t-empty>
    </div>

    <!-- 创建插件对话框 -->
    <t-dialog 
      v-model:visible="showCreateDialog"
      header="创建新插件"
      width="500px"
      @confirm="handleCreatePlugin"
    >
      <t-form ref="createForm" :data="newPluginForm" :rules="formRules">
        <t-form-item label="插件名称" name="name">
          <t-input v-model="newPluginForm.name" placeholder="请输入插件名称" />
        </t-form-item>
        <t-form-item label="显示名称" name="displayName">
          <t-input v-model="newPluginForm.displayName" placeholder="请输入显示名称" />
        </t-form-item>
        <t-form-item label="描述" name="description">
          <t-textarea v-model="newPluginForm.description" placeholder="请输入插件描述" />
        </t-form-item>
        <t-form-item label="作者" name="author">
          <t-input v-model="newPluginForm.author" placeholder="请输入作者名称" />
        </t-form-item>
        <t-form-item label="插件类型">
          <t-checkbox-group v-model="newPluginForm.types">
            <t-checkbox value="main">主进程插件</t-checkbox>
            <t-checkbox value="renderer">渲染进程插件</t-checkbox>
          </t-checkbox-group>
        </t-form-item>
        <t-form-item label="权限">
          <t-select 
            v-model="newPluginForm.permissions" 
            multiple 
            placeholder="选择插件权限"
          >
            <t-option value="ipc" label="IPC通信" />
            <t-option value="window-management" label="窗口管理" />
            <t-option value="notification" label="通知" />
            <t-option value="file-system" label="文件系统" />
            <t-option value="component" label="组件注册" />
          </t-select>
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { MessagePlugin } from 'tdesign-vue-next'

interface DevPlugin {
  name: string
  version: string
  description: string
  active: boolean
  hasError: boolean
  reloading: boolean
  logs: Array<{
    level: 'info' | 'warn' | 'error'
    message: string
    time: number
  }>
}

interface NewPluginForm {
  name: string
  displayName: string
  description: string
  author: string
  types: string[]
  permissions: string[]
}

const devPlugins = ref<DevPlugin[]>([])
const devServerRunning = ref(false)
const devPluginsDir = ref('')
const showCreateDialog = ref(false)

const newPluginForm = reactive<NewPluginForm>({
  name: '',
  displayName: '',
  description: '',
  author: '',
  types: ['renderer'],
  permissions: ['ipc']
})

const formRules = {
  name: [{ required: true, message: '请输入插件名称' }],
  displayName: [{ required: true, message: '请输入显示名称' }],
  description: [{ required: true, message: '请输入插件描述' }],
  author: [{ required: true, message: '请输入作者名称' }]
}

const createForm = ref()

// 监听插件开发服务器事件
const handleDevServerEvent = (event: any, data: any) => {
  const { event: eventType, data: eventData } = data
  
  switch (eventType) {
    case 'plugin-reloaded':
      handlePluginReloaded(eventData)
      break
    case 'plugin-reload-error':
      handlePluginReloadError(eventData)
      break
    case 'plugin-loaded':
      handlePluginLoaded(eventData)
      break
    case 'plugin-unloaded':
      handlePluginUnloaded(eventData)
      break
  }
}

const handlePluginReloaded = (data: any) => {
  const plugin = devPlugins.value.find(p => p.name === data.pluginName)
  if (plugin) {
    plugin.reloading = false
    plugin.hasError = false
    plugin.active = true
    plugin.logs.push({
      level: 'info',
      message: `插件重载成功 (${data.event}: ${data.filePath})`,
      time: Date.now()
    })
  }
  MessagePlugin.success(`插件 ${data.pluginName} 重载成功`)
}

const handlePluginReloadError = (data: any) => {
  const plugin = devPlugins.value.find(p => p.name === data.pluginName)
  if (plugin) {
    plugin.reloading = false
    plugin.hasError = true
    plugin.active = false
    plugin.logs.push({
      level: 'error',
      message: `插件重载失败: ${data.error}`,
      time: Date.now()
    })
  }
  MessagePlugin.error(`插件 ${data.pluginName} 重载失败: ${data.error}`)
}

const handlePluginLoaded = (data: any) => {
  const existingPlugin = devPlugins.value.find(p => p.name === data.pluginName)
  if (!existingPlugin) {
    devPlugins.value.push({
      name: data.pluginName,
      version: data.version || '1.0.0',
      description: data.description || '开发中的插件',
      active: true,
      hasError: false,
      reloading: false,
      logs: [{
        level: 'info',
        message: '插件已加载',
        time: Date.now()
      }]
    })
  }
}

const handlePluginUnloaded = (data: any) => {
  const pluginIndex = devPlugins.value.findIndex(p => p.name === data.pluginName)
  if (pluginIndex !== -1) {
    devPlugins.value[pluginIndex].active = false
    devPlugins.value[pluginIndex].logs.push({
      level: 'info',
      message: '插件已卸载',
      time: Date.now()
    })
  }
}

const reloadPlugin = async (pluginName: string) => {
  const plugin = devPlugins.value.find(p => p.name === pluginName)
  if (plugin) {
    plugin.reloading = true
    try {
      // 触发插件重载（通过修改插件文件的时间戳）
      await window.api.plugins.touchPlugin(pluginName)
    } catch (error) {
      plugin.reloading = false
      MessagePlugin.error(`重载插件失败: ${error}`)
    }
  }
}

const openPluginDir = async (pluginName: string) => {
  try {
    await window.api.plugins.openPluginDirectory(pluginName)
  } catch (error) {
    MessagePlugin.error(`打开插件目录失败: ${error}`)
  }
}

const createNewPlugin = () => {
  showCreateDialog.value = true
}

const handleCreatePlugin = async () => {
  try {
    await createForm.value.validate()
    
    const success = await window.api.plugins.createPluginTemplate(newPluginForm.name, {
      name: newPluginForm.displayName,
      description: newPluginForm.description,
      author: newPluginForm.author,
      hasMain: newPluginForm.types.includes('main'),
      hasRenderer: newPluginForm.types.includes('renderer'),
      permissions: newPluginForm.permissions
    })
    
    if (success) {
      MessagePlugin.success('插件模板创建成功！')
      showCreateDialog.value = false
      // 重置表单
      Object.assign(newPluginForm, {
        name: '',
        displayName: '',
        description: '',
        author: '',
        types: ['renderer'],
        permissions: ['ipc']
      })
      // 刷新插件列表
      await loadDevPlugins()
    } else {
      MessagePlugin.error('插件模板创建失败')
    }
  } catch (error) {
    console.error('Create plugin error:', error)
  }
}

const loadDevPlugins = async () => {
  try {
    const plugins = await window.api.plugins.getDevPlugins()
    devPlugins.value = plugins.map((plugin: any) => ({
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      active: plugin.active,
      hasError: false,
      reloading: false,
      logs: []
    }))
  } catch (error) {
    console.error('Failed to load dev plugins:', error)
  }
}

const loadDevServerStatus = async () => {
  try {
    const status = await window.api.plugins.getDevServerStatus()
    devServerRunning.value = status.running
    devPluginsDir.value = status.pluginsDir
  } catch (error) {
    console.error('Failed to load dev server status:', error)
  }
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString()
}

onMounted(async () => {
  // 加载开发插件列表
  await loadDevPlugins()
  await loadDevServerStatus()
  
  // 监听插件开发服务器事件
  window.api.ipc.on('plugin-dev-server', handleDevServerEvent)
})

onUnmounted(() => {
  // 清理事件监听
  window.api.ipc.off('plugin-dev-server', handleDevServerEvent)
})
</script>

<style scoped>
.plugin-dev-panel {
  padding: 16px;
  background: var(--td-bg-color-container);
  border-radius: 8px;
  margin-bottom: 16px;
}

.dev-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.dev-panel-header h3 {
  margin: 0;
  color: var(--td-text-color-primary);
}

.dev-status {
  margin-bottom: 20px;
}

.plugin-list h4 {
  margin: 0 0 12px 0;
  color: var(--td-text-color-primary);
}

.plugin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.plugin-card {
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  padding: 16px;
  background: var(--td-bg-color-container);
  transition: all 0.2s ease;
}

.plugin-card:hover {
  border-color: var(--td-brand-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.plugin-card.plugin-active {
  border-color: var(--td-success-color);
}

.plugin-card.plugin-error {
  border-color: var(--td-error-color);
}

.plugin-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.plugin-info h5 {
  margin: 0 0 4px 0;
  color: var(--td-text-color-primary);
  font-size: 16px;
}

.plugin-version {
  margin: 0;
  color: var(--td-text-color-secondary);
  font-size: 12px;
}

.plugin-description {
  color: var(--td-text-color-secondary);
  font-size: 14px;
  margin: 8px 0 12px 0;
  line-height: 1.4;
}

.plugin-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.plugin-logs {
  margin-top: 12px;
}

.log-list {
  max-height: 200px;
  overflow-y: auto;
}

.log-item {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
  border-bottom: 1px solid var(--td-border-level-2-color);
}

.log-item:last-child {
  border-bottom: none;
}

.log-time {
  color: var(--td-text-color-placeholder);
  white-space: nowrap;
}

.log-message {
  flex: 1;
  word-break: break-all;
}

.log-info .log-message {
  color: var(--td-text-color-secondary);
}

.log-warn .log-message {
  color: var(--td-warning-color);
}

.log-error .log-message {
  color: var(--td-error-color);
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}
</style>