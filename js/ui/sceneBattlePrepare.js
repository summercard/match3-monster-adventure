// ============================================
// ui/sceneBattlePrepare.js - 战斗准备场景
// ============================================

import { MONSTER_DB, ELEMENT_CHART, getMonsterStats } from '../battle/monsterData.js'
import { THEME, COLORS } from '../engine/theme.js'
import { chapters as STAGE_CHAPTERS } from '../../data/stages.js'

// 关卡数据（用于从 stageId 查找完整关卡信息）
function _getStagesData() {
  return { chapters: STAGE_CHAPTERS || [] }
}

export class SceneBattlePrepare {
  constructor(game) {
    this.game = game
    this.stageData = null          // 关卡数据
    this.stageId = null            // 关卡ID
    this.playerTeam = []           // 玩家队伍怪物数据
    this.enemyTeam = []            // 敌方怪物数据
    this.tapCallback = this._onTap.bind(this)

    // 布局参数
    this.designW = 375
    this.designH = 667
    this.margin = 15

    // 按钮
    this.backBtn = { x: 15, y: 15, w: 60, h: 35 }
    this.startBtn = { x: 0, y: 0, w: 200, h: 50 }

    // 队伍显示区
    this.teamY = 80
    this.enemyY = 300
    this.hintY = 420
    this.synergyY = 495
    this.btnY = 555

    // 空队伍提示
    this._showEmptyTeamAlert = false
    this._alertShowTime = 0
  }

  init(data = {}) {
    console.log('[SceneBattlePrepare] 战斗准备初始化')

    // 接收关卡数据
    this.stageId = data.stageId || 'stage_1_1'
    // 优先使用传入的 stageData；如果没有或不含 enemies，从 stages.js 查找
    if (data.stageData && data.stageData.enemies) {
      this.stageData = data.stageData
    } else {
      const lookedUp = this._lookupStageData(this.stageId)
      this.stageData = lookedUp || this._getDefaultStageData()
    }

    // 加载玩家队伍
    this._loadPlayerTeam()

    // 加载敌方数据
    this._loadEnemyTeam()

    // 注册点击回调
    this.game.input.onTap = this.tapCallback
  }

  _getDefaultStageData() {
    return {
      id: 'stage_1_1',
      name: '新手训练',
      enemies: ['enemy_001', 'enemy_002', 'enemy_003'],
      enemyLevel: 3
    }
  }

  /**
   * 从 stages.js 查找指定 stageId 的完整关卡数据
   * @param {string} stageId 如 "stage_5_2"
   * @returns {object|null} 关卡数据对象
   */
  _lookupStageData(stageId) {
    const stagesData = _getStagesData()
    if (!stagesData || !stagesData.chapters) return null

    for (const chapter of stagesData.chapters) {
      for (const stage of (chapter.stages || [])) {
        if (stage.id === stageId) {
          return {
            id: stage.id,
            name: stage.name,
            type: stage.type,
            enemies: stage.enemies || [],
            enemyLevel: stage.enemyLevel || 3,
            rewards: stage.rewards || null,
            phases: stage.phases || null,
            obstacles: stage.obstacles || null,
            lockedGems: stage.lockedGems || null,
            poisonFog: stage.poisonFog || null,
            eliteMultiplier: stage.eliteMultiplier || null
          }
        }
      }
    }
    return null
  }

  _loadPlayerTeam() {
    const teamData = this.game.storage.loadTeam()
    const { leader, member1, member2 } = teamData

    this.playerTeam = []
    for (const monsterId of [leader, member1, member2]) {
      if (monsterId && MONSTER_DB[monsterId]) {
        const base = MONSTER_DB[monsterId]
        this.playerTeam.push({
          id: monsterId,
          name: base.name,
          element: base.element,
          emoji: base.emoji,
          rarity: base.rarity,
          power: base.baseHP + base.baseATK + base.baseDEF + base.baseSPD
        })
      }
    }
  }

