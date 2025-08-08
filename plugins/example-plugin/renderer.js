/**
 * ExamAware 示例插件 - 渲染进程
 * 展示如何在渲染进程中实现插件功能
 */

class ExampleRendererPlugin {
  constructor() {
    this.metadata = {
      name: 'example-plugin',
      version: '1.0.0'
    }
    this.context = null
    this.components = new Map()
    this.routes = []
  }

  /**
   * 插件激活时调用
   * @param {Object} context - 插件上下文
   */
  async activate(context) {
    console.log('Example plugin (renderer) activated')
    this.context = context
    window.pluginContext = context
    
    // 注册Vue组件
    this.registerComponents()
    
    // 添加路由
    this.addRoutes()
    
    // 添加UI扩展
    this.addUIExtensions()
    
    // 设置事件监听器
    this.setupEventListeners()
    
    // 初始化插件状态
    await this.initialize()
  }

  /**
   * 插件停用时调用
   */
  async deactivate() {
    console.log('Example plugin (renderer) deactivated')
    
    // 清理资源
    this.cleanup()
  }

  /**
   * 注册Vue组件
   */
  registerComponents() {
    // 示例组件 - 插件信息卡片
    const ExampleInfoCard = {
      name: 'ExampleInfoCard',
      template: `
        <div class="example-info-card">
          <div class="card-header">
            <h3>🔌 示例插件</h3>
            <span class="version">v{{ version }}</span>
          </div>
          <div class="card-content">
            <p>{{ welcomeMessage }}</p>
            <div class="actions">
              <button @click="getSystemInfo" class="btn btn-primary">
                获取系统信息
              </button>
              <button @click="createWindow" class="btn btn-secondary">
                创建窗口
              </button>
              <button @click="showNotification" class="btn btn-success">
                显示通知
              </button>
            </div>
          </div>
          <div v-if="systemInfo" class="system-info">
            <h4>系统信息</h4>
            <ul>
              <li><strong>平台:</strong> {{ systemInfo.platform }}</li>
              <li><strong>架构:</strong> {{ systemInfo.arch }}</li>
              <li><strong>Node.js:</strong> {{ systemInfo.nodeVersion }}</li>
              <li><strong>Electron:</strong> {{ systemInfo.electronVersion }}</li>
            </ul>
          </div>
        </div>
      `,
      data() {
        return {
          version: '1.0.0',
          welcomeMessage: '欢迎使用示例插件！',
          systemInfo: null
        }
      },
      methods: {
        async getSystemInfo() {
          try {
            this.systemInfo = await window.pluginContext.ipc.invoke('get-system-info')
          } catch (error) {
            console.error('Failed to get system info:', error)
            window.pluginContext.ui.showNotification('获取系统信息失败', 'error')
          }
        },
        async createWindow() {
          try {
            const windowId = await window.pluginContext.ipc.invoke('create-window', {
              title: '示例插件窗口',
              width: 600,
              height: 400
            })
            if (windowId) {
              window.pluginContext.ui.showNotification('窗口创建成功', 'success')
            } else {
              window.pluginContext.ui.showNotification('窗口创建失败', 'error')
            }
          } catch (error) {
            console.error('Failed to create window:', error)
            window.pluginContext.ui.showNotification('窗口创建失败', 'error')
          }
        },
        showNotification() {
          window.pluginContext.ui.showNotification('这是来自示例插件的通知！', 'info')
        }
      },
      async mounted() {
        try {
          const info = await window.pluginContext.ipc.invoke('get-info')
          this.version = info.version
          this.welcomeMessage = info.settings.welcomeMessage
        } catch (error) {
          console.error('Failed to get plugin info:', error)
        }
      }
    }
    
    // 示例组件 - 设置面板
    const ExampleSettings = {
      name: 'ExampleSettings',
      template: `
        <div class="example-settings">
          <h3>示例插件设置</h3>
          <form @submit.prevent="saveSettings">
            <div class="form-group">
              <label for="welcomeMessage">欢迎消息:</label>
              <input
                id="welcomeMessage"
                v-model="settings.welcomeMessage"
                type="text"
                class="form-control"
                placeholder="输入欢迎消息"
              />
            </div>
            
            <div class="form-group">
              <label>
                <input
                  v-model="settings.showNotifications"
                  type="checkbox"
                />
                显示通知
              </label>
            </div>
            
            <div class="form-group">
              <label for="maxItems">最大项目数:</label>
              <input
                id="maxItems"
                v-model.number="settings.maxItems"
                type="number"
                min="1"
                max="100"
                class="form-control"
              />
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">
                保存设置
              </button>
              <button type="button" @click="resetSettings" class="btn btn-secondary">
                重置
              </button>
            </div>
          </form>
        </div>
      `,
      data() {
        return {
          settings: {
            welcomeMessage: '欢迎使用示例插件！',
            showNotifications: true,
            maxItems: 10
          }
        }
      },
      methods: {
        async saveSettings() {
          try {
            const success = await window.pluginContext.ipc.invoke('update-settings', this.settings)
            if (success) {
              window.pluginContext.ui.showNotification('设置已保存', 'success')
            } else {
              window.pluginContext.ui.showNotification('设置保存失败', 'error')
            }
          } catch (error) {
            console.error('Failed to save settings:', error)
            window.pluginContext.ui.showNotification('设置保存失败', 'error')
          }
        },
        async resetSettings() {
          this.settings = {
            welcomeMessage: '欢迎使用示例插件！',
            showNotifications: true,
            maxItems: 10
          }
          window.pluginContext.ui.showNotification('设置已重置', 'info')
        }
      },
      async mounted() {
        try {
          const info = await window.pluginContext.ipc.invoke('get-info')
          this.settings = { ...info.settings }
        } catch (error) {
          console.error('Failed to load settings:', error)
        }
      }
    }
    
    // 示例页面组件
    const ExamplePage = {
      name: 'ExamplePage',
      template: `
        <div class="example-page">
          <div class="page-header">
            <h1>🔌 示例插件页面</h1>
            <p>这是一个由示例插件添加的页面</p>
          </div>
          
          <div class="page-content">
            <div class="grid">
              <div class="grid-item">
                <ExampleInfoCard />
              </div>
              
              <div class="grid-item">
                <ExampleSettings />
              </div>
            </div>
          </div>
        </div>
      `,
      components: {
        ExampleInfoCard,
        ExampleSettings
      }
    }
    
    // 注册组件
    this.context.components.register('ExampleInfoCard', ExampleInfoCard)
    this.context.components.register('ExampleSettings', ExampleSettings)
    this.context.components.register('ExamplePage', ExamplePage)
    
    this.components.set('ExampleInfoCard', ExampleInfoCard)
    this.components.set('ExampleSettings', ExampleSettings)
    this.components.set('ExamplePage', ExamplePage)
  }

