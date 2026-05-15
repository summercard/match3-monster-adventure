// ============================================
// ui/sceneResult.js - 战斗结算场景
// ============================================

import { MONSTER_DB } from '../battle/monsterData.js'
import { THEME, COLORS } from '../engine/theme.js'
import { calcCaptureProbability, attemptCapture, getCaptureResultText, calcBattleStars } from '../collection/capture.js'
import { ITEMS_DB, rollDrop } from '../data/items.js'
import { CaptureEffectManager } from '../engine/CaptureEffectManager.js'
import { chapters as STAGE_CHAPTERS } from '../../data/stages.js'

export class SceneResult {
  constructor(game) {
    this.game = game
    this.storage = game.storage
    this.state = 'idle'  // idle | animating
    this.battleResult = null  // 传入的战斗结果

    // 收服特效管理器
    this.captureEffectManager = new CaptureEffectManager(game)

    // 动画状态
    this.starAnimProgress = 0   // 0-1
    this.rewardAnimProgress = 0 // 0-1 金币+道具动画
    this.expAnimProgress = 0   // 0-1
    this.buttonAnimProgress = 0 // 0-1

    // 结算数据
    this.stars = 0
    this.captured = false
    this.captureResult = null
    this.captureTarget = null
    this.captureItemUsed = null
    this.rewards = { gold: 0, exp: 0, item: null, itemName: '' }
    this.levelUps = []  // 记录本次战斗升级的怪物 [{monsterId, oldLevel, newLevel}]

    // 设计尺寸基准
    this.designW = 375
    this.designH = 667

    // 按钮区域（两个按钮：下一关 + 返回关卡）
    this.nextBtn = { x: 0, y: 0, w: 160, h: 46 }
    this.backBtn = { x: 0, y: 0, w: 160, h: 46 }
    this.isWin = false
    this.hasNextStage = false
    this.touchedBtn = null  // 'next' | 'back' | null
    this.touchStartCallback = this._onTouchStart.bind(this)
    this.touchEndCallback = this._onTouchEnd.bind(this)
  }

