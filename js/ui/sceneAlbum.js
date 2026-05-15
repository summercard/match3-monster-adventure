// ============================================
// ui/sceneAlbum.js - 怪物图鉴场景
// ============================================

import { MONSTER_DB } from '../battle/monsterData.js'
import { THEME, COLORS } from '../engine/theme.js'

export class SceneAlbum {
  constructor(game) {
    this.game = game
    this.state = 'list'  // list | detail
    this.selectedMonster = null
    this.monsters = []

    // 布局参数
    this.designW = 375
    this.designH = 667
    this.margin = 15
    this.cols = 3
    this.itemW = 100
    this.itemH = 110
    this.gap = 15

    // 计算列间距使三列居中
    this.totalW = this.cols * this.itemW + (this.cols - 1) * this.gap
    this.startX = (this.designW - this.totalW) / 2

    // 分类数据 - 8种属性（elementNames使用theme的elementColors key，elementNames单独维护）
    this.elements = ['fire', 'water', 'grass', 'thunder', 'light', 'earth', 'wind', 'dark']
    this.elementNames = {
      fire: '火', water: '水', grass: '草', thunder: '雷', light: '光',
      earth: '土', wind: '风', dark: '暗'
    }
    this.allElements = ['all', ...this.elements]
    this.selectedElement = 'all'

    // 计算每个属性的总行数（每行3个），用于滚动
    this.categoryStartIndex = {}  // element -> start index in monsters list

    // 滚动偏移
    this.scrollY = 0
    this.maxScrollY = 0

    // 按钮
    this.backBtn = { x: 15, y: 15, w: 60, h: 35 }
    this.tapCallback = this._onTap.bind(this)
    this.swipeCallback = this._onSwipe.bind(this)

    this._buildMonsterList()
  }

  init(data) {
    console.log('[SceneAlbum] 图鉴初始化')
    this.game.input.onTap = this.tapCallback
    this.game.input.onSwipe = this.swipeCallback
    // 重置筛选状态
    this.selectedElement = 'all'
    this.scrollY = 0
    this._buildMonsterList()
  }

  _buildMonsterList() {
    // 按属性分组排列（支持筛选）
    this.monsters = []
    this.categoryStartIndex = {}
    this.allMonsters = []  // 完整列表用于筛选

    // 先构建完整列表
    for (const key of Object.keys(MONSTER_DB)) {
      this.allMonsters.push({ id: key, ...MONSTER_DB[key] })
    }

    // 根据筛选条件构建显示列表
    this._applyElementFilter()
  }

  _applyElementFilter() {
    this.monsters = []
    this.categoryStartIndex = {}

    if (this.selectedElement === 'all') {
      // 全部分类，按属性分组
      for (const el of this.elements) {
        this.categoryStartIndex[el] = this.monsters.length
        for (const m of this.allMonsters) {
          if (m.element === el) {
            this.monsters.push(m)
          }
        }
      }
    } else {
      // 单属性筛选
      this.categoryStartIndex[this.selectedElement] = 0
      for (const m of this.allMonsters) {
        if (m.element === this.selectedElement) {
          this.monsters.push(m)
        }
      }
    }

    // 计算最大滚动
    const totalRows = Math.ceil(this.monsters.length / this.cols)
    const contentH = totalRows * (this.itemH + this.gap)
    this.maxScrollY = Math.max(0, contentH - (this.designH - 120))
  }

  _getUnlockedMonsters() {
    const player = this.game.storage.loadPlayer()
    const captured = player.captured || []
    return captured
  }

  _getRarityStars(rarity) {
    return '★'.repeat(rarity)
  }

