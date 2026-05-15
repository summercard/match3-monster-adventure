// ============================================
// ui/sceneSettings.js - 设置场景
// ============================================

import { THEME, COLORS } from '../engine/theme.js'

export class SceneSettings {
  constructor(game, data) {
    this.game = game
    this.buttons = []
    this.tapCallback = this._onTap.bind(this)
    this.confirmDialog = null // 确认弹窗状态
  }

  init(data) {
    console.log('[SceneSettings] 设置场景初始化')
    // 加载设置状态
    this.settings = this.game.storage.loadSettings()
    this._buildUI()
    this.game.input.onTap = this.tapCallback
  }

  _buildUI() {
    const w = this.game.renderer.designWidth
    const h = this.game.renderer.designHeight
    this.ui = {
      // 标题区域
      titleY: h * 0.08,
      // 设置项区域（从上往下排列）
      items: [],
      backBtn: null,
      confirmBox: null // 确认弹窗
    }

    const itemW = 280
    const itemH = 56
    const startY = h * 0.22
    const gap = 14

    // 构建设置项（开关样式）
    const createToggle = (id, label, y, isOn) => ({
      id,
      label,
      y,
      x: (w - itemW) / 2,
      w: itemW,
      h: itemH,
      isOn,
      toggleX: (w - itemW) / 2 + itemW - 60,
      toggleW: 50,
      toggleH: 28
    })

    this.ui.items = [
      createToggle('sound', '🔊 游戏音效', startY, this.settings.soundOn !== false),
      createToggle('music', '🎵 背景音乐', startY + (itemH + gap), this.settings.musicOn !== false),
    ]

    // 重置数据按钮（在最下方）
    const resetY = startY + (itemH + gap) * 2 + 20
    this.ui.items.push({
      id: 'reset',
      label: '🗑️ 重置游戏数据',
      y: resetY,
      x: (w - itemW) / 2,
      w: itemW,
      h: itemH,
      isOn: null // 按钮样式
    })

    // 版本信息
    this.ui.versionY = h * 0.85
    this.ui.version = this.settings.version || 'v0.1.0'

    // 返回按钮
    this.ui.backBtn = {
      id: 'back',
      label: '← 返回',
      x: 15,
      y: h * 0.05,
      w: 80,
      h: 36,
      isBack: true
    }
  }

  _onTap(x, y) {
    // 优先检查确认弹窗
    if (this.confirmDialog) {
      const { yesBtn, noBtn } = this.confirmDialog
      if (x >= yesBtn.x && x <= yesBtn.x + yesBtn.w && y >= yesBtn.y && y <= yesBtn.y + yesBtn.h) {
        this._doResetData()
        return
      }
      if (x >= noBtn.x && x <= noBtn.x + noBtn.w && y >= noBtn.y && y <= noBtn.y + noBtn.h) {
        this.confirmDialog = null
        return
      }
      return
    }

    // 返回按钮
    const back = this.ui.backBtn
    if (x >= back.x && x <= back.x + back.w && y >= back.y && y <= back.y + back.h) {
      this._saveAndBack()
      return
    }

    // 设置项点击
    for (const item of this.ui.items) {
      if (item.id === 'reset') {
        // 重置按钮
        if (x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h) {
          this._showResetConfirm()
          return
        }
      } else {
        // 开关项 - 点击开关区域切换
        if (x >= item.toggleX && x <= item.toggleX + item.toggleW && y >= item.y + (item.h - item.toggleH) / 2 && y <= item.y + (item.h + item.toggleH) / 2) {
          this._toggleSetting(item.id)
          return
        }
      }
    }
  }

  _toggleSetting(id) {
    if (id === 'sound') {
      this.settings.soundOn = !this.settings.soundOn
    } else if (id === 'music') {
      this.settings.musicOn = !this.settings.musicOn
    }
    this._saveSettings()
    console.log(`[SceneSettings] ${id} = ${id === 'sound' ? this.settings.soundOn : this.settings.musicOn}`)
  }

  _saveSettings() {
    this.game.storage.saveSettings(this.settings)
    // 如果有音效系统，可以在这里触发音效播放
  }

  _showResetConfirm() {
    const w = this.game.renderer.designWidth
    const h = this.game.renderer.designHeight
    const boxW = 260
    const boxH = 140
    const boxX = (w - boxW) / 2
    const boxY = (h - boxH) / 2

    const btnW = 100
    const btnH = 38
    const btnGap = 20
    const btnY = boxY + boxH - 55
    const yesX = boxX + (boxW - btnW * 2 - btnGap) / 2
    const noX = yesX + btnW + btnGap

    this.confirmDialog = {
      box: { x: boxX, y: boxY, w: boxW, h: boxH },
      yesBtn: { id: 'yes', x: yesX, y: btnY, w: btnW, h: btnH },
      noBtn: { id: 'no', x: noX, y: btnY, w: btnW, h: btnH }
    }
  }

