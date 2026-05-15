// ============================================
// ui/sceneStageSelect.js - 关卡选择场景（章节分页版）
// ============================================

import { THEME, COLORS } from '../engine/theme.js'
import { chapters as STAGE_CHAPTERS } from '../../data/stages.js'

export class SceneStageSelect {
  constructor(game, data) {
    this.game = game
    this.storage = game.storage
    this.chapters = []
    this.cardW = 300
    this.cardH = 60
    this.cards = []
    this.tapCallback = this._onTap.bind(this)
    this.touchStartCallback = this._onTouchStart.bind(this)
    this.touchEndCallback = this._onTouchEnd.bind(this)
    this.touchedBtn = null  // 当前按下的按钮ID

    // 章节分页状态
    this.currentChapterIndex = 0  // 当前显示的章节索引（0-based）

    // 扫荡确认弹窗状态
    this.sweepDialog = {
      active: false,
      stageId: null,
      stageName: ''
    }

    // 扫荡动画状态
    this.sweepAnim = {
      active: false,
      progress: 0,   // 0-1
      gold: 0,
      exp: 0
    }

    // 章节切换动画
    this.chapterAnim = {
      active: false,
      progress: 0,   // 0-1
      direction: 1   // 1=向左（下一章）, -1=向右（上一章）
    }

    // 设计尺寸
    this.designW = 375
    this.designH = 667
  }

  init(data) {
    console.log('[SceneStageSelect] 关卡选择初始化')
    this._loadStageData()
    // 如果传入了 chapterIndex，跳转到对应章节
    if (data && typeof data.chapterIndex === 'number') {
      this.currentChapterIndex = Math.max(0, Math.min(data.chapterIndex, this.chapters.length - 1))
    }
    this._buildCards()
    this.game.input.onTap = this.tapCallback
    this.game.input.onTouchStart = this.touchStartCallback
    this.game.input.onTouchEnd = this.touchEndCallback
  }

  _loadStageData() {
    this.chapters = STAGE_CHAPTERS || []
  }

  _buildCards() {
    this.cards = []
    const startY = 140  // 章节标题栏下方开始
    const gap = 12
    let y = startY

    // 只构建当前章节的卡片
    if (this.chapters.length === 0) return

    const chapter = this.chapters[this.currentChapterIndex]
    if (!chapter) return

    // 关卡列表
    for (const stage of chapter.stages) {
      const isBoss = stage.type === 'boss'
      const isElite = stage.type === 'elite'
      const stars = this.storage.getStageStars(stage.id)
      const canSweep = this.storage.canSweep(stage.id)

      let icon = '⚔️'
      if (isBoss) icon = '🔴'
      if (isElite) icon = '💎'

      this.cards.push({
        type: 'stage',
        id: stage.id,
        text: `${icon} ${stage.name}`,
        x: (this.designW - this.cardW) / 2,
        y: y,
        w: this.cardW,
        h: this.cardH,
        enabled: true,
        chapterId: chapter.id,
        stageData: stage,
        stars: stars,
        canSweep: canSweep,
        isElite: isElite
      })
      y += this.cardH + gap
    }
  }

  _switchChapter(direction) {
    const newIndex = this.currentChapterIndex + direction
    if (newIndex < 0 || newIndex >= this.chapters.length) return

    // 启动切换动画
    this.chapterAnim.active = true
    this.chapterAnim.progress = 0
    this.chapterAnim.direction = direction
    this.currentChapterIndex = newIndex
    this._buildCards()
  }

