// ============================================
// ui/sceneBattle.js - 战斗场景
// ============================================

import { Board, GEM_TYPES, GEM_COLORS, GEM_EMOJI, ENHANCED_GEM, BOMB_GEM } from '../match3/board.js'
import { BattleManager } from '../battle/battleManager.js'
import { getLeaderSkill } from '../../data/leader-skills.js'
import { FloatingTextManager } from '../engine/FloatingTextManager.js'
import { THEME, COLORS } from '../engine/theme.js'
import { chapters as STAGE_CHAPTERS } from '../../data/stages.js'

const BATTLE_ASSETS = {
  bg: 'assets/images/battle/battle_bg_forest_ruins.png',
  gemFire: 'assets/images/battle/gems/gem_fire.png',
  gemWater: 'assets/images/battle/gems/gem_water.png',
  gemGrass: 'assets/images/battle/gems/gem_grass.png',
  gemThunder: 'assets/images/battle/gems/gem_thunder.png',
  gemLight: 'assets/images/battle/gems/gem_light.png',
  gemLocked: 'assets/images/battle/gems/gem_locked_tile.png',
  gemRainbow: 'assets/images/battle/gems/gem_rainbow_special.png',
  obstacleRockFull: 'assets/images/battle/gems/obstacle_rock_full.png',
  obstacleRockCracked: 'assets/images/battle/gems/obstacle_rock_cracked.png',
  monsterFire: 'assets/images/battle/monsters/monster_001_fire_lizard.png',
  monsterWater: 'assets/images/battle/monsters/monster_002_water_cub.png',
  monsterGrass: 'assets/images/battle/monsters/monster_003_grass_leaf.png',
  bossGrass: 'assets/images/battle/monsters/monster_boss_001_grass_flower_512.png',
  panelDark: 'assets/images/battle/ui/ui_panel_dark_large.png',
}

const GEM_ASSET_KEYS = {
  fire: 'gemFire',
  water: 'gemWater',
  grass: 'gemGrass',
  thunder: 'gemThunder',
  light: 'gemLight',
  [ENHANCED_GEM]: 'gemRainbow',
  [BOMB_GEM]: 'gemRainbow',
}

// 关卡数据（用于从 stageId 查找完整关卡信息）
function _getStagesData() {
  return { chapters: STAGE_CHAPTERS || [] }
}

function _lookupStageData(stageId) {
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
          eliteMultiplier: stage.eliteMultiplier || null,
          poisonFog: stage.poisonFog || null
        }
      }
    }
  }
  return null
}

export class SceneBattle {
  constructor(game) {
    this.game = game
    this.board = null
    this.battle = null
    this.selectedGem = null  // { row, col }
    this.state = 'idle'      // idle | swapping | matching | falling | enemyTurn | battleEnd
    this.floatingTexts = new FloatingTextManager(this.game)
    this.comboText = ''     // 连击提示（已废弃，用comboPopup代替）
    this.comboTimer = 0
    this.comboPopup = null  // { combo, timer, phase, scale, opacity } 连锁弹窗动画
    this.messageText = ''
    this.messageTimer = 0
    this.enemyAttackTimer = 0
    this.enemyAttacks = []
    this.waitingForResult = false
    this.resultTransitioning = false
    this.hitFlashes = []    // 受击闪烁 { monsterIndex, isEnemy, timer, maxTimer }
    this.fallMessages = []  // 倒下提示 { text, timer }
    this.idleTime = 0       // idle动画计时器
    this.enemyDisplayHP = [] // 敌方HP显示动画 { displayHP, targetHP, timer, maxTimer }
    this.playerDisplayHP = [] // 我方HP显示动画 { displayHP, targetHP, timer, maxTimer }

    // 消除中宝石特效（外部管理，由animation.js驱动）
    this.eliminatingGems = []  // [{ row, col, type, x, y, scale, opacity, brightness }]

    // 设计尺寸基准
    this.designW = 375
    this.designH = 667

    // Boss技能视觉状态
    this.bossSkillVisuals = {} // { enemyIndex: { chargeText: '⚡蓄力中...', chargeTimer, shieldHP, shieldMaxHP, healFloats: [] } }

    // 锁定宝石解锁动画队列
    this.unlockAnimations = [] // [{ row, col, timer, phase, x, y }]

    // 战斗美术资源
    this.artAssets = {}
    this.artReady = false
    this._artLoadingStarted = false
  }

  init(data = {}) {
    // 如果传入了关卡数据，使用关卡配置
    const stageData = data.stageData || null
    const stageId = data.stageId || 'stage_1_1'

    this.selectedGem = null
    this.waitingForResult = false
    this.resultTransitioning = false
    this.hitFlashes = []
    this.fallMessages = []
    this.enemyDisplayHP = []
    this.playerDisplayHP = []
    this.bossSkillVisuals = {}
    this.unlockAnimations = []
    this.eliminatingGems = []

    // 保存关卡信息供结算使用
    // 如果 stageData 不含 enemies，尝试从 stages.js 查找
    if (stageData && stageData.enemies) {
      this.stageData = stageData
    } else {
      const lookedUp = _lookupStageData(stageId)
      this.stageData = lookedUp || stageData || { id: stageId, name: stageId, enemies: [], enemyLevel: 3 }
    }
    this.stageId = stageId

    // 创建棋盘
    this.board = new Board(8, 8)
    this.board.cellSize = 42
    this.board.offsetX = (this.designW - this.board.cols * this.board.cellSize) / 2
    this.board.offsetY = 235

    // 如果关卡配置有障碍物布局，设置到棋盘
    if (this.stageData && this.stageData.obstacles) {
      this.board.setObstacles(this.stageData.obstacles)
      // 重新初始化棋盘（跳过障碍物格子）
      this.board._init()
    }

    // 如果关卡配置有锁定宝石布局，设置到棋盘
    if (this.stageData && this.stageData.lockedGems) {
      this.board.setLockedGems(this.stageData.lockedGems)
    }

    // 如果关卡配置有毒雾布局，设置到棋盘
    if (this.stageData && this.stageData.poisonFog) {
      this.board.setPoisonFog(this.stageData.poisonFog)
    }

    // 毒雾伤害动画队列
    this.poisonFogClearAnims = [] // [{ row, col, x, y, timer }]
    this.poisonFogSpreadAnims = [] // [{ row, col, x, y, timer }]

    // 准备敌人配置
    // 从存档读取玩家等级，新玩家（level<5）默认5（与balance-design.md对齐）
    const savedPlayer = this.game.storage.loadPlayer()
    const playerLevel = (savedPlayer.level && savedPlayer.level >= 5) ? savedPlayer.level : 5
    let enemies, enemyLevel
    if (this.stageData && this.stageData.enemies && this.stageData.enemies.length > 0) {
      // 使用关卡数据（已通过 _lookupStageData 确保完整）
      enemies = this.stageData.enemies
      enemyLevel = this.stageData.enemyLevel || 3
    } else {
      // 最终降级：默认配置
      enemies = ['enemy_001', 'enemy_002', 'enemy_003']
      enemyLevel = 3
    }

    // 从存档读取玩家队伍
    const teamData = this.game.storage.loadTeam()
    const playerTeamIds = []
    for (const slot of ['leader', 'member1', 'member2']) {
      if (teamData[slot]) playerTeamIds.push(teamData[slot])
    }
    // 如果队伍为空，使用默认初始队伍
    if (playerTeamIds.length === 0) {
      playerTeamIds.push('monster_001', 'monster_002', 'monster_003')
    }

    // 创建战斗管理器
    this.battle = new BattleManager()
    this.battle.init(
      playerTeamIds,                                     // 玩家队伍（从存档加载）
      enemies,                                          // 敌人（来自关卡数据）
      playerLevel,                                      // 玩家等级
      enemyLevel,                                      // 敌人等级
      this.stageData,                                   // 关卡数据（包含phases和rewards）
      stageId                                           // 关卡ID（供结算保存星级）
    )

    // 设置BOSS阶段回调
    this.battle.onPhaseTransition = this._onPhaseTransition.bind(this)

    // 设置Boss技能行动回调
    this.battle.onEnemySkillAction = this._onEnemySkillAction.bind(this)

    // 精英关卡：应用eliteMultiplier加成敌人属性
    if (this.stageData && this.stageData.eliteMultiplier) {
      const mult = this.stageData.eliteMultiplier
      this.battle.enemies.forEach(enemy => {
        if (enemy) {
          enemy.maxHP = Math.floor(enemy.maxHP * mult)
          enemy.hp = enemy.maxHP
          enemy.atk = Math.floor(enemy.atk * mult)
          enemy.def = Math.floor(enemy.def * mult)
        }
      })
      this.isEliteStage = true
    } else {
      this.isEliteStage = false
    }

    // 设置输入回调
    this.game.input.onSwipe = this._onSwipe.bind(this)
    this.game.input.onTap = this._onTap.bind(this)
    this._loadBattleArtAssets()

    // 阶段切换相关
    this.phaseTransitionState = null  // { phase, enemies, timer }
    this.screenFlashTimer = 0
    this.shakeTimer = 0

    // 攻击命中震动相关
    this.attackShakeTimer = 0      // 攻击震动持续时间
    this.attackFlashTimer = 0      // 攻击白闪持续时间
    this.attackShakeOffsetX = 0    // 当前震动X偏移量

    this.state = 'idle'
    this._showMessage(this.stageData ? `${this.stageData.name} 开始！` : '战斗开始！')
  }

