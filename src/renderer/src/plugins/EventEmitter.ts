/**
 * 浏览器兼容的事件发射器实现
 * 替代Node.js的events模块
 */

export class EventEmitter {
  private events: Map<string, Function[]> = new Map()

  on(event: string, listener: Function): this {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event)!.push(listener)
    return this
  }

  off(event: string, listener: Function): this {
    const listeners = this.events.get(event)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index !== -1) {
        listeners.splice(index, 1)
      }
      if (listeners.length === 0) {
        this.events.delete(event)
      }
    }
    return this
  }

  emit(event: string, ...args: any[]): boolean {
    const listeners = this.events.get(event)
    if (listeners && listeners.length > 0) {
      listeners.forEach(listener => {
        try {
          listener.apply(this, args)
        } catch (error) {
          console.error('Error in event listener:', error)
        }
      })
      return true
    }
    return false
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.events.delete(event)
    } else {
      this.events.clear()
    }
    return this
  }

  listenerCount(event: string): number {
    const listeners = this.events.get(event)
    return listeners ? listeners.length : 0
  }

  eventNames(): string[] {
    return Array.from(this.events.keys())
  }
}
