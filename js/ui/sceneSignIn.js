// ============================================
// ui/sceneSignIn.js - 每日签到场景
// ============================================

import { THEME, COLORS } from '../engine/theme.js'

export class SceneSignIn {
  constructor(game, data) {
    this.game = game
    this.tapCallback = this._onTap.bind(this)
    this.signInData = null
    this.canSignIn = false
    this.hasSignedIn = false
    this.particles = []  // 撒花粒子
    this.floatingRewards = []  // 飘字奖励
    this.animationComplete = false
  }

  init(data) {
    console.log('[SceneSignIn] 签到场景初始化')
    
    // 加载签到数据
    this.signInData = this.game.storage.loadSignInData()
    this.canSignIn = this.game.storage.canSignInToday()
    this.hasSignedIn = !this.canSignIn

    this.game.input.onTap = this.tapCallback

    // 重置动画状态
    this.particles = []
    this.floatingRewards = []
    this.animationComplete = false
  }

  // 执行签到
  doSignIn() {
    if (!this.canSignIn) return

    const reward = this.game.storage.doSignIn()
    if (!reward) return

    this.canSignIn = false
    this.hasSignedIn = true

    // 更新本地显示数据
    this.signInData = this.game.storage.loadSignInData()

    // 触发成就检查：签到（连续天数）
    if (this.game.achievementManager) {
      const consecutive = this.signInData?.consecutiveDays || 1
      this.game.achievementManager.checkAchievements('signIn', consecutive)
    }

    // 播放金色撒花动画
    this._playSignInEffect(reward)
  }

