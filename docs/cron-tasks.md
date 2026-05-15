# Cron 循环开发任务模板

> 本文档定义了两个交替执行的 cron 任务模板。
> **每次 cron 任务执行时，必须先读取本文档获取格式，严格按照模板执行。**
> 主人可以通过说"停止开发循环"来终止。

**当前阶段：玩法丰富度 + 流程闭环 (Depth & Flow Phase)**
- 数值设计文档：`docs/balance-design.md`（含玩法丰富度路线图）
- 打磨计划：`docs/polish-plan.md`
- **核心问题：每一关体验完全一样，没有新机制引入**
- **循环优先级：A1（4连强化宝石）> A2（5连彩虹）> B1（障碍物）> C1（敌人AI）**
- **评判标准：玩家能理解吗？有即时正反馈吗？循序渐进了吗？**
- 严格按 A→B→C→D 阶段推进，每个阶段只加1-2个机制

---

## 项目信息

- **项目名称：** 三消宝可梦 (Match-3 Monster Adventure)
- **项目路径：** `/Users/summercards/WeChatProjects/minigame-1`
- **开发目标文档：** `docs/dev-target.md`
- **开发日志：** `docs/devlog/README.md`
- **任务模板文档：** `docs/cron-tasks.md`（就是本文件）
- **循环状态：** `docs/dev-cycle-state.json`

---

## 循环机制

```
Task 1 (定目标) → 完成后自动创建 Task 2 cron
       ↑                              ↓
Task 2 (写代码) ← 完成后自动创建 Task 1 cron
```

每次任务完成后，向主人飞书报告本次成果。

---

## Task 1: 定目标 (minigame-plan)

### 角色
你是三消宝可梦微信小游戏的**体验打磨师**，负责从玩家视角审视游戏的视觉和交互体验。

**当前阶段目标：** 读取 `docs/polish-plan.md`，按 P0→P1→P2→P3 顺序推进打磨任务。

### 执行步骤

1. **读取状态文件** `docs/dev-cycle-state.json`，获取：
   - 当前循环计数
   - 已完成功能列表

   **⚠️ 特殊轮次检查**：如果 `cycleCount` 是 10 的整数倍（10/20/30/40...），进入 **Bug 专项检查模式**：
   - 不规划新功能，不深化已有功能
   - 专门检查所有 JS 文件的报错和 Bug：
     - 语法错误、未定义变量、import/require 路径错误
     - `console.error`、`TODO`、`FIXME` 标记
     - 各场景的 `init` / `destroy` 是否配对
     - 死代码或未调用的函数
     - 模拟游戏流程走查，找出逻辑断点
   - 将发现的问题写入 `docs/dev-target.md`，类型标记为 `bug修复`
   - 跳过步骤 2-4，直接进入步骤 5 写入目标
   - 然后执行步骤 7-9（更新状态、报告、创建 Task 2 cron）
   - 当前阶段

   **读取打磨计划** `docs/polish-plan.md`，了解当前应该做哪个层级的任务。

2. **只审视当前维度**

   根据 `polish-plan.md` 顶部的当前聚焦目标，**只看当前正在做的那个维度**的进度和状态。

   **不要遍历 completedFeatures 的所有项！** 只看：
   - 当前维度走到了哪一步（看 `polish-plan.md` 的 checkbox）
   - 上一个 code 任务改了什么（看 `dev-cycle-state.json` 的 `lastTask` 和最近的变更描述）
   - 当前维度有没有明显问题（读相关文件快速确认）

   **只有当当前维度全部完成时**，才看下一个维度。

   **评估维度（仅用于当前在看的项）：**
   | 维度 | 评估内容 | 完成标准 |
   |------|----------|----------|
   | **功能完整性** | 功能是否达到设计预期？ | 无明显缺失 |
   | **边界处理** | 异常情况是否处理？ | 无明显漏洞 |
   | **数据一致性** | 存档/读档、状态同步是否正确？ | 数据可靠 |

3. **游戏流程走查（必须执行，优先级最高）**

   以新玩家视角，从游戏启动开始完整走一遍流程：

   ```
   启动游戏 → 主界面 → 选择操作 → 进入关卡/功能 → 完成流程 → 返回
   ```

   **检查项：**
   - 游戏启动后是否有明确的入口/按钮？
   - 每个页面是否有返回/导航？
   - 功能之间的衔接是否通畅（主菜单→关卡选择→战斗→结算→返回）？
   - 玩家能否完成一个完整的游戏循环？
   - 每个按钮是否可点击、有响应、有目标页面？

   **如果流程有断点** → 立即设为本次目标，修复流程衔接问题，**优先级高于一切**

