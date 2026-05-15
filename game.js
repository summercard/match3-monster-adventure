// ============================================
// game.js - 三消宝可梦 游戏入口
// ============================================

import { GameManager } from './js/core/gameManager.js'

// 创建游戏管理器并启动
const game = new GameManager()
game.init()
game.run()

// 导出给微信小游戏环境
export default game
