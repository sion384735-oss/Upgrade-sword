const MAX_LEVEL = 20;
const MAX_MONSTER_LEVEL = 10;
const STORAGE_KEY = "sword-upgrade-save";

const state = {
  gold: 150,
  level: 0,
  best: 0,
  destroyed: false,
  monsterLevel: 1,
  monsterHp: 0,
};

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
  best: document.querySelector("#best"),
  monsterLevel: document.querySelector("#monsterLevel"),
  message: document.querySelector("#message"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  riskText: document.querySelector("#riskText"),
  log: document.querySelector("#log"),
  enhanceButton: document.querySelector("#enhanceButton"),
  workButton: document.querySelector("#workButton"),
  resetButton: document.querySelector("#resetButton"),
  backButton: document.querySelector("#backButton"),
  stayButton: document.querySelector("#stayButton"),
  attackButton: document.querySelector("#attackButton"),
  monster: document.querySelector("#monster"),
  monsterName: document.querySelector("#monsterName"),
  monsterStage: document.querySelector("#monsterStage"),
  monsterHpText: document.querySelector("#monsterHpText"),
  monsterReward: document.querySelector("#monsterReward"),
  monsterHpBar: document.querySelector("#monsterHpBar"),
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

function getCost(level) {
  return Math.floor(80 + level * level * 35 + level * 45);
}

function getChance(level) {
  return Math.max(12, Math.floor(95 - level * 4.2));
}

function getRiskText(level) {
  if (level < 5) return "실패해도 단계가 유지됩니다.";
  if (level < 10) return "실패하면 강화 단계가 1 내려갑니다.";
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
  return Math.floor(70 + level * level * 28 + level * 34);
}

function getMonsterReward(level) {
  return Math.floor(90 + level * level * 48 + state.best * 18);
}

function getPlayerDamage() {
  return Math.floor(34 + state.level * 14 + Math.random() * (30 + state.level * 5));
}

function clampMonsterLevel(level) {
  return Math.min(MAX_MONSTER_LEVEL, Math.max(1, level));
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
    state.monsterHp = Number.isFinite(parsed.monsterHp) ? parsed.monsterHp : state.monsterHp;
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

  elements.swordName.textContent = `${getSwordTitle(state.level)} +${state.level}`;
  elements.levelBadge.textContent = `+${state.level}`;
  elements.sword.style.backgroundImage = `url("${getSwordImagePath(state.level)}")`;
  elements.gold.textContent = formatGold(state.gold);
  elements.cost.textContent = isMax ? "완료" : formatGold(cost);
  elements.chance.textContent = isMax ? "100%" : `${chance}%`;
  elements.best.textContent = `+${state.best}`;
  elements.monsterLevel.textContent = `${state.monsterLevel} / ${MAX_MONSTER_LEVEL}`;
  elements.progressText.textContent = `${progress}%`;
  elements.progressBar.style.width = `${progress}%`;
  elements.riskText.textContent = isMax ? "최고 단계에 도달했습니다." : getRiskText(state.level);
  elements.enhanceButton.disabled = isMax || state.destroyed || state.gold < cost;
  elements.enhanceButton.textContent = state.destroyed ? "검 파괴됨" : isMax ? "최고 강화" : "강화하기";
  elements.upgradeView.classList.toggle("max", isMax);

  elements.monsterName.textContent = monsterNames[state.monsterLevel - 1];
  elements.monsterStage.textContent = `${state.monsterLevel} / ${MAX_MONSTER_LEVEL} 단계`;
  elements.monster.style.backgroundImage = `url("${getMonsterImagePath(state.monsterLevel)}")`;
  elements.monsterHpText.textContent = `HP ${state.monsterHp.toLocaleString("ko-KR")} / ${monsterMaxHp.toLocaleString("ko-KR")}`;
  elements.monsterReward.textContent = `보상 ${formatGold(getMonsterReward(state.monsterLevel))}`;
  elements.monsterHpBar.style.width = `${monsterProgress}%`;
}

function showBattle() {
  ensureMonsterHp();
  elements.upgradeView.classList.add("hidden");
  elements.battleView.classList.remove("hidden");
  setBattleMessage(`${monsterNames[state.monsterLevel - 1]}이 나타났습니다.`);
  render();
}

function showUpgrade() {
  elements.battleView.classList.add("hidden");
  elements.upgradeView.classList.remove("hidden");
  render();
}

function defeatMonster() {
  const defeatedLevel = state.monsterLevel;
  const earned = getMonsterReward(defeatedLevel);
  state.gold += earned;

  if (state.monsterLevel < MAX_MONSTER_LEVEL) {
    state.monsterLevel += 1;
  }

  state.monsterHp = getMonsterMaxHp(state.monsterLevel);
  setBattleMessage(`${monsterNames[defeatedLevel - 1]} 처치! ${formatGold(earned)} 획득.`, "clear");
  addLog(`${defeatedLevel}단계 몬스터 처치: ${formatGold(earned)} 획득`, "success");
  saveGame();
  render();
}

function attackMonster() {
  ensureMonsterHp();

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

function handleFailure() {
  const before = state.level;

  if (state.level >= 15 && Math.random() < 0.55) {
    state.destroyed = true;
    state.level = 0;
    setMessage("검이 산산조각 났습니다. 초기화로 새 검을 시작하세요.", "fail");
    addLog(`+${before} 강화 실패: 검 파괴`, "fail");
    return;
  }

  if (state.level >= 10 && Math.random() < 0.35) {
    state.destroyed = true;
    state.level = 0;
    setMessage("검이 파괴되었습니다. 초기화로 새 검을 시작하세요.", "fail");
    addLog(`+${before} 강화 실패: 검 파괴`, "fail");
    return;
  }

  if (state.level >= 5) {
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
  if (state.destroyed || state.level >= MAX_LEVEL || state.gold < cost) return;

  state.gold -= cost;
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
  state.gold = 150;
  state.level = 0;
  state.destroyed = false;
  state.monsterLevel = 1;
  state.monsterHp = getMonsterMaxHp(1);
  setMessage("새 검을 받았습니다. 다시 강화해 보세요.");
  addLog("새 검으로 시작");
  saveGame();
  render();
}

elements.enhanceButton.addEventListener("click", enhance);
elements.workButton.addEventListener("click", showBattle);
elements.resetButton.addEventListener("click", resetGame);
elements.backButton.addEventListener("click", showUpgrade);
elements.stayButton.addEventListener("click", showUpgrade);
elements.attackButton.addEventListener("click", attackMonster);

loadGame();
ensureMonsterHp();
render();