  init(battleResult) {
    this.battleResult = battleResult
    this.state = 'idle'
    this.isWin = battleResult.result === 'win'

    // 计算星级
    const playerTeam = battleResult.playerTeam || []
    const aliveHp = playerTeam.reduce((sum, m) => sum + (m ? m.hp : 0), 0)
    const maxHp = playerTeam.reduce((sum, m) => sum + (m ? m.maxHP : 0), 0)
    const playerHpRatio = maxHp > 0 ? aliveHp / maxHp : 0

    this.stars = calcBattleStars(battleResult.turnCount, battleResult.maxTurns, playerHpRatio)

    // 收服判定（仅胜利时）
    if (this.isWin) {
      // 收服目标选择：胜利时所有敌人 hp≤0，所以不能按 hp>0 筛选
      // 策略：优先选存活的（理论上不会有），否则随机选一个被击败的敌人
      let targetEnemy = battleResult.enemies.find(e => e && e.hp > 0)
      if (!targetEnemy) {
        // 所有敌人都被击败 → 随机选一个有效敌人作为收服候选
        const validEnemies = battleResult.enemies.filter(e => e && e.id)
        if (validEnemies.length > 0) {
          targetEnemy = validEnemies[Math.floor(Math.random() * validEnemies.length)]
        }
      }

      if (targetEnemy) {
        this.captureTarget = targetEnemy
        const enemyRarity = targetEnemy.rarity || 1

        // 读取连续收服失败计数（BD-P5 新手保护）
        const player = this.storage.loadPlayer()
        const consecutiveFails = player.captureFails || 0

        let prob = calcCaptureProbability(
          targetEnemy.hp, targetEnemy.maxHP,
          battleResult.playerLevel || 1,
          battleResult.enemyLevel || 1,
          enemyRarity,
          { stageId: battleResult.stageId, consecutiveFails }
        )
        const bonus = this._consumeBestCaptureItem()
        if (bonus > 0) {
          prob = Math.min(0.95, prob + bonus)
        }
        this.captured = attemptCapture(prob)
        this.captureResult = getCaptureResultText(prob, this.captured)

        // 更新连续收服失败计数（BD-P5）
        if (this.captured) {
          // 成功：重置计数
          player.captureFails = 0
          this.storage.savePlayer(player)
        } else {
          // 失败：累加计数
          player.captureFails = consecutiveFails + 1
          this.storage.savePlayer(player)
        }

        // 添加收服特效（怪物位置在屏幕上方 1/3 处）
        const enemyX = this.designW / 2
        const enemyY = this.designH * 0.25
        this.captureEffectManager.add(this.captured, enemyX, enemyY)
      }
    }

    // 计算奖励
    this._calcRewards()

    // 按钮位置
    if (this.isWin && this.battleResult.stageId) {
      // 胜利：两个按钮并排（下一关 + 返回）
      this.hasNextStage = this._findNextStage(this.battleResult.stageId) !== null
      const btnY = this.designH - 100
      const gap = 12
      const totalW = 160 * 2 + gap
      const startX = (this.designW - totalW) / 2
      this.nextBtn = { x: startX, y: btnY, w: 160, h: 46 }
      this.backBtn = { x: startX + 160 + gap, y: btnY, w: 160, h: 46 }
    } else {
      // 失败：一个重试按钮（居中）
      this.hasNextStage = false
      this.backBtn = { x: this.designW / 2 - 100, y: this.designH - 100, w: 200, h: 50 }
      this.nextBtn = { x: 0, y: 0, w: 0, h: 0 }
    }

    // 保存奖励到存档
    this._saveRewards()

    // 保存关卡星级
    if (this.isWin && this.battleResult.stageId) {
      this.storage.saveStageStars(this.battleResult.stageId, this.stars)
    }

    // 触发成就检查：战斗结束
    if (this.game.achievementManager) {
      this.game.achievementManager.checkAchievements('battleEnd', { won: this.isWin })
    }

    // 触发成就检查：关卡通关
    if (this.isWin && this.game.achievementManager) {
      this.game.achievementManager.checkAchievements('stageClear', 1)
    }

    // 触发成就检查：累计伤害
    if (this.battleResult.totalDamageDealt && this.game.achievementManager) {
      const totalDamage = Object.values(this.battleResult.totalDamageDealt).reduce((sum, d) => sum + d, 0)
      if (totalDamage > 0) {
        this.game.achievementManager.checkAchievements('damageDealt', totalDamage)
      }
    }

    // 设置点击回调
    this.game.input.onTap = this._onTap.bind(this)
    this.game.input.onTouchStart = this.touchStartCallback
    this.game.input.onTouchEnd = this.touchEndCallback
  }

  _calcRewards() {
    const result = this.battleResult
    const stars = this.stars

    // 优先使用关卡配置的奖励曲线
    const stageRewards = result.stageRewards
    if (stageRewards && stageRewards.gold !== undefined && stageRewards.exp !== undefined) {
      // 星级系数：1星=0.6x, 2星=0.8x, 3星=1.0x, 4星=1.2x, 5星=1.5x（兼容多星制）
      const starMultipliers = [0, 0.6, 0.8, 1.0, 1.2, 1.5]
      const starMultiplier = starMultipliers[stars] || 1.0

      if (this.isWin) {
        this.rewards.gold = Math.round(stageRewards.gold * starMultiplier)
        this.rewards.exp = Math.round(stageRewards.exp * starMultiplier)
      } else {
        // 失败低保：30% 关卡基础奖励
        this.rewards.gold = Math.round(stageRewards.gold * 0.3)
        this.rewards.exp = Math.round(stageRewards.exp * 0.3)
      }
    } else {
      // 降级：无关卡奖励数据时使用硬编码逻辑（兼容旧流程）
      this.rewards.gold = this.isWin ? 100 + stars * 50 : 30
      this.rewards.exp = this.isWin ? 100 + stars * 20 : 30
    }

    // 随机道具（胜利时30%概率）
    this.rewards.item = null
    this.rewards.itemName = ''
    if (this.isWin && Math.random() < 0.3) {
      const itemId = rollDrop()
      if (itemId && ITEMS_DB[itemId]) {
        this.rewards.item = itemId
        this.rewards.itemName = ITEMS_DB[itemId].name
      }
    }
  }

