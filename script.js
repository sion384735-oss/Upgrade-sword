const MAX_LEVEL = 30;
const MAX_MONSTER_LEVEL = 20;
const BATTLE_TIME_LIMIT = 20;
const ATTACK_INTERVAL_MS = 450;
const BALANCE_VERSION = 3;
const STORAGE_KEY = "sword-upgrade-save";
const SUCCESS_CHANCES = [
  100, 95, 90, 85, 80, 75, 70, 65, 60, 55,
  50, 45, 40, 35, 30, 25, 20, 16, 13, 10,
  9, 8, 7, 6, 5.5, 5, 4.5, 4, 3.5, 3,
];
const ITEM_ORDER = ["protect", "fallProtect", "boost5", "boost10"];
const DROP_ITEM_ORDER = ["protect", "fallProtect", "boost5", "boost10"];
const ITEMS = {
  protect: {
    name: "파괴방지권",
    description: "선택 후 강화하면 파괴 결과를 1회 막습니다.",
    chanceBonus: 0,
  },
  fallProtect: {
    name: "하락방지권",
    description: "선택 후 강화하면 하락 결과를 1회 막습니다.",
    chanceBonus: 0,
  },
  boost5: {
    name: "강화확률 5% 증가권",
    description: "선택 후 강화하면 성공 확률이 5% 증가합니다.",
    chanceBonus: 5,
  },
  boost10: {
    name: "강화확률 10% 증가권",
    description: "선택 후 강화하면 성공 확률이 10% 증가합니다.",
    chanceBonus: 10,
  },
};

const state = {
  gold: 150,
  level: 0,
  best: 0,
  destroyed: false,
  monsterLevel: 1,
  unlockedMonsterLevel: 1,
  monsterHp: 0,
  enhanceTarget: 10,
  soundEnabled: true,
  bgmEnabled: false,
  theme: "dark",
  balanceVersion: BALANCE_VERSION,
  inventory: {
    protect: 0,
    fallProtect: 0,
    boost5: 0,
    boost10: 0,
  },
  selectedItems: {
    protect: 0,
    fallProtect: 0,
    boost5: 0,
    boost10: 0,
  },
};

let autoAttackTimer = null;
let autoEnhanceTimer = null;
let battleTimer = null;
let battleTimeLeft = BATTLE_TIME_LIMIT;
let lastAttackAt = 0;
let audioContext = null;
let bgmTimer = null;
let bgmGain = null;

const BGM_ROOTS = [110, 103.83, 98, 92.5, 87.31, 82.41, 77.78, 73.42, 69.3, 65.41];

