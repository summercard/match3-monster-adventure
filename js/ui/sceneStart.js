// ============================================
// ui/sceneStart.js - 启动/欢迎画面
// ============================================
import { THEME, COLORS, FONT } from '../engine/theme.js'

export class SceneStart {
  constructor(game, data) {
    this.game = game
    this.opacity = 0          // 淡入动画
    this.ready = false        // 淡入完成才能点击
    this.pulse = 0            // 按钮呼吸动画
    this.pulseDir = 1
    this.tapCallback = this._onTap.bind(this)
    this.touchStartCallback = this._onTouchStart.bind(this)
    this.touchEndCallback = this._onTouchEnd.bind(this)
    this.longPressCallback = this._onLongPress.bind(this)
    this.touchedBtn = null  // 当前按下的按钮
    this.longPressGlow = 0  // 长按光晕增强强度（0~1）
    this.particles = []      // 背景粒子数组

    // Canvas 缓存（静态区域预渲染）
    this._bgCache = null      // 离屏 Canvas：标题+装饰+版本号
    this._bgCacheValid = false // 缓存是否需要刷新
  }

  init(data) {
    console.log('[SceneStart] 启动画面初始化')
    this.game.input.onTap = this.tapCallback
    this.game.input.onTouchStart = this.touchStartCallback
    this.game.input.onTouchEnd = this.touchEndCallback
    this.game.input.onLongPress = this.longPressCallback
    this._initParticles()
  }

