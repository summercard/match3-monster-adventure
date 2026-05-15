// ============================================
// core/storage.js - 本地存储管理
// ============================================

import { MONSTER_DB, getMonsterStats } from '../battle/monsterData.js'
import { randomNature } from '../data/natures.js'

export class StorageManager {
  constructor() {
    this.prefix = 'm3m_'
  }

  save(key, data) {
    try {
      wx.setStorageSync(this.prefix + key, JSON.stringify(data))
      return true
    } catch (e) {
      console.error('[Storage] Save failed:', e)
      return false
    }
  }

  load(key, defaultVal = null) {
    try {
      const raw = wx.getStorageSync(this.prefix + key)
      if (raw === '' || raw === undefined || raw === null) return defaultVal
      return JSON.parse(raw)
    } catch (e) {
      console.error('[Storage] Load failed:', e)
      return defaultVal
    }
  }

  delete(key) {
    try {
      wx.removeStorageSync(this.prefix + key)
    } catch (e) {
      console.error('[Storage] Delete failed:', e)
    }
  }

  // 保存玩家数据
  savePlayer(playerData) {
    return this.save('player', playerData)
  }

  loadPlayer() {
    return this.load('player', {
      level: 1,
      gold: 0,
      gems: 0,
      team: ['monster_001', 'monster_002', 'monster_003'],
      captured: ['monster_001', 'monster_002', 'monster_003'],
      stageProgress: { chapter: 1, stage: 1 },
      pokedex: {}
    })
  }

  // ===== 怪物成长系统（pokedex） =====
  // pokedex 结构: { [monsterId]: { level: 1, exp: 0 }, ... }

  // 初始化怪物的pokedex数据（收服/获得新怪物时调用）
  initMonsterPokedex(monsterId, natureId) {
    const player = this.loadPlayer()
    if (!player.pokedex) player.pokedex = {}
    if (!player.pokedex[monsterId]) {
      player.pokedex[monsterId] = {
        level: 1,
        exp: 0,
        nature: natureId || randomNature()
      }
      this.savePlayer(player)
    } else if (natureId && !player.pokedex[monsterId].nature) {
      // 补丁：为旧数据补充性格
      player.pokedex[monsterId].nature = natureId
      this.savePlayer(player)
    }
    return player.pokedex[monsterId]
  }

  // 获取怪物当前等级
  getMonsterLevel(monsterId) {
    const player = this.loadPlayer()
    const entry = player.pokedex && player.pokedex[monsterId]
    return entry ? entry.level : 1
  }

  // 获取怪物当前经验值
  getMonsterExp(monsterId) {
    const player = this.loadPlayer()
    const entry = player.pokedex && player.pokedex[monsterId]
    return entry ? entry.exp : 0
  }

  // 获取怪物性格ID
  getMonsterNature(monsterId) {
    const player = this.loadPlayer()
    const entry = player.pokedex && player.pokedex[monsterId]
    return entry ? (entry.nature || null) : null
  }

  // 获取怪物pokedex完整数据
  getMonsterPokedex(monsterId) {
    const player = this.loadPlayer()
    return player.pokedex && player.pokedex[monsterId]
      ? player.pokedex[monsterId]
      : null
  }

  // 计算升级所需经验（每级所需经验递增）
  _getExpForLevel(level) {
    // 每级基础100 + 等级×20
    return 100 + level * 20
  }

  // 获取当前等级总经验要求（用于经验条显示）
  _getTotalExpForLevel(level) {
    let total = 0
    for (let l = 1; l < level; l++) {
      total += this._getExpForLevel(l)
    }
    return total
  }

  // 增加怪物经验，可触发升级
  // 返回: { leveledUp: true/false, newLevel, oldLevel, expGained, currentExp }
  addMonsterExp(monsterId, expGained) {
    const player = this.loadPlayer()
    if (!player.pokedex) player.pokedex = {}
    if (!player.pokedex[monsterId]) {
      player.pokedex[monsterId] = { level: 1, exp: 0 }
    }

    const entry = player.pokedex[monsterId]
    const oldLevel = entry.level
    const oldExp = entry.exp

    entry.exp += expGained

    // 检查升级
    while (true) {
      const needed = this._getExpForLevel(entry.level)
      if (entry.exp >= needed) {
        entry.exp -= needed
        entry.level += 1
      } else {
        break
      }
    }

    this.savePlayer(player)

    return {
      leveledUp: entry.level > oldLevel,
      newLevel: entry.level,
      oldLevel,
      expGained,
      currentExp: entry.exp
    }
  }

