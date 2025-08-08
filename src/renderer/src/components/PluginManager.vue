<template>
  <div class="plugin-manager">
    <div class="plugin-manager-header">
      <h2>插件管理</h2>
      <div class="header-actions">
        <t-button theme="primary" @click="installPlugin">
          <template #icon><AddIcon /></template>
          安装插件
        </t-button>
        <t-button @click="refreshPlugins">
          <template #icon><RefreshIcon /></template>
          刷新
        </t-button>
      </div>
    </div>

    <div class="plugin-list">
      <div v-if="loading" class="loading">
        <t-loading size="large" text="加载中..." />
      </div>
      
      <div v-else-if="plugins.length === 0" class="empty-state">
        <div class="empty-icon">
          <SettingIcon size="48" />
        </div>
        <p>暂无已安装的插件</p>
        <t-button theme="primary" @click="installPlugin">
          安装第一个插件
        </t-button>
      </div>
      
      <div v-else class="plugin-grid">
        <div
          v-for="plugin in plugins"
          :key="plugin.metadata.name"
          class="plugin-card"
          :class="{
            active: plugin.status === PluginStatus.ACTIVE,
            error: plugin.status === PluginStatus.ERROR
          }"
        >
          <div class="plugin-header">
            <div class="plugin-info">
              <h3>{{ plugin.metadata?.name || '未知插件' }}</h3>
              <p class="plugin-version">v{{ plugin.metadata?.version || '0.0.0' }}</p>
            </div>
            <div class="plugin-status">
              <t-tag
                :theme="getStatusTheme(plugin.status)"
                :icon="getStatusIcon(plugin.status)"
              >
                {{ getStatusText(plugin.status) }}
              </t-tag>
            </div>
          </div>
          
          <div class="plugin-description">
            <p>{{ plugin.metadata?.description || '暂无描述' }}</p>
            <p class="plugin-author">作者: {{ plugin.metadata?.author || '未知' }}</p>
          </div>
          
          <div v-if="plugin.error" class="plugin-error">
            <t-alert theme="error" :message="plugin.error" />
          </div>
          
          <div class="plugin-features">
            <div class="feature-tags">
              <t-tag v-if="plugin.metadata?.main" size="small" variant="light">
                主进程
              </t-tag>
              <t-tag v-if="plugin.metadata?.renderer" size="small" variant="light">
                渲染进程
              </t-tag>
              <t-tag
                v-for="permission in plugin.metadata?.permissions || []"
                :key="permission"
                size="small"
                variant="outline"
              >
                {{ getPermissionText(permission) }}
              </t-tag>
            </div>
          </div>
          
          <div class="plugin-actions">
            <t-button
              v-if="plugin.status === PluginStatus.ACTIVE"
              theme="warning"
              variant="outline"
              size="small"
              @click="deactivatePlugin(plugin.metadata.name)"
              :loading="actionLoading[plugin.metadata.name]"
            >
              停用
            </t-button>
            <t-button
              v-else
              theme="primary"
              variant="outline"
              size="small"
              @click="activatePlugin(plugin.metadata.name)"
              :loading="actionLoading[plugin.metadata.name]"
            >
              启用
            </t-button>
            
            <t-button
              theme="default"
              variant="outline"
              size="small"
              @click="showPluginSettings(plugin)"
            >
              设置
            </t-button>
            
            <t-button
              theme="danger"
              variant="outline"
              size="small"
              @click="confirmUninstall(plugin)"
              :loading="actionLoading[plugin.metadata.name]"
            >
              卸载
            </t-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 插件设置对话框 -->
    <t-dialog
      v-model:visible="settingsDialogVisible"
      :header="`${currentPlugin?.manifest?.name || currentPlugin?.id || '未知插件'} 设置`"
      width="600px"
      @confirm="savePluginSettings"
    >
      <div v-if="currentPlugin" class="plugin-settings">
        <t-form :data="pluginSettings" label-width="120px">
          <t-form-item label="启用状态">
            <t-switch
              v-model="pluginSettings.enabled"
              :disabled="currentPlugin.status === 'activating' || currentPlugin.status === 'deactivating'"
            />
          </t-form-item>
          
          <t-form-item label="自定义设置">
            <t-textarea
              v-model="settingsJson"
              placeholder="请输入JSON格式的设置"
              :rows="8"
              @blur="validateSettings"
            />
            <div v-if="settingsError" class="settings-error">
              <t-alert theme="error" :message="settingsError" />
            </div>
          </t-form-item>
        </t-form>
      </div>
    </t-dialog>

    <!-- 卸载确认对话框 -->
    <t-dialog
      v-model:visible="uninstallDialogVisible"
      header="确认卸载"
      @confirm="uninstallPlugin"
    >
      <p>确定要卸载插件 "{{ pluginToUninstall?.manifest?.name || pluginToUninstall?.id || '未知插件' }}" 吗？</p>
      <p class="warning-text">此操作将删除插件的所有文件和设置，且无法撤销。</p>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import {
  AddIcon,
  RefreshIcon,
  SettingIcon,
  CheckCircleIcon,
  CloseCircleIcon,
  TimeIcon,
  ErrorCircleIcon
} from 'tdesign-icons-vue-next'
import { MessagePlugin } from 'tdesign-vue-next'
import { rendererPluginManager } from '../plugins/RendererPluginManager'
import type { PluginInfo, PluginConfig } from '../plugins/types'
import { PluginStatus, PluginPermission } from '../plugins/types'

