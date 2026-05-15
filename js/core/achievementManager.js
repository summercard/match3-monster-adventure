// ============================================
// core/achievementManager.js - 成就系统管理器
// ============================================

import { achievements as ACHIEVEMENTS } from '../../data/achievements.js'

export class AchievementManager {
  constructor(game) {
    this.game = game
    this.achievements = []           // 所有成就定义
    this.unlockedIds = []            // 已解锁成就ID列表
    this.unlockedDates = {}          // 解锁时间 { id: '2026-05-13' }
    this.stats = {}                 // 成就进度统计
    this._loadAchievements()
    this.loadAchievements()
  }

  // 加载成就定义
  _loadAchievements() {
    this.achievements = ACHIEVEMENTS || []
  }

  // 获取所有成就（含解锁状态）
  getAllAchievements() {
    return this.achievements.map(ach => ({
      ...ach,
      unlocked: this.unlockedIds.includes(ach.id),
      unlockedDate: this.unlockedDates[ach.id] || null,
      progress: this._getProgress(ach)
    }))
  }

  // 获取指定类别的成就
  getAchievementsByCategory(category) {
    return this.getAllAchievements().filter(ach => ach.category === category)
  }

  // 获取已解锁成就列表
  getUnlockedList() {
    return this.getAllAchievements().filter(ach => ach.unlocked)
  }

  // 获取某类别下一个可解锁成就
  getNextAchievement(category) {
    const list = this.getAllAchievements().filter(ach => ach.category === category && !ach.unlocked)
    return list.length > 0 ? list[0] : null
  }

  // 获取某个成就的当前进度
  _getProgress(ach) {
    const key = ach.progressKey
    const current = this.stats[key] || 0
    return Math.min(current, ach.target)
  }

  // 更新统计数据
  updateStat(key, value) {
    const prev = this.stats[key] || 0
    this.stats[key] = value
    this.saveAchievements()
    return prev !== value
  }

  // 增加统计值
  addStat(key, delta) {
    const prev = this.stats[key] || 0
    this.stats[key] = prev + delta
    this.saveAchievements()
    return this.stats[key]
  }

  // 检查成就是否满足条件（内部用）
  _checkAchievement(ach) {
    if (this.unlockedIds.includes(ach.id)) {
      return false  // 已解锁
    }

    const key = ach.progressKey
    const current = this.stats[key] || 0
    return current >= ach.target
  }

  // 触发成就检查（外部调用入口）
  checkAchievements(type, value) {
    // 先更新统计
    this._updateStatFromType(type, value)

    // 再检查所有成就
    const newlyUnlocked = []
    for (const ach of this.achievements) {
      if (this.unlockedIds.includes(ach.id)) continue
      if (this._checkAchievement(ach)) {
        this.unlockAchievement(ach.id)
        newlyUnlocked.push(ach)
      }
    }

    return newlyUnlocked
  }

  // 根据type更新对应统计
  _updateStatFromType(type, value) {
    switch (type) {
      case 'battleEnd':
        // 战斗结束：增加战斗计数
        this.addStat('battleCount', 1)
        if (value?.won) {
          this.addStat('winCount', 1)
        }
        break

      case 'stageClear':
        // 关卡通关
        this.addStat('stageClearedCount', 1)
        break

      case 'capture':
        // 收服怪物
        this.addStat('captureCount', 1)
        break

      case 'evolve':
        // 进化怪物
        this.addStat('evolveCount', 1)
        break

      case 'goldEarned':
        // 金币获得（value是增量）
        this.addStat('totalGoldEarned', value || 0)
        break

      case 'damageDealt':
        // 造成伤害（value是增量）
        this.addStat('totalDamageDealt', value || 0)
        break

      case 'signIn':
        // 签到（value是连续天数）
        const consecutive = value
        const currentMax = this.stats.maxConsecutiveSignIn || 0
        if (consecutive > currentMax) {
          this.addStat('maxConsecutiveSignIn', consecutive - currentMax)
        }
        const signInData = this.game.storage.loadSignInData()
        if ((signInData.totalDays || 0) > (this.stats.totalSignInDays || 0)) {
          this.updateStat('totalSignInDays', signInData.totalDays || 0)
        }
        break

      default:
        // 直接更新指定key
        if (typeof value === 'number') {
          this.addStat(type, value)
        }
    }
  }

  // 解锁成就
  unlockAchievement(id) {
    if (this.unlockedIds.includes(id)) {
      return false
    }

    this.unlockedIds.push(id)
    this.unlockedDates[id] = this._getDateString(new Date())
    this._grantReward(id)
    this.saveAchievements()

    console.log(`[AchievementManager] 解锁成就: ${id}`)
    return true
  }

  _grantReward(id) {
    const ach = this.achievements.find(a => a.id === id)
    if (!ach || !ach.reward) return

    const reward = ach.reward
    if (reward.gold) {
      this.game.storage.addGold(reward.gold)
    }
    if (reward.exp) {
      this.game.storage.addPlayerExp(reward.exp)
    }
    if (reward.items) {
      for (const [itemId, count] of Object.entries(reward.items)) {
        this.game.storage.addItem(itemId, count)
      }
    }
  }

  // 领取奖励（检查是否解锁，发放奖励）
  claimReward(id) {
    if (!this.unlockedIds.includes(id)) {
      return null
    }

    const ach = this.achievements.find(a => a.id === id)
    if (!ach) return null

    // 奖励已通过unlockAchievement发放，这里仅返回奖励信息
    return ach.reward
  }

  // 保存成就数据
  saveAchievements() {
    const data = {
      unlockedIds: this.unlockedIds,
      unlockedDates: this.unlockedDates,
      stats: this.stats
    }
    this.game.storage.save('achievements', data)
  }

  // 加载成就数据
  loadAchievements() {
    const data = this.game.storage.load('achievements', null)
    if (data) {
      this.unlockedIds = data.unlockedIds || []
      this.unlockedDates = data.unlockedDates || {}
      this.stats = data.stats || {}
    }
  }

  // 获取当前日期字符串
  _getDateString(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // 重置成就数据（用于测试）
  resetAchievements() {
    this.unlockedIds = []
    this.unlockedDates = {}
    this.stats = {}
    this.saveAchievements()
  }
}
