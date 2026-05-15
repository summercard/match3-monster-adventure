// ============================================
// engine/renderer.js - Canvas渲染器
// ============================================

import { THEME } from './theme.js'

export class Renderer {
  constructor() {
    this.canvas = null
    this.ctx = null
    this.screenWidth = 0
    this.screenHeight = 0
    this.dpr = 1
    this.designWidth = 375   // 设计宽度（逻辑像素）
    this.designHeight = 667  // 设计高度（逻辑像素）
    this.scaleX = 1
    this.scaleY = 1
    // fillText font 缓存：key = "size_weight"，避免重复 ctx.font 设置
    this._fontCache = {}
    this._lastFont = null
  }

  init() {
    // 获取微信小游戏Canvas
    this.canvas = wx.createCanvas()
    this.ctx = this.canvas.getContext('2d')

    // 获取系统信息
    const sysInfo = wx.getSystemInfoSync()
    this.screenWidth = sysInfo.windowWidth
    this.screenHeight = sysInfo.windowHeight
    this.dpr = sysInfo.pixelRatio

    // 设置Canvas大小为屏幕实际像素
    this.canvas.width = this.screenWidth * this.dpr
    this.canvas.height = this.screenHeight * this.dpr

    // 缩放上下文以匹配设计分辨率
    this.scaleX = this.screenWidth / this.designWidth
    this.scaleY = this.screenHeight / this.designHeight

    this.ctx.scale(this.dpr, this.dpr)

    // 预热 font 缓存（常用字号）
    this._fontCache['12_bold'] = 'bold 12px Arial, sans-serif'
    this._fontCache['14_bold'] = 'bold 14px Arial, sans-serif'
    this._fontCache['16_bold'] = 'bold 16px Arial, sans-serif'
    this._fontCache['18_bold'] = 'bold 18px Arial, sans-serif'
    this._fontCache['20_bold'] = 'bold 20px Arial, sans-serif'
    this._fontCache['24_bold'] = 'bold 24px Arial, sans-serif'
    this._fontCache['12_normal'] = 'normal 12px Arial, sans-serif'
    this._fontCache['14_normal'] = 'normal 14px Arial, sans-serif'
    this._fontCache['16_normal'] = 'normal 16px Arial, sans-serif'
    this._fontCache['18_normal'] = 'normal 18px Arial, sans-serif'
    this._lastFont = null

    console.log(`[Renderer] ${this.screenWidth}x${this.screenHeight} dpr=${this.dpr}`)
  }

  clear() {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.ctx.clearRect(0, 0, this.screenWidth, this.screenHeight)
  }

  // 保存/恢复画布状态（用于震动等整体偏移）
  save() {
    this.ctx.save()
  }

  restore() {
    this.ctx.restore()
  }

  // 整体偏移（设计坐标系，自动乘以scale）
  translate(dx, dy) {
    this.ctx.translate(dx * this.scaleX, dy * this.scaleY)
  }

  // 将设计坐标转为屏幕坐标
  toScreenX(x) { return x * this.scaleX }
  toScreenY(y) { return y * this.scaleY }
  toScreenW(w) { return w * this.scaleX }
  toScreenH(h) { return h * this.scaleY }

  // 绘制矩形
  fillRect(x, y, w, h, color) {
    const sx = x * this.scaleX
    const sy = y * this.scaleY
    const sw = w * this.scaleX
    const sh = h * this.scaleY
    this.ctx.fillStyle = color
    this.ctx.fillRect(sx, sy, sw, sh)
  }

