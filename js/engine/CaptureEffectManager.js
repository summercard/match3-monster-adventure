// ============================================
// engine/CaptureEffectManager.js - 收服成功/失败特效管理器
// ============================================

// CaptureEffect: 单次收服特效的动画状态
class CaptureEffect {
  constructor(success, x, y) {
    this.success = success
    this.x = x
    this.y = y
    this.timer = 0
    this.done = false

    // 屏幕闪白
    this.flashOpacity = 0

    // 怪物弹跳
    this.monsterScale = 1
    this.monsterBouncePhase = 0  // 0: none, 1: bounce

    // GET! 大字
    this.getTextScale = 0
    this.getTextOpacity = 0

    // 屏幕抖动
    this.shakeOffsetX = 0
    this.shakePhase = 0

    // MISS 文字
    this.missTextOpacity = 0
    this.missTextY = y

    if (success) {
      this.totalDuration = 1200
      this._startSuccessSequence()
    } else {
      this.totalDuration = 800
      this._startFailSequence()
    }
  }

  _startSuccessSequence() {
    // 时序：
    // 0-150ms:   screenFlash 0→0.8→0
    // 150-550ms: monsterBounce 1→1.3→0.8→1.05→1 (400ms)
    // 400-1200ms: getTextPop scale 0→1.2→1, opacity 0→1→0
    this.flashStart = 0
    this.flashEnd = 150
    this.bounceStart = 150
    this.bounceEnd = 550
    this.getTextStart = 400
    this.getTextEnd = 1200
  }

  _startFailSequence() {
    // 时序：
    // 0-200ms:   screenShake ±3px
    // 200-800ms: missTextFade opacity 1→0, translateY -20px
    this.shakeStart = 0
    this.shakeEnd = 200
    this.missStart = 200
    this.missEnd = 800
  }

  update(dt) {
    if (this.done) return

    const ms = dt * 1000
    this.timer += ms

    if (this.success) {
      this._updateSuccess(dt, ms)
    } else {
      this._updateFail(dt, ms)
    }

    if (this.timer >= this.totalDuration) {
      this.done = true
    }
  }

  _updateSuccess(dt, ms) {
    // screenFlash: 0→150ms, opacity 0→0.8→0
    if (this.timer < this.flashEnd) {
      const t = this.timer - this.flashStart
      if (t < 75) {
        this.flashOpacity = (t / 75) * 0.8
      } else {
        this.flashOpacity = 0.8 * (1 - (t - 75) / 75)
      }
    } else {
      this.flashOpacity = 0
    }

    // monsterBounce: 150→550ms
    if (this.timer >= this.bounceStart && this.timer < this.bounceEnd) {
      const t = this.timer - this.bounceStart
      const duration = this.bounceEnd - this.bounceStart
      const progress = t / duration

      // 1 → 1.3 → 0.8 → 1.05 → 1 (贝塞尔曲线模拟)
      if (progress < 0.25) {
        // 0 → 0.25: 1 → 1.3
        this.monsterScale = 1 + 0.3 * (progress / 0.25)
      } else if (progress < 0.5) {
        // 0.25 → 0.5: 1.3 → 0.8
        this.monsterScale = 1.3 - 0.5 * ((progress - 0.25) / 0.25)
      } else if (progress < 0.75) {
        // 0.5 → 0.75: 0.8 → 1.05
        this.monsterScale = 0.8 + 0.25 * ((progress - 0.5) / 0.25)
      } else {
        // 0.75 → 1: 1.05 → 1
        this.monsterScale = 1.05 - 0.05 * ((progress - 0.75) / 0.25)
      }
    } else if (this.timer >= this.bounceEnd) {
      this.monsterScale = 1
    }

    // getTextPop: 400→1200ms
    if (this.timer >= this.getTextStart && this.timer < this.getTextEnd) {
      const t = this.timer - this.getTextStart
      const duration = this.getTextEnd - this.getTextStart

      if (t < duration * 0.3) {
        // 0 → 30%: scale 0 → 1.2, opacity 0 → 1
        const p = t / (duration * 0.3)
        this.getTextScale = 1.2 * p
        this.getTextOpacity = p
      } else if (t < duration * 0.7) {
        // 30% → 70%: scale 1.2 → 1, opacity 1
        const p = (t - duration * 0.3) / (duration * 0.4)
        this.getTextScale = 1.2 - 0.2 * p
        this.getTextOpacity = 1
      } else {
        // 70% → 100%: scale 1, opacity 1 → 0
        const p = (t - duration * 0.7) / (duration * 0.3)
        this.getTextScale = 1
        this.getTextOpacity = 1 - p
      }
    } else if (this.timer >= this.getTextEnd) {
      this.getTextOpacity = 0
    }
  }

