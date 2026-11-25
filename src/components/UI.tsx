import React, { useEffect, useRef, useState } from 'react';
import {
  Coins,
  Crown,
  Pause,
  Play,
  RotateCcw,
  Settings,
  ShoppingBag,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
  Home,
  ChevronRight,
  Lock,
  Check,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { HudSnapshot, WorldPopup } from '../game/game';
import type { MultiplayerRoom } from '../game/multiplayerProtocol';
import {
  getLevelConfig,
  getUpgradeCost,
  LEVELS,
  SaveData,
  SKINS,
  UPGRADES,
  UpgradeKey,
} from '../game/shop';
import { soundEngine } from '../game/audio';

export interface GameEndResult {
  victory: boolean;
  level: number;
  score: number;
  targetScore: number;
  coinsEarned: number;
  grassPulled: number;
  maxCombo: number;
  isNewHighScore: boolean;
}

interface VirtualJoystickProps {
  onMove: (x: number, y: number) => void;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({ onMove }) => {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const maxRadius = 42;

  const updateFromClient = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }
    setKnob({ x: dx, y: dy });
    onMove(dx / maxRadius, dy / maxRadius);
  };

  const resetStick = () => {
    pointerIdRef.current = null;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div
      ref={baseRef}
      role="application"
      aria-label="Joystick gerak karakter"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        pointerIdRef.current = e.pointerId;
        updateFromClient(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (pointerIdRef.current !== e.pointerId) return;
        updateFromClient(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (pointerIdRef.current !== e.pointerId) return;
        resetStick();
      }}
      onPointerCancel={resetStick}
      className="relative flex h-32 w-32 touch-none items-center justify-center rounded-full border-4 border-white/80 bg-emerald-950/45 shadow-lg sm:h-36 sm:w-36"
    >
      <div className="pointer-events-none absolute inset-3 rounded-full border-2 border-dashed border-white/25" />
      <div
        style={{
          transform: `translate3d(${knob.x}px, ${knob.y}px, 0)`,
        }}
        className="pointer-events-none flex h-14 w-14 items-center justify-center rounded-full border-3 border-amber-100 bg-gradient-to-b from-amber-300 to-amber-500 shadow-md"
      >
        <div className="h-5 w-5 rounded-full bg-white/40" />
      </div>
    </div>
  );
};

interface MainMenuProps {
  save: SaveData;
  selectedLevel: number;
  onSelectLevel: (lvl: number) => void;
  onPlay: () => void;
  onOpenMultiplayer: () => void;
  onOpenShop: () => void;
  onOpenSettings: () => void;
}

