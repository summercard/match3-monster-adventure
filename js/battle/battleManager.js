// ============================================
// battle/battleManager.js - 战斗管理器
// ============================================

import { getMonsterStats, getElementMultiplier } from './monsterData.js'
import { getLeaderSkill, getLeaderAtkBoost, getLeaderDefBoost } from '../../data/leader-skills.js'

export class BattleManager {
  constructor() {
    this.playerTeam = []    // 玩家队伍 [{...stats}]
    this.enemies = []       // 敌方怪物 [{...stats}]
    this.turn = 0
    this.combo = 0          // 当前连锁数
    this.totalDamageDealt = {} // 按属性统计伤害
    this.skillCharges = {}  // 技能充能 { monsterId: charge }
    this.battleOver = false
    this.battleResult = null // 'win' | 'lose'
    this.turnCount = 0
    this.maxTurns = 20

    // BOSS多阶段
    this.currentPhase = 1
    this.stagePhases = []   // 关卡阶段配置
    this.phaseTransitionTriggered = {} // { phaseNum: true }

    // 敌人技能状态跟踪
    // { enemyIndex: { charge: { turnsSinceLast, isCharging }, shield: { currentHP, maxHP, cooldownLeft }, heal: { turnsSinceLast } } }
    this.enemySkillStates = {}

    // 队长技能状态
    this.leaderSkillData = null  // 队长技能配置对象
    this.leaderSkillInfo = null  // { id, name, desc, icon } 供UI显示

    // 属性协同状态
    this.synergyBonuses = null   // { element: { count, atkMult, defMult, hpMult } }
    this.synergyInfo = []        // [{ element, count, label }] 供UI显示

    // 状态效果（C4）
    // per-enemy: { type: 'burn'|'freeze'|'poison'|'stun', sourceATK, turnsLeft, element }
    this.statusEffects = []  // indexed by enemy index, null = no effect

    // 状态效果日志（供UI显示浮动文字）
    this.statusEffectLog = []  // [{ type, enemyIndex, damage?, message }]

    // 回调
    this.onEnemyAttack = null
    this.onBattleEnd = null
    this.onDamage = null
    this.onSkillReady = null
    this.onPhaseTransition = null  // 阶段切换回调
    this.onEnemySkillAction = null // 敌人技能行动回调 (用于视觉反馈)
  }

  init(playerMonsterIds, enemyMonsterIds, playerLevel = 1, enemyLevel = 1, stageData = null, stageId = null) {
    this.playerTeam = playerMonsterIds.map(id => getMonsterStats(id, playerLevel))

    // 保存关卡数据供结算使用
    this.stageData = stageData
    this.stageId = stageId

    // 初始化阶段配置
    this.stagePhases = []
    this.currentPhase = 1
    this.phaseTransitionTriggered = {}

    if (stageData && stageData.phases) {
      // BOSS关卡：使用phases配置
      this.stagePhases = stageData.phases
      const phase1 = stageData.phases.find(p => p.phase === 1)
      if (phase1) {
        const hpMult = phase1.hpMultiplier || 1
        this.enemies = phase1.enemies.map(id => {
          const monster = getMonsterStats(id, enemyLevel)
          if (monster && hpMult !== 1) {
            monster.maxHP = Math.floor(monster.maxHP * hpMult)
            monster.hp = monster.maxHP
            monster.atk = Math.floor(monster.atk * hpMult)
          }
          return monster
        })
      }
    } else {
      // 普通关卡
      this.enemies = enemyMonsterIds.map(id => getMonsterStats(id, enemyLevel))
    }

    this.turn = 0
    this.combo = 0
    this.totalDamageDealt = {}
    this.battleOver = false
    this.battleResult = null
    this.turnCount = 0

    // 保存实际等级供 getBattleResult 使用（不再硬编码）
    this.playerLevel = playerLevel
    this.enemyLevel = enemyLevel

    this.playerTeam.forEach(m => {
      if (m) this.skillCharges[m.id] = 0
    })

    // 初始化敌人技能状态
    this.enemySkillStates = {}
    this.enemies.forEach((enemy, i) => {
      if (enemy && enemy.enemySkills && enemy.enemySkills.length > 0) {
        const state = {}
        enemy.enemySkills.forEach(skill => {
          if (skill.type === 'charge') {
            state.charge = { turnsSinceLast: 0, isCharging: false }
          } else if (skill.type === 'shield') {
            state.shield = { currentHP: 0, maxHP: skill.hp, cooldownLeft: 0 }
          } else if (skill.type === 'heal') {
            state.heal = { turnsSinceLast: 0 }
          }
        })
        this.enemySkillStates[i] = state
      }
    })

    // ===== 队长技能初始化 =====
    this.leaderSkillData = null
    this.leaderSkillInfo = null
    const leader = this.playerTeam[0] // 第一个槽位是队长
    if (leader && leader.leaderSkill) {
      const skillData = getLeaderSkill(leader.leaderSkill)
      if (skillData) {
        this.leaderSkillData = skillData
        this.leaderSkillInfo = {
          id: skillData.id,
          name: skillData.name,
          desc: skillData.desc,
          icon: skillData.icon
        }

        // HP_BOOST: 全队HP+20%
        if (skillData.type === 'hp_boost') {
          const hpMult = skillData.hpMultiplier
          this.playerTeam.forEach(m => {
            if (m) {
              m.maxHP = Math.floor(m.maxHP * hpMult)
              m.hp = m.maxHP
            }
          })
        }

        // COMBO_START: 战斗开始自带1层combo
        if (skillData.type === 'combo_start') {
          this.combo = skillData.initialCombo
        }
      }
    }

    // ===== 属性协同初始化 =====
    this.synergyBonuses = null
    this.synergyInfo = []
    this._calcAndApplyElementSynergy()

    // ===== 状态效果初始化 =====
    this.statusEffects = new Array(this.enemies.length).fill(null)
    this.statusEffectLog = []
  }