  _consumeBestCaptureItem() {
    const inventory = this.storage.loadInventory()
    const candidates = [
      { id: 'capture_ball_plus', bonus: 0.30, name: '超级捕获球' },
      { id: 'capture_ball', bonus: 0.15, name: '捕获球' }
    ]
    const item = candidates.find(c => (inventory[c.id] || 0) > 0)
    if (!item) return 0
    if (this.storage.useItem(item.id, 1)) {
      this.captureItemUsed = item
      return item.bonus
    }
    return 0
  }

  _saveRewards() {
    // 增加金币
    if (this.rewards.gold > 0) {
      this.storage.addGold(this.rewards.gold)
    }

    // 保存经验（成长闭环关键）
    if (this.rewards.exp > 0) {
      this.storage.addPlayerExp(this.rewards.exp)
    }

    // === 怪物成长系统：战斗结束后给队伍怪物加经验 ===
    this._addMonsterExpFromBattle()

    // 收服成功：写入玩家收集列表
    if (this.captured && this.captureTarget && this.captureTarget.id) {
      const player = this.storage.loadPlayer()
      const captured = player.captured || []
      if (!captured.includes(this.captureTarget.id)) {
        captured.push(this.captureTarget.id)
        player.captured = captured
        this.storage.savePlayer(player)

        // 收服成功后初始化pokedex记录（宠物成长系统）
        this.storage.initMonsterPokedex(this.captureTarget.id)
      }
    }

    // 增加道具
    if (this.rewards.item) {
      this.storage.addItem(this.rewards.item, 1)
    }

    // 更新奖励统计
    const rewards = this.storage.loadRewards()
    rewards.totalGoldEarned = (rewards.totalGoldEarned || 0) + this.rewards.gold
    rewards.battleCount = (rewards.battleCount || 0) + 1
    if (this.captured) {
      rewards.captureCount = (rewards.captureCount || 0) + 1
    }
    if (this.rewards.item) {
      rewards.totalItemsGained = (rewards.totalItemsGained || 0) + 1
    }
    this.storage.saveRewards(rewards)

    // 触发成就检查：金币获得
    if (this.game.achievementManager && this.rewards.gold > 0) {
      this.game.achievementManager.checkAchievements('goldEarned', this.rewards.gold)
    }

    // 触发成就检查：收服怪物
    if (this.captured && this.game.achievementManager) {
      this.game.achievementManager.checkAchievements('capture', 1)
    }
  }

  // 怪物成长系统：战斗结束后给队伍怪物加经验
  _addMonsterExpFromBattle() {
    if (!this.isWin) return  // 失败不给经验

    const team = this.game.storage.loadTeam()
    const teamMembers = [team.leader, team.member1, team.member2].filter(Boolean)
    if (teamMembers.length === 0) return

    // 计算基础经验（从关卡配置或默认值）
    const stageRewards = this.battleResult.stageRewards || {}
    const baseExp = stageRewards.exp || 100

    // 胜利获得关卡经验值的50%
    const expToAdd = Math.round(baseExp * 0.5)

    // 分配经验给队伍中存活的怪物（hp > 0表示存活）
    const playerTeam = this.battleResult.playerTeam || []

    for (const monsterId of teamMembers) {
      // 检查该怪物是否在战斗中存活
      const battleMonster = playerTeam.find(m => m && m.id === monsterId)
      if (battleMonster && battleMonster.hp > 0) {
        // 确保pokedex记录存在
        this.game.storage.initMonsterPokedex(monsterId)

        const result = this.game.storage.addMonsterExp(monsterId, expToAdd)

        if (result.leveledUp) {
          this.levelUps.push({
            monsterId,
            oldLevel: result.oldLevel,
            newLevel: result.newLevel,
            expGained: result.expGained
          })
          console.log(`[SceneResult] 怪物 ${monsterId} 升级: Lv.${result.oldLevel} → Lv.${result.newLevel}`)
        }
      }
    }
  }

