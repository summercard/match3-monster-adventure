// ============================================
// ui/sceneTeamSetup.js - 队伍编成场景
// ============================================

import { MONSTER_DB, getMonsterStats } from '../battle/monsterData.js'
import { LEADER_SKILLS, getLeaderSkill } from '../../data/leader-skills.js'
import { getNature } from '../data/natures.js'
import { THEME, COLORS } from '../engine/theme.js'

export class SceneTeamSetup {
  constructor(game) {
    this.game = game

    // 布局参数
    this.designW = 375
    this.designH = 667
    this.margin = 15

    // 队伍槽位
    this.slots = [
      { key: 'leader', label: '队长', emoji: '👑', x: 0, y: 0, w: 100, h: 120 },
      { key: 'member1', label: '成员1', emoji: '⚔️', x: 0, y: 0, w: 80, h: 100 },
      { key: 'member2', label: '成员2', emoji: '⚔️', x: 0, y: 0, w: 80, h: 100 },
    ]

    // 怪物列表区域参数
    this.listStartY = 200
    this.listItemW = 85
    this.listItemH = 95
    this.listGap = 10
    this.listCols = 4

    // 按钮
    this.backBtn = { x: 15, y: 15, w: 60, h: 35 }
    this.saveBtn = { x: 0, y: 0, w: 140, h: 45 }
    this.cancelBtn = { x: 0, y: 0, w: 120, h: 45 }

    // 状态
    this.team = { leader: null, member1: null, member2: null }
    this.selectedSlot = null  // 当前选中的槽位 key
    this.hoveredSlot = null  // 悬停的槽位 key
    this.hoveredMonster = null  // 悬停的怪物索引
    this.listScrollY = 0
    this.tapCallback = this._onTap.bind(this)
    this.moveCallback = this._onMove.bind(this)
    this.swipeCallback = this._onSwipe.bind(this)

    // 动画状态
    this.animState = {
      showGuide: false,
      guideTimer: 0,
      assignPopScale: 0,      // 怪物分配弹跳缩放值
      assignPopTarget: null,  // 触发弹跳的槽位
      powerHighlight: false,   // 战力达标高亮
      powerHighlightTarget: false,
      slotGlowPhase: 0        // 槽位发光相位
    }

    // 缓动函数
    this._easeOutBack = (t) => {
      const c1 = 1.70158
      const c3 = c1 + 1
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
    }

    // 确认弹窗
    this.showConfirm = false
    this.confirmChoice = null  // 'confirm' | 'continue'
  }

  init(data) {
    console.log('[SceneTeamSetup] 队伍编成初始化')

    // 加载当前队伍数据
    const savedTeam = this.game.storage.loadTeam()
    this.team = { ...savedTeam }
    this.listScrollY = 0

    // 检查是否有收服怪物，如果没有显示引导
    const captured = this._getCapturedMonsters()
    this.animState.showGuide = (captured.length === 0)

    // 注册点击和移动回调
    this.game.input.onTap = this.tapCallback
    this.game.input.onMove = this.moveCallback
    this.game.input.onSwipe = this.swipeCallback
  }

  _getCapturedMonsters() {
    const player = this.game.storage.loadPlayer()
    return player.captured || []
  }

  _onMove(x, y) {
    // 检测槽位悬停
    this.hoveredSlot = null
    for (const slot of this.slots) {
      if (this._pointInRect(x, y, slot)) {
        this.hoveredSlot = slot.key
        break
      }
    }

    // 检测怪物列表悬停
    this.hoveredMonster = null
    const captured = this._getCapturedMonsters()
    if (captured.length > 0) {
      const listX = (this.designW - (this.listCols * this.listItemW + (this.listCols - 1) * this.listGap)) / 2
      const listY = this.listStartY
      const listBottomY = this.designH - 95

      const relX = x - listX
      const relY = y - listY + this.listScrollY

      if (relX >= 0 && relY >= 0 && y >= listY && y <= listBottomY) {
        const col = Math.floor(relX / (this.listItemW + this.listGap))
        const row = Math.floor(relY / (this.listItemH + this.listGap))
        const index = row * this.listCols + col

        if (index < captured.length) {
          this.hoveredMonster = index
        }
      }
    }
  }

