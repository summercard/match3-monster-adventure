// ============================================
// ui/sceneTutorial.js - 新手引导场景
// ============================================
import { FONT } from '../engine/theme.js'

export class SceneTutorial {
  constructor(game, data) {
    this.game = game
    this.currentStep = 0
    this.totalSteps = 5
    this.opacity = 0
    this.ready = false
    this.tapCallback = this._onTap.bind(this)

    // 引导步骤内容
    this.steps = [
      {
        // 步骤1：游戏介绍
        title: '欢迎来到三消宝可梦',
        content: '一款融合三消玩法的宝可梦冒险游戏！\n通过消除宝石来攻击野生怪物，\n收服它们成为你的伙伴！',
        icon: '🎮',
        hint: ''
      },
      {
        // 步骤2：棋盘操作
        title: '滑动消除宝石',
        content: '在8x8的棋盘上滑动手指，\n将3个或以上相同的宝石连成一线即可消除。\n消除越多，伤害越大！',
        icon: '👆',
        hint: '示例：左右滑动或上下滑动'
      },
      {
        // 步骤3：战斗目标
        title: '击败野生怪物',
        content: '每次消除宝石都会对敌方怪物造成伤害。\n合理规划消除顺序，\n将怪物血量降为零即可获胜！',
        icon: '⚔️',
        hint: ''
      },
      {
        // 步骤4：收服机制
        title: '收服你的伙伴',
        content: '战斗胜利后有几率收服怪物！\n使用【精灵球】可以提高收服成功率。\n组建强力队伍挑战更强关卡！',
        icon: '🪨',
        hint: ''
      },
      {
        // 步骤5：队伍编成
        title: '组建你的队伍',
        content: '在【队伍编成】中放置至少1只怪物，\n才能开始战斗。\n合理搭配属性克制，让战斗更轻松！',
        icon: '👥',
        hint: ''
      }
    ]
  }

  init(data) {
    console.log('[SceneTutorial] 新手引导初始化')
    // 恢复保存的进度
    const progress = this.game.storage.loadTutorialProgress()
    if (progress.completed && progress.currentStep > 0) {
      // 从上次的步骤继续（但最多从步骤3开始，避免跳过太多）
      this.currentStep = Math.min(progress.currentStep, this.totalSteps - 2)
    } else {
      this.currentStep = 0
    }

    this.game.input.onTap = this.tapCallback
    this.game.input.onSwipe = this.tapCallback
  }