export const MainMenuOverlay: React.FC<MainMenuProps> = ({
  save,
  selectedLevel,
  onSelectLevel,
  onPlay,
  onOpenMultiplayer,
  onOpenShop,
  onOpenSettings,
}) => {
  const currentLvl = getLevelConfig(selectedLevel);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar Info */}
      <div className="flex items-start justify-between gap-4">
        <div className="pointer-events-auto flex items-center gap-4 rounded-2xl border-3 border-amber-200 bg-amber-950/80 px-4 py-2 text-white shadow-lg">
          <div className="flex items-center gap-1.5">
            <Coins className="h-5 w-5 text-amber-400" />
            <span className="font-mono-num text-lg font-extrabold text-amber-300">{save.coins}</span>
          </div>
          <span className="text-white/30" aria-hidden="true">|</span>
          <div className="flex items-center gap-1.5">
            <Trophy className="h-5 w-5 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-200">TERBAIK</span>
            <span className="font-mono-num text-lg font-extrabold text-white">{save.highScore}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playUiClick();
            onOpenSettings();
          }}
          aria-label="Buka Pengaturan"
          className="btn-3d btn-3d-blue pointer-events-auto flex h-12 w-12 items-center justify-center rounded-2xl text-white"
        >
          <Settings className="h-6 w-6" />
        </button>
      </div>

      {/* Center-Left / Center Hero Title + Actions */}
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
        <div className="animate-logo-wiggle mb-2 select-none">
          <h1 className="font-display text-stroke-title text-6xl font-bold tracking-tight text-amber-300 sm:text-8xl">
            CABOL
          </h1>
          <p className="font-display text-stroke-dark -mt-2 text-xl font-bold tracking-widest text-white sm:text-2xl">
            CABUT BOOL
          </p>
        </div>

        <p className="mb-5 max-w-md rounded-xl bg-emerald-950/70 px-4 py-1.5 text-sm font-bold text-emerald-100 shadow-sm sm:text-base">
          Jongkok, goyangkan pinggul, dan cabut rumput sebanyak mungkin sebelum waktu habis!
        </p>

        {/* Level Selector Strip */}
        <div className="pointer-events-auto mb-5 w-full max-w-lg rounded-2xl border-3 border-white/75 bg-emerald-950/80 p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between px-1 text-xs font-extrabold text-emerald-200">
            <span>PILIH LEVEL ({selectedLevel}/5)</span>
            <span className="text-amber-300">Target: {currentLvl.targetScore} pts</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {LEVELS.map((lvl) => {
              const unlocked = lvl.level <= save.highestUnlockedLevel;
              const active = lvl.level === selectedLevel;
              return (
                <button
                  key={lvl.level}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => {
                    soundEngine.playUiClick();
                    onSelectLevel(lvl.level);
                  }}
                  className={`flex flex-col items-center justify-center rounded-xl border-2 py-2 font-display transition-transform ${
                    active
                      ? 'scale-105 border-amber-200 bg-amber-500 text-amber-950 shadow-md'
                      : unlocked
                        ? 'border-emerald-400/50 bg-emerald-800/80 text-white hover:bg-emerald-700'
                        : 'cursor-not-allowed border-slate-700 bg-slate-800/70 text-slate-400 opacity-70'
                  }`}
                >
                  {unlocked ? (
                    <>
                      <span className="text-base font-bold leading-none">
                        {lvl.hasBoss ? 'BOSS' : `Lv.${lvl.level}`}
                      </span>
                    </>
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-2 text-xs font-bold text-white/90">
            {currentLvl.name} — <span className="text-emerald-200">{currentLvl.subtitle}</span>
          </div>
        </div>

        {/* Primary CTA Buttons */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onPlay();
            }}
            className="btn-3d btn-3d-green flex items-center gap-2.5 rounded-2xl px-9 py-4 font-display text-2xl font-bold text-white"
          >
            <Play className="h-7 w-7 fill-current" />
            <span>PLAY</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenMultiplayer();
            }}
            className="btn-3d btn-3d-blue flex items-center gap-2 rounded-2xl px-6 py-4 font-display text-xl font-bold text-white"
          >
            <Users className="h-6 w-6" />
            <span>MULTIPLAYER</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenShop();
            }}
            className="btn-3d btn-3d-amber flex items-center gap-2 rounded-2xl px-6 py-4 font-display text-xl font-bold text-amber-950"
          >
            <ShoppingBag className="h-6 w-6" />
            <span>SHOP</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onOpenSettings();
            }}
            className="btn-3d btn-3d-blue flex items-center gap-2 rounded-2xl px-5 py-4 font-display text-xl font-bold text-white"
          >
            <Settings className="h-6 w-6" />
            <span>SETTINGS</span>
          </button>
        </div>
      </div>

      {/* Bottom Subtle Controls Guide */}
      <div className="mx-auto flex flex-wrap items-center justify-center gap-3 rounded-xl bg-emerald-950/75 px-4 py-2 text-xs font-bold text-emerald-100">
        <span>Desktop: WASD / Panah · Spasi (Cabut) · ESC (Pause)</span>
        <span aria-hidden="true">·</span>
        <span>Mobile: Joystick Kiri + Tombol CABUT Kanan</span>
      </div>
    </div>
  );
};

interface GameplayHudProps {
  hud: HudSnapshot;
  popups: WorldPopup[];
  onJoystickMove: (x: number, y: number) => void;
  onPull: () => void;
  onPause: () => void;
  onFinishEarly: () => void;
  multiplayerOpponent?: { name: string; score: number };
  hidePause?: boolean;
}