  // ===== 队伍编成相关 =====
  // 队伍数据结构: { leader: 'monster_001', member1: 'monster_002', member2: 'monster_003' }
  // null 表示空槽位

  // 默认初始队伍（新玩家自动编成）
  _getDefaultTeam() {
    return {
      leader: 'monster_001',
      member1: 'monster_002',
      member2: 'monster_003'
    }
  }

  saveTeam(teamData) {
    return this.save('team', {
      leader: teamData.leader || null,
      member1: teamData.member1 || null,
      member2: teamData.member2 || null
    })
  }

  loadTeam() {
    const team = this.load('team', null)
    // 如果从未保存过队伍，给新玩家默认队伍
    if (team === null) {
      const defaultTeam = this._getDefaultTeam()
      this.saveTeam(defaultTeam)
      return { ...defaultTeam }
    }
    return team
  }

  // 获取玩家已收服的怪物完整数据
  getCapturedMonsters() {
    const player = this.loadPlayer()
    const captured = player.captured || []
    // 返回怪物ID列表
    return captured
  }

  // 检查怪物是否在队伍中
  isMonsterInTeam(monsterId) {
    const team = this.loadTeam()
    return team.leader === monsterId || team.member1 === monsterId || team.member2 === monsterId
  }

  // 计算队伍总战力（使用成长后属性）
  calcTeamPower() {
    const team = this.loadTeam()
    let power = 0

    for (const slot of ['leader', 'member1', 'member2']) {
      const id = team[slot]
      if (id && MONSTER_DB[id]) {
        const level = this.getMonsterLevel(id) || 1
        const stats = getMonsterStats(id, level)
        if (stats) {
          power += stats.hp + stats.atk + stats.def + stats.spd
        }
      }
    }
    return power
  }

  // ===== 道具背包相关 =====
  // 背包数据结构: { 'capture_ball': 3, 'exp_potion': 1, ... }

  saveInventory(inventory) {
    return this.save('inventory', inventory)
  }

  loadInventory() {
    return this.load('inventory', {})
  }

  // 增加道具
  addItem(itemId, count = 1) {
    const inv = this.loadInventory()
    inv[itemId] = (inv[itemId] || 0) + count
    return this.saveInventory(inv)
  }

  // 使用道具（返回是否成功）
  useItem(itemId, count = 1) {
    const inv = this.loadInventory()
    if (!inv[itemId] || inv[itemId] < count) {
      return false
    }
    inv[itemId] -= count
    if (inv[itemId] <= 0) {
      delete inv[itemId]
    }
    return this.saveInventory(inv)
  }

  // 获取道具数量
  getItemCount(itemId) {
    const inv = this.loadInventory()
    return inv[itemId] || 0
  }

  // 增加金币
  addGold(amount) {
    const player = this.loadPlayer()
    player.gold = (player.gold || 0) + amount
    return this.savePlayer(player)
  }

  // 花费金币（返回是否成功）
  spendGold(amount) {
    const player = this.loadPlayer()
    if ((player.gold || 0) < amount) {
      return false
    }
    player.gold -= amount
    return this.savePlayer(player)
  }

  // ===== 奖励记录相关 =====
  // 奖励数据结构: { lastRewardTime: timestamp, totalGoldEarned: 0, totalItemsGained: 0 }

  saveRewards(rewardsData) {
    return this.save('rewards', rewardsData)
  }

  loadRewards() {
    return this.load('rewards', {
      totalGoldEarned: 0,
      totalItemsGained: 0,
      battleCount: 0,
      captureCount: 0
    })
  }

  // ===== 关卡星级与扫荡相关 =====
  // 关卡进度数据结构: { 'stage_1_1': { stars: 2, cleared: true }, ... }
  // stars: 0-3 表示星级，cleared: 是否通关

  saveStageProgress(stageId, stageData) {
    const all = this.loadStageProgress()
    all[stageId] = stageData
    return this.save('stageProgress', all)
  }

  loadStageProgress() {
    return this.load('stageProgress', {})
  }

  // 保存关卡星级（只保留最高星级）
  saveStageStars(stageId, stars) {
    const all = this.loadStageProgress()
    const prev = all[stageId] || {}
    const prevStars = prev.stars || 0
    all[stageId] = {
      ...prev,
      stars: Math.max(prevStars, stars),
      cleared: true
    }
    return this.save('stageProgress', all)
  }

  // 获取关卡星级
  getStageStars(stageId) {
    const all = this.loadStageProgress()
    return all[stageId]?.stars || 0
  }

