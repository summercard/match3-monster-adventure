// ============================================
// ui/sceneAchievement.js - 成就系统场景
// ============================================

import { THEME, COLORS } from '../engine/theme.js'

export class SceneAchievement {
  constructor(game, data) {
    this.game = game
    this.tapCallback = this._onTap.bind(this)
    this.swipeCallback = this._onSwipe.bind(this)
    this.achievementList = []      // 当前显示的成就列表
    this.allAchievements = []       // 所有成就
    this.currentCategory = 'all'    // 当前分类
    this.categories = ['all', 'battle', 'collect', 'numeric', 'continuous']
    this.categoryLabels = {
      'all': '全部',
      'battle': '战斗',
      'collect': '收集',
      'numeric': '数值',
      'continuous': '连续'
    }
    this.selectedAch = null         // 当前选中成就（用于高亮显示）
    this.claimedAch = null          // 已领取奖励的成就（用于显示提示）
    this.claimTimer = 0
    this.scrollOffset = 0
  }

  init(data) {
    console.log('[SceneAchievement] 成就场景初始化')

    // 加载成就数据
    this.allAchievements = this.game.achievementManager.getAllAchievements()
    this._filterByCategory('all')

    this.game.input.onTap = this.tapCallback
    this.game.input.onSwipe = this.swipeCallback
  }

  // 按分类筛选成就
  _filterByCategory(category) {
    this.currentCategory = category
    if (category === 'all') {
      this.achievementList = this.allAchievements
    } else {
      this.achievementList = this.allAchievements.filter(ach => ach.category === category)
    }
    this.scrollOffset = 0
  }

  _onTap(x, y) {
    // 返回按钮
    const backBtn = this._getBackButton()
    if (this._isPointInRect(x, y, backBtn)) {
      this._goBack()
      return
    }

    // 分类标签点击
    for (let i = 0; i < this.categories.length; i++) {
      const cat = this.categories[i]
      const catBtn = this._getCategoryButton(i)
      if (this._isPointInRect(x, y, catBtn)) {
        this._filterByCategory(cat)
        return
      }
    }

    // 成就条目点击
    const listStartY = 160
    const itemH = 70
    const listEndY = this.game.renderer.designHeight - 20

    if (y >= listStartY && y <= listEndY) {
      const index = Math.floor((y - listStartY + this.scrollOffset) / itemH)
      if (index >= 0 && index < this.achievementList.length) {
        const ach = this.achievementList[index]
        this._onAchievementTap(ach)
        return
      }
    }
  }

  _onSwipe(x, y, direction) {
    if (y < 150) return
    const maxOffset = this._getMaxScrollOffset()
    if (direction === 'up') {
      this.scrollOffset = Math.min(maxOffset, this.scrollOffset + 70)
    } else if (direction === 'down') {
      this.scrollOffset = Math.max(0, this.scrollOffset - 70)
    }
  }

  _getMaxScrollOffset() {
    const h = this.game.renderer.designHeight
    const listStartY = 160
    const listBottomY = h - 20
    const contentH = this.achievementList.length * 70
    return Math.max(0, contentH - (listBottomY - listStartY))
  }

  _onAchievementTap(ach) {
    if (ach.unlocked) {
      // 已解锁成就：显示奖励已领取
      this.claimedAch = ach
      this.claimTimer = 2.0
    } else {
      // 未解锁：高亮该成就目标
      this.selectedAch = ach
    }
  }

  _getBackButton() {
    return { x: 15, y: 15, w: 60, h: 35 }
  }

  _getCategoryButton(index) {
    const tabW = 62
    const gap = 7
    const startX = 16 + index * (tabW + gap)
    return { x: startX, y: 112, w: tabW, h: 34 }
  }