  /**
   * 计算队伍属性协同加成并应用
   * 规则：
   * - 遍历队伍3个槽位，按 element 分组计数
   * - 2个同属性：+15%ATK / +10%DEF / +10%HP
   * - 3个同属性：+30%ATK / +20%DEF / +20%HP
   * - HP加成在初始化时对同属性怪物乘入
   * - ATK/DEF加成在战斗时动态应用
   */
  _calcAndApplyElementSynergy() {
    // 按属性计数（跳过空槽位和null）
    const elementCounts = {}
    this.playerTeam.forEach(m => {
      if (!m) return
      const elem = m.element
      elementCounts[elem] = (elementCounts[elem] || 0) + 1
    })

    // 计算加成
    this.synergyBonuses = {}
    const elemNames = { fire: '火', water: '水', grass: '草', thunder: '雷', light: '光' }
    const elemEmojis = { fire: '🔥', water: '💧', grass: '🌿', thunder: '⚡', light: '✨' }

    for (const [elem, count] of Object.entries(elementCounts)) {
      if (count < 2) continue  // 单属性无加成

      let atkMult, defMult, hpMult
      if (count === 2) {
        atkMult = 1.15  // +15%
        defMult = 1.10  // +10%
        hpMult = 1.10   // +10%
      } else {
        // count >= 3
        atkMult = 1.30  // +30%
        defMult = 1.20  // +20%
        hpMult = 1.20   // +20%
      }

      this.synergyBonuses[elem] = { count, atkMult, defMult, hpMult }

      // 生成显示信息
      const pctLabel = count === 2 ? '+15%ATK/+10%DEF' : '+30%ATK/+20%DEF'
      const elemEmoji = elemEmojis[elem] || ''
      const elemName = elemNames[elem] || elem
      this.synergyInfo.push({
        element: elem,
        count,
        label: `${elemEmoji}×${count} ${elemName}属性共鸣 ${pctLabel}`
      })

      // 应用HP加成（立即生效，战斗初始化阶段）
      this.playerTeam.forEach(m => {
        if (m && m.element === elem) {
          m.maxHP = Math.floor(m.maxHP * hpMult)
          m.hp = m.maxHP
        }
      })
    }
  }

  /**
   * 获取指定属性怪物的协同ATK倍率（乘法叠加）
   * 用于 processMatchResult 伤害计算
   */
  getSynergyAtkMultiplier(element) {
    if (!this.synergyBonuses || !this.synergyBonuses[element]) return 1.0
    return this.synergyBonuses[element].atkMult
  }

