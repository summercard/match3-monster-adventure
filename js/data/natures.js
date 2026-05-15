// ============================================
// data/natures.js - 性格系统数据定义
// ============================================
// 每只怪物收服时随机获得性格，影响属性成长方向
// 性格在收服时决定，无法更改 → 每只怪物都是独一无二的

/**
 * 8种性格定义
 * boost: 加成属性 key (hp/atk/def/spd)
 * boostRate: 加成比例
 * nerf: 减弱属性 key
 * nerfRate: 减弱比例
 */
export const NATURES = {
  brave: {
    id: 'brave',
    name: '勇敢',
    emoji: '⚔️',
    desc: '勇往直前，攻击更强但略显莽撞',
    boost: 'atk',
    boostRate: 0.10,
    nerf: 'spd',
    nerfRate: 0.05
  },
  cautious: {
    id: 'cautious',
    name: '谨慎',
    emoji: '🛡️',
    desc: '防御至上，坚若磐石',
    boost: 'def',
    boostRate: 0.10,
    nerf: 'atk',
    nerfRate: 0.05
  },
  agile: {
    id: 'agile',
    name: '敏捷',
    emoji: '💨',
    desc: '速度就是一切',
    boost: 'spd',
    boostRate: 0.10,
    nerf: 'def',
    nerfRate: 0.05
  },
  wise: {
    id: 'wise',
    name: '智慧',
    emoji: '📖',
    desc: '技能大师',
    boost: 'skillDmg',
    boostRate: 0.15,
    nerf: 'atk',
    nerfRate: 0.05
  },
  gentle: {
    id: 'gentle',
    name: '温和',
    emoji: '💚',
    desc: '生命力顽强',
    boost: 'hp',
    boostRate: 0.10,
    nerf: 'atk',
    nerfRate: 0.05
  },
  fierce: {
    id: 'fierce',
    name: '暴躁',
    emoji: '🔥',
    desc: '暴躁的打击更致命',
    boost: 'critRate',
    boostRate: 0.08,
    nerf: 'def',
    nerfRate: 0.05
  },
  calm: {
    id: 'calm',
    name: '冷静',
    emoji: '❄️',
    desc: '泰山崩于前而色不变',
    boost: 'dmgResist',
    boostRate: 0.08,
    nerf: 'critRate',
    nerfRate: 0.03
  },
  chaos: {
    id: 'chaos',
    name: '混沌',
    emoji: '🌀',
    desc: '均衡但平庸',
    boost: 'all',
    boostRate: 0.03,
    nerf: null,
    nerfRate: 0
  }
}

// 性格ID列表（用于随机选取）
export const NATURE_IDS = Object.keys(NATURES)

/**
 * 随机获取一个性格
 * @returns {string} 性格ID
 */
export function randomNature() {
  return NATURE_IDS[Math.floor(Math.random() * NATURE_IDS.length)]
}

/**
 * 获取性格数据
 * @param {string} natureId
 * @returns {object|null}
 */
export function getNature(natureId) {
  return NATURES[natureId] || null
}

/**
 * 计算性格对属性的修正倍率
 * @param {string} natureId - 性格ID
 * @param {string} statKey - 属性key (hp/atk/def/spd)
 * @returns {number} 修正倍率 (例如 1.10 表示+10%)
 */
export function getNatureStatMultiplier(natureId, statKey) {
  const nature = NATURES[natureId]
  if (!nature) return 1.0

  let mult = 1.0

  // 加成
  if (nature.boost === 'all' || nature.boost === statKey) {
    mult += nature.boostRate
  }

  // 减弱
  if (nature.nerf === statKey) {
    mult -= nature.nerfRate
  }

  return mult
}