export const GameplayHud: React.FC<GameplayHudProps> = ({
  hud,
  popups,
  onJoystickMove,
  onPull,
  onPause,
  onFinishEarly,
  multiplayerOpponent,
  hidePause = false,
}) => {
  const progressPct = Math.min(100, Math.round((hud.score / hud.targetScore) * 100));
  const bossOk = !hud.hasBoss || hud.bossDefeated;
  const targetMet = hud.score >= hud.targetScore && bossOk;
  const urgentTime = hud.timeLeft <= 15;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      {/* Floating World Popups */}
      {popups.map((p) => (
        <div
          key={p.id}
          style={{ left: p.screenX, top: p.screenY, color: p.color }}
          className="animate-float-pop pointer-events-none absolute z-20 text-center drop-shadow-[0_3px_0_rgba(0,0,0,0.75)]"
        >
          <div className="font-display text-2xl font-bold sm:text-3xl">{p.text}</div>
          {p.subtext && <div className="font-display text-sm font-bold text-white">{p.subtext}</div>}
        </div>
      ))}

      {/* Targeted Multi-Hit Grass Floating HP Indicator */}
      {hud.targetGrass && hud.targetGrass.maxHp > 1 && (
        <div
          style={{
            left: hud.targetGrass.screenX,
            top: hud.targetGrass.screenY,
            transform: 'translate(-50%, -100%)',
          }}
          className="pointer-events-none absolute z-10 flex flex-col items-center rounded-xl border-2 border-white/80 bg-emerald-950/85 px-2.5 py-1 shadow-md"
        >
          <span className="text-[11px] font-extrabold text-amber-300">{hud.targetGrass.label}</span>
          <div className="mt-0.5 h-2 w-20 overflow-hidden rounded-full bg-slate-800">
            <div
              style={{ width: `${Math.max(0, (hud.targetGrass.hp / hud.targetGrass.maxHp) * 100)}%` }}
              className="h-full bg-gradient-to-r from-lime-400 to-emerald-500 transition-all duration-150"
            />
          </div>
        </div>
      )}

      {/* TOP HUD ROW */}
      <div className="flex items-start justify-between p-3 sm:p-5">
        {/* Top-Left: Level & Boss Indicator */}
        <div className="flex flex-col gap-2">
          <div className="rounded-2xl border-3 border-white/75 bg-emerald-950/80 px-3.5 py-2 text-white shadow-lg">
            <div className="text-[11px] font-extrabold tracking-wider text-emerald-300">
              LEVEL {hud.level}
            </div>
            <div className="font-display text-sm font-bold sm:text-base">{hud.levelName}</div>
          </div>

          {hud.hasBoss && !hud.bossDefeated && (
            <div className="rounded-2xl border-3 border-fuchsia-300 bg-fuchsia-950/90 px-3.5 py-2 text-white shadow-lg">
              <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-fuchsia-200">
                <span>BOSS GRASS</span>
                <span className="font-mono-num">
                  {Math.ceil(hud.bossHp)}/{hud.bossMaxHp}
                </span>
              </div>
              <div className="mt-1 h-2.5 w-36 overflow-hidden rounded-full bg-fuchsia-950 sm:w-44">
                <div
                  style={{ width: `${Math.max(0, (hud.bossHp / hud.bossMaxHp) * 100)}%` }}
                  className="h-full bg-gradient-to-r from-fuchsia-400 to-amber-300 transition-all duration-150"
                />
              </div>
            </div>
          )}
        </div>

        {/* Top-Center: 120s Timer */}
        <div className="flex flex-col items-center gap-1.5">
          <div
            className={`flex flex-col items-center rounded-2xl border-4 px-5 py-2 shadow-xl transition-colors ${
              urgentTime
                ? 'border-rose-200 bg-rose-600 text-white'
                : 'border-amber-200 bg-emerald-950/85 text-white'
            }`}
          >
            <span className="text-[10px] font-extrabold tracking-widest text-amber-300">WAKTU</span>
            <span className="font-mono-num text-2xl font-extrabold leading-none sm:text-4xl">
              {hud.timeLeft}s
            </span>
          </div>
          {multiplayerOpponent && (
            <div className="rounded-xl border-2 border-sky-200/80 bg-sky-950/90 px-3 py-1 text-center text-white shadow-lg">
              <div className="max-w-32 truncate text-[10px] font-extrabold text-sky-200">
                LAWAN · {multiplayerOpponent.name}
              </div>
              <div className="font-mono-num text-base font-extrabold text-sky-100">
                {multiplayerOpponent.score} PTS
              </div>
            </div>
          )}
        </div>

        {/* Top-Right: Score + Coins + Pause + Combo below Score */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end rounded-2xl border-3 border-amber-200 bg-emerald-950/85 px-4 py-1.5 text-white shadow-lg">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold text-emerald-300">SKOR</span>
                <span className="font-mono-num text-xl font-extrabold text-amber-300 sm:text-2xl">
                  {hud.score}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-amber-200">
                <Coins className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-mono-num">+{hud.coinsEarned}</span>
              </div>
            </div>

            {!hidePause && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onPause();
                }}
                aria-label="Pause Game"
                className="btn-3d btn-3d-slate pointer-events-auto flex h-12 w-12 items-center justify-center rounded-2xl text-slate-900"
              >
                <Pause className="h-6 w-6 fill-current" />
              </button>
            )}
          </div>

          {/* Combo Badge Directly Below Score */}
          {hud.combo >= 2 && (
            <div className="rounded-xl border-2 border-amber-200 bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1 text-right text-white shadow-md">
              <div className="font-display text-sm font-bold leading-tight sm:text-base">
                COMBO x{hud.combo}!
              </div>
              <div className="mt-0.5 h-1.5 w-24 overflow-hidden rounded-full bg-black/30">
                <div
                  style={{ width: `${hud.comboTimerRatio * 100}%` }}
                  className="h-full bg-white transition-all duration-75"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM CONTROLS & LEVEL PROGRESS */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 sm:p-5">
        {/* Bottom-Left: Virtual Joystick */}
        <div className="pointer-events-auto">
          <VirtualJoystick onMove={onJoystickMove} />
        </div>

        {/* Bottom-Center: Level Progress Bar */}
        <div className="pointer-events-auto mb-1 flex w-full max-w-md flex-col items-center gap-1.5">
          {targetMet && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onFinishEarly();
              }}
              className="btn-3d btn-3d-green flex items-center gap-1.5 rounded-xl px-4 py-1.5 font-display text-sm font-bold text-white shadow-lg"
            >
              <Trophy className="h-4 w-4" />
              <span>Target Tercapai! Klaim Menang</span>
            </button>
          )}

          <div className="w-full rounded-2xl border-3 border-white/80 bg-emerald-950/85 px-3.5 py-2 text-white shadow-xl">
            <div className="mb-1 flex items-center justify-between text-xs font-extrabold">
              <span className="text-emerald-200">Progress Level {hud.level}</span>
              <span className="font-mono-num text-amber-300">
                {hud.score} / {hud.targetScore}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-emerald-900">
              <div
                style={{ width: `${progressPct}%` }}
                className={`h-full transition-all duration-200 ${
                  targetMet
                    ? 'bg-gradient-to-r from-amber-300 via-yellow-400 to-lime-400'
                    : 'bg-gradient-to-r from-lime-400 to-emerald-400'
                }`}
              />
            </div>
          </div>
          <div className="hidden text-[11px] font-bold text-emerald-950/80 sm:block">
            WASD / Panah untuk jalan · Spasi untuk CABUT · ESC untuk Pause
          </div>
        </div>

        {/* Bottom-Right: Big CABUT Action Button */}
        <div className="pointer-events-auto">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onPull();
            }}
            className="btn-3d btn-3d-orange flex h-28 w-28 touch-none flex-col items-center justify-center rounded-full text-white sm:h-32 sm:w-32"
          >
            <Zap className="h-8 w-8 fill-amber-200 text-amber-100 sm:h-9 sm:w-9" />
            <span className="font-display text-xl font-bold tracking-wide sm:text-2xl">CABUT!</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface ShopModalProps {
  save: SaveData;
  onBuyUpgrade: (key: UpgradeKey) => void;
  onBuyOrEquipSkin: (skinId: string) => void;
  onClose: () => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  save,
  onBuyUpgrade,
  onBuyOrEquipSkin,
  onClose,
}) => {
  const [tab, setTab] = useState<'upgrades' | 'skins'>('upgrades');

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/65 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border-4 border-amber-200 bg-emerald-950 text-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-white/15 bg-emerald-900 px-6 py-4">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-7 w-7 text-amber-300" />
            <h2 className="font-display text-2xl font-bold text-white">TOKO CABOL</h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-xl border-2 border-amber-300/60 bg-amber-950/80 px-3 py-1.5">
              <Coins className="h-5 w-5 text-amber-400" />
              <span className="font-mono-num text-lg font-extrabold text-amber-300">{save.coins}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onClose();
              }}
              className="btn-3d btn-3d-slate rounded-xl px-4 py-1.5 font-display text-sm font-bold text-slate-900"
            >
              Tutup
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-emerald-900/60 px-6 py-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              setTab('upgrades');
            }}
            className={`rounded-xl px-5 py-2 font-display text-base font-bold transition-colors ${
              tab === 'upgrades'
                ? 'bg-amber-400 text-amber-950 shadow-md'
                : 'bg-emerald-800/70 text-emerald-100 hover:bg-emerald-800'
            }`}
          >
            Upgrade Bool
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              setTab('skins');
            }}
            className={`rounded-xl px-5 py-2 font-display text-base font-bold transition-colors ${
              tab === 'skins'
                ? 'bg-amber-400 text-amber-950 shadow-md'
                : 'bg-emerald-800/70 text-emerald-100 hover:bg-emerald-800'
            }`}
          >
            Kostum & Skin
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'upgrades' ? (
            <div className="flex flex-col gap-4">
              {UPGRADES.map((u) => {
                const lvl = save.upgrades[u.key];
                const isMax = lvl >= u.maxLevel;
                const cost = getUpgradeCost(u, lvl);
                const canAfford = save.coins >= cost;

                return (
                  <div
                    key={u.key}
                    className="flex flex-col justify-between gap-4 rounded-2xl border-2 border-white/15 bg-emerald-900/70 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          style={{ backgroundColor: u.accentColor }}
                          className="inline-block h-3 w-3 rounded-full"
                        />
                        <h3 className="font-display text-xl font-bold text-white">{u.name}</h3>
                        <span className="text-xs font-extrabold text-amber-300">· {u.subtitle}</span>
                      </div>
                      <p className="mt-1 text-sm text-emerald-100/90">{u.description}</p>
                      <div className="mt-2.5 flex items-center gap-1.5">
                        {Array.from({ length: u.maxLevel }).map((_, i) => (
                          <div
                            key={i}
                            className={`h-2.5 w-8 rounded-full ${
                              i < lvl ? 'bg-amber-400' : 'bg-emerald-950'
                            }`}
                          />
                        ))}
                        <span className="font-mono-num ml-2 text-xs font-bold text-emerald-200">
                          Lv.{lvl}/{u.maxLevel}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isMax || !canAfford}
                      onClick={() => onBuyUpgrade(u.key)}
                      className={`btn-3d shrink-0 rounded-2xl px-5 py-3 font-display text-base font-bold ${
                        isMax
                          ? 'cursor-default border-2 border-emerald-400/40 bg-emerald-800 text-emerald-200'
                          : canAfford
                            ? 'btn-3d-amber text-amber-950'
                            : 'cursor-not-allowed border-2 border-slate-600 bg-slate-700 text-slate-300 opacity-75'
                      }`}
                    >
                      {isMax ? 'MAKSIMAL' : `Upgrade · ${cost} Koin`}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {SKINS.map((skin) => {
                const owned = save.ownedSkins.includes(skin.id);
                const equipped = save.equippedSkin === skin.id;
                const canAfford = save.coins >= skin.cost;

                return (
                  <div
                    key={skin.id}
                    className={`flex flex-col justify-between rounded-2xl border-2 p-4 ${
                      equipped
                        ? 'border-amber-300 bg-emerald-800/90'
                        : 'border-white/15 bg-emerald-900/70'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            style={{ backgroundColor: skin.previewHex }}
                            className="h-7 w-7 rounded-xl border-2 border-white shadow-sm"
                          />
                          <h3 className="font-display text-lg font-bold text-white">{skin.name}</h3>
                        </div>
                        {equipped && (
                          <span className="flex items-center gap-1 text-xs font-extrabold text-amber-300">
                            <Check className="h-4 w-4" /> DIPAKAI
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-emerald-100/90">{skin.description}</p>
                    </div>

                    <button
                      type="button"
                      disabled={(!owned && !canAfford) || equipped}
                      onClick={() => onBuyOrEquipSkin(skin.id)}
                      className={`btn-3d mt-4 w-full rounded-xl py-2.5 font-display text-sm font-bold ${
                        equipped
                          ? 'cursor-default border-2 border-amber-300/40 bg-emerald-950 text-amber-300'
                          : owned
                            ? 'btn-3d-green text-white'
                            : canAfford
                              ? 'btn-3d-amber text-amber-950'
                              : 'cursor-not-allowed border-2 border-slate-600 bg-slate-700 text-slate-300 opacity-75'
                      }`}
                    >
                      {equipped
                        ? 'Sedang Dipakai'
                        : owned
                          ? 'Pakai Kostum'
                          : `Beli · ${skin.cost} Koin`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface SettingsModalProps {
  save: SaveData;
  onToggleSetting: (key: 'sfxEnabled' | 'musicEnabled' | 'cameraShake') => void;
  onResetProgress: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  save,
  onToggleSetting,
  onResetProgress,
  onClose,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/65 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border-4 border-sky-200 bg-emerald-950 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b-2 border-white/15 bg-emerald-900 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Settings className="h-6 w-6 text-sky-300" />
            <h2 className="font-display text-2xl font-bold">PENGATURAN</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="btn-3d btn-3d-slate rounded-xl px-4 py-1.5 font-display text-sm font-bold text-slate-900"
          >
            Tutup
          </button>
        </div>

        <div className="flex flex-col gap-3 p-6">
          {[
            {
              key: 'sfxEnabled' as const,
              label: 'Efek Suara Lucu (SFX)',
              icon: save.settings.sfxEnabled ? Volume2 : VolumeX,
              active: save.settings.sfxEnabled,
            },
            {
              key: 'musicEnabled' as const,
              label: 'Musik Kebun Ceria',
              icon: Sparkles,
              active: save.settings.musicEnabled,
            },
            {
              key: 'cameraShake' as const,
              label: 'Getaran Kamera Saat Cabut',
              icon: Zap,
              active: save.settings.cameraShake,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  onToggleSetting(item.key);
                }}
                className="flex items-center justify-between rounded-2xl border-2 border-white/15 bg-emerald-900/70 px-4 py-3 text-left transition-colors hover:bg-emerald-900"
              >
                <span className="flex items-center gap-3 font-bold">
                  <Icon className="h-5 w-5 text-amber-300" />
                  {item.label}
                </span>
                <span
                  className={`rounded-lg px-3 py-1 font-display text-xs font-bold ${
                    item.active ? 'bg-lime-400 text-emerald-950' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {item.active ? 'AKTIF' : 'MATI'}
                </span>
              </button>
            );
          })}

          <div className="mt-2 border-t-2 border-white/10 pt-4">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playUiClick();
                  setConfirmReset(true);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-rose-400/50 bg-rose-950/60 py-2.5 text-sm font-bold text-rose-200 hover:bg-rose-900/70"
              >
                <ShieldAlert className="h-4 w-4" />
                Reset Semua Progres & Koin
              </button>
            ) : (
              <div className="flex flex-col gap-2 rounded-2xl border-2 border-rose-400 bg-rose-950 p-3 text-center">
                <p className="text-xs font-bold text-rose-100">
                  Yakin hapus high score, koin, dan semua upgrade?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onResetProgress();
                      setConfirmReset(false);
                    }}
                    className="btn-3d btn-3d-red flex-1 rounded-xl py-2 font-display text-sm font-bold text-white"
                  >
                    Ya, Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="btn-3d btn-3d-slate flex-1 rounded-xl py-2 font-display text-sm font-bold text-slate-900"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface DailyRewardModalProps {
  coins: number;
  onClose: () => void;
}

export const DailyRewardModal: React.FC<DailyRewardModalProps> = ({ coins, onClose }) => (
  <div
    className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="daily-reward-title"
  >
    <div className="w-full max-w-sm rounded-3xl border-4 border-amber-200 bg-emerald-950 p-6 text-center text-white shadow-2xl">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-400 text-emerald-950">
        <Coins className="h-9 w-9" />
      </div>
      <h2 id="daily-reward-title" className="mt-4 font-display text-3xl font-bold text-amber-300">
        BONUS HARIAN!
      </h2>
      <p className="mt-2 text-sm font-bold text-emerald-100">
        Terima kasih sudah mampir. Ini koin untukmu hari ini!
      </p>
      <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border-2 border-amber-300/40 bg-amber-950/60 py-3 font-display text-2xl font-extrabold text-amber-300">
        <Coins className="h-6 w-6" />
        +{coins} KOIN
      </div>
      <button
        type="button"
        onClick={() => {
          soundEngine.playUiClick();
          onClose();
        }}
        className="btn-3d btn-3d-green mt-5 w-full rounded-2xl py-3 font-display text-lg font-bold text-white"
      >
        LANJUTKAN
      </button>
    </div>
  </div>
);

interface PauseModalProps {
  level: number;
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  level,
  onResume,
  onRestart,
  onMainMenu,
}) => (
  <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/65 p-4">
    <div className="w-full max-w-sm rounded-3xl border-4 border-amber-200 bg-emerald-950 p-6 text-center text-white shadow-2xl">
      <h2 className="font-display text-3xl font-bold text-amber-300">JEDA PERMAINAN</h2>
      <p className="mt-1 text-sm font-bold text-emerald-200">Level {level} · Tarik napas dulu!</p>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            soundEngine.playUiClick();
            onResume();
          }}
          className="btn-3d btn-3d-green flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-display text-xl font-bold text-white"
        >
          <Play className="h-5 w-5 fill-current" />
          LANJUTKAN
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playUiClick();
            onRestart();
          }}
          className="btn-3d btn-3d-amber flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-display text-xl font-bold text-amber-950"
        >
          <RotateCcw className="h-5 w-5" />
          ULANG LEVEL
        </button>

        <button
          type="button"
          onClick={() => {
            soundEngine.playUiClick();
            onMainMenu();
          }}
          className="btn-3d btn-3d-slate flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-display text-lg font-bold text-slate-900"
        >
          <Home className="h-5 w-5" />
          MENU UTAMA
        </button>
      </div>
    </div>
  </div>
);