  /**
   * 获取指定属性怪物的协同DEF倍率（降低受伤）
   * 用于 enemyAction 受击计算
   */
  getSynergyDefMultiplier(element) {
    if (!this.synergyBonuses || !this.synergyBonuses[element]) return 1.0
    return this.synergyBonuses[element].defMult
  }

  // ===== C4 状态效果系统 =====

  /**
   * 状态效果定义
   * fire → burn (灼烧): DoT, sourceATK×0.15, 3回合
   * water → freeze (冰冻): ATK降低30%, 2回合
   * grass → poison (中毒): DoT, sourceATK×0.20, 3回合
   * thunder → stun (眩晕): 50%跳过攻击, 1回合
   */
  static STATUS_DEFS = {
    burn:   { element: 'fire',    dotMult: 0.15, duration: 3, label: '🔥灼烧', dotLabel: '灼烧伤害' },
    freeze: { element: 'water',   atkReduction: 0.30, duration: 2, label: '❄️冰冻' },
    poison: { element: 'grass',   dotMult: 0.20, duration: 3, label: '☠️中毒', dotLabel: '中毒伤害' },
    stun:   { element: 'thunder', skipChance: 0.50, duration: 1, label: '⚡眩晕' }
  }

  /**
   * 属性→状态效果类型映射
   */
  static ELEMENT_TO_STATUS = {
    fire: 'burn',
    water: 'freeze',
    grass: 'poison',
    thunder: 'stun'
  }

  /**
   * 尝试根据消除宝石数量附加状态效果
   * 在 processMatchResult() 末尾调用
   * @param {Object} gemCounts - { fire: N, water: N, ... }
   */
  tryApplyStatusEffects(gemCounts) {
    this.statusEffectLog = []

    for (const [element, count] of Object.entries(gemCounts)) {
      if (count < 4) continue  // 3颗不触发

      const statusType = BattleManager.ELEMENT_TO_STATUS[element]
      if (!statusType) continue  // light属性无状态效果

      // 触发概率：5颗+ → 100%, 4颗 → 50%
      let triggerChance = count >= 5 ? 1.0 : 0.5

      // Boss眩晕抗性：眩晕概率再×50%
      const target = this._getWeakestEnemy()
      if (!target) continue
      const targetIdx = this.enemies.indexOf(target)
      if (statusType === 'stun' && target.isBoss) {
        triggerChance *= 0.5
      }

      if (Math.random() > triggerChance) continue

      // 找到对应属性怪物的ATK作为sourceATK
      const sourceMonster = this.playerTeam.find(m => m && m.element === element && m.hp > 0)
      const sourceATK = sourceMonster ? sourceMonster.atk : 10

      // 附加状态（覆盖旧效果）
      this.statusEffects[targetIdx] = {
        type: statusType,
        sourceATK: sourceATK,
        turnsLeft: BattleManager.STATUS_DEFS[statusType].duration,
        element: element
      }

      this.statusEffectLog.push({
        type: statusType,
        enemyIndex: targetIdx,
        enemyName: target.name,
        message: `${BattleManager.STATUS_DEFS[statusType].label}! → ${target.name}`
      })
    }
  }

  /**
   * 处理状态效果（回合末调用）
   * - burn/poison: DoT伤害
   * - freeze: 标记ATK降低（在enemyAction中应用）
   * - stun: 标记跳过概率（在enemyAction中应用）
   * @returns {Array} 日志 [{ type, enemyIndex, damage?, message }]
   */
  processStatusEffects() {
    const logs = []

    this.enemies.forEach((enemy, i) => {
      if (!enemy || enemy.hp <= 0) return
      const effect = this.statusEffects[i]
      if (!effect) return

      const def = BattleManager.STATUS_DEFS[effect.type]

      if (effect.type === 'burn' || effect.type === 'poison') {
        // DoT伤害
        const dotDamage = Math.max(1, Math.floor(effect.sourceATK * def.dotMult))
        enemy.hp -= dotDamage
        logs.push({
          type: effect.type,
          enemyIndex: i,
          enemyName: enemy.name,
          damage: dotDamage,
          message: `${def.label} ${enemy.name} 受到 ${dotDamage} ${def.dotLabel}！`
        })
      } else if (effect.type === 'freeze') {
        logs.push({
          type: 'freeze',
          enemyIndex: i,
          enemyName: enemy.name,
          message: `❄️${enemy.name} 冰冻中，ATK降低30%！`
        })
      } else if (effect.type === 'stun') {
        logs.push({
          type: 'stun',
          enemyIndex: i,
          enemyName: enemy.name,
          message: `⚡${enemy.name} 眩晕中！`
        })
      }

      // 回合递减
      effect.turnsLeft--
      if (effect.turnsLeft <= 0) {
        this.statusEffects[i] = null
        logs.push({
          type: effect.type + '_end',
          enemyIndex: i,
          enemyName: enemy.name,
          message: `${enemy.name} 的${def.label}效果消失了`
        })
      }
    })

    return logs
  }

