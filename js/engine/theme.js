// ============================================
// engine/theme.js - 游戏主题常量
// 统一管理所有颜色、字体、间距、组件风格
// ============================================

export const THEME = {
  // === 色彩系统 ===
  colors: {
    // 主色系
    primary:      '#2979ff',
    primaryDark:  '#1565c0',
    primaryLight: '#64b5f6',

    // 背景色系
    bgDark:       '#0a0a1a',
    bgMedium:     '#1a1a2e',
    bgCard:       '#16213e',
    bgPanel:      '#1a1a2e',

    // 文字色系
    textPrimary:  '#ffffff',
    textSecondary:'#cccccc',
    textMuted:    '#888888',
    textDark:     '#555555',

    // 属性色
    fire:         '#ff6b35',
    water:        '#4fc3f7',
    grass:        '#66bb6a',
    thunder:      '#ffd54f',
    light:        '#e0e0e0',

    // 状态色
    success:      '#4caf50',
    warning:      '#ff9800',
    danger:       '#f44336',
    gold:         '#ffd700',

    // 特效色
    white:        '#ffffff',
    black:        '#000000',
    transparent:  'rgba(0,0,0,0)',

    // 战斗场景专用色
    battle: {
      boardBg:       '#0f3460',    // 棋盘背景深蓝
      enemyTurnBar:  '#4a1a1a',    // 敌方回合底部栏
      hpBarBg:       '#333333',    // HP条背景
      skillChargeBg: '#222222',    // 技能充能条背景
      enemyHpText:   '#ffaaaa',    // 敌方HP文字
      playerHpText:  '#aaffaa',    // 我方HP文字
      chargedAttack: '#ff4444',    // 蓄力攻击伤害色
      flashHpBar:    '#ff0000',    // 受击闪烁血条色
      flashHitBar:   '#ffff00',    // 我方受击闪烁血条色
      healGreen:     '#00ff88',    // 回血飘字色
      bossBg:        '#3d1a1a',    // Boss卡片背景色
    },

    // 状态效果色（灼烧/冰冻/中毒/眩晕）
    statusEffect: {
      burn:   '#ff6622',
      freeze: '#66ccff',
      poison: '#44dd44',
      stun:   '#ffdd00',
    },

    // Boss护盾色
    shield:       '#50b4ff',

    // 障碍物/锁定色
    obstacle: {
      rock:         '#5a5a6e',   // 石块底色
      rockSolid:    '#6e6e82',   // 完好石块色
      rockCracked:  '#4a4a5e',   // 裂纹石块色
      crackLine:    '#2a2a3e',   // 裂纹线条色
    },
    lock: {
      chain:        '#8888aa',   // 锁链色
      chainWeak:    '#7777aa',   // 低HP锁链色
    },

    // 精英关卡专用色
    elite: '#8B6914',         // 精英关卡卡片背景（深金）
    eliteText: '#4a3000',     // 精英标签文字（深褐）

    // 结算页专用色
    dangerLight: '#ffaaaa',   // 淡红色（击败敌人文字）
    primarySoft: '#aaaaff',   // 淡蓝色（存活敌人文字）

    // 毒雾清除文字色
    poisonFogClear: '#88ff88',

    // 属性数值色（HP/ATK/DEF/SPD 语义色）
    statHp:  '#ff6b6b',
    statAtk: '#ffa94d',
    statDef: '#69db7c',
    statSpd: '#74c0fc',

    // 签到场景
    signIn: {
      particleColors: ['#FFA500', '#FFFF00', '#FFE135'],  // 签到粒子特效色（除gold外）
    },

    // 进化相关
    evolveBg:     '#6a2d8a',
    evolveReady:  '#2d7a2d',

    // 队伍编成
    inTeamBg:     '#1f4068',
    slotBorder:   '#3a3a5a',
    dialogBg:     '#2a2a4a',
    disabledBg:   '#333333',
  },

  // === 字体规范 ===
  // 调用方式：renderer.fillText(text, x, y, THEME.colors.textPrimary, THEME.font.size.title, 'bold')
  font: {
    title:    { size: 24, weight: 'bold' },
    subtitle: { size: 18, weight: 'bold' },
    body:     { size: 14, weight: 'normal' },
    small:    { size: 12, weight: 'normal' },
    tiny:     { size: 11, weight: 'normal' },
    number:   { size: 16, weight: 'bold' },
    bigNum:   { size: 20, weight: 'bold' },
    display:  { size: 36, weight: 'normal' },  // 大号 emoji 图标
    icon:     { size: 28, weight: 'normal' },  // 中号 emoji / 头像图标
  },

  // === 圆角半径 ===
  radius: {
    sm:  6,
    md: 10,
    lg: 16,
    xl: 20,
  },

  // === 间距 ===
  spacing: {
    xs:  4,
    sm:  8,
    md: 16,
    lg: 24,
    xl: 32,
  },

  // === 按钮样式预设 ===
  buttons: {
    primary: {
      bgColor:   '#2979ff',
      textColor: '#ffffff',
      fontSize:  16,
      fontWeight:'bold',
      radius:    10,
      pressScale:0.95,
    },
    secondary: {
      bgColor:   '#16213e',
      textColor: '#ffffff',
      fontSize:  14,
      fontWeight:'normal',
      radius:    8,
      pressScale:0.95,
    },
    danger: {
      bgColor:   '#f44336',
      textColor: '#ffffff',
      fontSize:  14,
      fontWeight:'normal',
      radius:    8,
      pressScale:0.95,
    },
  },

  // === 动画时长 (秒) ===
  anim: {
    fast:    0.1,
    normal:  0.3,
    slow:    0.5,
    verySlow:0.8,
  },

  // === 属性色映射（用于图标等） ===
  elementColors: {
    fire:    '#ff6b35',
    water:   '#4fc3f7',
    grass:   '#66bb6a',
    thunder: '#ffd54f',
    light:   '#e0e0e0',
    earth:   '#a0522d',
    wind:    '#20b2aa',
    dark:    '#7c3aed',
  },
}

// 便捷访问
export const COLORS = THEME.colors
export const FONT   = THEME.font

// 兼容旧调用：部分已实现界面仍读取 THEME.primary 或 THEME.colors.elementColors。
THEME.primary = THEME.colors.primary
THEME.success = THEME.colors.success
THEME.warning = THEME.colors.warning
THEME.danger = THEME.colors.danger
THEME.gold = THEME.colors.gold
THEME.colors.elementColors = THEME.elementColors