const plugins = ref<PluginInfo[]>([])
const loading = ref(false)
const actionLoading = reactive<Record<string, boolean>>({})

// 设置对话框
const settingsDialogVisible = ref(false)
const currentPlugin = ref<PluginInfo | null>(null)
const pluginSettings = reactive<PluginConfig>({
  enabled: false,
  settings: {}
})
const settingsJson = ref('')
const settingsError = ref('')

// 卸载对话框
const uninstallDialogVisible = ref(false)
const pluginToUninstall = ref<PluginInfo | null>(null)

// 加载插件列表
const loadPlugins = async () => {
  loading.value = true
  try {
    plugins.value = await rendererPluginManager.getAllPlugins()
  } catch (error) {
    console.error('Failed to load plugins:', error)
    MessagePlugin.error('加载插件列表失败')
  } finally {
    loading.value = false
  }
}

// 刷新插件列表
const refreshPlugins = async () => {
  await loadPlugins()
  MessagePlugin.success('插件列表已刷新')
}

// 安装插件
const installPlugin = async () => {
  try {
    const success = await rendererPluginManager.installPlugin()
    if (success) {
      MessagePlugin.success('插件安装成功')
      await loadPlugins()
    }
  } catch (error) {
    console.error('Failed to install plugin:', error)
    MessagePlugin.error('插件安装失败')
  }
}

// 激活插件
const activatePlugin = async (pluginName: string) => {
  actionLoading[pluginName] = true
  try {
    const success = await rendererPluginManager.activatePlugin(pluginName)
    if (success) {
      MessagePlugin.success(`插件 "${pluginName}" 已启用`)
      await loadPlugins()
    } else {
      MessagePlugin.error(`插件 "${pluginName}" 启用失败`)
    }
  } catch (error) {
    console.error('Failed to activate plugin:', error)
    MessagePlugin.error('插件启用失败')
  } finally {
    actionLoading[pluginName] = false
  }
}

// 停用插件
const deactivatePlugin = async (pluginName: string) => {
  actionLoading[pluginName] = true
  try {
    const success = await rendererPluginManager.deactivatePlugin(pluginName)
    if (success) {
      MessagePlugin.success(`插件 "${pluginName}" 已停用`)
      await loadPlugins()
    } else {
      MessagePlugin.error(`插件 "${pluginName}" 停用失败`)
    }
  } catch (error) {
    console.error('Failed to deactivate plugin:', error)
    MessagePlugin.error('插件停用失败')
  } finally {
    actionLoading[pluginName] = false
  }
}

// 显示插件设置
const showPluginSettings = (plugin: PluginInfo) => {
  currentPlugin.value = plugin
  pluginSettings.enabled = plugin.config.enabled || false
  pluginSettings.settings = { ...plugin.config.settings || {} }
  settingsJson.value = JSON.stringify(plugin.config.settings || {}, null, 2)
  settingsError.value = ''
  settingsDialogVisible.value = true
}

// 验证设置JSON
const validateSettings = () => {
  try {
    const parsed = JSON.parse(settingsJson.value)
    pluginSettings.settings = parsed
    settingsError.value = ''
  } catch (error) {
    settingsError.value = 'JSON格式错误'
  }
}

