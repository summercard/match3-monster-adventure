// ============================================
// engine/FloatingTextManager.js - 浮动文字管理器
// ============================================

// FloatingText: 单条浮动文字的动画状态
class FloatingText {
  constructor(text, x, y, options, animation) {
    this.text = text
    this.x = x
    this.y = y
    this.startY = y
    this.color = options.color || '#ffffff'
    this.size = options.size || 16
    this.critical = options.critical || false
    this.offsetY = options.offsetY || 40

    // 动画状态机: pop | rise | fade
    this.phase = 'pop'
    this.timer = 0
    this.duration = options.duration || 800  // ms

    // 可视属性
    this.scale = 0.5
    this.opacity = 0

    // 内部动画驱动器
    this.animation = animation
    this.done = false

    // critical 时弹出阶段额外放大 1.3x
    this.criticalScale = this.critical ? 1.3 : 1.0
  }

  update(dt) {
    if (this.done) return

    const ms = dt * 1000
    this.timer += ms

    // 阶段时长
    // pop: 0→150ms, scale 0.5→1.2, opacity 0→1
    // rise: 150→300ms, scale 1.2→1.0, y 上飘
    // fade: 300→800ms, opacity 1→0, y 继续上飘
    const t = this.timer
    const POP_END = 150
    const RISE_END = 300

    if (this.phase === 'pop') {
      if (t < POP_END) {
        const progress = t / POP_END
        this.scale = 0.5 + 0.7 * progress       // 0.5 → 1.2
        this.opacity = progress                 // 0 → 1
      } else {
        this.phase = 'rise'
        this.timer = t - POP_END
        this.scale = 1.2 * this.criticalScale   // 应用 critical 放大
        this.opacity = 1
      }
    } else if (this.phase === 'rise') {
      if (t < RISE_END - POP_END) {
        const progress = t / (RISE_END - POP_END)
        this.scale = (1.2 - 0.2 * progress) * this.criticalScale  // 1.2 → 1.0
        this.y = this.startY - this.offsetY * progress            // 上浮
      } else {
        this.phase = 'fade'
        this.timer = t - (RISE_END - POP_END)
        this.scale = 1.0 * this.criticalScale
        this.opacity = 1
        this.y = this.startY - this.offsetY  // 停在最高点
      }
    } else if (this.phase === 'fade') {
      const FADE_START = 0
      const FADE_END = this.duration
      if (t < FADE_END) {
        const progress = t / FADE_END
        this.opacity = 1 - progress
        // 继续轻微上飘
        this.y = this.startY - this.offsetY - 10 * progress
      } else {
        this.opacity = 0
        this.done = true
      }
    }
  }
}

// FloatingTextManager: 管理场景中所有浮动文字
export class FloatingTextManager {
  constructor(game) {
    this.game = game
    this.texts = []
  }

  // 添加浮动文字
  // text: string, x/y: 初始位置, options: { color, size, duration, critical, offsetY }
  add(text, x, y, options = {}) {
    this.texts.push(new FloatingText(text, x, y, options, this.game ? this.game.animation : null))
  }

  // 更新所有浮动文字
  update(dt) {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      this.texts[i].update(dt)
      if (this.texts[i].done) {
        this.texts.splice(i, 1)
      }
    }
  }

  // 渲染所有浮动文字（调用 renderer 的 fillText）
  render(r) {
    this.texts.forEach(t => {
      if (t.opacity <= 0) return
      // scale 需要在字体大小上体现
      const displaySize = Math.round(t.size * t.scale)
      r.fillText(t.text, t.x, t.y, t.color, displaySize)
    })
  }

  // 清空所有浮动文字
  clear() {
    this.texts = []
  }
}