interface ResultModalProps {
  result: GameEndResult;
  onNextLevel: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  onOpenShop: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({
  result,
  onNextLevel,
  onRestart,
  onMainMenu,
  onOpenShop,
}) => {
  const hasNextLevel = result.victory && result.level < 5;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/65 p-4">
      <div
        className={`w-full max-w-md rounded-3xl border-4 p-6 text-center text-white shadow-2xl ${
          result.victory
            ? 'border-amber-200 bg-gradient-to-b from-emerald-800 to-emerald-950'
            : 'border-rose-300 bg-gradient-to-b from-rose-900 to-slate-950'
        }`}
      >
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15">
          {result.victory ? (
            <Crown className="h-10 w-10 text-amber-300" />
          ) : (
            <RotateCcw className="h-10 w-10 text-rose-300" />
          )}
        </div>

        <h2 className="font-display text-4xl font-bold text-amber-300">
          {result.victory ? 'MENANG BESAR!' : 'WAKTU HABIS!'}
        </h2>
        <p className="mt-1 text-sm font-bold text-white/85">
          {result.victory
            ? result.level === 5
              ? 'Boss Grass tumbang! Kamu penguasa kebun CABOL!'
              : `Level ${result.level} berhasil ditaklukkan!`
            : `Target ${result.targetScore} poin belum tercapai. Coba lagi!`}
        </p>

        {result.isNewHighScore && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-1 font-display text-sm font-bold text-amber-950">
            <Trophy className="h-4 w-4" />
            REKOR SKOR BARU!
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border-2 border-white/15 bg-black/25 p-4 text-left">
          <div>
            <div className="text-xs font-bold text-emerald-200">SKOR AKHIR</div>
            <div className="font-mono-num text-2xl font-extrabold text-amber-300">{result.score}</div>
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-200">KOIN DIDAPAT</div>
            <div className="font-mono-num text-2xl font-extrabold text-amber-400">+{result.coinsEarned}</div>
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-200">RUMPUT TERCABUT</div>
            <div className="font-mono-num text-xl font-extrabold text-white">{result.grassPulled}</div>
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-200">MAX COMBO</div>
            <div className="font-mono-num text-xl font-extrabold text-orange-300">x{result.maxCombo}</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {hasNextLevel && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onNextLevel();
              }}
              className="btn-3d btn-3d-green flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-display text-xl font-bold text-white"
            >
              <span>LEVEL BERIKUTNYA</span>
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onRestart();
              }}
              className="btn-3d btn-3d-amber flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 font-display text-lg font-bold text-amber-950"
            >
              <RotateCcw className="h-5 w-5" />
              MAIN LAGI
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onOpenShop();
              }}
              className="btn-3d btn-3d-blue flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 font-display text-lg font-bold text-white"
            >
              <ShoppingBag className="h-5 w-5" />
              SHOP
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onMainMenu();
            }}
            className="btn-3d btn-3d-slate flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 font-display text-base font-bold text-slate-900"
          >
            <Home className="h-4 w-4" />
            MENU UTAMA
          </button>
        </div>
      </div>
    </div>
  );
};