  /**
   * 检查敌人是否被眩晕（应跳过攻击）
   * @param {number} enemyIndex
   * @returns {boolean} true = 跳过攻击
   */
  isEnemyStunned(enemyIndex) {
    const effect = this.statusEffects[enemyIndex]
    if (!effect || effect.type !== 'stun') return false
    return Math.random() < BattleManager.STATUS_DEFS.stun.skipChance
  }

  /**
   * 获取敌人的冰冻ATK降低倍率
   * @param {number} enemyIndex
   * @returns {number} ATK倍率（0.7 = 降低30%）
   */
  getFreezeAtkMultiplier(enemyIndex) {
    const effect = this.statusEffects[enemyIndex]
    if (!effect || effect.type !== 'freeze') return 1.0
    return 1.0 - BattleManager.STATUS_DEFS.freeze.atkReduction
  }

  // 检查是否应该触发阶段转换
  _checkPhaseTransition() {
    if (!this.stagePhases || this.stagePhases.length === 0) return null

    const nextPhaseNum = this.currentPhase + 1
    const nextPhase = this.stagePhases.find(p => p.phase === nextPhaseNum)
    if (!nextPhase) return null
    if (this.phaseTransitionTriggered[nextPhaseNum]) return null

    if (nextPhase.trigger === 'on_enter') {
      this.phaseTransitionTriggered[nextPhaseNum] = true
      return nextPhase
    }

    if (nextPhase.trigger === 'hp_50') {
      const boss = this.enemies.find(e => e && e.hp > 0 && e.isBoss)
      if (boss && boss.hp <= boss.maxHP * 0.5) {
        this.phaseTransitionTriggered[nextPhaseNum] = true
        return nextPhase
      }
    }

    return null
  }

  // 执行阶段转换
  _executePhaseTransition(phaseConfig) {
    this.currentPhase++

    // 应用属性倍率
    const hpMult = phaseConfig.hpMultiplier || 1.3
    const newEnemies = phaseConfig.enemies.map(id => {
      const monster = getMonsterStats(id, this.enemyLevel || 1)
      if (monster) {
        monster.maxHP = Math.floor(monster.maxHP * hpMult)
        monster.hp = monster.maxHP
        monster.atk = Math.floor(monster.atk * hpMult)
        monster.def = Math.floor(monster.def * hpMult)
      }
      return monster
    })

    // 重置敌人技能状态（新阶段的敌人）
    this.enemySkillStates = {}
    this.statusEffects = new Array(newEnemies.length).fill(null)
    newEnemies.forEach((enemy, i) => {
      if (enemy && enemy.enemySkills && enemy.enemySkills.length > 0) {
        const state = {}
        enemy.enemySkills.forEach(skill => {
          if (skill.type === 'charge') {
            state.charge = { turnsSinceLast: 0, isCharging: false }
          } else if (skill.type === 'shield') {
            // 阶段2直接生成护盾（Boss激战状态！）
            state.shield = { currentHP: skill.hp, maxHP: skill.hp, cooldownLeft: 0 }
          } else if (skill.type === 'heal') {
            state.heal = { turnsSinceLast: 0 }
          }
        })
        this.enemySkillStates[i] = state
      }
    })

    if (this.onPhaseTransition) {
      this.onPhaseTransition(this.currentPhase, newEnemies)
    }

    return newEnemies
  }

