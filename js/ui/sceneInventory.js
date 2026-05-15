// ============================================
// ui/sceneInventory.js - 背包场景
// ============================================

import { ITEMS_DB } from '../data/items.js'
import { THEME, COLORS } from '../engine/theme.js'

export class SceneInventory {
  constructor(game, data) {
    this.game = game
    this.buttons = []
    this.selectedItem = null
    this.popup = null
    this.toast = null
    this.toastTimer = 0
    this.scrollOffset = 0
    this.tapCallback = this._onTap.bind(this)
    this.swipeCallback = this._onSwipe.bind(this)
  }

  init(data) {
    console.log('[SceneInventory] 背包初始化')
    this.inventory = this.game.storage.loadInventory()
    this.player = this.game.storage.loadPlayer()
    this.selectedItem = null
    this.popup = null
    this.toast = null
    this.toastTimer = 0
    this.scrollOffset = 0
    this._buildButtons()
    this.game.input.onTap = this.tapCallback
    this.game.input.onSwipe = this.swipeCallback
  }

  _buildButtons() {
    const w = this.game.renderer.designWidth

    // 返回按钮
    this.backBtn = { id: 'back', x: 10, y: 10, w: 60, h: 36 }

    // 标题区域
    this.titleY = 60

    // 货币显示区域
    this.currencyY = 110

    // 道具网格区域
    this.gridY = 160
    this.cols = 3
    this.cellSize = 100
    this.cellGap = 10

    // 计算每行居中
    const gridW = this.cols * this.cellSize + (this.cols - 1) * this.cellGap
    this.gridStartX = (w - gridW) / 2

    // 解析背包道具列表
    this.itemList = []
    for (const [itemId, count] of Object.entries(this.inventory)) {
      if (count > 0 && ITEMS_DB[itemId]) {
        this.itemList.push({ id: itemId, count: count, data: ITEMS_DB[itemId] })
      }
    }
  }

  _onTap(x, y) {
    // 关闭弹窗
    if (this.popup) {
      const popup = this.popup
      const px = popup.x, py = popup.y, pw = popup.w, ph = popup.h
      // 遮罩点击关闭
      if (!(x >= px && x <= px + pw && y >= py && y <= py + ph)) {
        this.popup = null
        return
      }
      // 按钮区域
      const bx = px + (pw - 120) / 2
      const by = py + ph - 60
      if (x >= bx && x <= bx + 120 && y >= by && y <= by + 40) {
        this._useItem(popup.itemId)
        this.popup = null
        return
      }
      return
    }

    // 返回按钮
    if (this._inRect(x, y, this.backBtn)) {
      this.game.sceneManager.changeScene('main', {}, 'slide')
      return
    }

    // 道具格子点击
    const idx = this._getItemIndexAt(x, y)
    if (idx !== -1 && idx < this.itemList.length) {
      this.selectedItem = this.itemList[idx]
      this._showItemPopup(this.selectedItem)
    }
  }