const elements = {
  stage: document.querySelector(".stage"),
  upgradeView: document.querySelector("#upgradeView"),
  battleView: document.querySelector("#battleView"),
  destroyedBanner: document.querySelector("#destroyedBanner"),
  sword: document.querySelector("#sword"),
  swordName: document.querySelector("#swordName"),
  levelBadge: document.querySelector("#levelBadge"),
  gold: document.querySelector("#gold"),
  cost: document.querySelector("#cost"),
  chance: document.querySelector("#chance"),
  breakChance: document.querySelector("#breakChance"),
  fallChance: document.querySelector("#fallChance"),
  best: document.querySelector("#best"),
  monsterLevel: document.querySelector("#monsterLevel"),
  message: document.querySelector("#message"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  riskText: document.querySelector("#riskText"),
  log: document.querySelector("#log"),
  enhanceButton: document.querySelector("#enhanceButton"),
  autoEnhanceButton: document.querySelector("#autoEnhanceButton"),
  enhanceTargetPrevButton: document.querySelector("#enhanceTargetPrevButton"),
  enhanceTargetNextButton: document.querySelector("#enhanceTargetNextButton"),
  enhanceTargetReadout: document.querySelector("#enhanceTargetReadout"),
  soundToggleButton: document.querySelector("#soundToggleButton"),
  bgmToggleButton: document.querySelector("#bgmToggleButton"),
  themeToggleButton: document.querySelector("#themeToggleButton"),
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
  probabilityTable: document.querySelector("#probabilityTable"),
  inventoryItems: document.querySelector("#inventoryItems"),
  battleInventoryItems: document.querySelector("#battleInventoryItems"),
  dropRateTable: document.querySelector("#dropRateTable"),
};

const swordTitles = [
  "낡은 철검",
  "견고한 철검",
  "푸른 강철검",
  "기사의 장검",
  "왕국의 명검",
  "별빛 성검",
  "태초의 신검",
];

const monsterNames = [
  "에메랄드 슬라임",
  "보랏빛 날개 임프",
  "가시 숲 고블린",
  "그림자 맹수",
  "검은 갈기 늑대",
  "썩은 묘지 구울",
  "철갑 오크 투사",
  "푸른 핵 골렘",
  "지옥불 사냥개",
  "공허 가시 악마",
  "저주받은 뿔기사",
  "화염의 마검사",
  "심연의 흑마도사",
  "타락 수정 야수",
  "어둠의 수문장",
  "고대 갑주 악마",
  "타락한 암흑룡",
  "혼돈의 전쟁군주",
  "청염 날개 마왕",
  "종말의 지배자",
];

const monsterRewardTable = [
  0, 100, 450, 1200, 3000, 7500, 17000, 38000, 41000, 60000, 110000,
  200000, 360000, 650000, 1150000, 2000000, 3400000, 5750000, 9500000,
  16000000, 26000000,
];
const monsterHpTable = monsterRewardTable.map((reward) => reward * 10);

function getCost(level) {
  if (level === 0) return 50;
  const earlyCosts = [0, 250, 520, 950, 1600, 2500, 3700, 5200, 7000];
  if (level <= 8) return earlyCosts[level];
  return Math.floor(180 + level * 140 + level * level * 95 + level * level * level * 8);
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

async function resumeAudioContext() {
  const context = getAudioContext();
  if (context.state === "suspended") {
    await context.resume();
  }
  return context;
}

function playTone(frequency, duration = 0.12, type = "sine", volume = 0.08, delay = 0) {
  const context = getAudioContext();
  if (context.state === "suspended") context.resume();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + delay;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playSound(name) {
  if (!state.soundEnabled) return;

  const patterns = {
    hit: () => {
      playTone(130, 0.08, "sawtooth", 0.08);
      playTone(70, 0.1, "square", 0.04, 0.02);
    },
    gold: () => {
      playTone(880, 0.08, "triangle", 0.07);
      playTone(1175, 0.1, "triangle", 0.06, 0.08);
      playTone(1568, 0.12, "triangle", 0.05, 0.16);
    },
    enhance: () => {
      playTone(392, 0.08, "sine", 0.055);
      playTone(523, 0.1, "sine", 0.055, 0.07);
    },
    success: () => {
      playTone(659, 0.08, "triangle", 0.07);
      playTone(988, 0.14, "triangle", 0.075, 0.08);
    },
    fall: () => {
      playTone(330, 0.12, "sawtooth", 0.065);
      playTone(196, 0.16, "sawtooth", 0.055, 0.09);
    },
    destroy: () => {
      playTone(120, 0.22, "square", 0.09);
      playTone(72, 0.28, "sawtooth", 0.08, 0.08);
    },
    item: () => {
      playTone(740, 0.08, "triangle", 0.07);
      playTone(988, 0.1, "triangle", 0.065, 0.07);
      playTone(1318, 0.16, "sine", 0.055, 0.16);
    },
  };
  patterns[name]?.();
}

function ensureBgmGain() {
  const context = getAudioContext();
  if (!bgmGain) {
    bgmGain = context.createGain();
    bgmGain.gain.setValueAtTime(0.12, context.currentTime);
    bgmGain.connect(context.destination);
  }
  return bgmGain;
}

function playBgmTone(frequency, startDelay, duration, type = "triangle", volume = 0.045) {
  if (!bgmGain) return;

  const context = getAudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + startDelay;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(bgmGain);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

function getBgmProfile() {
  if (state.monsterLevel <= 10) {
    return {
      masterVolume: 0.12,
      step: 0.42,
      leadType: "triangle",
      bassType: "sine",
      melody: [220, 277.18, 329.63, 392, 369.99, 329.63, 277.18, 246.94],
      bass: [110, 110, 138.59, 138.59, 98, 98, 123.47, 123.47],
      leadVolume: 0.08,
      bassVolume: 0.058,
      harmonyVolume: 0.038,
      pulseVolume: 0,
    };
  }

  const intensity = state.monsterLevel - 10;
  const root = BGM_ROOTS[intensity - 1] ?? 65.41;
  const tension = 1 + intensity * 0.035;
  return {
    masterVolume: Math.min(0.22, 0.125 + intensity * 0.0095),
    step: Math.max(0.3, 0.42 - intensity * 0.012),
    leadType: intensity >= 7 ? "sawtooth" : "triangle",
    bassType: intensity >= 6 ? "sawtooth" : "sine",
    melody: [
      root * 2,
      root * 2.25,
      root * 2.4,
      root * 3,
      root * 3.2 * tension,
      root * 3,
      root * 2.4,
      root * 2.25,
    ],
    bass: [root, root, root * 0.75, root * 0.75, root * 0.84, root * 0.84, root * 0.67, root * 0.67],
    leadVolume: 0.075 + intensity * 0.006,
    bassVolume: 0.06 + intensity * 0.007,
    harmonyVolume: intensity >= 3 ? 0.032 + intensity * 0.003 : 0,
    pulseVolume: intensity >= 6 ? 0.022 + intensity * 0.003 : 0,
  };
}

function playBgmLoop() {
  if (!state.bgmEnabled || !bgmGain) return;

  const profile = getBgmProfile();
  bgmGain.gain.cancelScheduledValues(audioContext.currentTime);
  bgmGain.gain.setValueAtTime(profile.masterVolume, audioContext.currentTime);

  profile.melody.forEach((note, index) => {
    const offset = index * profile.step;
    playBgmTone(note, offset, profile.step * 0.72, profile.leadType, profile.leadVolume);
    if (index % 2 === 0 && profile.harmonyVolume > 0) {
      playBgmTone(note * 1.5, offset + profile.step * 0.28, profile.step * 0.45, "sine", profile.harmonyVolume);
    }
    if (profile.pulseVolume > 0) {
      playBgmTone(profile.bass[index] * 2, offset + profile.step * 0.5, profile.step * 0.18, "square", profile.pulseVolume);
    }
  });
  profile.bass.forEach((note, index) => {
    playBgmTone(note, index * profile.step, profile.step * 0.9, profile.bassType, profile.bassVolume);
  });

  bgmTimer = window.setTimeout(playBgmLoop, profile.step * profile.melody.length * 1000);
}

async function startBgm() {
  if (bgmTimer || !state.bgmEnabled) return;
  await resumeAudioContext();
  if (!state.bgmEnabled || bgmTimer) return;
  ensureBgmGain();
  bgmGain.gain.cancelScheduledValues(audioContext.currentTime);
  bgmGain.gain.setValueAtTime(getBgmProfile().masterVolume, audioContext.currentTime);
  playBgmLoop();
}

function stopBgm() {
  if (bgmTimer) {
    window.clearTimeout(bgmTimer);
    bgmTimer = null;
  }
  if (bgmGain && audioContext) {
    bgmGain.gain.cancelScheduledValues(audioContext.currentTime);
    bgmGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    bgmGain.disconnect();
    bgmGain = null;
  }
}

function resumeBgmAfterGesture() {
  if (state.bgmEnabled) startBgm();
}

function restartBgmForMonster() {
  if (!state.bgmEnabled || !bgmTimer) return;
  stopBgm();
  startBgm();
}

function applyTheme() {
  document.body.classList.toggle("light", state.theme === "light");
}

function getChance(level) {
  return SUCCESS_CHANCES[level] ?? 0;
}

function getBreakChance(level) {
  if (level <= 10) return 0;
  if (level <= 19) return ((level - 10) / 9) * 2;
  return Math.min(20, 2 + ((level - 19) / 10) * 18);
}

function getFallChance(level) {
  if (level <= 10) return 0;
  if (level <= 12) return 12;
  if (level <= 14) return 15;
  if (level <= 16) return 18;
  if (level <= 18) return 22;
  if (level <= 20) return 25;
  if (level <= 22) return 30;
  if (level <= 24) return 35;
  if (level <= 26) return 40;
  if (level <= 28) return 45;
  return 50;
}

function getRiskText(level) {
  if (level <= 10) return "실패해도 단계가 유지됩니다.";
  return `실패하면 파괴 ${formatPercent(getBreakChance(level))}, 하락 ${formatPercent(getFallChance(level))}가 적용됩니다.`;
}

function formatPercent(value) {
  if (Number.isInteger(value)) return `${value}%`;
  return `${value.toFixed(1)}%`;
}

function getItemDropBaseChance(monsterLevel) {
  if (monsterLevel < 10) return 0;
  return ((monsterLevel - 9) / (MAX_MONSTER_LEVEL - 9)) * 3 + 10;
}

function getItemDropChances(monsterLevel) {
  const baseChance = getItemDropBaseChance(monsterLevel);
  return {
    protect: baseChance,
    fallProtect: baseChance,
    boost5: baseChance,
    boost10: monsterLevel === 19 ? 10 : monsterLevel === 20 ? 15 : 0,
  };
}

function normalizeInventory(value = {}) {
  return ITEM_ORDER.reduce((inventory, itemKey) => {
    inventory[itemKey] = Number.isFinite(value[itemKey]) ? Math.max(0, Math.floor(value[itemKey])) : 0;
    return inventory;
  }, {});
}

function getItemSelectionLimit(itemKey) {
  if (itemKey === "protect" || itemKey === "fallProtect") return Math.min(1, state.inventory[itemKey] ?? 0);
  return state.inventory[itemKey] ?? 0;
}

function normalizeSelectedItems(value = {}, legacySelectedItem = "") {
  const selectedItems = ITEM_ORDER.reduce((selection, itemKey) => {
    const count = Number.isFinite(value[itemKey]) ? Math.max(0, Math.floor(value[itemKey])) : 0;
    selection[itemKey] = Math.min(count, getItemSelectionLimit(itemKey));
    return selection;
  }, {});

  if (legacySelectedItem && ITEMS[legacySelectedItem] && state.inventory[legacySelectedItem] > 0) {
    selectedItems[legacySelectedItem] = Math.min(1, getItemSelectionLimit(legacySelectedItem));
  }

  return selectedItems;
}

function getSelectedItemCount(itemKey) {
  return Math.min(state.selectedItems[itemKey] ?? 0, getItemSelectionLimit(itemKey));
}

function hasSelectedItems() {
  return ITEM_ORDER.some((itemKey) => getSelectedItemCount(itemKey) > 0);
}

function getSelectedChanceBonus() {
  return ITEM_ORDER.reduce((bonus, itemKey) => {
    return bonus + getSelectedItemCount(itemKey) * ITEMS[itemKey].chanceBonus;
  }, 0);
}

function getSelectedItemNames() {
  return ITEM_ORDER.flatMap((itemKey) => {
    const count = getSelectedItemCount(itemKey);
    if (count <= 0) return [];
    const suffix = count > 1 ? ` ${count}개` : "";
    return [`${ITEMS[itemKey].name}${suffix}`];
  });
}

function getSwordTitle(level) {
  const index = Math.min(swordTitles.length - 1, Math.floor(level / 5));
  return swordTitles[index];
}

function getSwordImagePath(level) {
  const imageLevel = Math.max(1, Math.min(MAX_LEVEL, level));
  return `assets/swords/stages-30-progressive-transparent/sword-stage-${String(imageLevel).padStart(2, "0")}.png`;
}

function getMonsterImagePath(level) {
  return `assets/monsters/stages-20-transparent/monster-stage-${String(level).padStart(2, "0")}.png`;
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
  if (swordLevel <= 0) return 0;
  return Math.min(MAX_MONSTER_LEVEL, Math.ceil((swordLevel / MAX_LEVEL) * MAX_MONSTER_LEVEL));
}

function getMinimumSwordLevelForMonster(monsterLevel) {
  return Math.max(1, Math.ceil((clampMonsterLevel(monsterLevel) / MAX_MONSTER_LEVEL) * MAX_LEVEL));
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
    state.level = Number.isFinite(parsed.level)
      ? Math.min(MAX_LEVEL, Math.max(0, Math.round(parsed.level)))
      : state.level;
    state.best = Number.isFinite(parsed.best)
      ? Math.min(MAX_LEVEL, Math.max(0, Math.round(parsed.best)))
      : state.best;
    state.destroyed = Boolean(parsed.destroyed);
    state.monsterLevel = Number.isFinite(parsed.monsterLevel)
      ? clampMonsterLevel(parsed.monsterLevel)
      : state.monsterLevel;
    state.unlockedMonsterLevel = Number.isFinite(parsed.unlockedMonsterLevel)
      ? clampMonsterLevel(parsed.unlockedMonsterLevel)
      : Math.max(1, state.monsterLevel);
    state.monsterLevel = Math.min(state.monsterLevel, state.unlockedMonsterLevel);
    state.enhanceTarget = Number.isFinite(parsed.enhanceTarget)
      ? clampEnhanceTarget(parsed.enhanceTarget)
      : state.enhanceTarget;
    state.soundEnabled =
      typeof parsed.soundEnabled === "boolean" ? parsed.soundEnabled : state.soundEnabled;
    state.bgmEnabled =
      typeof parsed.bgmEnabled === "boolean" ? parsed.bgmEnabled : state.bgmEnabled;
    state.theme = parsed.theme === "light" ? "light" : "dark";
    state.inventory = normalizeInventory(parsed.inventory);
    state.selectedItems = normalizeSelectedItems(parsed.selectedItems, parsed.selectedItem);
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
  if (value >= 1000000) {
    const platinum = value / 1000000;
    const formatted = platinum >= 100
      ? Math.floor(platinum).toLocaleString("ko-KR")
      : platinum.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
    return `${formatted} 백금`;
  }
  return `${value.toLocaleString("ko-KR")} G`;
}

function formatDamage(value) {
  if (value >= 1000) {
    const scaled = value / 1000;
    return `${scaled >= 100 ? Math.floor(scaled) : Number(scaled.toFixed(1))}K`;
  }
  return value.toLocaleString("ko-KR");
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

function renderProbabilityTable() {
  const rows = Array.from({ length: MAX_LEVEL }, (_, level) => {
    const isCurrent = level === state.level && state.level < MAX_LEVEL;
    const rowClass = isCurrent ? ' class="current"' : "";
    const failKeep = Math.max(0, 100 - getBreakChance(level) - getFallChance(level));
    return `
      <tr${rowClass}>
        <td>+${level} -> +${level + 1}</td>
        <td>${formatPercent(getChance(level))}</td>
        <td>${formatPercent(getBreakChance(level))}</td>
        <td>${formatPercent(getFallChance(level))}</td>
        <td>${formatPercent(failKeep)}</td>
      </tr>
    `;
  }).join("");

  elements.probabilityTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>강화</th>
          <th>성공</th>
          <th>실패 시 파괴</th>
          <th>실패 시 하락</th>
          <th>실패 시 유지</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderInventory() {
  state.selectedItems = normalizeSelectedItems(state.selectedItems);

  const rows = ITEM_ORDER.map((itemKey) => {
    const item = ITEMS[itemKey];
    const count = state.inventory[itemKey] ?? 0;
    const selectedCount = getSelectedItemCount(itemKey);
    const isSelected = selectedCount > 0;
    const selectedClass = isSelected ? " selected" : "";
    const disabled = count <= 0 ? " disabled" : "";
    const countText = selectedCount > 0 ? `선택 ${selectedCount} / 보유 ${count}` : `보유 ${count}`;
    return `
      <button class="inventory-item${selectedClass}" type="button" data-item="${itemKey}"${disabled}>
        <span class="item-object ${itemKey}" aria-hidden="true"></span>
        <strong>${item.name}</strong>
        <span class="item-description">${item.description}</span>
        <em>${countText}</em>
      </button>
    `;
  }).join("");

  const html = `
    <button class="inventory-item empty${hasSelectedItems() ? "" : " selected"}" type="button" data-item="">
      <span class="item-object empty-slot" aria-hidden="true"></span>
      <strong>아이템 사용 안 함</strong>
      <span class="item-description">강화 시 보유 아이템을 소모하지 않습니다.</span>
      <em>-</em>
    </button>
    ${rows}
  `;

  elements.inventoryItems.innerHTML = html;
  elements.battleInventoryItems.innerHTML = html;
}

function renderDropRateTable() {
  const dropChances = getItemDropChances(state.monsterLevel);
  const rows = DROP_ITEM_ORDER.map((itemKey) => `
    <tr>
      <td>${ITEMS[itemKey].name}</td>
      <td>${formatPercent(dropChances[itemKey])}</td>
    </tr>
  `).join("");

  elements.dropRateTable.innerHTML = `
    <table>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function render() {
  ensureMonsterHp();
  applyTheme();

  const cost = getCost(state.level);
  const chance = Math.min(100, getChance(state.level) + getSelectedChanceBonus());
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
  elements.chance.textContent = isMax ? "100%" : formatPercent(chance);
  elements.breakChance.textContent = isMax ? "0%" : formatPercent(getBreakChance(state.level));
  elements.fallChance.textContent = isMax ? "0%" : formatPercent(getFallChance(state.level));
  elements.best.textContent = `+${state.best}`;
  elements.monsterLevel.textContent = `${state.monsterLevel} / ${MAX_MONSTER_LEVEL}`;
  elements.attackStat.textContent = `${formatDamage(damageRange.min)} ~ ${formatDamage(damageRange.max)}`;
  elements.progressText.textContent = `${progress}%`;
  elements.progressBar.style.width = `${progress}%`;
  elements.riskText.textContent = isMax ? "최고 단계에 도달했습니다." : getRiskText(state.level);
  elements.enhanceButton.disabled = isMax || state.gold < cost;
  elements.enhanceButton.textContent = isMax ? "최고 강화" : "강화하기";
  elements.enhanceTargetReadout.textContent = `+${state.enhanceTarget}`;
  elements.enhanceTargetPrevButton.disabled = state.enhanceTarget <= 1;
  elements.enhanceTargetNextButton.disabled = state.enhanceTarget >= MAX_LEVEL;
  elements.autoEnhanceButton.textContent = autoEnhanceTimer ? "자동 중지" : "자동 강화";
  elements.soundToggleButton.textContent = state.soundEnabled ? "사운드 ON" : "사운드 OFF";
  elements.bgmToggleButton.textContent = state.bgmEnabled ? "BGM ON" : "BGM OFF";
  elements.themeToggleButton.textContent = state.theme === "light" ? "다크 모드" : "화이트 모드";
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
  elements.attackPower.textContent = `공격력 ${formatDamage(damageRange.min)} ~ ${formatDamage(damageRange.max)}`;
  elements.monsterStageReadout.textContent = state.monsterLevel;
  elements.monsterPrevButton.disabled = state.monsterLevel <= 1;
  elements.monsterNextButton.disabled = state.monsterLevel >= state.unlockedMonsterLevel;
  elements.autoAttackButton.textContent = autoAttackTimer ? "자동 중지" : "자동 공격";
  elements.battleView.classList.toggle("auto", Boolean(autoAttackTimer));
  renderProbabilityTable();
  renderInventory();
  renderDropRateTable();
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
  restartBgmForMonster();
  restartBattleTimer();
  setBattleMessage(`${monsterNames[nextLevel - 1]} ${nextLevel}단계로 변경했습니다.`);
  saveGame();
  render();
}

function changeMonsterStage(delta) {
  setMonsterStage(state.monsterLevel + delta);
}

function rollItemDrops(monsterLevel) {
  const dropChances = getItemDropChances(monsterLevel);
  const totalChance = DROP_ITEM_ORDER.reduce((total, itemKey) => total + dropChances[itemKey], 0);
  const roll = Math.random() * 100;

  if (roll >= totalChance) return [];

  let cursor = 0;
  const droppedItem = DROP_ITEM_ORDER.find((itemKey) => {
    cursor += dropChances[itemKey];
    return roll < cursor;
  });

  if (!droppedItem) return [];

  state.inventory[droppedItem] += 1;
  return [droppedItem];
}

function defeatMonster() {
  const defeatedLevel = state.monsterLevel;
  const earned = getMonsterReward(defeatedLevel);
  const drops = rollItemDrops(defeatedLevel);
  state.gold += earned;
  playSound("gold");
  playCoinDrop(earned);

  if (defeatedLevel < MAX_MONSTER_LEVEL) {
    state.unlockedMonsterLevel = Math.max(state.unlockedMonsterLevel, defeatedLevel + 1);
  }

  state.monsterHp = getMonsterMaxHp(state.monsterLevel);
  restartBattleTimer();
  if (drops.length) {
    playSound("item");
    playItemDrop(drops[0]);
  }
  const dropNames = drops.map((itemKey) => ITEMS[itemKey].name);
  const dropText = dropNames.length ? ` 아이템: ${dropNames.join(", ")} 획득.` : "";
  setBattleMessage(`${monsterNames[defeatedLevel - 1]} 처치! ${formatGold(earned)} 획득.${dropText}`, "clear");
  addLog(`${defeatedLevel}단계 몬스터 처치: ${formatGold(earned)} 획득`, "success");
  if (dropNames.length) addLog(`아이템 획득: ${dropNames.join(", ")}`, "success");
  saveGame();
  render();
}

function attackMonster() {
  ensureMonsterHp();
  const now = Date.now();
  if (now - lastAttackAt < ATTACK_INTERVAL_MS) return;
  performAttack(now);
}

function performAttack(timestamp = Date.now()) {
  ensureMonsterHp();
  lastAttackAt = timestamp;
  playSound("hit");
  playSwordAttackMotion();

  const damage = Math.min(state.monsterHp, getPlayerDamage());
  state.monsterHp -= damage;
  playDamageNumber(damage);

  if (state.monsterHp <= 0) {
    defeatMonster();
    return;
  }

  elements.battleView.classList.remove("hit");
  void elements.battleView.offsetWidth;
  elements.battleView.classList.add("hit");
  window.setTimeout(() => elements.battleView.classList.remove("hit"), 220);
  saveGame();
  render();
}

function runAutoAttackStep() {
  performAttack(Date.now());
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

function playItemDrop(itemKey) {
  const item = ITEMS[itemKey];
  if (!item) return;

  const drop = document.createElement("div");
  drop.className = "item-drop";
  drop.innerHTML = `
    <span class="item-object ${itemKey}" aria-hidden="true"></span>
    <strong>${item.name}</strong>
  `;
  elements.coinLayer.append(drop);

  window.setTimeout(() => drop.remove(), 1600);
}

function playDamageNumber(damage) {
  const damageText = document.createElement("div");
  damageText.className = "damage-number";
  damageText.textContent = `-${formatDamage(damage)}`;
  damageText.style.setProperty("--damage-x", `${Math.round(Math.random() * 5 - 2.5)}rem`);
  elements.coinLayer.append(damageText);

  window.setTimeout(() => damageText.remove(), 700);
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
  const targetLevel = state.enhanceTarget;

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

  const targetLevel = state.enhanceTarget;

  if (state.level >= targetLevel) {
    setMessage(`이미 목표 +${targetLevel} 이상입니다.`);
    return;
  }

  setMessage(`+${targetLevel}까지 자동 강화를 시작합니다.`);
  autoEnhanceTimer = window.setInterval(runAutoEnhanceStep, 650);
  runAutoEnhanceStep();
  render();
}

function changeEnhanceTarget(delta) {
  state.enhanceTarget = clampEnhanceTarget(state.enhanceTarget + delta);
  saveGame();
  render();
}

function selectInventoryItem(itemKey) {
  if (!itemKey) {
    state.selectedItems = normalizeSelectedItems();
  } else if (ITEMS[itemKey] && state.inventory[itemKey] > 0) {
    const currentCount = getSelectedItemCount(itemKey);
    const limit = getItemSelectionLimit(itemKey);
    state.selectedItems[itemKey] = currentCount >= limit ? 0 : currentCount + 1;
  }
  saveGame();
  render();
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  saveGame();
  render();
}

function toggleBgm() {
  state.bgmEnabled = !state.bgmEnabled;
  if (state.bgmEnabled) {
    startBgm();
  } else {
    stopBgm();
  }
  saveGame();
  render();
}

function toggleTheme() {
  state.theme = state.theme === "light" ? "dark" : "light";
  saveGame();
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
  lastAttackAt = 0;
  runAutoAttackStep();
  autoAttackTimer = window.setInterval(runAutoAttackStep, ATTACK_INTERVAL_MS);
  render();
}

function handleFailure(protectActive = false, fallProtectActive = false) {
  const before = state.level;

  if (Math.random() * 100 < getBreakChance(state.level)) {
    if (protectActive) {
      setMessage(`파괴방지권으로 +${before} 검의 파괴를 막았습니다.`, "fail");
      addLog(`+${before} 강화 실패: 파괴방지권으로 파괴 방지`, "fail");
      return;
    }

    state.destroyed = true;
    state.level = 0;
    playSound("destroy");
    showDestroyedBanner();
    setMessage("강화 실패로 검이 +0 상태로 복구되었습니다. 다시 강화할 수 있습니다.", "fail");
    addLog(`+${before} 강화 실패: +0 복구`, "fail");
    return;
  }

  if (Math.random() * 100 < getFallChance(state.level)) {
    if (fallProtectActive) {
      setMessage(`하락방지권으로 +${before} 검의 하락을 막았습니다.`, "fail");
      addLog(`+${before} 강화 실패: 하락방지권으로 하락 방지`, "fail");
      return;
    }

    const floorLevel = state.best >= 20 && before >= 20 ? 20 : 0;
    state.level = Math.max(floorLevel, state.level - 1);
    playSound("fall");
    const itemText = protectActive ? " 파괴방지권을 사용했습니다." : "";
    if (state.level === before) {
      setMessage(`강화 실패. +20 보호로 단계가 유지됩니다.${itemText}`, "fail");
      addLog(`+${before} 강화 실패: +20 보호로 단계 유지${itemText}`, "fail");
    } else {
      setMessage(`강화 실패. +${before}에서 +${state.level}로 하락했습니다.${itemText}`, "fail");
      addLog(`+${before} 강화 실패: +${state.level}로 하락${itemText}`, "fail");
    }
    return;
  }

  const itemText = protectActive ? " 파괴방지권을 사용했습니다." : "";
  setMessage(`강화 실패. 단계는 유지됩니다.${itemText}`, "fail");
  addLog(`+${before} 강화 실패: 단계 유지${itemText}`, "fail");
}

function enhance() {
  const cost = getCost(state.level);
  if (state.level >= MAX_LEVEL || state.gold < cost) return;

  const selectedItems = normalizeSelectedItems(state.selectedItems);
  state.selectedItems = selectedItems;
  const selectedItemNames = getSelectedItemNames();
  const chanceBonus = getSelectedChanceBonus();
  const protectActive = selectedItems.protect > 0;
  const fallProtectActive = selectedItems.fallProtect > 0;

  ITEM_ORDER.forEach((itemKey) => {
    const selectedCount = selectedItems[itemKey] ?? 0;
    if (selectedCount <= 0) return;
    state.inventory[itemKey] = Math.max(0, state.inventory[itemKey] - selectedCount);
    state.selectedItems[itemKey] = 0;
  });

  state.gold -= cost;
  state.destroyed = false;
  playSound("enhance");
  const before = state.level;
  const chance = Math.min(100, getChance(state.level) + chanceBonus);
  const success = Math.random() * 100 < chance;

  if (success) {
    state.level += 1;
    state.best = Math.max(state.best, state.level);
    playSound("success");
    const maxText = state.level >= MAX_LEVEL ? " 최고 강화에 도달했습니다." : "";
    setMessage(`강화 성공! +${before}에서 +${state.level}이 되었습니다.${maxText}`, "success");
    const itemText = selectedItemNames.length ? ` (${selectedItemNames.join(", ")} 사용)` : "";
    addLog(`+${before} -> +${state.level} 성공${itemText}`, "success");
  } else {
    if (selectedItemNames.length && !protectActive && !fallProtectActive) {
      addLog(`${selectedItemNames.join(", ")} 사용`, "fail");
    }
    handleFailure(protectActive, fallProtectActive);
  }

  saveGame();
  render();
}

function showDestroyedBanner() {
  elements.destroyedBanner.classList.remove("show");
  void elements.destroyedBanner.offsetWidth;
  elements.destroyedBanner.classList.add("show");
  window.setTimeout(() => elements.destroyedBanner.classList.remove("show"), 1200);
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
  state.enhanceTarget = 10;
  state.balanceVersion = BALANCE_VERSION;
  state.inventory = normalizeInventory();
  state.selectedItems = normalizeSelectedItems();
  battleTimeLeft = BATTLE_TIME_LIMIT;
  setMessage("새 검을 받았습니다. 다시 강화해 보세요.");
  addLog("새 검으로 시작");
  saveGame();
  render();
}

elements.enhanceButton.addEventListener("click", enhance);
elements.autoEnhanceButton.addEventListener("click", toggleAutoEnhance);
elements.enhanceTargetPrevButton.addEventListener("click", () => changeEnhanceTarget(-1));
elements.enhanceTargetNextButton.addEventListener("click", () => changeEnhanceTarget(1));
elements.soundToggleButton.addEventListener("click", toggleSound);
elements.bgmToggleButton.addEventListener("click", toggleBgm);
elements.themeToggleButton.addEventListener("click", toggleTheme);
elements.workButton.addEventListener("click", showBattle);
elements.resetButton.addEventListener("click", resetGame);
elements.backButton.addEventListener("click", showUpgrade);
elements.stayButton.addEventListener("click", showUpgrade);
elements.attackButton.addEventListener("click", attackMonster);
elements.autoAttackButton.addEventListener("click", toggleAutoAttack);
elements.monsterPrevButton.addEventListener("click", () => changeMonsterStage(-1));
elements.monsterNextButton.addEventListener("click", () => changeMonsterStage(1));
document.addEventListener("pointerdown", resumeBgmAfterGesture);
elements.inventoryItems.addEventListener("click", (event) => {
  const button = event.target.closest("[data-item]");
  if (!button) return;
  selectInventoryItem(button.dataset.item);
});
elements.battleInventoryItems.addEventListener("click", (event) => {
  const button = event.target.closest("[data-item]");
  if (!button) return;
  selectInventoryItem(button.dataset.item);
});

loadGame();
ensureMonsterHp();
render();