  _loadEnemyTeam() {
    this.enemyTeam = []
    const enemyIds = this.stageData.enemies || ['enemy_001', 'enemy_002', 'enemy_003']
    const enemyLevel = this.stageData.enemyLevel || 3

    for (const enemyId of enemyIds) {
      if (MONSTER_DB[enemyId]) {
        const base = MONSTER_DB[enemyId]
        this.enemyTeam.push({
          id: enemyId,
          name: base.name,
          element: base.element,
          emoji: base.emoji,
          rarity: base.rarity,
          level: enemyLevel,
          power: Math.floor((base.baseHP + base.baseATK + base.baseDEF + base.baseSPD) * (1 + (enemyLevel - 1) * 0.1))
        })
      }
    }
  }

  _getTeamTotalPower(team) {
    return team.reduce((sum, m) => sum + (m.power || 0), 0)
  }

  _isPlayerTeamEmpty() {
    const teamData = this.game.storage.loadTeam()
    return !teamData.leader && !teamData.member1 && !teamData.member2
  }

  _getElementHint() {
    if (this.enemyTeam.length === 0) return ''

    const enemyElements = [...new Set(this.enemyTeam.map(e => e.element))]
    const hints = []

    for (const elem of enemyElements) {
      const chart = ELEMENT_CHART[elem]
      if (!chart) continue

      const myElements = this.playerTeam.map(p => p.element)
      for (const myElem of myElements) {
        if (chart.weak === myElem) {
          hints.push(`⚠️ 敌方 ${this._getElementName(elem)} 属性克制你的 ${this._getElementName(myElem)}`)
        }
      }
    }

    return hints.length > 0 ? hints.join('\n') : '💡 属性无明显克制关系'
  }

  /**
   * 计算队伍属性协同信息（纯UI预览，与battleManager逻辑一致）
   */
  _calcSynergyPreview() {
    const elementCounts = {}
    this.playerTeam.forEach(m => {
      if (!m) return
      elementCounts[m.element] = (elementCounts[m.element] || 0) + 1
    })

    const result = []
    const elemEmojis = { fire: '🔥', water: '💧', grass: '🌿', thunder: '⚡', light: '✨' }
    const elemNames = { fire: '火', water: '水', grass: '草', thunder: '雷', light: '光' }

    for (const [elem, count] of Object.entries(elementCounts)) {
      if (count < 2) continue
      const pctLabel = count === 2 ? '+15%ATK/+10%DEF/+10%HP' : '+30%ATK/+20%DEF/+20%HP'
      const elemEmoji = elemEmojis[elem] || ''
      const elemName = elemNames[elem] || elem
      result.push({
        element: elem,
        count,
        label: `${elemEmoji}×${count} ${elemName}属性共鸣 ${pctLabel}`,
        color: this._getElementColor(elem)
      })
    }

    return result
  }

  _onTap(x, y) {
    // 返回按钮区域（动态，从drawButton返回的实际坐标）
    if (this._backBtnRendered && this._pointInRect(x, y, this._backBtnRendered)) {
      this.game.sceneManager.changeScene('stageSelect', {}, 'slide')
      return
    }

    // 开始战斗按钮区域
    if (this._startBtnRendered && this._pointInRect(x, y, this._startBtnRendered)) {
      this._startBattle()
      return
    }
  }

  _startBattle() {
    if (this._isPlayerTeamEmpty()) {
      console.log('[SceneBattlePrepare] 队伍为空，跳转队伍编成')
      this._showEmptyTeamAlert = true
      this._alertShowTime = Date.now()
      // 1.5秒后自动跳转到队伍编成页面
      setTimeout(() => {
        this.game.sceneManager.changeScene('teamSetup')
      }, 1500)
      return
    }
    console.log('[SceneBattlePrepare] 开始战斗:', this.stageId)
    this.game.sceneManager.changeScene('battle', {
      stageId: this.stageId,
      stageData: this.stageData
    })
  }

