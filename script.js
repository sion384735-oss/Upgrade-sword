const MAX_LEVEL = 20;
const MAX_MONSTER_LEVEL = 10;
const BATTLE_TIME_LIMIT = 20;
const ATTACK_INTERVAL_MS = 450;
const BALANCE_VERSION = 2;
const STORAGE_KEY = "sword-upgrade-save";

const state = {
  gold: 150,
  level: 0,
  best: 0,
  destroyed: false,
  monsterLevel: 1,
  unlockedMonsterLevel: 1,
  monsterHp: 0,
  balanceVersion: BALANCE_VERSION,
};

let autoAttackTimer = null;
let autoEnhanceTimer = null;
let battleTimer = null;
let battleTimeLeft = BATTLE_TIME_LIMIT;
let lastAttackAt = 0;

const elements = {
  stage: document.querySelector(".stage"),
  upgradeView: document.querySelector("#upgradeView"),
  battleView: document.querySelector("#battleView"),
  sword: document.querySelector("#sword"),
  swordName: document.querySelector("#swordName"),
  levelBadge: document.querySelector("#levelBadge"),
  gold: document.querySelector("#gold"),
  cost: document.querySelector("#cost"),
  chance: document.querySelector("#chance"),
  breakChance: document.querySelector("#breakChance"),
  best: document.querySelector("#best"),
  monsterLevel: document.querySelector("#monsterLevel"),
  message: document.querySelector("#message"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  riskText: document.querySelector("#riskText"),
  log: document.querySelector("#log"),
  enhanceButton: document.querySelector("#enhanceButton"),
  autoEnhanceButton: document.querySelector("#autoEnhanceButton"),
  enhanceTargetInput: document.querySelector("#enhanceTargetInput"),
  workButton: document.querySelector("#workButton"),
  resetButton: document.querySelector("#resetButton"),
  backButton: document.querySelector("#backButton"),
  stayButton: document.querySelector("#stayButton"),
  attackButton: document.querySelector("#attackButton"),
  autoAttackButton: document.querySelector("#autoAttackButton"),
  monsterPrevButton: document.querySelector("#monsterPrevButton"),
  monsterNextButton: document.querySelector("#monsterNextButton"),
  monsterStageReadout: document.querySelector("#monsterStageReadout"),
  monster: document.querySelector("#monster"),
  attackSword: document.querySelector("#attackSword"),
  coinLayer: document.querySelector("#coinLayer"),
  monsterName: document.querySelector("#monsterName"),
  monsterStage: document.querySelector("#monsterStage"),
  monsterHpText: document.querySelector("#monsterHpText"),
  monsterReward: document.querySelector("#monsterReward"),
  monsterHpBar: document.querySelector("#monsterHpBar"),
  battleTimer: document.querySelector("#battleTimer"),
  battleTimeBar: document.querySelector("#battleTimeBar"),
  attackPower: document.querySelector("#attackPower"),
  attackStat: document.querySelector("#attackStat"),
  battleMessage: document.querySelector("#battleMessage"),
};

const swordTitles = [
  "낡은 철검",
  "견고한 철검",
  "푸른 강철검",
  "기사의 장검",
  "왕국의 명검",
  "별빛 성검",
];

const monsterNames = [
  "초록 슬라임",
  "동굴 박쥐",
  "떠돌이 고블린",
  "해골 병사",
  "검은 늑대",
  "오크 전사",
  "강철 골렘",
  "화염 기사",
  "어둠의 마법사",
  "고대 드래곤",
];

const monsterRewardTable = [0, 100, 900, 3000, 9000, 25000, 70000, 180000, 450000, 1100000, 3000000];
const monsterHpTable = monsterRewardTable.map((reward) => reward * 6);

function getCost(level) {
  return Math.floor(80 + level * level * 35 + level * 45);
}

function getChance(level) {
  return Math.max(12, Math.floor(95 - level * 4.2));
}

function getBreakChance(level) {
  if (level >= 15) return 55;
  if (level >= 11) return 35;
  return 0;
}

function getRiskText(level) {
  if (level <= 10) return "실패해도 단계가 유지됩니다.";
  if (level < 15) return "실패하면 35% 확률로 검이 파괴됩니다.";
  return "실패하면 55% 확률로 검이 파괴됩니다.";
}

function getSwordTitle(level) {
  const index = Math.min(swordTitles.length - 1, Math.floor(level / 4));
  return swordTitles[index];
}

function getSwordImagePath(level) {
  const imageLevel = Math.min(20, level + 1);
  return `assets/swords/cutouts/sword-${String(imageLevel).padStart(2, "0")}.png`;
}

function getMonsterImagePath(level) {
  return `assets/monsters/monster-${String(level).padStart(2, "0")}.png`;
}

function getMonsterMaxHp(level) {
  return monsterHpTable[clampMonsterLevel(level)];
}

function getMonsterReward(level) {
  return monsterRewardTable[clampMonsterLevel(level)];
}

function getDamageRange() {
  const level = state.level;
  const targetMonster = getRecommendedMonsterLevel(level);
  if (targetMonster === 0) return { min: 3, max: 5 };

  const targetHp = getMonsterMaxHp(targetMonster);
  const levelBonus = Math.max(0, level - getMinimumSwordLevelForMonster(targetMonster));
  const bonusRate = 1 + levelBonus * 0.08;
  const min = Math.floor((targetHp / 42) * bonusRate);
  const max = Math.floor((targetHp / 35) * bonusRate);
  return { min, max };
}

function getPlayerDamage() {
  const { min, max } = getDamageRange();
  return Math.floor(min + Math.random() * (max - min + 1));
}

function clampMonsterLevel(level) {
  if (!Number.isFinite(level)) return 1;
  return Math.min(MAX_MONSTER_LEVEL, Math.max(1, Math.round(level)));
}

function getRecommendedMonsterLevel(swordLevel) {
  if (swordLevel >= 20) return 10;
  if (swordLevel >= 18) return 9;
  if (swordLevel >= 16) return 8;
  if (swordLevel >= 14) return 7;
  if (swordLevel >= 12) return 6;
  if (swordLevel >= 10) return 5;
  if (swordLevel >= 8) return 4;
  if (swordLevel >= 6) return 3;
  if (swordLevel >= 4) return 2;
  if (swordLevel >= 1) return 1;
  return 0;
}

function getMinimumSwordLevelForMonster(monsterLevel) {
  return [0, 1, 4, 6, 8, 10, 12, 14, 16, 18, 20][monsterLevel] ?? 20;
}

function clampEnhanceTarget(level) {
  if (!Number.isFinite(level)) return 1;
  return Math.min(MAX_LEVEL, Math.max(1, Math.round(level)));
}

function ensureMonsterHp() {
  const maxHp = getMonsterMaxHp(state.monsterLevel);
  if (!Number.isFinite(state.monsterHp) || state.monsterHp <= 0 || state.monsterHp > maxHp) {
    state.monsterHp = maxHp;
  }
}

function loadGame() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    state.gold = Number.isFinite(parsed.gold) ? parsed.gold : state.gold;
    state.level = Number.isFinite(parsed.level) ? parsed.level : state.level;
    state.best = Number.isFinite(parsed.best) ? parsed.best : state.best;
    state.destroyed = Boolean(parsed.destroyed);
    state.monsterLevel = Number.isFinite(parsed.monsterLevel)
      ? clampMonsterLevel(parsed.monsterLevel)
      : state.monsterLevel;
    state.unlockedMonsterLevel = Number.isFinite(parsed.unlockedMonsterLevel)
      ? clampMonsterLevel(parsed.unlockedMonsterLevel)
      : Math.max(1, state.monsterLevel);
    state.monsterLevel = Math.min(state.monsterLevel, state.unlockedMonsterLevel);
    state.balanceVersion = parsed.balanceVersion === BALANCE_VERSION ? BALANCE_VERSION : 0;
    state.monsterHp =
      state.balanceVersion === BALANCE_VERSION && Number.isFinite(parsed.monsterHp)
        ? parsed.monsterHp
        : 0;
    state.balanceVersion = BALANCE_VERSION;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveGame() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatGold(value) {
  return `${value.toLocaleString("ko-KR")} G`;
}

function setMessage(text, type = "") {
  elements.message.textContent = text;
  elements.upgradeView.classList.remove("success", "fail");
  if (type) {
    elements.upgradeView.classList.add(type);
    window.setTimeout(() => elements.upgradeView.classList.remove(type), 260);
  }
}

function setBattleMessage(text, type = "") {
  elements.battleMessage.textContent = text;
  elements.battleView.classList.remove("hit", "clear");
  if (type) {
    elements.battleView.classList.add(type);
    window.setTimeout(() => elements.battleView.classList.remove(type), 220);
  }
}

function addLog(text, type = "") {
  const item = document.createElement("li");
  item.className = type;
  item.textContent = text;
  elements.log.prepend(item);

  while (elements.log.children.length > 9) {
    elements.log.lastElementChild.remove();
  }
}

function render() {
  ensureMonsterHp();

  const cost = getCost(state.level);
  const chance = getChance(state.level);
  const progress = Math.round((state.level / MAX_LEVEL) * 100);
  const isMax = state.level >= MAX_LEVEL;
  const monsterMaxHp = getMonsterMaxHp(state.monsterLevel);
  const monsterProgress = Math.max(0, Math.round((state.monsterHp / monsterMaxHp) * 100));
  const damageRange = getDamageRange();

  elements.swordName.textContent = `${getSwordTitle(state.level)} +${state.level}`;
  elements.levelBadge.textContent = `+${state.level}`;
  elements.sword.style.backgroundImage = `url("${getSwordImagePath(state.level)}")`;
  elements.attackSword.style.backgroundImage = `url("${getSwordImagePath(state.level)}")`;
  elements.attackSword.style.setProperty("--attack-scale", 1 + Math.min(0.55, state.level * 0.025));
  elements.gold.textContent = formatGold(state.gold);
  elements.cost.textContent = isMax ? "완료" : formatGold(cost);
  elements.chance.textContent = isMax ? "100%" : `${chance}%`;
  elements.breakChance.textContent = isMax ? "0%" : `${getBreakChance(state.level)}%`;
  elements.best.textContent = `+${state.best}`;
  elements.monsterLevel.textContent = `${state.monsterLevel} / ${MAX_MONSTER_LEVEL}`;
  elements.attackStat.textContent = `${damageRange.min.toLocaleString("ko-KR")} ~ ${damageRange.max.toLocaleString("ko-KR")}`;
  elements.progressText.textContent = `${progress}%`;
  elements.progressBar.style.width = `${progress}%`;
  elements.riskText.textContent = isMax ? "최고 단계에 도달했습니다." : getRiskText(state.level);
  elements.enhanceButton.disabled = isMax || state.gold < cost;
  elements.enhanceButton.textContent = isMax ? "최고 강화" : "강화하기";
  elements.autoEnhanceButton.textContent = autoEnhanceTimer ? "자동 중지" : "자동 강화";
  elements.upgradeView.classList.toggle("auto", Boolean(autoEnhanceTimer));
  elements.upgradeView.classList.toggle("max", isMax);

  elements.monsterName.textContent = monsterNames[state.monsterLevel - 1];
  elements.monsterStage.textContent = `${state.monsterLevel} / ${MAX_MONSTER_LEVEL} 단계`;
  elements.monster.style.backgroundImage = `url("${getMonsterImagePath(state.monsterLevel)}")`;
  elements.monsterHpText.textContent = `HP ${state.monsterHp.toLocaleString("ko-KR")} / ${monsterMaxHp.toLocaleString("ko-KR")}`;
  elements.monsterReward.textContent = `보상 ${formatGold(getMonsterReward(state.monsterLevel))}`;
  elements.monsterHpBar.style.width = `${monsterProgress}%`;
  elements.battleTimer.textContent = `남은 시간 ${Math.ceil(battleTimeLeft)}초`;
  elements.battleTimeBar.style.width = `${Math.max(0, (battleTimeLeft / BATTLE_TIME_LIMIT) * 100)}%`;
  elements.attackPower.textContent = `공격력 ${damageRange.min.toLocaleString("ko-KR")} ~ ${damageRange.max.toLocaleString("ko-KR")}`;
  elements.monsterStageReadout.textContent = state.monsterLevel;
  elements.monsterPrevButton.disabled = state.monsterLevel <= 1;
  elements.monsterNextButton.disabled = state.monsterLevel >= state.unlockedMonsterLevel;
  elements.autoAttackButton.textContent = autoAttackTimer ? "자동 중지" : "자동 공격";
  elements.battleView.classList.toggle("auto", Boolean(autoAttackTimer));
}

function showBattle() {
  stopAutoEnhance();
  ensureMonsterHp();
  elements.upgradeView.classList.add("hidden");
  elements.battleView.classList.remove("hidden");
  setBattleMessage(`${monsterNames[state.monsterLevel - 1]}이 나타났습니다.`);
  startBattleTimer();
  render();
}

function showUpgrade() {
  stopAutoAttack();
  stopBattleTimer();
  elements.battleView.classList.add("hidden");
  elements.upgradeView.classList.remove("hidden");
  render();
}

function setMonsterStage(level) {
  const nextLevel = clampMonsterLevel(level);
  if (nextLevel > state.unlockedMonsterLevel) {
    setBattleMessage(`${state.unlockedMonsterLevel + 1}단계는 이전 몬스터를 처치해야 해금됩니다.`);
    return;
  }
  state.monsterLevel = nextLevel;
  state.monsterHp = getMonsterMaxHp(nextLevel);
  restartBattleTimer();
  setBattleMessage(`${monsterNames[nextLevel - 1]} ${nextLevel}단계로 변경했습니다.`);
  saveGame();
  render();
}

function changeMonsterStage(delta) {
  setMonsterStage(state.monsterLevel + delta);
}

function defeatMonster() {
  const defeatedLevel = state.monsterLevel;
  const earned = getMonsterReward(defeatedLevel);
  state.gold += earned;
  playCoinDrop(earned);

  if (defeatedLevel < MAX_MONSTER_LEVEL) {
    state.unlockedMonsterLevel = Math.max(state.unlockedMonsterLevel, defeatedLevel + 1);
  }

  state.monsterHp = getMonsterMaxHp(state.monsterLevel);
  restartBattleTimer();
  setBattleMessage(`${monsterNames[defeatedLevel - 1]} 처치! ${formatGold(earned)} 획득.`, "clear");
  addLog(`${defeatedLevel}단계 몬스터 처치: ${formatGold(earned)} 획득`, "success");
  saveGame();
  render();
}

function attackMonster() {
  ensureMonsterHp();
  const now = Date.now();
  if (now - lastAttackAt < ATTACK_INTERVAL_MS) return;
  lastAttackAt = now;
  playSwordAttackMotion();

  const damage = Math.min(state.monsterHp, getPlayerDamage());
  state.monsterHp -= damage;

  if (state.monsterHp <= 0) {
    defeatMonster();
    return;
  }

  setBattleMessage(`${damage.toLocaleString("ko-KR")} 피해를 입혔습니다.`, "hit");
  saveGame();
  render();
}

function playSwordAttackMotion() {
  elements.attackSword.classList.remove("slash");
  void elements.attackSword.offsetWidth;
  elements.attackSword.classList.add("slash");
}

function playCoinDrop(amount) {
  const value = document.createElement("div");
  value.className = "coin-value";
  value.textContent = `+${formatGold(amount)}`;
  elements.coinLayer.append(value);

  for (let i = 0; i < 7; i += 1) {
    const coin = document.createElement("div");
    coin.className = "coin";
    coin.textContent = "G";
    coin.style.setProperty("--coin-x", `${(i - 3) * 1.25}rem`);
    coin.style.animationDelay = `${i * 45}ms`;
    elements.coinLayer.append(coin);
  }

  window.setTimeout(() => {
    value.remove();
    elements.coinLayer.querySelectorAll(".coin").forEach((coin) => coin.remove());
  }, 1300);
}

function startBattleTimer() {
  stopBattleTimer();
  battleTimeLeft = BATTLE_TIME_LIMIT;
  lastAttackAt = 0;
  battleTimer = window.setInterval(() => {
    battleTimeLeft = Math.max(0, battleTimeLeft - 0.25);
    if (battleTimeLeft <= 0) {
      resetCurrentMonsterByTimeout();
      return;
    }
    render();
  }, 250);
}

function restartBattleTimer() {
  if (elements.battleView.classList.contains("hidden")) {
    battleTimeLeft = BATTLE_TIME_LIMIT;
    return;
  }
  startBattleTimer();
}

function stopBattleTimer() {
  if (!battleTimer) return;
  window.clearInterval(battleTimer);
  battleTimer = null;
}

function resetCurrentMonsterByTimeout() {
  stopAutoAttack();
  stopBattleTimer();
  state.monsterHp = getMonsterMaxHp(state.monsterLevel);
  battleTimeLeft = BATTLE_TIME_LIMIT;
  setBattleMessage(`시간 초과. ${monsterNames[state.monsterLevel - 1]}의 HP가 리셋되었습니다.`, "fail");
  addLog(`${state.monsterLevel}단계 몬스터 시간 초과: HP 리셋`, "fail");
  saveGame();
  render();
  startBattleTimer();
}

function stopAutoEnhance() {
  if (!autoEnhanceTimer) return;
  window.clearInterval(autoEnhanceTimer);
  autoEnhanceTimer = null;
  render();
}

function runAutoEnhanceStep() {
  const targetLevel = clampEnhanceTarget(Number(elements.enhanceTargetInput.value));
  elements.enhanceTargetInput.value = targetLevel;

  if (state.level >= targetLevel) {
    stopAutoEnhance();
    setMessage(`목표 +${targetLevel}에 도달했습니다.`, "success");
    return;
  }

  const cost = getCost(state.level);
  if (state.gold < cost) {
    stopAutoEnhance();
    setMessage(`골드가 부족해 자동 강화를 중지했습니다. 필요 골드: ${formatGold(cost)}`);
    return;
  }

  enhance();
}

function toggleAutoEnhance() {
  if (autoEnhanceTimer) {
    stopAutoEnhance();
    setMessage("자동 강화를 중지했습니다.");
    return;
  }

  const targetLevel = clampEnhanceTarget(Number(elements.enhanceTargetInput.value));
  elements.enhanceTargetInput.value = targetLevel;

  if (state.level >= targetLevel) {
    setMessage(`이미 목표 +${targetLevel} 이상입니다.`);
    return;
  }

  setMessage(`+${targetLevel}까지 자동 강화를 시작합니다.`);
  autoEnhanceTimer = window.setInterval(runAutoEnhanceStep, 650);
  runAutoEnhanceStep();
  render();
}

function stopAutoAttack() {
  if (!autoAttackTimer) return;
  window.clearInterval(autoAttackTimer);
  autoAttackTimer = null;
  render();
}

function toggleAutoAttack() {
  if (autoAttackTimer) {
    stopAutoAttack();
    setBattleMessage("자동 공격을 중지했습니다.");
    return;
  }

  setBattleMessage("자동 공격을 시작했습니다.");
  autoAttackTimer = window.setInterval(attackMonster, ATTACK_INTERVAL_MS);
  attackMonster();
  render();
}

function handleFailure() {
  const before = state.level;

  if (state.level >= 15 && Math.random() < 0.55) {
    state.destroyed = true;
    state.level = 0;
    setMessage("검이 산산조각 났습니다. +0 검으로 다시 강화할 수 있습니다.", "fail");
    addLog(`+${before} 강화 실패: 검 파괴`, "fail");
    return;
  }

  if (state.level >= 11 && Math.random() < 0.35) {
    state.destroyed = true;
    state.level = 0;
    setMessage("검이 파괴되었습니다. +0 검으로 다시 강화할 수 있습니다.", "fail");
    addLog(`+${before} 강화 실패: 검 파괴`, "fail");
    return;
  }

  if (state.level >= 11) {
    state.level -= 1;
    setMessage(`강화 실패. +${before}에서 +${state.level}로 하락했습니다.`, "fail");
    addLog(`+${before} 강화 실패: +${state.level}로 하락`, "fail");
    return;
  }

  setMessage("강화 실패. 단계는 유지됩니다.", "fail");
  addLog(`+${before} 강화 실패: 단계 유지`, "fail");
}

function enhance() {
  const cost = getCost(state.level);
  if (state.level >= MAX_LEVEL || state.gold < cost) return;

  state.gold -= cost;
  state.destroyed = false;
  const before = state.level;
  const chance = getChance(state.level);
  const success = Math.random() * 100 < chance;

  if (success) {
    state.level += 1;
    state.best = Math.max(state.best, state.level);
    const maxText = state.level >= MAX_LEVEL ? " 최고 강화에 도달했습니다." : "";
    setMessage(`강화 성공! +${before}에서 +${state.level}이 되었습니다.${maxText}`, "success");
    addLog(`+${before} -> +${state.level} 성공`, "success");
  } else {
    handleFailure();
  }

  saveGame();
  render();
}

function resetGame() {
  stopAutoAttack();
  stopAutoEnhance();
  stopBattleTimer();
  state.gold = 150;
  state.level = 0;
  state.destroyed = false;
  state.monsterLevel = 1;
  state.unlockedMonsterLevel = 1;
  state.monsterHp = getMonsterMaxHp(1);
  state.balanceVersion = BALANCE_VERSION;
  battleTimeLeft = BATTLE_TIME_LIMIT;
  setMessage("새 검을 받았습니다. 다시 강화해 보세요.");
  addLog("새 검으로 시작");
  saveGame();
  render();
}

elements.enhanceButton.addEventListener("click", enhance);
elements.autoEnhanceButton.addEventListener("click", toggleAutoEnhance);
elements.workButton.addEventListener("click", showBattle);
elements.resetButton.addEventListener("click", resetGame);
elements.backButton.addEventListener("click", showUpgrade);
elements.stayButton.addEventListener("click", showUpgrade);
elements.attackButton.addEventListener("click", attackMonster);
elements.autoAttackButton.addEventListener("click", toggleAutoAttack);
elements.monsterPrevButton.addEventListener("click", () => changeMonsterStage(-1));
elements.monsterNextButton.addEventListener("click", () => changeMonsterStage(1));

loadGame();
ensureMonsterHp();
render();
