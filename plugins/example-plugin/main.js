/**
 * ExamAware 示例插件 - 主进程
 * 展示如何在主进程中实现插件功能
 */

class ExampleMainPlugin {
  constructor() {
    this.metadata = {
      name: 'example-plugin',
      version: '1.0.0'
    }
    this.context = null
    this.settings = {
      welcomeMessage: '欢迎使用示例插件！',
      showNotifications: true,
      maxItems: 10
    }
  }

  /**
   * 插件激活时调用
   * @param {Object} context - 插件上下文
   */
  async activate(context) {
    console.log('Example plugin (main) activated')
    this.context = context

    // 加载设置
    await this.loadSettings()

    // 注册IPC处理器
    this.registerIpcHandlers()

    // 监听事件
    this.setupEventListeners()

    // 添加菜单项
    this.addMenuItems()

    // 发送激活通知
    this.notifyActivation()
  }

  /**
   * 插件停用时调用
   */
  async deactivate() {
    console.log('Example plugin (main) deactivated')

    // 清理资源
    this.cleanup()
  }

  /**
   * 加载设置
   */
  async loadSettings() {
    try {
      // 从配置文件或数据库加载设置
      // 这里使用默认设置作为示例
      console.log('Settings loaded:', this.settings)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  /**
   * 注册IPC处理器
   */
  registerIpcHandlers() {
    // 获取插件信息
    this.context.ipc.handle('get-info', () => {
      return {
        name: this.metadata.name,
        version: this.metadata.version,
        settings: this.settings
      }
    })

    // 更新设置
    this.context.ipc.handle('update-settings', (newSettings) => {
      this.settings = { ...this.settings, ...newSettings }
      console.log('Settings updated:', this.settings)
      return true
    })

    // 获取系统信息
    this.context.ipc.handle('get-system-info', () => {
      return {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron
      }
    })

    // 创建新窗口
    this.context.ipc.handle('create-window', (options = {}) => {
      try {
        const window = this.context.windows.create({
          width: 800,
          height: 600,
          title: 'Example Plugin Window',
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          },
          ...options
        })

        // 加载页面
        window.loadURL('data:text/html,<h1>Example Plugin Window</h1><p>This is a window created by the example plugin.</p>')

        return window.id
      } catch (error) {
        console.error('Failed to create window:', error)
        return null
      }
    })

    // 文件操作示例
    this.context.ipc.handle('read-plugin-file', async (filename) => {
      try {
        const content = await this.context.fs.readFile(filename)
        return content
      } catch (error) {
        console.error('Failed to read file:', error)
        return null
      }
    })

    this.context.ipc.handle('write-plugin-file', async (filename, content) => {
      try {
        await this.context.fs.writeFile(filename, content)
        return true
      } catch (error) {
        console.error('Failed to write file:', error)
        return false
      }
    })
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 监听窗口事件
    this.context.events.on('window-created', (window) => {
      console.log('New window created:', window.id)

      if (this.settings.showNotifications) {
        // 向所有窗口发送通知
        this.context.windows.getAll().forEach(win => {
          this.context.ipc.send(win, 'plugin-notification', {
            type: 'info',
            message: '新窗口已创建',
            plugin: this.metadata.name
          })
        })
      }
    })

    // 监听其他插件事件
    this.context.events.on('plugin-message', (data) => {
      console.log('Received plugin message:', data)
    })
  }

  /**
   * 添加菜单项
   */
  addMenuItems() {
    // 添加主菜单项
    this.context.menu.addMenuItem({
      id: 'example-plugin-menu',
      label: '示例插件',
      submenu: [
        {
          id: 'example-show-info',
          label: '显示插件信息',
          click: () => {
            this.showPluginInfo()
          }
        },
        {
          id: 'example-create-window',
          label: '创建新窗口',
          click: () => {
            this.createExampleWindow()
          }
        },
        {
          type: 'separator'
        },
        {
          id: 'example-settings',
          label: '插件设置',
          click: () => {
            this.openSettings()
          }
        }
      ]
    })
  }

  /**
   * 显示插件信息
   */
  showPluginInfo() {
    const mainWindow = this.context.windows.getMain()
    if (mainWindow) {
      this.context.ipc.send(mainWindow, 'show-plugin-info', {
        name: this.metadata.name,
        version: this.metadata.version,
        message: this.settings.welcomeMessage
      })
    }
  }

  /**
   * 创建示例窗口
   */
  createExampleWindow() {
    const window = this.context.windows.create({
      width: 600,
      height: 400,
      title: '示例插件窗口',
      resizable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    // 加载示例页面
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>示例插件窗口</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            margin: 0;
            background: #f5f5f5;
          }
          .container {
            max-width: 500px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 {
            color: #333;
            margin-bottom: 20px;
          }
          .info {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
          }
          button {
            background: #1976d2;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
          }
          button:hover {
            background: #1565c0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔌 示例插件</h1>
          <div class="info">
            <p><strong>插件名称:</strong> ${this.metadata.name}</p>
            <p><strong>版本:</strong> ${this.metadata.version}</p>
            <p><strong>欢迎消息:</strong> ${this.settings.welcomeMessage}</p>
          </div>
          <p>这是一个由示例插件创建的窗口，展示了插件系统的基本功能。</p>
          <button onclick="alert('Hello from Example Plugin!')">打招呼</button>
          <button onclick="window.close()">关闭窗口</button>
        </div>
      </body>
      </html>
    `

    window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  }

  /**
   * 打开设置
   */
  openSettings() {
    const mainWindow = this.context.windows.getMain()
    if (mainWindow) {
      this.context.ipc.send(mainWindow, 'open-plugin-settings', {
        plugin: this.metadata.name,
        settings: this.settings
      })
    }
  }

  /**
   * 发送激活通知
   */
  notifyActivation() {
    if (this.settings.showNotifications) {
      const mainWindow = this.context.windows.getMain()
      if (mainWindow) {
        this.context.ipc.send(mainWindow, 'plugin-notification', {
          type: 'success',
          message: `${this.metadata.name} 插件已激活`,
          plugin: this.metadata.name
        })
      }
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 移除菜单项
    this.context.menu.removeMenuItem('example-plugin-menu')

    // 清理IPC处理器
    this.context.ipc.removeHandler('get-info')
    this.context.ipc.removeHandler('update-settings')
    this.context.ipc.removeHandler('get-system-info')
    this.context.ipc.removeHandler('create-window')
    this.context.ipc.removeHandler('read-plugin-file')
    this.context.ipc.removeHandler('write-plugin-file')

    // 清理事件监听器
    this.context.events.removeAllListeners('window-created')
    this.context.events.removeAllListeners('plugin-message')

    console.log('Example plugin cleanup completed')
  }

  /**
   * 获取插件状态
   */
  getStatus() {
    return {
      active: true,
      settings: this.settings,
      metadata: this.metadata
    }
  }
}

// 导出插件实例
module.exports = new ExampleMainPlugin()