  _doResetData() {
    this.confirmDialog = null
    // 清除所有存档
    try {
      wx.clearStorageSync()
      console.log('[SceneSettings] 游戏数据已重置')
      // 提示并返回主菜单
      this._showResetSuccess()
    } catch (e) {
      console.error('[SceneSettings] 重置失败:', e)
    }
  }

  _showResetSuccess() {
    // 显示短暂提示后返回
    this.resetSuccess = true
    setTimeout(() => {
      this.game.sceneManager.changeScene('main')
    }, 1500)
  }

  _saveAndBack() {
    this._saveSettings()
    this.game.sceneManager.changeScene('main', {}, 'slide')
  }

  update(dt) {}

  render(r) {
    // 背景
    r.fillRect(0, 0, 375, 667, COLORS.bgMedium)

    // 标题
    r.fillText('⚙️ 游戏设置', 187, this.ui.titleY + 30, COLORS.textPrimary, THEME.font.title.size, THEME.font.title.weight)

    // 返回按钮
    const back = this.ui.backBtn
    r.drawButton({ x: back.x, y: back.y, w: back.w, h: back.h, text: back.label }, 'secondary')

    // 设置项
    for (const item of this.ui.items) {
      if (item.id === 'reset') {
        // 重置按钮 - 红色警示风格
        r.drawButton({ x: item.x, y: item.y, w: item.w, h: item.h, text: item.label }, 'danger')
      } else {
        // 开关设置项背景
        r.fillRoundRect(item.x, item.y, item.w, item.h, THEME.radius.md, COLORS.bgCard)
        // 标签
        r.fillText(item.label, item.x + 16, item.y + item.h / 2 + 5, COLORS.textSecondary, THEME.font.body.size, THEME.font.body.weight)

        // 开关
        const toggleX = item.toggleX
        const toggleY = item.y + (item.h - item.toggleH) / 2
        const isOn = (item.id === 'sound' ? this.settings.soundOn : this.settings.musicOn) !== false

        // 开关轨道
        r.fillRoundRect(toggleX, toggleY, item.toggleW, item.toggleH, item.toggleH / 2, isOn ? COLORS.success : COLORS.textDark)
        // 开关圆点
        const knobX = isOn ? toggleX + item.toggleW - item.toggleH + 3 : toggleX + 3
        r.fillCircle(knobX + item.toggleH / 2 - 1, toggleY + item.toggleH / 2, item.toggleH / 2 - 3, COLORS.white)
        // ON/OFF 文字
        r.fillText(isOn ? 'ON' : 'OFF', toggleX + item.toggleW / 2, toggleY + item.toggleH / 2 + 4, isOn ? COLORS.white : COLORS.textMuted, THEME.font.tiny.size, THEME.font.tiny.weight)
      }
    }

    // 确认弹窗
    if (this.confirmDialog) {
      const d = this.confirmDialog
      // 遮罩
      r.fillRect(0, 0, 375, 667, 'rgba(0,0,0,0.7)')
      // 弹窗背景
      r.fillRoundRect(d.box.x, d.box.y, d.box.w, d.box.h, THEME.radius.lg, COLORS.bgCard)
      // 提示文字
      r.fillText('确认重置？', d.box.x + d.box.w / 2, d.box.y + 40, COLORS.danger, THEME.font.subtitle.size, THEME.font.subtitle.weight)
      r.fillText('所有数据将被清除，无法恢复', d.box.x + d.box.w / 2, d.box.y + 65, COLORS.textMuted, THEME.font.small.size)
      // 按钮
      r.drawButton({ x: d.yesBtn.x, y: d.yesBtn.y, w: d.yesBtn.w, h: d.yesBtn.h, text: '确认' }, 'danger')
      r.drawButton({ x: d.noBtn.x, y: d.noBtn.y, w: d.noBtn.w, h: d.noBtn.h, text: '取消' }, 'secondary')
    }

    // 重置成功提示
    if (this.resetSuccess) {
      r.fillText('✅ 数据已重置', 187, this.ui.titleY + 80, COLORS.success, THEME.font.subtitle.size, THEME.font.subtitle.weight)
    }

    // 版本信息
    r.fillText(this.ui.version, 187, this.ui.versionY, COLORS.textDark, THEME.font.small.size)
  }

  destroy() {
    this.game.input.onTap = null
  }
}