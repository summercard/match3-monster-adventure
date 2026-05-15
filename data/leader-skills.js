// ============================================
// data/leader-skills.js - 队长技能定义
// ============================================
// ★3(稀有)及以上的怪物才拥有队长技能
// 队长 = 队伍第1个槽位（index 0），被动效果持续整场战斗

export const LEADER_SKILLS = {
  // ===== 属性攻击加成：同属性宝石伤害+30% =====
  ATK_BOOST_FIRE: {
    id: 'ATK_BOOST_FIRE',
    name: '烈焰之心',
    desc: '火属性宝石伤害+30%',
    icon: '🔥',
    type: 'atk_boost',
    element: 'fire',
    multiplier: 1.3
  },
  ATK_BOOST_WATER: {
    id: 'ATK_BOOST_WATER',
    name: '潮汐之力',
    desc: '水属性宝石伤害+30%',
    icon: '💧',
    type: 'atk_boost',
    element: 'water',
    multiplier: 1.3
  },
  ATK_BOOST_GRASS: {
    id: 'ATK_BOOST_GRASS',
    name: '自然之怒',
    desc: '草属性宝石伤害+30%',
    icon: '🌿',
    type: 'atk_boost',
    element: 'grass',
    multiplier: 1.3
  },
  ATK_BOOST_THUNDER: {
    id: 'ATK_BOOST_THUNDER',
    name: '雷霆之怒',
    desc: '雷属性宝石伤害+30%',
    icon: '⚡',
    type: 'atk_boost',
    element: 'thunder',
    multiplier: 1.3
  },
  ATK_BOOST_LIGHT: {
    id: 'ATK_BOOST_LIGHT',
    name: '圣光之耀',
    desc: '光属性宝石伤害+30%',
    icon: '✨',
    type: 'atk_boost',
    element: 'light',
    multiplier: 1.3
  },
  ATK_BOOST_EARTH: {
    id: 'ATK_BOOST_EARTH',
    name: '大地之力',
    desc: '土属性宝石伤害+30%',
    icon: '⛰️',
    type: 'atk_boost',
    element: 'earth',
    multiplier: 1.3
  },
  ATK_BOOST_WIND: {
    id: 'ATK_BOOST_WIND',
    name: '疾风之刃',
    desc: '风属性宝石伤害+30%',
    icon: '🌪️',
    type: 'atk_boost',
    element: 'wind',
    multiplier: 1.3
  },
  ATK_BOOST_DARK: {
    id: 'ATK_BOOST_DARK',
    name: '暗影之力',
    desc: '暗属性宝石伤害+30%',
    icon: '🌑',
    type: 'atk_boost',
    element: 'dark',
    multiplier: 1.3
  },
  ATK_BOOST_ICE: {
    id: 'ATK_BOOST_ICE',
    name: '极寒之心',
    desc: '冰属性宝石伤害+30%',
    icon: '❄️',
    type: 'atk_boost',
    element: 'ice',
    multiplier: 1.3
  },
  ATK_BOOST_VOID: {
    id: 'ATK_BOOST_VOID',
    name: '虚空之眼',
    desc: '虚空属性宝石伤害+30%',
    icon: '🌀',
    type: 'atk_boost',
    element: 'void',
    multiplier: 1.3
  },
  ATK_BOOST_TEMPORAL: {
    id: 'ATK_BOOST_TEMPORAL',
    name: '时间撕裂',
    desc: '时空属性宝石伤害+30%',
    icon: '⏳',
    type: 'atk_boost',
    element: 'temporal',
    multiplier: 1.3
  },
  ATK_BOOST_STAR: {
    id: 'ATK_BOOST_STAR',
    name: '星耀之力',
    desc: '星耀属性宝石伤害+30%',
    icon: '💫',
    type: 'atk_boost',
    element: 'star',
    multiplier: 1.3
  },
  ATK_BOOST_CHAOS: {
    id: 'ATK_BOOST_CHAOS',
    name: '混沌之怒',
    desc: '混沌属性宝石伤害+30%',
    icon: '🌑',
    type: 'atk_boost',
    element: 'chaos',
    multiplier: 1.3
  },

  // ===== 全队防御加成：全队受到伤害-15% =====
  DEF_BOOST: {
    id: 'DEF_BOOST',
    name: '钢铁意志',
    desc: '全队受到伤害-15%',
    icon: '🛡️',
    type: 'def_boost',
    damageReduction: 0.85  // 受伤 × 0.85
  },

  // ===== 全队HP加成：全队HP+20% =====
  HP_BOOST: {
    id: 'HP_BOOST',
    name: '生命之泉',
    desc: '全队HP+20%',
    icon: '💚',
    type: 'hp_boost',
    hpMultiplier: 1.2
  },

  // ===== 初始Combo加成：战斗开始自带1层combo =====
  COMBO_START: {
    id: 'COMBO_START',
    name: '先手必胜',
    desc: '战斗开始自带1层combo',
    icon: '⚡',
    type: 'combo_start',
    initialCombo: 1
  }
}

/**
 * 获取队长技能信息
 * @param {string} skillId - 技能ID
 * @returns {object|null} 技能数据
 */
export function getLeaderSkill(skillId) {
  return LEADER_SKILLS[skillId] || null
}

/**
 * 计算队长技能对属性伤害的加成倍率
 * @param {object} leaderSkill - 队长技能数据
 * @param {string} element - 攻击属性
 * @returns {number} 倍率 (1.0 = 无加成)
 */
export function getLeaderAtkBoost(leaderSkill, element) {
  if (!leaderSkill) return 1.0
  if (leaderSkill.type === 'atk_boost' && leaderSkill.element === element) {
    return leaderSkill.multiplier
  }
  return 1.0
}

/**
 * 计算队长技能对受伤的减免
 * @param {object} leaderSkill - 队长技能数据
 * @returns {number} 倍率 (1.0 = 无减免, 0.85 = -15%)
 */
export function getLeaderDefBoost(leaderSkill) {
  if (!leaderSkill) return 1.0
  if (leaderSkill.type === 'def_boost') {
    return leaderSkill.damageReduction
  }
  return 1.0
}

/**
 * 计算队长技能对HP的加成
 * @param {object} leaderSkill - 队长技能数据
 * @returns {number} 倍率 (1.0 = 无加成, 1.2 = +20%)
 */
export function getLeaderHPBoost(leaderSkill) {
  if (!leaderSkill) return 1.0
  if (leaderSkill.type === 'hp_boost') {
    return leaderSkill.hpMultiplier
  }
  return 1.0
}

/**
 * 获取队长技能的初始combo加成
 * @param {object} leaderSkill - 队长技能数据
 * @returns {number} 额外combo数
 */
export function getLeaderComboStart(leaderSkill) {
  if (!leaderSkill) return 0
  if (leaderSkill.type === 'combo_start') {
    return leaderSkill.initialCombo
  }
  return 0
}
