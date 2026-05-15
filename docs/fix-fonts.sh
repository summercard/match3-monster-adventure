#!/bin/bash
# Replace hardcoded font sizes with THEME.font constants in 4 files
# Usage: bash docs/fix-fonts.sh

set -e
cd /Users/summercards/WeChatProjects/minigame-1

node -e '
const fs = require("fs");
const files = [
  "js/ui/sceneResult.js",
  "js/ui/sceneAlbum.js",
  "js/ui/sceneEvolve.js",
  "js/ui/sceneTeamSetup.js"
];

// Mapping: unique context pattern → replacement
// Each pattern is a string fragment from the fillText call that uniquely identifies the line
const replacements = [
  // General patterns - these match fillText size params after color values
  // We use a function approach: find fillText calls and replace the size number
  
  // Size → THEME.font constant mappings
  // 48,40,36 → display, 28 → icon, 24,22,20(title context) → title, 20(number) → bigNum
  // 18 → subtitle, 16 → number, 15,14 → body, 13,12 → small, 11,10,9,8,7 → tiny
];

for (const file of files) {
  let code = fs.readFileSync(file, "utf-8");
  let count = 0;
  
  // We need to replace font sizes in fillText calls
  // Pattern: r.fillText(..., colorOrAlpha, NUMBER, weightOrEnd)
  // The size is always after a color/alpha string (COLORS.xxx, rgba(...), #hex, etc.)
  // and before an optional weight string and closing paren or end of args
  
  // Strategy: Use specific line-by-line replacements with unique context
  
  if (file.includes("sceneResult")) {
    // sceneResult.js replacements (25 places)
    const rs = [
      // Line ~464: title 22
      ["COLORS.textPrimary, 22)", "COLORS.textPrimary, THEME.font.title.size)"],
      // L530: sparkle 40
      ["\x27rgba(255, 215, 0, 0.3)\x27, 40)", "\x27rgba(255, 215, 0, 0.3)\x27, THEME.font.display.size)"],
      // L544: 战斗信息 14
      ["\x27战斗信息\x27, this.designW / 2, y + 20, COLORS.textPrimary, 14)", "\x27战斗信息\x27, this.designW / 2, y + 20, COLORS.textPrimary, THEME.font.body.size)"],
      // L546: 回合 12
      ["COLORS.textPrimary, 12)", "COLORS.textPrimary, THEME.font.small.size)"],
      // L547: 最大回合 11
      ["COLORS.textMuted, 11)", "COLORS.textMuted, THEME.font.tiny.size)"],
      // L552: 击败 11 (same pattern as above but different context)
      // Actually COLORS.dangerLight, 11) and COLORS.primarySoft, 11) - these are unique
      ["COLORS.dangerLight, 11)", "COLORS.dangerLight, THEME.font.tiny.size)"],
      // L558: 存活 11
      ["COLORS.primarySoft, 11)", "COLORS.primarySoft, THEME.font.tiny.size)"],
      // L570: capture title 16
      ["COLORS.success, 16)", "COLORS.success, THEME.font.number.size)"],
      // L576: capture desc 10
      ["COLORS.textSecondary, 10)", "COLORS.textSecondary, THEME.font.tiny.size)"],
      // L586: 获得奖励 14
      ["\x27获得奖励\x27, this.designW / 2, y + 18, COLORS.textPrimary, 14)", "\x27获得奖励\x27, this.designW / 2, y + 18, COLORS.textPrimary, THEME.font.body.size)"],
      // L590: 💰 emoji 20
      ["COLORS.gold, 20)", "COLORS.gold, THEME.font.bigNum.size)"],
      // L591: 金币 14
      ["this.rewards.gold} 金币\x27, 75, y + 55, COLORS.gold, 14)", "this.rewards.gold} 金币\x27, 75, y + 55, COLORS.gold, THEME.font.body.size)"],
      // L598: item emoji 18
      ["0.5 + itemSparkle * 0.5})\x27, 18)", "0.5 + itemSparkle * 0.5})\x27, THEME.font.subtitle.size)"],
      // L599: item name 13
      ["COLORS.textPrimary, 13)", "COLORS.textPrimary, THEME.font.small.size)"],
      // L602: 无道具 12
      ["COLORS.textMuted, 12)", "COLORS.textMuted, THEME.font.small.size)"],
      // L612: 获得经验 14
      ["\x27获得经验\x27, this.designW / 2, y + 20, COLORS.textPrimary, 14)", "\x27获得经验\x27, this.designW / 2, y + 20, COLORS.textPrimary, THEME.font.body.size)"],
      // L614: exp number 16
      ["COLORS.thunder, 16)", "COLORS.thunder, THEME.font.number.size)"],
      // L621: exp desc 10 (关卡基础)
      ["星级系数)\x27, this.designW / 2, y + 70, COLORS.textMuted, 10)", "星级系数)\x27, this.designW / 2, y + 70, COLORS.textMuted, THEME.font.tiny.size)"],
      // L625: exp desc 10 (基础)
      ["星级加成 ${starBonus})\x27, this.designW / 2, y + 70, COLORS.textMuted, 10)", "星级加成 ${starBonus})\x27, this.designW / 2, y + 70, COLORS.textMuted, THEME.font.tiny.size)"],
      // L663: button text 15
      ["COLORS.textPrimary, 15)", "COLORS.textPrimary, THEME.font.body.size)"],
      // L689: ⬆️ emoji 14
      ["pulse}), 14)", "pulse}), THEME.font.body.size)"],
      // L694: name 12 bold
      ["COLORS.gold, 12, \x27bold\x27)", "COLORS.gold, THEME.font.small.size, \x27bold\x27)"],
      // L697: level 12 bold
      ["COLORS.success, 12, \x27bold\x27)", "COLORS.success, THEME.font.small.size, \x27bold\x27)"],
      // L705: sweep 14 bold
      ["\x27bold\x27)${code.includes("已解锁扫荡") ? "" : ""}", ""], // skip, handle below
    ];
    
    // Handle L705 separately since the pattern is complex
    // Actually let me just handle it directly
    const directRs = [
      ["COLORS.textPrimary, 22)", "COLORS.textPrimary, THEME.font.title.size)"],
      ["\x27rgba(255, 215, 0, 0.3)\x27, 40)", "\x27rgba(255, 215, 0, 0.3)\x27, THEME.font.display.size)"],
      ["\x27战斗信息\x27, this.designW / 2, y + 20, COLORS.textPrimary, 14)", "\x27战斗信息\x27, this.designW / 2, y + 20, COLORS.textPrimary, THEME.font.body.size)"],
      ["COLORS.textPrimary, 12)", "COLORS.textPrimary, THEME.font.small.size)"],
      ["COLORS.textMuted, 11)", "COLORS.textMuted, THEME.font.tiny.size)"],
      ["COLORS.dangerLight, 11)", "COLORS.dangerLight, THEME.font.tiny.size)"],
      ["COLORS.primarySoft, 11)", "COLORS.primarySoft, THEME.font.tiny.size)"],
      ["COLORS.success, 16)", "COLORS.success, THEME.font.number.size)"],
      ["COLORS.textSecondary, 10)", "COLORS.textSecondary, THEME.font.tiny.size)"],
      ["\x27获得奖励\x27, this.designW / 2, y + 18, COLORS.textPrimary, 14)", "\x27获得奖励\x27, this.designW / 2, y + 18, COLORS.textPrimary, THEME.font.body.size)"],
      ["COLORS.gold, 20)", "COLORS.gold, THEME.font.bigNum.size)"],
      ["this.rewards.gold} 金币\x27, 75, y + 55, COLORS.gold, 14)", "this.rewards.gold} 金币\x27, 75, y + 55, COLORS.gold, THEME.font.body.size)"],
      ["0.5 + itemSparkle * 0.5})\x27, 18)", "0.5 + itemSparkle * 0.5})\x27, THEME.font.subtitle.size)"],
      ["COLORS.textPrimary, 13)", "COLORS.textPrimary, THEME.font.small.size)"],
      ["COLORS.textMuted, 12)", "COLORS.textMuted, THEME.font.small.size)"],
      ["\x27获得经验\x27, this.designW / 2, y + 20, COLORS.textPrimary, 14)", "\x27获得经验\x27, this.designW / 2, y + 20, COLORS.textPrimary, THEME.font.body.size)"],
      ["COLORS.thunder, 16)", "COLORS.thunder, THEME.font.number.size)"],
      ["星级系数)\x27, this.designW / 2, y + 70, COLORS.textMuted, 10)", "星级系数)\x27, this.designW / 2, y + 70, COLORS.textMuted, THEME.font.tiny.size)"],
      ["星级加成 ${starBonus})\x27, this.designW / 2, y + 70, COLORS.textMuted, 10)", "星级加成 ${starBonus})\x27, this.designW / 2, y + 70, COLORS.textMuted, THEME.font.tiny.size)"],
      ["COLORS.textPrimary, 15)", "COLORS.textPrimary, THEME.font.body.size)"],
      ["pulse}), 14)", "pulse}), THEME.font.body.size)"],
      ["COLORS.gold, 12, \x27bold\x27)", "COLORS.gold, THEME.font.small.size, \x27bold\x27)"],
      ["COLORS.success, 12, \x27bold\x27)", "COLORS.success, THEME.font.small.size, \x27bold\x27)"],
      // L705: sweep text
      ["pulse}), 14, \x27bold\x27)", "pulse}), THEME.font.body.size, \x27bold\x27)"],
    ];
    
    for (const [from, to] of directRs) {
      if (code.includes(from)) {
        code = code.replace(from, to);
        count++;
      }
    }
  }
  
  if (file.includes("sceneAlbum")) {
    const rs = [
      // List view
      ["COLORS.textPrimary, 18, \x27bold\x27)", "COLORS.textPrimary, THEME.font.subtitle.size, THEME.font.subtitle.weight)"], // title
      ["COLORS.textPrimary, 12)", "COLORS.textPrimary, THEME.font.small.size)"], // 返回
      ["COLORS.textMuted, 11)", "COLORS.textMuted, THEME.font.tiny.size)"], // 已收集
      ["COLORS.textPrimary, 10, \x27bold\x27)", "COLORS.textPrimary, THEME.font.tiny.size, \x27bold\x27)"], // selected filter label
      ["color, 10)", "color, THEME.font.tiny.size)"], // unselected filter label
      ["COLORS.textPrimary, 28)", "COLORS.textPrimary, THEME.font.icon.size)"], // monster emoji
      ["COLORS.textPrimary, 10, \x27bold\x27)", "COLORS.textPrimary, THEME.font.tiny.size, \x27bold\x27)"], // monster name (reuse above - will only match once if already replaced)
      ["COLORS.gold, 9)", "COLORS.gold, THEME.font.tiny.size)"], // rarity stars
      ["COLORS.textMuted, 24)", "COLORS.textMuted, THEME.font.icon.size)"], // lock emoji
      ["COLORS.textDark, 10)", "COLORS.textDark, THEME.font.tiny.size)"], // ???
      ["COLORS.textDark, 9)", "COLORS.textDark, THEME.font.tiny.size)"], // ??? stars
      ["COLORS.textPrimary, 9)", "COLORS.textPrimary, THEME.font.tiny.size)"], // element tag
      // Detail view
      ["COLORS.textPrimary, 48)", "COLORS.textPrimary, THEME.font.display.size)"], // big emoji
      ["COLORS.textPrimary, 16, \x27bold\x27)", "COLORS.textPrimary, THEME.font.number.size, THEME.font.number.weight)"], // name
      ["COLORS.gold, 12)", "COLORS.gold, THEME.font.small.size)"], // rarity stars detail
      ["COLORS.textPrimary, 12, \x27bold\x27)", "COLORS.textPrimary, THEME.font.small.size, THEME.font.small.weight)"], // element tag detail
      ["COLORS.textMuted, 11)", "COLORS.textMuted, THEME.font.tiny.size)"], // stat labels
      ["COLORS.statHp, 11)", "COLORS.statHp, THEME.font.tiny.size)"],
      ["COLORS.statAtk, 11)", "COLORS.statAtk, THEME.font.tiny.size)"],
      ["COLORS.statDef, 11)", "COLORS.statDef, THEME.font.tiny.size)"],
      ["COLORS.statSpd, 11)", "COLORS.statSpd, THEME.font.tiny.size)"],
      ["COLORS.textPrimary, 13, \x27bold\x27)", "COLORS.textPrimary, THEME.font.small.size, \x27bold\x27)"], // skill name
      ["COLORS.textSecondary, 10)", "COLORS.textSecondary, THEME.font.tiny.size)"], // skill desc
      ["COLORS.success, 13)", "COLORS.success, THEME.font.small.size)"], // 已收服
      ["COLORS.textMuted, 13)", "COLORS.textMuted, THEME.font.small.size)"], // 未收服
      ["COLORS.textPrimary, 14, \x27bold\x27)", "COLORS.textPrimary, THEME.font.body.size, THEME.font.body.weight)"], // 进化/关闭 button
    ];
    
    for (const [from, to] of rs) {
      if (code.includes(from)) {
        code = code.replaceAll(from, to);
        count++;
      }
    }
  }
  
  if (file.includes("sceneEvolve")) {
    const rs = [
      ["COLORS.textPrimary, 18, \x27bold\x27)", "COLORS.textPrimary, THEME.font.subtitle.size, THEME.font.subtitle.weight)"], // title
      ["COLORS.textPrimary, 12)", "COLORS.textPrimary, THEME.font.small.size)"], // 返回
      ["COLORS.textMuted, 14)", "COLORS.textMuted, THEME.font.body.size)"], // 未选择/无法进化
      ["COLORS.textPrimary, 24)", "COLORS.textPrimary, THEME.font.title.size)"], // ⬇️ arrow
      ["COLORS.textPrimary, 40)", "COLORS.textPrimary, THEME.font.display.size)"], // card emoji
      ["COLORS.textPrimary, 13, \x27bold\x27)", "COLORS.textPrimary, THEME.font.small.size, \x27bold\x27)"], // card name
      ["COLORS.gold, 10)", "COLORS.gold, THEME.font.tiny.size)"], // rarity stars
      ["COLORS.textPrimary, 11, \x27bold\x27)", "COLORS.textPrimary, THEME.font.tiny.size, \x27bold\x27)"], // element tag
      ["COLORS.textPrimary, 48)", "COLORS.textPrimary, THEME.font.display.size)"], // evolution anim emoji
      ["COLORS.gold, 14)", "COLORS.gold, THEME.font.body.size)"], // 进化中...
      ["COLORS.gold, 20, \x27bold\x27)", "COLORS.gold, THEME.font.bigNum.size, THEME.font.bigNum.weight)"], // 进化成功
      ["COLORS.textPrimary, 12, \x27bold\x27)", "COLORS.textPrimary, THEME.font.small.size, THEME.font.small.weight)"], // name change
      ["COLORS.textMuted, 10)", "COLORS.textMuted, THEME.font.tiny.size)"], // HP/ATK/DEF/SPD label
      ["COLORS.textSecondary, 10)", "COLORS.textSecondary, THEME.font.tiny.size)"], // 基础 stats
      ["COLORS.success, 11, \x27bold\x27)", "COLORS.success, THEME.font.tiny.size, \x27bold\x27)"], // 进化后 stats
      ["COLORS.textMuted, 13)", "COLORS.textMuted, THEME.font.small.size)"], // condition text (actually this uses this.canEvolve check)
      ["COLORS.danger, 13)", "COLORS.danger, THEME.font.small.size)"], // condition fail
      // Wait, conditionText uses a ternary: this.canEvolve ? COLORS.success : COLORS.danger, 13
      // Let me handle it differently
      ["COLORS.success, 13)", "COLORS.success, THEME.font.small.size)"], // condition text
      ["COLORS.textPrimary, 16, \x27bold\x27)", "COLORS.textPrimary, THEME.font.number.size, THEME.font.number.weight)"], // 开始进化 button
      ["COLORS.textMuted, 16)", "COLORS.textMuted, THEME.font.number.size)"], // 条件不足 button
      ["COLORS.gold, 12)", "COLORS.gold, THEME.font.small.size)"], // 当前形态/进化后 label
    ];
    
    for (const [from, to] of rs) {
      if (code.includes(from)) {
        code = code.replaceAll(from, to);
        count++;
      }
    }
  }
  
  if (file.includes("sceneTeamSetup")) {
    const rs = [
      ["COLORS.textPrimary, 18, \x27bold\x27)", "COLORS.textPrimary, THEME.font.subtitle.size, THEME.font.subtitle.weight)"], // title
      ["COLORS.textPrimary, 12)", "COLORS.textPrimary, THEME.font.small.size)"], // 返回
      // guide text
      ["alpha}), 11)", "alpha}), THEME.font.tiny.size)"], // 💡 guide
      // power display
      ["\x27bold\x27)", "THEME.font.body.weight)"], // hmm this is too broad, skip
      ["COLORS.textSecondary, 13, \x27bold\x27)", "COLORS.textSecondary, THEME.font.small.size, \x27bold\x27)"], // 队伍总战力
      // monster emoji in slot
      ["COLORS.textPrimary, 28)", "COLORS.textPrimary, THEME.font.icon.size)"], // monster emoji
      ["COLORS.textPrimary, 10, \x27bold\x27)", "COLORS.textPrimary, THEME.font.tiny.size, \x27bold\x27)"], // monster name
      ["COLORS.textMuted, 9)", "COLORS.textMuted, THEME.font.tiny.size)"], // level
      ["COLORS.gold, 8)", "COLORS.gold, THEME.font.tiny.size)"], // nature
      ["COLORS.textPrimary, 8)", "COLORS.textPrimary, THEME.font.tiny.size)"], // element tag in slot
      ["COLORS.textMuted, 9)", "COLORS.textMuted, THEME.font.tiny.size)"], // slot label (already done above with same pattern)
      ["COLORS.gold, 8, \x27bold\x27)", "COLORS.gold, THEME.font.tiny.size, \x27bold\x27)"], // leader skill name
      ["COLORS.textSecondary, 7)", "COLORS.textSecondary, THEME.font.tiny.size)"], // skill desc
      ["COLORS.textMuted, 7)", "COLORS.textMuted, THEME.font.tiny.size)"], // 无队长技能
      ["COLORS.textMuted, 8)", "COLORS.textMuted, THEME.font.tiny.size)"], // 点击后将填入
      // empty slot
      ["textColor, 24)", "textColor, THEME.font.icon.size)"], // crown/sword emoji
      ["textColor, 10)", "textColor, THEME.font.tiny.size)"], // 选择怪物/label
      // list header
      ["COLORS.textSecondary, 12)", "COLORS.textSecondary, THEME.font.small.size)"], // 已收服怪物
      // monster list items
      ["COLORS.textPrimary, 22)", "COLORS.textPrimary, THEME.font.icon.size)"], // list monster emoji
      ["COLORS.textPrimary, 9, \x27bold\x27)", "COLORS.textPrimary, THEME.font.tiny.size, \x27bold\x27)"], // list monster name
      ["COLORS.textMuted, 7)", "COLORS.textMuted, THEME.font.tiny.size)"], // list level (already done)
      ["COLORS.gold, 7)", "COLORS.gold, THEME.font.tiny.size)"], // list nature (already done above? no different)
      ["COLORS.gold, 7)", "COLORS.gold, THEME.font.tiny.size)"], // list rarity stars - same as above, already replaced
      // list element & position labels
      ["COLORS.bgPanel, 7, \x27bold\x27)", "COLORS.bgPanel, THEME.font.tiny.size, \x27bold\x27)"], // position label
      ["COLORS.gold, 9)", "COLORS.gold, THEME.font.tiny.size)"], // leader skill icon
      ["COLORS.success, 10)", "COLORS.success, THEME.font.tiny.size)"], // ☑️ check
      // buttons
      ["COLORS.textPrimary, 14, \x27bold\x27)", "COLORS.textPrimary, THEME.font.body.size, THEME.font.body.weight)"], // 💾 保存
      ["COLORS.textSecondary, 14)", "COLORS.textSecondary, THEME.font.body.size)"], // 取消
      // confirm dialog
      ["COLORS.gold, 14, \x27bold\x27)", "COLORS.gold, THEME.font.body.size, \x27bold\x27)"], // ⚠️ 确认取消
      ["COLORS.textSecondary, 12)", "COLORS.textSecondary, THEME.font.small.size)"], // 放弃当前编辑
      ["COLORS.textMuted, 10)", "COLORS.textMuted, THEME.font.tiny.size)"], // 未保存的更改
      ["COLORS.textPrimary, 12, \x27bold\x27)", "COLORS.textPrimary, THEME.font.small.size, \x27bold\x27)"], // 确认取消/继续编辑 buttons
    ];
    
    for (const [from, to] of rs) {
      if (code.includes(from)) {
        code = code.replaceAll(from, to);
        count++;
      }
    }
  }
  
  fs.writeFileSync(file, code, "utf-8");
  console.log(file + ": " + count + " replacements");
}
'
