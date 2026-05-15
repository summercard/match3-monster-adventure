// ============================================
// ui/sceneRanch.js - 牧场场景（挂机培养）
// ============================================
import { MONSTER_DB, getMonsterStats } from '../battle/monsterData.js'
import { NATURES, getNature, getNatureStatMultiplier } from '../data/natures.js'
import { THEME, COLORS } from '../engine/theme.js'

export class SceneRanch {
  constructor(game) {
    this.game = game
    this.designW = 375
    this.designH = 667

    // 状态
    this.selectedSlot = 0        // 当前选中的槽位
    this.ranchState = null       // 牧场存档数据
    this.capturedMonsters = []   // 玩家已收服的怪物ID列表
    this.slots = []              // 牧场槽位 [{ monsterId, placedAt }]
    this.detailMonster = null    // 详情面板的怪物
    this.detailStats = null      // 详情面板的属性
    this.idleExpMap = {}         // monsterId → 待领取经验
    this.bubbles = []            // 挂机气泡动画
    this.bubbleTimer = 0

    // 滚动
    this.scrollY = 0
    this.maxScrollY = 0

    // 按钮
    this.buttons = []
    this.touchedBtn = null
    this.tapCallback = this._onTap.bind(this)
    this.swipeCallback = this._onSwipe.bind(this)
    this.touchStartCallback = this._onTouchStart.bind(this)
    this.touchEndCallback = this._onTouchEnd.bind(this)
  }

  init(data) {
    console.log('[SceneRanch] 牧场初始化')
    this.game.input.onTap = this.tapCallback
    this.game.input.onSwipe = this.swipeCallback
    this.game.input.onTouchStart = this.touchStartCallback
    this.game.input.onTouchEnd = this.touchEndCallback

    this._loadData()
    this._buildButtons()
    this._calcIdleExp()
    this._initBubbles()
  }

  // ============================================
  // 数据加载
  // ============================================
  _loadData() {
    this.ranchState = this.game.storage.getRanchState()
    this.capturedMonsters = this.game.storage.getCapturedMonsters()
    this.slots = this.ranchState.slots || []
    // 确保至少有3个槽位
    while (this.slots.length < 3) {
      this.slots.push({ monsterId: null, placedAt: null })
    }
    this._selectSlot(0)
  }

  _saveRanchState() {
    this.game.storage.setRanchState({
      slots: this.slots,
      unlockedSlots: this.ranchState.unlockedSlots || 3
    })
  }

  // ============================================
  // 挂机经验计算
  // ============================================
  _calcIdleExp() {
    this.idleExpMap = {}
    const now = Date.now()
    for (const slot of this.slots) {
      if (!slot.monsterId || !slot.placedAt) continue
      const elapsed = now - slot.placedAt
      const intervals = Math.floor(elapsed / (5 * 60 * 1000)) // 每5分钟
      if (intervals > 0) {
        const level = this.game.storage.getMonsterLevel(slot.monsterId) || 1
        const rate = this.game.storage.getIdleExpRate(slot.monsterId)
        this.idleExpMap[slot.monsterId] = intervals * rate
      }
    }
  }