  _onTap(x, y) {
    if (!this.ready) return

    const w = this.game.renderer.designWidth
    const h = this.game.renderer.designHeight

    // 跳过按钮区域（左上角）
    const skipX = w * 0.08, skipY = h * 0.05
    const skipW = 80, skipH = 36
    if (x >= skipX && x <= skipX + skipW && y >= skipY && y <= skipY + skipH) {
      this._skipTutorial()
      return
    }

    // 下一步按钮区域（底部中央）
    const btnW = 200, btnH = 56
    const btnX = (w - btnW) / 2
    const btnY = h * 0.78

    if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
      this._nextStep()
    }
  }

  _nextStep() {
    this.currentStep++

    if (this.currentStep >= this.totalSteps) {
      // 引导完成
      this._completeTutorial()
    } else {
      // 播放步骤切换动画（简单淡出淡入）
      this.opacity = 0
      this.game.storage.saveTutorialProgress(this.currentStep)
    }
  }

  _skipTutorial() {
    console.log('[SceneTutorial] 跳过引导')
    this._completeTutorial()
  }

  _completeTutorial() {
    // 标记引导完成
    this.game.storage.saveTutorialProgress(this.totalSteps)

    // 淡出后进入主菜单
    this.opacity = 0
    this.ready = false
    this.game.storage.saveTutorialProgress(this.totalSteps)

    // 延迟进入主菜单
    setTimeout(() => {
      this.game.sceneManager.changeScene('main')
    }, 500)
  }

  update(dt) {
    // 淡入动画
    if (this.opacity < 1) {
      this.opacity += dt * 2
      if (this.opacity >= 1) {
        this.opacity = 1
        this.ready = true
      }
    }
  }

  render(r) {
    const w = r.designWidth
    const h = r.designHeight
    const a = this.opacity
    const step = this.steps[this.currentStep]

    // 半透明黑色背景
    r.fillRect(0, 0, w, h, 'rgba(0,0,0,0.85)')

    // 跳过按钮
    const skipX = w * 0.08, skipY = h * 0.05
    const skipW = 80, skipH = 36
    r.fillRoundRect(skipX, skipY, skipW, skipH, 8, 'rgba(255,255,255,0.1)')
    r.fillText('跳过', skipX + skipW / 2, skipY + skipH / 2 + 2, 'rgba(255,255,255,0.6)', FONT.body.size)

    // 进度点
    const dotY = h * 0.12
    const dotSpacing = 28
    const startX = w / 2 - ((this.totalSteps - 1) * dotSpacing) / 2

    for (let i = 0; i < this.totalSteps; i++) {
      const dx = startX + i * dotSpacing
      const isActive = i === this.currentStep
      r.fillCircle(dx, dotY, isActive ? 8 : 5, isActive ? '#ffffff' : 'rgba(255,255,255,0.3)')
    }

    // 步骤指示文字
    r.fillText(`${this.currentStep + 1} / ${this.totalSteps}`, w / 2, h * 0.18, 'rgba(255,255,255,0.5)', FONT.small.size)

    // 大图标
    r.fillText(step.icon, w / 2, h * 0.32, 'rgba(255,255,255,' + a + ')', 64)

    // 步骤标题
    r.fillText(step.title, w / 2, h * 0.44, `rgba(255,255,255,${a})`, FONT.title.size, 'bold')

    // 内容说明（多行居中）
    const lines = step.content.split('\n')
    let lineY = h * 0.52
    for (const line of lines) {
      r.fillText(line, w / 2, lineY, `rgba(200,200,220,${a})`, FONT.body.size)
      lineY += 28
    }

    // 手势提示（如果有）
    if (step.hint) {
      r.fillText(step.hint, w / 2, h * 0.66, 'rgba(150,150,180,0.6)', FONT.small.size)
    }

    // 手势示意图（步骤2显示滑动示意）
    if (this.currentStep === 1) {
      // 棋盘示意
      const gridSize = 40
      const gridX = w / 2 - gridSize * 2
      const gridY = h * 0.72 - gridSize * 0.5

      // 绘制简化棋盘
      const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6']
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const colorIdx = (row + col) % colors.length
          r.fillRoundRect(
            gridX + col * gridSize + 2,
            gridY + row * gridSize + 2,
            gridSize - 4,
            gridSize - 4,
            6,
            colors[colorIdx]
          )
        }
      }

      // 滑动箭头
      r.fillText('⟷', w / 2, h * 0.72 + gridSize * 1.8, 'rgba(255,255,255,0.5)', FONT.title.size)
    }

    // 下一步按钮
    if (this.ready) {
      const btnW = 200, btnH = 56
      const btnX = (w - btnW) / 2
      const btnY = h * 0.78

      // 按钮发光
      r.fillRoundRect(btnX - 3, btnY - 3, btnW + 6, btnH + 6, 16, 'rgba(100,180,255,0.3)')

      // 按钮主体
      const isLast = this.currentStep === this.totalSteps - 1
      r.fillRoundRect(btnX, btnY, btnW, btnH, 12, isLast ? '#4caf50' : '#2979ff')

      // 按钮文字
      const btnText = isLast ? '开始冒险' : '下一步'
      r.fillText(btnText, btnX + btnW / 2, btnY + btnH / 2 + 2, '#ffffff', FONT.subtitle.size, 'bold')
    }
  }

  destroy() {
    this.game.input.onTap = null
    this.game.input.onSwipe = null
  }
}