  _findNextStage(currentStageId) {
    // 从 stages.js 获取关卡列表，找下一关
    if (!STAGE_CHAPTERS) return null
    for (const chapter of STAGE_CHAPTERS) {
      const stages = chapter.stages || []
      for (let i = 0; i < stages.length; i++) {
        if (stages[i].id === currentStageId) {
          // 同章节下一关
          if (i < stages.length - 1) return stages[i + 1].id
          // 同章节最后一关 → 找下一章节第一关
          const chIdx = STAGE_CHAPTERS.indexOf(chapter)
          if (chIdx < STAGE_CHAPTERS.length - 1) {
            const nextCh = STAGE_CHAPTERS[chIdx + 1]
            if (nextCh.stages && nextCh.stages.length > 0) return nextCh.stages[0].id
          }
          return null // 已经是最终关
        }
      }
    }
    return null
  }

  _onTouchStart(x, y) {
    this.touchedBtn = null
    if (this.isWin && this.hasNextStage) {
      // 胜利：检查两个按钮
      if (this._hitTest(x, y, this.nextBtn)) {
        this.touchedBtn = 'next'
      } else if (this._hitTest(x, y, this.backBtn)) {
        this.touchedBtn = 'back'
      }
    } else {
      // 失败/无下一关：检查返回按钮
      if (this._hitTest(x, y, this.backBtn)) {
        this.touchedBtn = 'back'
      }
    }
  }

  _onTouchEnd() {
    this.touchedBtn = null
  }

  _hitTest(x, y, btn) {
    return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h
  }

  _onTap(x, y) {
    if (this.isWin && this.hasNextStage) {
      if (this._hitTest(x, y, this.nextBtn)) {
        this._goNextStage()
      } else if (this._hitTest(x, y, this.backBtn)) {
        const chapterIndex = this._inferChapterIndex(this.battleResult.stageId)
        this.game.sceneManager.changeScene('stageSelect', { chapterIndex })
      }
    } else {
      if (this._hitTest(x, y, this.backBtn)) {
        this._onContinue()
      }
    }
  }

  /**
   * 从 stageId 推断章节索引（0-based）
   * 例如 "stage_5_2" → chapterIndex=4（第5章）
   */
  _inferChapterIndex(stageId) {
    if (!stageId) return 0
    const match = stageId.match(/^stage_(\d+)_/)
    if (match) {
      return parseInt(match[1], 10) - 1  // stage_1_1 → 0, stage_5_2 → 4
    }
    return 0
  }

  _goNextStage() {
    if (this.state === 'animating') return
    const nextStageId = this._findNextStage(this.battleResult.stageId)
    if (nextStageId) {
      // 查找下一关的完整数据
      let nextStageData = null
      for (const chapter of STAGE_CHAPTERS) {
        for (const stage of (chapter.stages || [])) {
          if (stage.id === nextStageId) {
            nextStageData = stage
            break
          }
        }
        if (nextStageData) break
      }
      this.game.sceneManager.changeScene('battlePrepare', { stageId: nextStageId, stageData: nextStageData })
    } else {
      const chapterIndex = this._inferChapterIndex(this.battleResult.stageId)
      this.game.sceneManager.changeScene('stageSelect', { chapterIndex })
    }
  }

  _onContinue() {
    if (this.state === 'animating') return
    const chapterIndex = this._inferChapterIndex(this.battleResult.stageId)
    if (this.isWin) {
      this.game.sceneManager.changeScene('stageSelect', { chapterIndex })
    } else {
      // 重试：查找当前关卡的完整数据
      const stageId = this.battleResult.stageId || 'stage_1_1'
      let stageData = null
      for (const chapter of STAGE_CHAPTERS) {
        for (const stage of (chapter.stages || [])) {
          if (stage.id === stageId) {
            stageData = stage
            break
          }
        }
        if (stageData) break
      }
      this.game.sceneManager.changeScene('battlePrepare', { stageId, stageData })
    }
  }