  // ============================================
  // 气泡系统
  // ============================================
  _initBubbles() {
    this.bubbles = []
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i]
      if (slot.monsterId) {
        this._addBubble(i, slot.monsterId)
      }
    }
  }

  _addBubble(slotIndex, monsterId) {
    const bubbleTypes = ['💤', '⭐', '❤️', '💪']
    const type = bubbleTypes[Math.floor(Math.random() * bubbleTypes.length)]
    this.bubbles.push({
      slotIndex,
      type,
      x: 0,
      y: 0,
      baseY: 0,
      opacity: 1,
      life: 2 + Math.random() * 2, // 2-4秒
      age: 0,
      speedY: -0.3 - Math.random() * 0.3,
      drift: (Math.random() - 0.5) * 0.5,
    })
  }

  _updateBubbles(dt) {
    this.bubbleTimer += dt
    // 每3-6秒自动产生新气泡
    if (this.bubbleTimer > 3 + Math.random() * 3) {
      this.bubbleTimer = 0
      for (let i = 0; i < this.slots.length; i++) {
        if (this.slots[i].monsterId && Math.random() > 0.5) {
          this._addBubble(i, this.slots[i].monsterId)
        }
      }
    }

    // 更新现有气泡
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]
      b.age += dt
      b.y += b.speedY
      b.x += b.drift * dt * 30
      // 最后0.5秒淡出
      if (b.age > b.life - 0.5) {
        b.opacity = Math.max(0, (b.life - b.age) / 0.5)
      }
      if (b.age >= b.life) {
        this.bubbles.splice(i, 1)
      }
    }
  }

  // ============================================
  // 选中槽位
  // ============================================
  _selectSlot(index) {
    this.selectedSlot = index
    const slot = this.slots[index]
    if (slot && slot.monsterId && MONSTER_DB[slot.monsterId]) {
      const db = MONSTER_DB[slot.monsterId]
      const level = this.game.storage.getMonsterLevel(slot.monsterId) || 1
      const stats = getMonsterStats(slot.monsterId, level)
      const natureId = this.game.storage.getMonsterNature(slot.monsterId)
      const nature = natureId ? getNature(natureId) : null
      this.detailMonster = { ...db, level }
      this.detailStats = stats
      this.detailNature = nature
    } else {
      this.detailMonster = null
      this.detailStats = null
      this.detailNature = null
    }
  }

  // ============================================
  // 按钮构建
  // ============================================
  _buildButtons() {
    this.buttons = []
    const w = this.designW

    // 返回按钮
    this.buttons.push({
      id: 'back',
      x: 15, y: 15, w: 60, h: 35,
      action: () => this.game.sceneManager.changeScene('main')
    })

    // 收取经验按钮
    this.buttons.push({
      id: 'collect',
      x: w - 100, y: 15, w: 85, h: 35,
      action: () => this._collectAllExp()
    })

    // 槽位按钮（动态生成）
    this._buildSlotButtons()

    // 怪物选择列表按钮（底部区域）
    this._buildPickerButtons()
  }

  _buildSlotButtons() {
    // 清除旧的 slot 按钮
    this.buttons = this.buttons.filter(b => !b.id.startsWith('slot_'))

    const slotSize = 90
    const gap = 15
    const totalW = Math.min(this.slots.length, 3) * slotSize + (Math.min(this.slots.length, 3) - 1) * gap
    const startX = (this.designW - totalW) / 2
    const slotY = 150

    for (let i = 0; i < Math.min(this.slots.length, 3); i++) {
      this.buttons.push({
        id: `slot_${i}`,
        x: startX + i * (slotSize + gap),
        y: slotY,
        w: slotSize,
        h: slotSize,
        action: () => this._selectSlot(i)
      })
    }
  }

  _buildPickerButtons() {
    // 清除旧的 picker 按钮
    this.buttons = this.buttons.filter(b => !b.id.startsWith('picker_'))

    // 底部怪物选择栏：显示不在牧场中的已收服怪物
    const usedIds = new Set(this.slots.filter(s => s.monsterId).map(s => s.monsterId))
    const available = this.capturedMonsters.filter(id => MONSTER_DB[id])

    const pickerY = 500
    const itemW = 55
    const itemH = 65
    const gap = 8
    const perRow = 5

    for (let i = 0; i < available.length; i++) {
      const row = Math.floor(i / perRow)
      const col = i % perRow
      const totalRowW = Math.min(available.length - row * perRow, perRow) * (itemW + gap) - gap
      const rowStartX = (this.designW - totalRowW) / 2

      this.buttons.push({
        id: `picker_${i}`,
        x: rowStartX + col * (itemW + gap),
        y: pickerY + row * (itemH + gap),
        w: itemW,
        h: itemH,
        monsterId: available[i],
        inUse: usedIds.has(available[i]),
        action: () => this._placeMonster(available[i])
      })
    }
  }

  // ============================================
  // 操作：放置/移除怪物
  // ============================================
  _placeMonster(monsterId) {
    // 检查是否已在其他槽位
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i].monsterId === monsterId) {
        // 移除
        this.slots[i] = { monsterId: null, placedAt: null }
        this._saveRanchState()
        this._buildButtons()
        this._selectSlot(this.selectedSlot)
        return
      }
    }

    // 放入当前选中槽位
    const slot = this.slots[this.selectedSlot]
    if (!slot) return

    // 如果槽位已有怪物，先结算经验
    if (slot.monsterId && this.idleExpMap[slot.monsterId]) {
      this.game.storage.addMonsterExp(slot.monsterId, this.idleExpMap[slot.monsterId])
    }

    slot.monsterId = monsterId
    slot.placedAt = Date.now()
    this._saveRanchState()
    this._buildButtons()
    this._selectSlot(this.selectedSlot)
    this._calcIdleExp()
    this._initBubbles()
  }

  _collectAllExp() {
    let totalCollected = 0
    const results = []
    for (const slot of this.slots) {
      if (!slot.monsterId) continue
      const exp = this.idleExpMap[slot.monsterId] || 0
      if (exp > 0) {
        const result = this.game.storage.addMonsterExp(slot.monsterId, exp)
        totalCollected += exp
        results.push({ monsterId: slot.monsterId, exp, ...result })
        // 重置放置时间
        slot.placedAt = Date.now()
      }
    }
    this._saveRanchState()
    this.idleExpMap = {}
    this._calcIdleExp()
    this._selectSlot(this.selectedSlot)

    if (totalCollected > 0) {
      console.log(`[SceneRanch] 收取挂机经验: ${totalCollected} EXP`)
    }
  }

  // ============================================
  // 事件处理
  // ============================================
  _onTap(x, y) {
    for (const btn of this.buttons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        btn.action()
        return
      }
    }
  }

  _onSwipe(dx, dy) {
    this.scrollY -= dy
    this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY))
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

  _onTouchEnd() {
    this.touchedBtn = null
  }

  // ============================================
  // 更新
  // ============================================
  update(dt) {
    this._updateBubbles(dt)
  }

  // ============================================
  // 渲染
  // ============================================
  render(r) {
    const c = COLORS
    const font = THEME.font
    const w = this.designW
    const h = this.designH

    // 背景 — 草地渐变
    const grad = r.ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, '#1a3a1a')
    grad.addColorStop(0.3, '#2d5a27')
    grad.addColorStop(1, '#1a4a1a')
    r.ctx.fillStyle = grad
    r.ctx.fillRect(0, 0, w, h)

    // 草地纹理点
    r.ctx.globalAlpha = 0.15
    for (let gx = 10; gx < w; gx += 30) {
      for (let gy = 120; gy < h; gy += 40) {
        r.ctx.fillStyle = '#4a8a3a'
        r.ctx.fillRect(gx + (gy % 80 === 0 ? 15 : 0), gy, 2, 8)
      }
    }
    r.ctx.globalAlpha = 1

    // === 顶部栏 ===
    r.fillRoundRect(0, 0, w, 55, 0, '#0a2a0a', 0.85)
    r.fillText('🏡 我的牧场', w / 2, 30, c.textPrimary, font.title.size, 'bold')

    // 返回按钮
    this._renderBtn(r, 'back', '← 返回', 15, 15, 60, 30)

    // 收取按钮
    const totalIdle = Object.values(this.idleExpMap).reduce((a, b) => a + b, 0)
    const collectText = totalIdle > 0 ? `收取 +${Math.floor(totalIdle)}` : '收取'
    this._renderBtn(r, 'collect', collectText, w - 100, 15, 85, 30, totalIdle > 0)

    // === 标题说明 ===
    r.fillText('选择怪物派去牧场，挂机获得经验', w / 2, 75, c.textSecondary, font.small.size)
    r.fillText('每5分钟自动获得经验 = 2 + 等级×0.5', w / 2, 92, c.textMuted, font.tiny.size)

    // === 槽位区域 ===
    this._renderSlots(r, c, font)

    // === 气泡 ===
    this._renderBubbles(r, font)

    // === 详情面板 ===
    this._renderDetailPanel(r, c, font, w)

    // === 怪物选择栏 ===
    this._renderPicker(r, c, font, w)
  }

  // ============================================
  // 渲染：槽位
  // ============================================
  _renderSlots(r, c, font) {
    const slotSize = 90
    const gap = 15
    const count = Math.min(this.slots.length, 3)
    const totalW = count * slotSize + (count - 1) * gap
    const startX = (this.designW - totalW) / 2
    const slotY = 150

    for (let i = 0; i < count; i++) {
      const x = startX + i * (slotSize + gap)
      const y = slotY
      const slot = this.slots[i]
      const isSelected = (i === this.selectedSlot)
      const isPressed = (this.touchedBtn && this.touchedBtn.id === `slot_${i}`)

      // 槽位背景
      const bgColor = slot.monsterId ? '#2a5a2a' : '#1a3a1a'
      r.fillRoundRect(x, y, slotSize, slotSize, THEME.radius.md, bgColor, 0.9)

      // 选中边框
      if (isSelected) {
        r.strokeRoundRect(x - 2, y - 2, slotSize + 4, slotSize + 4, THEME.radius.md + 2, c.primary, 2)
      }

      // 按压效果
      if (isPressed) {
        r.fillRoundRect(x, y, slotSize, slotSize, THEME.radius.md, c.primary, 0.15)
      }

      if (slot.monsterId && MONSTER_DB[slot.monsterId]) {
        const db = MONSTER_DB[slot.monsterId]
        const cx = x + slotSize / 2
        const cy = y + slotSize / 2

        // 怪物 emoji
        r.fillText(db.emoji, cx, cy - 12, c.textPrimary, font.icon.size)

        // 名称
        r.fillText(db.name, cx, cy + 20, c.textPrimary, font.tiny.size, 'bold')

        // 挂机经验提示
        const idleExp = this.idleExpMap[slot.monsterId] || 0
        if (idleExp > 0) {
          r.fillText(`+${Math.floor(idleExp)}`, cx, cy + 35, c.gold, font.tiny.size)
        }
      } else {
        // 空槽位
        const cx = x + slotSize / 2
        const cy = y + slotSize / 2
        r.fillText('➕', cx, cy - 5, c.textMuted, font.body.size)
        r.fillText('空位', cx, cy + 18, c.textMuted, font.tiny.size)
      }
    }
  }

  // ============================================
  // 渲染：气泡
  // ============================================
  _renderBubbles(r, font) {
    const slotSize = 90
    const gap = 15
    const count = Math.min(this.slots.length, 3)
    const totalW = count * slotSize + (count - 1) * gap
    const startX = (this.designW - totalW) / 2
    const slotY = 150

    for (const b of this.bubbles) {
      if (b.slotIndex >= count) continue
      const baseX = startX + b.slotIndex * (slotSize + gap) + slotSize / 2
      const baseY = slotY + 10

      // 初始化位置
      if (b.baseY === 0) {
        b.x = baseX + (Math.random() - 0.5) * 30
        b.y = baseY
        b.baseY = baseY
      }

      r.ctx.globalAlpha = b.opacity * 0.8
      r.fillText(b.type, b.x, b.y, '#ffffff', font.body.size)
      r.ctx.globalAlpha = 1
    }
  }

  // ============================================
  // 渲染：详情面板
  // ============================================
  _renderDetailPanel(r, c, font, w) {
    const panelX = 20
    const panelY = 270
    const panelW = w - 40
    const panelH = 180

    // 面板背景
    r.fillRoundRect(panelX, panelY, panelW, panelH, THEME.radius.lg, '#0a2a0a', 0.9)
    r.strokeRoundRect(panelX, panelY, panelW, panelH, THEME.radius.lg, '#3a6a3a', 1)

    if (this.detailMonster && this.detailStats) {
      const m = this.detailMonster
      const s = this.detailStats
      const nature = this.detailNature
      const cx = panelX + 20

      // 怪物名称行
      r.fillText(m.emoji, cx + 15, panelY + 25, c.textPrimary, font.icon.size)
      r.fillText(m.name, cx + 45, panelY + 20, c.textPrimary, font.subtitle.size, 'bold')

      // 等级
      r.fillText(`Lv.${m.level || 1}`, cx + 45, panelY + 40, c.gold, font.body.size)

      // 性格
      if (nature) {
        r.fillText(`${nature.emoji} ${nature.name}`, panelX + panelW - 60, panelY + 25, c.textSecondary, font.small.size)
      }

      // 属性条
      const statY = panelY + 60
      const stats = [
        { label: 'HP', value: s.hp, color: c.statHp },
        { label: 'ATK', value: s.atk, color: c.statAtk },
        { label: 'DEF', value: s.def, color: c.statDef },
        { label: 'SPD', value: s.spd, color: c.statSpd },
      ]

      for (let i = 0; i < stats.length; i++) {
        const sy = statY + i * 22
        const stat = stats[i]

        r.fillText(stat.label, cx, sy, c.textSecondary, font.small.size)
        // 数值
        r.fillText(String(Math.floor(stat.value)), cx + 40, sy, stat.color, font.body.size, 'bold')

        // 属性条
        const barX = cx + 80
        const barW = panelW - 120
        const barH = 8
        r.fillRoundRect(barX, sy - 4, barW, barH, 4, '#333333', 0.8)
        const fillW = Math.min(barW, (stat.value / 300) * barW)
        if (fillW > 0) {
          r.fillRoundRect(barX, sy - 4, fillW, barH, 4, stat.color, 0.7)
        }
      }

      // 挂机信息
      const idleExp = this.idleExpMap[this.slots[this.selectedSlot]?.monsterId] || 0
      const rate = this.slots[this.selectedSlot]?.monsterId
        ? this.game.storage.getIdleExpRate(this.slots[this.selectedSlot].monsterId)
        : 0
      const infoY = statY + stats.length * 22 + 8
      r.fillText(`🏋️ 收益: +${rate.toFixed(1)} EXP/5min`, cx, infoY, c.textSecondary, font.small.size)
      if (idleExp > 0) {
        r.fillText(`待领取: +${Math.floor(idleExp)} EXP`, cx, infoY + 18, c.gold, font.small.size, 'bold')
      }
    } else {
      // 空面板提示
      const cx = panelX + panelW / 2
      const cy = panelY + panelH / 2
      r.fillText('点击下方怪物放入牧场', cx, cy - 10, c.textMuted, font.body.size)
      r.fillText('怪物将在此挂机获得经验', cx, cy + 15, c.textMuted, font.small.size)
    }
  }

  // ============================================
  // 渲染：怪物选择栏
  // ============================================
  _renderPicker(r, c, font, w) {
    // 分隔线
    r.fillRoundRect(20, 475, w - 40, 1, 0, '#3a6a3a', 0.5)

    // 标题
    r.fillText('选择怪物放入牧场', w / 2, 490, c.textSecondary, font.small.size)

    // 怪物按钮
    for (const btn of this.buttons) {
      if (!btn.id.startsWith('picker_')) continue
      const m = MONSTER_DB[btn.monsterId]
      if (!m) continue

      const isPressed = (this.touchedBtn === btn)
      const isInSlot = this.slots.some(s => s.monsterId === btn.monsterId)

      // 背景
      const bgColor = isInSlot ? '#3a5a3a' : '#1a3a1a'
      r.fillRoundRect(btn.x, btn.y, btn.w, btn.h, THEME.radius.sm, bgColor, 0.9)

      // 按压
      if (isPressed) {
        r.fillRoundRect(btn.x, btn.y, btn.w, btn.h, THEME.radius.sm, c.primary, 0.2)
      }

      // 已在牧场标记
      if (isInSlot) {
        r.fillRoundRect(btn.x, btn.y, btn.w, btn.h, THEME.radius.sm, '#4a8a4a', 0.3)
      }

      const cx = btn.x + btn.w / 2
      const cy = btn.y + btn.h / 2

      // Emoji
      r.fillText(m.emoji, cx, cy - 8, c.textPrimary, font.body.size)

      // 名称
      r.fillText(m.name, cx, cy + 16, isInSlot ? c.gold : c.textSecondary, font.tiny.size)
    }
  }

  // ============================================
  // 渲染辅助：按钮
  // ============================================
  _renderBtn(r, id, text, x, y, w, h, highlight = false) {
    const isPressed = (this.touchedBtn && this.touchedBtn.id === id)
    const bgColor = highlight ? '#4a8a3a' : '#1a3a1a'
    r.fillRoundRect(x, y, w, h, THEME.radius.sm, bgColor, 0.9)
    if (isPressed) {
      r.fillRoundRect(x, y, w, h, THEME.radius.sm, '#ffffff', 0.1)
    }
    r.fillText(text, x + w / 2, y + h / 2, highlight ? COLORS.gold : '#cccccc', THEME.font.small.size)
  }

  // ============================================
  // 销毁
  // ============================================
  destroy() {
    this.game.input.onTap = null
    this.game.input.onSwipe = null
    this.game.input.onTouchStart = null
    this.game.input.onTouchEnd = null
    this.touchedBtn = null
    this.bubbles = []
  }
}