  // 处理消除结果 → 造成伤害
  processMatchResult(gemCounts, comboCount) {
    this.combo = comboCount
    const damageLog = []

    // 每种属性的消除 → 对应属性怪物攻击
    this.playerTeam.forEach(monster => {
      if (!monster || monster.hp <= 0) return

      const gemCount = gemCounts[monster.element] || 0
      if (gemCount === 0) return

      // 计算伤害
      // 基础伤害 = ATK × (消除数 / 3) × combo加成
      // 新手保护：消除数 < 3 时按 3 计算（保底伤害）
      const effectiveGemCount = Math.max(gemCount, 3)
      const baseDamage = monster.atk * (effectiveGemCount / 3)
      const comboMultiplier = 1 + (comboCount - 1) * 0.3 // 每次combo +30%
      let totalDamage = baseDamage * comboMultiplier

      // 技能充能
      this.skillCharges[monster.id] = (this.skillCharges[monster.id] || 0) + gemCount

      // 选择目标（攻击血量最低的敌人）
      const target = this._getWeakestEnemy()
      if (!target) return

      // 属性克制
      const elementMult = getElementMultiplier(monster.element, target.element)
      totalDamage *= elementMult

      // 队长技能 - 属性攻击加成（ATK_BOOST：对应属性伤害×1.3）
      const leaderAtkBoost = getLeaderAtkBoost(this.leaderSkillData, monster.element)
      totalDamage *= leaderAtkBoost

      // 属性协同 - ATK加成（2同属性+15%，3同属性+30%，乘法叠加）
      const synergyAtkMult = this.getSynergyAtkMultiplier(monster.element)
      totalDamage *= synergyAtkMult

      // 防御减免（上限50%，敌人防御低时减免少）
      const defReduction = target.def / (target.def + 100)
      totalDamage = totalDamage * (1 - defReduction)

      // BD-P0 伤害公式调优：添加 ±10% randomVariance，增加战斗变数
      const randomVariance = 0.9 + Math.random() * 0.2
      totalDamage = Math.floor(Math.max(1, totalDamage * randomVariance))

      // 造成伤害（先处理护盾吸收）
      let remainingDamage = totalDamage
      const skillState = this.enemySkillStates[this.enemies.indexOf(target)]
      if (skillState && skillState.shield && skillState.shield.currentHP > 0) {
        // 有护盾，先扣护盾HP
        const shieldAbsorb = Math.min(skillState.shield.currentHP, remainingDamage)
        skillState.shield.currentHP -= shieldAbsorb
        remainingDamage -= shieldAbsorb
      }
      target.hp -= remainingDamage

      // 累计伤害统计
      this.totalDamageDealt[monster.id] = (this.totalDamageDealt[monster.id] || 0) + totalDamage

      damageLog.push({
        attacker: monster.name,
        attackerEmoji: monster.emoji,
        target: target.name,
        targetEmoji: target.emoji,
        damage: totalDamage,
        element: monster.element,
        combo: comboCount,
        isEffective: elementMult > 1,
        isWeak: elementMult < 1,
        targetDied: target.hp <= 0
      })

      if (this.onDamage) {
        this.onDamage(damageLog[damageLog.length - 1])
      }
    })

    // 检查BOSS阶段转换
    const phaseToTrigger = this._checkPhaseTransition()
    if (phaseToTrigger) {
      return { damageLog, phaseTransition: phaseToTrigger }
    }

    // ===== C4: 尝试附加状态效果 =====
    this.tryApplyStatusEffects(gemCounts)

    // 检查技能是否就绪
    this.playerTeam.forEach(monster => {
      if (!monster || monster.hp <= 0) return
      const charge = this.skillCharges[monster.id] || 0
      if (charge >= monster.skill.cost) {
        if (this.onSkillReady) {
          this.onSkillReady(monster)
        }
        this.skillCharges[monster.id] = 0 // 重置充能
      }
    })

    return { damageLog, statusEffectLog: this.statusEffectLog }
  }