  update(dt) {
    // 更新收服特效
    this.captureEffectManager.update(dt)

    // 动画序列
    if (this.starAnimProgress < 1) {
      this.starAnimProgress = Math.min(1, this.starAnimProgress + dt * 2.5)
    } else if (this.rewardAnimProgress < 1) {
      this.rewardAnimProgress = Math.min(1, this.rewardAnimProgress + dt * 2)
    } else if (this.expAnimProgress < 1) {
      this.expAnimProgress = Math.min(1, this.expAnimProgress + dt * 2)
    } else if (this.buttonAnimProgress < 1) {
      this.buttonAnimProgress = Math.min(1, this.buttonAnimProgress + dt * 3)
    }
  }

  render(r) {
    // 应用屏幕抖动（收服失败时 - 所有内容统一偏移）
    const shakeX = this.captureEffectManager.getShakeOffsetX()
    if (shakeX !== 0) {
      r.save()
      r.translate(shakeX, 0)
    }

    // 背景
    r.fillRect(0, 0, this.designW, this.designH, THEME.colors.bgMedium)

    // 标题
    r.fillText(this.isWin ? '🎉 战斗胜利!' : '💀 战斗失败', this.designW / 2, 40, COLORS.textPrimary, THEME.font.title.size)

    // 星级评价
    const starY = 85
    this._renderStars(r, starY)

    // 战斗信息
    if (this.starAnimProgress >= 1) {
      this._renderBattleInfo(r)
    }

    // 收服结果
    if (this.rewardAnimProgress >= 1 && this.isWin) {
      this._renderCaptureResult(r)
    }

    // 奖励获得（金币+道具）
    if (this.rewardAnimProgress >= 1) {
      this._renderRewards(r)
    }

    // 经验获取
    if (this.expAnimProgress >= 1) {
      this._renderExpGain(r)
    }

    // 怪物升级提示（经验获取之后）
    if (this.expAnimProgress >= 1) {
      this._renderLevelUps(r)
    }

    // 扫荡解锁提示（3星时）
    if (this.buttonAnimProgress >= 1 && this.stars >= 3) {
      this._renderSweepUnlocked(r)
    }

    // 继续按钮
    if (this.buttonAnimProgress >= 1) {
      this._renderContinueButton(r)
    }

    // 收服特效渲染（覆盖在所有内容之上）
    this.captureEffectManager.render(r, this.designW / 2, this.designH / 2)

    // 关闭抖动偏移
    if (shakeX !== 0) {
      r.restore()
    }
  }

  _renderStars(r, y) {
    const progress = this.starAnimProgress
    const displayStars = Math.floor(progress * this.stars)

    const starSize = 32
    const spacing = 48
    const startX = this.designW / 2 - spacing

    for (let i = 0; i < 3; i++) {
      const x = startX + i * spacing
      const isLit = i < displayStars
      const alpha = isLit ? 1 : 0.3
      const scale = isLit ? 1 : 0.6

      // 星星发光效果
      if (isLit) {
        r.fillText('✨', x - 5, y, 'rgba(255, 215, 0, 0.3)', THEME.font.display.size)
      }

      const starEmoji = isLit ? '⭐' : '☆'
      r.fillText(starEmoji, x, y, `rgba(255, 215, 0, ${alpha})`, starSize)
    }
  }

