// ============================================
// engine/ToastManager.js - 通用 Toast 提示管理器
// ============================================

import { THEME } from './theme.js'

// Toast: 单条提示的状态机（in/out 两阶段）
class Toast {
  constructor(text, options, animation) {
    this.text = text
    this.type = options.type || 'info'  // info | success | warning | error
    this.position = options.position || 'top'  // top | bottom

    // 阶段时长
    this.inDuration = 200   // 滑入 + 淡入
    this.stayDuration = 1500  // 保持显示
    this.outDuration = 300    // 淡出

    // 位置计算
    const w = 375  // designWidth
    this.maxWidth = options.maxWidth || 280
    this.x = (w - this.maxWidth) / 2
    this.startY = this.position === 'top' ? -60 : 667 + 60  // 初始在屏幕外
    this.targetY = this.position === 'top' ? 80 : 667 - 80  // 目标位置
    this.y = this.startY

    // 颜色映射
    const colorMap = {
      info: THEME.primary,
      success: THEME.success,
      warning: THEME.warning,
      error: THEME.danger
    }
    this.color = colorMap[this.type] || THEME.primary

    // 动画状态机
    this.phase = 'in'
    this.timer = 0
    this.opacity = 0
    this.done = false

    // 内部动画驱动器（保留兼容性）
    this.animation = animation
  }

  update(dt) {
    if (this.done) return

    const ms = dt * 1000
    this.timer += ms
    const t = this.timer

    if (this.phase === 'in') {
      // in 阶段：0→200ms，从屏幕外滑入 + opacity 0→1
      const progress = Math.min(t / this.inDuration, 1)
      // 滑入：ease-out
      const easeOut = 1 - Math.pow(1 - progress, 3)
      this.y = this.startY + (this.targetY - this.startY) * easeOut
      this.opacity = progress

      if (progress >= 1) {
        this.phase = 'stay'
        this.timer = 0
        this.y = this.targetY
        this.opacity = 1
      }
    } else if (this.phase === 'stay') {
      // stay 阶段：保持显示
      if (t >= this.stayDuration) {
        this.phase = 'out'
        this.timer = 0
      }
    } else if (this.phase === 'out') {
      // out 阶段：0→300ms，opacity 1→0 + 轻微上滑
      const progress = Math.min(t / this.outDuration, 1)
      this.opacity = 1 - progress
      this.y = this.targetY - 15 * progress  // 轻微上滑

      if (progress >= 1) {
        this.opacity = 0
        this.done = true
      }
    }
  }
}

// ToastManager: 管理场景中所有 Toast 提示
export class ToastManager {
  constructor(game) {
    this.game = game
    this.toasts = []
    this._toastId = 0
  }

  // 添加 Toast 提示
  // text: string, options: { type, position, maxWidth }
  add(text, options = {}) {
    const toast = new Toast(text, options, this.game ? this.game.animation : null)
    this.toasts.push(toast)
    this._toastId++
    return this._toastId
  }

  // 便捷方法：info / success / warning / error
  info(text, position = 'top') {
    return this.add(text, { type: 'info', position })
  }
  success(text, position = 'top') {
    return this.add(text, { type: 'success', position })
  }
  warning(text, position = 'top') {
    return this.add(text, { type: 'warning', position })
  }
  error(text, position = 'top') {
    return this.add(text, { type: 'error', position })
  }

  // 更新所有 Toast
  update(dt) {
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      this.toasts[i].update(dt)
      if (this.toasts[i].done) {
        this.toasts.splice(i, 1)
      }
    }
  }

  // 渲染所有 Toast
  render(r) {
    this.toasts.forEach(toast => {
      if (toast.opacity <= 0) return

      const w = r.designWidth
      const h = 667  // designHeight
      const padding = 12
      const toastH = 44

      // 计算 Y 偏移：同方向多个 toast 垂直排列
      let offsetY = 0
      this.toasts.forEach(t => {
        if (t !== toast && t.position === toast.position && t.y < toast.y + 10) {
          offsetY += toastH + 8
        }
      })

      const drawY = toast.y - offsetY

      // 背景：圆角矩形，rgba 黑色半透明（使用 rgba() 格式避免 toString(16) 开销）
      r.fillRoundRect(toast.x, drawY, toast.maxWidth, toastH, THEME.radius.md, `rgba(0,0,0,${0.85 * toast.opacity})`)

      // 左侧色条
      r.fillRect(toast.x + 8, drawY + 8, 4, toastH - 16, toast.color)

      // 文字：居中（使用 rgba() 格式）
      r.fillText(toast.text, toast.x + toast.maxWidth / 2, drawY + toastH / 2 + 5, `rgba(255,255,255,${toast.opacity})`, THEME.font.body.size, THEME.font.body.weight, 'center')
    })
  }

  // 查询是否有活跃提示
  isActive() {
    return this.toasts.length > 0
  }

  // 清空所有 Toast
  clear() {
    this.toasts = []
  }
}