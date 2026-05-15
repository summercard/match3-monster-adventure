// ============================================
// ui/sceneEvolve.js - 怪物进化场景
// ============================================

import { MONSTER_DB, getMonsterStats } from '../battle/monsterData.js'
import { ITEMS_DB } from '../data/items.js'
import { THEME, COLORS } from '../engine/theme.js'

export class SceneEvolve {
  constructor(game) {
    this.game = game
    this.storage = game.storage
    this.tapCallback = this._onTap.bind(this)

    // 布局参数
    this.designW = 375
    this.designH = 667

    // 按钮
    this.backBtn = { x: 15, y: 15, w: 60, h: 35 }
    this.evolveBtn = { x: 0, y: 0, w: 160, h: 50 }

    // 元素名称映射（theme不含完整属性名，保留本地映射）
    this.elementNames = {
      fire: '火', water: '水', grass: '草', thunder: '雷', light: '光',
      earth: '土', wind: '风', dark: '暗'
    }

    // 动画状态
    this.animState = {
      progress: 0,       // 进化动画进度 0-1
      particles: [],     // 粒子数组
      isEvolving: false,
      evolveComplete: false
    }
  }

  init(data) {
    console.log('[SceneEvolve] 进化场景初始化')
    this.monsterId = data.monsterId || null
    this.animState = {
      progress: 0,
      particles: [],
      isEvolving: false,
      evolveComplete: false
    }

    // 获取怪物数据
    if (this.monsterId && MONSTER_DB[this.monsterId]) {
      this.monsterData = { id: this.monsterId, ...MONSTER_DB[this.monsterId] }
      this.evolveData = this.monsterData.evolution || null
      this.evolvedMonster = this.evolveData && MONSTER_DB[this.evolveData.target]
        ? { id: this.evolveData.target, ...MONSTER_DB[this.evolveData.target] }
        : null
    } else {
      this.monsterData = null
      this.evolveData = null
      this.evolvedMonster = null
    }

    this._updateEvolveCondition()
    this.game.input.onTap = this.tapCallback
  }

  _updateEvolveCondition() {
    if (!this.monsterData || !this.evolveData) {
      this.canEvolve = false
      this.conditionText = '无法进化'
      return
    }

    // 检查等级条件（从存档获取怪物等级）
    const player = this.storage.loadPlayer()
    const monsterLevel = player.pokedex && player.pokedex[this.monsterId]
      ? player.pokedex[this.monsterId].level || 1
      : 1

    const levelOk = monsterLevel >= this.evolveData.level

    // 检查道具条件
    const requiredItem = this.evolveData.item || this._getDefaultEvolutionItem(this.monsterId)
    const itemCount = this.storage.getItemCount(requiredItem)
    const itemOk = itemCount > 0

    this.canEvolve = levelOk && itemOk

    // 条件文本
    const levelReq = `需要 Lv.${this.evolveData.level}`
    const itemData = ITEMS_DB[requiredItem]
    const itemReq = itemData ? `${itemData.name} ×1` : '进化道具 ×1'

    if (!levelOk && !itemOk) {
      this.conditionText = `${levelReq} + ${itemReq}`
    } else if (!levelOk) {
      this.conditionText = `${levelReq}（当前 Lv.${monsterLevel}）`
    } else if (!itemOk) {
      this.conditionText = `${itemReq}（背包 ${itemCount} 个）`
    } else {
      this.conditionText = '✅ 满足进化条件！'
    }
  }

  _getDefaultEvolutionItem(monsterId) {
    // 根据怪物属性返回默认进化道具，避免后续章节怪物都回落到火之石。
    const monster = MONSTER_DB[monsterId]
    const element = monster?.element || 'fire'
    const map = {
      fire: 'evolution_stone_fire',
      water: 'evolution_stone_water',
      grass: 'evolution_stone_grass',
      thunder: 'evolution_stone_thunder',
      light: 'evolution_stone_light',
      earth: 'evolution_stone_earth',
      wind: 'evolution_stone_wind',
      dark: 'evolution_stone_dark'
    }
    return map[element] || 'evolution_stone_fire'
  }

  _onTap(x, y) {
    if (this.animState.isEvolving) return

    // 返回按钮
    if (this._pointInRect(x, y, this.backBtn)) {
      this.game.sceneManager.changeScene('album', {}, 'slide')
      return
    }

    // 进化按钮
    if (this.canEvolve && this._pointInRect(x, y, this.evolveBtn)) {
      this._startEvolution()
      return
    }

    // 进化完成后的继续按钮
    if (this.animState.evolveComplete) {
      this.game.sceneManager.changeScene('album', {}, 'slide')
    }
  }