  _renderBattleInfo(r) {
    const y = 135
    const result = this.battleResult

    r.fillRoundRect(20, y, this.designW - 40, 90, THEME.radius.md, COLORS.bgCard)

    r.fillText('战斗信息', this.designW / 2, y + 20, COLORS.textPrimary, THEME.font.body.size)

    r.fillText(`回合: ${result.turnCount}`, 40, y + 45, COLORS.textPrimary, THEME.font.small.size)
    r.fillText(`最大回合: ${result.maxTurns}`, 200, y + 45, COLORS.textMuted, THEME.font.tiny.size)

    // 击败的怪物
    const defeated = result.enemies.filter(e => e && e.hp <= 0)
    if (defeated.length > 0) {
      r.fillText(`击败: ${defeated.map(e => e.emoji).join(' ')}`, 40, y + 70, COLORS.dangerLight, THEME.font.tiny.size)
    }

    // 存活的怪物
    const alive = result.enemies.filter(e => e && e.hp > 0)
    if (alive.length > 0) {
      r.fillText(`存活: ${alive.map(e => e.emoji).join(' ')}`, 200, y + 70, COLORS.primarySoft, THEME.font.tiny.size)
    }
  }

  _renderCaptureResult(r) {
    const y = 240
    const capture = this.captureResult

    if (!capture) return

    r.fillRoundRect(20, y, this.designW - 40, 82, THEME.radius.md, COLORS.bgPanel)

    r.fillText(capture.title, this.designW / 2, y + 25, COLORS.success, THEME.font.number.size)

    const targetLine = this.captureTarget ? `目标: ${this.captureTarget.name}` : ''
    const itemLine = this.captureItemUsed ? `消耗: ${this.captureItemUsed.name}` : ''
    const lines = [targetLine, itemLine, ...capture.desc.split('\n')].filter(Boolean).slice(0, 3)
    lines.forEach((line, i) => {
      r.fillText(line, this.designW / 2, y + 48 + i * 14, COLORS.textSecondary, THEME.font.tiny.size)
    })
  }

  _renderRewards(r) {
    const y = 332
    const progress = this.rewardAnimProgress

    r.fillRoundRect(20, y, this.designW - 40, 100, THEME.radius.md, THEME.colors.bgPanel)

    r.fillText('获得奖励', this.designW / 2, y + 18, COLORS.textPrimary, THEME.font.body.size)

    // 金币动画
    const goldBounce = Math.sin(progress * Math.PI * 2) * 5 * (1 - progress)
    r.fillText('💰', 50, y + 52 + goldBounce, COLORS.gold, THEME.font.bigNum.size)
    r.fillText(`+${this.rewards.gold} 金币`, 75, y + 55, COLORS.gold, THEME.font.body.size)

    // 道具动画（闪光）
    if (this.rewards.item) {
      const itemSparkle = Math.sin(progress * Math.PI * 4) * 0.5 + 0.5
      const itemData = ITEMS_DB[this.rewards.item]
      if (itemData) {
        r.fillText(itemData.emoji, 50, y + 82, `rgba(255, 255, 255, ${0.5 + itemSparkle * 0.5})`, THEME.font.subtitle.size)
        r.fillText(`+1 ${itemData.name}`, 75, y + 85, COLORS.textPrimary, THEME.font.small.size)
      }
    } else {
      r.fillText('(无道具)', 75, y + 85, COLORS.textMuted, THEME.font.small.size)
    }
  }

  _renderExpGain(r) {
    const y = 446
    const result = this.battleResult

    r.fillRoundRect(20, y, this.designW - 40, 80, THEME.radius.md, COLORS.bgCard)

    r.fillText('获得经验', this.designW / 2, y + 20, COLORS.textPrimary, THEME.font.body.size)

    r.fillText(`+${this.rewards.exp} 经验`, this.designW / 2, y + 48, COLORS.thunder, THEME.font.number.size)

    // 显示来源：关卡配置 or 默认
    const stageRewards = result.stageRewards
    if (stageRewards && stageRewards.exp !== undefined) {
      const starMultipliers = [0, 0.6, 0.8, 1.0, 1.2, 1.5]
      const mult = starMultipliers[this.stars] || 1.0
      r.fillText(`(关卡基础 ${stageRewards.exp} × ${mult}x 星级系数)`, this.designW / 2, y + 70, COLORS.textMuted, THEME.font.tiny.size)
    } else {
      const baseExp = this.isWin ? 100 : 30
      const starBonus = this.stars * 20
      r.fillText(`(基础 ${baseExp} + 星级加成 ${starBonus})`, this.designW / 2, y + 70, COLORS.textMuted, THEME.font.tiny.size)
    }
  }

