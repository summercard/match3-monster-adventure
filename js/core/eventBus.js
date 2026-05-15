// ============================================
// core/eventBus.js - 全局事件总线
// ============================================

export class EventBus {
  constructor() {
    this._listeners = {}
  }

  on(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = []
    }
    this._listeners[event].push(callback)
    return () => this.off(event, callback)
  }

  off(event, callback) {
    if (!this._listeners[event]) return
    this._listeners[event] = this._listeners[event].filter(cb => cb !== callback)
  }

  emit(event, data) {
    if (!this._listeners[event]) return
    this._listeners[event].forEach(cb => {
      try {
        cb(data)
      } catch (e) {
        console.error(`[EventBus] Error in handler for ${event}:`, e)
      }
    })
  }

  once(event, callback) {
    const wrapper = (data) => {
      callback(data)
      this.off(event, wrapper)
    }
    this.on(event, wrapper)
  }
}