  // 播放签到特效
  _playSignInEffect(reward) {
    const centerX = this.game.renderer.designWidth / 2
    const centerY = this.game.renderer.designHeight / 2

    // 粒子效果
    const colors = [COLORS.gold, ...COLORS.signIn.particleColors]
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 2 + Math.random() * 4
      const x = centerX + (Math.random() - 0.5) * 100
      const y = centerY + (Math.random() - 0.5) * 60
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1.0,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 6,
        rot: Math.random() * Math.PI * 2
      })
    }

    // 飘字奖励
    this.floatingRewards.push(
      { text: `💰 +${reward.gold}`, x: centerX - 50, y: centerY, vy: -1.5, life: 1.5, color: COLORS.gold },
      { text: `✨ +${reward.exp}`, x: centerX + 20, y: centerY, vy: -1.2, life: 1.5, color: COLORS.success }
    )

    this.animationComplete = true
  }

  _onTap(x, y) {
    // 如果动画进行中，点击任意位置继续
    if (this.animationComplete) {
      // 动画完成后可点击返回
      const backBtn = this._getBackButton()
      if (this._isPointInRect(x, y, backBtn)) {
        this._goBack()
      }
      return
    }

    // 返回按钮
    const backBtn = this._getBackButton()
    if (this._isPointInRect(x, y, backBtn)) {
      this._goBack()
      return
    }

    // 签到按钮
    if (!this.canSignIn) return
    const signBtn = this._getSignInButton()
    if (this._isPointInRect(x, y, signBtn)) {
      this.doSignIn()
    }
  }

  _getBackButton() {
    return { x: 15, y: 15, w: 60, h: 35 }
  }

  _getSignInButton() {
    return { x: 87.5, y: 400, w: 200, h: 60 }
  }

  _isPointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  }

  _goBack() {
    this.game.sceneManager.changeScene('main', {}, 'slide')
  }

  update(dt) {
    // 更新粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.x += p.vx
      p.y += p.vy
      p.vy += 0.15  // 重力
      p.life -= dt * 0.8
      if (p.life <= 0) {
        this.particles.splice(i, 1)
      }
    }

    // 更新飘字
    for (let i = this.floatingRewards.length - 1; i >= 0; i--) {
      const r = this.floatingRewards[i]
      r.y += r.vy
      r.life -= dt
      if (r.life <= 0) {
        this.floatingRewards.splice(i, 1)
      }
    }
  }

  render(r) {
    const w = this.game.renderer.designWidth
    const h = this.game.renderer.designHeight

    // 背景
    r.fillRect(0, 0, w, h, COLORS.bgMedium)

    // 返回按钮
    r.fillRoundRect(15, 15, 60, 35, THEME.radius.sm, THEME.buttons.primary.bgColor)
    r.fillText('← 返回', 45, 33, COLORS.textSecondary, THEME.font.body.size, THEME.font.body.weight)

    // 标题
    r.fillText('📅 每日签到', w / 2, 70, COLORS.textPrimary, THEME.font.title.size, THEME.font.title.weight)

    // 签到统计面板
    const statsY = 110
    const consecutive = this.signInData?.consecutiveDays || 0
    const total = this.signInData?.totalDays || 0

    // 累计签到天数
    r.fillRoundRect(30, statsY, 145, 80, THEME.radius.md, COLORS.bgCard)
    r.fillText('累计签到', 102, statsY + 25, COLORS.textMuted, THEME.font.body.size)
    r.fillText(`${total} 天`, 102, statsY + 55, COLORS.gold, THEME.font.bigNum.size, THEME.font.bigNum.weight)

    // 连续签到天数
    r.fillRoundRect(200, statsY, 145, 80, THEME.radius.md, COLORS.bgCard)
    r.fillText('连续签到', 272, statsY + 25, COLORS.textMuted, THEME.font.body.size)
    r.fillText(`${consecutive} 天`, 272, statsY + 55, COLORS.danger, THEME.font.bigNum.size, THEME.font.bigNum.weight)

    // 7天签到日历
    const calendarY = 215
    r.fillRoundRect(30, calendarY, 315, 70, THEME.radius.md, COLORS.bgCard)
    r.fillText('近7天签到记录', 187, calendarY + 20, COLORS.textMuted, THEME.font.small.size)

    // 生成近7天的日期
    const now = new Date()
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      days.push({
        date: d.getDate(),
        isToday: i === 0,
        signed: this._checkDaySigned(d)
      })
    }

    const cellW = 40
    const startX = 45
    const cellY = calendarY + 40

    for (let i = 0; i < days.length; i++) {
      const day = days[i]
      const cellX = startX + i * cellW

      // 日期圆圈
      if (day.isToday) {
        r.fillCircle(cellX + cellW / 2, cellY + 12, 16, COLORS.gold)
        r.fillText(`${day.date}`, cellX + cellW / 2, cellY + 16, COLORS.bgMedium, THEME.font.body.size, THEME.font.body.weight)
      } else {
        r.fillCircle(cellX + cellW / 2, cellY + 12, 16, day.signed ? COLORS.success : COLORS.textDark)
        r.fillText(`${day.date}`, cellX + cellW / 2, cellY + 16, day.signed ? COLORS.white : COLORS.textMuted, THEME.font.small.size)
      }

      // 签到标记
      if (day.signed) {
        r.fillText('✓', cellX + cellW / 2, cellY + 32, COLORS.success, THEME.font.body.size, THEME.font.body.weight)
      } else {
        r.fillText('?', cellX + cellW / 2, cellY + 32, COLORS.textDark, THEME.font.body.size)
      }
    }

    // 今日奖励预览
    const rewardY = 300
    const reward = this.game.storage.getSignInReward(consecutive)

    r.fillRoundRect(30, rewardY, 315, 80, THEME.radius.md, COLORS.bgCard)
    r.fillText('🎁 今日签到奖励', 187, rewardY + 20, COLORS.textPrimary, THEME.font.body.size, THEME.font.body.weight)
    r.fillText(`💰 金币: +${reward.gold}`, 100, rewardY + 50, COLORS.gold, THEME.font.subtitle.size)
    r.fillText(`✨ 经验: +${reward.exp}`, 230, rewardY + 50, COLORS.success, THEME.font.subtitle.size)

    // 签到按钮或已签到提示
    const signBtn = this._getSignInButton()

    if (this.canSignIn) {
      // 可签到状态
      r.fillRoundRect(signBtn.x, signBtn.y, signBtn.w, signBtn.h, THEME.radius.lg, COLORS.gold)
      r.fillText('🎊 签到领奖', signBtn.x + signBtn.w / 2, signBtn.y + signBtn.h / 2 + 8, COLORS.bgMedium, THEME.font.title.size, THEME.font.title.weight)
    } else {
      // 已签到状态
      r.fillRoundRect(signBtn.x, signBtn.y, signBtn.w, signBtn.h, THEME.radius.lg, COLORS.textMuted)
      r.fillText('✅ 今日已签到', signBtn.x + signBtn.w / 2, signBtn.y + signBtn.h / 2 + 8, COLORS.textSecondary, THEME.font.subtitle.size, THEME.font.subtitle.weight)
    }

    // 绘制粒子效果
    for (const p of this.particles) {
      r.ctx.save()
      r.ctx.translate(p.x, p.y)
      r.ctx.rotate(p.rot)
      r.ctx.globalAlpha = Math.max(0, p.life)
      r.fillRect(-p.size / 2, -p.size / 2, p.size, p.size, p.color)
      r.ctx.restore()
    }

    // 绘制飘字奖励
    for (const reward of this.floatingRewards) {
      const alpha = Math.min(1, reward.life)
      r.ctx.globalAlpha = alpha
      r.fillText(reward.text, reward.x, reward.y, reward.color, THEME.font.subtitle.size, THEME.font.subtitle.weight)
      r.ctx.globalAlpha = 1
    }

    // 动画完成后显示提示
    if (this.animationComplete && this.particles.length === 0) {
      r.fillText('🎉 签到成功！奖励已发放', w / 2, 480, COLORS.gold, THEME.font.body.size, THEME.font.body.weight)
      r.fillText('点击任意区域继续', w / 2, 510, COLORS.textMuted, THEME.font.small.size)
    }
  }

  _checkDaySigned(date) {
    if (!this.signInData?.lastSignInDate) return false

    const signed = new Date(this.signInData.lastSignInDate)
    return (
      signed.getFullYear() === date.getFullYear() &&
      signed.getMonth() === date.getMonth() &&
      signed.getDate() === date.getDate()
    )
  }

  destroy() {
    this.game.input.onTap = null
  }
}