  // 敌方行动（支持Boss特殊技能：蓄力/护盾/回血 + C4状态效果）
  enemyAction() {
    if (this.battleOver) return []
    const actions = []

    // ===== C4: 回合末处理状态效果（DoT等） =====
    const statusLogs = this.processStatusEffects()

    // 检查状态效果DoT是否击杀了敌人
    const dotKills = []
    this.enemies.forEach((enemy, i) => {
      if (enemy && enemy.hp <= 0) {
        dotKills.push({ enemyIndex: i, enemyName: enemy.name })
      }
    })

    this.enemies.forEach((enemy, i) => {
      if (!enemy || enemy.hp <= 0) return

      const aliveTeam = this.playerTeam.filter(m => m && m.hp > 0)
      if (aliveTeam.length === 0) return

      // ===== C4: 眩晕检查 =====
      if (this.isEnemyStunned(i)) {
        actions.push({
          attacker: enemy.name,
          attackerEmoji: enemy.emoji,
          target: null,
          targetEmoji: null,
          damage: 0,
          element: enemy.element,
          targetDied: false,
          isStunned: true
        })
        return
      }

      const skillState = this.enemySkillStates[i]
      const hasSkills = skillState && enemy.enemySkills && enemy.enemySkills.length > 0

      // ========== Boss技能逻辑 ==========

      // 1. 护盾检查：冷却结束时重新生成护盾
      if (hasSkills && skillState.shield) {
        const shieldConfig = enemy.enemySkills.find(s => s.type === 'shield')
        if (skillState.shield.currentHP <= 0 && skillState.shield.cooldownLeft <= 0) {
          // 重新生成护盾
          skillState.shield.currentHP = shieldConfig.hp
          skillState.shield.maxHP = shieldConfig.hp
          skillState.shield.cooldownLeft = shieldConfig.cooldown

          // 护盾生成回调
          if (this.onEnemySkillAction) {
            this.onEnemySkillAction({
              type: 'shield_appear',
              enemyIndex: i,
              enemy: enemy,
              shieldHP: skillState.shield.currentHP,
              shieldMaxHP: skillState.shield.maxHP
            })
          }
        }
        // 冷却递减
        if (skillState.shield.cooldownLeft > 0) {
          skillState.shield.cooldownLeft--
        }
      }

      // 2. 回血检查
      if (hasSkills && skillState.heal) {
        const healConfig = enemy.enemySkills.find(s => s.type === 'heal')
        skillState.heal.turnsSinceLast++
        if (skillState.heal.turnsSinceLast >= healConfig.interval) {
          skillState.heal.turnsSinceLast = 0
          const healAmount = Math.floor(enemy.maxHP * healConfig.percent)
          enemy.hp = Math.min(enemy.maxHP, enemy.hp + healAmount)

          // 回血回调
          if (this.onEnemySkillAction) {
            this.onEnemySkillAction({
              type: 'heal',
              enemyIndex: i,
              enemy: enemy,
              healAmount: healAmount
            })
          }
        }
      }

      // 3. 蓄力检查（决定本回合是否普通攻击）
      let skipAttack = false
      let damageMultiplier = 1.0

      if (hasSkills && skillState.charge) {
        const chargeConfig = enemy.enemySkills.find(s => s.type === 'charge')

        if (skillState.charge.isCharging) {
          // 正在蓄力中 → 本回合释放蓄力攻击
          damageMultiplier = chargeConfig.damageMultiplier
          skillState.charge.isCharging = false
          skillState.charge.turnsSinceLast = 0

          // 蓄力释放回调
          if (this.onEnemySkillAction) {
            this.onEnemySkillAction({
              type: 'charge_release',
              enemyIndex: i,
              enemy: enemy,
              damageMultiplier: damageMultiplier
            })
          }
        } else {
          skillState.charge.turnsSinceLast++
          if (skillState.charge.turnsSinceLast >= chargeConfig.interval) {
            // 进入蓄力状态 → 本回合跳过攻击
            skillState.charge.isCharging = true
            skipAttack = true

            // 蓄力中回调
            if (this.onEnemySkillAction) {
              this.onEnemySkillAction({
                type: 'charge_start',
                enemyIndex: i,
                enemy: enemy
              })
            }
          }
        }
      }

      // 如果蓄力中，跳过本回合攻击
      if (skipAttack) {
        actions.push({
          attacker: enemy.name,
          attackerEmoji: enemy.emoji,
          target: null,
          targetEmoji: null,
          damage: 0,
          element: enemy.element,
          targetDied: false,
          isCharging: true
        })
        return
      }

      // ========== 普通攻击逻辑（与原版一致，加上蓄力倍率）==========
      const target = aliveTeam[Math.floor(Math.random() * aliveTeam.length)]

      // 伤害计算
      let baseDamage = enemy.atk * (0.6 + Math.random() * 0.3)
      const elementMult = getElementMultiplier(enemy.element, target.element)
      baseDamage *= elementMult

      // ===== C4: 冰冻ATK降低 =====
      const freezeMult = this.getFreezeAtkMultiplier(i)
      baseDamage *= freezeMult

      const defReduction = target.def / (target.def + 80)
      baseDamage = baseDamage * (1 - defReduction)
      let damage = Math.floor(Math.max(1, baseDamage * (0.9 + Math.random() * 0.2)))

      // 应用蓄力倍率
      damage = Math.floor(damage * damageMultiplier)

      // 队长技能 - 防御加成（DEF_BOOST：受伤×0.85）
      const leaderDefBoost = getLeaderDefBoost(this.leaderSkillData)
      damage = Math.floor(damage * leaderDefBoost)

      // 属性协同 - DEF加成（同属性队伍受伤降低：2同属性×0.90，3同属性×0.80）
      const synergyDefMult = this.getSynergyDefMultiplier(target.element)
      // DEF协同效果：受伤 × (2 - defMult)，defMult>1时受伤减少
      // 2同属性 defMult=1.10 → 受伤×0.90（减少10%）
      // 3同属性 defMult=1.20 → 受伤×0.80（减少20%）
      const defReductionMult = synergyDefMult > 1 ? (2 - synergyDefMult) : 1.0
      damage = Math.floor(damage * defReductionMult)

      target.hp -= damage

      actions.push({
        attacker: enemy.name,
        attackerEmoji: enemy.emoji,
        target: target.name,
        targetEmoji: target.emoji,
        damage: damage,
        element: enemy.element,
        targetDied: target.hp <= 0,
        isCharged: damageMultiplier > 1.0,
        chargeMultiplier: damageMultiplier
      })
    })

    if (this.onEnemyAttack) {
      actions.forEach(a => this.onEnemyAttack(a))
    }

    // 检查玩家是否全灭
    if (this.playerTeam.every(m => !m || m.hp <= 0)) {
      this.battleOver = true
      this.battleResult = 'lose'
      if (this.onBattleEnd) this.onBattleEnd('lose')
    }

    return { actions, statusLogs, dotKills }
  }