  _renderContinueButton(r) {
    const progress = this.buttonAnimProgress

    if (this.isWin && this.hasNextStage) {
      // 胜利 + 有下一关：两个按钮
      this._drawButton(r, this.nextBtn, '下一关 ▶', THEME.buttons.primary.bgColor, 'next', progress)
      this._drawButton(r, this.backBtn, '返回关卡', THEME.buttons.secondary?.bgColor || COLORS.bgCard, 'back', progress)
    } else if (this.isWin) {
      // 胜利但无下一关（最终关）：一个按钮
      this._drawButton(r, this.backBtn, '返回关卡', THEME.buttons.primary.bgColor, 'back', progress)
    } else {
      // 失败：重试按钮
      this._drawButton(r, this.backBtn, '重试', THEME.buttons.danger.bgColor, 'back', progress)
    }
  }

  _drawButton(r, btn, text, color, btnKey, progress) {
    const baseScale = 0.8 + progress * 0.2
    const pressScale = this.touchedBtn === btnKey ? 0.95 : 1
    const scale = baseScale * pressScale

    const scaledW = btn.w * scale
    const scaledH = btn.h * scale
    const scaledX = btn.x + (btn.w - scaledW) / 2
    const scaledY = btn.y + (btn.h - scaledH) / 2

    r.fillRoundRect(scaledX, scaledY, scaledW, scaledH, THEME.radius.md, color)

    if (this.touchedBtn === btnKey) {
      r.fillRoundRect(scaledX, scaledY, scaledW, scaledH, THEME.radius.md, 'rgba(0, 0, 0, 0.15)')
    }

    const textX = btn.x + btn.w / 2
    const textY = btn.y + btn.h / 2 + 5
    r.fillText(text, textX, textY, COLORS.textPrimary, THEME.font.body.size)
  }

  destroy() {
    this.game.input.onTap = null
    this.game.input.onTouchStart = null
    this.game.input.onTouchEnd = null
  }

  _renderLevelUps(r) {
    if (!this.levelUps || this.levelUps.length === 0) return

    const y = 536
    // 显示最多2个升级提示
    const displayUps = this.levelUps.slice(0, 2)
    const totalH = displayUps.length * 28

    for (let i = 0; i < displayUps.length; i++) {
      const up = displayUps[i]
      const itemY = y + i * 28
      const pulse = Math.sin(Date.now() / 200) * 0.2 + 0.8

      // 升级背景（金色发光）
      r.fillRoundRect(this.designW / 2 - 120, itemY, 240, 24, 8, `rgba(255, 215, 0, ${0.2 * pulse})`)

      // 升级图标
      r.fillText('⬆️', this.designW / 2 - 100, itemY + 17, `rgba(255, 215, 0, ${pulse})`, THEME.font.body.size)

      // 怪物名
      const monsterData = MONSTER_DB[up.monsterId]
      const name = monsterData ? monsterData.name : up.monsterId
      r.fillText(name, this.designW / 2 - 70, itemY + 17, COLORS.gold, THEME.font.small.size, 'bold')

      // 等级变化
      r.fillText(`Lv.${up.oldLevel} → Lv.${up.newLevel}`, this.designW / 2 + 50, itemY + 17, COLORS.success, THEME.font.small.size, 'bold')
    }
  }

  _renderSweepUnlocked(r) {
    // 显示扫荡解锁提示（渐变动画）
    const y = 548
    const pulse = Math.sin(Date.now() / 300) * 0.2 + 0.8
    r.fillText('⚡ 已解锁扫荡功能！', this.designW / 2, y, `rgba(255, 200, 50, ${pulse})`, THEME.font.body.size, 'bold')
  }
}

// Colors via THEME/COLORS constants (P0.1.5)