  _isPointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  }

  _goBack() {
    this.game.sceneManager.changeScene('main', {}, 'slide')
  }

  update(dt) {
    if (this.claimTimer > 0) {
      this.claimTimer -= dt
      if (this.claimTimer <= 0) {
        this.claimedAch = null
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
    r.fillText('🏆 成就', w / 2, 70, COLORS.gold, THEME.font.title.size, THEME.font.title.weight)

    // 统计信息
    const unlockedCount = this.allAchievements.filter(a => a.unlocked).length
    const totalCount = this.allAchievements.length
    r.fillText(`已解锁 ${unlockedCount}/${totalCount}`, w / 2, 94, COLORS.textMuted, THEME.font.small.size)

    // 分类标签
    for (let i = 0; i < this.categories.length; i++) {
      const cat = this.categories[i]
      const btn = this._getCategoryButton(i)
      const isSelected = this.currentCategory === cat

      if (isSelected) {
        r.fillRoundRect(btn.x, btn.y, btn.w, btn.h, THEME.radius.sm, COLORS.gold)
        r.fillText(this.categoryLabels[cat], btn.x + btn.w / 2, btn.y + btn.h / 2 + 5, COLORS.bgMedium, THEME.font.small.size, THEME.font.small.weight)
      } else {
        r.fillRoundRect(btn.x, btn.y, btn.w, btn.h, THEME.radius.sm, COLORS.bgCard)
        r.fillText(this.categoryLabels[cat], btn.x + btn.w / 2, btn.y + btn.h / 2 + 5, COLORS.textMuted, THEME.font.small.size, THEME.font.small.weight)
      }
    }

    // 成就列表
    const listStartY = 160
    const itemH = 70

    for (let i = 0; i < this.achievementList.length; i++) {
      const ach = this.achievementList[i]
      const itemY = listStartY + i * itemH - this.scrollOffset
      if (itemY < listStartY - itemH || itemY > h - 10) continue
      const isSelected = this.selectedAch && this.selectedAch.id === ach.id

      this._renderAchievementItem(r, ach, itemY, isSelected)
    }

    const maxOffset = this._getMaxScrollOffset()
    if (maxOffset > 0) {
      const trackY = listStartY
      const trackH = h - listStartY - 20
      const thumbH = Math.max(36, trackH * (trackH / (trackH + maxOffset)))
      const thumbY = trackY + (trackH - thumbH) * (this.scrollOffset / maxOffset)
      r.fillRoundRect(w - 8, trackY, 3, trackH, 2, 'rgba(255,255,255,0.12)')
      r.fillRoundRect(w - 9, thumbY, 5, thumbH, 3, 'rgba(255,255,255,0.45)')
    }

    // 已解锁提示
    if (this.claimedAch) {
      const ach = this.claimedAch
      r.fillRoundRect(40, h / 2 - 40, w - 80, 80, THEME.radius.lg, COLORS.bgCard)
      r.fillText(`✅ ${ach.name}`, w / 2, h / 2 - 15, COLORS.gold, THEME.font.subtitle.size, THEME.font.subtitle.weight)
      r.fillText('奖励已领取', w / 2, h / 2 + 15, COLORS.textMuted, THEME.font.small.size)
    }

    // 未解锁选中提示
    if (this.selectedAch && !this.selectedAch.unlocked) {
      const ach = this.selectedAch
      r.fillRoundRect(40, h / 2 - 40, w - 80, 80, THEME.radius.lg, COLORS.bgCard)
      r.fillText(`🎯 目标: ${ach.desc}`, w / 2, h / 2 - 15, COLORS.danger, THEME.font.small.size, THEME.font.small.weight)
      const progress = ach.progress || 0
      r.fillText(`进度: ${progress}/${ach.target}`, w / 2, h / 2 + 15, COLORS.textMuted, THEME.font.small.size)
    }
  }

  _renderAchievementItem(r, ach, itemY, isSelected) {
    const w = this.game.renderer.designWidth
    const h = this.game.renderer.designHeight

    // 背景
    const bgColor = ach.unlocked ? 'rgba(76, 175, 80, 0.15)' : (isSelected ? COLORS.bgCard : COLORS.bgMedium)
    r.fillRoundRect(15, itemY, w - 30, 60, THEME.radius.md, bgColor)

    // 图标
    r.fillText(ach.icon, 30, itemY + 35, ach.unlocked ? COLORS.gold : COLORS.textDark, 24)

    // 名称
    r.fillText(ach.name, 75, itemY + 22, ach.unlocked ? COLORS.textPrimary : COLORS.textMuted, THEME.font.body.size, THEME.font.body.weight)

    // 描述
    r.fillText(ach.desc, 75, itemY + 42, ach.unlocked ? COLORS.textSecondary : COLORS.textMuted, THEME.font.small.size)

    // 进度条（未解锁时显示）
    if (!ach.unlocked) {
      const progress = ach.progress || 0
      const barW = 80
      const barX = w - 110
      const barY = itemY + 22
      const barH = 8

      // 背景
      r.fillRoundRect(barX, barY, barW, barH, THEME.radius.sm, COLORS.bgMedium)

      // 进度
      const ratio = Math.min(progress / ach.target, 1)
      if (ratio > 0) {
        r.fillRoundRect(barX, barY, barW * ratio, barH, THEME.radius.sm, COLORS.danger)
      }

      // 文字
      r.fillText(`${progress}/${ach.target}`, barX + barW / 2, barY + 22, COLORS.textMuted, THEME.font.tiny.size)
    } else {
      // 已解锁标记
      r.fillText('✓', w - 45, itemY + 35, COLORS.success, 20, THEME.font.body.weight)
    }

    // 奖励（金币）
    if (ach.reward && ach.reward.gold) {
      r.fillText(`💰 ${ach.reward.gold}`, w - 110, itemY + 42, COLORS.gold, THEME.font.small.size)
    }
  }

  destroy() {
    this.game.input.onTap = null
    this.game.input.onSwipe = null
  }
}