  _updateFail(dt, ms) {
    // screenShake: 0→200ms
    if (this.timer < this.shakeEnd) {
      const t = this.timer - this.shakeStart
      const progress = t / (this.shakeEnd - this.shakeStart)
      this.shakeOffsetX = Math.sin(progress * Math.PI * 6) * 3 * (1 - progress)
    } else {
      this.shakeOffsetX = 0
    }

    // missTextFade: 200→800ms
    if (this.timer >= this.missStart && this.timer < this.missEnd) {
      const t = this.timer - this.missStart
      const duration = this.missEnd - this.missStart
      const progress = t / duration
      this.missTextOpacity = 1 - progress
      this.missTextY = this.y - 20 * progress  // 上飘 20px
    } else if (this.timer >= this.missEnd) {
      this.missTextOpacity = 0
    }
  }

  // 渲染特效
  render(r, baseX, baseY) {
    if (this.done) return

    // 屏幕闪白（覆盖整个画布）
    if (this.flashOpacity > 0) {
      // fillRect 支持 rgba 格式
      r.fillRect(0, 0, 375, 667, `rgba(255, 255, 255, ${this.flashOpacity})`)
    }

    // 怪物弹跳效果（在怪物位置）
    if (this.monsterScale !== 1) {
      const size = 48 * this.monsterScale
      r.fillText('👾', this.x - size / 2, this.y - size / 2, `rgba(255,255,255,${this.monsterScale > 1 ? 1 : 0.8})`, size)
    }

    // GET! 大字（居中）
    if (this.getTextOpacity > 0) {
      const baseSize = 48
      const size = baseSize * this.getTextScale
      r.fillText('GET!', baseX, baseY - 30, `rgba(255, 215, 0, ${this.getTextOpacity})`, size, 'bold')
    }

    // 屏幕抖动（画布级别，用 shakeOffsetX 影响后续绘制）
    if (this.shakeOffsetX !== 0 && this.timer < this.shakeEnd) {
      // 抖动在 render 层由调用者处理
    }

    // MISS 灰色文字
    if (this.missTextOpacity > 0) {
      r.fillText('MISS', baseX, this.missTextY, `rgba(180, 180, 180, ${this.missTextOpacity})`, 32, 'bold')
    }
  }
}

// CaptureEffectManager: 管理场景中的收服特效
export class CaptureEffectManager {
  constructor(game) {
    this.game = game
    this.effects = []
    this.shakeOffsetX = 0
  }

  // 添加特效
  // success: boolean, x/y: 怪物位置（屏幕中心区域）
  add(success, x, y) {
    this.effects.push(new CaptureEffect(success, x, y))
  }

  // 更新所有特效
  update(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      this.effects[i].update(dt)
      if (this.effects[i].done) {
        this.effects.splice(i, 1)
      }
    }
  }

  // 渲染所有特效（需要在画布偏移后调用）
  render(r, canvasX, canvasY) {
    this.effects.forEach(e => {
      e.render(r, canvasX, canvasY)
    })
  }

  // 查询当前是否有活跃特效
  isActive() {
    return this.effects.length > 0
  }

  // 获取屏幕抖动偏移（供外部使用）
  getShakeOffsetX() {
    if (this.effects.length > 0 && !this.effects[0].success) {
      return this.effects[0].shakeOffsetX
    }
    return 0
  }

  clear() {
    this.effects = []
  }
}