  // 绘制圆角矩形（支持透明度参数）
  fillRoundRect(x, y, w, h, r, color, opacity) {
    const sx = x * this.scaleX
    const sy = y * this.scaleY
    const sw = w * this.scaleX
    const sh = h * this.scaleY
    const sr = r * Math.min(this.scaleX, this.scaleY)

    if (opacity !== undefined && opacity !== null) {
      this.ctx.globalAlpha = opacity
    }
    this.ctx.fillStyle = color
    this.ctx.beginPath()
    this.ctx.moveTo(sx + sr, sy)
    this.ctx.lineTo(sx + sw - sr, sy)
    this.ctx.arcTo(sx + sw, sy, sx + sw, sy + sr, sr)
    this.ctx.lineTo(sx + sw, sy + sh - sr)
    this.ctx.arcTo(sx + sw, sy + sh, sx + sw - sr, sy + sh, sr)
    this.ctx.lineTo(sx + sr, sy + sh)
    this.ctx.arcTo(sx, sy + sh, sx, sy + sh - sr, sr)
    this.ctx.lineTo(sx, sy + sr)
    this.ctx.arcTo(sx, sy, sx + sr, sy, sr)
    this.ctx.closePath()
    this.ctx.fill()
    if (opacity !== undefined && opacity !== null) {
      this.ctx.globalAlpha = 1
    }
  }

  // 绘制文字（兼容旧调用：第6参数传 'bold' 时自动视为 weight）
  // font 缓存：同 fontSize + weight 组合跳过重复设置 ctx.font
  fillText(text, x, y, color = '#ffffff', fontSize = 14, align = 'center', weight = null) {
    const sx = x * this.scaleX
    const sy = y * this.scaleY
    const sf = fontSize * Math.min(this.scaleX, this.scaleY)

    // 兼容处理：如果 align 是 'bold'/'normal' 等非 textAlign 值，视为 weight
    const validAligns = ['left', 'right', 'center', 'start', 'end']
    let actualAlign = align
    let actualWeight = weight || 'bold'
    if (!validAligns.includes(align)) {
      actualWeight = align
      actualAlign = 'center'
    }

    this.ctx.fillStyle = color

    // font 缓存：同 size+weight 直接复用，避免重复设置
    const cacheKey = `${sf}_${actualWeight}`
    let cachedFont = this._fontCache[cacheKey]
    if (!cachedFont) {
      cachedFont = `${actualWeight || 'normal'} ${sf}px Arial, sans-serif`
      this._fontCache[cacheKey] = cachedFont
    }
    if (cachedFont !== this._lastFont) {
      this._lastFont = cachedFont
      this.ctx.font = cachedFont
    }

    this.ctx.textAlign = actualAlign
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText(text, sx, sy)
  }

  // 绘制圆形（支持透明度参数）
  fillCircle(x, y, radius, color, opacity) {
    const sx = x * this.scaleX
    const sy = y * this.scaleY
    const sr = radius * Math.min(this.scaleX, this.scaleY)

    if (opacity !== undefined && opacity !== null) {
      this.ctx.globalAlpha = opacity
    }
    this.ctx.fillStyle = color
    this.ctx.beginPath()
    this.ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    this.ctx.fill()
    if (opacity !== undefined && opacity !== null) {
      this.ctx.globalAlpha = 1
    }
  }

  // 绘制边框
  strokeRoundRect(x, y, w, h, r, color, lineWidth = 2) {
    const sx = x * this.scaleX
    const sy = y * this.scaleY
    const sw = w * this.scaleX
    const sh = h * this.scaleY
    const sr = r * Math.min(this.scaleX, this.scaleY)

    this.ctx.strokeStyle = color
    this.ctx.lineWidth = lineWidth
    this.ctx.beginPath()
    this.ctx.moveTo(sx + sr, sy)
    this.ctx.lineTo(sx + sw - sr, sy)
    this.ctx.arcTo(sx + sw, sy, sx + sw, sy + sr, sr)
    this.ctx.lineTo(sx + sw, sy + sh - sr)
    this.ctx.arcTo(sx + sw, sy + sh, sx + sw - sr, sy + sh, sr)
    this.ctx.lineTo(sx + sr, sy + sh)
    this.ctx.arcTo(sx, sy + sh, sx, sy + sh - sr, sr)
    this.ctx.lineTo(sx, sy + sr)
    this.ctx.arcTo(sx, sy, sx + sr, sy, sr)
    this.ctx.closePath()
    this.ctx.stroke()
  }

