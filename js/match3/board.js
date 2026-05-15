// ============================================
// match3/board.js - 三消棋盘核心
// ============================================

export const GEM_TYPES = ['fire', 'water', 'grass', 'thunder', 'light']

export const GEM_COLORS = {
  fire:     '#ff4444',
  water:    '#4488ff',
  grass:    '#44bb44',
  thunder:  '#ffaa00',
  light:    '#dd44ff'
}

export const GEM_EMOJI = {
  fire:     '🔥',
  water:    '💧',
  grass:    '🌿',
  thunder:  '⚡',
  light:    '✨'
}

// 强化宝石类型标识（4连消产生）
export const ENHANCED_GEM = 'enhanced'

// 炸弹宝石类型标识（L/T形消除产生）
export const BOMB_GEM = 'bomb'

export class Board {
  constructor(rows = 8, cols = 8) {
    this.rows = rows
    this.cols = cols
    this.grid = []       // grid[row][col] = gem type string or null
    this.obstacles = []  // obstacles[row][col] = null or { type: 'rock', hp: 2 }
    this.cellSize = 40   // 每个格子的设计像素尺寸
    this.offsetX = 7     // 棋盘左上角X
    this.offsetY = 230   // 棋盘左上角Y
    this.locked = false
    this.cascadeCount = 0 // 连锁次数

    // 锁定宝石：lockedGems[row][col] = null | { hp: 1|2 }
    // 被锁的宝石不可移动/交换，但可参与消除
    // 消除相邻同色宝石可触发解锁
    this.lockedGems = []

    // 毒雾格子：poisonFog[row][col] = null | { active: true, turnsSinceSpread: 0 }
    // 毒雾格子上的宝石可正常参与消除，但每回合造成伤害
    // 消除经过毒雾格子可清除毒雾
    this.poisonFog = []
    this.poisonFogSpreadInterval = 3 // 默认扩散间隔（回合数）

    this._initObstacles()
    this._initLockedGems()
    this._initPoisonFog()
    this._init()
  }

  // 初始化障碍物数组（全部为null）
  _initObstacles() {
    this.obstacles = []
    for (let r = 0; r < this.rows; r++) {
      this.obstacles[r] = []
      for (let c = 0; c < this.cols; c++) {
        this.obstacles[r][c] = null
      }
    }
  }

  // 初始化锁定宝石数组（全部为null）
  _initLockedGems() {
    this.lockedGems = []
    for (let r = 0; r < this.rows; r++) {
      this.lockedGems[r] = []
      for (let c = 0; c < this.cols; c++) {
        this.lockedGems[r][c] = null
      }
    }
  }

  // 初始化毒雾数组（全部为null）
  _initPoisonFog() {
    this.poisonFog = []
    for (let r = 0; r < this.rows; r++) {
      this.poisonFog[r] = []
      for (let c = 0; c < this.cols; c++) {
        this.poisonFog[r][c] = null
      }
    }
  }

  // 设置毒雾布局（从关卡配置读取）
  // config: { tiles: [{ row, col }], spreadInterval?: number } or null
  setPoisonFog(config) {
    this._initPoisonFog()
    if (!config || !Array.isArray(config.tiles)) return
    if (config.spreadInterval) {
      this.poisonFogSpreadInterval = config.spreadInterval
    }
    config.tiles.forEach(t => {
      if (t.row >= 0 && t.row < this.rows && t.col >= 0 && t.col < this.cols) {
        // 不在障碍物格子上放毒雾
        if (!this.isObstacle(t.row, t.col)) {
          this.poisonFog[t.row][t.col] = { active: true, turnsSinceSpread: 0 }
        }
      }
    })
  }

  // 检查某个格子是否有毒雾
  isPoisonFog(row, col) {
    return this.poisonFog[row] && this.poisonFog[row][col] != null && this.poisonFog[row][col].active
  }

