// ============================================
// ui/sceneStageSelect.js - 关卡选择场景（章节分页版）
// ============================================

import { THEME, COLORS } from '../engine/theme.js'
import { chapters as STAGE_CHAPTERS } from '../../data/stages.js'

const STAGE_ASSETS = {
  bg: 'assets/images/stage/stage_map_bg.png',
  headerBar: 'assets/images/stage/ui_header_bar.png',
  backButton: 'assets/images/stage/ui_back_button.png',
  arrowButton: 'assets/images/stage/ui_arrow_button.png',
  rewardPanel: 'assets/images/stage/ui_reward_panel_clean.png',
  nodeNormal: 'assets/images/stage/node_normal.png',
  nodeSelected: 'assets/images/stage/node_selected.png',
  nodeLocked: 'assets/images/stage/node_locked.png',
  nodeChest: 'assets/images/stage/node_chest.png',
  nodeCrystal: 'assets/images/stage/node_crystal.png',
  bossBadge: 'assets/images/stage/boss_badge.png',
  bossFlower: 'assets/images/stage/boss_flower.png',
  starLit: 'assets/images/stage/icon_star_lit.png',
  starDim: 'assets/images/stage/icon_star_dim.png',
  pathDot: 'assets/images/stage/icon_path_dot.png',
  chapterBadge: 'assets/images/stage/icon_chapter_badge.png',
  goldCoin: 'assets/images/stage/icon_gold_coin.png',
  expBadge: 'assets/images/stage/icon_exp_badge.png',
  captureBall: 'assets/images/stage/icon_capture_ball.png',
  gemFire: 'assets/images/stage/icon_gem_fire.png',
  gemWater: 'assets/images/stage/icon_gem_water.png',
  gemGrass: 'assets/images/stage/icon_gem_grass.png',
  gemThunder: 'assets/images/stage/icon_gem_thunder.png',
  gemLight: 'assets/images/stage/icon_gem_light.png',
  backArrow: 'assets/images/stage/icon_back_arrow.png',
  prevArrow: 'assets/images/stage/icon_prev_arrow.png',
  nextArrow: 'assets/images/stage/icon_next_arrow.png',
}

const MAP_NODE_POSITIONS = [
  { x: 58, y: 472 },
  { x: 80, y: 408 },
  { x: 132, y: 354 },
  { x: 190, y: 377 },
  { x: 252, y: 348 },
  { x: 250, y: 282 },
  { x: 147, y: 281 },
  { x: 82, y: 222 },
  { x: 90, y: 166 },
  { x: 154, y: 124 },
]

const MAP_BOSS_POSITION = { x: 296, y: 164 }