  _loadBattleArtAssets() {
    if (this._artLoadingStarted) return
    this._artLoadingStarted = true

    const entries = Object.entries(BATTLE_ASSETS)
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
        console.warn(`[SceneBattle] 美术资源加载失败: ${src}`)
        loadedCount++
        this.artReady = loadedCount >= entries.length
      }
      img.src = src
    })
  }

  _onPhaseTransition(newPhase, newEnemies) {
    // 显示阶段切换效果
    const bossName = newEnemies[0] ? newEnemies[0].name : 'BOSS'
    this._showMessage(`⚡ ${bossName} 进入激战状态！`)
    this.phaseTransitionState = {
      phase: newPhase,
      enemies: newEnemies,
      timer: 1.5,
      bossName: bossName
    }
    this.screenFlashTimer = 0.3
    this.shakeTimer = 0.3

    // 更新敌方怪物
    this.battle.enemies = newEnemies
    this.enemyDisplayHP = []
    this.bossSkillVisuals = {}

    // 延迟后清空棋盘显示提示
    this.game.animation.setTimeout(() => {
      // 清空棋盘格子显示
      for (let r = 0; r < this.board.rows; r++) {
        for (let c = 0; c < this.board.cols; c++) {
          this.board.grid[r][c] = null
        }
      }
    }, 100)
  }

  // Boss技能行动视觉回调
  _onEnemySkillAction(event) {
    const i = event.enemyIndex

    // 确保visuals对象存在
    if (!this.bossSkillVisuals[i]) {
      this.bossSkillVisuals[i] = { chargeTimer: 0, shieldHP: 0, shieldMaxHP: 0, healFloats: [] }
    }
    const vis = this.bossSkillVisuals[i]

    switch (event.type) {
      case 'charge_start':
        // 蓄力开始：显示闪烁文字
        vis.chargeTimer = 999 // 持续显示直到释放
        this._showMessage(`⚡ ${event.enemy.name} 正在蓄力...`)
        break

      case 'charge_release':
        // 蓄力释放：清除蓄力显示
        vis.chargeTimer = 0
        this._showMessage(`💥 ${event.enemy.name} 蓄力攻击！×${event.damageMultiplier}`)
        this._triggerAttackShake()
        this.screenFlashTimer = 0.3
        break

      case 'shield_appear':
        // 护盾生成
        vis.shieldHP = event.shieldHP
        vis.shieldMaxHP = event.shieldMaxHP
        this._showMessage(`🛡️ ${event.enemy.name} 生成了护盾！`)
        break

      case 'heal':
        // 回血：显示绿色飘字
        const ex = 15 + i * 120 + 55
        const ey = 80
        this.floatingTexts.add(`+${event.healAmount}`, ex, ey, {
          color: COLORS.healGreen,
          size: 22,
          critical: true
        })
        this._showMessage(`💚 ${event.enemy.name} 回复了 ${event.healAmount} HP！`)
        break
    }
  }

  _onSwipe(x, y, direction) {
    if (this.state !== 'idle') return

    const pos = this.board.screenToGrid(x, y)
    if (!pos) return

    // 计算目标格子
    let tr = pos.row, tc = pos.col
    switch (direction) {
      case 'up':    tr--; break
      case 'down':  tr++; break
      case 'left':  tc--; break
      case 'right': tc++; break
    }

    // 边界检查
    if (tr < 0 || tr >= this.board.rows || tc < 0 || tc >= this.board.cols) return

    // 执行交换
    this._doSwap(pos.row, pos.col, tr, tc)
  }

  _onTap(x, y) {
    if (this.state === 'battleEnd') {
      this._goToResult()
      return
    }

    if (this.state !== 'idle') return

    const pos = this.board.screenToGrid(x, y)
    if (!pos) return

    // 不能选中障碍物格子
    if (this.board.isObstacle(pos.row, pos.col)) return

    // 不能选中锁定宝石
    if (this.board.isLocked(pos.row, pos.col)) {
      this._showMessage('🔒 锁住！消除旁边同色宝石解锁')
      return
    }

    if (!this.selectedGem) {
      this.selectedGem = pos
    } else {
      // 如果点击的是相邻格子，交换
      const dr = Math.abs(this.selectedGem.row - pos.row)
      const dc = Math.abs(this.selectedGem.col - pos.col)
      if (dr + dc === 1) {
        this._doSwap(this.selectedGem.row, this.selectedGem.col, pos.row, pos.col)
      }
      this.selectedGem = null
    }
  }

  _doSwap(r1, c1, r2, c2) {
    this.state = 'swapping'
    this.game.input.lock()

    // 检查锁定宝石（提前检查，给出提示）
    if (this.board.isLocked(r1, c1) || this.board.isLocked(r2, c2)) {
      this.state = 'idle'
      this.game.input.unlock()
      this._showMessage('🔒 锁住！消除旁边同色宝石解锁')
      return
    }

    // 交换
    this.board.swap(r1, c1, r2, c2)

    // 检查匹配
    const matchResult = this.board.findMatches()
    if (matchResult.gems.length === 0) {
      // 无匹配，换回来
      this.board.swap(r1, c1, r2, c2)
      this.state = 'idle'
      this.game.input.unlock()
      this._showMessage('无效交换')
      return
    }

    // 有效匹配，开始处理
    this.battle.turnCount++
    this._processMatches()
  }

  _processMatches() {
    const matchResult = this.board.findMatches()
    const matches = matchResult.gems
    const enhancedMatches = matchResult.enhanced

    if (matches.length === 0) {
      // 无更多匹配，显示连击结果（连锁数>=2才触发）
      if (this.board.cascadeCount >= 2) {
        this._showComboPopup(this.board.cascadeCount)
      }
      this._startEnemyTurn()
      return
    }

    this.state = 'matching'
    this.board.cascadeCount++

    // 收集消除宝石的屏幕坐标（用于动画）
    const eliminateGems = matches.map(m => ({
      row: m.row,
      col: m.col,
      type: m.type,
      x: this.board.offsetX + m.col * this.board.cellSize + this.board.cellSize / 2,
      y: this.board.offsetY + m.row * this.board.cellSize + this.board.cellSize / 2
    }))

    // 消除普通匹配
    const gemCounts = this.board.removeMatches(matches)

    // ===== 毒雾清除检查 =====
    // 消除经过毒雾格子的宝石 → 清除该格子毒雾
    const poisonFogClears = []
    matches.forEach(m => {
      if (this.board.isPoisonFog(m.row, m.col)) {
        this.board.clearPoisonFog(m.row, m.col)
        const cx = this.board.offsetX + m.col * this.board.cellSize + this.board.cellSize / 2
        const cy = this.board.offsetY + m.row * this.board.cellSize + this.board.cellSize / 2
        poisonFogClears.push({ row: m.row, col: m.col, x: cx, y: cy, timer: 0 })
        this.floatingTexts.add('🧹清除!', cx, cy - 15, {
          color: COLORS.poisonFogClear,
          size: 14,
          critical: true
        })
      }
    })
    if (poisonFogClears.length > 0) {
      this.poisonFogClearAnims.push(...poisonFogClears)
      this._showMessage('🧹 毒雾被清除了！')
    }

    // 爆炸/炸弹/彩虹消除也检查毒雾清除
    const checkExtraPoisonFog = (gems) => {
      gems.forEach(g => {
        if (this.board.isPoisonFog(g.row, g.col)) {
          this.board.clearPoisonFog(g.row, g.col)
          const cx = this.board.offsetX + g.col * this.board.cellSize + this.board.cellSize / 2
          const cy = this.board.offsetY + g.row * this.board.cellSize + this.board.cellSize / 2
          this.floatingTexts.add('🧹', cx, cy - 10, { color: COLORS.poisonFogClear, size: 12 })
        }
      })
    }

    // ===== 锁定宝石解锁检查 =====
    // 普通消除后检查相邻锁定宝石
    const unlockResults = []
    const checkedUnlocks = new Set() // 避免重复检查同一锁定宝石
    matches.forEach(m => {
      const results = this.board.checkAdjacentUnlocks(m.row, m.col, m.type)
      results.forEach(r => {
        const key = `${r.row},${r.col}`
        if (!checkedUnlocks.has(key)) {
          checkedUnlocks.add(key)
          unlockResults.push(r)
        }
      })
    })

    // 处理4连强化宝石：十字爆炸
    let explosionCounts = {}
    let explosionGems = [] // 爆炸动画用的宝石
    if (enhancedMatches.length > 0) {
      enhancedMatches.forEach(enh => {
        // 计算十字爆炸范围
        const explosionPositions = this.board.getCrossExplosionPositions(enh.row, enh.col)

        // 收集爆炸宝石用于动画
        explosionPositions.forEach(p => {
          // 避免重复（如果已在普通消除中）
          if (!matches.some(m => m.row === p.row && m.col === p.col)) {
            explosionGems.push({
              row: p.row,
              col: p.col,
              type: p.type,
              x: this.board.offsetX + p.col * this.board.cellSize + this.board.cellSize / 2,
              y: this.board.offsetY + p.row * this.board.cellSize + this.board.cellSize / 2,
              isExplosion: true
            })
          }
        })

        // 消除爆炸波及的格子
        const explCounts = this.board.removeExplosionGems(explosionPositions)
        // 合并爆炸计数到总计数
        for (const type in explCounts) {
          explosionCounts[type] = (explosionCounts[type] || 0) + explCounts[type]
        }

        // 强化宝石中心点显示十字爆炸特效
        const centerX = this.board.offsetX + enh.col * this.board.cellSize + this.board.cellSize / 2
        const centerY = this.board.offsetY + enh.row * this.board.cellSize + this.board.cellSize / 2
        this.floatingTexts.add('💥', centerX, centerY - 10, {
          color: COLORS.white,
          size: 22
        })
        this._showMessage('💥 十字爆炸！')
      })

      // 合并爆炸计数到gemCounts
      for (const type in explosionCounts) {
        gemCounts[type] = (gemCounts[type] || 0) + explosionCounts[type]
      }

      // 检查爆炸范围内的毒雾清除
      checkExtraPoisonFog(explosionGems)
    }

    // 处理L/T形炸弹宝石：3×3范围爆炸
    let bombCounts = {}
    let bombGems = [] // 炸弹消除动画用的宝石
    const bombMatches = matchResult.bomb || []
    if (bombMatches.length > 0) {
      // 构建已消除位置的Set（普通消除+爆炸消除的位置）
      const bombRemovedSet = new Set()
      matches.forEach(m => bombRemovedSet.add(`${m.row},${m.col}`))
      explosionGems.forEach(g => bombRemovedSet.add(`${g.row},${g.col}`))

      bombMatches.forEach(bomb => {
        // 计算炸弹3×3爆炸范围
        const bombPositions = this.board.getBombExplosionPositions(bomb.row, bomb.col)

        // 收集炸弹爆炸宝石用于动画（避免重复）
        bombPositions.forEach(p => {
          if (!bombRemovedSet.has(`${p.row},${p.col}`)) {
            bombRemovedSet.add(`${p.row},${p.col}`)
            bombGems.push({
              row: p.row,
              col: p.col,
              type: p.type,
              x: this.board.offsetX + p.col * this.board.cellSize + this.board.cellSize / 2,
              y: this.board.offsetY + p.row * this.board.cellSize + this.board.cellSize / 2,
              isBomb: true
            })
          }
        })

        // 消除炸弹波及的格子
        const bCounts = this.board.removeExplosionGems(bombPositions)
        for (const type in bCounts) {
          bombCounts[type] = (bombCounts[type] || 0) + bCounts[type]
        }

        // 炸弹爆炸视觉效果
        const cx = this.board.offsetX + bomb.col * this.board.cellSize + this.board.cellSize / 2
        const cy = this.board.offsetY + bomb.row * this.board.cellSize + this.board.cellSize / 2
        this.floatingTexts.add('💣', cx, cy - 10, {
          color: COLORS.white,
          size: 24
        })
        this._showMessage(`💣 ${bomb.shape}形炸弹爆炸！`)
        this._triggerAttackShake()
      })

      // 合并炸弹计数到gemCounts
      for (const type in bombCounts) {
        gemCounts[type] = (gemCounts[type] || 0) + bombCounts[type]
      }

      // 检查炸弹范围内的毒雾清除
      checkExtraPoisonFog(bombGems)
    }

    // 处理5连彩虹宝石：全屏同色消除
    let rainbowCounts = {}
    let rainbowGems = [] // 彩虹消除动画用的宝石
    const rainbowMatches = matchResult.rainbow || []
    if (rainbowMatches.length > 0) {
      // 构建已消除位置的Set（普通消除+爆炸消除的位置）
      const removedSet = new Set()
      matches.forEach(m => removedSet.add(`${m.row},${m.col}`))
      explosionGems.forEach(g => removedSet.add(`${g.row},${g.col}`))

      rainbowMatches.forEach(rainbow => {
        // 获取棋盘上所有同色宝石位置（排除已消除的）
        const rainbowPositions = this.board.getRainbowPositions(rainbow.type, removedSet)

        // 收集彩虹消除宝石用于动画
        rainbowPositions.forEach(p => {
          removedSet.add(`${p.row},${p.col}`)
          rainbowGems.push({
            row: p.row,
            col: p.col,
            type: p.type,
            x: this.board.offsetX + p.col * this.board.cellSize + this.board.cellSize / 2,
            y: this.board.offsetY + p.row * this.board.cellSize + this.board.cellSize / 2,
            isRainbow: true
          })
        })

        // 消除彩虹宝石
        const rCounts = this.board.removeExplosionGems(rainbowPositions)
        for (const type in rCounts) {
          rainbowCounts[type] = (rainbowCounts[type] || 0) + rCounts[type]
        }

        // 彩虹消除视觉效果
        this._showMessage(`🌈 彩虹消除！清除全部${GEM_EMOJI[rainbow.type]}！`)
        this.screenFlashTimer = 0.4  // 全屏闪光
        this._triggerAttackShake()    // 震动效果

        // 彩虹特效中心点
        const cx = this.board.offsetX + rainbow.matchCells[0].col * this.board.cellSize + this.board.cellSize / 2
        const cy = this.board.offsetY + rainbow.matchCells[0].row * this.board.cellSize + this.board.cellSize / 2
        this.floatingTexts.add('🌈', cx, cy - 15, {
          color: COLORS.white,
          size: 28
        })
      })

      // 合并彩虹消除计数到gemCounts
      for (const type in rainbowCounts) {
        gemCounts[type] = (gemCounts[type] || 0) + rainbowCounts[type]
      }

      // 检查彩虹消除范围内的毒雾清除
      checkExtraPoisonFog(rainbowGems)
    }

    // ===== 爆炸/炸弹/彩虹消除后的锁定宝石解锁检查 =====
    if (explosionGems.length > 0) {
      explosionGems.forEach(g => {
        if (g.type) {
          const results = this.board.checkAdjacentUnlocks(g.row, g.col, g.type)
          results.forEach(r => {
            const key = `${r.row},${r.col}`
            if (!checkedUnlocks.has(key)) {
              checkedUnlocks.add(key)
              unlockResults.push(r)
            }
          })
        }
      })
    }
    if (bombGems.length > 0) {
      bombGems.forEach(g => {
        if (g.type) {
          const results = this.board.checkAdjacentUnlocks(g.row, g.col, g.type)
          results.forEach(r => {
            const key = `${r.row},${r.col}`
            if (!checkedUnlocks.has(key)) {
              checkedUnlocks.add(key)
              unlockResults.push(r)
            }
          })
        }
      })
    }
    if (rainbowGems.length > 0) {
      rainbowGems.forEach(g => {
        if (g.type) {
          const results = this.board.checkAdjacentUnlocks(g.row, g.col, g.type)
          results.forEach(r => {
            const key = `${r.row},${r.col}`
            if (!checkedUnlocks.has(key)) {
              checkedUnlocks.add(key)
              unlockResults.push(r)
            }
          })
        }
      })
    }

    // ===== 解锁视觉反馈 =====
    if (unlockResults.length > 0) {
      unlockResults.forEach(ur => {
        const ux = this.board.offsetX + ur.col * this.board.cellSize + this.board.cellSize / 2
        const uy = this.board.offsetY + ur.row * this.board.cellSize + this.board.cellSize / 2
        if (ur.fullyUnlocked) {
          // 完全解锁：锁链碎裂 + "🔓解锁!" 浮动文字
          this.unlockAnimations.push({
            row: ur.row, col: ur.col, x: ux, y: uy,
            timer: 0, phase: 'shatter', maxTimer: 0.6
          })
          this.floatingTexts.add('🔓解锁!', ux, uy - 15, {
            color: COLORS.gold,
            size: 16,
            critical: true
          })
        } else {
          // HP>0 还没完全解锁：显示 "⛓️×剩余HP"
          this.floatingTexts.add(`⛓️×${ur.remainingHP}`, ux, uy - 10, {
            color: COLORS.textMuted,
            size: 12
          })
        }
      })
      if (unlockResults.some(ur => ur.fullyUnlocked)) {
        this._showMessage('🔓 宝石解锁！')
      }
    }

    // 处理战斗伤害（普通消除 + 爆炸消除的全部宝石）
    const result = this.battle.processMatchResult(gemCounts, this.board.cascadeCount)
    const damageLog = result.damageLog
    const phaseTransition = result.phaseTransition
    const statusEffectLog = result.statusEffectLog || []

    // ===== C4: 状态效果附加视觉反馈 =====
    if (statusEffectLog.length > 0) {
      statusEffectLog.forEach(log => {
        const targetIdx = log.enemyIndex
        if (targetIdx >= 0) {
          const ex = 15 + targetIdx * 120 + 55
          const ey = 65

          // 状态附加的emoji和文字
          const statusEmoji = { burn: '🔥', freeze: '❄️', poison: '☠️', stun: '⚡' }
          const statusName = { burn: '灼烧!', freeze: '冰冻!', poison: '中毒!', stun: '眩晕!' }
          const statusColor = { burn: COLORS.statusEffect.burn, freeze: COLORS.statusEffect.freeze, poison: COLORS.statusEffect.poison, stun: COLORS.statusEffect.stun }

          this.floatingTexts.add(`${statusEmoji[log.type] || ''}${statusName[log.type] || ''}`, ex, ey, {
            color: statusColor[log.type] || COLORS.white,
            size: 18,
            critical: true
          })
        }
      })
    }

    // 生成伤害弹出（根据属性克制调整颜色和大小）
    matches.forEach(m => {
      const x = this.board.offsetX + m.col * this.board.cellSize + this.board.cellSize / 2
      const y = this.board.offsetY + m.row * this.board.cellSize
      this.floatingTexts.add(GEM_EMOJI[m.type], x, y, {
        color: GEM_COLORS[m.type],
        size: 16
      })
    })

    // 爆炸宝石的emoji弹出
    explosionGems.forEach(g => {
      this.floatingTexts.add(GEM_EMOJI[g.type], g.x, g.y - this.board.cellSize / 2, {
        color: GEM_COLORS[g.type],
        size: 14
      })
    })

    // 炸弹宝石的emoji弹出
    bombGems.forEach(g => {
      this.floatingTexts.add(GEM_EMOJI[g.type], g.x, g.y - this.board.cellSize / 2, {
        color: GEM_COLORS[g.type],
        size: 13
      })
    })

    // 彩虹消除宝石的emoji弹出
    rainbowGems.forEach(g => {
      this.floatingTexts.add(GEM_EMOJI[g.type], g.x, g.y - this.board.cellSize / 2, {
        color: GEM_COLORS[g.type],
        size: 12
      })
    })

    // 播放宝石消除特效（普通消除）
    this.eliminatingGems = eliminateGems
    this.game.animation.playEliminateEffect(eliminateGems, () => {
      // 普通消除动画完成后
      this.eliminatingGems = []
    })

    // 播放爆炸宝石消除特效（延迟100ms，区分视觉效果）
    if (explosionGems.length > 0) {
      this.game.animation.setTimeout(() => {
        this.game.animation.playEliminateEffect(explosionGems, () => {
          // 爆炸动画完成
        })
      }, 100)
    }

    // 播放炸弹消除特效（延迟150ms，在爆炸和彩虹之间）
    if (bombGems.length > 0) {
      this.game.animation.setTimeout(() => {
        this.game.animation.playEliminateEffect(bombGems, () => {
          // 炸弹动画完成
        })
      }, 150)
    }

    // 播放彩虹消除特效（延迟200ms，最后播放，最震撼）
    if (rainbowGems.length > 0) {
      this.game.animation.setTimeout(() => {
        this.game.animation.playEliminateEffect(rainbowGems, () => {
          // 彩虹动画完成
        })
      }, 200)
    }

    // 处理阶段转换
    if (phaseTransition) {
      this.battle._executePhaseTransition(phaseTransition)
    }

    // 显示伤害信息
    damageLog.forEach(log => {
      const msg = log.isEffective ? '效果拔群！' : (log.isWeak ? '效果不佳...' : '')
      if (msg) this._showMessage(msg)

      // 根据克制关系设置伤害数字样式
      let popupColor, popupSize
      if (log.isEffective) {
        popupColor = THEME.colors.fire        // 橙色-克制
        popupSize = 24
      } else if (log.isWeak) {
        popupColor = COLORS.textMuted         // 灰色-弱化
        popupSize = 12
      } else {
        popupColor = COLORS.white             // 白色-普通
        popupSize = 18
      }

      // 找到受击怪物位置并显示伤害
      const targetIdx = this.battle.enemies.findIndex(e => e && e.name === log.target)
      if (targetIdx >= 0) {
        const ex = 25 + targetIdx * 120 + 55
        const ey = 80
        const isCrit = log.isEffective  // 克制 = 暴击样式
        this.floatingTexts.add(`-${log.damage}`, ex, ey, {
          color: popupColor,
          size: popupSize,
          critical: isCrit
        })

        // 触发敌方受击红闪
        if (!log.targetDied) {
          this.hitFlashes.push({ monsterIndex: targetIdx, isEnemy: true, timer: 0.2, maxTimer: 0.2 })
        }

        // 触发HP渐变动画（敌方血条从满→当前）
        const enemy = this.battle.enemies[targetIdx]
        if (enemy) {
          const existing = this.enemyDisplayHP.find(h => h.monsterIndex === targetIdx)
          if (existing) {
            existing.targetHP = enemy.hp
            existing.timer = 0
          } else {
            this.enemyDisplayHP.push({
              monsterIndex: targetIdx,
              displayHP: enemy.maxHP,
              targetHP: enemy.hp,
              timer: 0,
              maxTimer: 0.3
            })
          }
        }
      }

      // 触发攻击震动效果（我方攻击命中敌方）
      if (!log.targetDied) {
        this._triggerAttackShake()
      }

      if (log.targetDied) {
        const eliteMsg = this.isEliteStage ? '👑 精英击破！' : ''
        this.fallMessages.push({ text: `${eliteMsg ? eliteMsg + ' ' : ''}💢 ${log.target} 倒下了！`, timer: 1.5 })
      }
    })

    // 检查战斗结束
    if (this.battle.checkBattleEnd()) {
      this.state = 'battleEnd'
      this.game.input.unlock()
      this._showMessage(this.battle.battleResult === 'win' ? '🎉 胜利！' : '💀 失败...')
      return
    }

    // 延迟后执行重力下落
    this.game.animation.setTimeout(() => {
      this.board.applyGravity()
      this.state = 'falling'

      // 延迟后继续检查连锁
      this.game.animation.setTimeout(() => {
        this._processMatches() // 递归检查新匹配
      }, 250)
    }, 200)
  }

  _startEnemyTurn() {
    this.board.cascadeCount = 0
    this.state = 'enemyTurn'

    // ===== 毒雾回合逻辑 =====
    this._processPoisonFogTurn()

    // ===== C4: 处理状态效果视觉 =====
    this._processStatusEffectVisuals()

    this._showMessage('敌方回合')

    this.game.animation.setTimeout(() => {
      const enemyResult = this.battle.enemyAction()
      const attacks = enemyResult.actions || (Array.isArray(enemyResult) ? enemyResult : [])
      const statusLogs = enemyResult.statusLogs || []
      const dotKills = enemyResult.dotKills || []

      // ===== C4: 状态效果DoT视觉反馈 =====
      statusLogs.forEach(log => {
        if (log.damage) {
          const idx = log.enemyIndex
          if (idx >= 0) {
            const ex = 15 + idx * 120 + 55
            const ey = 80
            const dotColor = log.type === 'burn' ? COLORS.statusEffect.burn : COLORS.statusEffect.poison
            const dotEmoji = log.type === 'burn' ? '🔥' : '☠️'
            this.floatingTexts.add(`-${log.damage}${dotEmoji}`, ex, ey, {
              color: dotColor,
              size: 16,
              critical: true
            })
            this.hitFlashes.push({ monsterIndex: idx, isEnemy: true, timer: 0.15, maxTimer: 0.15 })
          }
        }
        if (log.message) {
          this._showMessage(log.message)
        }
      })

      // C4: DoT击杀提示
      dotKills.forEach(dk => {
        this.fallMessages.push({ text: `☠️ ${dk.enemyName} 被状态效果击杀！`, timer: 1.5 })
      })

      this.enemyAttacks = attacks

      attacks.forEach(a => {
        // C4: 眩晕跳过
        if (a.isStunned) {
          this._showMessage(`⚡ ${a.attacker} 眩晕了，无法行动！`)
          return
        }

        // 蓄力回合：只显示蓄力提示，不显示伤害
        if (a.isCharging) {
          this._showMessage(`⚡ ${a.attacker} 正在蓄力...`)
          // 更新visuals状态
          const attackerIdx = this.battle.enemies.findIndex(e => e && e.name === a.attacker)
          if (attackerIdx >= 0) {
            if (!this.bossSkillVisuals[attackerIdx]) {
              this.bossSkillVisuals[attackerIdx] = { chargeTimer: 999, shieldHP: 0, shieldMaxHP: 0, healFloats: [] }
            }
            this.bossSkillVisuals[attackerIdx].chargeTimer = 999
          }
          return
        }

        // 敌方伤害弹出
        const dmgSize = a.isCharged ? 28 : 20
        const dmgColor = a.isCharged ? COLORS.battle.chargedAttack : THEME.colors.danger
        this.floatingTexts.add(`-${a.damage}`, 100 + Math.random() * 100, 100, {
          color: dmgColor,
          size: dmgSize,
          critical: a.isCharged || false
        })

        // 找到受击的我方怪物并触发闪烁效果
        const targetIdx = this.battle.playerTeam.findIndex(m => m && m.name === a.target)
        if (targetIdx >= 0) {
          this.hitFlashes.push({ monsterIndex: targetIdx, isEnemy: false, timer: 0.3, maxTimer: 0.3 })

          // 触发HP渐变动画（我方血条从满→当前）
          const member = this.battle.playerTeam[targetIdx]
          if (member) {
            const existing = this.playerDisplayHP.find(h => h.monsterIndex === targetIdx)
            if (existing) {
              existing.targetHP = member.hp
              existing.timer = 0
            } else {
              this.playerDisplayHP.push({
                monsterIndex: targetIdx,
                displayHP: member.maxHP,
                targetHP: member.hp,
                timer: 0,
                maxTimer: 0.3
              })
            }
          }
        }

        if (a.targetDied) {
          this.fallMessages.push({ text: `💢 ${a.target} 倒下了！`, timer: 1.5 })
        }
      })

      // 检查战斗结束
      if (this.battle.battleOver) {
        this.state = 'battleEnd'
        this.game.input.unlock()
        this._showMessage(this.battle.battleResult === 'win' ? '🎉 胜利！' : '💀 失败...')
        return
      }

      this.game.animation.setTimeout(() => {
        this.enemyAttacks = []
        this.state = 'idle'
        this.game.input.unlock()
        this._showMessage('你的回合')
      }, 800)
    }, 500)
  }

  // C4: 处理状态效果的视觉反馈（从 enemyAction 结果中获取）
  // 注意：实际处理在 battleManager.enemyAction() 中完成
  // 这里只负责从 battle.statusEffects 读取当前状态用于渲染
  _processStatusEffectVisuals() {
    if (!this.battle || !this.battle.statusEffects) return

    const statusMeta = {
      burn: { emoji: '🔥', label: '灼烧', color: COLORS.statusEffect.burn },
      freeze: { emoji: '❄️', label: '冰冻', color: COLORS.statusEffect.freeze },
      poison: { emoji: '☠️', label: '中毒', color: COLORS.statusEffect.poison },
      stun: { emoji: '⚡', label: '眩晕', color: COLORS.statusEffect.stun }
    }

    this.battle.statusEffects.forEach((effect, enemyIndex) => {
      if (!effect) return
      const enemy = this.battle.enemies[enemyIndex]
      if (!enemy || enemy.hp <= 0) return

      const meta = statusMeta[effect.type]
      if (!meta) return

      const x = 15 + enemyIndex * 120 + 55
      const y = 58
      const turns = effect.turnsLeft ? ` ${effect.turnsLeft}` : ''
      this.floatingTexts.add(`${meta.emoji}${meta.label}${turns}`, x, y, {
        color: meta.color,
        size: 14,
        critical: effect.type === 'stun'
      })
    })
  }

  // 处理毒雾回合逻辑：扩散 + 伤害
  _processPoisonFogTurn() {
    if (!this.board) return

    // 检查棋盘是否有毒雾
    let hasAnyFog = false
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        if (this.board.isPoisonFog(r, c)) { hasAnyFog = true; break }
      }
      if (hasAnyFog) break
    }
    if (!hasAnyFog) return

    // 1. 扩散毒雾
    const newTiles = this.board.spreadPoisonFog()
    if (newTiles.length > 0) {
      newTiles.forEach(t => {
        const cx = this.board.offsetX + t.col * this.board.cellSize + this.board.cellSize / 2
        const cy = this.board.offsetY + t.row * this.board.cellSize + this.board.cellSize / 2
        this.poisonFogSpreadAnims.push({ row: t.row, col: t.col, x: cx, y: cy, timer: 0 })
      })
      this._showMessage(`☠️ 毒雾扩散了！+${newTiles.length}格`)
    }

    // 2. 计算毒雾伤害（每格 × 3% 队伍最大HP）
    const fogCount = this.board.getPoisonFogDamageCount()
    if (fogCount <= 0) return

    const damagePerTile = 0.03 // 3% 最大HP
    const aliveTeam = this.battle.playerTeam.filter(m => m && m.hp > 0)
    if (aliveTeam.length === 0) return

    // 计算队伍平均最大HP
    const avgMaxHP = aliveTeam.reduce((sum, m) => sum + m.maxHP, 0) / aliveTeam.length
    const totalFogDamage = Math.floor(avgMaxHP * damagePerTile * fogCount)

    if (totalFogDamage <= 0) return

    // 对所有存活队员平分伤害
    const damagePerMember = Math.floor(totalFogDamage / aliveTeam.length)
    aliveTeam.forEach(member => {
      member.hp = Math.max(0, member.hp - damagePerMember)
    })

    // 显示毒雾伤害浮动文字
    const teamStartX = 15
    const teamStartY = 170 + 25
    aliveTeam.forEach((member, i) => {
      const mx = teamStartX + i * 120 + 55
      const my = teamStartY
      this.floatingTexts.add(`-${damagePerMember}☠️`, mx, my, {
        color: COLORS.statusEffect.poison,
        size: 16,
        critical: false
      })

      // 触发HP渐变动画
      const targetIdx = this.battle.playerTeam.indexOf(member)
      if (targetIdx >= 0) {
        const existing = this.playerDisplayHP.find(h => h.monsterIndex === targetIdx)
        if (existing) {
          existing.targetHP = member.hp
          existing.timer = 0
        } else {
          this.playerDisplayHP.push({
            monsterIndex: targetIdx,
            displayHP: member.maxHP,
            targetHP: member.hp,
            timer: 0,
            maxTimer: 0.3
          })
        }
      }
    })

    this._showMessage(`☠️ 毒雾伤害！${fogCount}格 × 3% = ${totalFogDamage}`)

    // 检查玩家是否因毒雾全灭
    if (this.battle.playerTeam.every(m => !m || m.hp <= 0)) {
      this.battle.battleOver = true
      this.battle.battleResult = 'lose'
    }
  }

  _showMessage(text) {
    this.messageText = text
    this.messageTimer = 1.5
  }

  _showComboPopup(combo) {
    // combo弹出动画：scale 0.5→1.2(150ms)→1.0(300ms)，opacity 0→1→hold→0(800ms)
    this.comboPopup = {
      combo: combo,
      timer: 0,
      phase: 'in', // 'in' | 'hold' | 'out'
      scale: 0.5,
      opacity: 0
    }
  }

  _triggerAttackShake() {
    // 画布震动效果：200ms，offsetX ±4px 快速往复
    // 叠加 0.1s 白色闪烁叠加层
    this.attackShakeTimer = 0.2
    this.attackFlashTimer = 0.1
    this.attackShakeOffsetX = 0
  }

  _updateAttackShake(dt) {
    if (this.attackShakeTimer <= 0) {
      this.attackShakeOffsetX = 0
      return
    }
    this.attackShakeTimer -= dt

    // 快速往复震动：周期约50ms
    const shakeSpeed = 2 * Math.PI / 0.05  // 50ms周期
    const maxOffset = 4
    this.attackShakeOffsetX = Math.sin(this.attackShakeTimer * shakeSpeed) * maxOffset

    // 更新白闪
    if (this.attackFlashTimer > 0) {
      this.attackFlashTimer -= dt
    }
  }

  update(dt) {
    // 更新阶段切换效果
    if (this.phaseTransitionState) {
      this.phaseTransitionState.timer -= dt
      if (this.phaseTransitionState.timer <= 0) {
        this.phaseTransitionState = null
        // 重新生成棋盘
        this.board.initBoard()
      }
    }

    // 更新屏幕闪烁
    if (this.screenFlashTimer > 0) {
      this.screenFlashTimer -= dt
    }

    // 更新屏幕震动
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt
    }

    // 更新攻击命中震动效果
    this._updateAttackShake(dt)

    // 更新浮动文字
    this.floatingTexts.update(dt)

    // 更新连击提示（旧逻辑，保留兼容性）
    if (this.comboTimer > 0) {
      this.comboTimer -= dt
    }

    // 更新连锁弹窗动画
    if (this.comboPopup) {
      this.comboPopup.timer += dt
      const t = this.comboPopup.timer

      if (this.comboPopup.phase === 'in') {
        // phase in: 0→150ms, scale 0.5→1.2, opacity 0→1
        if (t < 0.15) {
          const progress = t / 0.15
          this.comboPopup.scale = 0.5 + 0.7 * progress  // 0.5→1.2
          this.comboPopup.opacity = progress
        } else {
          this.comboPopup.phase = 'peak'
          this.comboPopup.timer = 0
          this.comboPopup.scale = 1.2
          this.comboPopup.opacity = 1
        }
      } else if (this.comboPopup.phase === 'peak') {
        // phase peak: 0→150ms, scale 1.2→1.0, opacity保持1
        if (t < 0.15) {
          const progress = t / 0.15
          this.comboPopup.scale = 1.2 - 0.2 * progress  // 1.2→1.0
        } else {
          this.comboPopup.phase = 'out'
          this.comboPopup.timer = 0
          this.comboPopup.scale = 1.0
        }
      } else if (this.comboPopup.phase === 'out') {
        // phase out: 0→300ms, opacity 1→0
        if (t < 0.3) {
          const progress = t / 0.3
          this.comboPopup.opacity = 1 - progress
        } else {
          this.comboPopup = null
        }
      }
    }

    // 更新受击闪烁
    for (let i = this.hitFlashes.length - 1; i >= 0; i--) {
      this.hitFlashes[i].timer -= dt
      if (this.hitFlashes[i].timer <= 0) {
        this.hitFlashes.splice(i, 1)
      }
    }

    // 更新倒下提示
    for (let i = this.fallMessages.length - 1; i >= 0; i--) {
      this.fallMessages[i].timer -= dt
      if (this.fallMessages[i].timer <= 0) {
        this.fallMessages.splice(i, 1)
      }
    }

    // 更新消息
    if (this.messageTimer > 0) {
      this.messageTimer -= dt
    }

    // 更新idle动画计时器（战斗中怪物上下浮动）
    if (this.state === 'idle' || this.state === 'enemyTurn') {
      this.idleTime += dt
    }

    // 更新Boss技能视觉状态（同步护盾HP）
    const battleStatus = this.battle.getStatus()
    if (battleStatus.enemySkillStates) {
      for (const idx in battleStatus.enemySkillStates) {
        const skillState = battleStatus.enemySkillStates[idx]
        if (!this.bossSkillVisuals[idx]) {
          this.bossSkillVisuals[idx] = { chargeTimer: 0, shieldHP: 0, shieldMaxHP: 0, healFloats: [] }
        }
        const vis = this.bossSkillVisuals[idx]
        if (skillState.shield) {
          vis.shieldHP = skillState.shield.currentHP
          vis.shieldMaxHP = skillState.shield.maxHP
        }
        if (skillState.charge && skillState.charge.isCharging) {
          vis.chargeTimer = 999
        }
      }
    }

    // 更新敌方HP渐变动画
    for (let i = this.enemyDisplayHP.length - 1; i >= 0; i--) {
      const h = this.enemyDisplayHP[i]
      h.timer += dt
      if (h.timer >= h.maxTimer) {
        h.displayHP = h.targetHP
        this.enemyDisplayHP.splice(i, 1)
      } else {
        const progress = h.timer / h.maxTimer
        // 缓动： easeOut 效果
        const eased = 1 - Math.pow(1 - progress, 2)
        h.displayHP = h.displayHP - (h.displayHP - h.targetHP) * eased
      }
    }

    // 更新我方HP渐变动画
    for (let i = this.playerDisplayHP.length - 1; i >= 0; i--) {
      const h = this.playerDisplayHP[i]
      h.timer += dt
      if (h.timer >= h.maxTimer) {
        h.displayHP = h.targetHP
        this.playerDisplayHP.splice(i, 1)
      } else {
        const progress = h.timer / h.maxTimer
        const eased = 1 - Math.pow(1 - progress, 2)
        h.displayHP = h.displayHP - (h.displayHP - h.targetHP) * eased
      }
    }
  }

  render(r) {
    // 应用攻击震动偏移（画布整体震动）
    if (this.attackShakeTimer > 0) {
      r.save()
      r.translate(this.attackShakeOffsetX, 0)
    }

    // 背景：优先使用战斗场景美术底图
    const bgAsset = this.artAssets.bg
    if (bgAsset && bgAsset.loaded) {
      this._drawImageCover(r, bgAsset.img, 0, 0, this.designW, this.designH)
      r.fillRect(0, 0, this.designW, this.designH, 'rgba(5,8,22,0.18)')
    } else {
      r.fillRect(0, 0, this.designW, this.designH, THEME.colors.bgMedium)
    }

    // 攻击白闪效果（画布叠加层，在震动范围内）
    if (this.attackFlashTimer > 0) {
      const alpha = this.attackFlashTimer / 0.1 * 0.3
      r.fillRect(0, 0, this.designW, this.designH, `rgba(255,255,255,${alpha})`)
    }

    // idle动画参数：amplitude 3px, period 1.5s（战斗中怪物上下浮动）
    const idleAmplitude = 3
    const idlePeriod = 1.5
    const idleYOffset = Math.sin(this.idleTime * Math.PI * 2 / idlePeriod) * idleAmplitude

    // 标题栏
    r.fillRoundRect(0, 0, this.designW, 50, 0, THEME.colors.bgCard)
    r.fillText('三消宝可梦 ⚔️', this.designW / 2, 25, COLORS.white, THEME.font.subtitle.size)

    // BOSS阶段指示器
    const battleStatus = this.battle.getStatus()
    if (battleStatus.isBossBattle) {
      const phaseColor = this.phaseTransitionState ? THEME.colors.fire : THEME.colors.danger
      r.fillText(`阶段 ${battleStatus.currentPhase}/${battleStatus.totalPhases}`, this.designW - 60, 25, phaseColor, THEME.font.small.size)
    }

    // 队长技能信息条（标题栏下方）
    if (battleStatus.leaderSkillInfo) {
      const ls = battleStatus.leaderSkillInfo
      const lsBarY = 42
      r.fillRoundRect(5, lsBarY, this.designW - 10, 16, THEME.radius.sm, 'rgba(255,215,0,0.15)')
      r.fillText(`👑 队长技能: ${ls.icon} ${ls.name} — ${ls.desc}`, this.designW / 2, lsBarY + 10, COLORS.gold, THEME.font.small.size - 1)
    }

    // 属性协同信息条
    if (battleStatus.synergyInfo && battleStatus.synergyInfo.length > 0) {
      const synBarY = battleStatus.leaderSkillInfo ? 60 : 42
      const synCount = battleStatus.synergyInfo.length
      r.fillRoundRect(5, synBarY, this.designW - 10, 14 + synCount * 2, THEME.radius.sm, 'rgba(100,200,100,0.12)')
      const synText = battleStatus.synergyInfo.map(s => s.label).join(' | ')
      r.fillText(`🤝 ${synText}`, this.designW / 2, synBarY + 9, THEME.colors.success, THEME.font.small.size - 2)
    }

    // 敌方信息区
    this._renderEnemies(r, idleYOffset)

    // 我方信息区
    this._renderTeam(r, idleYOffset)

    // 棋盘背景
    const bx = this.board.offsetX - 5
    const by = this.board.offsetY - 5
    const bw = this.board.cols * this.board.cellSize + 10
    const bh = this.board.rows * this.board.cellSize + 10
    r.fillRoundRect(bx, by, bw, bh, THEME.radius.md, 'rgba(15,52,96,0.88)')

    // 绘制棋盘格子
    this._renderBoard(r)

    // 选中高亮
    if (this.selectedGem) {
      const sx = this.board.offsetX + this.selectedGem.col * this.board.cellSize
      const sy = this.board.offsetY + this.selectedGem.row * this.board.cellSize
      r.strokeRoundRect(sx, sy, this.board.cellSize, this.board.cellSize, THEME.radius.sm, COLORS.white, 3)
    }

    // 伤害弹出（带大小控制）
    this.floatingTexts.render(r)

    // 连锁弹窗动画（屏幕中央）
    if (this.comboPopup) {
      const cx = this.designW / 2
      const cy = 160
      const c = this.comboPopup
      const scale = c.scale
      const opacity = c.opacity

      // 背景框（带透明度和缩放）
      const boxW = 160 * scale
      const boxH = 60 * scale
      r.fillRoundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, 12 * scale, `rgba(0,0,0,${0.7 * opacity})`)

      // 文字（带透明度和缩放）
      r.fillText(`${c.combo}连击！`, cx, cy, `rgba(255,215,0,${opacity})`, Math.round(THEME.font.title.size * scale), 'center', 'bold')
    }

    // 倒下提示
    this.fallMessages.forEach((fm, i) => {
      const alpha = Math.min(1, fm.timer)
      r.fillText(fm.text, this.designW / 2, 300 + i * 25, `rgba(255,100,100,${alpha})`, THEME.font.body.size)
    })

    // 底部信息栏（根据回合状态变色）
    const bottomY = this.board.offsetY + this.board.rows * this.board.cellSize + 15
    const barColor = this.state === 'enemyTurn' ? COLORS.battle.enemyTurnBar : THEME.colors.bgCard
    r.fillRoundRect(10, bottomY, this.designW - 20, 45, THEME.radius.md, barColor)
    r.fillText(`回合: ${this.battle.turnCount}/${this.battle.maxTurns}`, 80, bottomY + 15, COLORS.textMuted, THEME.font.small.size)
    r.fillText(`连锁: ${this.board.cascadeCount}x`, 190, bottomY + 15, THEME.colors.gold, THEME.font.small.size)
    const statusText = this.state === 'enemyTurn' ? '敌方回合' : (this.state === 'idle' ? '等待操作' : '处理中...')
    r.fillText(`状态: ${statusText}`, 300, bottomY + 15, this.state === 'enemyTurn' ? THEME.colors.danger : COLORS.textMuted, THEME.font.small.size)

    // 中间消息
    if (this.messageTimer > 0) {
      const alpha = Math.min(1, this.messageTimer)
      r.fillRoundRect(this.designW / 2 - 100, this.designH / 2 - 20, 200, 40, THEME.radius.lg, 'rgba(0,0,0,0.7)')
      r.fillText(this.messageText, this.designW / 2, this.designH / 2, COLORS.white, THEME.font.body.size)
    }

    // 战斗结束覆盖
    if (this.state === 'battleEnd') {
      r.fillRect(0, 0, this.designW, this.designH, 'rgba(0,0,0,0.6)')
      const resultText = this.battle.battleResult === 'win' ? '🎉 胜利！' : '💀 失败...'
      r.fillText(resultText, this.designW / 2, this.designH / 2 - 30, COLORS.white, THEME.font.title.size)
      r.fillText('点击查看结算', this.designW / 2, this.designH / 2 + 20, COLORS.textMuted, THEME.font.body.size)

      // 点击任意位置进入结算
      if (!this.waitingForResult) {
        this.waitingForResult = true
        this.game.animation.setTimeout(() => {
          this._goToResult()
        }, 1000)
      }
    }

    // 屏幕闪烁效果
    if (this.screenFlashTimer > 0) {
      const alpha = this.screenFlashTimer / 0.3 * 0.5
      r.fillRect(0, 0, this.designW, this.designH, `rgba(255,255,255,${alpha})`)
    }

    // 阶段切换提示（覆盖在屏幕中央）
    if (this.phaseTransitionState && this.phaseTransitionState.timer > 0.5) {
      const alpha = Math.min(1, (this.phaseTransitionState.timer - 0.5) * 2)
      r.fillRoundRect(this.designW / 2 - 120, this.designH / 2 - 30, 240, 60, THEME.radius.xl, `rgba(0,0,0,0.8)`)
      r.fillText(`⚡ ${this.phaseTransitionState.bossName}`, this.designW / 2, this.designH / 2 - 5, THEME.colors.fire, THEME.font.subtitle.size)
      r.fillText('进入激战状态！', this.designW / 2, this.designH / 2 + 20, COLORS.white, THEME.font.body.size)
    }

    // 关闭震动偏移
    if (this.attackShakeTimer > 0) {
      r.restore()
    }

  }

  // hex颜色转rgb字符串（用于rgba）
  _hexToRgb(hex) {
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return '255,255,255'
    return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
  }

  _goToResult() {
    if (this.resultTransitioning) return
    this.resultTransitioning = true
    this.game.input.unlock()
    const battleResult = this.battle.getBattleResult()
    // 注入关卡奖励数据（确保数据链路完整）
    battleResult.stageId = battleResult.stageId || this.stageId || null
    battleResult.stageRewards = battleResult.stageRewards || (this.stageData && this.stageData.rewards) || null
    this.game.sceneManager.changeScene('result', battleResult)
  }

  _renderEnemies(r, idleYOffset) {
    const enemies = this.battle.enemies
    const startX = 15
    const startY = 55

    r.fillText('— 敌方 —', this.designW / 2, startY + 10, THEME.colors.danger, THEME.font.small.size)

    enemies.forEach((enemy, i) => {
      if (!enemy) return
      const x = startX + i * 120
      const y = startY + 25
      const cardH = 92
      const cardColor = enemy.isBoss ? 'rgba(61,26,26,0.76)' : 'rgba(22,33,62,0.72)'
      if (this.artAssets.panelDark && this.artAssets.panelDark.loaded) {
        this._drawImageFit(r, this.artAssets.panelDark.img, x + 5, y - 5, 110, cardH, 0.82)
      } else {
        r.fillRoundRect(x + 5, y - 5, 110, cardH, THEME.radius.md, cardColor)
      }
      if (enemy.isBoss) {
        r.fillRoundRect(x + 5, y - 5, 110, cardH, THEME.radius.md, 'rgba(90,25,25,0.22)')
      }

      // 检查是否有受击闪烁
      const flash = this.hitFlashes.find(f => f.isEnemy && f.monsterIndex === i)

      // 获取动画HP值（用于渐变显示）
      const hpAnim = this.enemyDisplayHP.find(h => h.monsterIndex === i)
      const displayHP = hpAnim ? hpAnim.displayHP : enemy.hp

      // 受击红闪覆盖层
      if (flash) {
        const flashAlpha = flash.timer / flash.maxTimer * 0.6
        r.fillRoundRect(x + 5, y - 5, 110, cardH, THEME.radius.md, `rgba(255,50,50,${flashAlpha})`)
      }

      const monsterKey = this._getMonsterAssetKey(enemy)
      if (monsterKey && this.artAssets[monsterKey]?.loaded) {
        const spriteSize = enemy.isBoss ? 70 : 54
        this._drawImageFit(r, this.artAssets[monsterKey]?.img, x + 55 - spriteSize / 2, y - 2 + idleYOffset, spriteSize, spriteSize, enemy.hp > 0 ? 1 : 0.35)
      } else if (enemy.emoji) {
        r.fillText(enemy.emoji, x + 55, y + 25 + idleYOffset, COLORS.white, THEME.font.display.size)
      }

      // 名称（不含emoji，单独绘制以便加上浮动特效）
      const nameColor = enemy.hp > 0 ? (flash ? THEME.colors.danger : COLORS.white) : COLORS.textMuted
      r.fillText(enemy.name, x + 55, y + 55, nameColor, THEME.font.small.size)

      // 血条（闪烁时红色，动画HP值）
      const hpBarColor = flash ? COLORS.battle.flashHpBar : THEME.colors.danger
      r.drawHPBar(x + 12, y + 66, 96, 8, displayHP, enemy.maxHP, COLORS.battle.hpBarBg, hpBarColor)

      // HP数值（动画HP值）
      r.fillText(`${Math.max(0, Math.round(displayHP))}/${enemy.maxHP}`, x + 60, y + 82, COLORS.battle.enemyHpText, 9)

      // ===== Boss技能视觉反馈 =====
      const skillVis = this.bossSkillVisuals[i]
      if (skillVis && enemy.hp > 0) {
        // 护盾光圈 + HP条
        if (skillVis.shieldHP > 0) {
          const shieldRatio = skillVis.shieldHP / skillVis.shieldMaxHP
          const shieldColor = `rgba(80,180,255,${0.3 + shieldRatio * 0.4})`
          // 护盾外圈
          const ctx = r.ctx
          ctx.save()
          ctx.strokeStyle = shieldColor
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(x + 55, y + 28, 36, 0, Math.PI * 2)
          ctx.stroke()
          ctx.restore()
          // 护盾HP条（在血条下方）
          r.drawHPBar(x + 12, y + 75, 96, 4, skillVis.shieldHP, skillVis.shieldMaxHP, COLORS.battle.hpBarBg, COLORS.shield)
          r.fillText(`🛡️${Math.round(skillVis.shieldHP)}`, x + 55, y + 81, COLORS.shield, 8)
        }

        // 蓄力中闪烁文字
        if (skillVis.chargeTimer > 0) {
          const blinkAlpha = 0.5 + 0.5 * Math.sin(this.idleTime * Math.PI * 4)
          r.fillText('⚡蓄力中...', x + 55, y - 2, `rgba(255,200,50,${blinkAlpha})`, 10)
        }
      }

      // ===== C4: 状态效果图标 =====
      if (enemy.hp > 0) {
        const statusEffects = this.battle.statusEffects
        if (statusEffects && statusEffects[i]) {
          const effect = statusEffects[i]
          const statusEmoji = { burn: '🔥', freeze: '❄️', poison: '☠️', stun: '⚡' }
          const statusTextColor = { burn: COLORS.statusEffect.burn, freeze: COLORS.statusEffect.freeze, poison: COLORS.statusEffect.poison, stun: COLORS.statusEffect.stun }
          const emoji = statusEmoji[effect.type] || ''
          const color = statusTextColor[effect.type] || COLORS.white

          // 状态图标（敌人名称上方）
          const blinkAlpha = 0.7 + 0.3 * Math.sin(this.idleTime * Math.PI * 3)
          r.fillText(`${emoji}${effect.turnsLeft}`, x + 95, y + 10, `rgba(${this._hexToRgb(color)},${blinkAlpha})`, 10)
        }
      }
    })
  }

  _renderTeam(r, idleYOffset) {
    const team = this.battle.playerTeam
    const startX = 15
    const startY = 170

    r.fillText('— 我方 —', this.designW / 2, startY + 10, THEME.colors.success, THEME.font.small.size)

    team.forEach((member, i) => {
      if (!member) return
      const x = startX + i * 120
      const y = startY + 25
      if (this.artAssets.panelDark && this.artAssets.panelDark.loaded) {
        this._drawImageFit(r, this.artAssets.panelDark.img, x + 5, y - 8, 110, 58, 0.78)
      } else {
        r.fillRoundRect(x + 5, y - 8, 110, 58, THEME.radius.md, 'rgba(22,33,62,0.76)')
      }

      // 检查是否有受击闪烁
      const flash = this.hitFlashes.find(f => !f.isEnemy && f.monsterIndex === i)

      // 获取动画HP值（用于渐变显示）
      const hpAnim = this.playerDisplayHP.find(h => h.monsterIndex === i)
      const displayHP = hpAnim ? hpAnim.displayHP : member.hp

      // 受击时高亮覆盖层
      if (flash) {
        const flashAlpha = flash.timer / flash.maxTimer * 0.6
        r.fillRoundRect(x + 5, y - 8, 110, 58, THEME.radius.md, `rgba(255,255,50,${flashAlpha})`)
      }

      const monsterKey = this._getMonsterAssetKey(member)
      if (monsterKey && this.artAssets[monsterKey]?.loaded) {
        this._drawImageFit(r, this.artAssets[monsterKey]?.img, x + 8, y - 5 + idleYOffset * 0.4, 42, 42, member.hp > 0 ? 1 : 0.35)
      } else if (member.emoji) {
        r.fillText(member.emoji, x + 30, y + 16 + idleYOffset * 0.4, COLORS.white, THEME.font.icon.size)
      }

      const nameColor = member.hp > 0 ? (flash ? THEME.colors.danger : COLORS.white) : COLORS.textMuted
      // 名称（不含emoji，单独绘制以便加上浮动特效）
      r.fillText(member.name, x + 78, y + 6, nameColor, THEME.font.small.size)

      // 血条（闪烁时高亮，动画HP值）
      const hpBarColor = flash ? COLORS.battle.flashHitBar : THEME.colors.success
      r.drawHPBar(x + 52, y + 16, 58, 7, displayHP, member.maxHP, COLORS.battle.hpBarBg, hpBarColor)

      r.fillText(`${Math.max(0, Math.round(displayHP))}/${member.maxHP}`, x + 82, y + 31, COLORS.battle.playerHpText, 8)

      // 技能充能
      const charge = this.battle.skillCharges[member.id] || 0
      const ratio = Math.min(1, charge / member.skill.cost)
      r.drawHPBar(x + 52, y + 38, 58, 5, ratio * member.skill.cost, member.skill.cost, COLORS.battle.skillChargeBg, THEME.colors.gold)
    })
  }

  _renderBoard(r) {
    const b = this.board

    // idle发光脉动参数（与战斗中怪物浮动周期一致）
    // 未选中宝石：opacity 0.85↔1，周期2s
    // 选中宝石：opacity 0.95↔1，周期1s（更快更亮）
    const idlePeriod = 2.0
    const selectedPeriod = 1.0
    const unselectedMin = 0.85, unselectedMax = 1.0
    const selectedMin = 0.95, selectedMax = 1.0

    for (let row = 0; row < b.rows; row++) {
      for (let col = 0; col < b.cols; col++) {
        const type = b.grid[row][col]
        if (!type) continue

        // 计算脉动透明度
        let pulseOpacity = 1.0
        if (this.eliminatingGems.some(g => g.row === row && g.col === col)) {
          // 正在消除的宝石：使用消除动画的透明度（由外部管理）
          // 此处保持不透明度为1，让eliminatingGems的视觉覆盖
          pulseOpacity = 1.0
        } else {
          // 普通宝石：根据是否被选中计算脉动
          const isSelected = this.selectedGem &&
            this.selectedGem.row === row &&
            this.selectedGem.col === col

          if (isSelected) {
            // 选中宝石：周期1s，范围0.95↔1.0
            const t = (this.idleTime % selectedPeriod) / selectedPeriod
            const sine = Math.sin(t * Math.PI * 2)
            pulseOpacity = selectedMin + (selectedMax - selectedMin) * (sine + 1) / 2
          } else {
            // 未选中宝石：周期2s，范围0.85↔1.0
            const t = (this.idleTime % idlePeriod) / idlePeriod
            const sine = Math.sin(t * Math.PI * 2)
            pulseOpacity = unselectedMin + (unselectedMax - unselectedMin) * (sine + 1) / 2
          }
        }

        const x = b.offsetX + col * b.cellSize + b.cellSize / 2
        const y = b.offsetY + row * b.cellSize + b.cellSize / 2
        const cellX = b.offsetX + col * b.cellSize
        const cellY = b.offsetY + row * b.cellSize

        // 棋盘格底
        r.fillRoundRect(cellX + 1, cellY + 1, b.cellSize - 2, b.cellSize - 2, 4, 'rgba(5,18,42,0.66)')

        if (!this._drawGemAsset(r, type, x, y, b.cellSize * 0.86, pulseOpacity)) {
          const radius = b.cellSize * 0.38
          r.fillCircle(x, y, radius, GEM_COLORS[type], pulseOpacity)
          r.fillCircle(x - 2, y - 2, radius * 0.5, `rgba(255,255,255,${0.3 * pulseOpacity})`)
          r.fillText(GEM_EMOJI[type], x, y, `rgba(255,255,255,${pulseOpacity})`, THEME.font.body.size)
        }
      }
    }

    // 渲染锁定宝石锁链
    this._renderLockedGems(r, b)

    // 渲染障碍物（石块）
    this._renderObstacles(r, b)

    // 渲染毒雾格子
    this._renderPoisonFog(r, b)

    // 渲染正在消除的宝石（带动画效果）
    this.eliminatingGems.forEach(gem => {
      const visual = gem._visual || {}
      const scale = visual.scale !== undefined ? visual.scale : 1
      const opacity = visual.opacity !== undefined ? visual.opacity : 1
      const brightness = visual.brightness !== undefined ? visual.brightness : 0

      if (opacity <= 0) return

      const x = visual.x !== undefined ? visual.x : gem.x
      const y = visual.y !== undefined ? visual.y : gem.y
      const baseRadius = b.cellSize * 0.38
      const radius = baseRadius * scale

      // 绘制阴影
      if (brightness > 0) {
        // 闪白效果：用亮色叠加
        const flashColor = `rgba(255,255,255,${brightness * 0.8})`
        r.fillCircle(x, y, radius * 1.2, flashColor)
      }

      if (!this._drawGemAsset(r, gem.type, x, y, b.cellSize * 0.86 * scale, opacity)) {
        const baseColor = GEM_COLORS[gem.type] || COLORS.white
        r.fillCircle(x, y, radius, baseColor, opacity)
        r.fillCircle(x - 2 * scale, y - 2 * scale, radius * 0.5, `rgba(255,255,255,${0.3 * opacity})`)
        r.fillText(GEM_EMOJI[gem.type], x, y, `rgba(255,255,255,${opacity})`, THEME.font.body.size * scale)
      }
    })

    // 渲染4连强化宝石的发光效果
    this._renderEnhancedGemGlow(r, b)
  }

  // 渲染锁定宝石锁链
  _renderLockedGems(r, b) {
    for (let row = 0; row < b.rows; row++) {
      for (let col = 0; col < b.cols; col++) {
        if (!b.isLocked(row, col)) continue

        const lock = b.lockedGems[row][col]
        const x = b.offsetX + col * b.cellSize
        const y = b.offsetY + row * b.cellSize
        const size = b.cellSize
        const cx = x + size / 2
        const cy = y + size / 2

        // 检查是否正在播放解锁动画
        const animating = this.unlockAnimations.find(a => a.row === row && a.col === col && a.phase === 'shatter')

        if (!animating) {
          const lockAsset = this.artAssets.gemLocked
          if (lockAsset && lockAsset.loaded) {
            this._drawImageFit(r, lockAsset.img, x + 3, y + 3, size - 6, size - 6, lock.hp >= 2 ? 0.92 : 0.72)
            if (lock.hp < 2) {
              r.fillText('×1', cx, cy + size * 0.3, 'rgba(255,255,255,0.8)', 8)
            }
            continue
          }

          // 锁链边框：灰色半透明边框环绕宝石
          const ctx = r.ctx
          ctx.save()

          // 外圈锁链环
          const chainColor = lock.hp >= 2 ? COLORS.lock.chain : COLORS.lock.chainWeak
          ctx.strokeStyle = chainColor
          ctx.lineWidth = 2.5

          // 四角锁链标记
          const corners = [
            [x + 3, y + 3],       // 左上
            [x + size - 3, y + 3], // 右上
            [x + 3, y + size - 3], // 左下
            [x + size - 3, y + size - 3] // 右下
          ]

          // 画四条锁链线连接四角
          ctx.beginPath()
          ctx.moveTo(corners[0][0], corners[0][1])
          ctx.lineTo(corners[1][0], corners[1][1])
          ctx.lineTo(corners[3][0], corners[3][1])
          ctx.lineTo(corners[2][0], corners[2][1])
          ctx.closePath()
          ctx.stroke()

          // 锁链emoji在四个角
          ctx.font = '8px serif'
          ctx.fillStyle = 'rgba(180,180,200,0.9)'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          corners.forEach(([px, py]) => {
            ctx.fillText('⛓', px, py)
          })

          // 中心锁标记
          if (lock.hp >= 2) {
            r.fillText('🔒', cx, cy - size * 0.35, 'rgba(200,200,220,0.7)', 8)
          }

          ctx.restore()
        }
      }
    }

    // 渲染解锁碎裂动画
    for (let i = this.unlockAnimations.length - 1; i >= 0; i--) {
      const anim = this.unlockAnimations[i]
      anim.timer += 1/60 // 近似每帧
      const progress = anim.timer / anim.maxTimer

      if (progress >= 1) {
        this.unlockAnimations.splice(i, 1)
        continue
      }

      // 碎裂效果：4个锁链碎片向外散开
      const alpha = 1 - progress
      const dist = progress * 20
      const ctx = r.ctx
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.font = '10px serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const dirs = [[-1,-1],[1,-1],[-1,1],[1,1]]
      dirs.forEach(([dx, dy]) => {
        ctx.fillText('⛓', anim.x + dx * dist, anim.y + dy * dist)
      })

      ctx.restore()
    }
  }

  // 渲染障碍物（石块）
  _renderObstacles(r, b) {
    for (let row = 0; row < b.rows; row++) {
      for (let col = 0; col < b.cols; col++) {
        if (!b.isObstacle(row, col)) continue

        const ob = b.obstacles[row][col]
        const x = b.offsetX + col * b.cellSize
        const y = b.offsetY + row * b.cellSize
        const size = b.cellSize
        const cx = x + size / 2
        const cy = y + size / 2

        if (ob.type === 'rock') {
          const rockAsset = ob.hp >= 2 ? this.artAssets.obstacleRockFull : this.artAssets.obstacleRockCracked
          if (rockAsset && rockAsset.loaded) {
            this._drawImageFit(r, rockAsset.img, x + 3, y + 3, size - 6, size - 6, 0.98)
            continue
          }

          // 石块底色
          r.fillRoundRect(x + 2, y + 2, size - 4, size - 4, 4, COLORS.obstacle.rock)

          // 石块纹理：根据HP显示不同状态
          if (ob.hp >= 2) {
            // 完好石块：实心灰色 + 轻微高光
            r.fillRoundRect(x + 4, y + 4, size - 8, size - 8, 3, COLORS.obstacle.rockSolid)
            // 高光
            r.fillRoundRect(x + 6, y + 6, size - 16, (size - 8) / 3, 2, 'rgba(255,255,255,0.15)')
            // 石块标记
            r.fillText('🪨', cx, cy, 'rgba(255,255,255,0.7)', THEME.font.number.size)
          } else {
            // HP=1：裂纹石块，颜色偏暗
            r.fillRoundRect(x + 4, y + 4, size - 8, size - 8, 3, COLORS.obstacle.rockCracked)
            // 裂纹边框
            r.strokeRoundRect(x + 4, y + 4, size - 8, size - 8, 3, COLORS.obstacle.crackLine, 1)
            // 裂纹效果（用canvas直接画线）
            const ctx = r.ctx
            ctx.save()
            ctx.lineWidth = 1.5
            ctx.strokeStyle = COLORS.obstacle.crackLine
            ctx.beginPath()
            ctx.moveTo(cx - 6, cy - 4)
            ctx.lineTo(cx, cy + 2)
            ctx.lineTo(cx + 5, cy - 6)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(cx - 3, cy + 1)
            ctx.lineTo(cx + 2, cy + 6)
            ctx.stroke()
            ctx.restore()
            // 破碎石块标记
            r.fillText('🪨', cx, cy, 'rgba(255,255,255,0.5)', THEME.font.body.size)
          }
        }
      }
    }
  }

  // 渲染毒雾格子
  _renderPoisonFog(r, b) {
    for (let row = 0; row < b.rows; row++) {
      for (let col = 0; col < b.cols; col++) {
        if (!b.isPoisonFog(row, col)) continue

        const x = b.offsetX + col * b.cellSize
        const y = b.offsetY + row * b.cellSize
        const size = b.cellSize
        const cx = x + size / 2
        const cy = y + size / 2

        // 脉动动画：opacity 0.2↔0.4, 周期 1.5s
        const pulsePeriod = 1.5
        const pulseMin = 0.2
        const pulseMax = 0.4
        const t = (this.idleTime % pulsePeriod) / pulsePeriod
        const pulseOpacity = pulseMin + (pulseMax - pulseMin) * (Math.sin(t * Math.PI * 2) + 1) / 2

        // 绿色半透明覆盖层
        const ctx = r.ctx
        ctx.save()
        ctx.fillStyle = `rgba(80, 200, 80, ${pulseOpacity})`
        ctx.fillRect(x + 1, y + 1, size - 2, size - 2)
        ctx.restore()

        // 💀 小图标（脉动透明度）
        const skullOpacity = 0.5 + pulseOpacity
        r.fillText('💀', cx, cy, `rgba(255,255,255,${skullOpacity})`, 10)
      }
    }

    // 渲染毒雾扩散动画
    for (let i = this.poisonFogSpreadAnims.length - 1; i >= 0; i--) {
      const anim = this.poisonFogSpreadAnims[i]
      anim.timer += 1/60
      const progress = anim.timer / 0.6 // 0.6s动画

      if (progress >= 1) {
        this.poisonFogSpreadAnims.splice(i, 1)
        continue
      }

      // 扩散效果：绿色光圈从小到大
      const alpha = (1 - progress) * 0.6
      const radius = b.cellSize * 0.3 * progress * 2
      const ctx = r.ctx
      ctx.save()
      ctx.strokeStyle = `rgba(80, 200, 80, ${alpha})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(anim.x, anim.y, radius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // 渲染毒雾清除动画
    for (let i = this.poisonFogClearAnims.length - 1; i >= 0; i--) {
      const anim = this.poisonFogClearAnims[i]
      anim.timer += 1/60
      const progress = anim.timer / 0.5 // 0.5s动画

      if (progress >= 1) {
        this.poisonFogClearAnims.splice(i, 1)
        continue
      }

      // 清除效果：绿色碎片向外散开
      const alpha = 1 - progress
      const dist = progress * 15
      const ctx = r.ctx
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.font = '10px serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // 4个方向散开
      const dirs = [[-1,-1],[1,-1],[-1,1],[1,1]]
      dirs.forEach(([dx, dy]) => {
        ctx.fillText('☁️', anim.x + dx * dist, anim.y + dy * dist)
      })
      ctx.restore()
    }
  }

  // 渲染4连强化宝石的发光十字指示器
  _renderEnhancedGemGlow(r, b) {
    // 只在idle状态显示强化宝石发光（matching/falling时不显示，避免视觉干扰）
    // 当前版本：强化宝石在产生时立即爆炸，不留存棋盘
    // 未来如果改为"强化宝石留存在棋盘，点击/滑消时引爆"，这个方法用于渲染发光效果
  }

  _getMonsterAssetKey(monster) {
    if (!monster) return null
    if (monster.id === 'monster_boss_001') return 'bossGrass'
    if (monster.id === 'monster_001') return 'monsterFire'
    if (monster.id === 'monster_002') return 'monsterWater'
    if (monster.id === 'monster_003') return 'monsterGrass'

    // 临时复用：未单独拆分的普通敌人按属性映射到同系立绘，避免回退到emoji。
    const elementMap = {
      fire: 'monsterFire',
      water: 'monsterWater',
      grass: 'monsterGrass',
    }
    return elementMap[monster.element] || null
  }

  _drawGemAsset(r, type, cx, cy, size, opacity = 1) {
    const key = GEM_ASSET_KEYS[type]
    const asset = key ? this.artAssets[key] : null
    if (!asset || !asset.loaded) return false
    this._drawImageFit(r, asset.img, cx - size / 2, cy - size / 2, size, size, opacity)
    return true
  }

  _drawImageFit(r, img, x, y, w, h, opacity = 1) {
    if (!img) return false
    const sx = x * r.scaleX
    const sy = y * r.scaleY
    const sw = w * r.scaleX
    const sh = h * r.scaleY
    r.ctx.save()
    r.ctx.globalAlpha *= opacity
    r.ctx.drawImage(img, sx, sy, sw, sh)
    r.ctx.restore()
    return true
  }

  _drawImageCover(r, img, x, y, w, h, opacity = 1) {
    if (!img) return false
    const srcRatio = img.width / img.height
    const dstRatio = w / h
    let sx = 0, sy = 0, sw = img.width, sh = img.height
    if (srcRatio > dstRatio) {
      sw = img.height * dstRatio
      sx = (img.width - sw) / 2
    } else {
      sh = img.width / dstRatio
      sy = (img.height - sh) / 2
    }
    r.ctx.save()
    r.ctx.globalAlpha *= opacity
    r.ctx.drawImage(
      img,
      sx, sy, sw, sh,
      x * r.scaleX, y * r.scaleY, w * r.scaleX, h * r.scaleY
    )
    r.ctx.restore()
    return true
  }

  destroy() {
    this.game.input.onSwipe = null
    this.game.input.onTap = null
    this.game.animation.clear()
  }
}