  // 清除某个格子的毒雾（消除宝石时调用）
  clearPoisonFog(row, col) {
    if (!this.isPoisonFog(row, col)) return false
    this.poisonFog[row][col] = null
    return true
  }

  // 扩散毒雾（每N回合调用一次）
  // 返回新扩散的格子列表 [{ row, col }]
  spreadPoisonFog() {
    const newTiles = []
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]]

    // 收集所有当前有毒雾的格子
    const activeFogTiles = []
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.isPoisonFog(r, c)) {
          activeFogTiles.push({ row: r, col: c })
        }
      }
    }

    // 从每个毒雾格子尝试向随机1-2个方向扩散
    activeFogTiles.forEach(tile => {
      // 递增回合计数
      this.poisonFog[tile.row][tile.col].turnsSinceSpread++

      // 检查是否到达扩散间隔
      if (this.poisonFog[tile.row][tile.col].turnsSinceSpread < this.poisonFogSpreadInterval) return

      // 重置计数
      this.poisonFog[tile.row][tile.col].turnsSinceSpread = 0

      // 随机选1-2个方向扩散
      const shuffled = dirs.slice().sort(() => Math.random() - 0.5)
      const spreadCount = Math.random() < 0.5 ? 1 : 2

      for (let i = 0; i < Math.min(spreadCount, shuffled.length); i++) {
        const [dr, dc] = shuffled[i]
        const nr = tile.row + dr
        const nc = tile.col + dc
        if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue
        if (this.isObstacle(nr, nc)) continue
        if (this.isPoisonFog(nr, nc)) continue // 已有毒雾不重复

        this.poisonFog[nr][nc] = { active: true, turnsSinceSpread: 0 }
        newTiles.push({ row: nr, col: nc })
      }
    })

    return newTiles
  }

  // 获取当前回合毒雾伤害格子数（毒雾覆盖且有宝石的格子数）
  getPoisonFogDamageCount() {
    let count = 0
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.isPoisonFog(r, c) && this.grid[r][c] !== null) {
          count++
        }
      }
    }
    return count
  }

  // 设置锁定宝石布局（从关卡配置读取）
  // layout: [{ row, col, hp: 1|2 }] or null
  setLockedGems(layout) {
    this._initLockedGems()
    if (!layout || !Array.isArray(layout)) return
    layout.forEach(lk => {
      if (lk.row >= 0 && lk.row < this.rows && lk.col >= 0 && lk.col < this.cols) {
        // 只对有宝石的格子设置锁定
        this.lockedGems[lk.row][lk.col] = { hp: lk.hp || 1 }
      }
    })
  }

  // 检查某个格子是否被锁定
  isLocked(row, col) {
    return this.lockedGems[row] && this.lockedGems[row][col] != null && this.lockedGems[row][col].hp > 0
  }

  // 对锁定宝石减少1点锁链HP，返回解锁信息
  unlockGem(row, col) {
    if (!this.isLocked(row, col)) return null
    const lock = this.lockedGems[row][col]
    lock.hp--
    if (lock.hp <= 0) {
      this.lockedGems[row][col] = null
      return { row, col, fullyUnlocked: true }
    }
    return { row, col, fullyUnlocked: false, remainingHP: lock.hp }
  }

  // 消除宝石后，检查相邻锁定宝石是否同色，同色则触发解锁
  // 返回 [{ row, col, fullyUnlocked, remainingHP? }]
  checkAdjacentUnlocks(row, col, gemType) {
    const unlockResults = []
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]]
    dirs.forEach(([dr, dc]) => {
      const nr = row + dr
      const nc = col + dc
      if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) return
      if (!this.isLocked(nr, nc)) return
      // 检查锁定宝石是否与消除宝石同色
      if (this.grid[nr][nc] === gemType) {
        const result = this.unlockGem(nr, nc)
        if (result) {
          unlockResults.push(result)
        }
      }
    })
    return unlockResults
  }

  // 设置障碍物布局（从关卡配置读取）
  // layout: [{ row, col, type: 'rock', hp?: 2 }] or null
  setObstacles(layout) {
    this._initObstacles()
    if (!layout || !Array.isArray(layout)) return
    layout.forEach(ob => {
      if (ob.row >= 0 && ob.row < this.rows && ob.col >= 0 && ob.col < this.cols) {
        this.obstacles[ob.row][ob.col] = {
          type: ob.type || 'rock',
          hp: ob.hp || 2
        }
      }
    })
  }

  // 检查某个格子是否有障碍物
  isObstacle(row, col) {
    return this.obstacles[row] && this.obstacles[row][col] != null
  }

  // 对障碍物造成1点伤害，返回是否被破坏
  damageObstacle(row, col) {
    if (!this.isObstacle(row, col)) return false
    const ob = this.obstacles[row][col]
    ob.hp--
    if (ob.hp <= 0) {
      this.obstacles[row][col] = null
      return true // 被破坏
    }
    return false
  }

  // 消除宝石后，对相邻障碍物造成伤害
  _damageAdjacentObstacles(row, col) {
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]]
    const destroyed = []
    dirs.forEach(([dr, dc]) => {
      const nr = row + dr
      const nc = col + dc
      if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && this.isObstacle(nr, nc)) {
        const destroyed = this.damageObstacle(nr, nc)
        if (destroyed) {
          // 障碍物被破坏后，格子变为空位，宝石可以填充
        }
      }
    })
    return destroyed
  }

  _init() {
    // 生成初始棋盘，确保没有初始匹配
    // 障碍物格子不放宝石
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = []
      for (let c = 0; c < this.cols; c++) {
        if (this.isObstacle(r, c)) {
          this.grid[r][c] = null
          continue
        }
        let type
        do {
          type = GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)]
        } while (this._wouldMatch(r, c, type))
        this.grid[r][c] = type
      }
    }
  }

  // 公开的棋盘重置入口：保留当前障碍/锁链/毒雾布局，只重新生成宝石。
  initBoard() {
    this.grid = []
    this.cascadeCount = 0
    this._init()
  }

  // 检查放置type在(r,c)是否会立即形成匹配
  _wouldMatch(row, col, type) {
    // 横向检查：左边2个相同（跳过障碍物格子）
    if (col >= 2 &&
      !this.isObstacle(row, col - 1) &&
      !this.isObstacle(row, col - 2) &&
      this.grid[row][col - 1] === type &&
      this.grid[row][col - 2] === type) {
      return true
    }
    // 纵向检查：上面2个相同（跳过障碍物格子）
    if (row >= 2 &&
      this.grid[row - 1] &&
      this.grid[row - 2] &&
      !this.isObstacle(row - 1, col) &&
      !this.isObstacle(row - 2, col) &&
      this.grid[row - 1][col] === type &&
      this.grid[row - 2][col] === type) {
      return true
    }
    return false
  }

  // 将屏幕坐标转换为棋盘格子坐标
  screenToGrid(x, y) {
    const col = Math.floor((x - this.offsetX) / this.cellSize)
    const row = Math.floor((y - this.offsetY) / this.cellSize)
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      return { row, col }
    }
    return null
  }

  // 尝试交换两个相邻格子
  swap(r1, c1, r2, c2) {
    // 检查是否相邻
    const dr = Math.abs(r1 - r2)
    const dc = Math.abs(c1 - c2)
    if (dr + dc !== 1) return false

    // 检查是否有障碍物（任一格子有障碍物则拒绝交换）
    if (this.isObstacle(r1, c1) || this.isObstacle(r2, c2)) return false

    // 检查是否有锁定宝石（任一格子被锁定则拒绝交换）
    if (this.isLocked(r1, c1) || this.isLocked(r2, c2)) return false

    // 交换
    const temp = this.grid[r1][c1]
    this.grid[r1][c1] = this.grid[r2][c2]
    this.grid[r2][c2] = temp

    return true
  }

  // 查找所有匹配
  // 返回 { gems, enhanced, rainbow, bomb }
  // enhanced: 4连（十字爆炸），rainbow: 5+连（全屏同色），bomb: L/T形（3×3炸弹）
  // 优先级：5连(彩虹) > L/T形(炸弹) > 4连(十字) > 3连(普通)
  findMatches() {
    const matches = new Set() // 存储 "row,col" 字符串
    const enhancedMatches = [] // 恰好4连的匹配组
    const rainbowMatches = [] // 5连及以上的匹配组（彩虹消除）
    const bombMatches = []    // L/T形匹配组（炸弹爆炸）

    // ===== 第一阶段：收集横向匹配分组 =====
    const hGroups = []
    for (let r = 0; r < this.rows; r++) {
      let c = 0
      while (c < this.cols - 2) {
        const type = this.grid[r][c]
        if (!type || this.isObstacle(r, c)) { c++; continue }
        if (this.grid[r][c + 1] === type && this.grid[r][c + 2] === type) {
          let end = c + 2
          while (end + 1 < this.cols && this.grid[r][end + 1] === type) end++
          const length = end - c + 1
          const cells = []
          for (let i = c; i <= end; i++) cells.push({ row: r, col: i })
          hGroups.push({ type, cells, length })
          for (let i = c; i <= end; i++) matches.add(`${r},${i}`)
          c = end + 1
        } else {
          c++
        }
      }
    }

    // ===== 第二阶段：收集纵向匹配分组 =====
    const vGroups = []
    for (let c = 0; c < this.cols; c++) {
      let r = 0
      while (r < this.rows - 2) {
        const type = this.grid[r][c]
        if (!type || this.isObstacle(r, c)) { r++; continue }
        if (this.grid[r + 1][c] === type && this.grid[r + 2][c] === type) {
          let end = r + 2
          while (end + 1 < this.rows && this.grid[end + 1][c] === type) end++
          const length = end - r + 1
          const cells = []
          for (let i = r; i <= end; i++) cells.push({ row: i, col: c })
          vGroups.push({ type, cells, length })
          for (let i = r; i <= end; i++) matches.add(`${i},${c}`)
          r = end + 1
        } else {
          r++
        }
      }
    }

    // ===== 第三阶段：分类 —— 5连→彩虹，4连→强化 =====
    for (const g of hGroups) {
      if (g.length >= 5) {
        rainbowMatches.push({ type: g.type, direction: 'horizontal', length: g.length, matchCells: g.cells })
      } else if (g.length >= 4) {
        const midCol = Math.floor((g.cells[0].col + g.cells[g.cells.length - 1].col) / 2)
        enhancedMatches.push({
          row: g.cells[0].row, col: midCol, type: g.type, direction: 'horizontal', length: g.length, allCells: g.cells
        })
      }
    }
    for (const g of vGroups) {
      if (g.length >= 5) {
        rainbowMatches.push({ type: g.type, direction: 'vertical', length: g.length, matchCells: g.cells })
      } else if (g.length >= 4) {
        const midRow = Math.floor((g.cells[0].row + g.cells[g.cells.length - 1].row) / 2)
        enhancedMatches.push({
          row: midRow, col: g.cells[0].col, type: g.type, direction: 'vertical', length: g.length, allCells: g.cells
        })
      }
    }

    // ===== 第四阶段：L/T形检测 —— 3连横+3连纵交叉同色 =====
    const h3 = hGroups.filter(g => g.length === 3)
    const v3 = vGroups.filter(g => g.length === 3)
    for (const hg of h3) {
      for (const vg of v3) {
        if (hg.type !== vg.type) continue
        // 找交叉点
        const hSet = new Set(hg.cells.map(c => `${c.row},${c.col}`))
        const intersection = vg.cells.find(vc => hSet.has(`${vc.row},${vc.col}`))
        if (!intersection) continue
        // 判断 L形 或 T形
        const hIdx = hg.cells.findIndex(c => c.row === intersection.row && c.col === intersection.col)
        const vIdx = vg.cells.findIndex(c => c.row === intersection.row && c.col === intersection.col)
        // L形：交叉点在横纵两臂的端点（index 0 或 2）
        // T形：交叉点在其中一臂的端点、另一臂的中间（index 1）
        let shape
        if ((hIdx === 0 || hIdx === 2) && (vIdx === 0 || vIdx === 2)) {
          shape = 'L'
        } else {
          shape = 'T'
        }
        // 合并所有格子（去重）
        const allCells = [...hg.cells]
        for (const vc of vg.cells) {
          if (!hSet.has(`${vc.row},${vc.col}`)) allCells.push(vc)
        }
        bombMatches.push({
          row: intersection.row,
          col: intersection.col,
          type: hg.type,
          shape,
          matchCells: allCells
        })
      }
    }

    // ===== 转换为统一结果 =====
    const result = []
    matches.forEach(key => {
      const [r, c] = key.split(',').map(Number)
      result.push({ row: r, col: c, type: this.grid[r][c] })
    })

    return { gems: result, enhanced: enhancedMatches, rainbow: rainbowMatches, bomb: bombMatches }
  }

  // 兼容旧调用：返回纯宝石数组
  findMatchesFlat() {
    return this.findMatches().gems
  }

  // 计算十字爆炸范围（以强化宝石为中心，上下左右各延伸到边界或2格，共5格核心）
  // 返回 [{ row, col, type }] 会被十字爆炸波及的格子（不含强化宝石本身）
  getCrossExplosionPositions(centerRow, centerCol) {
    const positions = []
    const offsets = [
      [-2, 0], [-1, 0], [1, 0], [2, 0],  // 上下
      [0, -2], [0, -1], [0, 1], [0, 2]   // 左右
    ]
    for (const [dr, dc] of offsets) {
      const nr = centerRow + dr
      const nc = centerCol + dc
      if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
        // 跳过障碍物格子
        if (this.isObstacle(nr, nc)) continue
        const type = this.grid[nr][nc]
        if (type) {
          positions.push({ row: nr, col: nc, type })
        }
      }
    }
    return positions
  }

  // 计算3×3炸弹爆炸范围（以炸弹宝石为中心，不含中心点本身）
  // 返回 [{ row, col, type }] 会被炸弹波及的格子
  // 同时伤害范围内的障碍物
  getBombExplosionPositions(centerRow, centerCol) {
    const positions = []
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue // 中心点由普通消除处理
        const nr = centerRow + dr
        const nc = centerCol + dc
        if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
          if (this.isObstacle(nr, nc)) {
            // 炸弹爆炸伤害范围内障碍物
            this.damageObstacle(nr, nc)
            continue
          }
          const type = this.grid[nr][nc]
          if (type) {
            positions.push({ row: nr, col: nc, type })
          }
        }
      }
    }
    return positions
  }

  // 获取棋盘上所有指定类型宝石的位置（用于彩虹消除）
  // excludeSet: Set of "row,col" 字符串，这些位置的宝石已在普通消除中移除，不再重复
  getRainbowPositions(matchType, excludeSet) {
    const positions = []
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === matchType && !excludeSet.has(`${r},${c}`)) {
          positions.push({ row: r, col: c, type: matchType })
        }
      }
    }
    return positions
  }

  // 消除匹配的宝石，返回按类型统计的消除数
  removeMatches(matches) {
    const counts = {}
    matches.forEach(m => {
      if (!counts[m.type]) counts[m.type] = 0
      counts[m.type]++
      this.grid[m.row][m.col] = null
      // 消除宝石时对相邻障碍物造成1点伤害
      this._damageAdjacentObstacles(m.row, m.col)
    })
    return counts
  }

  // 消除十字爆炸波及的格子（设置grid为null），返回按类型统计
  removeExplosionGems(positions) {
    const counts = {}
    positions.forEach(p => {
      if (this.grid[p.row][p.col] === null) return
      const type = this.grid[p.row][p.col]
      if (!counts[type]) counts[type] = 0
      counts[type]++
      this.grid[p.row][p.col] = null
      // 爆炸也对相邻障碍物造成伤害
      this._damageAdjacentObstacles(p.row, p.col)
    })
    return counts
  }

  // 重力下落 + 填充新宝石
  applyGravity() {
    const movements = [] // 记录移动信息，用于动画

    for (let c = 0; c < this.cols; c++) {
      // 从底部向上扫描，收集非空且非障碍物的宝石
      // 障碍物是不可移动的，宝石不能穿过障碍物
      // 锁定宝石也是不可移动的，宝石不能穿过锁定宝石
      // 策略：将每列按障碍物/锁定宝石分段，每段内宝石独立下沉

      let writePos = this.rows - 1

      // 从底部向上扫描
      for (let r = this.rows - 1; r >= 0; r--) {
        if (this.isObstacle(r, c) || this.isLocked(r, c)) {
          // 障碍物/锁定宝石格子：宝石不能落到这里或穿过
          // writePos 重置到上方
          writePos = r - 1
          continue
        }
        if (this.grid[r][c] !== null) {
          if (r !== writePos) {
            this.grid[writePos][c] = this.grid[r][c]
            this.grid[r][c] = null
            movements.push({
              type: this.grid[writePos][c],
              fromRow: r,
              toRow: writePos,
              col: c
            })
          }
          writePos--
        }
      }

      // 顶部空位填充新宝石（障碍物/锁定宝石格子不填充）
      for (let r = writePos; r >= 0; r--) {
        if (this.isObstacle(r, c) || this.isLocked(r, c)) continue
        const newType = GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)]
        this.grid[r][c] = newType
        movements.push({
          type: newType,
          fromRow: r - (writePos + 1), // 从上方落入
          toRow: r,
          col: c,
          isNew: true
        })
      }
    }

    return movements
  }

  // 检查棋盘是否有可用移动（死局检测）
  hasValidMoves() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        // 跳过障碍物格子、空格子和锁定宝石
        if (this.isObstacle(r, c) || !this.grid[r][c] || this.isLocked(r, c)) continue

        // 尝试向右交换（目标格子也不能是锁定的）
        if (c + 1 < this.cols && !this.isObstacle(r, c + 1) && !this.isLocked(r, c + 1)) {
          this.swap(r, c, r, c + 1)
          if (this.findMatches().gems.length > 0) {
            this.swap(r, c, r, c + 1) // 换回来
            return true
          }
          this.swap(r, c, r, c + 1)
        }
        // 尝试向下交换（目标格子也不能是锁定的）
        if (r + 1 < this.rows && !this.isObstacle(r + 1, c) && !this.isLocked(r + 1, c)) {
          this.swap(r, c, r + 1, c)
          if (this.findMatches().gems.length > 0) {
            this.swap(r, c, r + 1, c)
            return true
          }
          this.swap(r, c, r + 1, c)
        }
      }
    }
    return false
  }

  // 重新洗牌
  shuffle() {
    const types = []
    const positions = [] // 记录非障碍物且非锁定的格子位置
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.isObstacle(r, c) && !this.isLocked(r, c) && this.grid[r][c]) {
          types.push(this.grid[r][c])
          positions.push({ r, c })
        }
      }
    }
    // Fisher-Yates洗牌
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[types[i], types[j]] = [types[j], types[i]]
    }
    // 重新放置（只放到非障碍物且非锁定的格子）
    for (let i = 0; i < positions.length; i++) {
      this.grid[positions[i].r][positions[i].c] = types[i]
    }
    // 如果洗牌后有匹配，先消除
    // 如果还是死局，再洗一次
    if (!this.hasValidMoves()) this.shuffle()
  }
}
