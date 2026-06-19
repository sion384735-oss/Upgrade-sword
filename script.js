import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAnalytics, isSupported as isAnalyticsSupported } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const MAX_LEVEL = 30;
const MAX_MONSTER_LEVEL = 20;
const BATTLE_TIME_LIMIT = 20;
const ATTACK_INTERVAL_MS = 450;
const ATTACK_SOUND_DURATION_MS = 260;
const ATTACK_SOUND_START_SECONDS = 2;
const SWORD_ATTACK_SOUND_PATH = "assets/sounds/sword-attack.mp4";
const FIREWORKS_SOUND_PATH = "Asmr 폭죽소리 효과음.mp4";
const FIREWORKS_SOUND_VOLUME = 0.72;
const FIREWORKS_SOUND_START_SECONDS = 0.55;
const SFX_VOLUME = 0.25;
const PLATINUM_VALUE = 1000000;
const GAMBLE_BET_AMOUNTS = [10000, 100000, PLATINUM_VALUE, PLATINUM_VALUE * 10];
const MIN_GAMBLE_BET = GAMBLE_BET_AMOUNTS[0];
const GAMBLE_TYPES = ["oddEven", "ladder"];
const BALANCE_VERSION = 3;
const STORAGE_KEY = "sword-upgrade-save";
const SAVE_MIGRATION_KEY = "sword-upgrade-save-signature-enabled";
const SAVE_SIGNATURE_SALT = "sword-upgrade-local-save-v4";
const RANKING_KEY = "sword-upgrade-rankings";
const RANKING_SORTS = ["time", "gold", "attempts"];
const RANKING_SORT_FIELDS = {
  time: "clearTimeMs",
  gold: "spentGold",
  attempts: "enhanceAttempts",
};
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBxTjoR9UpAek0XtQwNO_5sXAKvS5u-9fU",
  authDomain: "sowrd-upgrade.firebaseapp.com",
  projectId: "sowrd-upgrade",
  storageBucket: "sowrd-upgrade.firebasestorage.app",
  messagingSenderId: "387805116792",
  appId: "1:387805116792:web:b1f9cbd7c55086fe21708d",
  measurementId: "G-EM9ZZECBX2",
};
const FIRESTORE_RANKINGS_COLLECTION = "rankings";
const FIRESTORE_SAVES_COLLECTION = "userSaves";
const FIRESTORE_DEVELOPER_MESSAGES_COLLECTION = "developerMessages";
const RANKING_SAVE_TIMEOUT_MS = 5000;
const COFFEE_PAYMENT_URL = "https://qr.kakaopay.com/FJUnB2V9U3e807610";
const COFFEE_BANK_ACCOUNT = "1002-252-257948";
const DEVELOPER_EMAIL = "sion3847@naver.com";
const SUCCESS_CHANCES = Object.freeze([
  100, 95, 90, 85, 80, 75, 70, 65, 60, 55,
  50, 45, 40, 35, 30, 25, 20, 16, 13, 10,
  3, 2.7, 2.3, 2.0, 1.7, 1.3, 1.0, 0.6, 0.3, 0.1,
]);
const ITEM_DROP_CHANCE_BONUS = 3;
const BOOST10_DROP_CHANCE_BONUS = 5;
const BOOSTED_DROP_ITEMS = ["protect", "fallProtect", "boost5"];
const ITEM_ORDER = ["protect", "fallProtect", "boost5", "boost10"];
const DROP_ITEM_ORDER = ["protect", "fallProtect", "boost5", "boost10"];
const SHOP_ITEMS = [
  { itemKey: "protect", price: 1000000 },
  { itemKey: "fallProtect", price: 500000 },
  { itemKey: "boost5", price: 500000 },
];
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
    name: "강화확률 3% 증가권",
    description: "선택 후 강화하면 성공 확률이 3% 증가합니다.",
    chanceBonus: 3,
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
  runStartedAt: Date.now(),
  spentGold: 0,
  enhanceAttempts: 0,
  maxCompletionShown: false,
};

let autoAttackTimer = null;
let autoEnhanceTimer = null;
let autoEnhanceItemPlan = null;
let battleTimer = null;
let battleTimeLeft = BATTLE_TIME_LIMIT;
let lastAttackAt = 0;
let audioContext = null;
let bgmTimer = null;
let bgmGain = null;
let enhanceSettingsOpen = false;
let attackSoundIndex = 0;
let attackSounds = [];
let fireworksSoundIndex = 0;
let fireworksSounds = [];
let fireworksAudioBuffer = null;
let fireworksAudioBufferPromise = null;
let fireworksAudioSources = [];
let activeRankingSort = "time";
let rankingRenderToken = 0;
let firebaseDb = null;
let firebaseAuth = null;
let googleAuthProvider = null;
let currentUser = null;
let cloudSaveTimer = null;
let cloudSaveLoading = false;
let authPromptDismissed = false;
let authPromptShown = false;
let activeGambleType = "oddEven";
let gambleInProgress = false;
let rankingAutoRegisterTimer = null;
let rankingRegistering = false;
let completionCelebrationTimer = null;

const BGM_ROOTS = [110, 103.83, 98, 92.5, 87.31, 82.41, 77.78, 73.42, 69.3, 65.41];

try {
  const firebaseApp = initializeApp(FIREBASE_CONFIG);
  firebaseDb = getFirestore(firebaseApp);
  firebaseAuth = getAuth(firebaseApp);
  googleAuthProvider = new GoogleAuthProvider();
  googleAuthProvider.setCustomParameters({ prompt: "select_account" });
  isAnalyticsSupported()
    .then((supported) => {
      if (supported) getAnalytics(firebaseApp);
    })
    .catch(() => {});
} catch {
  firebaseDb = null;
}