  _onTap(x, y) {
    // 坐标转换（考虑滚动）
    const drawY = y + this.scrollY

    // 返回按钮
    if (this.state === 'detail') {
      if (this._pointInRect(x, y, this.backBtn)) {
        this.state = 'list'
        this.selectedMonster = null
        return
      }
      // 进化按钮
      if (this.evolveBtn && this._pointInRect(x, y, this.evolveBtn)) {
        this.game.sceneManager.changeScene('evolve', { monsterId: this.selectedMonster.id })
        return
      }
      // 关闭按钮
      if (this.closeBtn && this._pointInRect(x, y, this.closeBtn)) {
        this.state = 'list'
        this.selectedMonster = null
        return
      }
      return
    }

    // 返回按钮
    if (this._pointInRect(x, y, this.backBtn)) {
      this.game.sceneManager.changeScene('main', {}, 'slide')
      return
    }

    // 属性筛选按钮区域（顶部横向标签栏）
    const filterY = 65
    const filterH = 26
    const filterStartX = 15
    const filterGap = 8
    let currentX = filterStartX

    for (const el of this.allElements) {
      const label = el === 'all' ? '全部' : this.elementNames[el]
      const btnW = el === 'all' ? 36 : 36
      if (y >= filterY && y <= filterY + filterH && x >= currentX && x <= currentX + btnW) {
        this.selectedElement = el
        this.scrollY = 0
        this._applyElementFilter()
        return
      }
      currentX += btnW + filterGap
    }

    // 计算点击的怪物项
    const relX = x - this.startX
    const relY = drawY - 98  // 标题(40) + 返回按钮(35) + filter(24) + gap(5) = 98

    if (relX < 0 || relY < 0) return

    const col = Math.floor(relX / (this.itemW + this.gap))
    const row = Math.floor(relY / (this.itemH + this.gap))

    if (col >= this.cols) return

    const index = row * this.cols + col
    if (index >= this.monsters.length) return

    const monster = this.monsters[index]
    const player = this.game.storage.loadPlayer()
    const isUnlocked = (player.captured || []).includes(monster.id)

    if (isUnlocked) {
      this.selectedMonster = monster
      this.state = 'detail'
    }
  }

