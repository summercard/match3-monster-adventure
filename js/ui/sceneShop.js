// ============================================
// ui/sceneShop.js - 商店场景
// ============================================

import { ITEMS_DB, SHOP_ITEMS } from '../data/items.js'
import { THEME, COLORS } from '../engine/theme.js'

export class SceneShop {
  constructor(game, data) {
    this.game = game
    this.buttons = []
    this.selectedItem = null
    this.popup = null
    this.scrollOffset = 0
    this.tapCallback = this._onTap.bind(this)
    this.swipeCallback = this._onSwipe.bind(this)
  }

  init(data) {
    console.log('[SceneShop] 商店初始化')
    this.player = this.game.storage.loadPlayer()
    this.selectedItem = null
    this.popup = null
    this.scrollOffset = 0
    this._buildLayout()
    this.game.input.onTap = this.tapCallback
    this.game.input.onSwipe = this.swipeCallback
  }

  _buildLayout() {
    const w = this.game.renderer.designWidth

    // 返回按钮
    this.backBtn = { id: 'back', x: 10, y: 10, w: 60, h: 36 }

    // 货币显示区域
    this.currencyY = 100

    // 商品列表区域
    this.listY = 160
    this.itemH = 70
    this.itemGap = 8

    // 准备商品列表（带 ITEMS_DB 数据）
    this.shopList = SHOP_ITEMS.map(shopEntry => {
      const itemData = ITEMS_DB[shopEntry.id]
      return {
        id: shopEntry.id,
        price: shopEntry.price,
        currency: shopEntry.currency,
        label: shopEntry.label,
        data: itemData
      }
    })
  }