  // ============================================
  // 初始化背景粒子系统
  // ============================================
  _initParticles() {
    const w = this.game.renderer.designWidth
    const h = this.game.renderer.designHeight
    this.particles = []
    const count = 25  // 20-30个小星星粒子

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 1.5 + Math.random() * 2.5,  // 1.5~4px
        speedY: 8 + Math.random() * 15,    // 8~23px/s 缓慢飘落
        speedX: -2 + Math.random() * 4,   // 轻微左右漂移
        alpha: 0.3 + Math.random() * 0.5, // 0.3~0.8 不同透明度
        twinkle: Math.random() * Math.PI * 2  // 闪烁相位
      })
    }
  }

  _onTouchStart(x, y) {
    const w = this.game.renderer.designWidth
    const h = this.game.renderer.designHeight
    const btnW = 280, btnH = 72
    const btnX = (w - btnW) / 2
    const btnY = h * 0.68

    if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
      this.touchedBtn = 'enterBtn'
    } else {
      this.touchedBtn = null
    }
  }

  _onTouchEnd() {
    this.touchedBtn = null
    this.longPressGlow = 0  // 松手后重置光晕
  }

  _onLongPress(x, y) {
    const w = this.game.renderer.designWidth
    const h = this.game.renderer.designHeight
    const btnW = 280, btnH = 72
    const btnX = (w - btnW) / 2
    const btnY = h * 0.68

    if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
      // 长按"进入游戏"按钮 → 增强光晕效果
      this.longPressGlow = 1
    }
  }

  _onTap(x, y) {
    if (!this.ready) return

    const w = this.game.renderer.designWidth
    const h = this.game.renderer.designHeight
    const btnW = 280, btnH = 72
    const btnX = (w - btnW) / 2
    const btnY = h * 0.68

    if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
      // 检测新手引导状态
      const progress = this.game.storage.loadTutorialProgress()
      if (progress.completed) {
        // 已完成引导 → 进入主菜单
        this.game.sceneManager.changeScene('main')
      } else {
        // 未完成引导 → 进入教程场景
        this.game.sceneManager.changeScene('tutorial')
      }
    }
  }

  update(dt) {
    // 淡入动画
    if (this.opacity < 1) {
      this.opacity += dt * 1.5
      if (this.opacity >= 1) {
        this.opacity = 1
        this.ready = true
      }
      // 淡入过程中缓存失效，每次 opacity 变化都重新绘制静态背景
      this._bgCacheValid = false
    }

    // 按钮呼吸效果
    this.pulse += dt * 2 * this.pulseDir
    if (this.pulse > 1) { this.pulse = 1; this.pulseDir = -1 }
    if (this.pulse < 0) { this.pulse = 0; this.pulseDir = 1 }

    // 长按光晕渐消
    if (this.longPressGlow > 0 && this.touchedBtn !== 'enterBtn') {
      this.longPressGlow = Math.max(0, this.longPressGlow - dt * 2)
    }

    // 更新粒子位置
    const h = this.game.renderer.designHeight
    for (const p of this.particles) {
      p.y += p.speedY * dt
      p.x += p.speedX * dt
      p.twinkle += dt * 2

      // 从底部出来后回到顶部
      if (p.y > h + 5) {
        p.y = -5
        p.x = Math.random() * this.game.renderer.designWidth
      }
      // 左右边界循环
      const w = this.game.renderer.designWidth
      if (p.x < -5) p.x = w + 5
      if (p.x > w + 5) p.x = -5
    }
  }

  // ============================================
  // 绘制渐变色文字
  // ============================================
  _drawGradientText(r, text, x, y, fromColor, toColor, fontSize, opacity = 1) {
    const sx = x * r.scaleX
    const sy = y * r.scaleY
    const sf = fontSize * Math.min(r.scaleX, r.scaleY)

    // 创建线性渐变（水平方向）
    const gradient = r.ctx.createLinearGradient(sx - sf * 2, sy, sx + sf * 2, sy)
    gradient.addColorStop(0, fromColor)
    gradient.addColorStop(0.5, toColor)
    gradient.addColorStop(1, fromColor)

    r.ctx.save()
    r.ctx.fillStyle = gradient
    r.ctx.globalAlpha = opacity
    r.ctx.font = `bold ${sf}px Arial, sans-serif`
    r.ctx.textAlign = 'center'
    r.ctx.textBaseline = 'middle'
    r.ctx.fillText(text, sx, sy)
    r.ctx.restore()
  }

  // ============================================
  // 绘制带描边的文字
  // ============================================
  _drawTextWithStroke(r, text, x, y, fillColor, strokeColor, fontSize, strokeWidth, opacity = 1) {
    const sx = x * r.scaleX
    const sy = y * r.scaleY
    const sf = fontSize * Math.min(r.scaleX, r.scaleY)

    r.ctx.save()
    r.ctx.globalAlpha = opacity

    // 先画描边
    r.ctx.strokeStyle = strokeColor
    r.ctx.lineWidth = strokeWidth * r.scaleX
    r.ctx.font = `bold ${sf}px Arial, sans-serif`
    r.ctx.textAlign = 'center'
    r.ctx.textBaseline = 'middle'
    r.ctx.strokeText(text, sx, sy)

    // 再画填充
    r.ctx.fillStyle = fillColor
    r.ctx.fillText(text, sx, sy)

    r.ctx.restore()
  }

  // ============================================
  // 绘制带发光边框的按钮
  // ============================================
  _drawGlowButton(r, btn, glowIntensity, pressed) {
    const sx = btn.x * r.scaleX
    const sy = btn.y * r.scaleY
    const sw = btn.w * r.scaleX
    const sh = btn.h * r.scaleY
    const sr = 16 * Math.min(r.scaleX, r.scaleY)

    // 发光边框效果（避免 shadowBlur 性能开销）
    const glowSize = 4 + glowIntensity * 8  // 4px~12px
    const glowAlpha = 0.3 + glowIntensity * 0.4  // 0.3~0.7

    // 低端设备检测：分辨率低于 200 万像素且无 hiDPI 标识视为低端
    const canvas = r.ctx.canvas
    const totalPixels = canvas.width * canvas.height
    const isLowEnd = totalPixels < 2000000 && r.scaleX <= 1.5

    r.ctx.save()

    if (isLowEnd) {
      // 低端设备：简化发光为纯色描边 + 透明度叠加（无 shadowBlur）
      r.ctx.globalAlpha = glowAlpha * 0.6
      r.ctx.strokeStyle = COLORS.primary
      r.ctx.lineWidth = 2 * r.scaleX

      // 绘制描边矩形
      const borderRect = {
        x: btn.x - 3,
        y: btn.y - 3,
        w: btn.w + 6,
        h: btn.h + 6
      }
      this._drawStrokeRoundRect(r, borderRect, 16, r.ctx.strokeStyle, 2)
    } else {
      // 高端设备：用径向渐变模拟发光效果（替代 shadowBlur）
      const centerX = sx + sw / 2
      const centerY = sy + sh / 2
      const radius = Math.max(sw, sh) * 0.8

      // 创建径向渐变：中心亮 → 边缘暗
      const gradient = r.ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, radius
      )
      gradient.addColorStop(0, this._hexToRgba(COLORS.primary, glowAlpha))
      gradient.addColorStop(0.5, this._hexToRgba(COLORS.primary, glowAlpha * 0.4))
      gradient.addColorStop(1, this._hexToRgba(COLORS.primary, 0))

      // 绘制发光层（渐变填充矩形）
      r.ctx.globalAlpha = 1
      r.ctx.fillStyle = gradient

      // 绘制圆角矩形区域
      r.ctx.beginPath()
      r.ctx.moveTo(sx + sr, sy - glowSize)
      r.ctx.lineTo(sx + sw - sr, sy - glowSize)
      r.ctx.arcTo(sx + sw + glowSize, sy, sx + sw + glowSize, sy + sr, sr + glowSize)
      r.ctx.lineTo(sx + sw + glowSize, sy + sh - sr)
      r.ctx.arcTo(sx + sw + glowSize, sy + sh + glowSize, sx + sw - sr, sy + sh + glowSize, sr + glowSize)
      r.ctx.lineTo(sx + sr, sy + sh + glowSize)
      r.ctx.arcTo(sx - glowSize, sy + sh + glowSize, sx - glowSize, sy + sh - sr, sr + glowSize)
      r.ctx.lineTo(sx - glowSize, sy + sr)
      r.ctx.arcTo(sx - glowSize, sy, sx + sr, sy, sr + glowSize)
      r.ctx.closePath()
      r.ctx.fill()
    }

    r.ctx.restore()

    // 绘制主按钮背景
    r.fillRoundRect(btn.x, btn.y, btn.w, btn.h, 16, THEME.buttons.primary.bgColor)

    // 按压时叠加半透明暗色层
    if (pressed) {
      r.fillRoundRect(btn.x, btn.y, btn.w, btn.h, 16, THEME.colors.bgPanel)
    }

    // 绘制按钮文字
    const sf = FONT.subtitle.size * Math.min(r.scaleX, r.scaleY)
    r.ctx.save()
    r.ctx.fillStyle = COLORS.white
    r.ctx.font = `bold ${sf}px Arial, sans-serif`
    r.ctx.textAlign = 'center'
    r.ctx.textBaseline = 'middle'
    // 文字阴影改用简化的 offset shadow（避免 shadowBlur）
    r.ctx.fillText(btn.text, btn.x + btn.w / 2 + 1, btn.y + btn.h / 2 + 1)
    r.ctx.restore()
  }

  // ============================================
  // 辅助：绘制描边圆角矩形（无 shadowBlur）
  // ============================================
  _drawStrokeRoundRect(r, rect, radius, color, lineWidth) {
    const sx = rect.x * r.scaleX
    const sy = rect.y * r.scaleY
    const sw = rect.w * r.scaleX
    const sh = rect.h * r.scaleY
    const sr = radius * Math.min(r.scaleX, r.scaleY)

    r.ctx.strokeStyle = color
    r.ctx.lineWidth = lineWidth * r.scaleX
    r.ctx.beginPath()
    r.ctx.moveTo(sx + sr, sy)
    r.ctx.lineTo(sx + sw - sr, sy)
    r.ctx.arcTo(sx + sw, sy, sx + sw, sy + sr, sr)
    r.ctx.lineTo(sx + sw, sy + sh - sr)
    r.ctx.arcTo(sx + sw, sy + sh, sx + sw - sr, sy + sh, sr)
    r.ctx.lineTo(sx + sr, sy + sh)
    r.ctx.arcTo(sx, sy + sh, sx, sy + sh - sr, sr)
    r.ctx.lineTo(sx, sy + sr)
    r.ctx.arcTo(sx, sy, sx + sr, sy, sr)
    r.ctx.closePath()
    r.ctx.stroke()
  }

  // ============================================
  // 辅助：HEX 转 RGBA 字符串
  // ============================================
  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }

  render(r) {
    const w = r.designWidth
    const h = r.designHeight
    const a = this.opacity

    // ================================================
    // 静态区域 Canvas 缓存（标题+装饰+版本号）
    // 仅在淡入过程中（opacity < 1）失效，需要重新渲染
    // ================================================
    const needsRefresh = !this._bgCacheValid || this._bgCache === null
    if (needsRefresh) {
      // 创建离屏 Canvas（逻辑分辨率大小）
      if (this._bgCache === null) {
        this._bgCache = wx.createCanvas()
        this._bgCache.width = w
        this._bgCache.height = h
      }
      const cacheCtx = this._bgCache.getContext('2d')
      cacheCtx.clearRect(0, 0, w, h)

      // 绘制静态元素到缓存
      // 背景
      cacheCtx.fillStyle = THEME.colors.bgDark
      cacheCtx.fillRect(0, 0, w, h)

      // 装饰星点
      cacheCtx.fillStyle = COLORS.white + '66'
      this._fillCircleCache(cacheCtx, w * 0.15, h * 0.12, 2)
      cacheCtx.fillStyle = COLORS.white + '4d'
      this._fillCircleCache(cacheCtx, w * 0.75, h * 0.18, 1.5)
      cacheCtx.fillStyle = COLORS.white + '80'
      this._fillCircleCache(cacheCtx, w * 0.55, h * 0.08, 1)
      cacheCtx.fillStyle = COLORS.white + '33'
      this._fillCircleCache(cacheCtx, w * 0.85, h * 0.35, 2)
      cacheCtx.fillStyle = COLORS.white + '4d'
      this._fillCircleCache(cacheCtx, w * 0.25, h * 0.45, 1.5)

      // 主标题（无 opacity 影响，完整绘制）
      const titleY = h * 0.32
      this._drawTextWithStrokeCache(cacheCtx, '三消宝可梦', w / 2 + 2, titleY + 2, COLORS.white, '#000000', FONT.title.size + 2, 4, 1)
      this._drawGradientTextCache(cacheCtx, '三消宝可梦', w / 2, titleY, COLORS.primary, COLORS.gold, FONT.title.size + 2, 1)

      // 副标题
      const subtitleY = h * 0.42
      this._drawTextWithStrokeCache(cacheCtx, '✦ 三消冒险 ✦', w / 2, subtitleY, COLORS.gold, '#000000', FONT.small.size + 2, 2, 1)

      // 装饰性星星/宝可梦球 emoji
      const decorY = h * 0.86
      cacheCtx.fillStyle = COLORS.gold + '80'
      cacheCtx.font = `${FONT.small.size}px Arial, sans-serif`
      cacheCtx.textAlign = 'center'
      cacheCtx.textBaseline = 'middle'
      cacheCtx.fillText('✨ ⭐ ✨ ⭐ ✨', w / 2, decorY)

      // 版本号装饰
      const decoY = h * 0.88
      this._drawDecoEmojisCache(cacheCtx, '◈', w * 0.15, decoY, 1)
      this._drawDecoEmojisCache(cacheCtx, '◈', w * 0.85, decoY, 1)

      // 中间装饰线
      const lineWidth = 60
      const lineX = (w - lineWidth) / 2
      cacheCtx.globalAlpha = 0.3
      cacheCtx.strokeStyle = COLORS.gold
      cacheCtx.lineWidth = 1
      cacheCtx.beginPath()
      cacheCtx.moveTo(lineX, decoY)
      cacheCtx.lineTo(lineX + lineWidth, decoY)
      cacheCtx.stroke()
      cacheCtx.globalAlpha = 1

      // 版本号
      cacheCtx.fillStyle = COLORS.textMuted
      cacheCtx.font = `${FONT.tiny.size}px Arial, sans-serif`
      cacheCtx.fillText('v0.1.0', w / 2, h * 0.93)

      // 底部星星 emoji
      cacheCtx.fillStyle = COLORS.gold + '80'
      cacheCtx.font = `${FONT.tiny.size}px Arial, sans-serif`
      cacheCtx.fillText('✨ ⭐ ✨ ⭐ ✨', w / 2, h * 0.96)

      this._bgCacheValid = true
    }

    // ================================================
    // 渲染：先绘制缓存的静态背景，再叠加动态元素
    // ================================================

    // 1. 绘制缓存的背景（带整体透明度）
    r.ctx.save()
    r.ctx.globalAlpha = a
    r.ctx.drawImage(this._bgCache, 0, 0, w, h)
    r.ctx.restore()

    // 2. 绘制动态粒子层
    this._drawParticles(r)

    // 3. 绘制进入游戏按钮（动态：发光脉动 + 按压反馈）
    if (this.ready) {
      const isPressed = this.touchedBtn === 'enterBtn'
      const pressScale = isPressed ? 0.95 : 1
      const enterBtn = {
        x: (w - 280 * pressScale) / 2,
        y: h * 0.68 + (72 - 72 * pressScale) / 2,
        w: 280 * pressScale,
        h: 72 * pressScale,
        text: '进 入 游 戏'
      }
      const glowIntensity = this.pulse + this.longPressGlow * 0.5
      this._drawGlowButton(r, enterBtn, glowIntensity, isPressed)

      // 提示文字（动态透明度）
      const hintAlpha = Math.round((0.4 + this.pulse * 0.3) * 255).toString(16).padStart(2, '0')
      r.fillText('点击开始你的冒险之旅', w / 2, h * 0.82, COLORS.textSecondary + hintAlpha, FONT.small.size)
    }
  }

  // ================================================
  // 缓存辅助：绘制圆形（离屏 Canvas）
  // ================================================
  _fillCircleCache(ctx, x, y, radius) {
    const sr = radius
    ctx.beginPath()
    ctx.arc(x, y, sr, 0, Math.PI * 2)
    ctx.fill()
  }

  // ================================================
  // 缓存辅助：渐变文字（离屏 Canvas）
  // ================================================
  _drawGradientTextCache(ctx, text, x, y, fromColor, toColor, fontSize, opacity = 1) {
    const gradient = ctx.createLinearGradient(x - fontSize * 2, y, x + fontSize * 2, y)
    gradient.addColorStop(0, fromColor)
    gradient.addColorStop(0.5, toColor)
    gradient.addColorStop(1, fromColor)

    ctx.globalAlpha = opacity
    ctx.fillStyle = gradient
    ctx.font = `bold ${fontSize}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x, y)
    ctx.globalAlpha = 1
  }

  // ================================================
  // 缓存辅助：描边文字（离屏 Canvas）
  // ================================================
  _drawTextWithStrokeCache(ctx, text, x, y, fillColor, strokeColor, fontSize, strokeWidth, opacity = 1) {
    ctx.globalAlpha = opacity
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = strokeWidth
    ctx.font = `bold ${fontSize}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeText(text, x, y)

    ctx.fillStyle = fillColor
    ctx.fillText(text, x, y)
    ctx.globalAlpha = 1
  }

  // ================================================
  // 缓存辅助：装饰性小符号（离屏 Canvas）
  // ================================================
  _drawDecoEmojisCache(ctx, emoji, x, y, opacity) {
    ctx.globalAlpha = opacity * 0.6
    ctx.fillStyle = COLORS.gold
    ctx.font = `${FONT.small.size}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(emoji, x, y)
    ctx.globalAlpha = 1
  }

  // ============================================
  // 绘制背景粒子（小星星飘落）
  // 优化：batch 绘制 + 视口裁剪
  // ============================================
  _drawParticles(r) {
    const w = r.designWidth
    const h = r.designHeight
    const scale = Math.min(r.scaleX, r.scaleY)

    // 一次性设置全局透明度（避免每个粒子重复设置）
    r.ctx.save()
    r.ctx.globalAlpha = this.opacity
    r.ctx.fillStyle = COLORS.white

    // 使用单一 beginPath 批量绘制所有菱形粒子
    r.ctx.beginPath()

    for (const p of this.particles) {
      // 视口裁剪：超出屏幕的粒子跳过绘制
      const sx = p.x * r.scaleX
      const sy = p.y * r.scaleY
      if (sx < -10 || sx > w * r.scaleX + 10 || sy < -10 || sy > h * r.scaleY + 10) {
        continue
      }

      // 闪烁效果：透明度在基础值上波动
      const twinkleAlpha = 0.7 + 0.3 * Math.sin(p.twinkle)
      // 暂存当前粒子的透明度（用 rgba 解决单个粒子透明度差异）
      const finalAlpha = p.alpha * twinkleAlpha

      const size = p.size * scale
      // 菱形顶点
      r.ctx.moveTo(sx, sy - size)
      r.ctx.lineTo(sx + size * 0.6, sy)
      r.ctx.lineTo(sx, sy + size)
      r.ctx.lineTo(sx - size * 0.6, sy)
      r.ctx.closePath()
    }

    // 批量 fill（所有粒子用相同颜色和透明度）
    r.ctx.fill()

    // 闪烁粒子需要单独处理（透明度不同）
    r.ctx.globalAlpha = this.opacity
    for (const p of this.particles) {
      const sx = p.x * r.scaleX
      const sy = p.y * r.scaleY
      // 视口裁剪
      if (sx < -10 || sx > w * r.scaleX + 10 || sy < -10 || sy > h * r.scaleY + 10) {
        continue
      }

      const twinkleAlpha = 0.7 + 0.3 * Math.sin(p.twinkle)
      const finalAlpha = p.alpha * twinkleAlpha

      // 透明度差异大的粒子单独绘制
      if (finalAlpha < 0.85) {
        const size = p.size * scale
        r.ctx.beginPath()
        r.ctx.moveTo(sx, sy - size)
        r.ctx.lineTo(sx + size * 0.6, sy)
        r.ctx.lineTo(sx, sy + size)
        r.ctx.lineTo(sx - size * 0.6, sy)
        r.ctx.closePath()
        r.ctx.globalAlpha = finalAlpha
        r.ctx.fill()
        r.ctx.globalAlpha = this.opacity
      }
    }

    r.ctx.restore()
  }

  destroy() {
    this.game.input.onTap = null
    this.game.input.onTouchStart = null
    this.game.input.onTouchEnd = null
    this.game.input.onLongPress = null
    // 释放离屏 Canvas 缓存
    this._bgCache = null
    this._bgCacheValid = false
  }
}