// 保存插件设置
const savePluginSettings = async () => {
  if (!currentPlugin.value) return
  
  if (settingsError.value) {
    MessagePlugin.error('请修正设置中的错误')
    return
  }
  
  try {
    validateSettings()
    const success = await rendererPluginManager.updatePluginConfig(
      currentPlugin.value.id,
      pluginSettings
    )
    
    if (success) {
      MessagePlugin.success('设置已保存')
      settingsDialogVisible.value = false
      await loadPlugins()
    } else {
      MessagePlugin.error('设置保存失败')
    }
  } catch (error) {
    console.error('Failed to save plugin settings:', error)
    MessagePlugin.error('设置保存失败')
  }
}

// 确认卸载
const confirmUninstall = (plugin: PluginInfo) => {
  pluginToUninstall.value = plugin
  uninstallDialogVisible.value = true
}

// 卸载插件
const uninstallPlugin = async () => {
  if (!pluginToUninstall.value) return
  
  const pluginName = pluginToUninstall.value.id
  actionLoading[pluginName] = true
  
  try {
    const success = await rendererPluginManager.uninstallPlugin(pluginName)
    if (success) {
      MessagePlugin.success(`插件 "${pluginName}" 已卸载`)
      uninstallDialogVisible.value = false
      await loadPlugins()
    } else {
      MessagePlugin.error(`插件 "${pluginName}" 卸载失败`)
    }
  } catch (error) {
    console.error('Failed to uninstall plugin:', error)
    MessagePlugin.error('插件卸载失败')
  } finally {
    actionLoading[pluginName] = false
  }
}

// 获取状态主题
const getStatusTheme = (status: PluginStatus) => {
  switch (status) {
    case PluginStatus.ACTIVE: return 'success'
    case PluginStatus.ERROR: return 'danger'
    case PluginStatus.LOADING: return 'warning'
    default: return 'default'
  }
}

// 获取状态图标
const getStatusIcon = (status: PluginStatus) => {
  switch (status) {
    case PluginStatus.ACTIVE: return CheckCircleIcon
    case PluginStatus.ERROR: return ErrorCircleIcon
    case PluginStatus.LOADING: return TimeIcon
    default: return CloseCircleIcon
  }
}

// 获取状态文本
const getStatusText = (status: PluginStatus) => {
  switch (status) {
    case PluginStatus.ACTIVE: return '已启用'
    case PluginStatus.INACTIVE: return '未启用'
    case PluginStatus.LOADING: return '加载中'
    case PluginStatus.ERROR: return '错误'
    default: return '未知'
  }
}

// 获取权限文本
const getPermissionText = (permission: string) => {
  const permissionMap: Record<string, string> = {
    'ipc': 'IPC通信',
    'window-management': '窗口管理',
    'file-system': '文件系统',
    'notification': '通知',
    'menu': '菜单管理',
    'router': '路由管理',
    'component': '组件管理',
    'store': '状态管理',
    'ui-extension': 'UI扩展'
  }
  return permissionMap[permission] || permission
}

onMounted(() => {
  loadPlugins()
})
</script>

<style scoped>
.plugin-manager {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
}

.plugin-manager-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.plugin-manager-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-state p {
  margin-bottom: 24px;
  color: var(--td-text-color-secondary);
}

.plugin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.plugin-card {
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  padding: 20px;
  background: var(--td-bg-color-container);
  transition: all 0.2s ease;
}

.plugin-card:hover {
  border-color: var(--td-brand-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.plugin-card.active {
  border-color: var(--td-success-color);
}

.plugin-card.error {
  border-color: var(--td-error-color);
}

.plugin-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.plugin-info h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
}

.plugin-version {
  margin: 0;
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.plugin-description {
  margin-bottom: 16px;
}

.plugin-description p {
  margin: 0 0 8px 0;
  line-height: 1.5;
}

.plugin-author {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}

.plugin-error {
  margin-bottom: 16px;
}

.plugin-features {
  margin-bottom: 16px;
}

.feature-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.plugin-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.plugin-settings {
  padding: 16px 0;
}

.settings-error {
  margin-top: 8px;
}

.warning-text {
  color: var(--td-warning-color);
  font-size: 14px;
  margin-top: 8px;
}
</style>