4. **根据审视结果决定下一步**（优先级从高到低）

   **第一步：修复流程断点**
   - 如果游戏流程走查发现断点 → 立即修复

   **第二步：按功能层级选择目标**

   功能分三个层级，**必须从高层级往低层级推进**：

   | 层级 | 内容 | 说明 |
   |------|------|------|
   | **P0 核心玩法** | 三消战斗、收服怪物、怪物养成、关卡推进、队伍编成 | 游戏主体循环，玩家80%时间在这里 |
   | **P1 核心支撑** | 游戏进度、数值体系、怪物成长曲线、进化系统、关卡难度设计 | 让核心玩法有深度和持续动力 |
   | **P2 外围功能** | 签到、商店、成就、排行榜、背包、图鉴等 | 锦上添花，P0/P1完成前不做 |

   **规则：**
   - P0 有未完成/需深化 → 只做 P0
   - P0 全部深完成 → 做 P1
   - P1 全部深完成 → 才做 P2
   - **P2 外围功能永远不优先于 P0/P1**

   **第三步：选择具体目标**
   - 从 ⚠️ 需深化的功能中选择最关键的一项
   - 若无 → 规划当前层级的新功能/新内容

5. **设定本次目标**

   根据步骤3的决定，写入 `docs/dev-target.md`：

   ```markdown
   # 开发目标

   ## 创建时间
   YYYY-MM-DD HH:MM

   ## 当前循环：N

   ## 已完成功能审视结果
   | 功能 | 功能完整性 | 边界处理 | 用户体验 | 代码质量 | 数据一致性 | 状态 |
   |------|----------|----------|----------|----------|----------|------|
   | 棋盘生成 | ✅ | ✅ | ⚠️需深化 | ✅ | ✅ | 继续深化 |
   | 战斗系统 | ✅ | ✅ | ✅ | ✅ | ✅ | 深完成 |

   ## 本次目标
   ### 目标类型
   深化已有 / 添加新功能（二选一）

   ### 功能名称
   （如果是深化：填写要深化的功能名。如果是新功能：填写新功能名）

   ### 深化重点
   （如果是深化：写清楚要改善哪个维度）
   （如果是新功能：填写具体任务项）

   ### 具体任务
   - [ ] 任务项1
   - [ ] 任务项2
   - [ ] ...

   ### 涉及文件
   - 需要新建的文件
   - 需要修改的文件

   ### 验收标准
   - 标准1
   - 标准2
   ```

5. **更新状态文件** `docs/dev-cycle-state.json`
   - 如果深化了已有功能：更新对应的完成状态描述
   - 如果完成了深化：可以考虑将其标记为"深完成"状态

6. **向主人报告**（通过飞书消息），内容包含：
   - 当前循环计数
   - 已完成功能的审视结果摘要
   - 本次决定：深化已有 / 添加新功能
   - 本次目标

7. **创建 Task 2 cron**：
   ```bash
   openclaw cron add \
     --name "minigame-dev" \
     --at "+6m" \
     --session isolated \
     --message "你是三消宝可梦微信小游戏的开发者。请读取 docs/cron-tasks.md 中 Task 2 的模板，严格按照模板执行。项目路径: /Users/summercards/WeChatProjects/minigame-1" \
     --timeout-seconds 600 \
     --delete-after-run \
     --announce \
     --channel feishu
   ```

### 创建 cron 的精确命令（复制使用）

**⚠️ 最简方式：执行脚本**

完成所有开发工作后，执行以下命令创建下一个 cron（不再需要手写长命令）：

```bash
bash /Users/summercards/WeChatProjects/minigame-1/docs/next-cron.sh code
```

如果脚本失败，使用手动命令（先计算时间再执行）：
```bash
openclaw cron add --name "minigame-dev" --at "$(date -u -v+6M +%Y-%m-%dT%H:%M:%SZ)" --session isolated --message "你是三消宝可梦微信小游戏的开发者。请读取 docs/cron-tasks.md 中 Task 2 的模板，严格按照模板执行。项目路径: /Users/summercards/WeChatProjects/minigame-1。完成后执行: bash docs/next-cron.sh plan" --timeout-seconds 600 --delete-after-run --announce --channel feishu
```

