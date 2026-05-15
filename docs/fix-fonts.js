// Replace hardcoded font sizes with THEME.font constants
const fs = require('fs');
const dir = '/Users/summercards/WeChatProjects/minigame-1';

// Each entry: [file, array of [search, replace] pairs]
const work = [
  ['js/ui/sceneResult.js', [
    // L464: title 22
    ["COLORS.textPrimary, 22)", "COLORS.textPrimary, THEME.font.title.size)"],
    // L530: sparkle 40
    ["'rgba(255, 215, 0, 0.3)', 40)", "'rgba(255, 215, 0, 0.3)', THEME.font.display.size)"],
    // L544: 战斗信息 14
    ["'战斗信息', this.designW / 2, y + 20, COLORS.textPrimary, 14)", "'战斗信息', this.designW / 2, y + 20, COLORS.textPrimary, THEME.font.body.size)"],
    // L546: 回合 12
    ["COLORS.textPrimary, 12)", "COLORS.textPrimary, THEME.font.small.size)"],
    // L547: 最大回合 11
    ["COLORS.textMuted, 11)", "COLORS.textMuted, THEME.font.tiny.size)"],
    // L552: 击败 11
    ["COLORS.dangerLight, 11)", "COLORS.dangerLight, THEME.font.tiny.size)"],
    // L558: 存活 11
    ["COLORS.primarySoft, 11)", "COLORS.primarySoft, THEME.font.tiny.size)"],
    // L570: capture title 16
    ["COLORS.success, 16)", "COLORS.success, THEME.font.number.size)"],
    // L576: capture desc 10
    ["COLORS.textSecondary, 10)", "COLORS.textSecondary, THEME.font.tiny.size)"],
    // L586: 获得奖励 14
    ["'获得奖励', this.designW / 2, y + 18, COLORS.textPrimary, 14)", "'获得奖励', this.designW / 2, y + 18, COLORS.textPrimary, THEME.font.body.size)"],
    // L590: 💰 emoji 20
    ["COLORS.gold, 20)", "COLORS.gold, THEME.font.bigNum.size)"],
    // L591: 金币 14
    ["y + 55, COLORS.gold, 14)", "y + 55, COLORS.gold, THEME.font.body.size)"],
    // L598: item emoji 18
    ["0.5 + itemSparkle * 0.5})', 18)", "0.5 + itemSparkle * 0.5})', THEME.font.subtitle.size)"],
    // L599: item name 13
    ["COLORS.textPrimary, 13)", "COLORS.textPrimary, THEME.font.small.size)"],
    // L602: 无道具 12
    ["COLORS.textMuted, 12)", "COLORS.textMuted, THEME.font.small.size)"],
    // L612: 获得经验 14
    ["'获得经验', this.designW / 2, y + 20, COLORS.textPrimary, 14)", "'获得经验', this.designW / 2, y + 20, COLORS.textPrimary, THEME.font.body.size)"],
    // L614: exp number 16
    ["COLORS.thunder, 16)", "COLORS.thunder, THEME.font.number.size)"],
    // L621: exp desc 10
    ["y + 70, COLORS.textMuted, 10)", "y + 70, COLORS.textMuted, THEME.font.tiny.size)"],
    // L663: button text 15
    ["COLORS.textPrimary, 15)", "COLORS.textPrimary, THEME.font.body.size)"],
    // L689: ⬆️ 14
    ["pulse}), 14)", "pulse}), THEME.font.body.size)"],
    // L694: name 12 bold
    ["COLORS.gold, 12, 'bold')", "COLORS.gold, THEME.font.small.size, 'bold')"],
    // L697: level 12 bold
    ["COLORS.success, 12, 'bold')", "COLORS.success, THEME.font.small.size, 'bold')"],
    // L705: sweep 14 bold
    ["pulse}), 14, 'bold')", "pulse}), THEME.font.body.size, 'bold')"],
  ]],
  ['js/ui/sceneAlbum.js', [
    // === List view ===
    // L241: title 18 bold
    ["COLORS.textPrimary, 18, 'bold')", "COLORS.textPrimary, THEME.font.subtitle.size, THEME.font.subtitle.weight)"],
    // L245: 返回 12
    ["COLORS.textPrimary, 12)", "COLORS.textPrimary, THEME.font.small.size)"],
    // L251: 已收集 11
    ["COLORS.textMuted, 11)", "COLORS.textMuted, THEME.font.tiny.size)"],
    // L266: selected filter 10 bold
    ["COLORS.textPrimary, 10, 'bold')", "COLORS.textPrimary, THEME.font.tiny.size, 'bold')"],
    // L270: unselected filter 10
    ["color, 10)", "color, THEME.font.tiny.size)"],
    // L287: monster emoji 28
    ["COLORS.textPrimary, 28)", "COLORS.textPrimary, THEME.font.icon.size)"],
    // L289: monster name 10 bold (same as filter - but already replaced above, this handles remaining)
    ["COLORS.textPrimary, 10, 'bold')", "COLORS.textPrimary, THEME.font.tiny.size, 'bold')"],
    // L291: rarity stars 9
    ["COLORS.gold, 9)", "COLORS.gold, THEME.font.tiny.size)"],
    // L293: lock emoji 24
    ["COLORS.textMuted, 24)", "COLORS.textMuted, THEME.font.icon.size)"],
    // L294: ??? name 10
    ["COLORS.textDark, 10)", "COLORS.textDark, THEME.font.tiny.size)"],
    // L295: ??? stars 9
    ["COLORS.textDark, 9)", "COLORS.textDark, THEME.font.tiny.size)"],
    // L298: element tag 9
    ["COLORS.textPrimary, 9)", "COLORS.textPrimary, THEME.font.tiny.size)"],
    // === Detail view ===
    // L318: title 18 bold (same as list - already replaced)
    // L322: 返回 12 (same - already replaced)
    // L334: big emoji 48
    ["COLORS.textPrimary, 48)", "COLORS.textPrimary, THEME.font.display.size)"],
    // L337: name 16 bold
    ["COLORS.textPrimary, 16, 'bold')", "COLORS.textPrimary, THEME.font.number.size, THEME.font.number.weight)"],
    // L340: rarity 12
    ["COLORS.gold, 12)", "COLORS.gold, THEME.font.small.size)"],
    // L344: element tag 12 bold
    ["COLORS.textPrimary, 12, 'bold')", "COLORS.textPrimary, THEME.font.small.size, THEME.font.small.weight)"],
    // L350: stat labels HP/ATK/DEF/SPD 11
    ["COLORS.textMuted, 11)", "COLORS.textMuted, THEME.font.tiny.size)"],
    // L351-354: stat values 11
    ["COLORS.statHp, 11)", "COLORS.statHp, THEME.font.tiny.size)"],
    ["COLORS.statAtk, 11)", "COLORS.statAtk, THEME.font.tiny.size)"],
    ["COLORS.statDef, 11)", "COLORS.statDef, THEME.font.tiny.size)"],
    ["COLORS.statSpd, 11)", "COLORS.statSpd, THEME.font.tiny.size)"],
    // L360: 技能 label 11 (same COLORS.textMuted, 11 - already done)
    // L361: skill name 13 bold
    ["COLORS.textPrimary, 13, 'bold')", "COLORS.textPrimary, THEME.font.small.size, 'bold')"],
    // L362: skill desc 10
    ["COLORS.textSecondary, 10)", "COLORS.textSecondary, THEME.font.tiny.size)"],
    // L366: 已收服 13
    ["COLORS.success, 13)", "COLORS.success, THEME.font.small.size)"],
    // L368: 未收服 13
    ["COLORS.textMuted, 13)", "COLORS.textMuted, THEME.font.small.size)"],
    // L376: 进化 button 14 bold
    ["COLORS.textPrimary, 14, 'bold')", "COLORS.textPrimary, THEME.font.body.size, THEME.font.body.weight)"],
    // L384: 关闭 button 14
    ["COLORS.textPrimary, 14)", "COLORS.textPrimary, THEME.font.body.size)"],
  ]],
  ['js/ui/sceneEvolve.js', [
    // title 18 bold
    ["COLORS.textPrimary, 18, 'bold')", "COLORS.textPrimary, THEME.font.subtitle.size, THEME.font.subtitle.weight)"],
    // 返回 12
    ["COLORS.textPrimary, 12)", "COLORS.textPrimary, THEME.font.small.size)"],
    // 未选择/无法进化 14
    ["COLORS.textMuted, 14)", "COLORS.textMuted, THEME.font.body.size)"],
    // 当前形态/进化后 label 12
    ["COLORS.gold, 12)", "COLORS.gold, THEME.font.small.size)"],
    // card emoji 40
    ["COLORS.textPrimary, 40)", "COLORS.textPrimary, THEME.font.display.size)"],
    // card name 13 bold
    ["COLORS.textPrimary, 13, 'bold')", "COLORS.textPrimary, THEME.font.small.size, 'bold')"],
    // rarity stars 10
    ["COLORS.gold, 10)", "COLORS.gold, THEME.font.tiny.size)"],
    // element tag 11 bold
    ["COLORS.textPrimary, 11, 'bold')", "COLORS.textPrimary, THEME.font.tiny.size, 'bold')"],
    // ⬇️ arrow 24
    ["COLORS.textPrimary, 24)", "COLORS.textPrimary, THEME.font.title.size)"],
    // condition text 13 (success)
    ["COLORS.success, 13)", "COLORS.success, THEME.font.small.size)"],
    // condition text 13 (danger)
    ["COLORS.danger, 13)", "COLORS.danger, THEME.font.small.size)"],
    // 开始进化 button 16 bold
    ["COLORS.textPrimary, 16, 'bold')", "COLORS.textPrimary, THEME.font.number.size, THEME.font.number.weight)"],
    // 条件不足 16
    ["COLORS.textMuted, 16)", "COLORS.textMuted, THEME.font.number.size)"],
    // evolution anim emoji 48
    ["COLORS.textPrimary, 48)", "COLORS.textPrimary, THEME.font.display.size)"],
    // 进化中... 14
    ["COLORS.gold, 14)", "COLORS.gold, THEME.font.body.size)"],
    // 进化成功! 20 bold
    ["COLORS.gold, 20, 'bold')", "COLORS.gold, THEME.font.bigNum.size, THEME.font.bigNum.weight)"],
    // name change 12 bold
    ["COLORS.textPrimary, 12, 'bold')", "COLORS.textPrimary, THEME.font.small.size, THEME.font.small.weight)"],
    // HP/ATK/DEF/SPD label 10
    ["COLORS.textMuted, 10)", "COLORS.textMuted, THEME.font.tiny.size)"],
    // 基础 stats 10
    ["COLORS.textSecondary, 10)", "COLORS.textSecondary, THEME.font.tiny.size)"],
    // 进化后 stats 11 bold
    ["COLORS.success, 11, 'bold')", "COLORS.success, THEME.font.tiny.size, 'bold')"],
    // 返回图鉴 button 16 bold
    ["COLORS.textPrimary, 16, 'bold')", "COLORS.textPrimary, THEME.font.number.size, THEME.font.number.weight)"],
  ]],
  ['js/ui/sceneTeamSetup.js', [
    // title 18 bold
    ["COLORS.textPrimary, 18, 'bold')", "COLORS.textPrimary, THEME.font.subtitle.size, THEME.font.subtitle.weight)"],
    // 返回 12
    ["COLORS.textPrimary, 12)", "COLORS.textPrimary, THEME.font.small.size)"],
    // guide text 11
    ["alpha}), 11)", "alpha}), THEME.font.tiny.size)"],
    // 队伍总战力 13 bold
    ["COLORS.textSecondary, 13, 'bold')", "COLORS.textSecondary, THEME.font.small.size, 'bold')"],
    // monster emoji in slot 28
    ["COLORS.textPrimary, 28)", "COLORS.textPrimary, THEME.font.icon.size)"],
    // monster name 10 bold
    ["COLORS.textPrimary, 10, 'bold')", "COLORS.textPrimary, THEME.font.tiny.size, 'bold')"],
    // level 9
    ["COLORS.textMuted, 9)", "COLORS.textMuted, THEME.font.tiny.size)"],
    // nature 8
    ["COLORS.gold, 8)", "COLORS.gold, THEME.font.tiny.size)"],
    // element tag in slot 8
    ["COLORS.textPrimary, 8)", "COLORS.textPrimary, THEME.font.tiny.size)"],
    // slot label 9 (same as level - COLORS.textMuted, 9 already replaced)
    // leader skill name 8 bold
    ["COLORS.gold, 8, 'bold')", "COLORS.gold, THEME.font.tiny.size, 'bold')"],
    // skill desc 7
    ["COLORS.textSecondary, 7)", "COLORS.textSecondary, THEME.font.tiny.size)"],
    // 无队长技能 7
    ["COLORS.textMuted, 7)", "COLORS.textMuted, THEME.font.tiny.size)"],
    // 点击后将填入 8
    ["COLORS.textMuted, 8)", "COLORS.textMuted, THEME.font.tiny.size)"],
    // empty slot emoji 24
    ["textColor, 24)", "textColor, THEME.font.icon.size)"],
    // empty slot label 10
    ["textColor, 10)", "textColor, THEME.font.tiny.size)"],
    // 已收服怪物 12
    ["COLORS.textSecondary, 12)", "COLORS.textSecondary, THEME.font.small.size)"],
    // list monster emoji 22
    ["COLORS.textPrimary, 22)", "COLORS.textPrimary, THEME.font.icon.size)"],
    // list monster name 9 bold
    ["COLORS.textPrimary, 9, 'bold')", "COLORS.textPrimary, THEME.font.tiny.size, 'bold')"],
    // list element name 9
    ["COLORS.textMuted, 9)", "COLORS.textMuted, THEME.font.tiny.size)"],  // already replaced
    // list rarity 7
    ["COLORS.gold, 7)", "COLORS.gold, THEME.font.tiny.size)"],
    // position label 7 bold
    ["COLORS.bgPanel, 7, 'bold')", "COLORS.bgPanel, THEME.font.tiny.size, 'bold')"],
    // leader skill icon 9
    ["COLORS.gold, 9)", "COLORS.gold, THEME.font.tiny.size)"],
    // in team check 10
    ["COLORS.success, 10)", "COLORS.success, THEME.font.tiny.size)"],
    // 💾 保存 14 bold
    ["COLORS.textPrimary, 14, 'bold')", "COLORS.textPrimary, THEME.font.body.size, THEME.font.body.weight)"],
    // 取消 14
    ["COLORS.textSecondary, 14)", "COLORS.textSecondary, THEME.font.body.size)"],
    // ⚠️ 确认取消 14 bold
    ["COLORS.gold, 14, 'bold')", "COLORS.gold, THEME.font.body.size, 'bold')"],
    // 放弃当前编辑 12
    ["COLORS.textSecondary, 12)", "COLORS.textSecondary, THEME.font.small.size)"],
    // 未保存 10
    ["COLORS.textMuted, 10)", "COLORS.textMuted, THEME.font.tiny.size)"],
    // 确认取消/继续编辑 12 bold
    ["COLORS.textPrimary, 12, 'bold')", "COLORS.textPrimary, THEME.font.small.size, 'bold')"],
  ]],
];

let totalReplacements = 0;
for (const [file, pairs] of work) {
  const path = dir + '/' + file;
  let code = fs.readFileSync(path, 'utf-8');
  let fileCount = 0;
  for (const [search, replace] of pairs) {
    if (code.includes(search)) {
      // Use split/join for global replacement
      const before = code;
      code = code.split(search).join(replace);
      const instances = (before.length - code.length) / (search.length - replace.length);
      fileCount += Math.abs(instances) > 0 ? Math.abs(instances) : 1;
    } else {
      console.log(`  SKIP (not found): ${file}: ${search.substring(0, 40)}...`);
    }
  }
  fs.writeFileSync(path, code, 'utf-8');
  console.log(`${file}: ${fileCount} replacements done`);
  totalReplacements += fileCount;
}
console.log(`\nTotal: ${totalReplacements} replacements across ${work.length} files`);
