// ============================================
// engine/scene.js - 场景管理器
// ============================================

import { SceneStart } from '../ui/sceneStart.js'
import { SceneBattle } from '../ui/sceneBattle.js'
import { SceneMain } from '../ui/sceneMain.js'
import { SceneResult } from '../ui/sceneResult.js'
import { SceneStageSelect } from '../ui/sceneStageSelect.js'
import { SceneAlbum } from '../ui/sceneAlbum.js'
import { SceneTeamSetup } from '../ui/sceneTeamSetup.js'
import { SceneBattlePrepare } from '../ui/sceneBattlePrepare.js'
import { SceneInventory } from '../ui/sceneInventory.js'
import { SceneShop } from '../ui/sceneShop.js'
import { SceneEvolve } from '../ui/sceneEvolve.js'
import { SceneSignIn } from '../ui/sceneSignIn.js'
import { SceneAchievement } from '../ui/sceneAchievement.js'
import { SceneSettings } from '../ui/sceneSettings.js'
import { SceneTutorial } from '../ui/sceneTutorial.js'

const SCENE_CLASSES = {
  start: SceneStart,
  battle: SceneBattle,
  main: SceneMain,
  result: SceneResult,
  stageSelect: SceneStageSelect,
  album: SceneAlbum,
  teamSetup: SceneTeamSetup,
  battlePrepare: SceneBattlePrepare,
  inventory: SceneInventory,
  shop: SceneShop,
  evolve: SceneEvolve,
  signIn: SceneSignIn,
  achievement: SceneAchievement,
  settings: SceneSettings,
  tutorial: SceneTutorial
}

export class SceneManager {
  constructor(game) {
    this.game = game
    this.currentScene = null
    this.scenes = {}
    this.isChanging = false
  }

  register(name, SceneClass) {
    this.scenes[name] = SceneClass
  }

  // 快捷方法：切换场景（兼容battleResult参数传递）
  switch(name, data = {}) {
    return this.changeScene(name, data)
  }

  // 淡出动画（黑色遮罩渐变出现）
  _fadeOut(ms) {
    return new Promise(resolve => {
      const canvas = this.game.renderer.canvas
      const ctx = this.game.renderer.ctx

      const start = Date.now()
      const animate = () => {
        const elapsed = Date.now() - start
        const alpha = Math.min(elapsed / ms, 1)
        ctx.fillStyle = `rgba(10, 10, 26, ${alpha})`
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        if (alpha < 1) {
          requestAnimationFrame(animate)
        } else {
          resolve()
        }
      }
      animate()
    })
  }

  // 淡入动画（黑色遮罩渐变消失）
  _fadeIn(ms) {
    return new Promise(resolve => {
      const canvas = this.game.renderer.canvas
      const ctx = this.game.renderer.ctx

      const start = Date.now()
      const animate = () => {
        const elapsed = Date.now() - start
        const alpha = 1 - Math.min(elapsed / ms, 1)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (this.currentScene && this.currentScene.render) {
          this.currentScene.render(this.game.renderer)
        }
        ctx.fillStyle = `rgba(10, 10, 26, ${alpha})`
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        if (alpha > 0) {
          requestAnimationFrame(animate)
        } else {
          resolve()
        }
      }
      animate()
    })
  }

  // 滑出动画（旧场景从左向右滑出）
  _slideOut(ms) {
    return new Promise(resolve => {
      const canvas = this.game.renderer.canvas
      const ctx = this.game.renderer.ctx

      const start = Date.now()
      const animate = () => {
        const elapsed = Date.now() - start
        const progress = Math.min(elapsed / ms, 1)
        const offsetX = progress * canvas.width

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (this.currentScene && this.currentScene.render) {
          ctx.save()
          ctx.translate(offsetX, 0)
          this.currentScene.render(this.game.renderer)
          ctx.restore()
        }
        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          resolve()
        }
      }
      animate()
    })
  }

  // 滑入动画（新场景从右侧滑入）
  _slideIn(ms) {
    return new Promise(resolve => {
      const canvas = this.game.renderer.canvas
      const ctx = this.game.renderer.ctx

      const start = Date.now()
      const animate = () => {
        const elapsed = Date.now() - start
        const progress = Math.min(elapsed / ms, 1)
        const offsetX = (1 - progress) * canvas.width

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (this.currentScene && this.currentScene.render) {
          ctx.save()
          ctx.translate(offsetX, 0)
          this.currentScene.render(this.game.renderer)
          ctx.restore()
        }
        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          resolve()
        }
      }
      animate()
    })
  }

  async changeScene(name, data = {}, mode = 'fade') {
    if (this.isChanging) return false

    const SceneClass = this.scenes[name] || SCENE_CLASSES[name]
    if (!SceneClass) {
      console.error(`[SceneManager] Unknown scene: ${name}`)
      return false
    }

    this.isChanging = true
    if (this.game.input) {
      this.game.input.unlock()
      this.game.input.lock()
    }

    try {
      if (mode === 'slide') {
        // 阶段1：滑出（200ms）
        await this._slideOut(200)
      } else {
        // 阶段1：淡出（150ms）
        await this._fadeOut(150)
      }

      // 阶段2：销毁旧场景
      if (this.currentScene && this.currentScene.destroy) {
        this.currentScene.destroy()
      }

      // 阶段3：创建新场景（不渲染，等待淡入）
      this.currentScene = new SceneClass(this.game, data)
      if (this.currentScene.init) {
        this.currentScene.init(data)
      }

      // 阶段4：淡入或滑入
      if (mode === 'slide') {
        await this._slideIn(200)
      } else {
        await this._fadeIn(150)
      }

      console.log(`[SceneManager] Scene changed to: ${name}`)
      return true
    } finally {
      if (this.game.input) {
        this.game.input.unlock()
      }
      this.isChanging = false
    }
  }
}
