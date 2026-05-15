// ============================================
// core/gameManager.js - 游戏主管理器
// ============================================

import { Renderer } from '../engine/renderer.js'
import { InputManager } from '../engine/input.js'
import { AnimationManager } from '../engine/animation.js'
import { SceneManager } from '../engine/scene.js'
import { EventBus } from './eventBus.js'
import { StorageManager } from './storage.js'
import { AchievementManager } from './achievementManager.js'
import { ToastManager } from '../engine/ToastManager.js'

export class GameManager {
  constructor() {
    this.renderer = null
    this.input = null
    this.animation = null
    this.sceneManager = null
    this.eventBus = null
    this.storage = null
    this.running = false
    this.lastTime = 0
    this.deltaTime = 0
  }

  init() {
    // 初始化事件总线
    this.eventBus = new EventBus()

    // 初始化渲染器
    this.renderer = new Renderer()
    this.renderer.init()

    // 初始化动画管理器
    this.animation = new AnimationManager()

    // 初始化输入管理器
    this.input = new InputManager(this.renderer)

    // 初始化存储管理器
    this.storage = new StorageManager()

    // 初始化成就管理器
    this.achievementManager = new AchievementManager(this)

    // 初始化场景管理器
    this.sceneManager = new SceneManager(this)

    // 初始化 Toast 管理器
    this.toastManager = new ToastManager(this)

    // 暴露scenes快捷引用
    this.scenes = this.sceneManager

    // 注册全局事件
    this._registerGlobalEvents()

    console.log('[GameManager] 初始化完成')
  }

  _registerGlobalEvents() {
    this.eventBus.on('scene:change', (sceneName) => {
      this.sceneManager.changeScene(sceneName)
    })
  }

  run() {
    this.running = true
    this.lastTime = Date.now()

    // 默认进入启动画面
    this.sceneManager.changeScene('start')

    // 启动游戏循环
    this._loop()
  }

  _loop() {
    if (!this.running) return

    const now = Date.now()
    this.deltaTime = (now - this.lastTime) / 1000 // 转秒
    this.lastTime = now

    // 限制deltaTime防止跳帧过大
    if (this.deltaTime > 0.1) this.deltaTime = 0.1

    this._update(this.deltaTime)
    this._render()

    requestAnimationFrame(() => this._loop())
  }

  _update(dt) {
    if (this.sceneManager.currentScene) {
      this.sceneManager.currentScene.update(dt)
    }
    this.animation.update(dt)
    this.toastManager.update(dt)
  }

  _render() {
    this.renderer.clear()
    if (this.sceneManager.currentScene) {
      this.sceneManager.currentScene.render(this.renderer)
    }
    this.toastManager.render(this.renderer)
  }

  stop() {
    this.running = false
  }
}