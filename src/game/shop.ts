export type UpgradeKey = 'boolSuper' | 'boolTurbo' | 'boolRaja';

export interface UpgradeConfig {
  key: UpgradeKey;
  name: string;
  subtitle: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  accentColor: string;
}

export interface SkinConfig {
  id: string;
  name: string;
  description: string;
  cost: number;
  shirtColor: number;
  pantsColor: number;
  beltColor: number;
  shoeColor: number;
  skinTone: number;
  hatType: 'straw' | 'headband' | 'helmet' | 'crown' | 'frog';
  hatColor: number;
  previewHex: string;
}

export interface LevelConfig {
  level: number;
  name: string;
  subtitle: string;
  targetScore: number;
  durationSec: number;
  maxGrassCount: number;
  weights: {
    easy: number;
    medium: number;
    big: number;
    tough: number;
  };
  hasBoss: boolean;
}

export interface GameSettings {
  sfxEnabled: boolean;
  musicEnabled: boolean;
  cameraShake: boolean;
}

export interface SaveData {
  coins: number;
  highScore: number;
  highestUnlockedLevel: number;
  lastDailyRewardDate: string | null;
  upgrades: Record<UpgradeKey, number>;
  ownedSkins: string[];
  equippedSkin: string;
  settings: GameSettings;
}

