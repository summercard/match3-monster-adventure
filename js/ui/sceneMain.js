// ============================================
// ui/sceneMain.js - 主菜单场景
// ============================================
import { THEME } from '../engine/theme.js'

export class SceneMain {
  constructor(game, data) {
    this.game = game
    this.buttons = []
    this.touchedBtn = null  // 当前按下的按钮
    this.tapCallback = this._onTap.bind(this)
    this.touchStartCallback = this._onTouchStart.bind(this)
    this.touchEndCallback = this._onTouchEnd.bind(this)
    this.longPressCallback = this._onLongPress.bind(this)

    // 长按 Toast 状态
    this._tooltip = null  // { text, x, y, timer, opacity }

    // 背景粒子系统
    this.particles = []
    this._particleTimer = 0

    // Canvas 缓存（静态区域预渲染）
    this._bgCache = null      // 离屏 Canvas：背景+信息栏+标题
    this._bgCacheValid = false // 缓存是否需要刷新
  }

  init(data) {
    console.log('[SceneMain] 主菜单初始化')
    this._loadPlayerData()
    this._buildButtons()
    this._initParticles()
    this.game.input.onTap = this.tapCallback
    this.game.input.onTouchStart = this.touchStartCallback
    this.game.input.onTouchEnd = this.touchEndCallback
    this.game.input.onLongPress = this.longPressCallback

    // 构建离屏 Canvas 缓存（静态区域）
    this._buildBgCache()
  }

  // ================================================
  // 构建离屏 Canvas 缓存（静态背景+信息栏+标题）
  // ================================================
  _buildBgCache() {
    const w = this.game.renderer.designWidth
    const h = this.game.renderer.designHeight
    const dpr = this.game.renderer.dpr || 1

    if (this._bgCache === null) {
      this._bgCache = wx.createCanvas()
      this._bgCache.width = Math.ceil(w * dpr)
      this._bgCache.height = Math.ceil(h * dpr)
    }
    const ctx = this._bgCache.getContext('2d')
    // 按 DPR 缩放，让绘制坐标和主 Canvas 一致
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const c = THEME.colors
    const font = THEME.font

    // 背景
    ctx.fillStyle = c.bgMedium
    ctx.fillRect(0, 0, w, h)

    // === 玩家信息栏 (y: 20~80) ===
    this._drawInfoBarCache(ctx, w, c, font)

    // === 分隔线 (y=100) ===
    ctx.fillStyle = c.bgCard
    ctx.globalAlpha = 0.5
    ctx.fillRect(20, 100, w - 40, 1)
    ctx.globalAlpha = 1

    // === 标题 ===
    ctx.fillStyle = c.textPrimary
    ctx.font = `bold ${font.title.size}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🎮 三消宝可梦', w / 2, 140)

    ctx.fillStyle = c.textSecondary
    ctx.font = `${font.small.size}px Arial, sans-serif`
    ctx.fillText('Match-3 Monster', w / 2, 168)

    // 版本信息
    ctx.fillStyle = c.textMuted
    ctx.font = `${font.small.size}px Arial, sans-serif`
    ctx.fillText('v0.1.0', w / 2, 620)

    this._bgCacheValid = true
  }

  // ================================================
  // 绘制玩家信息栏到离屏 Canvas（带动态占位）
  // ================================================
  _drawInfoBarCache(ctx, w, c, font) {
    // 背景面板
    ctx.fillStyle = c.bgCard
    this._fillRoundRectCache(ctx, 0, 20, w, 60, THEME.radius.md)
    ctx.globalAlpha = 0.9
    ctx.fill()
    ctx.globalAlpha = 1

    // 左侧：头像 + 名称 + 等级
    const avatarX = 30
    const avatarY = 50
    ctx.font = `${font.icon.size}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🎮', avatarX, avatarY)

    ctx.fillStyle = c.textPrimary
    ctx.font = `bold ${font.body.size}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`冒险家  Lv.${this.player.level}`, avatarX + 60, avatarY - 4)

    // 右侧金币（运行时动态覆盖）
    const goldX = w - 120
    ctx.fillStyle = c.gold
    ctx.font = `bold ${font.number.size}px Arial, sans-serif`
    ctx.textAlign = 'right'
    ctx.fillText('💰 ' + this._formatNumber(this.player.gold), w - 30, avatarY - 4)

    // 经验条 (y=65)
    const expBarX = 30
    const expBarY = 65
    const expBarW = w - 160
    const expBarH = 8

    // 经验条背景
    ctx.fillStyle = c.bgDark
    this._fillRoundRectCache(ctx, expBarX, expBarY, expBarW, expBarH, THEME.radius.sm)
    ctx.globalAlpha = 0.9
    ctx.fill()
    ctx.globalAlpha = 1

    // 经验条填充
    const expProgress = Math.min(this.player.exp / this.player.expToLevel, 1)
    if (expProgress > 0) {
      const fillW = Math.floor((expBarW - 4) * expProgress)
      ctx.fillStyle = c.primary
      this._fillRoundRectCache(ctx, expBarX + 2, expBarY + 2, fillW, expBarH - 4, THEME.radius.sm - 1)
      ctx.fill()
    }

    // 经验条文字
    ctx.fillStyle = c.textMuted
    ctx.font = `${font.small.size}px Arial, sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText(`${this.player.exp}/${this.player.expToLevel}`, expBarX + expBarW + 8, expBarY)
  }