---

## Task 2: 写代码 (minigame-code)

### 角色
你是三消宝可梦微信小游戏的开发者。

### 执行步骤

1. **读取状态文件** `docs/dev-cycle-state.json`
2. **读取开发目标** `docs/dev-target.md`，理解本次要实现的功能
3. **只读取本次任务涉及的文件**
   - 根据 `dev-target.md` 中的"涉及文件"列表，只读取这些文件
   - **不要读取所有文件**，只读与本次目标相关的（通常 2-4 个文件）
   - 如果需要了解接口/数据结构，只读取相关的数据文件
   - 检查是否有 bug 或潜在问题
   - 确认代码结构是否支持新功能
4. **实现开发目标中的功能**
   - 严格按照 `dev-target.md` 中的任务项逐项实现
   - 新建或修改对应的文件
   - 保持代码风格一致（纯JS，微信小游戏格式）
   - 确保不破坏现有功能
5. **自测验证**
   - 检查代码语法正确性
   - 检查 import/export 路径正确
   - 检查数据引用正确
6. **更新开发日志** `docs/devlog/README.md`
7. **更新状态文件** `docs/dev-cycle-state.json`
8. **向主人报告**（通过飞书消息），内容包含：
   - 完成了哪些功能
   - 修改/新建了哪些文件
   - 发现的 bug 和修复
   - 循环计数
9. **创建 Task 1 cron**：
   ```bash
   openclaw cron add \
     --name "minigame-plan" \
     --at "+6m" \
     --session isolated \
     --message "你是三消宝可梦微信小游戏的开发规划者。请读取 docs/cron-tasks.md 中 Task 1 的模板，严格按照模板执行。项目路径: /Users/summercards/WeChatProjects/minigame-1" \
     --timeout-seconds 600 \
     --delete-after-run \
     --announce \
     --channel feishu
   ```

### 创建 cron 的精确命令（复制使用）

**⚠️ 最简方式：执行脚本**

完成所有工作后，执行以下命令创建下一个 cron：

```bash
bash /Users/summercards/WeChatProjects/minigame-1/docs/next-cron.sh plan
```

如果脚本失败，使用手动命令：
```bash
openclaw cron add --name "minigame-plan" --at "$(date -u -v+6M +%Y-%m-%dT%H:%M:%SZ)" --session isolated --message "你是三消宝可梦微信小游戏的开发规划者。请读取 docs/cron-tasks.md 中 Task 1 的模板，严格按照模板执行。项目路径: /Users/summercards/WeChatProjects/minigame-1。完成后执行: bash docs/next-cron.sh code" --timeout-seconds 600 --delete-after-run --announce --channel feishu
```

---

## 状态文件格式

`docs/dev-cycle-state.json`：
```json
{
  "cycleCount": 0,
  "lastTask": "plan",
  "lastUpdateTime": "2026-05-13T01:30:00+08:00",
  "completedFeatures": [
    {
      "name": "基础三消棋盘",
      "status": "深完成",
      "dimensions": {
        "功能完整性": true,
        "边界处理": true,
        "用户体验": true,
        "代码质量": true,
        "数据一致性": true
      }
    },
    {
      "name": "战斗系统",
      "status": "需深化",
      "dimensions": {
        "功能完整性": true,
        "边界处理": true,
        "用户体验": false,
        "代码质量": true,
        "数据一致性": true
      },
      "focus": "用户体验"
    }
  ],
  "currentPhase": 1,
  "totalFilesCreated": 16,
  "status": "running"
}
```

---

## ⚠️ 重要规则

1. **每次执行必须先读取本文件** — 确保不偏离格式
2. **玩家视角优先** — 所有开发决策站在玩家角度：能理解吗？有反馈吗？好玩吗？每次问自己"如果我是第一次玩的玩家，我会有什么感受？"
3. **功能粒度要小** — 每次只做一个可完成的小功能
4. **不能破坏现有功能** — 新增代码时确保旧代码正常
5. **必须向主人报告** — 每次完成后通过飞书发送报告
6. **必须创建下一个cron** — 这是循环的关键
7. **如果主人说"停止开发循环"** — 不创建新cron，更新状态为 "stopped"
8. **delete-after-run** — 每个cron执行完自动删除，避免堆积
9. **深度审视优先** — 先审视已有功能完成状态，再决定是深化还是做新功能
10. **玩法和体验要细致打磨** — 不仅做功能，更要打磨手感和体验感