  _pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  }

  _getElementColor(element) {
    // 使用THEME.elementColors或THEME.colors的属性颜色
    return THEME.elementColors[element] || COLORS.textMuted
  }

  _getElementName(element) {
    const names = {
      fire: '火',
      water: '水',
      grass: '草',
      thunder: '雷',
      light: '光'
    }
    return names[element] || element
  }

  update(dt) {}

  render(r) {
    r.fillRect(0, 0, this.designW, this.designH, THEME.colors.bgMedium)

    // 返回按钮
    const backPressed = this.game.input.isPressed(this.backBtn.x, this.backBtn.y, this.backBtn.x + this.backBtn.w, this.backBtn.y + this.backBtn.h)
    this._backBtnRendered = r.drawButton(
      { x: this.backBtn.x, y: this.backBtn.y, w: this.backBtn.w, h: this.backBtn.h, text: '← 返回' },
      'primary',
      backPressed ? 0.95 : 1
    )

    // 标题
    r.fillText('⚔️ 战斗准备', this.designW / 2, 40, COLORS.white, THEME.font.subtitle.size, 'bold')

    // 关卡名称
    r.fillText(`📍 ${this.stageData.name}`, this.designW / 2, 65, THEME.colors.gold, THEME.font.small.size)

    // ===== 我方队伍 =====
    this._renderPlayerTeam(r)

    // ===== 战力对比 =====
    this._renderPowerComparison(r)

    // ===== 敌方信息 =====
    this._renderEnemyTeam(r)

    // ===== 属性克制提示 =====
    this._renderElementHint(r)

    // ===== 属性协同提示 =====
    this._renderSynergyPreview(r)

    // ===== 开始战斗按钮 =====
    this._renderStartButton(r)

    // ===== 空队伍提示弹窗 =====
    this._renderEmptyTeamAlert(r)
  }

  _renderPlayerTeam(r) {
    const y = this.teamY

    r.fillRect(this.margin, y - 10, this.designW - this.margin * 2, 1, COLORS.textDark)

    r.fillText('— 我方队伍 —', this.designW / 2, y + 10, THEME.colors.success, THEME.font.small.size)

    const cardW = 100
    const cardH = 130
    const gap = 10
    const totalW = this.playerTeam.length * cardW + (this.playerTeam.length - 1) * gap
    const startX = (this.designW - totalW) / 2
    const cardY = y + 25

    for (let i = 0; i < this.playerTeam.length; i++) {
      const monster = this.playerTeam[i]
      const x = startX + i * (cardW + gap)

      r.fillRoundRect(x, cardY, cardW, cardH, THEME.radius.md, THEME.colors.bgCard)
      r.strokeRect(x, cardY, cardW, cardH, 2, this._getElementColor(monster.element))

      r.fillText(monster.emoji, x + cardW / 2, cardY + 40, COLORS.white, 32)

      r.fillText(monster.name, x + cardW / 2, cardY + 65, COLORS.white, THEME.font.small.size, 'bold')

      const elemColor = this._getElementColor(monster.element)
      r.fillRoundRect(x + 10, cardY + 75, 30, 16, THEME.radius.sm, elemColor)
      r.fillText(this._getElementName(monster.element), x + 25, cardY + 85, COLORS.white, 9, 'bold')

      r.fillText(`战力: ${monster.power}`, x + cardW / 2, cardY + 105, THEME.colors.gold, THEME.font.small.size)

      const stars = '★'.repeat(monster.rarity)
      r.fillText(stars, x + cardW / 2, cardY + 120, THEME.colors.gold, 8)
    }
  }

  _renderPowerComparison(r) {
    const y = 225
    const playerPower = this._getTeamTotalPower(this.playerTeam)
    const enemyPower = this._getTeamTotalPower(this.enemyTeam)
    const isPlayerStronger = playerPower > enemyPower
    const isTeamEmpty = this._isPlayerTeamEmpty()

    r.fillRoundRect(this.margin, y, this.designW - this.margin * 2, 55, THEME.radius.lg, THEME.colors.bgCard)

    r.fillText('⚔️ 战力对比', this.designW / 2, y + 18, COLORS.white, THEME.font.small.size, 'bold')

    // 我方战力
    const playerColor = isTeamEmpty ? COLORS.textMuted : (isPlayerStronger ? THEME.colors.success : THEME.colors.danger)
    r.fillText(`我方: ${playerPower}`, this.designW / 2 - 80, y + 40, playerColor, THEME.font.number.size, 'bold')

    // VS
    r.fillText('VS', this.designW / 2, y + 40, COLORS.white, THEME.font.small.size, 'bold')

    // 敌方战力
    r.fillText(`敌方: ${enemyPower}`, this.designW / 2 + 80, y + 40, THEME.colors.danger, THEME.font.number.size, 'bold')

    // 差距提示
    if (!isTeamEmpty) {
      const diff = playerPower - enemyPower
      const diffText = diff > 0 ? `领先 ${diff}` : (diff < 0 ? `落后 ${-diff}` : '势均力敌')
      const diffColor = diff > 0 ? THEME.colors.success : (diff < 0 ? THEME.colors.danger : THEME.colors.gold)
      r.fillText(diffText, this.designW / 2, y + 52, diffColor, THEME.font.tiny.size)
    }
  }

  _renderEnemyTeam(r) {
    const y = this.enemyY

    r.fillRect(this.margin, y - 10, this.designW - this.margin * 2, 1, COLORS.textDark)

    r.fillText('— 敌方信息 —', this.designW / 2, y + 10, THEME.colors.danger, THEME.font.small.size)

    const cardW = 95
    const cardH = 120
    const gap = 8
    const totalW = this.enemyTeam.length * cardW + (this.enemyTeam.length - 1) * gap
    const startX = (this.designW - totalW) / 2
    const cardY = y + 25

    for (let i = 0; i < this.enemyTeam.length; i++) {
      const enemy = this.enemyTeam[i]
      const x = startX + i * (cardW + gap)

      const isBoss = enemy.rarity >= 3

      const bgColor = isBoss ? COLORS.battle.bossBg : THEME.colors.bgCard
      r.fillRoundRect(x, cardY, cardW, cardH, THEME.radius.md, bgColor)
      r.strokeRect(x, cardY, cardW, cardH, isBoss ? 3 : 2, isBoss ? THEME.colors.danger : this._getElementColor(enemy.element))

      r.fillText(enemy.emoji, x + cardW / 2, cardY + 35, COLORS.white, 28)

      const nameColor = isBoss ? THEME.colors.danger : COLORS.white
      r.fillText(enemy.name, x + cardW / 2, cardY + 58, nameColor, THEME.font.small.size, 'bold')

      r.fillText(`Lv.${enemy.level}`, x + cardW / 2, cardY + 72, COLORS.textMuted, 9)

      const elemColor = this._getElementColor(enemy.element)
      r.fillRoundRect(x + 10, cardY + 82, 30, 14, THEME.radius.sm, elemColor)
      r.fillText(this._getElementName(enemy.element), x + 25, cardY + 91, COLORS.white, 8, 'bold')

      // 战力数值
      r.fillText(`战力: ${enemy.power}`, x + cardW / 2, cardY + 108, THEME.colors.gold, THEME.font.small.size)
    }
  }

  _renderElementHint(r) {
    const y = this.hintY

    r.fillRoundRect(this.margin, y, this.designW - this.margin * 2, 70, THEME.radius.lg, THEME.colors.bgCard)

    r.fillText('💡 属性分析', this.designW / 2, y + 18, COLORS.white, THEME.font.small.size)

    const hint = this._getElementHint()
    const lines = hint.split('\n')

    lines.forEach((line, i) => {
      const color = line.includes('⚠️') ? THEME.colors.warning : COLORS.textMuted
      r.fillText(line, this.designW / 2, y + 40 + i * 18, color, THEME.font.small.size)
    })
  }

  _renderSynergyPreview(r) {
    const synergies = this._calcSynergyPreview()
    const y = this.synergyY

    // 卡片区域
    const cardH = synergies.length > 0 ? 35 + synergies.length * 20 : 30
    r.fillRoundRect(this.margin, y, this.designW - this.margin * 2, cardH, THEME.radius.lg, THEME.colors.bgCard)

    if (synergies.length === 0) {
      // 无协同
      r.fillText('🤝 属性协同: 无（队伍属性分散）', this.designW / 2, y + 20, COLORS.textMuted, THEME.font.small.size)
      return
    }

    r.fillText('🤝 属性协同', this.designW / 2, y + 16, COLORS.white, THEME.font.small.size, 'bold')

    synergies.forEach((syn, i) => {
      r.fillText(syn.label, this.designW / 2, y + 34 + i * 20, syn.color, THEME.font.small.size)
    })
  }

  _renderStartButton(r) {
    const btnW = 200
    const btnH = 50
    const btnX = (this.designW - btnW) / 2
    const btnY = this.btnY

    this.startBtn.x = btnX
    this.startBtn.y = btnY
    this.startBtn.w = btnW
    this.startBtn.h = btnH

    const isTeamEmpty = this._isPlayerTeamEmpty()
    const playerPower = this._getTeamTotalPower(this.playerTeam)
    const enemyPower = this._getTeamTotalPower(this.enemyTeam)
    const isPowerEnough = playerPower > enemyPower && !isTeamEmpty

    // 战力达标发光效果
    if (isPowerEnough) {
      r.fillRoundRect(btnX - 3, btnY - 3, btnW + 6, btnH + 6, 14, `${THEME.colors.success}40`)
      r.fillRoundRect(btnX - 1, btnY - 1, btnW + 2, btnH + 2, 13, `${THEME.colors.success}20`)
    }

    // 按钮颜色：空队伍时变灰
    const btnColor = isTeamEmpty ? COLORS.textDark : (isPowerEnough ? THEME.colors.success : THEME.colors.primary)

    // 按钮文字
    const text = isTeamEmpty ? '⚠️ 请先编成队伍' : '⚔️ 开始战斗'

    // 使用drawButton渲染，支持按下缩放
    const startPressed = this.game.input.isPressed(btnX, btnY, btnX + btnW, btnY + btnH)
    const startBtnCfg = { x: btnX, y: btnY, w: btnW, h: btnH, text }
    const btnType = isTeamEmpty ? 'secondary' : (isPowerEnough ? 'primary' : 'primary')

    this._startBtnRendered = r.drawButton(startBtnCfg, btnType, startPressed ? 0.95 : 1)
  }

  _renderEmptyTeamAlert(r) {
    if (!this._showEmptyTeamAlert) return

    const elapsed = Date.now() - this._alertShowTime
    if (elapsed > 2000) {
      this._showEmptyTeamAlert = false
      return
    }

    const alertW = 260
    const alertH = 80
    const alertX = (this.designW - alertW) / 2
    const alertY = this.designH / 2 - alertH / 2

    r.fillRoundRect(alertX, alertY, alertW, alertH, THEME.radius.lg, COLORS.battle.bossBg)
    r.strokeRect(alertX, alertY, alertW, alertH, 2, THEME.colors.danger)

    r.fillText('⚠️ 提示', this.designW / 2, alertY + 25, THEME.colors.danger, THEME.font.subtitle.size, 'bold')
    r.fillText('请先在"队伍编成"中', this.designW / 2, alertY + 45, COLORS.white, THEME.font.body.size)
    r.fillText('配置你的队伍！', this.designW / 2, alertY + 60, COLORS.white, THEME.font.body.size)
    r.fillText('（即将跳转...）', this.designW / 2, alertY + 75, COLORS.textMuted, THEME.font.tiny.size)
  }

  destroy() {
    this.game.input.onTap = null
  }
}