  _getWeakestEnemy() {
    return this.enemies.find(e => e && e.hp > 0 && e.hp === Math.min(...this.enemies.filter(x => x && x.hp > 0).map(x => x.hp)))
  }

  // 检查战斗是否结束
  checkBattleEnd() {
    const allEnemiesDead = this.enemies.every(e => !e || e.hp <= 0)
    if (allEnemiesDead) {
      this.battleOver = true
      this.battleResult = 'win'
      if (this.onBattleEnd) this.onBattleEnd('win')
      return true
    }
    return false
  }

  // 获取战斗状态摘要
  getStatus() {
    return {
      turnCount: this.turnCount,
      combo: this.combo,
      playerTeam: this.playerTeam.map(m => m ? { ...m } : null),
      enemies: this.enemies.map(e => e ? { ...e } : null),
      skillCharges: { ...this.skillCharges },
      battleOver: this.battleOver,
      battleResult: this.battleResult,
      currentPhase: this.currentPhase,
      totalPhases: this.stagePhases.length || 1,
      isBossBattle: this.stagePhases.length > 0,
      enemySkillStates: JSON.parse(JSON.stringify(this.enemySkillStates)),
      leaderSkillInfo: this.leaderSkillInfo,
      synergyInfo: this.synergyInfo,
      synergyBonuses: this.synergyBonuses ? JSON.parse(JSON.stringify(this.synergyBonuses)) : null,
      statusEffects: this.statusEffects.map(e => e ? { ...e } : null),
      statusEffectLog: [...this.statusEffectLog]
    }
  }

  // 获取详细战斗结果（用于结算）
  getBattleResult() {
    return {
      result: this.battleResult,
      turnCount: this.turnCount,
      maxTurns: this.maxTurns,
      playerTeam: this.playerTeam.map(m => m ? { ...m } : null),
      enemies: this.enemies.map(e => e ? { ...e } : null),
      totalDamageDealt: { ...this.totalDamageDealt },
      playerLevel: this.playerLevel || 1,
      enemyLevel: this.enemyLevel || 1,
      stageId: this.stageId || null,
      stageRewards: (this.stageData && this.stageData.rewards) ? this.stageData.rewards : null
    }
  }
}