  _getMonsterData(monsterId) {
    if (!monsterId || !MONSTER_DB[monsterId]) return null
    return { id: monsterId, ...MONSTER_DB[monsterId] }
  }

  _calcTeamPower() {
    let power = 0
    for (const key of ['leader', 'member1', 'member2']) {
      const m = this._getMonsterData(this.team[key])
      if (m) {
        const realLevel = this.game.storage.getMonsterLevel(m.id) || 1
        const natureId = this.game.storage.getMonsterNature(m.id)
        const stats = getMonsterStats(m.id, realLevel, natureId)
        if (stats) {
          power += stats.hp + stats.atk + stats.def + stats.spd
        }
      }
    }
    return power
  }

  _checkPowerReady() {
    const power = this._calcTeamPower()
    const captured = this._getCapturedMonsters()
    if (captured.length === 0) return false
    // 简单判断：有队长即可算战力达标
    return this.team.leader !== null
  }

  _onTap(x, y) {
    // 确认弹窗处理
    if (this.showConfirm) {
      this._handleConfirmTap(x, y)
      return
    }

    // 返回按钮
    if (this._pointInRect(x, y, this.backBtn)) {
      this.game.sceneManager.changeScene('main', {}, 'slide')
      return
    }

    // 保存按钮
    if (this._pointInRect(x, y, this.saveBtn)) {
      this._saveTeam()
      this.game.sceneManager.changeScene('main', {}, 'slide')
      return
    }

    // 取消按钮 - 显示确认弹窗
    if (this._pointInRect(x, y, this.cancelBtn)) {
      this.showConfirm = true
      this.confirmChoice = null
      return
    }

    // 点击槽位切换选中状态
    for (const slot of this.slots) {
      if (this._pointInRect(x, y, slot)) {
        if (this.team[slot.key]) {
          // 已有怪物：点击清空槽位
          this.team[slot.key] = null
          this.selectedSlot = null
        } else {
          // 空槽位：切换选中状态
          this.selectedSlot = this.selectedSlot === slot.key ? null : slot.key
        }
        return
      }
    }

    // 点击怪物列表
    const captured = this._getCapturedMonsters()
    const listX = (this.designW - (this.listCols * this.listItemW + (this.listCols - 1) * this.listGap)) / 2
    const listY = this.listStartY
    const listBottomY = this.designH - 95

    const relX = x - listX
    const relY = y - listY + this.listScrollY

    if (relX >= 0 && relY >= 0 && y >= listY && y <= listBottomY) {
      const col = Math.floor(relX / (this.listItemW + this.listGap))
      const row = Math.floor(relY / (this.listItemH + this.listGap))
      const index = row * this.listCols + col

      if (index < captured.length) {
        const monsterId = captured[index]
        this._assignToSlot(monsterId)
        return
      }
    }
  }

  _onSwipe(x, y, direction) {
    if (this.showConfirm || y < this.listStartY) return
    const step = this.listItemH + this.listGap
    const maxScroll = this._getMaxListScroll()
    if (direction === 'up') {
      this.listScrollY = Math.min(maxScroll, this.listScrollY + step)
    } else if (direction === 'down') {
      this.listScrollY = Math.max(0, this.listScrollY - step)
    }
  }

  _getMaxListScroll() {
    const captured = this._getCapturedMonsters()
    const rows = Math.ceil(captured.length / this.listCols)
    const contentH = rows * (this.listItemH + this.listGap) - this.listGap
    const viewH = this.designH - 95 - this.listStartY
    return Math.max(0, contentH - viewH)
  }

