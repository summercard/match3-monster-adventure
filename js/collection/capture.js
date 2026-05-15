// ============================================
// collection/capture.js - 收服系统
// ============================================

// 稀有度 → 基础收服率（来自 balance-design.md §2.3，BD-P5 调优后）
const BASE_CAPTURE_RATE = {
  1: 0.80,   // ★1 普通（BD-P5: 0.70→0.80，确保新手第1关收服概率≥80%）
  2: 0.45,   // ★2 常见（BD-P5: 0.40→0.45，略微提升）
  3: 0.25,   // ★3 稀有
  4: 0.15,   // ★4 史诗
  5: 0.08    // ★5 传说
}

/**
 * 新手收服保护机制（BD-P5）
 * 前3关(stage_1_1/1_2/1_3)连续失败3次后，下次收服概率+30%
 *
 * @param {string} stageId - 当前关卡ID
 * @param {number} consecutiveFails - 连续收服失败次数
 * @returns {number} 额外加成概率 (0 或 0.30)
 */
export function getRookieBonus(stageId, consecutiveFails) {
  const rookieStages = ['stage_1_1', 'stage_1_2', 'stage_1_3']
  if (!rookieStages.includes(stageId)) return 0
  if (consecutiveFails >= 3) return 0.30
  return 0
}

/**
 * 计算收服概率（与 balance-design.md §2.3 对齐）
 *
 * 收服概率 = baseCaptureRate × (1 - currentHP/maxHP) × levelBonus
 * levelBonus = 1 + (playerLevel - enemyLevel) × 0.05  (上限 1.5x)
 *
 * @param {number} remainingHp - 怪物剩余血量
 * @param {number} maxHp - 怪物最大血量
 * @param {number} playerLevel - 玩家等级
 * @param {number} enemyLevel - 敌人等级
 * @param {number} [rarity=1] - 怪物稀有度 1-5
 * @param {object} [options={}] - 额外选项
 * @param {string} [options.stageId] - 当前关卡ID（用于新手保护）
 * @param {number} [options.consecutiveFails=0] - 连续收服失败次数
 * @returns {number} 0-1 的概率值
 */
export function calcCaptureProbability(remainingHp, maxHp, playerLevel, enemyLevel, rarity, options = {}) {
  // 基础收服率
  const baseRate = BASE_CAPTURE_RATE[rarity] || BASE_CAPTURE_RATE[1]

  // 血量因子：敌人越虚弱概率越高（满血时为0，全灭时为1）
  const hpFactor = maxHp > 0 ? (1 - Math.max(0, remainingHp) / maxHp) : 1

  // 等级差加成（上限1.5x）
  const levelBonus = Math.min(1.5, 1 + (playerLevel - enemyLevel) * 0.05)

  let probability = baseRate * hpFactor * levelBonus

  // 新手收服保护加成（BD-P5）
  const { stageId, consecutiveFails = 0 } = options
  if (stageId) {
    const rookieBonus = getRookieBonus(stageId, consecutiveFails)
    if (rookieBonus > 0) {
      probability = Math.min(1.0, probability + rookieBonus)
    }
  }

  // 最终概率限制在 3% - 100%（新手保底可达100%）
  return Math.max(0.03, Math.min(1.0, probability))
}

/**
 * 执行收服判定
 * @param {number} probability - 收服概率 0-1
 * @returns {boolean} 是否收服成功
 */
export function attemptCapture(probability) {
  const roll = Math.random()
  return roll < probability
}

/**
 * 获取收服状态文本
 * @param {number} probability - 收服概率 0-1
 * @param {boolean} captured - 是否成功
 * @returns {object} { title, desc }
 */
export function getCaptureResultText(probability, captured) {
  const percent = Math.round(probability * 100)
  if (captured) {
    return {
      title: '✨ 收服成功！',
      desc: `恭喜！你收服了野生精灵！\n（收服概率: ${percent}%）`
    }
  } else {
    return {
      title: '💨 收服失败...',
      desc: `精灵逃脱了！\n（收服概率: ${percent}%）`
    }
  }
}

/**
 * 计算战斗评价星级
 * @param {number} turnCount - 战斗回合数
 * @param {number} maxTurns - 最大回合数
 * @param {number} playerHpRatio - 玩家剩余血量比例
 * @returns {number} 1-3 星级
 */
export function calcBattleStars(turnCount, maxTurns, playerHpRatio) {
  // 3星：回合数 < 40% maxTurns 且 血量 > 50%
  // 2星：回合数 < 70% maxTurns 且 血量 > 20%
  // 1星：其他胜利情况
  const turnRatio = turnCount / maxTurns
  if (turnRatio < 0.4 && playerHpRatio > 0.5) {
    return 3
  } else if (turnRatio < 0.7 && playerHpRatio > 0.2) {
    return 2
  }
  return 1
}