  _onTap(x, y) {
    // 购买确认弹窗
    if (this.popup) {
      const p = this.popup
      const pw = p.w, ph = p.h
      const px = p.x, py = p.y
      // 遮罩点击关闭
      if (!(x >= px && x <= px + pw && y >= py && y <= py + ph)) {
        this.popup = null
        return
      }
      // 确认按钮
      const confirmX = px + 20
      const confirmY = py + ph - 55
      if (x >= confirmX && x <= confirmX + 110 && y >= confirmY && y <= confirmY + 40) {
        this._confirmPurchase(p.id)
        this.popup = null
        return
      }
      // 取消按钮
      const cancelX = px + 150
      if (x >= cancelX && x <= cancelX + 110 && y >= confirmY && y <= confirmY + 40) {
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

    // 商品购买按钮
    const listBottomY = this.game.renderer.designHeight - 20
    if (y < this.listY || y > listBottomY) return
    for (let i = 0; i < this.shopList.length; i++) {
      const shopItem = this.shopList[i]
      const itemY = this.listY + i * (this.itemH + this.itemGap) - this.scrollOffset
      if (itemY < this.listY || itemY + this.itemH > listBottomY) continue
      // 购买按钮在右侧
      const btnX = 280
      const btnY = itemY + (this.itemH - 40) / 2
      if (x >= btnX && x <= btnX + 80 && y >= btnY && y <= btnY + 40) {
        this.selectedItem = shopItem
        this._showPurchasePopup(shopItem)
        return
      }
    }
  }

  _onSwipe(x, y, direction) {
    if (this.popup || y < this.listY) return
    const maxOffset = this._getMaxScrollOffset()
    if (direction === 'up') {
      this.scrollOffset = Math.min(maxOffset, this.scrollOffset + this.itemH + this.itemGap)
    } else if (direction === 'down') {
      this.scrollOffset = Math.max(0, this.scrollOffset - this.itemH - this.itemGap)
    }
  }

  _getMaxScrollOffset() {
    const listBottomY = this.game.renderer.designHeight - 20
    const contentH = this.shopList.length * (this.itemH + this.itemGap) - this.itemGap
    return Math.max(0, contentH - (listBottomY - this.listY))
  }

  _inRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  }

  _showPurchasePopup(item) {
    const w = this.game.renderer.designWidth
    const h = this.game.renderer.designHeight

    const pw = 300, ph = 200
    const px = (w - pw) / 2
    const py = (h - ph) / 2

    this.popup = {
      x: px, y: py, w: pw, h: ph,
      id: item.id,
      data: item.data,
      price: item.price,
      currency: item.currency
    }
  }

  _confirmPurchase(itemId) {
    const itemData = ITEMS_DB[itemId]
    if (!itemData) return

    const player = this.game.storage.loadPlayer()
    const price = this._getItemPrice(itemId)
    const currency = this._getItemCurrency(itemId)

    if (currency === 'gold') {
      if ((player.gold || 0) < price) {
        this.game.toastManager.warning('💰 金币不足')
        return
      }
      // 扣除金币
      player.gold -= price
      this.game.storage.savePlayer(player)
      this.player.gold = player.gold
    } else if (currency === 'gems') {
      if ((player.gems || 0) < price) {
        this.game.toastManager.warning('💎 钻石不足')
        return
      }
      player.gems -= price
      this.game.storage.savePlayer(player)
      this.player.gems = player.gems
    }

    // 增加道具
    this.game.storage.addItem(itemId, 1)

    // 显示获得提示
    this.game.toastManager.success(`✅ 获得 ${itemData.name}！`)
    console.log(`[Shop] 购买成功: ${itemData.name}`)
  }

  _getItemPrice(itemId) {
    const entry = SHOP_ITEMS.find(e => e.id === itemId)
    return entry ? entry.price : 0
  }

  _getItemCurrency(itemId) {
    const entry = SHOP_ITEMS.find(e => e.id === itemId)
    return entry ? entry.currency : 'gold'
  }

  _canAfford(itemId) {
    const price = this._getItemPrice(itemId)
    const currency = this._getItemCurrency(itemId)
    if (currency === 'gold') {
      return (this.player.gold || 0) >= price
    } else {
      return (this.player.gems || 0) >= price
    }
  }

  update(dt) {}

  render(r) {
    // 背景
    r.fillRect(0, 0, 375, 667, COLORS.bgMedium)

    // 顶部标题栏
    r.fillRect(0, 0, 375, 60, COLORS.bgCard)

    // 返回按钮
    r.fillRoundRect(this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, THEME.radius.sm, THEME.buttons.secondary.bgColor)
    r.fillText('← 返回', this.backBtn.x + 10, this.backBtn.y + 23, COLORS.textPrimary, THEME.font.body.size)

    // 标题
    r.fillText('商店', 187, 35, COLORS.textPrimary, THEME.font.subtitle.size, THEME.font.subtitle.weight)

    // 货币显示
    const gold = this.player.gold || 0
    const gems = this.player.gems || 0
    r.fillText(`💰 ${gold}`, 80, this.currencyY, COLORS.gold, THEME.font.subtitle.size, THEME.font.subtitle.weight)
    r.fillText(`💎 ${gems}`, 295, this.currencyY, COLORS.primary, THEME.font.subtitle.size, THEME.font.subtitle.weight)

    // 分隔线
    r.fillRect(10, this.currencyY + 25, 355, 1, COLORS.textMuted)

    // 商品列表标题
    r.fillText('商品列表', 20, this.listY - 10, COLORS.textMuted, THEME.font.small.size)

    // 绘制商品
    for (let i = 0; i < this.shopList.length; i++) {
      const shopItem = this.shopList[i]
      const itemY = this.listY + i * (this.itemH + this.itemGap) - this.scrollOffset
      const listBottomY = this.game.renderer.designHeight - 20
      if (itemY < this.listY || itemY + this.itemH > listBottomY) continue
      const item = shopItem.data

      // 商品卡片背景
      r.fillRoundRect(10, itemY, 355, this.itemH, THEME.radius.md, COLORS.bgCard)

      // 道具图标（大一点）
      r.fillText(item.emoji, 30, itemY + this.itemH / 2 + 8, COLORS.textPrimary, 32)

      // 道具名称
      r.fillText(item.name, 75, itemY + 22, COLORS.textPrimary, THEME.font.body.size, THEME.font.body.weight)

      // 道具描述
      r.fillText(item.desc, 75, itemY + 42, COLORS.textMuted, THEME.font.small.size)

      // 价格标签
      const priceColor = shopItem.currency === 'gems' ? COLORS.primary : COLORS.gold
      const priceSymbol = shopItem.currency === 'gems' ? '💎' : '💰'
      r.fillText(`${priceSymbol} ${shopItem.price}`, 75, itemY + 60, priceColor, THEME.font.small.size, THEME.font.small.weight)

      // 购买按钮
      const btnX = 280
      const btnY = itemY + (this.itemH - 40) / 2
      const canAfford = this._canAfford(shopItem.id)

      if (canAfford) {
        r.fillRoundRect(btnX, btnY, 80, 40, THEME.radius.md, THEME.buttons.primary.bgColor)
        r.fillText('购买', btnX + 40, btnY + 25, THEME.buttons.primary.textColor, THEME.buttons.primary.fontSize, THEME.buttons.primary.fontWeight)
      } else {
        r.fillRoundRect(btnX, btnY, 80, 40, THEME.radius.md, COLORS.textDark)
        r.fillText(shopItem.currency === 'gems' ? '钻石不足' : '金币不足', btnX + 40, btnY + 25, COLORS.textMuted, THEME.font.small.size)
      }
    }

    const maxOffset = this._getMaxScrollOffset()
    if (maxOffset > 0) {
      const trackY = this.listY
      const trackH = this.game.renderer.designHeight - this.listY - 20
      const thumbH = Math.max(36, trackH * (trackH / (trackH + maxOffset)))
      const thumbY = trackY + (trackH - thumbH) * (this.scrollOffset / maxOffset)
      r.fillRoundRect(368, trackY, 3, trackH, 2, 'rgba(255,255,255,0.12)')
      r.fillRoundRect(367, thumbY, 5, thumbH, 3, 'rgba(255,255,255,0.45)')
    }

    // 购买确认弹窗
    if (this.popup) {
      const p = this.popup
      const w = this.game.renderer.designWidth
      const h = this.game.renderer.designHeight

      // 遮罩
      r.fillRect(0, 0, w, h, 'rgba(0,0,0,0.7)')

      // 弹窗背景
      r.fillRoundRect(p.x, p.y, p.w, p.h, THEME.radius.lg, COLORS.bgCard)

      // 顶部装饰条
      r.fillRect(p.x + 20, p.y + 10, p.w - 40, 3, THEME.buttons.primary.bgColor)

      // 标题
      r.fillText('确认购买', p.x + p.w / 2, p.y + 40, COLORS.textPrimary, THEME.font.subtitle.size, THEME.font.subtitle.weight)

      // 道具图标 + 名称
      r.fillText(p.data.emoji, p.x + p.w / 2, p.y + 80, COLORS.textPrimary, 36)
      r.fillText(p.data.name, p.x + p.w / 2, p.y + 115, COLORS.textPrimary, THEME.font.body.size, THEME.font.body.weight)

      // 价格
      const priceColor = p.currency === 'gems' ? COLORS.primary : COLORS.gold
      const priceSymbol = p.currency === 'gems' ? '💎' : '💰'
      r.fillText(`${priceSymbol} ${p.price}`, p.x + p.w / 2, p.y + 140, priceColor, THEME.font.body.size, THEME.font.body.weight)

      // 确认按钮
      r.fillRoundRect(p.x + 20, p.y + p.h - 55, 110, 40, THEME.radius.md, THEME.buttons.primary.bgColor)
      r.fillText('确认购买', p.x + 75, p.y + p.h - 28, THEME.buttons.primary.textColor, THEME.buttons.primary.fontSize, THEME.buttons.primary.fontWeight)

      // 取消按钮
      r.fillRoundRect(p.x + 150, p.y + p.h - 55, 110, 40, THEME.radius.md, COLORS.textDark)
      r.fillText('取消', p.x + 205, p.y + p.h - 28, COLORS.textSecondary, THEME.font.body.size)
    }
  }

  destroy() {
    this.game.input.onTap = null
    this.game.input.onSwipe = null
  }
}
