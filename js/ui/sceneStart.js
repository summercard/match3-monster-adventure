// ============================================
// ui/sceneStart.js - 启动/欢迎画面
// ============================================
import { THEME, COLORS, FONT } from '../engine/theme.js'

const START_ASSETS = {
  bg: 'assets/images/start/start_bg_grassland.png',
  logo: 'assets/images/start/start_title_logo.png',
  fireMonster: 'assets/images/start/monster_fire_lizard.png',
  waterMonster: 'assets/images/start/monster_water_cub.png',
  grassMonster: 'assets/images/start/monster_grass_leaf.png',
  gemFire: 'assets/images/start/gem_fire.png',
  gemWater: 'assets/images/start/gem_water.png',
  gemGrass: 'assets/images/start/gem_grass.png',
  gemThunder: 'assets/images/start/gem_thunder.png',
  gemLight: 'assets/images/start/gem_light.png',
  startButton: 'assets/images/start/ui_btn_start.png',
  startButtonNormal: 'assets/images/start/ui_btn_start_normal.png',
  startButtonPressed: 'assets/images/start/ui_btn_start_pressed.png',
  startButtonDisabled: 'assets/images/start/ui_btn_start_disabled.png',
  hintRibbon: 'assets/images/start/ui_hint_ribbon.png',
  versionPlaque: 'assets/images/start/ui_version_plaque.png',
}

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

    // 美术资源：启动页专用拆分资产
    this.artAssets = {}
    this.artReady = false
  }

  init(data) {
    console.log('[SceneStart] 启动画面初始化')
    this.game.input.onTap = this.tapCallback
    this.game.input.onTouchStart = this.touchStartCallback
    this.game.input.onTouchEnd = this.touchEndCallback
    this.game.input.onLongPress = this.longPressCallback
    this._loadArtAssets()
    this._initParticles()
  }

  _loadArtAssets() {
    if (this._artLoadingStarted) return
    this._artLoadingStarted = true

    const entries = Object.entries(START_ASSETS)
    let loadedCount = 0
    this.artAssets = {}

    entries.forEach(([key, src]) => {
      const img = wx.createImage()
      const item = { img, loaded: false, src }
      this.artAssets[key] = item
      img.onload = () => {
        item.loaded = true
        loadedCount++
        this.artReady = loadedCount >= entries.length
        this._bgCacheValid = false
      }
      img.onerror = () => {
        console.warn(`[SceneStart] 美术资源加载失败: ${src}`)
        loadedCount++
        this.artReady = loadedCount >= entries.length
      }
      img.src = src
    })
  }

  _getEnterButtonRect(scale = 1) {
    const w = this.game.renderer.designWidth
    const h = this.game.renderer.designHeight
    const btnW = 280 * scale
    const btnH = 72 * scale
    return {
      x: (w - btnW) / 2,
      y: h * 0.78 + (72 - btnH) / 2,
      w: btnW,
      h: btnH
    }
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
    const btn = this._getEnterButtonRect()

    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
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
    const btn = this._getEnterButtonRect()

    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
      // 长按"进入游戏"按钮 → 增强光晕效果
      this.longPressGlow = 1
    }
  }

  _onTap(x, y) {
    if (!this.ready) return

    const btn = this._getEnterButtonRect()

    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
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

    // 绘制主按钮背景：优先使用拆分出的按钮资产
    const stateAsset = pressed ? this.artAssets.startButtonPressed : this.artAssets.startButtonNormal
    const btnAsset = stateAsset?.loaded ? stateAsset : this.artAssets.startButton
    if (btnAsset && btnAsset.loaded) {
      this._drawImageFit(r, btnAsset.img, btn.x, btn.y, btn.w, btn.h, pressed ? 0.86 : 1)
    } else {
      r.fillRoundRect(btn.x, btn.y, btn.w, btn.h, 16, THEME.buttons.primary.bgColor)
    }

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
    r.ctx.globalAlpha = 0.45
    r.ctx.fillStyle = THEME.colors.bgDark
    r.ctx.fillText(btn.text, sx + sw / 2 + 1 * r.scaleX, sy + sh / 2 + 2 * r.scaleY)
    r.ctx.globalAlpha = 1
    r.ctx.fillStyle = COLORS.white
    r.ctx.fillText(btn.text, sx + sw / 2, sy + sh / 2)
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

    if (this.artAssets.bg && this.artAssets.bg.loaded) {
      this._renderArtStartScreen(r, w, h, a)
      return
    }

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
        ...this._getEnterButtonRect(pressScale),
        text: '进 入 游 戏'
      }
      const glowIntensity = this.pulse + this.longPressGlow * 0.5
      this._drawGlowButton(r, enterBtn, glowIntensity, isPressed)

      // 提示文字（动态透明度）
      const hintAlpha = Math.round((0.4 + this.pulse * 0.3) * 255).toString(16).padStart(2, '0')
      r.fillText('点击开始你的冒险之旅', w / 2, h * 0.82, COLORS.textSecondary + hintAlpha, FONT.small.size)
    }
  }

  _renderArtStartScreen(r, w, h, a) {
    r.ctx.save()
    r.ctx.globalAlpha = a
    this._drawImageCover(r, this.artAssets.bg.img, 0, 0, w, h)
    r.ctx.restore()

    this._drawParticles(r)

    const logo = this.artAssets.logo
    if (logo && logo.loaded) {
      this._drawImageFit(r, logo.img, 20, 20, 335, 178, a)
    } else {
      this._drawTextWithStroke(r, '萌灵消消大冒险', w / 2, h * 0.15, COLORS.gold, '#0b102a', 28, 4, a)
    }

    // 初始三怪物：按前后景错落，形成启动页中心视觉。
    this._drawStartMonster(r, 'fireMonster', 38, 270, 140, a, -2)
    this._drawStartMonster(r, 'waterMonster', 118, 252, 144, a, 0)
    this._drawStartMonster(r, 'grassMonster', 205, 274, 138, a, 2)

    // 五元素宝石环绕，使用正式拆分后的透明宝石资产。
    const gemY = 424
    this._drawStartGem(r, 'gemFire', 112, gemY, 48, a)
    this._drawStartGem(r, 'gemWater', 164, gemY - 16, 52, a)
    this._drawStartGem(r, 'gemGrass', 218, gemY, 48, a)
    this._drawStartGem(r, 'gemThunder', 140, gemY + 42, 46, a)
    this._drawStartGem(r, 'gemLight', 194, gemY + 42, 46, a)

    if (this.ready) {
      const isPressed = this.touchedBtn === 'enterBtn'
      const pressScale = isPressed ? 0.95 : 1
      const enterBtn = {
        ...this._getEnterButtonRect(pressScale),
        text: '开 始 冒 险'
      }
      const glowIntensity = this.pulse + this.longPressGlow * 0.5
      this._drawGlowButton(r, enterBtn, glowIntensity, isPressed)

      this._drawStartHint(r, w, h, a)
    }

    this._drawStartVersion(r, w, h, a)
  }

  _drawStartHint(r, w, h, opacity) {
    const hintAlpha = 0.58 + this.pulse * 0.25
    const ribbon = this.artAssets.hintRibbon
    const x = 55
    const y = h * 0.887
    const rw = 265
    const rh = 42

    r.ctx.save()
    r.ctx.globalAlpha = opacity * hintAlpha
    if (ribbon && ribbon.loaded) {
      this._drawImageFit(r, ribbon.img, x, y, rw, rh, 0.86)
    } else {
      r.fillRoundRect(x, y + 4, rw, 30, 14, THEME.colors.bgPanel)
    }
    r.fillText('点击开始你的冒险之旅', w / 2 + 10, y + rh / 2 + 1, COLORS.white, FONT.small.size)
    r.ctx.restore()
  }

  _drawStartVersion(r, w, h, opacity) {
    const plaque = this.artAssets.versionPlaque
    const pw = 82
    const ph = 30
    const x = (w - pw) / 2
    const y = h * 0.952

    r.ctx.save()
    r.ctx.globalAlpha = opacity * 0.72
    if (plaque && plaque.loaded) {
      this._drawImageFit(r, plaque.img, x, y, pw, ph, 0.78)
    }
    r.fillText('v0.1.0', w / 2, y + ph / 2, COLORS.white, FONT.tiny.size)
    r.ctx.restore()
  }

  _drawStartMonster(r, key, x, y, size, opacity, bobOffset) {
    const asset = this.artAssets[key]
    if (!asset || !asset.loaded) return
    const bob = Math.sin(this.pulse * Math.PI * 2 + bobOffset) * 4
    this._drawImageFit(r, asset.img, x, y + bob, size, size, opacity)
  }

  _drawStartGem(r, key, x, y, size, opacity) {
    const asset = this.artAssets[key]
    if (!asset || !asset.loaded) return
    const glow = 1 + this.pulse * 0.08
    const drawSize = size * glow
    this._drawImageFit(r, asset.img, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize, opacity)
  }

  _drawImageFit(r, img, x, y, w, h, opacity = 1) {
    const sx = x * r.scaleX
    const sy = y * r.scaleY
    const sw = w * r.scaleX
    const sh = h * r.scaleY
    r.ctx.save()
    r.ctx.globalAlpha *= opacity
    r.ctx.drawImage(img, sx, sy, sw, sh)
    r.ctx.restore()
  }

  _drawImageCover(r, img, x, y, w, h) {
    const srcRatio = img.width / img.height
    const dstRatio = w / h
    let sx = 0, sy = 0, sw = img.width, sh = img.height
    if (srcRatio > dstRatio) {
      sw = img.height * dstRatio
      sx = (img.width - sw) / 2
    } else {
      sh = img.width / dstRatio
      sy = (img.height - sh) / 2
    }
    r.ctx.drawImage(
      img,
      sx, sy, sw, sh,
      x * r.scaleX, y * r.scaleY, w * r.scaleX, h * r.scaleY
    )
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