const elements = {
  stage: document.querySelector(".stage"),
  upgradeView: document.querySelector("#upgradeView"),
  battleView: document.querySelector("#battleView"),
  destroyedBanner: document.querySelector("#destroyedBanner"),
  itemDepletedBanner: document.querySelector("#itemDepletedBanner"),
  fireworksLayer: document.querySelector("#fireworksLayer"),
  completionModal: document.querySelector("#completionModal"),
  completionDoneButton: document.querySelector("#completionDoneButton"),
  rankingNameInput: document.querySelector("#rankingNameInput"),
  rankingRegisterButton: document.querySelector("#rankingRegisterButton"),
  rankingNameHint: document.querySelector("#rankingNameHint"),
  rankingModal: document.querySelector("#rankingModal"),
  rankingList: document.querySelector("#rankingList"),
  rankingCloseButton: document.querySelector("#rankingCloseButton"),
  rankingTabs: document.querySelector(".ranking-tabs"),
  settingsRow: document.querySelector("#settingsRow"),
  mobileSettingsButtons: document.querySelectorAll("[data-mobile-settings-button]"),
  rankingToggleButton: document.querySelector("#rankingToggleButton"),
  authModal: document.querySelector("#authModal"),
  authToggleButton: document.querySelector("#authToggleButton"),
  authCloseButton: document.querySelector("#authCloseButton"),
  authGoogleButton: document.querySelector("#authGoogleButton"),
  authLogoutButton: document.querySelector("#authLogoutButton"),
  authHint: document.querySelector("#authHint"),
  authStatus: document.querySelector("#authStatus"),
  coffeeModal: document.querySelector("#coffeeModal"),
  coffeeCloseButton: document.querySelector("#coffeeCloseButton"),
  coffeePayButton: document.querySelector("#coffeePayButton"),
  coffeeCopyButton: document.querySelector("#coffeeCopyButton"),
  coffeeBankAccount: document.querySelector("#coffeeBankAccount"),
  coffeeHint: document.querySelector("#coffeeHint"),
  gambleModal: document.querySelector("#gambleModal"),
  gambleCloseButton: document.querySelector("#gambleCloseButton"),
  gambleToggleButton: document.querySelector("#gambleToggleButton"),
  gambleWallet: document.querySelector("#gambleWallet"),
  gambleBetOptions: document.querySelector("#gambleBetOptions"),
  gambleBetResetButton: document.querySelector("#gambleBetResetButton"),
  gambleBetInput: document.querySelector("#gambleBetInput"),
  gambleBetUnit: document.querySelector("#gambleBetUnit"),
  gambleHint: document.querySelector("#gambleHint"),
  gambleTabs: document.querySelector(".gamble-tabs"),
  oddEvenGame: document.querySelector("#oddEvenGame"),
  ladderGame: document.querySelector("#ladderGame"),
  oddEvenStage: document.querySelector("#oddEvenStage"),
  oddEvenOrb: document.querySelector("#oddEvenOrb"),
  oddEvenResult: document.querySelector("#oddEvenResult"),
  ladderStage: document.querySelector("#ladderStage"),
  ladderMarker: document.querySelector("#ladderMarker"),
  ladderResult: document.querySelector("#ladderResult"),
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
  developerMessageForm: document.querySelector("#developerMessageForm"),
  developerMessageInput: document.querySelector("#developerMessageInput"),
  developerMessageButton: document.querySelector("#developerMessageButton"),
  developerMessageHint: document.querySelector("#developerMessageHint"),
  developerEmail: document.querySelector("#developerEmail"),
  developerEmailCopyButton: document.querySelector("#developerEmailCopyButton"),
  developerEmailHint: document.querySelector("#developerEmailHint"),
  enhanceButton: document.querySelector("#enhanceButton"),
  autoEnhanceButton: document.querySelector("#autoEnhanceButton"),
  autoEnhanceStartButton: document.querySelector("#autoEnhanceStartButton"),
  enhanceSettings: document.querySelector("#enhanceSettings"),
  autoItemStatus: document.querySelector("#autoItemStatus"),
  shopToggleButton: document.querySelector("#shopToggleButton"),
  shopModal: document.querySelector("#shopModal"),
  shopCloseButton: document.querySelector("#shopCloseButton"),
  enhanceTargetPrevButton: document.querySelector("#enhanceTargetPrevButton"),
  enhanceTargetNextButton: document.querySelector("#enhanceTargetNextButton"),
  enhanceTargetReadout: document.querySelector("#enhanceTargetReadout"),
  soundToggleButton: document.querySelector("#soundToggleButton"),
  bgmToggleButton: document.querySelector("#bgmToggleButton"),
  themeToggleButton: document.querySelector("#themeToggleButton"),
  workButton: document.querySelector("#workButton"),
  topWorkButton: document.querySelector("#topWorkButton"),
  topGambleButton: document.querySelector("#topGambleButton"),
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
  shopItems: document.querySelector("#shopItems"),
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
  0, 100, 450, 1200, 3000, 3750, 8500, 19000, 20500, 30000, 55000,
  100000, 180000, 325000, 575000, 1000000, 1700000, 2875000, 4750000,
  8000000, 13000000,
];
const monsterHpTable = [
  0, 1000, 4500, 12000, 30000, 75000, 170000, 380000, 410000, 600000,
  1100000, 2000000, 3600000, 6500000, 11500000, 20000000, 34000000,
  57500000, 95000000, 160000000, 260000000,
];

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
  gain.gain.exponentialRampToValueAtTime(volume * SFX_VOLUME, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playSweep(startFrequency, endFrequency, duration = 0.12, type = "sawtooth", volume = 0.06, delay = 0) {
  const context = getAudioContext();
  if (context.state === "suspended") context.resume();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + delay;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFrequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume * SFX_VOLUME, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playNoiseBurst(duration = 0.12, volume = 0.04, delay = 0, filterType = "bandpass", frequency = 1600) {
  const context = getAudioContext();
  if (context.state === "suspended") context.resume();
  const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const start = context.currentTime + delay;

  for (let i = 0; i < sampleCount; i += 1) {
    const fade = 1 - i / sampleCount;
    data[i] = (Math.random() * 2 - 1) * fade;
  }

  filter.type = filterType;
  filter.frequency.setValueAtTime(frequency, start);
  filter.frequency.exponentialRampToValueAtTime(
    filterType === "lowpass" ? Math.max(180, frequency * 0.45) : Math.max(220, frequency * 2.1),
    start + duration * 0.55,
  );
  filter.Q.setValueAtTime(filterType === "lowpass" ? 0.8 : 2.6, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume * SFX_VOLUME, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start(start);
  source.stop(start + duration);
}

function playSyntheticSwordHit() {
  playNoiseBurst(0.13, 0.055);
  playSweep(2400, 340, 0.14, "sawtooth", 0.055);
  playSweep(1600, 520, 0.09, "triangle", 0.045, 0.045);
  playTone(1760, 0.055, "triangle", 0.04, 0.095);
  playTone(2793, 0.04, "sine", 0.03, 0.125);
  playTone(988, 0.09, "triangle", 0.022, 0.17);
}

function playSyntheticFireworks() {
  for (let burst = 0; burst < 4; burst += 1) {
    const delay = burst * 0.22;
    playNoiseBurst(0.34, 0.22, delay, "lowpass", 780);
    playNoiseBurst(0.18, 0.11, delay + 0.045, "bandpass", 900);
    playSweep(92, 42, 0.28, "sine", 0.14, delay);
    playTone(130 + burst * 18, 0.13, "triangle", 0.09, delay + 0.02);
  }
}

function ensureAttackSounds() {
  if (!attackSounds.length) {
    attackSounds = Array.from({ length: 4 }, () => {
      const audio = new Audio(SWORD_ATTACK_SOUND_PATH);
      audio.preload = "auto";
      audio.volume = 0.25;
      return audio;
    });
  }
  return attackSounds;
}

function ensureFireworksSounds() {
  if (!fireworksSounds.length) {
    fireworksSounds = Array.from({ length: 3 }, () => {
      const audio = new Audio(FIREWORKS_SOUND_PATH);
      audio.preload = "auto";
      audio.volume = FIREWORKS_SOUND_VOLUME;
      return audio;
    });
  }
  return fireworksSounds;
}

function loadFireworksAudioBuffer() {
  if (fireworksAudioBuffer || fireworksAudioBufferPromise) return fireworksAudioBufferPromise;

  fireworksAudioBufferPromise = fetch(encodeURI(FIREWORKS_SOUND_PATH))
    .then((response) => {
      if (!response.ok) throw new Error("Fireworks sound load failed.");
      return response.arrayBuffer();
    })
    .then((arrayBuffer) => getAudioContext().decodeAudioData(arrayBuffer))
    .then((audioBuffer) => {
      fireworksAudioBuffer = audioBuffer;
      return audioBuffer;
    })
    .catch(() => {
      fireworksAudioBufferPromise = null;
      return null;
    });

  return fireworksAudioBufferPromise;
}

function prepareCelebrationSounds() {
  if (!state.soundEnabled) return;
  ensureFireworksSounds().forEach((audio) => {
    audio.load();
  });
  loadFireworksAudioBuffer();
  if (audioContext?.state === "suspended") audioContext.resume();
}

function prepareSwordAttackSound() {
  if (!state.soundEnabled) return;
  ensureAttackSounds().forEach((audio) => {
    if (audio.readyState === 0) audio.load();
  });
  prepareCelebrationSounds();
  if (audioContext?.state === "suspended") audioContext.resume();
}

function playSwordAttackClip() {
  ensureAttackSounds();
  const audio = attackSounds[attackSoundIndex];
  attackSoundIndex = (attackSoundIndex + 1) % attackSounds.length;
  audio.pause();
  audio.currentTime = ATTACK_SOUND_START_SECONDS;
  audio.volume = 0.25;

  const playPromise = audio.play();
  window.setTimeout(() => {
    audio.pause();
    audio.currentTime = ATTACK_SOUND_START_SECONDS;
  }, ATTACK_SOUND_DURATION_MS);

  if (playPromise?.catch) {
    playPromise.catch(() => playSyntheticSwordHit());
  }
}

function playFireworksClip() {
  if (fireworksAudioBuffer) {
    const context = getAudioContext();
    if (context.state === "suspended") context.resume();
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = fireworksAudioBuffer;
    gain.gain.setValueAtTime(FIREWORKS_SOUND_VOLUME, context.currentTime);
    source.connect(gain);
    gain.connect(context.destination);
    source.start(context.currentTime, Math.min(FIREWORKS_SOUND_START_SECONDS, fireworksAudioBuffer.duration - 0.05));
    fireworksAudioSources.push(source);
    source.onended = () => {
      fireworksAudioSources = fireworksAudioSources.filter((item) => item !== source);
    };
    return;
  }

  ensureFireworksSounds();
  const audio = fireworksSounds[fireworksSoundIndex];
  fireworksSoundIndex = (fireworksSoundIndex + 1) % fireworksSounds.length;
  audio.pause();
  audio.currentTime = FIREWORKS_SOUND_START_SECONDS;
  audio.volume = FIREWORKS_SOUND_VOLUME;

  const playPromise = audio.play();
  if (playPromise?.catch) {
    playPromise.catch(() => playSyntheticFireworks());
  }
}

function stopFireworksClips() {
  fireworksAudioSources.forEach((source) => {
    try {
      source.stop();
    } catch {}
  });
  fireworksAudioSources = [];
  fireworksSounds.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
}

function playSound(name) {
  if (!state.soundEnabled) return;

  const patterns = {
    hit: () => {
      playSwordAttackClip();
    },
    gold: () => {
      playTone(880, 0.08, "triangle", 0.07);
      playTone(1175, 0.1, "triangle", 0.06, 0.08);
      playTone(1568, 0.12, "triangle", 0.05, 0.16);
    },
    gambleWin: () => {
      playTone(1047, 0.11, "triangle", 0.42);
      playTone(1568, 0.13, "triangle", 0.38, 0.08);
      playTone(2093, 0.18, "sine", 0.34, 0.17);
      playTone(2637, 0.22, "sine", 0.24, 0.28);
      playNoiseBurst(0.08, 0.08, 0.02, "bandpass", 3200);
    },
    gambleLose: () => {
      playSweep(523, 196, 0.34, "triangle", 0.18);
      playTone(165, 0.28, "sine", 0.12, 0.25);
      playTone(131, 0.38, "sine", 0.1, 0.42);
      playNoiseBurst(0.18, 0.045, 0.12, "lowpass", 520);
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
    fireworks: () => {
      playFireworksClip();
    },
    applause: () => {
      for (let clap = 0; clap < 12; clap += 1) {
        const delay = clap * 0.075;
        playNoiseBurst(0.055, 0.11, delay, "bandpass", 1800);
        playNoiseBurst(0.04, 0.075, delay + 0.022, "bandpass", 2600);
      }
    },
  };
  patterns[name]?.();
}

function playMonsterDeathSound(level) {
  if (!state.soundEnabled) return;

  const sounds = {
    1: () => {
      playNoiseBurst(0.18, 0.045);
      playSweep(360, 110, 0.2, "sine", 0.045);
    },
    2: () => {
      playSweep(1400, 520, 0.16, "triangle", 0.05);
      playTone(1900, 0.05, "sine", 0.04, 0.06);
    },
    3: () => {
      playTone(520, 0.08, "square", 0.045);
      playSweep(420, 160, 0.18, "sawtooth", 0.04, 0.06);
    },
    4: () => {
      playSweep(520, 90, 0.28, "sawtooth", 0.055);
      playNoiseBurst(0.16, 0.035, 0.08);
    },
    5: () => {
      playSweep(820, 260, 0.24, "triangle", 0.05);
      playTone(360, 0.1, "sawtooth", 0.04, 0.11);
    },
    6: () => {
      playSweep(260, 70, 0.32, "sawtooth", 0.055);
      playNoiseBurst(0.2, 0.03, 0.1);
    },
    7: () => {
      playTone(160, 0.09, "square", 0.055);
      playTone(240, 0.08, "square", 0.045, 0.08);
      playNoiseBurst(0.18, 0.04, 0.12);
    },
    8: () => {
      playTone(95, 0.16, "sine", 0.07);
      playTone(140, 0.12, "triangle", 0.05, 0.09);
      playNoiseBurst(0.24, 0.04, 0.14);
    },
    9: () => {
      playSweep(650, 120, 0.28, "sawtooth", 0.065);
      playTone(90, 0.16, "triangle", 0.04, 0.12);
    },
    10: () => {
      playSweep(900, 80, 0.34, "sawtooth", 0.06);
      playTone(1200, 0.06, "triangle", 0.035, 0.08);
    },
    11: () => {
      playTone(130, 0.18, "square", 0.06);
      playSweep(520, 180, 0.22, "triangle", 0.04, 0.08);
    },
    12: () => {
      playSweep(740, 180, 0.24, "sawtooth", 0.055);
      playTone(1568, 0.05, "sine", 0.035, 0.11);
    },
    13: () => {
      playSweep(1100, 140, 0.36, "sine", 0.052);
      playTone(220, 0.2, "triangle", 0.04, 0.12);
    },
    14: () => {
      playTone(180, 0.1, "triangle", 0.05);
      playTone(270, 0.1, "triangle", 0.045, 0.08);
      playNoiseBurst(0.28, 0.045, 0.12);
    },
    15: () => {
      playSweep(620, 95, 0.38, "sawtooth", 0.065);
      playTone(72, 0.22, "sine", 0.05, 0.16);
    },
    16: () => {
      playTone(85, 0.18, "square", 0.07);
      playNoiseBurst(0.24, 0.05, 0.08);
      playTone(170, 0.16, "triangle", 0.045, 0.18);
    },
    17: () => {
      playSweep(520, 55, 0.46, "sawtooth", 0.075);
      playTone(65, 0.3, "sine", 0.055, 0.2);
    },
    18: () => {
      playTone(70, 0.18, "square", 0.075);
      playSweep(360, 72, 0.42, "sawtooth", 0.06, 0.08);
      playNoiseBurst(0.26, 0.04, 0.18);
    },
    19: () => {
      playSweep(880, 75, 0.5, "triangle", 0.07);
      playTone(1320, 0.08, "sine", 0.04, 0.12);
      playTone(66, 0.32, "sine", 0.06, 0.22);
    },
    20: () => {
      playTone(52, 0.34, "sine", 0.08);
      playSweep(420, 45, 0.58, "sawtooth", 0.075, 0.05);
      playNoiseBurst(0.36, 0.055, 0.18);
    },
  };

  sounds[level]?.();
}

function ensureBgmGain() {
  const context = getAudioContext();
  if (!bgmGain) {
    bgmGain = context.createGain();
    bgmGain.gain.setValueAtTime(0.32, context.currentTime);
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
  if (state.monsterLevel >= MAX_MONSTER_LEVEL) {
    return {
      masterVolume: 0.58,
      step: 1.25,
      leadType: "triangle",
      bassType: "sawtooth",
      drone: 41.2,
      orchestral: true,
      chords: [
        [82.41, 123.47, 164.81, 246.94, 329.63],
        [73.42, 110, 146.83, 220, 293.66],
        [65.41, 98, 130.81, 196, 261.63],
        [61.74, 92.5, 123.47, 185, 246.94],
        [73.42, 110, 146.83, 220, 293.66],
        [82.41, 123.47, 164.81, 246.94, 329.63],
      ],
      leadVolume: 0.15,
      bassVolume: 0.3,
      harmonyVolume: 0.2,
      pulseVolume: 0.09,
    };
  }

  if (state.monsterLevel <= 10) {
    return {
      masterVolume: 0.36,
      step: 1.65,
      leadType: "sine",
      bassType: "sine",
      drone: 55,
      chords: [
        [110, 165, 220],
        [98, 146.83, 196],
        [87.31, 130.81, 174.61],
        [98, 146.83, 220],
      ],
      leadVolume: 0.08,
      bassVolume: 0.17,
      harmonyVolume: 0.12,
      pulseVolume: 0,
    };
  }

  const intensity = state.monsterLevel - 10;
  const root = BGM_ROOTS[intensity - 1] ?? 65.41;
  const fifth = root * 1.5;
  const octave = root * 2;
  const minorThird = root * 1.2;
  const lowRoot = root * 0.5;
  return {
    masterVolume: Math.min(0.5, 0.38 + intensity * 0.012),
    step: Math.max(1.15, 1.65 - intensity * 0.035),
    leadType: intensity >= 7 ? "triangle" : "sine",
    bassType: intensity >= 6 ? "triangle" : "sine",
    drone: lowRoot,
    chords: [
      [root, minorThird, fifth, octave],
      [root * 0.89, root * 1.33, root * 1.78, root * 2.67],
      [root * 0.75, root * 1.12, root * 1.5, root * 2.25],
      [root * 0.84, root * 1.26, root * 1.68, root * 2.52],
    ],
    leadVolume: 0.095 + intensity * 0.005,
    bassVolume: 0.19 + intensity * 0.008,
    harmonyVolume: 0.13 + intensity * 0.008,
    pulseVolume: intensity >= 6 ? 0.045 + intensity * 0.004 : 0,
  };
}

function playBgmLoop() {
  if (!state.bgmEnabled || !bgmGain) return;

  const profile = getBgmProfile();
  bgmGain.gain.cancelScheduledValues(audioContext.currentTime);
  bgmGain.gain.setValueAtTime(profile.masterVolume, audioContext.currentTime);

  const loopDuration = profile.step * profile.chords.length;
  playBgmTone(profile.drone, 0, loopDuration * 0.96, "sine", profile.bassVolume * 0.75);
  playBgmTone(profile.drone * 2, 0.08, loopDuration * 0.9, profile.bassType, profile.bassVolume * 0.45);

  profile.chords.forEach((chord, index) => {
    const offset = index * profile.step;
    chord.forEach((note, noteIndex) => {
      const volume = noteIndex === 0 ? profile.bassVolume : profile.harmonyVolume / (noteIndex + 0.6);
      playBgmTone(note, offset, profile.step * 1.22, noteIndex === 0 ? profile.bassType : profile.leadType, volume);
    });
    playBgmTone(chord[chord.length - 1] * 1.5, offset + profile.step * 0.46, profile.step * 0.55, "sine", profile.leadVolume);
    if (profile.pulseVolume > 0) {
      playBgmTone(chord[0] * 0.5, offset + profile.step * 0.82, profile.step * 0.18, "triangle", profile.pulseVolume);
    }
    if (profile.orchestral) {
      playBgmTone(chord[0] * 0.25, offset, profile.step * 0.32, "sine", profile.pulseVolume * 1.45);
      playBgmTone(chord[1] * 2, offset + profile.step * 0.2, profile.step * 0.72, "triangle", profile.leadVolume * 0.82);
      playBgmTone(chord[2] * 2, offset + profile.step * 0.36, profile.step * 0.56, "triangle", profile.leadVolume * 0.58);
      playBgmTone(chord[chord.length - 1] * 2, offset + profile.step * 0.68, profile.step * 0.42, "sine", profile.leadVolume * 0.46);
      if (index % 2 === 0) {
        playBgmTone(chord[0] * 0.5, offset + profile.step * 0.5, profile.step * 0.24, "sawtooth", profile.pulseVolume);
      }
    }
  });

  bgmTimer = window.setTimeout(playBgmLoop, loopDuration * 1000);
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
  prepareCelebrationSounds();
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
  return ((monsterLevel - 9) / (MAX_MONSTER_LEVEL - 9)) * 10;
}

function getItemDropChances(monsterLevel) {
  const baseChance = getItemDropBaseChance(monsterLevel);
  const boostedChance = monsterLevel < 10 ? 0 : baseChance + ITEM_DROP_CHANCE_BONUS;
  const boost10Chance = monsterLevel < 10
    ? 0
    : ((monsterLevel - 9) / (MAX_MONSTER_LEVEL - 9)) * 1 + BOOST10_DROP_CHANCE_BONUS;
  return DROP_ITEM_ORDER.reduce((chances, itemKey) => {
    chances[itemKey] = BOOSTED_DROP_ITEMS.includes(itemKey) ? boostedChance : boost10Chance;
    return chances;
  }, {});
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

  if (selectedItems.boost5 > 0 && selectedItems.boost10 > 0) {
    selectedItems.boost10 = 0;
  }

  return selectedItems;
}

function getSelectedItemCount(itemKey) {
  return Math.min(state.selectedItems[itemKey] ?? 0, getItemSelectionLimit(itemKey));
}

function hasSelectedItems() {
  return ITEM_ORDER.some((itemKey) => getSelectedItemCount(itemKey) > 0);
}

function hasRawSelectedItems() {
  return ITEM_ORDER.some((itemKey) => (state.selectedItems[itemKey] ?? 0) > 0);
}

function hasEnoughSelectedItemsForEnhance() {
  return ITEM_ORDER.every((itemKey) => {
    const selectedCount = state.selectedItems[itemKey] ?? 0;
    return selectedCount <= 0 || state.inventory[itemKey] >= selectedCount;
  });
}

function getSelectedItemPlan() {
  return ITEM_ORDER.reduce((plan, itemKey) => {
    const selectedCount = state.selectedItems[itemKey] ?? 0;
    if (selectedCount > 0) plan[itemKey] = selectedCount;
    return plan;
  }, {});
}

function hasItemPlanItems(plan) {
  return Boolean(plan) && Object.values(plan).some((count) => count > 0);
}

function hasEnoughItemsForPlan(plan) {
  if (!hasItemPlanItems(plan)) return true;
  return Object.entries(plan).every(([itemKey, selectedCount]) => {
    return state.inventory[itemKey] >= selectedCount;
  });
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
  return `assets/swords/stages-30-final-transparent/sword-stage-${String(imageLevel).padStart(2, "0")}.png`;
}

function getMonsterImagePath(level) {
  return `assets/monsters/stages-20-centered-transparent/monster-stage-${String(level).padStart(2, "0")}.png`;
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
  if (targetMonster === 0) return { min: 26, max: 34 };

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

function getSaveData() {
  return {
    gold: state.gold,
    level: state.level,
    best: state.best,
    destroyed: state.destroyed,
    monsterLevel: state.monsterLevel,
    unlockedMonsterLevel: state.unlockedMonsterLevel,
    monsterHp: state.monsterHp,
    enhanceTarget: state.enhanceTarget,
    soundEnabled: state.soundEnabled,
    bgmEnabled: state.bgmEnabled,
    theme: state.theme,
    balanceVersion: state.balanceVersion,
    inventory: state.inventory,
    selectedItems: state.selectedItems,
    runStartedAt: state.runStartedAt,
    spentGold: state.spentGold,
    enhanceAttempts: state.enhanceAttempts,
    maxCompletionShown: state.maxCompletionShown,
    savedAt: Date.now(),
  };
}

function createSaveSignature(payload) {
  const text = `${SAVE_SIGNATURE_SALT}:${payload}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function createSignedSaveData() {
  const payload = JSON.stringify(getSaveData());
  return {
    data: payload,
    signature: createSaveSignature(payload),
  };
}

function readSignedSaveData(saved) {
  const parsed = JSON.parse(saved);
  if (typeof parsed?.data === "string" && typeof parsed?.signature === "string") {
    if (parsed.signature !== createSaveSignature(parsed.data)) return null;
    return JSON.parse(parsed.data);
  }

  if (localStorage.getItem(SAVE_MIGRATION_KEY)) return null;
  return parsed;
}

function removeTamperedSave() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(SAVE_MIGRATION_KEY, "1");
}

function readLocalSaveData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;

  try {
    return readSignedSaveData(saved);
  } catch {
    return null;
  }
}

function getSaveTimestamp(save) {
  if (!save) return 0;
  if (Number.isFinite(save.savedAt)) return save.savedAt;
  if (Number.isFinite(save.runStartedAt)) return save.runStartedAt;
  return 0;
}

function applySaveData(parsed, { saveAfter = true } = {}) {
  state.gold = Number.isFinite(parsed.gold)
    ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(parsed.gold)))
    : state.gold;
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
  state.runStartedAt = Number.isFinite(parsed.runStartedAt)
    ? Math.min(Date.now(), Math.max(0, parsed.runStartedAt))
    : Date.now();
  state.spentGold = Number.isFinite(parsed.spentGold)
    ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(parsed.spentGold)))
    : 0;
  state.enhanceAttempts = Number.isFinite(parsed.enhanceAttempts)
    ? Math.max(0, Math.floor(parsed.enhanceAttempts))
    : 0;
  state.maxCompletionShown =
    typeof parsed.maxCompletionShown === "boolean" ? parsed.maxCompletionShown : state.best >= MAX_LEVEL;
  state.balanceVersion = parsed.balanceVersion === BALANCE_VERSION ? BALANCE_VERSION : 0;
  state.monsterHp =
    state.balanceVersion === BALANCE_VERSION && Number.isFinite(parsed.monsterHp)
      ? parsed.monsterHp
      : 0;
  state.balanceVersion = BALANCE_VERSION;
  if (saveAfter) saveGame();
}

function loadGame() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;

  try {
    const parsed = readSignedSaveData(saved);
    if (!parsed) {
      removeTamperedSave();
      return;
    }
    applySaveData(parsed);
  } catch {
    removeTamperedSave();
  }
}

function saveGame() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(createSignedSaveData()));
  localStorage.setItem(SAVE_MIGRATION_KEY, "1");
  queueCloudSave();
}

function getCloudSaveRef(user = currentUser) {
  if (!firebaseDb || !user) return null;
  return doc(firebaseDb, FIRESTORE_SAVES_COLLECTION, user.uid);
}

function queueCloudSave() {
  if (!currentUser || !firebaseDb || cloudSaveLoading) return;
  if (cloudSaveTimer) window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(() => {
    cloudSaveTimer = null;
    saveCloudGame();
  }, 700);
}

async function saveCloudGame() {
  const saveRef = getCloudSaveRef();
  if (!saveRef) return;

  try {
    const save = getSaveData();
    await setDoc(saveRef, {
      save,
      savedAt: save.savedAt,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    if (elements.authHint) elements.authHint.textContent = "온라인 저장 완료";
  } catch {
    if (elements.authHint) elements.authHint.textContent = "온라인 저장 실패. Firebase 설정을 확인하세요.";
  }
}

async function loadCloudGame(user) {
  const saveRef = getCloudSaveRef(user);
  if (!saveRef) return;

  cloudSaveLoading = true;
  try {
    const snapshot = await getDoc(saveRef);
    const cloudSave = snapshot.exists() ? snapshot.data()?.save : null;
    const localSave = readLocalSaveData();

    if (cloudSave || localSave) {
      const selectedSave = getSaveTimestamp(cloudSave) >= getSaveTimestamp(localSave)
        ? cloudSave
        : localSave;
      const selectedSource = selectedSave === cloudSave ? "온라인" : "현재 기기";

      applySaveData(selectedSave, { saveAfter: false });
      saveGame();
      ensureMonsterHp();
      render();
      await saveCloudGame();
      setMessage(`${selectedSource} 저장 데이터를 불러왔습니다.`, "success");
      if (elements.authHint) elements.authHint.textContent = `${selectedSource} 저장 데이터를 불러왔습니다.`;
    } else {
      const save = getSaveData();
      await setDoc(saveRef, {
        save,
        savedAt: save.savedAt,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      if (elements.authHint) elements.authHint.textContent = "현재 진행도를 온라인에 저장했습니다.";
    }
  } catch {
    if (elements.authHint) elements.authHint.textContent = "온라인 저장 불러오기 실패. 로컬 저장으로 진행합니다.";
  } finally {
    cloudSaveLoading = false;
    renderAuth();
  }
}

function getAuthErrorMessage(error) {
  const code = error?.code || "";
  if (code.includes("operation-not-allowed")) return "Firebase 콘솔에서 Google 로그인을 켜야 합니다.";
  if (code.includes("configuration-not-found")) return "Firebase Authentication 설정이 아직 없습니다. 콘솔에서 로그인 제공업체를 먼저 켜야 합니다.";
  if (code.includes("popup-closed-by-user")) return "Google 로그인 창이 닫혔습니다.";
  if (code.includes("popup-blocked")) return "브라우저가 Google 로그인 팝업을 차단했습니다.";
  if (code.includes("account-exists-with-different-credential")) return "같은 이메일로 다른 로그인 방식이 이미 등록되어 있습니다.";
  if (code.includes("unauthorized-domain")) return "Firebase 인증 도메인에 현재 주소가 등록되지 않았습니다.";
  if (code.includes("network-request-failed")) return "네트워크 연결 문제로 Firebase에 접속하지 못했습니다.";
  if (code.includes("too-many-requests")) return "요청이 너무 많습니다. 잠시 후 다시 시도하세요.";
  if (code.includes("api-key-not-valid") || code.includes("invalid-api-key")) return "Firebase API 키 설정을 확인하세요.";
  return code ? `로그인 처리에 실패했습니다. (${code})` : "로그인 처리에 실패했습니다.";
}

function openAuthModal() {
  elements.authModal.classList.remove("hidden");
  renderAuth();
  window.setTimeout(() => elements.authGoogleButton.focus(), 50);
}

function closeAuthModal() {
  authPromptDismissed = true;
  elements.authModal.classList.add("hidden");
}

function showStartupAuthPrompt() {
  if (authPromptDismissed || authPromptShown || currentUser) return;
  authPromptShown = true;
  openAuthModal();
}

function renderAuth() {
  const signedIn = Boolean(currentUser);
  if (elements.authToggleButton) elements.authToggleButton.textContent = signedIn ? "저장됨" : "로그인";
  elements.authStatus.textContent = signedIn
    ? `로그인됨: ${currentUser.email}`
    : "로그인하면 다른 기기에서도 저장 데이터를 불러올 수 있습니다.";
  elements.authLogoutButton.classList.toggle("hidden", !signedIn);
  elements.authGoogleButton.disabled = signedIn || cloudSaveLoading;
}

async function loginWithGoogle() {
  if (!firebaseAuth || !googleAuthProvider) {
    elements.authHint.textContent = "Firebase 연결이 준비되지 않았습니다.";
    return;
  }

  elements.authHint.textContent = "Google 로그인 중...";
  try {
    await signInWithPopup(firebaseAuth, googleAuthProvider);
    elements.authHint.textContent = "Google 로그인 완료. 저장 데이터를 확인 중입니다.";
  } catch (error) {
    const code = error?.code || "";
    if (code.includes("popup-blocked") || code.includes("popup-closed-by-user") || code.includes("cancelled-popup-request")) {
      elements.authHint.textContent = "팝업 로그인이 막혀 Google 로그인 페이지로 이동합니다...";
      try {
        await signInWithRedirect(firebaseAuth, googleAuthProvider);
        return;
      } catch (redirectError) {
        elements.authHint.textContent = getAuthErrorMessage(redirectError);
        return;
      }
    }
    elements.authHint.textContent = getAuthErrorMessage(error);
  }
}

async function logoutAuth() {
  if (!firebaseAuth) return;
  await saveCloudGame();
  await signOut(firebaseAuth);
  elements.authHint.textContent = "로그아웃했습니다. 이 기기에는 로컬 저장이 남아 있습니다.";
  renderAuth();
}

function loadRankings() {
  try {
    const rankings = JSON.parse(localStorage.getItem(RANKING_KEY) || "[]");
    if (!Array.isArray(rankings)) return [];
    return rankings
      .filter((entry) => typeof entry.name === "string" && Number.isFinite(entry.time))
      .slice(0, 50);
  } catch {
    localStorage.removeItem(RANKING_KEY);
    return [];
  }
}

function saveRankings(rankings) {
  localStorage.setItem(RANKING_KEY, JSON.stringify(rankings.slice(0, 50)));
}

function withTimeout(promise, timeoutMs, errorMessage = "Request timed out.") {
  let timeoutId = null;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId);
  });
}

function normalizeRankingEntry(entry) {
  if (!entry || typeof entry.name !== "string") return null;
  const clearTimeMs = Number(entry.clearTimeMs);
  const spentGold = Number(entry.spentGold);
  const enhanceAttempts = Number(entry.enhanceAttempts);
  const firestoreTime = entry.createdAt && typeof entry.createdAt.toMillis === "function"
    ? entry.createdAt.toMillis()
    : NaN;
  const time = Number.isFinite(Number(entry.time)) ? Number(entry.time) : firestoreTime;

  if (!Number.isFinite(clearTimeMs)) return null;
  return {
    name: sanitizeRankingName(entry.name),
    level: MAX_LEVEL,
    gold: Number.isFinite(Number(entry.gold)) ? Number(entry.gold) : 0,
    clearTimeMs,
    spentGold: Number.isFinite(spentGold) ? spentGold : Number.MAX_SAFE_INTEGER,
    enhanceAttempts: Number.isFinite(enhanceAttempts)
      ? Math.max(0, Math.floor(enhanceAttempts))
      : Number.MAX_SAFE_INTEGER,
    time: Number.isFinite(time) ? time : Date.now(),
  };
}

async function loadRemoteRankings() {
  if (!firebaseDb) return null;
  const sortField = RANKING_SORT_FIELDS[activeRankingSort] ?? RANKING_SORT_FIELDS.time;
  const rankingQuery = query(
    collection(firebaseDb, FIRESTORE_RANKINGS_COLLECTION),
    orderBy(sortField, "asc"),
    limit(50),
  );
  const snapshot = await getDocs(rankingQuery);
  return snapshot.docs
    .map((doc) => normalizeRankingEntry(doc.data()))
    .filter(Boolean);
}

function sanitizeRankingName(value) {
  return value.replace(/[^A-Za-z0-9가-힣]/g, "").slice(0, 10);
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function formatRankingDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  if (minutes > 0) return `${minutes}분 ${seconds}초`;
  return `${seconds}초`;
}

function getSortedRankings() {
  const rankings = loadRankings();
  const valueBySort = {
    time: (entry) => entry.clearTimeMs ?? Number.MAX_SAFE_INTEGER,
    gold: (entry) => entry.spentGold ?? Number.MAX_SAFE_INTEGER,
    attempts: (entry) => entry.enhanceAttempts ?? Number.MAX_SAFE_INTEGER,
  };
  const getValue = valueBySort[activeRankingSort] ?? valueBySort.time;
  return rankings.sort((a, b) => {
    const primary = getValue(a) - getValue(b);
    if (primary !== 0) return primary;
    const timeDiff = (a.clearTimeMs ?? 0) - (b.clearTimeMs ?? 0);
    if (timeDiff !== 0) return timeDiff;
    return a.time - b.time;
  });
}

function formatGold(value) {
  if (value >= 1000000) {
    const platinum = value / 1000000;
    const formatted = platinum >= 100
      ? Math.floor(platinum).toLocaleString("ko-KR")
      : platinum.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
    return `${formatted} 💠백금`;
  }
  return `${value.toLocaleString("ko-KR")} 🪙`;
}

function formatGoldHtml(value) {
  if (value >= 1000000) {
    const platinum = value / 1000000;
    const formatted = platinum >= 100
      ? Math.floor(platinum).toLocaleString("ko-KR")
      : platinum.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
    return `${formatted} 💠백금`;
  }
  return `${value.toLocaleString("ko-KR")} <span class="gold-coin-icon" aria-label="골드"></span>`;
}

function formatBetUnit(value) {
  if (value >= PLATINUM_VALUE) {
    const platinum = value / PLATINUM_VALUE;
    const formatted = platinum >= 100
      ? Math.floor(platinum).toLocaleString("ko-KR")
      : platinum.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
    return `${formatted}백금`;
  }
  if (value >= 10000) return `${Math.floor(value / 10000).toLocaleString("ko-KR")}만 골드`;
  return `${value.toLocaleString("ko-KR")}골드`;
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

function getRankingMetricHtml(entry) {
  if (activeRankingSort === "gold") {
    const value = Number.isFinite(entry.spentGold) ? formatGoldHtml(entry.spentGold) : "-";
    return `<em class="ranking-metric gold">${value}</em>`;
  }
  if (activeRankingSort === "attempts") {
    const value = Number.isFinite(entry.enhanceAttempts)
      ? `${Number(entry.enhanceAttempts).toLocaleString("ko-KR")}회`
      : "-";
    return `<em class="ranking-metric attempts">${value}</em>`;
  }
  const value = Number.isFinite(entry.clearTimeMs) ? formatDuration(entry.clearTimeMs) : "-";
  return `<em class="ranking-metric time"><span class="ranking-icon time" aria-hidden="true"></span>${value}</em>`;
}

async function renderRankingList() {
  const currentToken = ++rankingRenderToken;
  elements.rankingTabs.querySelectorAll("[data-ranking-sort]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.rankingSort === activeRankingSort);
  });
  elements.rankingList.innerHTML = `<div class="ranking-empty">랭킹을 불러오는 중입니다.</div>`;

  let rankings = [];
  let isRemote = false;
  try {
    const remoteRankings = await loadRemoteRankings();
    if (currentToken !== rankingRenderToken) return;
    if (remoteRankings) {
      rankings = remoteRankings;
      isRemote = true;
    } else {
      rankings = getSortedRankings();
    }
  } catch {
    if (currentToken !== rankingRenderToken) return;
    rankings = getSortedRankings();
  }

  if (!rankings.length) {
    elements.rankingList.innerHTML = `<div class="ranking-empty">아직 등록된 랭킹이 없습니다.</div>`;
    return;
  }

  elements.rankingList.innerHTML = rankings.map((entry, index) => `
    <div class="ranking-row">
      <strong>${index + 1}</strong>
      <div>
        <span>${escapeHtml(entry.name)}</span>
        <div class="ranking-meta">
          ${getRankingMetricHtml(entry)}
        </div>
      </div>
    </div>
  `).join("") + (isRemote ? "" : `<div class="ranking-empty">온라인 랭킹 연결 실패: 이 기기의 저장 랭킹을 표시합니다.</div>`);
}

function openRankingModal() {
  renderRankingList();
  elements.rankingModal.classList.remove("hidden");
}

function closeRankingModal() {
  elements.rankingModal.classList.add("hidden");
}

function closeMobileSettings() {
  elements.settingsRow.classList.remove("open");
  elements.mobileSettingsButtons.forEach((button) => {
    button.setAttribute("aria-expanded", "false");
  });
}

function toggleMobileSettings() {
  const isOpen = elements.settingsRow.classList.toggle("open");
  elements.mobileSettingsButtons.forEach((button) => {
    button.setAttribute("aria-expanded", String(isOpen));
  });
}

function openCoffeeModal() {
  elements.coffeePayButton.href = COFFEE_PAYMENT_URL;
  elements.coffeeBankAccount.textContent = `우리은행 ${COFFEE_BANK_ACCOUNT}`;
  elements.coffeeHint.textContent = COFFEE_PAYMENT_URL
    ? "웹에서는 계좌번호를 복사해서 송금하고, 모바일에서는 카카오페이를 사용할 수 있습니다."
    : "결제 링크가 아직 설정되지 않았습니다. script.js의 COFFEE_PAYMENT_URL에 결제 주소를 넣어주세요.";
  elements.coffeeModal.classList.remove("hidden");
}

function closeCoffeeModal() {
  elements.coffeeModal.classList.add("hidden");
}

async function copyCoffeeAccount() {
  const text = COFFEE_BANK_ACCOUNT;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const input = document.createElement("input");
      input.value = text;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    elements.coffeeHint.textContent = `계좌번호를 복사했습니다: ${text}`;
  } catch {
    elements.coffeeHint.textContent = `복사에 실패했습니다. 계좌번호: ${text}`;
  }
}

async function copyDeveloperEmail() {
  const text = DEVELOPER_EMAIL;
  elements.developerEmail.textContent = text;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const input = document.createElement("input");
      input.value = text;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    elements.developerEmailHint.textContent = `메일 주소를 복사했습니다: ${text}`;
  } catch {
    elements.developerEmailHint.textContent = `복사에 실패했습니다. 메일 주소: ${text}`;
  }
}

async function submitDeveloperMessage(event) {
  event.preventDefault();
  const message = elements.developerMessageInput.value.trim();

  if (!message) {
    elements.developerMessageHint.textContent = "내용을 입력해 주세요.";
    return;
  }

  if (message.length > 300) {
    elements.developerMessageHint.textContent = "300자 이하로 입력해 주세요.";
    return;
  }

  if (!firebaseDb) {
    elements.developerMessageHint.textContent = "전송 실패: 온라인 저장 연결을 확인해 주세요.";
    return;
  }

  elements.developerMessageButton.disabled = true;
  elements.developerMessageHint.textContent = "전송 중...";

  try {
    await addDoc(collection(firebaseDb, FIRESTORE_DEVELOPER_MESSAGES_COLLECTION), {
      message,
      level: state.level,
      best: state.best,
      gold: state.gold,
      monsterLevel: state.monsterLevel,
      userId: currentUser?.uid || "guest",
      email: currentUser?.email || "guest",
      page: window.location.origin,
      time: Date.now(),
      createdAt: serverTimestamp(),
    });
    elements.developerMessageInput.value = "";
    elements.developerMessageHint.textContent = "전송 완료. 개발자만 확인할 수 있습니다.";
  } catch {
    elements.developerMessageHint.textContent = "전송 실패: 잠시 후 다시 시도해 주세요.";
  } finally {
    elements.developerMessageButton.disabled = false;
  }
}

function openGambleModal() {
  elements.gambleModal.classList.remove("hidden");
  elements.gambleBetInput.value = MIN_GAMBLE_BET;
  updateGambleBetQuickSelection(MIN_GAMBLE_BET);
  elements.gambleHint.innerHTML = `${formatGoldHtml(MIN_GAMBLE_BET)} 배팅`;
  resetGambleStages();
  render();
}

function closeGambleModal() {
  if (gambleInProgress) return;
  elements.gambleModal.classList.add("hidden");
}

function resetGambleStages() {
  elements.oddEvenStage.classList.remove("rolling", "success", "fail");
  elements.oddEvenOrb.textContent = "?";
  elements.oddEvenResult.textContent = "홀 또는 짝을 선택하세요";
  elements.ladderStage.classList.remove("running", "success", "fail");
  elements.ladderMarker.className = "ladder-marker";
  clearLadderRungs();
  elements.ladderResult.textContent = "1, 2, 3줄 중 하나를 선택하세요";
}

function setGambleType(type) {
  if (gambleInProgress || !GAMBLE_TYPES.includes(type)) return;
  activeGambleType = type;
  resetGambleStages();
  render();
}

function getGambleBetAmount() {
  const parsed = Math.floor(Number(elements.gambleBetInput.value));
  return Number.isFinite(parsed) ? Math.max(MIN_GAMBLE_BET, parsed) : MIN_GAMBLE_BET;
}

function canStartGamble(betAmount) {
  return !gambleInProgress && betAmount >= MIN_GAMBLE_BET && state.gold >= betAmount;
}

function updateGambleBetQuickSelection(betAmount) {
  elements.gambleBetOptions.querySelectorAll("[data-bet-amount]").forEach((button) => {
    button.classList.toggle("selected", Number(button.dataset.betAmount) === betAmount);
  });
}

function addGambleBet(amount) {
  const addAmount = Number(amount);
  if (gambleInProgress || !GAMBLE_BET_AMOUNTS.includes(addAmount)) return;
  const nextAmount = Math.min(Number.MAX_SAFE_INTEGER, getGambleBetAmount() + addAmount);
  elements.gambleBetInput.value = nextAmount;
  updateGambleBetQuickSelection(nextAmount);
  elements.gambleHint.innerHTML = `${formatGoldHtml(addAmount)} 추가, 총 ${formatGoldHtml(nextAmount)} 배팅`;
  renderGamble();
}

function resetGambleBetAmount() {
  if (gambleInProgress) return;
  elements.gambleBetInput.value = MIN_GAMBLE_BET;
  updateGambleBetQuickSelection(MIN_GAMBLE_BET);
  elements.gambleHint.innerHTML = `${formatGoldHtml(MIN_GAMBLE_BET)} 배팅으로 초기화`;
  renderGamble();
}

function updateCustomGambleBet() {
  if (gambleInProgress) return;
  const betAmount = getGambleBetAmount();
  elements.gambleBetInput.value = betAmount;
  updateGambleBetQuickSelection(betAmount);
  elements.gambleHint.innerHTML = `${formatGoldHtml(betAmount)} 배팅 선택`;
  renderGamble();
}

function finishGamble({ gameName, choiceText, resultText, won, betAmount, multiplier }) {
  if (won) {
    const payout = betAmount * multiplier;
    state.gold = Math.min(Number.MAX_SAFE_INTEGER, state.gold + payout);
    playSound("gambleWin");
    elements.gambleHint.innerHTML = `${gameName} 성공! ${formatGoldHtml(payout)} 획득`;
    addLog(`${gameName} 성공: ${choiceText} 선택, ${resultText} 결과, ${formatGold(payout)} 획득`, "success");
  } else {
    playSound("gambleLose");
    elements.gambleHint.innerHTML = `${gameName} 실패. ${formatGoldHtml(betAmount)} 잃었습니다.`;
    addLog(`${gameName} 실패: ${choiceText} 선택, ${resultText} 결과, ${formatGold(betAmount)} 손실`, "fail");
  }
  gambleInProgress = false;
  saveGame();
  render();
}

function startOddEvenGamble(choice) {
  const betAmount = getGambleBetAmount();
  if (!canStartGamble(betAmount)) {
    elements.gambleHint.innerHTML = state.gold < betAmount
      ? `골드가 부족합니다. 필요 금액: ${formatGoldHtml(betAmount)}`
      : `최소 배팅금액은 ${formatGoldHtml(MIN_GAMBLE_BET)}입니다.`;
    return;
  }

  gambleInProgress = true;
  state.gold -= betAmount;
  const number = Math.floor(Math.random() * 100) + 1;
  const result = number % 2 === 0 ? "even" : "odd";
  const resultText = result === "even" ? "짝" : "홀";
  const choiceText = choice === "even" ? "짝" : "홀";
  const won = choice === result;

  elements.oddEvenStage.classList.remove("success", "fail");
  elements.oddEvenStage.classList.add("rolling");
  elements.oddEvenOrb.textContent = "?";
  elements.oddEvenResult.textContent = "결과 확인 중...";
  elements.gambleHint.innerHTML = `${formatGoldHtml(betAmount)} 배팅`;
  saveGame();
  render();

  window.setTimeout(() => {
    elements.oddEvenStage.classList.remove("rolling");
    elements.oddEvenStage.classList.add(won ? "success" : "fail");
    elements.oddEvenOrb.textContent = number;
    elements.oddEvenResult.textContent = `${number} = ${resultText}`;
    finishGamble({
      gameName: "홀짝",
      choiceText,
      resultText,
      won,
      betAmount,
      multiplier: 2,
    });
  }, 1050);
}

function clearLadderRungs() {
  document.querySelectorAll(".ladder-board .ladder-rung").forEach((rung) => rung.remove());
}

function createRandomLadderRungs() {
  const rungCount = 4 + Math.floor(Math.random() * 3);
  const rungs = [];
  let lastBridge = 0;

  for (let index = 0; index < rungCount; index += 1) {
    const y = 14 + index * (72 / Math.max(1, rungCount - 1)) + Math.random() * 5 - 2.5;
    const bridge = lastBridge === 1 ? 2 : lastBridge === 2 ? 1 : (Math.random() < 0.5 ? 1 : 2);
    rungs.push({
      y: Math.max(10, Math.min(88, y)),
      from: bridge,
      to: bridge + 1,
    });
    lastBridge = bridge;
  }

  return rungs.sort((a, b) => a.y - b.y);
}

function renderLadderRungs(rungs) {
  const board = elements.ladderMarker.parentElement;
  clearLadderRungs();
  rungs.forEach((rung) => {
    const element = document.createElement("div");
    element.className = "ladder-rung";
    element.style.left = rung.from === 1 ? "0" : "50%";
    element.style.top = `${rung.y}%`;
    board.insertBefore(element, elements.ladderMarker);
  });
}

function getLadderPath(choice, rungs) {
  let lane = Math.min(3, Math.max(1, Number(choice)));
  let y = 0;
  const path = [{ lane, y }];

  rungs.forEach((rung) => {
    path.push({ lane, y: rung.y });
    if (lane === rung.from) {
      lane = rung.to;
      path.push({ lane, y: rung.y });
    } else if (lane === rung.to) {
      lane = rung.from;
      path.push({ lane, y: rung.y });
    }
    y = rung.y;
  });

  path.push({ lane, y: 100 });
  return path;
}

function setLadderMarkerPosition(point) {
  elements.ladderMarker.style.left = `calc(${(point.lane - 1) * 50}% - 0.55rem)`;
  elements.ladderMarker.style.top = `calc(${point.y}% - 0.55rem)`;
}

function animateLadderPath(path, onDone) {
  path.forEach((point, index) => {
    window.setTimeout(() => setLadderMarkerPosition(point), index * 310);
  });
  window.setTimeout(onDone, path.length * 310 + 120);
}

function startLadderGamble(choice) {
  const betAmount = getGambleBetAmount();
  if (!canStartGamble(betAmount)) {
    elements.gambleHint.innerHTML = state.gold < betAmount
      ? `골드가 부족합니다. 필요 금액: ${formatGoldHtml(betAmount)}`
      : `최소 배팅금액은 ${formatGoldHtml(MIN_GAMBLE_BET)}입니다.`;
    return;
  }

  gambleInProgress = true;
  state.gold -= betAmount;
  const rungs = createRandomLadderRungs();
  const path = getLadderPath(choice, rungs);
  const result = path[path.length - 1].lane;
  const won = Number(choice) === result;

  elements.ladderStage.classList.remove("success", "fail");
  elements.ladderStage.classList.add("running");
  elements.ladderMarker.className = "ladder-marker show";
  renderLadderRungs(rungs);
  setLadderMarkerPosition(path[0]);
  elements.ladderResult.textContent = `${choice}줄 출발`;
  elements.gambleHint.innerHTML = `${formatGoldHtml(betAmount)} 배팅`;
  saveGame();
  render();

  animateLadderPath(path, () => {
    elements.ladderStage.classList.remove("running");
    elements.ladderStage.classList.add(won ? "success" : "fail");
    elements.ladderResult.textContent = `${result}줄 도착`;
    finishGamble({
      gameName: "사다리",
      choiceText: `${choice}줄`,
      resultText: `${result}줄`,
      won,
      betAmount,
      multiplier: 3,
    });
  });
}

function closeCompletionModal() {
  if (rankingAutoRegisterTimer) {
    window.clearTimeout(rankingAutoRegisterTimer);
    rankingAutoRegisterTimer = null;
  }
  stopCompletionCelebration();
  elements.completionModal.classList.add("hidden");
}

function playCompletionCelebration() {
  playSound("fireworks");
  window.setTimeout(() => playSound("applause"), 240);
}

function startCompletionCelebration() {
  stopCompletionCelebration();
  playCompletionCelebration();
  completionCelebrationTimer = window.setInterval(playCompletionCelebration, 2300);
}

function stopCompletionCelebration() {
  if (completionCelebrationTimer) {
    window.clearInterval(completionCelebrationTimer);
    completionCelebrationTimer = null;
  }
  stopFireworksClips();
}

function showFireworks() {
  const colors = ["#f6c85f", "#77a7ff", "#70e08b", "#ff6b6b", "#ffffff"];
  elements.fireworksLayer.innerHTML = "";
  elements.fireworksLayer.classList.remove("hidden");

  for (let burst = 0; burst < 7; burst += 1) {
    const x = 15 + Math.random() * 70;
    const y = 14 + Math.random() * 44;
    for (let spark = 0; spark < 18; spark += 1) {
      const particle = document.createElement("span");
      const angle = (Math.PI * 2 * spark) / 18;
      const distance = 2.4 + Math.random() * 3.6;
      particle.style.left = `${x}vw`;
      particle.style.top = `${y}vh`;
      particle.style.background = colors[(burst + spark) % colors.length];
      particle.style.color = colors[(burst + spark) % colors.length];
      particle.style.setProperty("--spark-x", `${Math.cos(angle) * distance}rem`);
      particle.style.setProperty("--spark-y", `${Math.sin(angle) * distance}rem`);
      particle.style.animationDelay = `${burst * 140}ms`;
      elements.fireworksLayer.append(particle);
    }
  }

  window.setTimeout(() => {
    elements.fireworksLayer.classList.add("hidden");
    elements.fireworksLayer.innerHTML = "";
  }, 2200);
}

function showCompletionModal(soundWaited = false) {
  if (state.soundEnabled && !fireworksAudioBuffer && !soundWaited) {
    loadFireworksAudioBuffer()?.then(() => showCompletionModal(true));
    return;
  }

  stopAutoEnhance();
  if (rankingAutoRegisterTimer) {
    window.clearTimeout(rankingAutoRegisterTimer);
    rankingAutoRegisterTimer = null;
  }
  rankingRegistering = false;
  elements.rankingNameInput.value = "";
  elements.rankingNameInput.disabled = false;
  elements.rankingRegisterButton.disabled = false;
  elements.rankingNameHint.textContent = "랭킹 닉네임은 한글, 영어, 숫자로 최대 10글자까지 가능합니다.";
  elements.completionModal.classList.remove("hidden");
  window.requestAnimationFrame(() => {
    startCompletionCelebration();
    showFireworks();
  });
  window.setTimeout(() => elements.rankingNameInput.focus(), 50);
}

function finishRankingRegistration(name, savedOnline) {
  closeCompletionModal();
  resetGame();
  const savedText = savedOnline ? "온라인 랭킹에 저장했습니다." : "이 기기의 랭킹에 저장했습니다.";
  setMessage(`${name} ${savedText} 게임을 새로 시작합니다.`, "success");
  addLog(`+30 랭킹 저장 완료: ${name}`, "success");
  openRankingModal();
}

async function registerRanking() {
  if (rankingRegistering) return;
  if (rankingAutoRegisterTimer) {
    window.clearTimeout(rankingAutoRegisterTimer);
    rankingAutoRegisterTimer = null;
  }

  const name = sanitizeRankingName(elements.rankingNameInput.value);
  elements.rankingNameInput.value = name;

  if (!name) {
    elements.rankingNameHint.textContent = "한글, 영어, 숫자로 닉네임을 입력하세요.";
    return;
  }

  const entry = {
    name,
    level: MAX_LEVEL,
    gold: state.gold,
    clearTimeMs: Date.now() - state.runStartedAt,
    spentGold: state.spentGold,
    enhanceAttempts: state.enhanceAttempts,
    time: Date.now(),
  };

  rankingRegistering = true;
  elements.rankingNameInput.disabled = true;
  elements.rankingRegisterButton.disabled = true;
  elements.rankingNameHint.textContent = "랭킹 저장 중...";

  try {
    if (!firebaseDb) throw new Error("Firestore is not ready.");
    await withTimeout(
      addDoc(collection(firebaseDb, FIRESTORE_RANKINGS_COLLECTION), {
        ...entry,
        createdAt: serverTimestamp(),
      }),
      RANKING_SAVE_TIMEOUT_MS,
      "Ranking save timed out.",
    );
    const rankings = loadRankings();
    rankings.push(entry);
    saveRankings(rankings);
    finishRankingRegistration(name, true);
  } catch {
    const rankings = loadRankings();
    rankings.push(entry);
    saveRankings(rankings);
    finishRankingRegistration(name, false);
  } finally {
    rankingRegistering = false;
    elements.rankingNameInput.disabled = false;
    elements.rankingRegisterButton.disabled = false;
  }
}

function scheduleRankingRegistration() {
  if (rankingRegistering) return;
  if (rankingAutoRegisterTimer) window.clearTimeout(rankingAutoRegisterTimer);

  const name = sanitizeRankingName(elements.rankingNameInput.value);
  if (!name) {
    rankingAutoRegisterTimer = null;
    elements.rankingNameHint.textContent = "한글, 영어, 숫자로 닉네임을 입력하세요.";
    return;
  }

  elements.rankingNameHint.textContent = "잠시 후 자동 저장됩니다.";
  rankingAutoRegisterTimer = window.setTimeout(registerRanking, 1500);
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

function renderShop() {
  const rows = SHOP_ITEMS.map(({ itemKey, price }) => {
    const item = ITEMS[itemKey];
    const ownedCount = state.inventory[itemKey] ?? 0;
    const sellPrice = Math.floor(price * 0.5);
    const buyButtons = [1, 10, 100].map((quantity) => {
      const totalPrice = price * quantity;
      const disabled = state.gold < totalPrice ? " disabled" : "";
      return `
        <button class="shop-buy" type="button" data-shop-item="${itemKey}" data-shop-quantity="${quantity}"${disabled}>
          <span>구매 ${quantity}개</span>
          <strong>${formatGoldHtml(totalPrice)}</strong>
        </button>
      `;
    }).join("");
    const sellButtons = [1, 10, 100].map((quantity) => {
      const disabled = ownedCount < quantity ? " disabled" : "";
      return `
        <button class="shop-sell" type="button" data-sell-item="${itemKey}" data-sell-quantity="${quantity}"${disabled}>
          <span>판매 ${quantity}개</span>
          <strong>${formatGoldHtml(sellPrice * quantity)}</strong>
        </button>
      `;
    }).join("");

    return `
      <div class="shop-item">
        <span class="item-object ${itemKey}" aria-hidden="true"></span>
        <div class="shop-item-title">
          <strong>${item.name}</strong>
        </div>
        <div class="shop-item-meta">
          <span>보유 ${ownedCount.toLocaleString("ko-KR")}개</span>
          <span class="shop-price">구매 ${formatGoldHtml(price)}</span>
          <span class="shop-sell-price">판매 ${formatGoldHtml(sellPrice)}</span>
        </div>
        <div class="shop-trade-row">
          <span>구매</span>
          <div class="shop-buy-row">${buyButtons}</div>
          <span>판매</span>
          <div class="shop-sell-row">${sellButtons}</div>
        </div>
      </div>
    `;
  }).join("");

  elements.shopItems.innerHTML = `
    <div class="shop-wallet">가지고 있는 돈 ${formatGoldHtml(state.gold)}</div>
    ${rows}
  `;
}

function renderAutoItemStatus() {
  const rows = ITEM_ORDER.map((itemKey) => {
    const selectedCount = getSelectedItemCount(itemKey);
    const ownedCount = state.inventory[itemKey] ?? 0;
    const activeClass = selectedCount > 0 ? " selected" : "";
    const disabled = ownedCount <= 0 ? " disabled" : "";
    return `
      <button class="auto-item-row${activeClass}" type="button" data-auto-item="${itemKey}"${disabled}>
        <span class="item-object ${itemKey}" aria-hidden="true"></span>
        <span class="auto-item-text">
          <span class="auto-item-name">${ITEMS[itemKey].name}</span>
          <strong>사용 ${selectedCount.toLocaleString("ko-KR")} / 보유 ${ownedCount.toLocaleString("ko-KR")}</strong>
        </span>
      </button>
    `;
  }).join("");

  elements.autoItemStatus.innerHTML = `
    <div class="auto-item-title">아이템 사용 설정</div>
    ${rows}
  `;
}

function renderGamble() {
  const betAmount = getGambleBetAmount();
  const canBet = canStartGamble(betAmount);

  elements.gambleWallet.innerHTML = `보유 ${formatGoldHtml(state.gold)}`;
  elements.gambleBetUnit.textContent = formatBetUnit(betAmount);
  updateGambleBetQuickSelection(betAmount);
  elements.oddEvenGame.classList.toggle("hidden", activeGambleType !== "oddEven");
  elements.ladderGame.classList.toggle("hidden", activeGambleType !== "ladder");
  elements.gambleTabs.querySelectorAll("[data-gamble-tab]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.gambleTab === activeGambleType);
    button.disabled = gambleInProgress;
  });
  elements.gambleModal.querySelectorAll("[data-odd-even-choice], [data-ladder-choice]").forEach((button) => {
    button.disabled = !canBet;
  });
  elements.gambleBetOptions.querySelectorAll("[data-bet-amount]").forEach((button) => {
    button.disabled = gambleInProgress;
  });
  elements.gambleBetResetButton.disabled = gambleInProgress;
  elements.gambleBetInput.disabled = gambleInProgress;
  elements.gambleCloseButton.disabled = gambleInProgress;
}

function render() {
  ensureMonsterHp();
  applyTheme();

  const cost = getCost(state.level);
  const selectedChanceBonus = state.level >= 29 ? 0 : getSelectedChanceBonus();
  const chance = Math.min(100, getChance(state.level) + selectedChanceBonus);
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
  elements.gold.innerHTML = formatGoldHtml(state.gold);
  elements.cost.innerHTML = isMax ? "완료" : formatGoldHtml(cost);
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
  elements.enhanceSettings.classList.toggle("hidden", !enhanceSettingsOpen);
  elements.autoEnhanceButton.textContent = enhanceSettingsOpen ? "설정 닫기" : "자동 강화";
  elements.autoEnhanceStartButton.textContent = autoEnhanceTimer ? "자동 중지" : "자동 시작";
  renderAutoItemStatus();
  elements.shopToggleButton.textContent = "🏠 상점";
  elements.soundToggleButton.textContent = state.soundEnabled ? "사운드 ON" : "사운드 OFF";
  elements.bgmToggleButton.textContent = state.bgmEnabled ? "BGM ON" : "BGM OFF";
  elements.themeToggleButton.textContent = state.theme === "light" ? "다크 모드" : "화이트 모드";
  elements.upgradeView.classList.toggle("auto", Boolean(autoEnhanceTimer));
  elements.upgradeView.classList.toggle("max", isMax);

  elements.monsterName.textContent = monsterNames[state.monsterLevel - 1];
  elements.monsterStage.textContent = `${state.monsterLevel} / ${MAX_MONSTER_LEVEL} 단계`;
  elements.monster.style.backgroundImage = `url("${getMonsterImagePath(state.monsterLevel)}")`;
  elements.monsterHpText.textContent = `HP ${state.monsterHp.toLocaleString("ko-KR")} / ${monsterMaxHp.toLocaleString("ko-KR")}`;
  elements.monsterReward.innerHTML = `보상 ${formatGoldHtml(getMonsterReward(state.monsterLevel))}`;
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
  renderShop();
  renderGamble();
  renderAuth();
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
  playMonsterDeathSound(defeatedLevel);
  window.setTimeout(() => playSound("gold"), 180);
  playCoinDrop(earned);

  if (defeatedLevel < MAX_MONSTER_LEVEL) {
    state.unlockedMonsterLevel = Math.max(state.unlockedMonsterLevel, defeatedLevel + 1);
  }

  state.monsterHp = getMonsterMaxHp(state.monsterLevel);
  restartBattleTimer();
  if (drops.length) {
    stopAutoEnhance();
    playSound("item");
    playItemDrop(drops[0]);
    setMessage("아이템이 드랍되어 자동 강화를 중지했습니다.");
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
  value.innerHTML = `+${formatGoldHtml(amount)}`;
  elements.coinLayer.append(value);

  for (let i = 0; i < 7; i += 1) {
    const coin = document.createElement("div");
    coin.className = "coin";
    coin.textContent = "🪙";
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
  autoEnhanceItemPlan = null;
  render();
}

function toggleEnhanceSettings() {
  if (enhanceSettingsOpen && autoEnhanceTimer) {
    stopAutoEnhance();
    setMessage("자동 강화를 중지했습니다.");
  }
  enhanceSettingsOpen = !enhanceSettingsOpen;
  render();
}

function openShopModal() {
  renderShop();
  elements.shopModal.classList.remove("hidden");
}

function closeShopModal() {
  elements.shopModal.classList.add("hidden");
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

  if (!hasEnoughItemsForPlan(autoEnhanceItemPlan)) {
    stopAutoEnhance();
    setMessage("처음 선택한 아이템 중 부족한 아이템이 있어 자동 강화를 중지했습니다.");
    return;
  }

  enhance(autoEnhanceItemPlan);
}

function toggleAutoEnhance() {
  if (autoEnhanceTimer) {
    stopAutoEnhance();
    setMessage("자동 강화를 중지했습니다.");
    return;
  }

  enhanceSettingsOpen = true;
  const targetLevel = state.enhanceTarget;

  if (state.level >= targetLevel) {
    setMessage(`이미 목표 +${targetLevel} 이상입니다.`);
    return;
  }

  autoEnhanceItemPlan = getSelectedItemPlan();
  if (!hasEnoughItemsForPlan(autoEnhanceItemPlan)) {
    autoEnhanceItemPlan = null;
    setMessage("처음 선택한 아이템 중 부족한 아이템이 있어 자동 강화를 시작할 수 없습니다.");
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
    if (state.level >= 29 && (itemKey === "boost5" || itemKey === "boost10")) {
      const warningText = "+29에서 +30 강화에는 확률 증가권을 사용할 수 없습니다.";
      setMessage(warningText, "fail");
      showItemDepletedBanner(warningText);
      return;
    }
    if (itemKey === "boost5") state.selectedItems.boost10 = 0;
    if (itemKey === "boost10") state.selectedItems.boost5 = 0;
    const currentCount = getSelectedItemCount(itemKey);
    const limit = getItemSelectionLimit(itemKey);
    state.selectedItems[itemKey] = currentCount >= limit ? 0 : currentCount + 1;
  }
  saveGame();
  render();
}

function buyShopItem(itemKey, quantity = 1) {
  const shopItem = SHOP_ITEMS.find((item) => item.itemKey === itemKey);
  const amount = Math.max(1, Math.floor(quantity));
  const totalPrice = shopItem ? shopItem.price * amount : 0;
  if (!shopItem || state.gold < totalPrice) return;

  state.gold -= totalPrice;
  state.spentGold += totalPrice;
  state.inventory[itemKey] += amount;
  playSound("item");
  setMessage(`${ITEMS[itemKey].name} ${amount}개를 구매했습니다.`, "success");
  addLog(`상점 구매: ${ITEMS[itemKey].name} ${amount}개 (${formatGold(totalPrice)})`, "success");
  saveGame();
  render();
}

function sellShopItem(itemKey, quantity = 1) {
  const shopItem = SHOP_ITEMS.find((item) => item.itemKey === itemKey);
  const amount = Math.max(1, Math.floor(quantity));
  const ownedCount = state.inventory[itemKey] ?? 0;
  if (!shopItem || ownedCount < amount) return;

  const sellPrice = Math.floor(shopItem.price * 0.5) * amount;
  state.inventory[itemKey] -= amount;
  state.selectedItems = normalizeSelectedItems(state.selectedItems);
  state.gold = Math.min(Number.MAX_SAFE_INTEGER, state.gold + sellPrice);
  playSound("gold");
  setMessage(`${ITEMS[itemKey].name} ${amount}개를 판매했습니다.`, "success");
  addLog(`상점 판매: ${ITEMS[itemKey].name} ${amount}개 (${formatGold(sellPrice)})`, "success");
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

function enhance(itemPlan = null) {
  const cost = getCost(state.level);
  if (state.level >= MAX_LEVEL || state.gold < cost) return;

  const plannedItems = itemPlan && ITEM_ORDER.some((itemKey) => Number.isFinite(itemPlan[itemKey]))
    ? itemPlan
    : null;
  const selectedItems = plannedItems ? normalizeSelectedItems(plannedItems) : normalizeSelectedItems(state.selectedItems);
  if (state.level >= 29) {
    selectedItems.boost5 = 0;
    selectedItems.boost10 = 0;
  }
  if (!plannedItems) state.selectedItems = selectedItems;
  const selectedItemNames = ITEM_ORDER.flatMap((itemKey) => {
    const count = selectedItems[itemKey] ?? 0;
    if (count <= 0) return [];
    const suffix = count > 1 ? ` ${count}개` : "";
    return `${ITEMS[itemKey].name}${suffix}`;
  });
  const chanceBonus = ITEM_ORDER.reduce((bonus, itemKey) => {
    return bonus + (selectedItems[itemKey] ?? 0) * ITEMS[itemKey].chanceBonus;
  }, 0);
  const protectActive = selectedItems.protect > 0;
  const fallProtectActive = selectedItems.fallProtect > 0;

  ITEM_ORDER.forEach((itemKey) => {
    const selectedCount = selectedItems[itemKey] ?? 0;
    if (selectedCount <= 0) return;
    state.inventory[itemKey] = Math.max(0, state.inventory[itemKey] - selectedCount);
  });
  const depletedSelectedItems = ITEM_ORDER.some((itemKey) => {
    return (selectedItems[itemKey] ?? 0) > 0 && state.inventory[itemKey] <= 0;
  });

  state.gold -= cost;
  state.spentGold += cost;
  state.enhanceAttempts += 1;
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
    if (state.level >= MAX_LEVEL && !state.maxCompletionShown) {
      state.maxCompletionShown = true;
      window.setTimeout(showCompletionModal, 120);
    }
  } else {
    if (selectedItemNames.length && !protectActive && !fallProtectActive) {
      addLog(`${selectedItemNames.join(", ")} 사용`, "fail");
    }
    handleFailure(protectActive, fallProtectActive);
  }

  saveGame();
  render();
  if (depletedSelectedItems) showItemDepletedBanner();
}

function showDestroyedBanner() {
  elements.destroyedBanner.classList.remove("show");
  void elements.destroyedBanner.offsetWidth;
  elements.destroyedBanner.classList.add("show");
  window.setTimeout(() => elements.destroyedBanner.classList.remove("show"), 1200);
}

function showItemDepletedBanner(text = "아이템을 모두 소진하셨습니다") {
  elements.itemDepletedBanner.textContent = text;
  elements.itemDepletedBanner.classList.remove("show");
  void elements.itemDepletedBanner.offsetWidth;
  elements.itemDepletedBanner.classList.add("show");
  window.setTimeout(() => elements.itemDepletedBanner.classList.remove("show"), 2200);
}

function resetGame() {
  stopCompletionCelebration();
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
  state.maxCompletionShown = false;
  state.runStartedAt = Date.now();
  state.spentGold = 0;
  state.enhanceAttempts = 0;
  enhanceSettingsOpen = false;
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
elements.shopToggleButton.addEventListener("click", openShopModal);
elements.autoEnhanceButton.addEventListener("click", toggleEnhanceSettings);
elements.autoEnhanceStartButton.addEventListener("click", toggleAutoEnhance);
elements.autoItemStatus.addEventListener("click", (event) => {
  const button = event.target.closest("[data-auto-item]");
  if (!button) return;
  selectInventoryItem(button.dataset.autoItem);
});
elements.enhanceTargetPrevButton.addEventListener("click", () => changeEnhanceTarget(-1));
elements.enhanceTargetNextButton.addEventListener("click", () => changeEnhanceTarget(1));
elements.mobileSettingsButtons.forEach((button) => {
  button.addEventListener("click", toggleMobileSettings);
});
elements.soundToggleButton.addEventListener("click", () => {
  toggleSound();
  closeMobileSettings();
});
elements.bgmToggleButton.addEventListener("click", () => {
  toggleBgm();
  closeMobileSettings();
});
elements.rankingToggleButton.addEventListener("click", () => {
  openRankingModal();
  closeMobileSettings();
});
if (elements.authToggleButton) elements.authToggleButton.addEventListener("click", openAuthModal);
elements.authCloseButton.addEventListener("click", closeAuthModal);
elements.authGoogleButton.addEventListener("click", loginWithGoogle);
elements.authLogoutButton.addEventListener("click", logoutAuth);
elements.themeToggleButton.addEventListener("click", () => {
  toggleTheme();
  closeMobileSettings();
});
elements.workButton.addEventListener("click", showBattle);
elements.topWorkButton.addEventListener("click", showBattle);
elements.topGambleButton.addEventListener("click", openGambleModal);
elements.resetButton.addEventListener("click", resetGame);
elements.backButton.addEventListener("click", showUpgrade);
elements.stayButton.addEventListener("click", showUpgrade);
elements.gambleToggleButton.addEventListener("click", openGambleModal);
elements.gambleCloseButton.addEventListener("click", closeGambleModal);
elements.gambleBetOptions.addEventListener("click", (event) => {
  const button = event.target.closest("[data-bet-amount]");
  if (!button) return;
  addGambleBet(button.dataset.betAmount);
});
elements.gambleBetResetButton.addEventListener("click", resetGambleBetAmount);
elements.gambleBetInput.addEventListener("input", () => {
  const betAmount = getGambleBetAmount();
  updateGambleBetQuickSelection(betAmount);
  renderGamble();
});
elements.gambleBetInput.addEventListener("change", updateCustomGambleBet);
elements.attackButton.addEventListener("pointerdown", prepareSwordAttackSound);
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
elements.shopItems.addEventListener("click", (event) => {
  const buyButton = event.target.closest("[data-shop-item]");
  if (buyButton) {
    buyShopItem(buyButton.dataset.shopItem, Number(buyButton.dataset.shopQuantity));
    return;
  }

  const sellButton = event.target.closest("[data-sell-item]");
  if (sellButton) {
    sellShopItem(sellButton.dataset.sellItem, Number(sellButton.dataset.sellQuantity));
  }
});
elements.rankingNameInput.addEventListener("input", () => {
  elements.rankingNameInput.value = sanitizeRankingName(elements.rankingNameInput.value);
  scheduleRankingRegistration();
});
elements.rankingNameInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  registerRanking();
});
elements.rankingRegisterButton.addEventListener("click", registerRanking);
elements.completionDoneButton.addEventListener("click", closeCompletionModal);
elements.rankingCloseButton.addEventListener("click", closeRankingModal);
elements.shopCloseButton.addEventListener("click", closeShopModal);
elements.coffeeCloseButton.addEventListener("click", closeCoffeeModal);
elements.coffeeCopyButton.addEventListener("click", copyCoffeeAccount);
elements.developerMessageForm.addEventListener("submit", submitDeveloperMessage);
elements.developerEmailCopyButton.addEventListener("click", copyDeveloperEmail);
document.querySelectorAll("[data-coffee-button]").forEach((button) => {
  button.addEventListener("click", openCoffeeModal);
});
elements.rankingTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-ranking-sort]");
  if (!button || !RANKING_SORTS.includes(button.dataset.rankingSort)) return;
  activeRankingSort = button.dataset.rankingSort;
  renderRankingList();
});
elements.rankingModal.addEventListener("click", (event) => {
  if (event.target === elements.rankingModal) closeRankingModal();
});
elements.shopModal.addEventListener("click", (event) => {
  if (event.target === elements.shopModal) closeShopModal();
});
elements.authModal.addEventListener("click", (event) => {
  if (event.target === elements.authModal) closeAuthModal();
});
elements.coffeeModal.addEventListener("click", (event) => {
  if (event.target === elements.coffeeModal) closeCoffeeModal();
});
elements.gambleTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-gamble-tab]");
  if (!button) return;
  setGambleType(button.dataset.gambleTab);
});
elements.gambleModal.addEventListener("click", (event) => {
  if (event.target === elements.gambleModal) closeGambleModal();

  const oddEvenButton = event.target.closest("[data-odd-even-choice]");
  if (oddEvenButton) {
    startOddEvenGamble(oddEvenButton.dataset.oddEvenChoice);
    return;
  }

  const ladderButton = event.target.closest("[data-ladder-choice]");
  if (ladderButton) {
    startLadderGamble(ladderButton.dataset.ladderChoice);
  }
});

if (firebaseAuth) {
  getRedirectResult(firebaseAuth)
    .then((result) => {
      if (result?.user && elements.authHint) {
        elements.authHint.textContent = "Google 로그인 완료. 저장 데이터를 확인 중입니다.";
      }
    })
    .catch((error) => {
      if (elements.authHint) elements.authHint.textContent = getAuthErrorMessage(error);
    });

  onAuthStateChanged(firebaseAuth, (user) => {
    currentUser = user;
    renderAuth();
    if (user) {
      elements.authModal.classList.add("hidden");
      elements.authHint.textContent = "온라인 저장 데이터를 확인 중...";
      loadCloudGame(user);
    } else {
      showStartupAuthPrompt();
    }
  });
}

loadGame();
ensureMonsterHp();
render();
prepareCelebrationSounds();

if (!firebaseAuth) {
  showStartupAuthPrompt();
}

if (new URLSearchParams(window.location.search).has("preview30")) {
  window.setTimeout(showCompletionModal, 250);
}