  _onTouchStart(x, y) {
    // 扫荡弹窗/动画进行中不追踪
    if (this.sweepDialog.active || this.sweepAnim.active || this.chapterAnim.active) {
      this.touchedBtn = null
      return
    }

    // 检查返回按钮
    if (x < 60 && y < 40) {
      this.touchedBtn = 'backBtn'
      return
    }

    // 检查上一章按钮（标题栏左侧）
    if (this.currentChapterIndex > 0) {
      if (x >= 10 && x <= 50 && y >= 75 && y <= 115) {
        this.touchedBtn = 'prevChapter'
        return
      }
    }

    // 检查下一章按钮（标题栏右侧）
    if (this.currentChapterIndex < this.chapters.length - 1) {
      if (x >= this.designW - 50 && x <= this.designW - 10 && y >= 75 && y <= 115) {
        this.touchedBtn = 'nextChapter'
        return
      }
    }

    // 检查关卡卡片
    for (const card of this.cards) {
      if (!card.enabled) continue
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        this.touchedBtn = card.id
        return
      }
    }
    this.touchedBtn = null
  }

  _onTouchEnd() {
    this.touchedBtn = null
  }

  _onTap(x, y) {
    // 处理扫荡确认弹窗
    if (this.sweepDialog.active) {
      const dlgW = 260
      const dlgH = 160
      const dlgX = (this.designW - dlgW) / 2
      const dlgY = (this.designH - dlgH) / 2

      // 确认按钮
      const confirmBtn = { x: dlgX + 20, y: dlgY + 95, w: 100, h: 40 }
      // 取消按钮
      const cancelBtn = { x: dlgX + 140, y: dlgY + 95, w: 100, h: 40 }

      if (x >= confirmBtn.x && x <= confirmBtn.x + confirmBtn.w &&
          y >= confirmBtn.y && y <= confirmBtn.y + confirmBtn.h) {
        this._doSweepConfirm()
        return
      }
      if (x >= cancelBtn.x && x <= cancelBtn.x + cancelBtn.w &&
          y >= cancelBtn.y && y <= cancelBtn.y + cancelBtn.h) {
        this.sweepDialog.active = false
        return
      }
      // 点击弹窗外部取消
      if (x < dlgX || x > dlgX + dlgW || y < dlgY || y > dlgY + dlgH) {
        this.sweepDialog.active = false
        return
      }
      return
    }

    // 扫荡动画进行中，忽略点击
    if (this.sweepAnim.active) {
      return
    }

    // 章节切换动画中，忽略点击
    if (this.chapterAnim.active) {
      return
    }

    // 上一章按钮
    if (this.currentChapterIndex > 0 &&
        x >= 10 && x <= 50 && y >= 75 && y <= 115) {
      this._switchChapter(-1)
      return
    }

    // 下一章按钮
    if (this.currentChapterIndex < this.chapters.length - 1 &&
        x >= this.designW - 50 && x <= this.designW - 10 && y >= 75 && y <= 115) {
      this._switchChapter(1)
      return
    }

    for (const card of this.cards) {
      if (!card.enabled) continue
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        if (card.type === 'stage') {
          // 检查是否点击扫荡按钮（右侧区域）
          const sweepBtnX = card.x + card.w - 60
          const sweepBtnW = 55
          if (card.canSweep && x >= sweepBtnX && x <= card.x + card.w) {
            console.log(`[SceneStageSelect] 点击扫荡按钮: ${card.id}`)
            this._showSweepDialog(card.id, card.text)
          } else {
            console.log(`[SceneStageSelect] 选择关卡: ${card.id}`)
            this.game.sceneManager.changeScene('battlePrepare', { stageId: card.id, stageData: card.stageData, chapterIndex: this.currentChapterIndex })
          }
        }
        return
      }
    }
    // 点击返回区域
    if (x < 60 && y < 40) {
      this.game.sceneManager.changeScene('main', {}, 'slide')
    }
  }

  _showSweepDialog(stageId, stageName) {
    this.sweepDialog.active = true
    this.sweepDialog.stageId = stageId
    this.sweepDialog.stageName = stageName
  }

  _doSweepConfirm() {
    const stageId = this.sweepDialog.stageId
    const reward = this.storage.doSweep(stageId)
    this.sweepDialog.active = false

    if (reward) {
      this.sweepAnim.active = true
      this.sweepAnim.progress = 0
      this.sweepAnim.gold = reward.gold
      this.sweepAnim.exp = reward.exp
    }
  }

  update(dt) {
    // 章节切换动画
    if (this.chapterAnim.active) {
      this.chapterAnim.progress = Math.min(1, this.chapterAnim.progress + dt * 4)
      if (this.chapterAnim.progress >= 1) {
        this.chapterAnim.active = false
      }
    }

    // 扫荡动画
    if (this.sweepAnim.active) {
      this.sweepAnim.progress = Math.min(1, this.sweepAnim.progress + dt * 1.5)
      if (this.sweepAnim.progress >= 1) {
        this.sweepAnim.active = false
        this._buildCards()  // 刷新显示（更新按钮状态）
      }
    }
  }

  render(r) {
    r.fillRect(0, 0, this.designW, this.designH, THEME.colors.bgMedium)

    // 返回按钮
    const backPressed = this.touchedBtn === 'backBtn'
    const backBg = backPressed ? 'rgba(255, 255, 255, 0.25)' : THEME.colors.bgCard
    r.fillRoundRect(10, 10, 50, 30, THEME.radius.sm, backBg)
    r.fillText('← 返回', 35, 30, COLORS.textPrimary, THEME.font.small.size, THEME.font.small.weight)

    // 页面标题
    r.fillText('📋 选择关卡', this.designW / 2, 60, COLORS.textPrimary, THEME.font.subtitle.size, THEME.font.subtitle.weight)

    // ===== 章节标题栏 =====
    this._renderChapterHeader(r)

    // ===== 关卡卡片 =====
    // 章节切换动画偏移
    let offsetX = 0
    if (this.chapterAnim.active) {
      const dir = this.chapterAnim.direction
      // 从旧位置滑出到新位置滑入
      const p = this.chapterAnim.progress
      // ease-out 缓动
      const eased = 1 - Math.pow(1 - p, 3)
      offsetX = dir * this.designW * (1 - eased) * -1
    }

    for (const card of this.cards) {
      if (card.type === 'stage') {
        this._renderStageCard(r, card, offsetX)
      }
    }

    // 扫荡确认弹窗
    if (this.sweepDialog.active) {
      this._renderSweepDialog(r)
    }

    // 扫荡奖励动画
    if (this.sweepAnim.active) {
      this._renderSweepAnim(r)
    }
  }

  _renderChapterHeader(r) {
    const headerY = 75
    const headerH = 40
    const totalChapters = this.chapters.length
    const currentNum = this.currentChapterIndex + 1
    const chapter = this.chapters[this.currentChapterIndex]

    if (!chapter) return

    // 章节标题栏背景
    r.fillRoundRect(15, headerY, this.designW - 30, headerH, THEME.radius.md, THEME.colors.bgCard)

    // 上一章按钮（◀）
    if (this.currentChapterIndex > 0) {
      const prevPressed = this.touchedBtn === 'prevChapter'
      const prevBg = prevPressed ? 'rgba(255, 255, 255, 0.25)' : THEME.colors.bgMedium
      r.fillRoundRect(20, headerY + 5, 35, 30, THEME.radius.sm, prevBg)
      r.fillText('◀', 37, headerY + 25, COLORS.textPrimary, 16, 'bold')
    }

    // 下一章按钮（▶）
    if (this.currentChapterIndex < totalChapters - 1) {
      const nextPressed = this.touchedBtn === 'nextChapter'
      const nextBg = nextPressed ? 'rgba(255, 255, 255, 0.25)' : THEME.colors.bgMedium
      r.fillRoundRect(this.designW - 55, headerY + 5, 35, 30, THEME.radius.sm, nextBg)
      r.fillText('▶', this.designW - 38, headerY + 25, COLORS.textPrimary, 16, 'bold')
    }

    // 章节标题文字（居中）
    const titleText = `📍 ${currentNum}/${totalChapters} ${chapter.name}`
    r.fillText(titleText, this.designW / 2, headerY + 26, COLORS.gold, 14, 'bold')

    // 页面指示器小圆点
    this._renderPageDots(r, this.designW / 2, headerY + headerH + 12, totalChapters, this.currentChapterIndex)
  }

  _renderPageDots(r, cx, cy, total, current) {
    if (total <= 7) {
      // 7个及以下：全部显示
      const dotSpacing = 14
      const startX = cx - (total - 1) * dotSpacing / 2
      for (let i = 0; i < total; i++) {
        const isActive = i === current
        const x = startX + i * dotSpacing
        if (isActive) {
          r.fillRoundRect(x - 5, cy - 3, 10, 6, 3, COLORS.gold)
        } else {
          r.fillRoundRect(x - 2, cy - 2, 4, 4, 2, 'rgba(255, 255, 255, 0.3)')
        }
      }
    } else {
      // 超过7个：显示当前附近 + 首尾
      const maxDots = 7
      const halfRange = 2
      let dots = []

      // 始终显示第一个
      dots.push(0)

      // 当前附近
      const rangeStart = Math.max(1, current - halfRange)
      const rangeEnd = Math.min(total - 2, current + halfRange)

      for (let i = rangeStart; i <= rangeEnd; i++) {
        if (dots.indexOf(i) === -1) dots.push(i)
      }

      // 始终显示最后一个
      if (dots.indexOf(total - 1) === -1) dots.push(total - 1)

      dots.sort((a, b) => a - b)

      const dotSpacing = 14
      const startX = cx - (dots.length - 1) * dotSpacing / 2
      let prevIndex = -1

      for (let di = 0; di < dots.length; di++) {
        const i = dots[di]
        const x = startX + di * dotSpacing

        // 如果和前一个 dot 不连续，画省略号
        if (prevIndex >= 0 && i - prevIndex > 1) {
          r.fillText('…', x - dotSpacing / 2, cy + 1, 'rgba(255, 255, 255, 0.4)', 8)
        }

        const isActive = i === current
        if (isActive) {
          r.fillRoundRect(x - 5, cy - 3, 10, 6, 3, COLORS.gold)
        } else {
          r.fillRoundRect(x - 2, cy - 2, 4, 4, 2, 'rgba(255, 255, 255, 0.3)')
        }
        prevIndex = i
      }
    }
  }

  _renderStageCard(r, card, offsetX) {
    const isBoss = card.stageData && card.stageData.type === 'boss'
    const isElite = card.isElite || (card.stageData && card.stageData.type === 'elite')
    let baseColor = COLORS.primary
    if (isBoss) baseColor = COLORS.danger
    if (isElite) baseColor = COLORS.elite
    const isPressed = this.touchedBtn === card.id

    const drawX = card.x + offsetX

    // 精英关卡：金色渐变边框
    if (isElite) {
      r.strokeRoundRect(drawX - 2, card.y - 2, card.w + 4, card.h + 4, THEME.radius.md + 1, COLORS.gold, 2)
    }

    // 卡片背景
    r.fillRoundRect(drawX, card.y, card.w, card.h, THEME.radius.md, baseColor)

    // 按压时叠加暗色层
    if (isPressed) {
      r.fillRoundRect(drawX, card.y, card.w, card.h, THEME.radius.md, 'rgba(0, 0, 0, 0.15)')
    }

    // 精英标签
    if (isElite) {
      r.fillRoundRect(drawX + card.w - 58, card.y + 4, 52, 16, 4, COLORS.gold)
      r.fillText('ELITE', drawX + card.w - 32, card.y + 15, COLORS.eliteText, 9, 'bold')
    }

    // 关卡名称
    const nameX = drawX + 15
    const nameY = card.y + card.h / 2 - 5
    r.fillText(card.text, nameX, nameY, COLORS.textPrimary, 13, 'bold')

    // 星级显示（卡片中间偏左）
    this._renderStars(r, drawX + card.w - 90, card.y + card.h / 2 + 2, card.stars)

    // 扫荡按钮（3星关卡）
    if (card.canSweep) {
      this._renderSweepButton(r, drawX + card.w - 65, card.y + card.h / 2 - 12)
    } else if (card.stars > 0) {
      // 非3星显示锁定的扫荡图标
      r.fillText('🔒', drawX + card.w - 45, card.y + card.h / 2 + 2, COLORS.textMuted, 14)
    }
  }

  _renderStars(r, x, y, count) {
    const size = 16
    const spacing = 18
    for (let i = 0; i < 3; i++) {
      const isLit = i < count
      const star = isLit ? '⭐' : '☆'
      const alpha = isLit ? 1 : 0.3
      r.fillText(star, x + i * spacing, y, `rgba(255, 215, 0, ${alpha})`, size)
    }
  }

  _renderSweepButton(r, x, y) {
    const pulse = Math.sin(Date.now() / 400) * 0.15 + 0.85
    // 橙色/金色渐变背景
    r.fillRoundRect(x, y, 55, 24, 6, `rgba(255, 150, 0, ${pulse})`)
    r.fillText('⚡扫荡', x + 27, y + 16, COLORS.textPrimary, 11, 'bold')
  }

  _renderSweepDialog(r) {
    const dlgW = 260
    const dlgH = 160
    const dlgX = (this.designW - dlgW) / 2
    const dlgY = (this.designH - dlgH) / 2

    // 遮罩
    r.fillRect(0, 0, this.designW, this.designH, 'rgba(0, 0, 0, 0.6)')

    // 弹窗背景
    r.fillRoundRect(dlgX, dlgY, dlgW, dlgH, THEME.radius.lg, THEME.colors.bgPanel)

    // 标题
    r.fillText('⚡ 确认扫荡', this.designW / 2, dlgY + 30, COLORS.gold, 16, 'bold')

    // 描述
    r.fillText('扫荡此关卡将直接获得奖励', this.designW / 2, dlgY + 55, COLORS.textMuted, 12)
    r.fillText('（无需进入战斗）', this.designW / 2, dlgY + 73, COLORS.textMuted, 11)

    // 奖励预览
    const reward = this.storage ? this.storage.getSweepReward(this.sweepDialog.stageId) : { gold: 120, exp: 96 }
    r.fillText(`💰 +${reward.gold}  金币`, this.designW / 2, dlgY + 93, COLORS.gold, 12)

    // 确认按钮
    r.fillRoundRect(dlgX + 20, dlgY + 95, 100, 40, THEME.radius.md, THEME.buttons.secondary.bgColor)
    r.fillText('确认扫荡', dlgX + 70, dlgY + 120, COLORS.textPrimary, 13, 'bold')

    // 取消按钮
    r.fillRoundRect(dlgX + 140, dlgY + 95, 100, 40, THEME.radius.md, THEME.buttons.danger.bgColor)
    r.fillText('取消', dlgX + 190, dlgY + 120, COLORS.textPrimary, 13, 'bold')
  }

  _renderSweepAnim(r) {
    const progress = this.sweepAnim.progress

    // 半透明背景
    r.fillRect(0, 0, this.designW, this.designH, 'rgba(0, 0, 0, 0.7)')

    // 标题
    const titleY = 200
    r.fillText('⚡ 扫荡完成！', this.designW / 2, titleY, COLORS.gold, 20, 'bold')

    // 金币飞入动画
    const goldStartX = this.designW / 2 - 50
    const goldStartY = this.designH
    const goldEndX = this.designW / 2 - 30
    const goldEndY = 350
    const goldX = goldStartX + (goldEndX - goldStartX) * progress
    const goldY = goldStartY + (goldEndY - goldStartY) * progress - Math.sin(progress * Math.PI) * 30

    if (progress < 0.8) {
      r.fillText('💰', goldX, goldY, COLORS.gold, 24)
      r.fillText(`+${this.sweepAnim.gold} 金币`, goldX + 30, goldY + 5, COLORS.gold, 14)
    }

    // 经验飞入动画（延迟）
    if (progress > 0.3) {
      const expProg = (progress - 0.3) / 0.7
      const expStartX = this.designW / 2 + 30
      const expStartY = this.designH
      const expEndX = this.designW / 2 + 50
      const expEndY = 350
      const expX = expStartX + (expEndX - expStartX) * expProg
      const expY = expStartY + (expEndY - expStartY) * expProg - Math.sin(expProg * Math.PI) * 30

      r.fillText('✨', expX, expY, COLORS.thunder, 24)
      r.fillText(`+${this.sweepAnim.exp} 经验`, expX + 30, expY + 5, COLORS.thunder, 14)
    }

    // 完成后显示关闭提示
    if (progress >= 1) {
      r.fillText('点击任意处继续', this.designW / 2, 420, COLORS.textMuted, 12)
    }
  }

  destroy() {
    this.game.input.onTap = null
    this.game.input.onTouchStart = null
    this.game.input.onTouchEnd = null
  }
}

// Colors via THEME/COLORS constants (P0.1.5)