interface MultiplayerModalProps {
  connected: boolean;
  room: MultiplayerRoom | null;
  playerId: string | null;
  level: number;
  error: string | null;
  onCreate: (name: string) => void;
  onJoin: (name: string, code: string) => void;
  onStart: () => void;
  onClose: () => void;
}

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  connected,
  room,
  playerId,
  level,
  error,
  onCreate,
  onJoin,
  onStart,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const isHost = room?.players[0]?.id === playerId;
  const canStart = Boolean(room && room.status === 'waiting' && room.players.length === 2 && isHost);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="multiplayer-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border-4 border-sky-200 bg-emerald-950 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b-2 border-white/15 bg-emerald-900 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Users className="h-6 w-6 text-sky-300" />
            <h2 id="multiplayer-title" className="font-display text-2xl font-bold">MAIN ONLINE</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-3d btn-3d-slate rounded-xl px-4 py-1.5 font-display text-sm font-bold text-slate-900"
          >
            Keluar
          </button>
        </div>

        <div className="flex flex-col gap-4 p-6">
          <div className={`rounded-xl border-2 px-3 py-2 text-sm font-bold ${
            connected
              ? 'border-lime-300/50 bg-lime-950/60 text-lime-200'
              : 'border-rose-300/50 bg-rose-950/60 text-rose-200'
          }`}>
            {connected
              ? 'Terhubung — buat room atau masukkan kode teman.'
              : 'Menghubungkan ke server pertandingan...'}
          </div>

          {!room ? (
            <>
              <label className="flex flex-col gap-1.5 text-sm font-bold text-emerald-100">
                Nama pemain
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={16}
                  placeholder="Nama kamu"
                  className="rounded-xl border-2 border-emerald-600 bg-emerald-900 px-3 py-2.5 text-white outline-none focus:border-amber-300"
                />
              </label>

              <button
                type="button"
                disabled={!connected || !name.trim()}
                onClick={() => onCreate(name)}
                className="btn-3d btn-3d-green flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Users className="h-5 w-5" />
                BUAT ROOM
              </button>

              <div className="flex items-center gap-3 text-xs font-bold text-emerald-300">
                <span className="h-px flex-1 bg-white/15" />
                ATAU GABUNG
                <span className="h-px flex-1 bg-white/15" />
              </div>

              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 6))}
                  maxLength={6}
                  placeholder="KODE ROOM"
                  aria-label="Kode room"
                  className="min-w-0 flex-1 rounded-xl border-2 border-emerald-600 bg-emerald-900 px-3 py-2.5 font-mono-num font-bold tracking-widest text-white outline-none focus:border-amber-300"
                />
                <button
                  type="button"
                  disabled={!connected || !name.trim() || code.trim().length !== 6}
                  onClick={() => onJoin(name, code)}
                  className="btn-3d btn-3d-blue rounded-xl px-4 py-2 font-display font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  GABUNG
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl border-2 border-sky-300/60 bg-sky-950/60 p-4 text-center">
                <div className="text-xs font-extrabold tracking-widest text-sky-200">KODE ROOM</div>
                <div className="mt-1 font-mono-num text-4xl font-extrabold tracking-[0.2em] text-white">
                  {room.code}
                </div>
                <p className="mt-2 text-xs font-bold text-sky-100">
                  Bagikan kode ini ke temanmu untuk bergabung.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {room.players.map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-xl border-2 border-white/10 bg-emerald-900/70 px-4 py-3"
                  >
                    <span className="font-bold text-white">
                      {index === 0 ? 'HOST · ' : 'PEMAIN · '}{player.name}
                    </span>
                    <span className="text-xs font-extrabold text-lime-300">
                      {player.id === playerId ? 'KAMU' : 'SIAP'}
                    </span>
                  </div>
                ))}
                {room.players.length < 2 && (
                  <div className="rounded-xl border-2 border-dashed border-white/20 px-4 py-3 text-center text-sm font-bold text-emerald-300">
                    Menunggu pemain kedua...
                  </div>
                )}
              </div>

              <p className="text-center text-xs font-bold text-emerald-200">
                Pertandingan kompetitif · Level {room.level ?? level} · Skor lawan tampil langsung
              </p>

              {room.status === 'playing' ? (
                <div className="rounded-xl bg-amber-950/70 px-4 py-3 text-center text-sm font-bold text-amber-200">
                  Pertandingan sedang berlangsung.
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!canStart}
                  onClick={onStart}
                  className="btn-3d btn-3d-green w-full rounded-xl py-3 font-display text-lg font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isHost ? 'MULAI PERTANDINGAN' : 'MENUNGGU HOST MEMULAI'}
                </button>
              )}
            </>
          )}

          {error && (
            <p role="alert" className="rounded-xl border-2 border-rose-300/50 bg-rose-950/60 px-3 py-2 text-sm font-bold text-rose-200">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

interface MatchWaitingOverlayProps {
  room: MultiplayerRoom;
  playerId: string | null;
  onLeave: () => void;
}

export const MatchWaitingOverlay: React.FC<MatchWaitingOverlayProps> = ({
  room,
  playerId,
  onLeave,
}) => {
  const localPlayer = room.players.find((player) => player.id === playerId);
  const opponent = room.players.find((player) => player.id !== playerId);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/65 p-4">
      <div className="w-full max-w-sm rounded-3xl border-4 border-sky-200 bg-emerald-950 p-6 text-center text-white shadow-2xl">
        <Users className="mx-auto h-12 w-12 text-sky-300" />
        <h2 className="mt-3 font-display text-3xl font-bold text-sky-200">RONDE SELESAI</h2>
        <p className="mt-2 text-sm font-bold text-emerald-100">
          Skormu <span className="font-mono-num text-amber-300">{localPlayer?.score ?? 0}</span>.
          {' '}{opponent ? `Menunggu ${opponent.name} menyelesaikan ronde...` : 'Menunggu pemain lain bergabung...'}
        </p>
        <button
          type="button"
          onClick={onLeave}
          className="btn-3d btn-3d-slate mt-5 w-full rounded-xl py-3 font-display font-bold text-slate-900"
        >
          KEMBALI KE MENU
        </button>
      </div>
    </div>
  );
};

interface MatchResultModalProps {
  room: MultiplayerRoom;
  playerId: string | null;
  onMainMenu: () => void;
}

export const MatchResultModal: React.FC<MatchResultModalProps> = ({
  room,
  playerId,
  onMainMenu,
}) => {
  const localPlayer = room.players.find((player) => player.id === playerId);
  const opponent = room.players.find((player) => player.id !== playerId);
  const title = room.winnerId === null
    ? 'SERI!'
    : room.winnerId === playerId
      ? 'KAMU MENANG!'
      : 'KAMU KALAH';

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-sm rounded-3xl border-4 border-amber-200 bg-gradient-to-b from-emerald-800 to-emerald-950 p-6 text-center text-white shadow-2xl">
        <Trophy className="mx-auto h-14 w-14 text-amber-300" />
        <h2 className="mt-3 font-display text-4xl font-bold text-amber-300">{title}</h2>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {[localPlayer, opponent].map((player, index) => (
            <div key={player?.id ?? index} className="rounded-2xl border-2 border-white/15 bg-black/25 p-3">
              <div className="truncate text-xs font-extrabold text-emerald-200">
                {player?.id === playerId ? 'KAMU' : player?.name ?? 'Pemain'}
              </div>
              <div className="font-mono-num text-3xl font-extrabold text-white">{player?.score ?? 0}</div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onMainMenu}
          className="btn-3d btn-3d-slate mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display font-bold text-slate-900"
        >
          <Home className="h-5 w-5" />
          KEMBALI KE MENU
        </button>
      </div>
    </div>
  );
};