  _handleConfirmTap(x, y) {
    // 确认取消按钮
    const confirmBtn = { x: this.designW / 2 - 110, y: this.designH / 2 + 30, w: 100, h: 40 }
    // 继续编辑按钮
    const continueBtn = { x: this.designW / 2 + 10, y: this.designH / 2 + 30, w: 100, h: 40 }

    if (this._pointInRect(x, y, confirmBtn)) {
      this.showConfirm = false
      this.game.sceneManager.changeScene('main', {}, 'slide')
      return
    }

    if (this._pointInRect(x, y, continueBtn)) {
      this.showConfirm = false
      return
    }
  }

  _assignToSlot(monsterId) {
    if (!this.selectedSlot) {
      // 找第一个空槽位
      for (const slot of this.slots) {
        if (!this.team[slot.key]) {
          this.team[slot.key] = monsterId
          this.selectedSlot = null
          // 触发弹跳动画
          this._triggerAssignPop(slot.key)
          return
        }
      }
      // 如果没有空槽位，选择队长槽位
      this.team.leader = monsterId
      this._triggerAssignPop('leader')
      return
    }

    // 交换：如果目标槽位已有怪物，与选中槽位交换
    const existingMonster = this.team[this.selectedSlot]
    this.team[this.selectedSlot] = monsterId

    // 如果该怪物在其他槽位，清空那个槽位
    for (const slot of this.slots) {
      if (slot.key !== this.selectedSlot && this.team[slot.key] === monsterId) {
        this.team[slot.key] = existingMonster
        break
      }
    }

    this._triggerAssignPop(this.selectedSlot)
    this.selectedSlot = null
  }

  _triggerAssignPop(slotKey) {
    this.animState.assignPopTarget = slotKey
    this.animState.assignPopScale = 1.3  // 放大
    this._assignPopStartTime = Date.now()
    // 动画通过 update 驱动
  }

  _saveTeam() {
    this.game.storage.saveTeam(this.team)
    console.log('[SceneTeamSetup] 队伍已保存:', this.team)
  }

