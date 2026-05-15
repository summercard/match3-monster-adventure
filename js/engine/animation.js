// ============================================
// engine/animation.js - 简易动画系统
// ============================================

// 动画实例上限配置
const MAX_ANIMATIONS = 100          // 全局总上限
const MAX_FLOATING_TEXT = 10        // 同屏伤害数字上限
const MAX_TOAST = 3                 // 同屏Toast提示上限
const MAX_CAPTURE_EFFECT = 2        // 同屏收服特效上限

export class AnimationManager {
  constructor() {
    this.animations = []
    // 按类型统计实例数量（用于同屏上限控制）
    this._typeCounts = {
      floatingText: 0,
      toast: 0,
      captureEffect: 0
    }
  }

  // 回收一个动画实例（从数组移除并更新计数）
  _removeAnim(index) {
    const anim = this.animations[index]
    if (anim && anim._animType) {
      const t = anim._animType
      if (this._typeCounts[t] !== undefined) {
        this._typeCounts[t] = Math.max(0, this._typeCounts[t] - 1)
      }
    }
    this.animations.splice(index, 1)
  }

  // 检查全局上限，超出则回收最早的普通动画
  _checkGlobalLimit() {
    if (this.animations.length >= MAX_ANIMATIONS) {
      // 找到第一个非特殊类型的动画回收
      for (let i = 0; i < this.animations.length; i++) {
        const a = this.animations[i]
        if (!a._animType) {
          this.animations.splice(i, 1)
          return
        }
      }
    }
  }

  // 检查同屏类型上限，超出返回true
  _isTypeLimited(type, limit) {
    return this._typeCounts[type] !== undefined && this._typeCounts[type] >= limit
  }

  // 添加动画
  // opts: { target, property, from, to, duration, easing, onComplete, animType }
  add(opts) {
    const type = opts.animType
    // 同屏类型上限检查
    if (type === 'floatingText' && this._isTypeLimited('floatingText', MAX_FLOATING_TEXT)) return null
    if (type === 'toast' && this._isTypeLimited('toast', MAX_TOAST)) return null
    if (type === 'captureEffect' && this._isTypeLimited('captureEffect', MAX_CAPTURE_EFFECT)) return null

    // 全局上限检查
    this._checkGlobalLimit()

    const anim = {
      target: opts.target,
      property: opts.property,
      from: opts.from !== undefined ? opts.from : opts.target[opts.property],
      to: opts.to,
      duration: opts.duration || 300,
      elapsed: 0,
      easing: opts.easing || 'easeOut',
      onComplete: opts.onComplete || null,
      done: false,
      _animType: type || null
    }
    opts.target[opts.property] = anim.from
    this.animations.push(anim)
    if (type && this._typeCounts[type] !== undefined) {
      this._typeCounts[type]++
    }
    return anim
  }

  update(dt) {
    const ms = dt * 1000
    for (let i = this.animations.length - 1; i >= 0; i--) {
      const anim = this.animations[i]
      if (anim.done) {
        this._removeAnim(i)
        continue
      }

      anim.elapsed += ms
      let t = Math.min(anim.elapsed / anim.duration, 1)

      // 缓动函数
      t = this._ease(t, anim.easing)

      // 插值
      anim.target[anim.property] = anim.from + (anim.to - anim.from) * t

      if (anim.elapsed >= anim.duration) {
        anim.target[anim.property] = anim.to
        anim.done = true
        if (anim.onComplete) anim.onComplete()
        this._removeAnim(i)
      }
    }
  }

  _ease(t, type) {
    switch (type) {
      case 'linear': return t
      case 'easeIn': return t * t
      case 'easeOut': return t * (2 - t)
      case 'easeInOut': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
      case 'bounce':
        if (t < 1 / 2.75) return 7.5625 * t * t
        else if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75
        else if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375
        else return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375
      default: return t * (2 - t)
    }
  }

  // 延迟回调
  setTimeout(callback, duration) {
    const anim = {
      target: { _dummy: 0 },
      property: '_dummy',
      from: 0,
      to: 1,
      duration: duration,
      elapsed: 0,
      easing: 'linear',
      onComplete: callback,
      done: false,
      _animType: null
    }
    this.animations.push(anim)
    return anim
  }

  // 宝石消除特效：先放大闪白 → 缩小消失
  // gems: [{ row, col, type, x, y }] 消除的宝石数组（含屏幕坐标）
  // callback: 动画完成后回调
  playEliminateEffect(gems, callback) {
    if (!gems || gems.length === 0) {
      if (callback) callback()
      return
    }

    let completed = 0
    const checkDone = () => {
      completed++
      if (completed >= gems.length && callback) {
        callback()
      }
    }

    gems.forEach((gem, index) => {
      // 创建宝石可视对象（用于动画）
      const visual = {
        x: gem.x,
        y: gem.y,
        scale: 1,
        opacity: 1,
        brightness: 0  // 0=正常, 1=白色闪烁
      }

      // 阶段1：放大 + 闪白（100ms）
      const t1 = {
        target: visual,
        property: 'scale',
        from: 1,
        to: 1.2,
        duration: 100,
        elapsed: 0,
        easing: 'easeOut',
        onComplete: null,
        done: false,
        _animType: null
      }

      const b1 = {
        target: visual,
        property: 'brightness',
        from: 0,
        to: 1,
        duration: 100,
        elapsed: 0,
        easing: 'linear',
        onComplete: null,
        done: false,
        _animType: null
      }

      this.animations.push(t1, b1)

      // 延迟后阶段2：缩小 + 消失（150ms）
      this.setTimeout(() => {
        const t2 = {
          target: visual,
          property: 'scale',
          from: 1.2,
          to: 0,
          duration: 150,
          elapsed: 0,
          easing: 'easeIn',
          onComplete: checkDone,
          done: false,
          _animType: null
        }

        const o2 = {
          target: visual,
          property: 'opacity',
          from: 1,
          to: 0,
          duration: 150,
          elapsed: 0,
          easing: 'easeIn',
          onComplete: null,
          done: false,
          _animType: null
        }

        // 阶段1的brightness回归
        const b2 = {
          target: visual,
          property: 'brightness',
          from: 1,
          to: 0,
          duration: 150,
          elapsed: 0,
          easing: 'easeIn',
          onComplete: null,
          done: false,
          _animType: null
        }

        this.animations.push(t2, o2, b2)
      }, 100)

      // 将 visual 保存到 gem 对象上，供渲染器访问
      gem._visual = visual
    })
  }

  clear() {
    this.animations = []
    this._typeCounts.floatingText = 0
    this._typeCounts.toast = 0
    this._typeCounts.captureEffect = 0
  }
}