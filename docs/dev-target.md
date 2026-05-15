# 开发目标

## 创建时间
2026-05-15 18:22

## 当前循环：173

## 已完成功能审视结果
| 功能 | 功能完整性 | 边界处理 | 用户体验 | 代码质量 | 数据一致性 | 状态 |
|------|----------|----------|----------|----------|----------|------|
| P0.3.3 第一批 sceneStageSelect | ✅ | ✅ | ✅ | ✅ | ✅ | 深完成 |
| P0.3.3 第二批 sceneSettings/Achievement/Inventory | ✅ | ✅ | ✅ | ✅ | ✅ | 深完成 |
| P0.3.3 第三批 sceneAlbum/Evolve/TeamSetup | ✅ | ✅ | ✅ | ✅ | ✅ | 深完成 |
| P0.3.3 第四批 sceneSignIn | ✅ | ✅ | ✅ | ✅ | ✅ | 深完成 |

## 游戏流程走查
- ✅ 启动 → 新手引导 → 主菜单 → 各功能页 → 返回 → 全流程通畅
- ✅ sceneTutorial 引导5步流程完整，跳过/下一步按钮响应正常
- ✅ sceneShop 商店列表滚动、购买弹窗确认/取消逻辑完整
- ✅ sceneRanch 槽位管理、怪物选取、挂机收取流程完整
- ⚠️ 三个场景按钮均未使用 drawButton 统一样式，视觉风格不一致

## 本次目标
### 目标类型
深化已有

### 功能名称
P0.3.3 第五批（最后一批）— sceneTutorial / sceneShop / sceneRanch 按钮统一

### 深化重点
将剩余3个场景的所有按钮改用 `r.drawButton()` 通用方法，完成 P0.3.3 按钮样式统一的最后一步。

### 具体任务
- [ ] **sceneTutorial.js** — 2处按钮改用 drawButton：
  - [ ] "跳过"按钮 → drawButton(btn, 'secondary')
  - [ ] "下一步/开始冒险"按钮 → drawButton(btn, isLast ? 'success' : 'primary')，保留发光效果或改用 drawButton 后加外发光
- [ ] **sceneShop.js** — 4类按钮改用 drawButton：
  - [ ] "← 返回"按钮 → drawButton(backBtn, 'secondary')
  - [ ] 购买按钮（可购买） → drawButton(buyBtn, 'primary')
  - [ ] 购买按钮（不足） → drawButton(buyBtn, 'secondary') + 灰色文字覆盖
  - [ ] 弹窗"确认购买"按钮 → drawButton(confirmBtn, 'primary')
  - [ ] 弹窗"取消"按钮 → drawButton(cancelBtn, 'secondary')
- [ ] **sceneRanch.js** — _renderBtn 方法改造 + picker按钮：
  - [ ] 将 _renderBtn 改为调用 r.drawButton()
  - [ ] "← 返回" → drawButton(backBtn, 'secondary')
  - [ ] "收取" → drawButton(collectBtn, highlight ? 'gold' : 'secondary')
  - [ ] picker 怪物按钮保持自定义渲染（非标准按钮，是卡片选择器）不改 drawButton
- [ ] **theme.js** — 如需新增 'success' 按钮类型（绿色），添加到 THEME.buttons

### 涉及文件
- 修改：`js/ui/sceneTutorial.js`
- 修改：`js/ui/sceneShop.js`
- 修改：`js/ui/sceneRanch.js`
- 可能修改：`js/engine/theme.js`（添加 success 按钮类型）

### 验收标准
- 三个场景所有标准按钮均使用 drawButton 统一渲染
- 按钮视觉风格与其他已完成场景（sceneMain/sceneStart/sceneSignIn等）一致
- 按钮点击响应和功能不受影响
- P0.3.3 按钮样式统一任务全部完成 ✅
- 可以进入 P0.4 背景统一阶段