  // 绘制矩形边框
  strokeRect(x, y, w, h, lineWidth = 2, color = '#ffffff') {
    const sx = x * this.scaleX
    const sy = y * this.scaleY
    const sw = w * this.scaleX
    const sh = h * this.scaleY

    this.ctx.strokeStyle = color
    this.ctx.lineWidth = lineWidth
    this.ctx.strokeRect(sx, sy, sw, sh)
  }

  // 绘制血条
  drawHPBar(x, y, w, h, current, max, bgColor = '#333', hpColor = '#4caf50') {
    const sx = x * this.scaleX
    const sy = y * this.scaleY
    const sw = w * this.scaleX
    const sh = h * this.scaleY

    // 背景
    this.ctx.fillStyle = bgColor
    this.ctx.fillRect(sx, sy, sw, sh)

    // 血量
    const ratio = Math.max(0, current / max)
    let barColor = hpColor
    if (ratio < 0.3) barColor = '#f44336'
    else if (ratio < 0.6) barColor = '#ff9800'

    this.ctx.fillStyle = barColor
    this.ctx.fillRect(sx, sy, sw * ratio, sh)

    // 边框
    this.ctx.strokeStyle = '#000'
    this.ctx.lineWidth = 1
    this.ctx.strokeRect(sx, sy, sw, sh)
  }

  // ============================================
  // drawButton - 通用按钮绘制方法
  // @param {Object} btn - 按钮数据 { x, y, w, h, text }
  // @param {string} type - 按钮类型 'primary'|'secondary'|'danger'
  // @param {number} pressed - 按下缩放因子（0-1），默认1表示正常
  // @returns {Object} 按钮渲染数据（含实际坐标尺寸）
  // ============================================
  drawButton(btn, type = 'primary', pressed = 1) {
    const cfg = THEME.buttons[type] || THEME.buttons.primary
    const { bgColor, textColor, fontSize, fontWeight, radius, pressScale } = cfg

    // 计算缩放
    const scale = pressed < 1 ? pressScale : 1
    const w = btn.w * scale
    const h = btn.h * scale
    const dx = btn.x + (btn.w - w) / 2   // 居中偏移
    const dy = btn.y + (btn.h - h) / 2

    const sx = dx * this.scaleX
    const sy = dy * this.scaleY
    const sw = w * this.scaleX
    const sh = h * this.scaleY
    const sr = radius * Math.min(this.scaleX, this.scaleY)
    const sf = fontSize * Math.min(this.scaleX, this.scaleY)

    // 绘制按钮背景
    this.ctx.fillStyle = bgColor
    this.ctx.beginPath()
    this.ctx.moveTo(sx + sr, sy)
    this.ctx.lineTo(sx + sw - sr, sy)
    this.ctx.arcTo(sx + sw, sy, sx + sw, sy + sr, sr)
    this.ctx.lineTo(sx + sw, sy + sh - sr)
    this.ctx.arcTo(sx + sw, sy + sh, sx + sw - sr, sy + sh, sr)
    this.ctx.lineTo(sx + sr, sy + sh)
    this.ctx.arcTo(sx, sy + sh, sx, sy + sh - sr, sr)
    this.ctx.lineTo(sx, sy + sr)
    this.ctx.arcTo(sx, sy, sx + sr, sy, sr)
    this.ctx.closePath()
    this.ctx.fill()

    // 绘制按钮文字
    this.ctx.fillStyle = textColor
    this.ctx.font = `${fontWeight} ${sf}px Arial, sans-serif`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText(btn.text, sx + sw / 2, sy + sh / 2)

    // 返回实际渲染位置（用于点击判断）
    return { x: dx, y: dy, w, h }
  }
}
