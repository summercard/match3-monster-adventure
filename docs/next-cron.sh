#!/bin/bash
# 自动创建下一个开发循环 cron
# 用法: next-cron.sh plan|code
MODE=$1
if [ "$MODE" = "plan" ]; then
  openclaw cron add \
    --name "minigame-plan" \
    --at "$(date -u -v+6M +%Y-%m-%dT%H:%M:%SZ)" \
    --session isolated \
    --model "zai/glm-5" \
    --message "你是三消宝可梦微信小游戏的开发规划者。请读取 docs/cron-tasks.md 中 Task 1 的模板，严格按照模板执行。项目路径: /Users/summercards/WeChatProjects/minigame-1。完成后执行: bash docs/next-cron.sh code" \
    --timeout-seconds 600 \
    --delete-after-run \
    --announce \
    --channel feishu
elif [ "$MODE" = "code" ]; then
  openclaw cron add \
    --name "minigame-dev" \
    --at "$(date -u -v+6M +%Y-%m-%dT%H:%M:%SZ)" \
    --session isolated \
    --model "zai/glm-5" \
    --message "你是三消宝可梦微信小游戏的开发者。请读取 docs/cron-tasks.md 中 Task 2 的模板，严格按照模板执行。项目路径: /Users/summercards/WeChatProjects/minigame-1。完成后执行: bash docs/next-cron.sh plan" \
    --timeout-seconds 600 \
    --delete-after-run \
    --announce \
    --channel feishu
fi