  _pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  }

  _onSwipe(x, y, direction) {
    if (this.state !== 'list' || y < 95) return
    const step = this.itemH + this.gap
    if (direction === 'up') {
      this.scrollY = Math.min(this.maxScrollY, this.scrollY + step)
    } else if (direction === 'down') {
      this.scrollY = Math.max(0, this.scrollY - step)
    }
  }

  update(dt) {}

  render(r) {
    if (this.state === 'detail') {
      this._renderDetail(r)
      return
    }

    this._renderList(r)
  }

  _renderList(r) {
    r.fillRect(0, 0, this.designW, this.designH, COLORS.bgMedium)

    // 标题
    r.fillText('📖 怪物图鉴', this.designW / 2, 40, COLORS.textPrimary, 18, 'bold')

    // 返回按钮
    r.fillRoundRect(this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, THEME.radius.sm, THEME.buttons.secondary.bgColor)
    r.fillText('← 返回', this.backBtn.x + this.backBtn.w / 2, this.backBtn.y + 20, COLORS.textPrimary, 12)

    const player = this.game.storage.loadPlayer()
    const captured = player.captured || []
    const totalMonsters = this.monsters.length
    const unlockedCount = captured.length

    r.fillText(`已收集: ${unlockedCount}/${totalMonsters}`, this.designW / 2, 62, COLORS.textMuted, 11)

    // 绘制属性筛选标签
    const filterY = 65
    const filterH = 24
    const filterStartX = 15
    const filterGap = 6
    let currentX = filterStartX

    for (const el of this.allElements) {
      const label = el === 'all' ? '全部' : this.elementNames[el]
      const btnW = 34
      const color = el === 'all' ? COLORS.textMuted : (THEME.colors.elementColors[el] || COLORS.textMuted)
      const isSelected = this.selectedElement === el

      if (isSelected) {
        r.fillRoundRect(currentX, filterY, btnW, filterH, THEME.radius.sm - 2, color)
        r.fillText(label, currentX + btnW / 2, filterY + 16, COLORS.textPrimary, 10, 'bold')
      } else {
        r.fillRoundRect(currentX, filterY, btnW, filterH, THEME.radius.sm - 2, COLORS.disabledBg)
        r.strokeRect(currentX, filterY, btnW, filterH, 1, color)
        r.fillText(label, currentX + btnW / 2, filterY + 16, color, 10)
      }
      currentX += btnW + filterGap
    }

    // 绘制怪物卡片
    let row = 0
    let col = 0
    const startY = 98

    for (let i = 0; i < this.monsters.length; i++) {
      const monster = this.monsters[i]
      const isUnlocked = captured.includes(monster.id)

      const x = this.startX + col * (this.itemW + this.gap)
      const y = startY + row * (this.itemH + this.gap) - this.scrollY

      // 跳过屏幕外的
      if (y < -this.itemH || y > this.designH) {
        col++
        if (col >= this.cols) { col = 0; row++ }
        continue
      }

      // 根据解锁状态选择颜色
      const elemColor = THEME.colors.elementColors[monster.element]
      const bgColor = isUnlocked ? elemColor + '44' : COLORS.disabledBg
      const borderColor = isUnlocked ? elemColor : COLORS.textDark

      // 卡片背景
      r.fillRoundRect(x, y, this.itemW, this.itemH, THEME.radius.md - 2, bgColor)
      r.strokeRect(x, y, this.itemW, this.itemH, 2, borderColor)

      // Emoji / 锁定图标
      if (isUnlocked) {
        r.fillText(monster.emoji, x + this.itemW / 2, y + 38, COLORS.textPrimary, 28)
        // 名字
        r.fillText(monster.name, x + this.itemW / 2, y + 62, COLORS.textPrimary, 10, 'bold')
        // 稀有度星星
        const stars = this._getRarityStars(monster.rarity)
        r.fillText(stars, x + this.itemW / 2, y + 76, COLORS.gold, 9)
      } else {
        r.fillText('🔒', x + this.itemW / 2, y + 38, COLORS.textMuted, 24)
        r.fillText('???', x + this.itemW / 2, y + 62, COLORS.textDark, 10)
        r.fillText('???', x + this.itemW / 2, y + 76, COLORS.textDark, 9)
      }

      // 显示属性标签
      const tagColor = THEME.colors.elementColors[monster.element]
      r.fillRoundRect(x + 4, y + 4, 30, 16, THEME.radius.sm - 2, tagColor)
      r.fillText(this.elementNames[monster.element], x + 19, y + 15, COLORS.textPrimary, 9)

      col++
      if (col >= this.cols) { col = 0; row++ }
    }

    // 如果有滚动，显示滚动提示
    if (this.maxScrollY > 0) {
      const progress = this.scrollY / this.maxScrollY
      const barH = 60
      const barY = 80 + progress * barH
      r.fillRoundRect(this.designW - 10, barY, 4, 10, 2, COLORS.textMuted)
    }
  }

  _renderDetail(r) {
    r.fillRect(0, 0, this.designW, this.designH, COLORS.bgMedium)

    // 标题
    r.fillText('📖 怪物图鉴', this.designW / 2, 40, COLORS.textPrimary, 18, 'bold')

    // 返回按钮
    r.fillRoundRect(this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, THEME.radius.sm, THEME.buttons.secondary.bgColor)
    r.fillText('← 返回', this.backBtn.x + this.backBtn.w / 2, this.backBtn.y + 20, COLORS.textPrimary, 12)

    const m = this.selectedMonster
    const player = this.game.storage.loadPlayer()
    const isCaptured = (player.captured || []).includes(m.id)

    // 怪物卡片（居中大卡片）
    const cardW = 220
    const cardH = 280
    const cardX = (this.designW - cardW) / 2
    const cardY = 70

    r.fillRoundRect(cardX, cardY, cardW, cardH, THEME.radius.lg, COLORS.bgCard)
    r.strokeRect(cardX, cardY, cardW, cardH, 2, THEME.colors.elementColors[m.element])

    // Emoji
    r.fillText(m.emoji, this.designW / 2, cardY + 55, COLORS.textPrimary, 48)

    // 名字
    r.fillText(m.name, this.designW / 2, cardY + 95, COLORS.textPrimary, 16, 'bold')

    // 稀有度星星
    r.fillText(this._getRarityStars(m.rarity), this.designW / 2, cardY + 115, COLORS.gold, 12)

    // 属性标签
    r.fillRoundRect(this.designW / 2 - 25, cardY + 125, 50, 22, THEME.radius.md - 2, THEME.colors.elementColors[m.element])
    r.fillText(this.elementNames[m.element], this.designW / 2, cardY + 140, COLORS.textPrimary, 12, 'bold')

    // 分割线
    r.fillRect(cardX + 20, cardY + 160, cardW - 40, 1, COLORS.disabledBg)

    // 属性数值
    const statsY = cardY + 180
    const col1X = cardX + 30
    const col2X = cardX + cardW - 80

    r.fillText('HP', col1X, statsY, COLORS.textMuted, 11)
    r.fillText(`${m.baseHP}`, col2X, statsY, COLORS.statHp, 11)

    r.fillText('ATK', col1X, statsY + 22, COLORS.textMuted, 11)
    r.fillText(`${m.baseATK}`, col2X, statsY + 22, COLORS.statAtk, 11)

    r.fillText('DEF', col1X, statsY + 44, COLORS.textMuted, 11)
    r.fillText(`${m.baseDEF}`, col2X, statsY + 44, COLORS.statDef, 11)

    r.fillText('SPD', col1X, statsY + 66, COLORS.textMuted, 11)
    r.fillText(`${m.baseSPD}`, col2X, statsY + 66, COLORS.statSpd, 11)

    // 技能信息
    r.fillRect(cardX + 20, statsY + 95, cardW - 40, 1, COLORS.disabledBg)

    r.fillText('技能', this.designW / 2, statsY + 118, COLORS.textMuted, 11)
    r.fillText(m.skill.name, this.designW / 2, statsY + 138, COLORS.textPrimary, 13, 'bold')
    r.fillText(`消耗: ${m.skill.cost} 能量 | 倍率: ${m.skill.multiplier}x`, this.designW / 2, statsY + 158, COLORS.textSecondary, 10)

    // 收服状态
    const statusY = cardY + cardH + 20
    if (isCaptured) {
      r.fillText('✅ 已收服', this.designW / 2, statusY, COLORS.success, 13)
    } else {
      r.fillText('❓ 未收服', this.designW / 2, statusY, COLORS.textMuted, 13)
    }

    // 进化按钮（仅已收服且可进化的怪物）
    const hasEvolution = m.evolution && m.evolution.target && MONSTER_DB[m.evolution.target]
    const evolveBtn = { x: this.designW / 2 - 60, y: statusY + 35, w: 120, h: 40 }

    if (hasEvolution && isCaptured) {
      r.fillRoundRect(evolveBtn.x, evolveBtn.y, evolveBtn.w, evolveBtn.h, THEME.radius.md, COLORS.evolveBg)
      r.fillText('🔄 进化', this.designW / 2, statusY + 60, COLORS.textPrimary, 14, 'bold')
      this.evolveBtn = evolveBtn
    } else {
      this.evolveBtn = null
    }

    // 关闭按钮
    const closeBtn = { x: this.designW / 2 - 60, y: statusY + 85, w: 120, h: 40 }
    r.fillRoundRect(closeBtn.x, closeBtn.y, closeBtn.w, closeBtn.h, THEME.radius.md, THEME.buttons.secondary.bgColor)
    r.fillText('关闭', this.designW / 2, statusY + 110, COLORS.textPrimary, 14)

    // 点击关闭按钮也可返回
    this.closeBtn = closeBtn
  }

  destroy() {
    this.game.input.onTap = null
    this.game.input.onSwipe = null
  }
}

// Colors via THEME/COLORS constants (P0.1.6)