  _inRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  }

  _getItemIndexAt(x, y) {
    const relX = x - this.gridStartX
    const gridTop = this.gridY + 45
    const gridBottom = this.game.renderer.designHeight - 24
    const relY = y - gridTop + this.scrollOffset
    if (y < gridTop || y > gridBottom) return -1
    if (relX < 0 || relY < 0) return -1

    const col = Math.floor(relX / (this.cellSize + this.cellGap))
    const row = Math.floor(relY / (this.cellSize + this.cellGap))
    if (col >= this.cols) return -1

    const idx = row * this.cols + col
    return idx
  }

  _onSwipe(x, y, direction) {
    if (this.popup || y < this.gridY + 45) return
    const step = this.cellSize + this.cellGap
    const maxOffset = this._getMaxScrollOffset()
    if (direction === 'up') {
      this.scrollOffset = Math.min(maxOffset, this.scrollOffset + step)
    } else if (direction === 'down') {
      this.scrollOffset = Math.max(0, this.scrollOffset - step)
    }
  }

  _getMaxScrollOffset() {
    const rows = Math.ceil(this.itemList.length / this.cols)
    const contentH = rows * (this.cellSize + this.cellGap) - this.cellGap
    const gridTop = this.gridY + 45
    const viewH = this.game.renderer.designHeight - 24 - gridTop
    return Math.max(0, contentH - viewH)
  }

  _showItemPopup(item) {
    const w = this.game.renderer.designWidth
    const h = this.game.renderer.designHeight

    // 弹窗尺寸
    const pw = 280, ph = 220
    const px = (w - pw) / 2
    const py = (h - ph) / 2

    this.popup = {
      x: px, y: py, w: pw, h: ph,
      itemId: item.id,
      data: item.data,
      count: item.count
    }
  }

  _useItem(itemId) {
    const itemData = ITEMS_DB[itemId]
    if (!itemData) return

    let applyEffect = null

    // 根据道具类型执行效果
    switch (itemData.type) {
      case 'exp':
        // 经验道具：增加队伍经验
        if (itemData.effect && itemData.effect.expGain) {
          applyEffect = () => {
            this.game.storage.addPlayerExp(itemData.effect.expGain)
            this.player = this.game.storage.loadPlayer()
            this._showToast(`获得 ${itemData.effect.expGain} 经验`)
          }
        }
        break
      case 'gold':
        // 金币道具：增加金币
        if (itemData.effect && itemData.effect.goldGain) {
          applyEffect = () => {
            this.game.storage.addGold(itemData.effect.goldGain)
            this.player = this.game.storage.loadPlayer()
            this._showToast(`获得 ${itemData.effect.goldGain} 金币`)
          }
        }
        break
      case 'capture':
        this._showToast('捕获球会在胜利结算时自动使用')
        return
      case 'battle':
        this._showToast('战斗道具请在战斗中使用')
        return
      case 'evolution':
        this._showToast('进化石请在怪物进化中使用')
        return
      default:
        this._showToast('该道具暂时无法使用')
        return
    }

    if (!applyEffect) {
      this._showToast('该道具暂时无法使用')
      return
    }

    if (!this.game.storage.useItem(itemId, 1)) {
      this._showToast('道具数量不足')
      return
    }
    applyEffect()
    this.inventory = this.game.storage.loadInventory()

    // 刷新道具列表
    this.itemList = []
    for (const [id, count] of Object.entries(this.inventory)) {
      if (count > 0 && ITEMS_DB[id]) {
        this.itemList.push({ id: id, count: count, data: ITEMS_DB[id] })
      }
    }
    this.scrollOffset = Math.min(this.scrollOffset, this._getMaxScrollOffset())
  }

  _showToast(text) {
    this.toast = text
    this.toastTimer = 1.8
  }

  update(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt
      if (this.toastTimer <= 0) this.toast = null
    }
  }

  render(r) {
    // 背景
    r.fillRect(0, 0, 375, 667, COLORS.bgMedium)

    // 顶部标题栏
    r.fillRect(0, 0, 375, 60, COLORS.bgCard)

    // 返回按钮
    this._backBtnRect = r.drawButton({ x: this.backBtn.x, y: this.backBtn.y, w: this.backBtn.w, h: this.backBtn.h, text: '← 返回' }, 'secondary')

    // 标题
    r.fillText('背包', 187, 35, COLORS.textPrimary, THEME.font.subtitle.size, THEME.font.subtitle.weight)

    // 货币显示
    const gold = this.player.gold || 0
    const gems = this.player.gems || 0
    r.fillText(`💰 ${gold}`, 60, this.currencyY + 20, COLORS.gold, THEME.font.body.size)
    r.fillText(`💎 ${gems}`, 315, this.currencyY + 20, COLORS.primary, THEME.font.body.size)

    // 分隔线
    r.fillRect(10, this.currencyY + 40, 355, 1, COLORS.textMuted)

    // 道具网格标题
    r.fillText('道具', 20, this.gridY + 25, COLORS.textMuted, THEME.font.body.size)

    // 道具数量
    r.fillText(`共 ${this.itemList.length} 件`, 290, this.gridY + 25, COLORS.textDark, THEME.font.small.size)

    const gridTop = this.gridY + 45

    if (this.itemList.length === 0) {
      // 空背包提示
      r.fillText('还没有道具，赶快去战斗获取吧！', 187, gridTop + 80, COLORS.textDark, THEME.font.body.size)
      r.fillText('💪', 187, gridTop + 110, COLORS.textPrimary, 32)
    } else {
      // 绘制道具格子
      const rows = Math.ceil(this.itemList.length / this.cols)
      for (let i = 0; i < this.itemList.length; i++) {
        const col = i % this.cols
        const row = Math.floor(i / this.cols)
        const gx = this.gridStartX + col * (this.cellSize + this.cellGap)
        const gy = gridTop + row * (this.cellSize + this.cellGap) - this.scrollOffset
        const gridBottom = this.game.renderer.designHeight - 24
        if (gy < gridTop || gy + this.cellSize > gridBottom) continue
        const item = this.itemList[i]

        // 格子背景
        r.fillRoundRect(gx, gy, this.cellSize, this.cellSize, THEME.radius.md, COLORS.bgCard)
        r.fillRoundRect(gx, gy, this.cellSize, this.cellSize, THEME.radius.md, COLORS.bgMedium)

        // 道具图标（大一点）
        r.fillText(item.data.emoji, gx + this.cellSize / 2, gy + 38, COLORS.textPrimary, 32)
        // 道具名称
        r.fillText(item.data.name, gx + this.cellSize / 2, gy + 62, COLORS.textPrimary, THEME.font.small.size)
        // 数量
        r.fillText(`×${item.count}`, gx + this.cellSize / 2, gy + 80, COLORS.gold, THEME.font.small.size, THEME.font.small.weight)
      }

      const maxOffset = this._getMaxScrollOffset()
      if (maxOffset > 0) {
        const trackY = gridTop
        const trackH = this.game.renderer.designHeight - 24 - gridTop
        const thumbH = Math.max(34, trackH * (trackH / (trackH + maxOffset)))
        const thumbY = trackY + (trackH - thumbH) * (this.scrollOffset / maxOffset)
        r.fillRoundRect(368, trackY, 3, trackH, 2, 'rgba(255,255,255,0.12)')
        r.fillRoundRect(367, thumbY, 5, thumbH, 3, 'rgba(255,255,255,0.45)')
      }
    }

    // 弹窗
    if (this.popup) {
      const p = this.popup

      // 遮罩
      r.fillRect(0, 0, 375, 667, 'rgba(0,0,0,0.7)')

      // 弹窗背景
      r.fillRoundRect(p.x, p.y, p.w, p.h, THEME.radius.lg, COLORS.bgCard)
      r.fillRoundRect(p.x, p.y, p.w, p.h, THEME.radius.lg, COLORS.bgMedium)

      // 顶部装饰条
      r.fillRect(p.x + 20, p.y + 10, p.w - 40, 3, THEME.buttons.primary.bgColor)

      // 道具图标
      r.fillText(p.data.emoji, p.x + p.w / 2, p.y + 55, COLORS.textPrimary, 40)

      // 道具名称
      r.fillText(p.data.name, p.x + p.w / 2, p.y + 95, COLORS.textPrimary, THEME.font.subtitle.size, THEME.font.subtitle.weight)

      // 道具描述
      r.fillText(p.data.desc, p.x + p.w / 2, p.y + 120, COLORS.textSecondary, THEME.font.small.size)

      // 拥有数量
      r.fillText(`拥有: ×${p.count}`, p.x + p.w / 2, p.y + 145, COLORS.gold, THEME.font.body.size, THEME.font.body.weight)

      // 使用按钮
      r.drawButton({ x: p.x + (p.w - 120) / 2, y: p.y + p.h - 60, w: 120, h: 40, text: '使 用' }, 'primary')
    }

    if (this.toast) {
      const alpha = Math.min(1, Math.max(0, this.toastTimer))
      r.fillRoundRect(55, 585, 265, 42, THEME.radius.md, `rgba(0,0,0,${0.72 * alpha})`)
      r.fillText(this.toast, 187, 606, `rgba(255,255,255,${alpha})`, THEME.font.small.size)
    }
  }

  destroy() {
    this.game.input.onTap = null
    this.game.input.onSwipe = null
  }
}