  _pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  }

  _startEvolution() {
    this.animState.isEvolving = true
    this.animState.progress = 0

    // 生成粒子
    this.animState.particles = []
    const cx = this.designW / 2
    const cy = this.designH / 2 - 30
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2
      const dist = 80 + Math.random() * 60
      this.animState.particles.push({
        x: cx,
        y: cy,
        tx: cx + Math.cos(angle) * dist,
        ty: cy + Math.sin(angle) * dist,
        life: 1,
        size: 4 + Math.random() * 6,
        color: THEME.colors.elementColors[this.monsterData.element] || COLORS.textMuted
      })
    }
  }

  _executeEvolution() {
    if (!this.canEvolve || !this.evolvedMonster) return

    // 消耗道具
    const requiredItem = this.evolveData.item || this._getDefaultEvolutionItem(this.monsterId)
    this.storage.useItem(requiredItem, 1)

    // 更新存档：将被进化怪物替换为进化后怪物
    const player = this.storage.loadPlayer()

    // 替换已收服列表中的怪物ID
    const captured = player.captured || []
    const idx = captured.indexOf(this.monsterId)
    if (idx !== -1) {
      captured[idx] = this.evolvedMonster.id
    }

    // 替换队伍中的怪物
    const team = this.storage.loadTeam()
    if (team.leader === this.monsterId) team.leader = this.evolvedMonster.id
    if (team.member1 === this.monsterId) team.member1 = this.evolvedMonster.id
    if (team.member2 === this.monsterId) team.member2 = this.evolvedMonster.id

    // 更新图鉴记录
    if (!player.pokedex) player.pokedex = {}
    // 保留原怪物的等级/经验给进化后怪物
    const oldMonsterData = player.pokedex[this.monsterId] || { level: 1, exp: 0 }
    player.pokedex[this.evolvedMonster.id] = { ...oldMonsterData }
    delete player.pokedex[this.monsterId]

    this.storage.savePlayer(player)
    this.storage.saveTeam(team)

    console.log(`[SceneEvolve] ${this.monsterData.name} 进化为 ${this.evolvedMonster.name}`)

    // 触发成就检查：进化怪物
    if (this.game.achievementManager) {
      this.game.achievementManager.checkAchievements('evolve', 1)
    }

    this.animState.evolveComplete = true
  }

  update(dt) {
    if (this.animState.isEvolving && !this.animState.evolveComplete) {
      this.animState.progress += dt * 1.5

      // 更新粒子
      for (const p of this.animState.particles) {
        p.x += (p.tx - p.x) * 0.1
        p.y += (p.ty - p.y) * 0.1
        p.life -= dt * 0.8
      }

      if (this.animState.progress >= 1) {
        this.animState.progress = 1
        this._executeEvolution()
      }
    }
  }

  render(r) {
    // 背景
    r.fillRect(0, 0, this.designW, this.designH, COLORS.bgMedium)

    // 进化动画中显示闪烁背景
    if (this.animState.isEvolving && !this.animState.evolveComplete) {
      const flash = Math.sin(this.animState.progress * Math.PI * 8) * 0.5 + 0.5
      r.fillRect(0, 0, this.designW, this.designH, `rgba(255,255,255,${flash * 0.1})`)
    }

    // 标题
    r.fillText('🔄 怪物进化', this.designW / 2, 40, COLORS.textPrimary, THEME.font.subtitle.size, THEME.font.subtitle.weight)

    // 返回按钮
    r.drawButton({ x: this.backBtn.x, y: this.backBtn.y, w: this.backBtn.w, h: this.backBtn.h, text: '← 返回' }, 'secondary')

    if (!this.monsterData) {
      r.fillText('未选择怪物', this.designW / 2, this.designH / 2, COLORS.textMuted, THEME.font.body.size)
      return
    }

    if (!this.evolvedMonster) {
      r.fillText('该怪物无法进化', this.designW / 2, this.designH / 2, COLORS.textMuted, THEME.font.body.size)
      return
    }

    if (this.animState.evolveComplete) {
      this._renderEvolveComplete(r)
      return
    }

    // 进化中动画
    if (this.animState.isEvolving) {
      this._renderEvolutionAnim(r)
      return
    }

    // 正常显示进化信息
    this._renderEvolutionInfo(r)
  }

  _renderEvolutionInfo(r) {
    const cx = this.designW / 2
    const cy = this.designH / 2 - 40

    // 当前形态
    const currentY = cy - 100
    r.fillText('当前形态', cx, currentY, COLORS.textMuted, THEME.font.small.size)
    this._renderMonsterCard(r, cx - 60, currentY + 15, this.monsterData, 120, 140)

    // 箭头
    const arrowY = cy - 30
    r.fillText('⬇️', cx, arrowY, COLORS.textPrimary, THEME.font.title.size)

    // 进化后形态
    const evolveY = cy + 30
    r.fillText('进化后', cx, evolveY, COLORS.gold, THEME.font.small.size)
    this._renderMonsterCard(r, cx - 60, evolveY + 15, this.evolvedMonster, 120, 140)

    // 进化条件
    const condY = evolveY + 175
    r.fillRoundRect(20, condY, this.designW - 40, 50, THEME.radius.md, COLORS.bgCard)
    r.fillText(this.conditionText, cx, condY + 30, this.canEvolve ? COLORS.success : COLORS.danger, THEME.font.small.size)

    // 进化按钮
    const btnY = this.designH - 100
    this.evolveBtn.x = cx - 80
    this.evolveBtn.y = btnY
    this.evolveBtn.w = 160
    this.evolveBtn.h = 50

    if (this.canEvolve) {
      r.drawButton({ x: this.evolveBtn.x, y: this.evolveBtn.y, w: this.evolveBtn.w, h: this.evolveBtn.h, text: '✨ 开始进化 ✨' }, 'primary')
    } else {
      r.drawButton({ x: this.evolveBtn.x, y: this.evolveBtn.y, w: this.evolveBtn.w, h: this.evolveBtn.h, text: '条件不足' }, 'secondary')
    }
  }

  _renderMonsterCard(r, x, y, monster, w, h) {
    const elementColor = THEME.colors.elementColors[monster.element] || COLORS.textMuted

    // 卡片背景
    r.fillRoundRect(x, y, w, h, THEME.radius.md + 2, COLORS.bgCard)
    r.strokeRect(x, y, w, h, 2, elementColor)

    // Emoji
    r.fillText(monster.emoji, x + w / 2, y + 45, COLORS.textPrimary, THEME.font.display.size)

    // 名字
    r.fillText(monster.name, x + w / 2, y + 80, COLORS.textPrimary, THEME.font.small.size, 'bold')

    // 稀有度
    const stars = '★'.repeat(monster.rarity)
    r.fillText(stars, x + w / 2, y + 100, COLORS.gold, THEME.font.tiny.size)

    // 属性标签
    const tagX = x + w / 2
    const tagY = y + 120
    r.fillRoundRect(tagX - 25, tagY, 50, 18, THEME.radius.sm, elementColor)
    r.fillText(this.elementNames[monster.element] || monster.element, tagX, tagY + 13, COLORS.textPrimary, THEME.font.tiny.size, 'bold')
  }

  _renderEvolutionAnim(r) {
    const cx = this.designW / 2
    const cy = this.designH / 2 - 40
    const progress = this.animState.progress

    // 绘制粒子
    for (const p of this.animState.particles) {
      if (p.life <= 0) continue
      const alpha = p.life
      r.fillText('✨', p.x, p.y, `rgba(255,215,0,${alpha})`, p.size)
    }

    // 中间怪物图标（渐变变化）
    if (progress < 0.6) {
      // 当前形态淡出
      const fadeOut = 1 - progress / 0.6
      r.fillText(this.monsterData.emoji, cx, cy, `rgba(255,255,255,${fadeOut})`, THEME.font.display.size)
    }
    if (progress > 0.4) {
      // 进化后形态淡入
      const fadeIn = (progress - 0.4) / 0.6
      r.fillText(this.evolvedMonster.emoji, cx, cy, `rgba(255,255,255,${fadeIn})`, THEME.font.display.size)
    }

    // 进度文字
    r.fillText('进化中...', cx, cy + 80, COLORS.gold, THEME.font.body.size)
  }

  _renderEvolveComplete(r) {
    const cx = this.designW / 2
    const cy = this.designH / 2 - 60

    r.fillText('🎉 进化成功！', cx, cy - 80, COLORS.gold, THEME.font.bigNum.size, THEME.font.bigNum.weight)

    // 进化后的怪物
    this._renderMonsterCard(r, cx - 70, cy - 50, this.evolvedMonster, 140, 160)

    // 进化后的属性变化
    const statsY = cy + 130
    r.fillRoundRect(40, statsY, this.designW - 80, 100, THEME.radius.md, COLORS.bgCard)

    const statsX1 = 60
    const statsX2 = 200
    r.fillText(`${this.monsterData.name} → ${this.evolvedMonster.name}`, cx, statsY + 20, COLORS.textPrimary, THEME.font.small.size, THEME.font.small.weight)

    const oldStats = `${this.monsterData.baseHP}/${this.monsterData.baseATK}/${this.monsterData.baseDEF}/${this.monsterData.baseSPD}`
    const newStats = `${this.evolvedMonster.baseHP}/${this.evolvedMonster.baseATK}/${this.evolvedMonster.baseDEF}/${this.evolvedMonster.baseSPD}`

    r.fillText('HP/ATK/DEF/SPD', cx, statsY + 45, COLORS.textMuted, THEME.font.tiny.size)
    r.fillText(`基础: ${oldStats}`, cx, statsY + 65, COLORS.textSecondary, THEME.font.tiny.size)
    r.fillText(`进化后: ${newStats}`, cx, statsY + 85, COLORS.success, THEME.font.tiny.size, 'bold')

    // 返回按钮
    const btnY = this.designH - 100
    this.evolveBtn.x = cx - 80
    this.evolveBtn.y = btnY
    this.evolveBtn.w = 160
    this.evolveBtn.h = 50

    r.drawButton({ x: this.evolveBtn.x, y: this.evolveBtn.y, w: this.evolveBtn.w, h: this.evolveBtn.h, text: '返回图鉴' }, 'secondary')
  }

  destroy() {
    this.game.input.onTap = null
  }
}

// Colors via THEME/COLORS constants (P0.1.6)