const REWARD_ITEMS = [
  { key: 'goldCoin', count: 'x500' },
  { key: 'expBadge', count: 'x200' },
  { key: 'captureBall', count: 'x1' },
  { key: 'gemFire', count: 'x2' },
  { key: 'gemWater', count: 'x2' },
  { key: 'gemGrass', count: 'x2' },
  { key: 'gemThunder', count: 'x2' },
  { key: 'gemLight', count: 'x1' },
]

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

    // 地图式关卡选择美术资源
    this.artAssets = {}
    this.artReady = false
  }

  init(data) {
    console.log('[SceneStageSelect] 关卡选择初始化')
    this._loadStageData()
    // 如果传入了 chapterIndex，跳转到对应章节
    if (data && typeof data.chapterIndex === 'number') {
      this.currentChapterIndex = Math.max(0, Math.min(data.chapterIndex, this.chapters.length - 1))
    }
    this._buildCards()
    this._loadArtAssets()
    this.game.input.onTap = this.tapCallback
    this.game.input.onTouchStart = this.touchStartCallback
    this.game.input.onTouchEnd = this.touchEndCallback
  }

  _loadArtAssets() {
    if (this._artLoadingStarted) return
    this._artLoadingStarted = true

    const entries = Object.entries(STAGE_ASSETS)
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
      }
      img.onerror = () => {
        console.warn(`[SceneStageSelect] 美术资源加载失败: ${src}`)
        loadedCount++
        this.artReady = loadedCount >= entries.length
      }
      img.src = src
    })
  }

  _loadStageData() {
    this.chapters = STAGE_CHAPTERS || []
  }

  _buildCards() {
    this.cards = []
    // 只构建当前章节的卡片
    if (this.chapters.length === 0) return

    const chapter = this.chapters[this.currentChapterIndex]
    if (!chapter) return

    // 关卡列表
    let nodeIndex = 0
    for (let i = 0; i < chapter.stages.length; i++) {
      const stage = chapter.stages[i]
      const isBoss = stage.type === 'boss'
      const isElite = stage.type === 'elite'
      const stars = this.storage.getStageStars(stage.id)
      const canSweep = this.storage.canSweep(stage.id)

      const pos = isBoss ? MAP_BOSS_POSITION : (MAP_NODE_POSITIONS[nodeIndex] || MAP_NODE_POSITIONS[MAP_NODE_POSITIONS.length - 1])
      if (!isBoss) nodeIndex++
      const nodeW = isBoss ? 112 : 58
      const nodeH = isBoss ? 112 : 58

      this.cards.push({
        type: 'stage',
        id: stage.id,
        text: stage.name,
        stageNo: i + 1,
        x: pos.x - nodeW / 2,
        y: pos.y - nodeH / 2,
        cx: pos.x,
        cy: pos.y,
        w: nodeW,
        h: nodeH,
        enabled: true,
        chapterId: chapter.id,
        stageData: stage,
        stars: stars,
        canSweep: canSweep,
        isElite: isElite,
        isBoss: isBoss,
        sweepRect: { x: pos.x + 24, y: pos.y - 26, w: 30, h: 26 }
      })
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
    if (x >= 10 && x <= 60 && y >= 10 && y <= 60) {
      this.touchedBtn = 'backBtn'
      return
    }

    // 检查上一章按钮（标题栏左侧）
    if (this.currentChapterIndex > 0) {
      if (x >= 76 && x <= 108 && y >= 28 && y <= 60) {
        this.touchedBtn = 'prevChapter'
        return
      }
    }

    // 检查下一章按钮（标题栏右侧）
    if (this.currentChapterIndex < this.chapters.length - 1) {
      if (x >= this.designW - 46 && x <= this.designW - 14 && y >= 28 && y <= 60) {
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
        x >= 76 && x <= 108 && y >= 28 && y <= 60) {
      this._switchChapter(-1)
      return
    }

    // 下一章按钮
    if (this.currentChapterIndex < this.chapters.length - 1 &&
        x >= this.designW - 46 && x <= this.designW - 14 && y >= 28 && y <= 60) {
      this._switchChapter(1)
      return
    }

    for (const card of this.cards) {
      if (!card.enabled) continue
      const sweep = card.sweepRect
      if (card.canSweep && sweep && x >= sweep.x && x <= sweep.x + sweep.w && y >= sweep.y && y <= sweep.y + sweep.h) {
        console.log(`[SceneStageSelect] 点击扫荡按钮: ${card.id}`)
        this._showSweepDialog(card.id, card.text)
        return
      }
      if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) {
        if (card.type === 'stage') {
          console.log(`[SceneStageSelect] 选择关卡: ${card.id}`)
          this.game.sceneManager.changeScene('battlePrepare', { stageId: card.id, stageData: card.stageData, chapterIndex: this.currentChapterIndex })
        }
        return
      }
    }
    // 点击返回区域
    if (x >= 10 && x <= 60 && y >= 10 && y <= 60) {
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
    if (this.artAssets.bg && this.artAssets.bg.loaded) {
      this._drawImageCover(r, this.artAssets.bg.img, 0, 0, this.designW, this.designH)
      r.fillRect(0, 0, this.designW, this.designH, 'rgba(4, 12, 28, 0.08)')
    } else {
      r.fillRect(0, 0, this.designW, this.designH, THEME.colors.bgMedium)
    }

    // 顶部章节条
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

    this._renderStagePath(r, offsetX)

    for (const card of this.cards) {
      if (card.type === 'stage') {
        this._renderStageCard(r, card, offsetX)
      }
    }

    this._renderRewardPanel(r)

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
    const headerY = 11
    const headerH = 64
    const totalChapters = this.chapters.length
    const currentNum = this.currentChapterIndex + 1
    const chapter = this.chapters[this.currentChapterIndex]

    if (!chapter) return

    // 返回按钮
    const backPressed = this.touchedBtn === 'backBtn'
    const back = this.artAssets.backButton
    if (back && back.loaded) {
      this._drawImageFit(r, back.img, 10, 12, 52, 52, backPressed ? 0.82 : 1)
    } else {
      r.drawButton({ x: 10, y: 12, w: 52, h: 52, text: '' }, 'secondary', backPressed ? 0.9 : 1)
    }
    const backArrow = this.artAssets.backArrow
    if (backArrow && backArrow.loaded) this._drawImageFit(r, backArrow.img, 19, 21, 34, 34, 1)

    // 章节标题栏背景
    const header = this.artAssets.headerBar
    if (header && header.loaded) {
      this._drawImageFit(r, header.img, 69, headerY, 296, headerH, 1)
    } else {
      r.fillRoundRect(69, headerY, 296, headerH, THEME.radius.md, THEME.colors.bgCard)
    }

    const badge = this.artAssets.chapterBadge
    if (badge && badge.loaded) {
      this._drawImageFit(r, badge.img, 82, 20, 34, 38, 1)
      r.fillText(`${currentNum}`, 99, 38, COLORS.white, THEME.font.small.size, 'center', 'bold')
    }

    // 上一章按钮（◀）
    if (this.currentChapterIndex > 0) {
      const prevPressed = this.touchedBtn === 'prevChapter'
      const prev = this.artAssets.prevArrow
      if (prev && prev.loaded) this._drawImageFit(r, prev.img, 76, 28, 32, 32, prevPressed ? 0.8 : 1)
      else r.fillText('◀', 92, 44, COLORS.white, THEME.font.body.size)
    }

    // 下一章按钮（▶）
    if (this.currentChapterIndex < totalChapters - 1) {
      const nextPressed = this.touchedBtn === 'nextChapter'
      const next = this.artAssets.nextArrow
      if (next && next.loaded) this._drawImageFit(r, next.img, this.designW - 46, 28, 32, 32, nextPressed ? 0.8 : 1)
      else r.fillText('▶', this.designW - 30, 44, COLORS.white, THEME.font.body.size)
    }

    // 章节标题文字（居中）
    r.fillText(`第${currentNum}章`, 142, 36, COLORS.success, THEME.font.subtitle.size, 'center', 'bold')
    r.fillText(chapter.name, 255, 36, COLORS.textPrimary, THEME.font.subtitle.size, 'center', 'bold')

    const chapterStars = this._getChapterStars(chapter)
    const totalStars = Math.max((chapter.stages || []).length * 3, 1)
    const star = this.artAssets.starLit
    if (star && star.loaded) this._drawImageFit(r, star.img, 139, 52, 18, 18, 1)
    r.fillText(`${chapterStars}/${totalStars}`, 191, 63, COLORS.textPrimary, THEME.font.body.size, 'center', 'bold')

    // 页面指示器小圆点
    this._renderPageDots(r, this.designW / 2, headerY + headerH + 9, totalChapters, this.currentChapterIndex)
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
          r.fillText('…', x - dotSpacing / 2, cy + 1, 'rgba(255, 255, 255, 0.4)', THEME.font.tiny.size)
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

  _getChapterStars(chapter) {
    if (!chapter || !chapter.stages) return 0
    return chapter.stages.reduce((sum, stage) => sum + this.storage.getStageStars(stage.id), 0)
  }

  _renderStagePath(r, offsetX) {
    const cards = this.cards.filter(card => card.type === 'stage')
    for (let i = 0; i < cards.length - 1; i++) {
      this._drawPathDots(r, cards[i].cx + offsetX, cards[i].cy, cards[i + 1].cx + offsetX, cards[i + 1].cy)
    }
  }

  _drawPathDots(r, x1, y1, x2, y2) {
    const dx = x2 - x1
    const dy = y2 - y1
    const dist = Math.sqrt(dx * dx + dy * dy)
    const steps = Math.max(1, Math.floor(dist / 16))
    const dot = this.artAssets.pathDot

    for (let i = 1; i < steps; i++) {
      const t = i / steps
      const x = x1 + dx * t
      const y = y1 + dy * t
      if (dot && dot.loaded) this._drawImageFit(r, dot.img, x - 4, y - 4, 8, 8, 0.92)
      else r.fillCircle(x, y, 3, '#fff0c7', 0.9)
    }
  }

  _renderStageCard(r, card, offsetX) {
    const isBoss = card.stageData && card.stageData.type === 'boss'
    const isElite = card.isElite || (card.stageData && card.stageData.type === 'elite')
    const isPressed = this.touchedBtn === card.id

    const drawX = card.x + offsetX
    const drawCx = card.cx + offsetX

    if (isBoss) {
      const boss = this.artAssets.bossBadge
      if (boss && boss.loaded) {
        this._drawImageFit(r, boss.img, drawX - 7, card.y - 18, card.w + 22, card.h + 45, isPressed ? 0.82 : 1)
      } else {
        r.fillRoundRect(drawX, card.y, card.w, card.h, THEME.radius.lg, COLORS.danger)
      }
      const bossFlower = this.artAssets.bossFlower
      if (bossFlower && bossFlower.loaded) {
        this._drawImageFit(r, drawCx - 49, card.y - 28, 98, 98, isPressed ? 0.82 : 1)
      }
      r.fillText('BOSS', drawCx, card.y + card.h - 24, COLORS.gold, THEME.font.body.size, 'center', 'bold')
      this._renderStars(r, drawCx - 23, card.y + card.h - 4, card.stars)
      return
    }

    let nodeKey = isElite ? 'nodeCrystal' : 'nodeNormal'
    if (card.stars >= 3 && card.stageNo === this.cards.length) nodeKey = 'nodeChest'
    if (isPressed) nodeKey = 'nodeSelected'
    const node = this.artAssets[nodeKey]
    const nodeW = isElite ? 64 : 58
    const nodeH = isElite ? 70 : 58
    const nodeX = drawCx - nodeW / 2
    const nodeY = card.cy - nodeH / 2

    if (node && node.loaded) this._drawImageFit(r, node.img, nodeX, nodeY, nodeW, nodeH, 1)
    else r.fillCircle(drawCx, card.cy, 26, COLORS.primary, 0.95)

    r.fillText(`${card.stageNo}`, drawCx, card.cy + (isElite ? 2 : -1), COLORS.white, THEME.font.number.size, 'center', 'bold')
    this._renderStars(r, drawCx - 22, card.cy + 31, card.stars)

    if (card.canSweep) {
      this._renderSweepButton(r, card.sweepRect.x + offsetX, card.sweepRect.y)
    }
  }

  _renderStars(r, x, y, count) {
    const spacing = 16
    for (let i = 0; i < 3; i++) {
      const isLit = i < count
      const asset = isLit ? this.artAssets.starLit : this.artAssets.starDim
      if (asset && asset.loaded) this._drawImageFit(r, asset.img, x + i * spacing, y - 7, 14, 14, isLit ? 1 : 0.45)
      else r.fillText(isLit ? '★' : '☆', x + i * spacing + 7, y, `rgba(255, 215, 0, ${isLit ? 1 : 0.35})`, THEME.font.small.size)
    }
  }

  _renderSweepButton(r, x, y) {
    const pulse = Math.sin(Date.now() / 400) * 0.15 + 0.85
    const thunder = this.artAssets.gemThunder
    r.fillRoundRect(x, y, 28, 24, 9, `rgba(255, 150, 0, ${pulse})`)
    if (thunder && thunder.loaded) this._drawImageFit(r, thunder.img, x + 4, y + 2, 20, 20, 1)
    else r.fillText('⚡', x + 14, y + 13, COLORS.textPrimary, THEME.font.tiny.size, 'center', 'bold')
  }

  _renderRewardPanel(r) {
    const panel = this.artAssets.rewardPanel
    const x = 13
    const y = 544
    const w = 349
    const h = 108

    if (panel && panel.loaded) this._drawImageFit(r, panel.img, x, y, w, h, 0.98)
    else r.fillRoundRect(x, y, w, h, THEME.radius.lg, THEME.colors.bgPanel, 0.92)

    r.fillText('通关奖励', this.designW / 2, y + 20, COLORS.textPrimary, THEME.font.body.size, 'center', 'bold')

    const slotW = 39
    const gap = 4
    const startX = 23
    const iconY = y + 37
    for (let i = 0; i < REWARD_ITEMS.length; i++) {
      const item = REWARD_ITEMS[i]
      const sx = startX + i * (slotW + gap)
      r.fillRoundRect(sx, iconY, slotW, 56, 6, 'rgba(32, 34, 72, 0.82)')
      const asset = this.artAssets[item.key]
      if (asset && asset.loaded) this._drawImageFit(r, asset.img, sx + 6, iconY + 5, 27, 27, 1)
      r.fillText(item.count, sx + slotW / 2, iconY + 45, COLORS.textPrimary, THEME.font.tiny.size, 'center', 'bold')
    }
  }

  _renderSweepDialog(r) {
    const dlgW = 260
    const dlgH = 160
    const dlgX = (this.designW - dlgW) / 2
    const dlgY = (this.designH - dlgH) / 2

    // 遮罩
    r.fillRect(0, 0, this.designW, this.designH, 'rgba(0, 0, 0, 0.6)')

    // 弹窗背景
    const panel = this.artAssets.rewardPanel
    if (panel && panel.loaded) this._drawImageFit(r, panel.img, dlgX, dlgY, dlgW, dlgH, 0.96)
    else r.fillRoundRect(dlgX, dlgY, dlgW, dlgH, THEME.radius.lg, THEME.colors.bgPanel)

    // 标题
    const thunder = this.artAssets.gemThunder
    if (thunder && thunder.loaded) this._drawImageFit(r, thunder.img, this.designW / 2 - 58, dlgY + 16, 24, 24, 1)
    r.fillText('确认扫荡', this.designW / 2 + 8, dlgY + 30, COLORS.gold, THEME.font.number.size, 'center', 'bold')

    // 描述
    r.fillText('扫荡此关卡将直接获得奖励', this.designW / 2, dlgY + 55, COLORS.textMuted, THEME.font.small.size)
    r.fillText('（无需进入战斗）', this.designW / 2, dlgY + 73, COLORS.textMuted, THEME.font.tiny.size)

    // 奖励预览
    const reward = this.storage ? this.storage.getSweepReward(this.sweepDialog.stageId) : { gold: 120, exp: 96 }
    const coin = this.artAssets.goldCoin
    if (coin && coin.loaded) this._drawImageFit(r, coin.img, this.designW / 2 - 62, dlgY + 80, 22, 22, 1)
    r.fillText(`+${reward.gold} 金币`, this.designW / 2 + 10, dlgY + 93, COLORS.gold, THEME.font.small.size)

    // 确认按钮
    r.drawButton({ x: dlgX + 20, y: dlgY + 95, w: 100, h: 40, text: '确认扫荡' }, 'secondary', 1)

    // 取消按钮
    r.drawButton({ x: dlgX + 140, y: dlgY + 95, w: 100, h: 40, text: '取消' }, 'danger', 1)
  }

  _renderSweepAnim(r) {
    const progress = this.sweepAnim.progress

    // 半透明背景
    r.fillRect(0, 0, this.designW, this.designH, 'rgba(0, 0, 0, 0.7)')

    // 标题
    const titleY = 200
    const thunder = this.artAssets.gemThunder
    if (thunder && thunder.loaded) this._drawImageFit(r, thunder.img, this.designW / 2 - 78, titleY - 17, 32, 32, 1)
    r.fillText('扫荡完成！', this.designW / 2 + 10, titleY, COLORS.gold, THEME.font.bigNum.size, 'center', 'bold')

    // 金币飞入动画
    const goldStartX = this.designW / 2 - 50
    const goldStartY = this.designH
    const goldEndX = this.designW / 2 - 30
    const goldEndY = 350
    const goldX = goldStartX + (goldEndX - goldStartX) * progress
    const goldY = goldStartY + (goldEndY - goldStartY) * progress - Math.sin(progress * Math.PI) * 30

    if (progress < 0.8) {
      const coin = this.artAssets.goldCoin
      if (coin && coin.loaded) this._drawImageFit(r, coin.img, goldX - 12, goldY - 13, 26, 26, 1)
      r.fillText(`+${this.sweepAnim.gold} 金币`, goldX + 30, goldY + 5, COLORS.gold, THEME.font.body.size)
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

      const exp = this.artAssets.expBadge
      if (exp && exp.loaded) this._drawImageFit(r, exp.img, expX - 12, expY - 13, 26, 26, 1)
      r.fillText(`+${this.sweepAnim.exp} 经验`, expX + 30, expY + 5, COLORS.thunder, THEME.font.body.size)
    }

    // 完成后显示关闭提示
    if (progress >= 1) {
      r.fillText('点击任意处继续', this.designW / 2, 420, COLORS.textMuted, THEME.font.small.size)
    }
  }

  destroy() {
    this.game.input.onTap = null
    this.game.input.onTouchStart = null
    this.game.input.onTouchEnd = null
  }

  _drawImageFit(r, img, x, y, w, h, opacity = 1) {
    r.ctx.save()
    r.ctx.globalAlpha *= opacity
    r.ctx.drawImage(img, x * r.scaleX, y * r.scaleY, w * r.scaleX, h * r.scaleY)
    r.ctx.restore()
  }

  _drawImageCover(r, img, x, y, w, h, opacity = 1) {
    const srcRatio = img.width / img.height
    const dstRatio = w / h
    let sx = 0
    let sy = 0
    let sw = img.width
    let sh = img.height

    if (srcRatio > dstRatio) {
      sw = img.height * dstRatio
      sx = (img.width - sw) / 2
    } else {
      sh = img.width / dstRatio
      sy = (img.height - sh) / 2
    }

    r.ctx.save()
    r.ctx.globalAlpha *= opacity
    r.ctx.drawImage(img, sx, sy, sw, sh, x * r.scaleX, y * r.scaleY, w * r.scaleX, h * r.scaleY)
    r.ctx.restore()
  }
}

// Colors via THEME/COLORS constants (P0.1.5)