  _pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  }

  update(dt) {
    // 引导提示闪烁
    if (this.animState.showGuide) {
      this.animState.guideTimer += dt
    }

    // 槽位发光动画
    this.animState.slotGlowPhase += dt * 4

    // 分配弹跳动画 - 使用easeOutBack缓动
    if (this.animState.assignPopScale !== 1 && this.animState.assignPopTarget) {
      const elapsed = this._getAssignPopElapsed()
      const duration = 0.3
      if (elapsed < duration) {
        // 先放大后回弹
        const t = elapsed / duration
        if (t < 0.5) {
          // 前半段：从1.3缩放到1.0
          this.animState.assignPopScale = 1.3 - 0.3 * (t * 2)
        } else {
          // 后半段：从1.0弹到1.05再回到1.0
          const t2 = (t - 0.5) * 2
          this.animState.assignPopScale = 1.0 + 0.05 * Math.sin(t2 * Math.PI)
        }
      } else {
        this.animState.assignPopScale = 1
      }
    }

    // 战力达标高亮
    const shouldHighlight = this._checkPowerReady()
    if (shouldHighlight !== this.animState.powerHighlightTarget) {
      this.animState.powerHighlightTarget = shouldHighlight
    }
    // 平滑过渡
    if (this.animState.powerHighlight !== this.animState.powerHighlightTarget) {
      const speed = 3
      if (this.animState.powerHighlightTarget) {
        this.animState.powerHighlight += speed * dt
        if (this.animState.powerHighlight > 1) this.animState.powerHighlight = 1
      } else {
        this.animState.powerHighlight -= speed * dt
        if (this.animState.powerHighlight < 0) this.animState.powerHighlight = 0
      }
    }
  }

  _getAssignPopElapsed() {
    if (!this._assignPopStartTime) return 0
    return (Date.now() - this._assignPopStartTime) / 1000
  }

  render(r) {
    r.fillRect(0, 0, this.designW, this.designH, COLORS.bgMedium)

    // 标题
    r.fillText('⚙️ 队伍编成', this.designW / 2, 40, COLORS.textPrimary, THEME.font.subtitle.size, THEME.font.subtitle.weight)

    // 返回按钮
    r.drawButton({ x: this.backBtn.x, y: this.backBtn.y, w: this.backBtn.w, h: this.backBtn.h, text: '← 返回' }, 'secondary')

    // 渲染空队伍引导提示
    this._renderEmptyGuide(r)

    // 渲染队伍槽位
    this._renderTeamSlots(r)

    // 战力显示
    const power = this._calcTeamPower()
    this._renderPowerDisplay(r, power)

    // 分隔线
    r.fillRect(this.margin, 170, this.designW - this.margin * 2, 1, COLORS.disabledBg)

    // 怪物列表标题
    r.fillText('📋 已收服怪物', this.designW / 2, 195, COLORS.textSecondary, THEME.font.small.size)

    // 渲染怪物列表
    this._renderMonsterList(r)

    // 底部按钮
    this._renderButtons(r)

    // 确认弹窗
    if (this.showConfirm) {
      this._renderConfirmDialog(r)
    }
  }

  _renderEmptyGuide(r) {
    const captured = this._getCapturedMonsters()
    if (captured.length > 0) return

    // 闪烁效果
    const alpha = 0.6 + Math.sin(this.animState.guideTimer * 3) * 0.4

    r.fillText('💡 点击开始冒险，赢取你的第一只怪物！', this.designW / 2, 55, `rgba(255,215,0,${alpha})`, THEME.font.tiny.size)
  }

  _renderPowerDisplay(r, power) {
    // 根据是否达标决定颜色
    const isReady = this._checkPowerReady()
    let powerColor = COLORS.textSecondary
    if (this.animState.powerHighlight > 0) {
      // 从灰色渐变到绿色
      const g = Math.floor(170 + 85 * this.animState.powerHighlight)
      const r = Math.floor(170 - 170 * this.animState.powerHighlight)
      powerColor = `rgb(${r},${g},50)`
    }

    r.fillText(`队伍总战力: ${power}`, this.designW / 2, 155, powerColor, THEME.font.small.size, 'bold')
  }

  _renderTeamSlots(r) {
    // 队长槽位在中间上方，成员槽位在两侧
    const centerX = this.designW / 2
    const startY = 70

    // 队长槽位
    const leaderSlot = this.slots[0]
    leaderSlot.x = centerX - 50
    leaderSlot.y = startY
    leaderSlot.w = 100
    leaderSlot.h = 120

    // 成员1 槽位
    const member1Slot = this.slots[1]
    member1Slot.x = centerX - 50 - 90
    member1Slot.y = startY + 10
    member1Slot.w = 80
    member1Slot.h = 100

    // 成员2 槽位
    const member2Slot = this.slots[2]
    member2Slot.x = centerX + 50 + 10
    member2Slot.y = startY + 10
    member2Slot.w = 80
    member2Slot.h = 100

    // 渲染三个槽位
    for (const slot of this.slots) {
      this._renderSlot(r, slot)
    }
  }

  _renderSlot(r, slot) {
    const isSelected = this.selectedSlot === slot.key
    const isHovered = this.hoveredSlot === slot.key
    const monsterId = this.team[slot.key]
    const monster = monsterId ? this._getMonsterData(monsterId) : null

    // 检测是否触发弹跳动画
    let scale = 1
    if (this.animState.assignPopTarget === slot.key && this.animState.assignPopScale !== 1) {
      scale = this.animState.assignPopScale
    }

    // 槽位背景
    let bgColor = COLORS.bgCard
    let borderColor = COLORS.slotBorder
    let borderWidth = 2

    if (isSelected) {
      borderColor = COLORS.gold
      borderWidth = 3
    }

    if (monster) {
      bgColor = COLORS.inTeamBg
      borderColor = THEME.colors.elementColors[monster.element] || COLORS.textMuted
    }

    // 应用缩放变换
    if (scale !== 1) {
      const cx = slot.x + slot.w / 2
      const cy = slot.y + slot.h / 2
      const newW = slot.w * scale
      const newH = slot.h * scale
      const newX = cx - newW / 2
      const newY = cy - newH / 2

      // 悬停时外发光效果
      if (isHovered) {
        const glowAlpha = 0.3 + Math.sin(this.animState.slotGlowPhase) * 0.15
        r.strokeRect(newX - 4, newY - 4, newW + 8, newH + 8, 4, `rgba(255,215,0,${glowAlpha})`)
      }

      r.fillRoundRect(newX, newY, newW, newH, THEME.radius.md, bgColor)
      r.strokeRect(newX, newY, newW, newH, borderWidth, borderColor)

      // 选中时的边框闪烁
      if (isSelected) {
        const flash = Math.sin(Date.now() / 150) * 0.3 + 0.7
        r.strokeRect(newX - 2, newY - 2, newW + 4, newH + 4, 2, `rgba(255,215,0,${flash})`)
      }

      // 怪物图标
      r.fillText(monster.emoji, cx, cy - 15, COLORS.textPrimary, THEME.font.icon.size)
      // 名字
      r.fillText(monster.name, cx, cy + 8, COLORS.textPrimary, THEME.font.tiny.size, 'bold')

      // 等级（读取真实等级而非写死Lv.1）
      const realLevel = this.game.storage.getMonsterLevel(monsterId) || 1
      r.fillText(`Lv.${realLevel}`, cx, cy + 23, COLORS.textMuted, THEME.font.tiny.size)

      // 性格标签
      const natureId = this.game.storage.getMonsterNature(monsterId)
      const nature = natureId ? getNature(natureId) : null
      if (nature) {
        r.fillText(`${nature.emoji}${nature.name}`, cx, cy + 35, COLORS.gold, THEME.font.tiny.size)
      }
      // 属性标签
      const tagColor = THEME.colors.elementColors[monster.element] || COLORS.textMuted
      r.fillRoundRect(newX + 5, newY + 5, 28, 14, THEME.radius.sm - 2, tagColor)
      r.fillText(this._getElementName(monster.element), newX + 19, newY + 14, COLORS.textPrimary, THEME.font.tiny.size)
      // 槽位标签
      r.fillText(slot.label, cx, newY + newH - 12, COLORS.textMuted, THEME.font.tiny.size)

      // 队长技能显示（仅队长槽位 + 有怪物的场合）
      if (slot.key === 'leader' && monster.leaderSkill) {
        const skill = getLeaderSkill(monster.leaderSkill)
        if (skill) {
          // 技能名称（金色小字）
          r.fillText(`${skill.icon}${skill.name}`, cx, newY + newH + 10, COLORS.gold, THEME.font.tiny.size, 'bold')
          // 技能效果描述
          r.fillText(skill.desc, cx, newY + newH + 22, COLORS.textSecondary, THEME.font.tiny.size)
        }
      } else if (slot.key === 'leader' && monster && !monster.leaderSkill) {
        // 队长位但怪物没有队长技能
        r.fillText('(无队长技能)', cx, newY + newH + 10, COLORS.textMuted, THEME.font.tiny.size)
      }
    } else {
      // 空槽位
      const cx = slot.x + slot.w / 2
      const cy = slot.y + slot.h / 2

      // 悬停时外发光效果
      if (isHovered) {
        const glowAlpha = 0.3 + Math.sin(this.animState.slotGlowPhase) * 0.15
        r.strokeRect(slot.x - 4, slot.y - 4, slot.w + 8, slot.h + 8, 4, `rgba(255,215,0,${glowAlpha})`)
      }

      r.fillRoundRect(slot.x, slot.y, slot.w, slot.h, THEME.radius.md, bgColor)

      // 选中时的边框闪烁
      if (isSelected) {
        const flash = Math.sin(Date.now() / 150) * 0.3 + 0.7
        r.strokeRect(slot.x - 2, slot.y - 2, slot.w + 4, slot.h + 4, 2, `rgba(255,215,0,${flash})`)
      }

      r.strokeRect(slot.x, slot.y, slot.w, slot.h, borderWidth, borderColor)

      const isLeader = slot.key === 'leader'
      const emoji = isLeader ? '👑' : '⚔️'
      const label = isLeader ? '队长' : '成员'

      const textColor = isSelected ? COLORS.gold : COLORS.textDark
      r.fillText(emoji, cx, cy - 15, textColor, THEME.font.icon.size)
      r.fillText(isSelected ? '选择怪物' : label, cx, cy + 5, textColor, THEME.font.tiny.size)
      r.fillText(isLeader ? '点击后将填入此处' : '', cx, cy + 20, COLORS.textMuted, THEME.font.tiny.size)

      // 槽位标签
      r.fillText(slot.label, cx, slot.y + slot.h - 12, COLORS.textMuted, THEME.font.tiny.size)
    }
  }

  _renderMonsterList(r) {
    const captured = this._getCapturedMonsters()
    const listX = (this.designW - (this.listCols * this.listItemW + (this.listCols - 1) * this.listGap)) / 2
    const listY = this.listStartY

    for (let i = 0; i < captured.length; i++) {
      const monsterId = captured[i]
      const monster = this._getMonsterData(monsterId)
      if (!monster) continue

      const col = i % this.listCols
      const row = Math.floor(i / this.listCols)
      const x = listX + col * (this.listItemW + this.listGap)
      const y = listY + row * (this.listItemH + this.listGap) - this.listScrollY
      const listBottomY = this.designH - 95
      if (y < listY || y + this.listItemH > listBottomY) continue

      // 检查是否在队伍中
      const inTeam = this.game.storage.isMonsterInTeam(monsterId)
      const teamSlot = this._getSlotKeyForMonster(monsterId)

      // 卡片背景
      const bgColor = inTeam ? COLORS.inTeamBg : COLORS.bgCard
      const borderColor = inTeam ? COLORS.gold : (THEME.colors.elementColors[monster.element] || COLORS.textMuted)

      r.fillRoundRect(x, y, this.listItemW, this.listItemH, THEME.radius.md - 2, bgColor)
      r.strokeRect(x, y, this.listItemW, this.listItemH, inTeam ? 2 : 1, borderColor)

      // 如果在队伍中，显示队伍位置标签
      if (inTeam && teamSlot) {
        const slotLabel = teamSlot === 'leader' ? '队长' : (teamSlot === 'member1' ? '成员1' : '成员2')
        r.fillRoundRect(x + 2, y + 2, 32, 12, THEME.radius.sm - 2, COLORS.gold)
        r.fillText(slotLabel, x + 18, y + 10, COLORS.bgPanel, THEME.font.tiny.size, 'bold')
      }

      // 怪物emoji
      r.fillText(monster.emoji, x + this.listItemW / 2, y + 28, COLORS.textPrimary, THEME.font.icon.size)

      // 名字
      r.fillText(monster.name, x + this.listItemW / 2, y + 52, COLORS.textPrimary, THEME.font.tiny.size, 'bold')

      // 等级+性格（显示在名字下方）
      const realLevel = this.game.storage.getMonsterLevel(monsterId) || 1
      const natureId = this.game.storage.getMonsterNature(monsterId)
      const nature = natureId ? getNature(natureId) : null
      r.fillText(`Lv.${realLevel}`, x + this.listItemW / 2 - 14, y + 64, COLORS.textMuted, THEME.font.tiny.size)
      if (nature) {
        r.fillText(`${nature.emoji}${nature.name}`, x + this.listItemW / 2 + 14, y + 64, COLORS.gold, THEME.font.tiny.size)
      }

      // 属性
      r.fillText(this._getElementName(monster.element), x + this.listItemW / 2, y + 76, THEME.colors.elementColors[monster.element] || COLORS.textMuted, THEME.font.tiny.size)

      // 稀有度
      const stars = '★'.repeat(monster.rarity)
      r.fillText(stars, x + this.listItemW / 2, y + 88, COLORS.gold, THEME.font.tiny.size)

      // 队长技能标记（★3+有队长技能）
      if (monster.leaderSkill) {
        const skill = getLeaderSkill(monster.leaderSkill)
        if (skill) {
          r.fillText(skill.icon, x + this.listItemW - 12, y + 10, COLORS.gold, THEME.font.tiny.size)
        }
      }

      // 在队伍中标记
      if (inTeam) {
        r.fillText('☑️', x + this.listItemW - 15, y + 12, COLORS.success, THEME.font.tiny.size)
      }
    }

    const maxScroll = this._getMaxListScroll()
    if (maxScroll > 0) {
      const trackY = listY
      const trackH = this.designH - 95 - listY
      const thumbH = Math.max(34, trackH * (trackH / (trackH + maxScroll)))
      const thumbY = trackY + (trackH - thumbH) * (this.listScrollY / maxScroll)
      r.fillRoundRect(this.designW - 8, trackY, 3, trackH, 2, 'rgba(255,255,255,0.12)')
      r.fillRoundRect(this.designW - 9, thumbY, 5, thumbH, 3, 'rgba(255,255,255,0.45)')
    }
  }

  _getSlotKeyForMonster(monsterId) {
    for (const slot of this.slots) {
      if (this.team[slot.key] === monsterId) {
        return slot.key
      }
    }
    return null
  }

  _renderButtons(r) {
    const btnY = this.designH - 80

    // 保存按钮
    this.saveBtn.x = this.designW - 20 - 140
    this.saveBtn.y = btnY
    this.saveBtn.w = 140
    this.saveBtn.h = 45

    r.drawButton({ x: this.saveBtn.x, y: this.saveBtn.y, w: this.saveBtn.w, h: this.saveBtn.h, text: '💾 保存' }, 'primary')

    // 取消按钮
    this.cancelBtn.x = 20
    this.cancelBtn.y = btnY
    this.cancelBtn.w = 100
    this.cancelBtn.h = 45

    r.drawButton({ x: this.cancelBtn.x, y: this.cancelBtn.y, w: this.cancelBtn.w, h: this.cancelBtn.h, text: '取消' }, 'danger')
  }

  _renderConfirmDialog(r) {
    // 半透明遮罩
    r.fillRect(0, 0, this.designW, this.designH, 'rgba(0,0,0,0.7)')

    // 弹窗背景
    const dialogW = 280
    const dialogH = 160
    const dialogX = (this.designW - dialogW) / 2
    const dialogY = (this.designH - dialogH) / 2

    r.fillRoundRect(dialogX, dialogY, dialogW, dialogH, THEME.radius.md + 2, COLORS.dialogBg)
    r.strokeRect(dialogX, dialogY, dialogW, dialogH, 2, COLORS.gold)

    // 标题
    r.fillText('⚠️ 确认取消', this.designW / 2, dialogY + 35, COLORS.gold, THEME.font.body.size, 'bold')

    // 提示文字
    r.fillText('放弃当前编辑？', this.designW / 2, dialogY + 60, COLORS.textSecondary, THEME.font.small.size)
    r.fillText('（未保存的更改将丢失）', this.designW / 2, dialogY + 80, COLORS.textMuted, THEME.font.tiny.size)

    // 确认取消按钮
    const confirmBtn = { x: dialogX + 20, y: dialogY + 100, w: 100, h: 40 }
    r.drawButton({ x: confirmBtn.x, y: confirmBtn.y, w: confirmBtn.w, h: confirmBtn.h, text: '确认取消' }, 'danger')

    // 继续编辑按钮
    const continueBtn = { x: dialogX + 160, y: dialogY + 100, w: 100, h: 40 }
    r.drawButton({ x: continueBtn.x, y: continueBtn.y, w: continueBtn.w, h: continueBtn.h, text: '继续编辑' }, 'secondary')
  }

  _getElementColor(element) {
    return THEME.colors.elementColors[element] || COLORS.textMuted
  }

  _getElementName(element) {
    const names = {
      fire: '火',
      water: '水',
      grass: '草',
      thunder: '雷',
      light: '光',
      earth: '土',
      wind: '风',
      dark: '暗'
    }
    return names[element] || element
  }

  destroy() {
    this.game.input.onTap = null
    this.game.input.onMove = null
    this.game.input.onSwipe = null
  }
}

// Colors via THEME/COLORS constants (P0.1.6)