  // ================================================
  // 离屏 Canvas 辅助：绘制圆角矩形（无 scale 处理）
  // ================================================
  _fillRoundRectCache(ctx, x, y, w, h, r) {
    const sr = r
    ctx.beginPath()
    ctx.moveTo(x + sr, y)
    ctx.lineTo(x + w - sr, y)
    ctx.arcTo(x + w, y, x + w, y + sr, sr)
    ctx.lineTo(x + w, y + h - sr)
    ctx.arcTo(x + w, y + h, x + w - sr, y + h, sr)
    ctx.lineTo(x + sr, y + h)
    ctx.arcTo(x, y + h, x, y + h - sr, sr)
    ctx.lineTo(x, y + sr)
    ctx.arcTo(x, y, x + sr, y, sr)
    ctx.closePath()
  }

  // ============================================
  // 背景粒子系统 - 缓慢流动的光点
  // ============================================
  _initParticles() {
    const w = this.game.renderer.designWidth
    const h = this.game.renderer.designHeight
    const particleCount = 18

    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 2 + Math.random() * 3,  // 2-5px
        baseOpacity: 0.2 + Math.random() * 0.4,  // 0.2-0.6
        opacity: 0,
        speedX: (Math.random() - 0.5) * 0.3,  // 缓慢移动速度
        speedY: (Math.random() - 0.5) * 0.2,
        phase: Math.random() * Math.PI * 2,  // 闪烁相位
        phaseSpeed: 0.02 + Math.random() * 0.02  // 闪烁速度
      })
    }
  }

  _updateParticles(dt) {
    const w = this.game.renderer.designWidth
    const h = this.game.renderer.designHeight

    for (const p of this.particles) {
      // 移动
      p.x += p.speedX
      p.y += p.speedY

      // 边界环绕
      if (p.x < -10) p.x = w + 10
      if (p.x > w + 10) p.x = -10
      if (p.y < -10) p.y = h + 10
      if (p.y > h + 10) p.y = -10

      // 闪烁脉动
      p.phase += p.phaseSpeed * dt * 60
      const pulse = (Math.sin(p.phase) + 1) / 2  // 0~1
      p.opacity = p.baseOpacity * (0.5 + pulse * 0.5)
    }
  }

  _loadPlayerData() {
    const player = this.game.storage.loadPlayer()
    this.player = {
      name: '冒险家',
      level: player.level || 1,
      gold: player.gold || 0,
      exp: player.exp || 0,
      // 升级所需经验：每100exp升1级
      expToLevel: 100
    }
  }

  _formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  _buildButtons() {
    const w = this.game.renderer.designWidth
    const h = this.game.renderer.designHeight

    // === 2x2 网格布局：中部主要功能按钮 ===
    const primaryBtnW = 150
    const primaryBtnH = 120
    const gridGapX = 20
    const gridGapY = 16
    const gridStartY = 200  // 网格起始 Y（给顶部信息栏和标题留空间）

    // 计算网格水平居中起始 X
    const gridTotalW = primaryBtnW * 2 + gridGapX
    const gridStartX = (w - gridTotalW) / 2

    this.buttons = [
      // 主按钮 2x2 网格
      { id: 'start', text: '⚔️\n开始冒险', emoji: '⚔️', x: gridStartX, y: gridStartY, w: primaryBtnW, h: primaryBtnH, action: () => this.game.sceneManager.changeScene('stageSelect'), primary: true, isGrid: true },
      { id: 'team', text: '👥\n队伍编成', emoji: '👥', x: gridStartX + primaryBtnW + gridGapX, y: gridStartY, w: primaryBtnW, h: primaryBtnH, action: () => this._showTeam(), primary: true, isGrid: true },
      { id: 'album', text: '📖\n怪物图鉴', emoji: '📖', x: gridStartX, y: gridStartY + primaryBtnH + gridGapY, w: primaryBtnW, h: primaryBtnH, action: () => this._showAlbum(), primary: true, isGrid: true },
      { id: 'signIn', text: '📅\n每日签到', emoji: '📅', x: gridStartX + primaryBtnW + gridGapX, y: gridStartY + primaryBtnH + gridGapY, w: primaryBtnW, h: primaryBtnH, action: () => this._showSignIn(), primary: true, isGrid: true },
    ]

    // === 底部横排：次要功能按钮 ===
    const secondaryBtnW = 70
    const secondaryBtnH = 65
    const bottomGap = 14
    const bottomStartY = gridStartY + primaryBtnH * 2 + gridGapY + 30  // 网格下方留白后开始

    // 5 个次要按钮横向排列（商店/背包/设置/成就/...）
    const secondaryBtns = [
      { id: 'shop', text: '🏪\n商店', emoji: '🏪', label: '商店', action: () => this._showShop() },
      { id: 'inventory', text: '🎒\n背包', emoji: '🎒', label: '背包', action: () => this._showInventory() },
      { id: 'achievement', text: '🏆\n成就', emoji: '🏆', label: '成就', action: () => this._showAchievement() },
      { id: 'settings', text: '⚙️\n设置', emoji: '⚙️', label: '设置', action: () => this._showSettings() },
    ]

    // 计算底部按钮横排居中
    const secondaryTotalW = secondaryBtns.length * secondaryBtnW + (secondaryBtns.length - 1) * bottomGap
    const secondaryStartX = (w - secondaryTotalW) / 2

    secondaryBtns.forEach((btn, i) => {
      this.buttons.push({
        id: btn.id,
        text: btn.text,
        emoji: btn.emoji,
        x: secondaryStartX + i * (secondaryBtnW + bottomGap),
        y: bottomStartY,
        w: secondaryBtnW,
        h: secondaryBtnH,
        action: btn.action,
        primary: false,
        isGrid: false
      })
    })
  }

  _showInventory() {
    this.game.sceneManager.changeScene('inventory')
  }

  _showAlbum() {
    this.game.sceneManager.changeScene('album')
  }

  _showTeam() {
    this.game.sceneManager.changeScene('teamSetup')
  }

  _showShop() {
    this.game.sceneManager.changeScene('shop')
  }

  _showSignIn() {
    this.game.sceneManager.changeScene('signIn')
  }

  _showAchievement() {
    this.game.sceneManager.changeScene('achievement')
  }

  _showSettings() {
    this.game.sceneManager.changeScene('settings')
  }

  // ============================================
  // 按钮功能描述（长按 Toast）
  // ============================================
  _getButtonDescription(btnId) {
    const descriptions = {
      'start': '选择关卡，开始三消冒险战斗！',
      'team': '编队你的怪物伙伴，打造最强阵容',
      'album': '查看已收服的怪物图鉴',
      'signIn': '每日签到领取奖励',
      'shop': '购买道具和装备',
      'inventory': '查看和管理你的物品',
      'achievement': '查看冒险成就进度',
      'settings': '游戏设置和选项',
    }
    return descriptions[btnId] || ''
  }

  _onLongPress(x, y) {
    for (const btn of this.buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        const desc = this._getButtonDescription(btn.id)
        if (desc) {
          this._showButtonTooltip(btn, desc)
        }
        return
      }
    }
  }

  _showButtonTooltip(btn, text) {
    // 清除已有 tooltip
    if (this._tooltip && this._tooltip.timer) {
      clearTimeout(this._tooltip.timer)
    }

    // 计算 tooltip 位置：按钮上方居中
    const tipX = btn.x + btn.w / 2
    const tipY = btn.y - 12

    this._tooltip = {
      text: text,
      x: tipX,
      y: tipY,
      opacity: 1,
      timer: setTimeout(() => {
        // 1秒后开始淡出
        this._fadeTooltip()
      }, 800)
    }
  }

  _fadeTooltip() {
    if (!this._tooltip) return
    this._tooltip.opacity -= 0.05
    if (this._tooltip.opacity <= 0) {
      this._tooltip = null
    }
  }

  _onTouchStart(x, y) {
    for (const btn of this.buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        this.touchedBtn = btn
        return
      }
    }
    this.touchedBtn = null
  }

  _onTouchEnd(x, y) {
    this.touchedBtn = null
  }

  _onTap(x, y) {
    for (const btn of this.buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        btn.action()
        return
      }
    }
  }

  update(dt) {
    // tooltip 淡出动画
    if (this._tooltip && this._tooltip.opacity < 1) {
      this._fadeTooltip()
    }
    // 更新背景粒子
    this._updateParticles(dt)
  }

  render(r) {
    const c = THEME.colors
    const font = THEME.font
    const w = this.game.renderer.designWidth
    const h = this.game.renderer.designHeight

    // ================================================
    // 静态区域 Canvas 缓存（背景+标题+版本号）
    // ================================================
    if (this._bgCache === null || !this._bgCacheValid) {
      this._buildBgCache()
    }

    // 绘制缓存的静态背景（离屏 Canvas 已按 DPR 缩放，直接 drawImage 整个画布）
    r.ctx.save()
    r.ctx.setTransform(1, 0, 0, 1, 0, 0) // 重置变换，直接物理像素绘制
    r.ctx.drawImage(this._bgCache, 0, 0)
    r.ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0) // 恢复 DPR 变换
    r.ctx.restore()

    // ================================================
    // 动态绘制层（信息栏+粒子+按钮+Tooltip）
    // ================================================

    // === 背景粒子层（实时更新）===
    for (const p of this.particles) {
      if (p.opacity > 0.01) {
        r.fillCircle(p.x, p.y, p.size, c.primary, p.opacity)
      }
    }

    // === 玩家信息栏（动态：金币/经验实时变化）===
    this._renderInfoBar(r, w, c, font)

    // === 绘制按钮 ===
    for (const btn of this.buttons) {
      const type = btn.primary ? 'primary' : 'secondary'
      const pressed = (this.touchedBtn === btn) ? THEME.buttons[type].pressScale : 1

      if (btn.isGrid) {
        // 2x2 网格主按钮：大尺寸，emoji 大号显示
        const cx = btn.x + btn.w / 2
        const cy = btn.y + btn.h / 2

        // 背景卡片
        r.fillRoundRect(btn.x, btn.y, btn.w, btn.h, THEME.radius.lg, btn.primary ? c.bgCard : c.bgDark, 0.95)

        // 按钮按压效果
        if (this.touchedBtn === btn) {
          r.fillRoundRect(btn.x, btn.y, btn.w, btn.h, THEME.radius.lg, c.primary, 0.2)
        }

        // 大号 emoji 图标
        const emojiSize = btn.primary ? font.display.size : font.icon.size
        r.fillText(btn.emoji, cx, cy - 16, c.primary, emojiSize)

        // 文字标签（emoji 下方）
        const labelY = cy + 20
        const lines = btn.text.split('\n')
        if (lines.length >= 2) {
          r.fillText(lines[1], cx, labelY, c.textPrimary, font.small.size, 'bold')
        }

      } else {
        // 底部横排次要按钮：小尺寸，emoji + 文字标签
        r.drawButton(btn, type, pressed)
        // 在按钮下方绘制文字标签
        const labelText = btn.label || ''
        if (labelText) {
          const cx = btn.x + btn.w / 2
          const labelY = btn.y + btn.h + 4
          r.fillText(labelText, cx, labelY, c.textSecondary, font.small.size, 'center')
        }
      }
    }

    // === 长按 Tooltip ===
    if (this._tooltip && this._tooltip.opacity > 0) {
      const tip = this._tooltip
      const tipAlpha = Math.round(tip.opacity * 230)
      const tipAlphaHex = tipAlpha.toString(16).padStart(2, '0')

      // 背景
      const tipPadding = 10
      const tipTextWidth = tip.text.length * font.small.size * 0.6
      const tipBgX = tip.x - tipTextWidth / 2 - tipPadding
      const tipBgY = tip.y - font.small.size - tipPadding
      const tipBgW = tipTextWidth + tipPadding * 2
      const tipBgH = font.small.size + tipPadding * 2

      r.fillRoundRect(tipBgX, tipBgY, tipBgW, tipBgH, THEME.radius.md, '#1a1a2e' + tipAlphaHex, tip.opacity * 0.9)
      r.fillText(tip.text, tip.x, tip.y, c.textPrimary + tipAlphaHex, font.small.size)
    }
  }

  // ================================================
  // 渲染玩家信息栏（动态：每次 render 实时绘制）
  // ================================================
  _renderInfoBar(r, w, c, font) {
    const avatarX = 30
    const avatarY = 50

    // 刷新玩家数据（金币可能每次都变）
    const player = this.game.storage.loadPlayer()
    this.player.gold = player.gold || 0
    this.player.level = player.level || 1
    this.player.exp = player.exp || 0

    // 经验条进度
    const expProgress = Math.min(this.player.exp / this.player.expToLevel, 1)
    const expBarX = 30
    const expBarY = 65
    const expBarW = w - 160
    const expBarH = 8

    // 经验条填充（覆盖缓存中的空进度条）
    if (expProgress > 0) {
      const fillW = Math.floor((expBarW - 4) * expProgress)
      r.fillRoundRect(expBarX + 2, expBarY + 2, fillW, expBarH - 4, THEME.radius.sm - 1, c.primary)
    }

    // 金币文字（覆盖缓存中的金币值）
    const goldX = w - 120
    r.fillText('💰 ' + this._formatNumber(this.player.gold), goldX, avatarY - 4, c.gold, font.number.size, 'bold')
  }

  destroy() {
    this.game.input.onTap = null
    this.game.input.onTouchStart = null
    this.game.input.onTouchEnd = null
    this.game.input.onLongPress = null
    if (this._tooltip && this._tooltip.timer) {
      clearTimeout(this._tooltip.timer)
    }
    this._tooltip = null
    this.particles = []
    // 释放离屏 Canvas 缓存
    this._bgCache = null
    this._bgCacheValid = false
  }
}