  // 检查是否解锁扫荡（3星通关）
  canSweep(stageId) {
    return this.getStageStars(stageId) >= 3
  }

  // 获取扫荡奖励（金币+经验）
  getSweepReward(stageId) {
    // 扫荡奖励 = 正常战斗胜利奖励的80%
    // 基础金币100 + 星级加成（扫荡固定按3星算150）
    const gold = Math.floor((100 + 3 * 50) * 0.8)
    // 经验 = 基础100 + 3星加成60 的80%
    const exp = Math.floor((100 + 3 * 20) * 0.8)
    return { gold, exp }
  }

  // 执行扫荡（增加奖励）
  doSweep(stageId) {
    if (!this.canSweep(stageId)) {
      return null
    }
    const reward = this.getSweepReward(stageId)
    this.addGold(reward.gold)
    this.addPlayerExp(reward.exp)

    // 更新奖励统计
    const rewards = this.loadRewards()
    rewards.totalGoldEarned = (rewards.totalGoldEarned || 0) + reward.gold
    rewards.totalItemsGained = (rewards.totalItemsGained || 0)
    this.saveRewards(rewards)

    return reward
  }

  // ===== 成就系统相关 =====
  // 成就数据结构: { unlockedIds: [], unlockedDates: {}, stats: {} }

  saveAchievements(data) {
    return this.save('achievements', data)
  }

  loadAchievements() {
    return this.load('achievements', {
      unlockedIds: [],
      unlockedDates: {},
      stats: {}
    })
  }

  // ===== 每日签到相关 =====
  // 签到数据结构: { lastSignInDate: '2026-05-13', consecutiveDays: 3, totalDays: 10 }

  saveSignInData(data) {
    return this.save('signIn', data)
  }

  loadSignInData() {
    return this.load('signIn', {
      lastSignInDate: null,
      consecutiveDays: 0,
      totalDays: 0
    })
  }

  // ===== 设置相关 =====
  // 设置数据结构: { soundOn: true, musicOn: true, version: 'v0.1.0' }

  saveSettings(data) {
    return this.save('settings', data)
  }

  loadSettings() {
    return this.load('settings', {
      soundOn: true,
      musicOn: true,
      version: 'v0.1.0'
    })
  }

  // 检查今天是否已签到
  canSignInToday() {
    const data = this.loadSignInData()
    if (!data.lastSignInDate) return true

    const today = this._getDateString(new Date())
    return data.lastSignInDate !== today
  }

  // 执行签到，返回奖励
  doSignIn() {
    if (!this.canSignInToday()) return null

    const data = this.loadSignInData()
    const today = this._getDateString(new Date())
    const yesterday = this._getDateString(new Date(Date.now() - 86400000))

    // 检查是否连续
    if (data.lastSignInDate === yesterday) {
      data.consecutiveDays += 1
    } else {
      data.consecutiveDays = 1
    }

    data.lastSignInDate = today
    data.totalDays += 1

    this.saveSignInData(data)

    // 发放奖励
    const reward = this.getSignInReward(data.consecutiveDays)
    this.addGold(reward.gold)

    // 增加玩家经验（如果有等级系统）
    this.addPlayerExp(reward.exp)

    return reward
  }

  // 获取签到奖励（根据连续签到天数）
  getSignInReward(consecutiveDays) {
    // 连续天数越多，奖励越丰富
    const baseGold = 50
    const baseExp = 30

    // 连续7天重置循环，但给予额外奖励
    if (consecutiveDays > 7) {
      return {
        gold: baseGold + consecutiveDays * 5 + 20,
        exp: baseExp + consecutiveDays * 2 + 10
      }
    }

    return {
      gold: baseGold + consecutiveDays * 5,
      exp: baseExp + consecutiveDays * 2
    }
  }

  // 增加玩家经验
  addPlayerExp(amount) {
    const player = this.loadPlayer()
    player.exp = (player.exp || 0) + amount
    // 检查是否升级（简单逻辑：每100经验升1级）
    while (player.exp >= 100) {
      player.exp -= 100
      player.level = (player.level || 1) + 1
    }
    return this.savePlayer(player)
  }

  // ===== 新手引导相关 =====
  // 引导进度数据结构: { completed: true/false, currentStep: 0-5 }

  saveTutorialProgress(step) {
    return this.save('tutorial', {
      completed: step >= 5,
      currentStep: step
    })
  }

  loadTutorialProgress() {
    return this.load('tutorial', {
      completed: false,
      currentStep: 0
    })
  }

  // 获取当前日期字符串
  _getDateString(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
}