const STORAGE_KEY = 'cabol_cabut_bool_save_v1';
export const DAILY_LOGIN_REWARD_COINS = 100;

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear().toString().padStart(4, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const UPGRADES: UpgradeConfig[] = [
  {
    key: 'boolSuper',
    name: 'Bool Super',
    subtitle: 'Kekuatan Cabut',
    description: 'Meningkatkan daya tarik jongkok agar rumput besar & Boss cepat tercabut.',
    maxLevel: 5,
    baseCost: 80,
    costMultiplier: 1.65,
    accentColor: '#f97316',
  },
  {
    key: 'boolTurbo',
    name: 'Bool Turbo',
    subtitle: 'Kecepatan Gerak',
    description: 'Mempercepat lari dan kelincahan pinggul saat mengejar rumput di kebun.',
    maxLevel: 5,
    baseCost: 70,
    costMultiplier: 1.6,
    accentColor: '#0ea5e9',
  },
  {
    key: 'boolRaja',
    name: 'Bool Raja',
    subtitle: 'Bonus Skor & Koin',
    description: 'Menambah bonus poin +20% dan ekstra koin setiap rumput berhasil dicabut.',
    maxLevel: 5,
    baseCost: 100,
    costMultiplier: 1.75,
    accentColor: '#eab308',
  },
];

export const SKINS: SkinConfig[] = [
  {
    id: 'classic',
    name: 'Petani Ceria',
    description: 'Celana denim tebal tahan gesek dan topi jerami andalan kebun.',
    cost: 0,
    shirtColor: 0xfacc15,
    pantsColor: 0x2563eb,
    beltColor: 0x78350f,
    shoeColor: 0x92400e,
    skinTone: 0xffcfa3,
    hatType: 'straw',
    hatColor: 0xfde047,
    previewHex: '#2563eb',
  },
  {
    id: 'ninja',
    name: 'Ninja Kebun',
    description: 'Celana kargo hitam tebal dengan jurus jongkok secepat kilat.',
    cost: 180,
    shirtColor: 0xdc2626,
    pantsColor: 0x1e293b,
    beltColor: 0xf59e0b,
    shoeColor: 0x0f172a,
    skinTone: 0xffd2a8,
    hatType: 'headband',
    hatColor: 0xef4444,
    previewHex: '#dc2626',
  },
  {
    id: 'katak',
    name: 'Kodok Lincah',
    description: 'Setelan celana lumut tebal dengan tudung katak paling menggemaskan.',
    cost: 300,
    shirtColor: 0x22c55e,
    pantsColor: 0x15803d,
    beltColor: 0xfef08a,
    shoeColor: 0xf97316,
    skinTone: 0xffcfa3,
    hatType: 'frog',
    hatColor: 0x4ade80,
    previewHex: '#16a34a',
  },
  {
    id: 'astronot',
    name: 'Kapten Angkasa',
    description: 'Celana antariksa super tebal anti-akar berduri dengan helm kaca.',
    cost: 480,
    shirtColor: 0xf8fafc,
    pantsColor: 0xe2e8f0,
    beltColor: 0x0284c7,
    shoeColor: 0x334155,
    skinTone: 0xffcfa3,
    hatType: 'helmet',
    hatColor: 0x38bdf8,
    previewHex: '#0284c7',
  },
  {
    id: 'sultan',
    name: 'Sultan Bool',
    description: 'Celana beludru ungu mewah lengkap dengan mahkota emas berkilau.',
    cost: 750,
    shirtColor: 0x7c3aed,
    pantsColor: 0x4c1d95,
    beltColor: 0xfbbf24,
    shoeColor: 0xf59e0b,
    skinTone: 0xffcfa3,
    hatType: 'crown',
    hatColor: 0xfacc15,
    previewHex: '#7c3aed',
  },
];

export const LEVELS: LevelConfig[] = [
  {
    level: 1,
    name: 'Kebun Pemula',
    subtitle: 'Rumput muda empuk dan mudah dicabut!',
    targetScore: 400,
    durationSec: 120,
    maxGrassCount: 16,
    weights: { easy: 0.85, medium: 0.15, big: 0, tough: 0 },
    hasBoss: false,
  },
  {
    level: 2,
    name: 'Padang Liar',
    subtitle: 'Rumput mulai bandel dan berakar kuat.',
    targetScore: 850,
    durationSec: 120,
    maxGrassCount: 18,
    weights: { easy: 0.45, medium: 0.45, big: 0.1, tough: 0 },
    hasBoss: false,
  },
  {
    level: 3,
    name: 'Ladang Raksasa',
    subtitle: 'Rumput besar bermunculan, siap-siap jongkok ekstra!',
    targetScore: 1450,
    durationSec: 120,
    maxGrassCount: 18,
    weights: { easy: 0.2, medium: 0.4, big: 0.35, tough: 0.05 },
    hasBoss: false,
  },
  {
    level: 4,
    name: 'Kebun Akar Besi',
    subtitle: 'Tingkat kesulitan acak dengan rumput akar besi keras.',
    targetScore: 2200,
    durationSec: 120,
    maxGrassCount: 20,
    weights: { easy: 0.15, medium: 0.25, big: 0.35, tough: 0.25 },
    hasBoss: false,
  },
  {
    level: 5,
    name: 'Sarang Boss Grass',
    subtitle: 'Cabut Boss Grass raksasa dan raih skor tertinggi!',
    targetScore: 3000,
    durationSec: 120,
    maxGrassCount: 18,
    weights: { easy: 0.15, medium: 0.25, big: 0.35, tough: 0.25 },
    hasBoss: true,
  },
];

export function getDefaultSave(): SaveData {
  return {
    coins: 120,
    highScore: 0,
    highestUnlockedLevel: 1,
    lastDailyRewardDate: null,
    upgrades: {
      boolSuper: 0,
      boolTurbo: 0,
      boolRaja: 0,
    },
    ownedSkins: ['classic'],
    equippedSkin: 'classic',
    settings: {
      sfxEnabled: true,
      musicEnabled: true,
      cameraShake: true,
    },
  };
}

export function loadSaveData(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const def = getDefaultSave();
    return {
      coins: typeof parsed.coins === 'number' ? Math.max(0, parsed.coins) : def.coins,
      highScore: typeof parsed.highScore === 'number' ? Math.max(0, parsed.highScore) : def.highScore,
      highestUnlockedLevel:
        typeof parsed.highestUnlockedLevel === 'number'
          ? Math.min(5, Math.max(1, parsed.highestUnlockedLevel))
          : def.highestUnlockedLevel,
      lastDailyRewardDate:
        typeof parsed.lastDailyRewardDate === 'string' ? parsed.lastDailyRewardDate : def.lastDailyRewardDate,
      upgrades: {
        boolSuper: parsed.upgrades?.boolSuper ?? 0,
        boolTurbo: parsed.upgrades?.boolTurbo ?? 0,
        boolRaja: parsed.upgrades?.boolRaja ?? 0,
      },
      ownedSkins: Array.isArray(parsed.ownedSkins) && parsed.ownedSkins.length > 0 ? parsed.ownedSkins : def.ownedSkins,
      equippedSkin: typeof parsed.equippedSkin === 'string' ? parsed.equippedSkin : def.equippedSkin,
      settings: {
        sfxEnabled: parsed.settings?.sfxEnabled ?? true,
        musicEnabled: parsed.settings?.musicEnabled ?? true,
        cameraShake: parsed.settings?.cameraShake ?? true,
      },
    };
  } catch {
    return getDefaultSave();
  }
}

export function persistSaveData(data: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function getUpgradeCost(cfg: UpgradeConfig, currentLevel: number): number {
  return Math.round(cfg.baseCost * Math.pow(cfg.costMultiplier, currentLevel));
}

export function getPlayerStats(save: SaveData) {
  return {
    pullPower: 1 + save.upgrades.boolSuper * 0.75,
    moveSpeed: 7.2 + save.upgrades.boolTurbo * 1.15,
    scoreMultiplier: 1 + save.upgrades.boolRaja * 0.2,
    coinBonusFlat: save.upgrades.boolRaja * 2,
  };
}

export function getSkinById(id: string): SkinConfig {
  return SKINS.find((s) => s.id === id) || SKINS[0];
}

export function getLevelConfig(level: number): LevelConfig {
  return LEVELS.find((l) => l.level === level) || LEVELS[0];
}
