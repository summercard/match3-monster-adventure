// ============================================
// engine/input.js - 触摸输入管理
// ============================================

export class InputManager {
  constructor(renderer) {
    this.renderer = renderer
    this.touchStart = null
    this.touchCurrent = null
    this.isTouching = false
    this.onSwipe = null       // 外部设置滑动回调
    this.onTap = null         // 外部设置点击回调
    this.onMove = null       // 外部设置移动回调（悬停检测）
    this.onTouchStart = null  // 外部设置触摸开始回调（按钮按压反馈）
    this.onTouchEnd = null    // 外部设置触摸结束回调（按钮按压反馈）
    this.onLongPress = null   // 外部设置长按回调（300ms后触发）
    this.isLongPressed = false // 当前是否处于长按状态
    this.locked = false       // 输入锁（动画期间禁止操作）

    // 长按检测相关
    this._longPressTimer = null
    this._longPressPos = null

    this._init()
  }

  _init() {
    wx.onTouchStart(this._onTouchStart.bind(this))
    wx.onTouchMove(this._onTouchMove.bind(this))
    wx.onTouchEnd(this._onTouchEnd.bind(this))
    wx.onTouchCancel(this._onTouchEnd.bind(this))

    // 按压状态追踪（用于按钮按下视觉反馈）
    this._lastTouchPos = null
  }

  _screenToDesign(screenX, screenY) {
    return {
      x: screenX / this.renderer.scaleX,
      y: screenY / this.renderer.scaleY
    }
  }

  _onTouchStart(e) {
    if (this.locked) return
    const touch = e.touches[0]
    const pos = this._screenToDesign(touch.clientX, touch.clientY)
    this.touchStart = pos
    this.touchCurrent = pos
    this.isTouching = true
    this._lastTouchPos = pos

    // 通知场景"手指按下"，用于按钮按压视觉反馈
    if (this.onTouchStart) {
      this.onTouchStart(pos.x, pos.y)
    }

    // 启动长按检测定时器（300ms）
    this._longPressPos = { x: pos.x, y: pos.y }
    this._longPressTimer = setTimeout(() => {
      this.isLongPressed = true
      if (this.onLongPress) {
        this.onLongPress(this._longPressPos.x, this._longPressPos.y)
      }
      // 微震动反馈
      try { wx.vibrateShort({ type: 'light' }) } catch (e) {}
    }, 300)
  }

  _onTouchMove(e) {
    if (this.locked) return
    const touch = e.touches[0]
    const pos = this._screenToDesign(touch.clientX, touch.clientY)
    this.touchCurrent = pos
    this._lastTouchPos = pos

    // 触发移动回调（用于悬停检测）
    if (this.onMove) {
      this.onMove(pos.x, pos.y)
    }

    if (!this.isTouching) {
      this.isTouching = true
      this.touchStart = pos
    }
  }

  _onTouchEnd(e) {
    // 清理长按定时器和状态
    this._clearLongPress()

    if (!this.isTouching || this.locked) return
    this.isTouching = false

    // 通知场景"手指抬起"，清除按钮按压状态
    if (this.onTouchEnd) {
      this.onTouchEnd()
    }

    if (!this.touchStart) return

    const dx = this.touchCurrent.x - this.touchStart.x
    const dy = this.touchCurrent.y - this.touchStart.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    // 判断是点击还是滑动
    if (distance < 10) {
      // 点击
      if (this.onTap) {
        this.onTap(this.touchStart.x, this.touchStart.y)
      }
    } else {
      // 滑动方向
      let direction = null
      if (Math.abs(dx) > Math.abs(dy)) {
        direction = dx > 0 ? 'right' : 'left'
      } else {
        direction = dy > 0 ? 'down' : 'up'
      }

      if (this.onSwipe) {
        this.onSwipe(this.touchStart.x, this.touchStart.y, direction)
      }
    }

    this.touchStart = null
    this.touchCurrent = null
    this._lastTouchPos = null
  }

  _clearLongPress() {
    clearTimeout(this._longPressTimer)
    this._longPressTimer = null
    this._longPressPos = null
    this.isLongPressed = false
  }

  _clearTouchState(notifyTouchEnd = false) {
    this._clearLongPress()
    if (notifyTouchEnd && this.isTouching && this.onTouchEnd) {
      this.onTouchEnd()
    }
    this.touchStart = null
    this.touchCurrent = null
    this.isTouching = false
    this._lastTouchPos = null
  }

  // ============================================
  // 按钮按压状态追踪（用于按钮按下视觉反馈）
  // ============================================

  // 查询某区域是否当前被按住
  isPressed(x1, y1, x2, y2) {
    if (!this._lastTouchPos) return false
    const px = this._lastTouchPos.x
    const py = this._lastTouchPos.y
    return px >= x1 && px <= x2 && py >= y1 && py <= y2
  }

  lock() {
    this._clearTouchState(true)
    this.locked = true
  }
  unlock() { this.locked = false }
}