  /**
   * 添加路由
   */
  addRoutes() {
    const exampleRoute = {
      path: '/example-plugin',
      name: 'ExamplePlugin',
      component: this.components.get('ExamplePage'),
      meta: {
        title: '示例插件',
        icon: 'plugin',
        plugin: 'example-plugin'
      }
    }
    
    this.context.router.addRoute(exampleRoute)
    this.routes.push(exampleRoute)
  }

  /**
   * 添加UI扩展
   */
  addUIExtensions() {
    // 添加工具栏按钮
    this.context.ui.addToolbarButton({
      id: 'example-plugin-button',
      label: '示例插件',
      icon: 'plugin',
      tooltip: '打开示例插件页面',
      click: () => {
        this.context.router.push('/example-plugin')
      }
    })
    
    // 添加侧边栏面板
    this.context.ui.addSidebarPanel({
      id: 'example-plugin-panel',
      title: '示例插件',
      icon: 'plugin',
      component: 'ExampleInfoCard',
      order: 100
    })
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 监听插件通知
    this.context.ipc.on('plugin-notification', (data) => {
      if (data.plugin === this.metadata.name) {
        this.context.ui.showNotification(data.message, data.type)
      }
    })
    
    // 监听显示插件信息事件
    this.context.ipc.on('show-plugin-info', (data) => {
      this.context.ui.showNotification(
        `插件: ${data.name} v${data.version}\n${data.message}`,
        'info'
      )
    })
    
    // 监听打开插件设置事件
    this.context.ipc.on('open-plugin-settings', (data) => {
      if (data.plugin === this.metadata.name) {
        // 导航到插件页面的设置部分
        this.context.router.push('/example-plugin')
        this.context.ui.showNotification('插件设置已打开', 'info')
      }
    })
    
    // 监听全局事件
    this.context.events.on('app-ready', () => {
      console.log('App is ready, example plugin initialized')
    })
    
    this.context.events.on('theme-changed', (theme) => {
      console.log('Theme changed to:', theme)
      // 可以根据主题变化调整插件UI
    })
  }

  /**
   * 初始化插件
   */
  async initialize() {
    try {
      // 获取插件信息
      const info = await this.context.ipc.invoke('get-info')
      console.log('Plugin info loaded:', info)
      
      // 发送初始化完成事件
      this.context.events.emit('plugin-initialized', {
        name: this.metadata.name,
        version: this.metadata.version
      })
      
      // 显示欢迎通知
      setTimeout(() => {
        this.context.ui.showNotification(
          `${this.metadata.name} 插件已准备就绪！`,
          'success'
        )
      }, 1000)
      
    } catch (error) {
      console.error('Failed to initialize plugin:', error)
      this.context.ui.showNotification('插件初始化失败', 'error')
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 移除路由
    this.routes.forEach(route => {
      this.context.router.removeRoute(route.name)
    })
    
    // 清理事件监听器
    this.context.events.removeAllListeners('app-ready')
    this.context.events.removeAllListeners('theme-changed')
    
    // 移除UI扩展
    this.context.ui.removeToolbarButton('example-plugin-button')
    this.context.ui.removeSidebarPanel('example-plugin-panel')
    
    console.log('Example plugin cleanup completed')
  }

  /**
   * 获取插件状态
   */
  getStatus() {
    return {
      active: true,
      components: Array.from(this.components.keys()),
      routes: this.routes.map(r => r.path),
      metadata: this.metadata
    }
  }
}

// 导出插件实例
export default new ExampleRendererPlugin()