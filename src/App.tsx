import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { CabolGame, HudSnapshot, WorldPopup } from './game/game';
import type {
  ClientToServerEvents,
  MultiplayerRoom,
  ServerToClientEvents,
} from './game/multiplayerProtocol';
import { soundEngine } from './game/audio';
import {
  getDefaultSave,
  getLocalDateKey,
  getUpgradeCost,
  loadSaveData,
  persistSaveData,
  SaveData,
  SKINS,
  UPGRADES,
  UpgradeKey,
  DAILY_LOGIN_REWARD_COINS,
} from './game/shop';
import {
  GameEndResult,
  GameplayHud,
  MainMenuOverlay,
  PauseModal,
  ResultModal,
  DailyRewardModal,
  SettingsModal,
  ShopModal,
  MatchResultModal,
  MatchWaitingOverlay,
  MultiplayerModal,
} from './components/UI';

const INITIAL_HUD: HudSnapshot = {
  mode: 'menu',
  level: 1,
  levelName: 'Kebun Pemula',
  score: 0,
  targetScore: 400,
  timeLeft: 120,
  combo: 0,
  maxCombo: 0,
  comboTimerRatio: 0,
  coinsEarned: 0,
  grassPulled: 0,
  hasBoss: false,
  bossDefeated: false,
  bossHp: 0,
  bossMaxHp: 10,
  targetGrass: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<CabolGame | null>(null);

  const [save, setSave] = useState<SaveData>(() => loadSaveData());
  const [selectedLevel, setSelectedLevel] = useState<number>(() => loadSaveData().highestUnlockedLevel);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [popups, setPopups] = useState<WorldPopup[]>([]);
  const [showShop, setShowShop] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDailyReward, setShowDailyReward] = useState(false);
  const [endResult, setEndResult] = useState<GameEndResult | null>(null);
  const [showMultiplayer, setShowMultiplayer] = useState(false);
  const [multiplayerConnected, setMultiplayerConnected] = useState(false);
  const [multiplayerRoom, setMultiplayerRoom] = useState<MultiplayerRoom | null>(null);
  const [multiplayerPlayerId, setMultiplayerPlayerId] = useState<string | null>(null);
  const [multiplayerError, setMultiplayerError] = useState<string | null>(null);

  const saveRef = useRef(save);
  saveRef.current = save;
  const multiplayerRoomRef = useRef(multiplayerRoom);
  multiplayerRoomRef.current = multiplayerRoom;
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const matchStartTimeoutRef = useRef<number | null>(null);
  const dailyRewardInitialized = useRef(false);

  const updateSave = useCallback((updater: (prev: SaveData) => SaveData) => {
    setSave((prev) => {
      const next = updater(prev);
      persistSaveData(next);
      gameRef.current?.updateSaveData(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    soundEngine.setSettings(saveRef.current.settings.sfxEnabled, saveRef.current.settings.musicEnabled);

    const game = new CabolGame(mount, saveRef.current, {
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onPopup: (popup) => {
        setPopups((prev) => [...prev.slice(-8), popup]);
        window.setTimeout(() => {
          setPopups((prev) => prev.filter((item) => item.id !== popup.id));
        }, 850);
      },
      onGameEnd: (result) => {
        setEndResult(result);
        if (multiplayerRoomRef.current) {
          socketRef.current?.emit('game:finish', { score: result.score });
        }
        updateSave((prev) => {
          const nextUnlocked =
            result.victory && result.level >= prev.highestUnlockedLevel
              ? Math.min(5, result.level + 1)
              : prev.highestUnlockedLevel;
          return {
            ...prev,
            coins: prev.coins + result.coinsEarned,
            highScore: Math.max(prev.highScore, result.score),
            highestUnlockedLevel: nextUnlocked,
          };
        });
      },
      onTogglePauseRequest: () => {
        if (multiplayerRoomRef.current) return;
        setHud((curr) => {
          const nextPaused = curr.mode === 'playing';
          gameRef.current?.setPaused(nextPaused);
          return curr;
        });
      },
    });

    gameRef.current = game;
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, [updateSave]);

  useEffect(() => {
    if (dailyRewardInitialized.current) return;
    dailyRewardInitialized.current = true;

    const today = getLocalDateKey();
    const lastClaimDate = saveRef.current.lastDailyRewardDate;
    if (lastClaimDate && /^\d{4}-\d{2}-\d{2}$/.test(lastClaimDate) && lastClaimDate >= today) return;

    updateSave((prev) => ({
      ...prev,
      coins: prev.coins + DAILY_LOGIN_REWARD_COINS,
      lastDailyRewardDate: today,
    }));
    setShowDailyReward(true);
  }, [updateSave]);

  const handlePlay = (levelToPlay = selectedLevel) => {
    setEndResult(null);
    setShowShop(false);
    setShowSettings(false);
    setSelectedLevel(levelToPlay);
    gameRef.current?.startLevel(levelToPlay, { competitive: Boolean(multiplayerRoomRef.current) });
  };

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
      autoConnect: false,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setMultiplayerConnected(true);
    });
    socket.on('disconnect', () => {
      setMultiplayerConnected(false);
      if (multiplayerRoomRef.current) {
        setMultiplayerRoom(null);
        setMultiplayerPlayerId(null);
        setMultiplayerError('Koneksi terputus; pertandingan dibatalkan. Buat room baru untuk bermain lagi.');
        if (matchStartTimeoutRef.current !== null) {
          window.clearTimeout(matchStartTimeoutRef.current);
          matchStartTimeoutRef.current = null;
        }
      }
    });
    socket.on('connect_error', () => {
      setMultiplayerConnected(false);
      setMultiplayerError('Server multiplayer belum tersedia. Jalankan server game untuk bermain online.');
    });
    socket.on('room:update', (nextRoom) => {
      setMultiplayerRoom(nextRoom);
      if (nextRoom.status !== 'playing' && matchStartTimeoutRef.current !== null) {
        window.clearTimeout(matchStartTimeoutRef.current);
        matchStartTimeoutRef.current = null;
      }
    });
    socket.on('match:starting', ({ level, startedAt }) => {
      setSelectedLevel(level);
      setMultiplayerError(null);
      setShowMultiplayer(false);
      if (matchStartTimeoutRef.current !== null) {
        window.clearTimeout(matchStartTimeoutRef.current);
      }
      matchStartTimeoutRef.current = window.setTimeout(
        () => {
          matchStartTimeoutRef.current = null;
          handlePlay(level);
        },
        Math.max(0, startedAt - Date.now()),
      );
    });
    socket.connect();

    return () => {
      if (matchStartTimeoutRef.current !== null) {
        window.clearTimeout(matchStartTimeoutRef.current);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!multiplayerRoom || multiplayerRoom.status !== 'playing' || hud.mode !== 'playing') return;
    socketRef.current?.emit('game:score', { score: hud.score });
  }, [hud.mode, hud.score, multiplayerRoom?.code, multiplayerRoom?.status]);

  const handleCreateRoom = (name: string) => {
    socketRef.current?.emit('room:create', { name }, (response) => {
      if (!response.ok) {
        setMultiplayerError(response.error);
        return;
      }
      setMultiplayerPlayerId(response.data.playerId);
      setMultiplayerRoom(response.data.room);
      setMultiplayerError(null);
    });
  };

  const handleJoinRoom = (name: string, code: string) => {
    socketRef.current?.emit('room:join', { name, code }, (response) => {
      if (!response.ok) {
        setMultiplayerError(response.error);
        return;
      }
      setMultiplayerPlayerId(response.data.playerId);
      setMultiplayerRoom(response.data.room);
      setMultiplayerError(null);
    });
  };

  const handleStartMatch = () => {
    socketRef.current?.emit('room:start', { level: selectedLevel }, (response) => {
      if (!response.ok) setMultiplayerError(response.error);
    });
  };

  const handleLeaveRoom = () => {
    socketRef.current?.emit('room:leave');
    setMultiplayerRoom(null);
    setMultiplayerPlayerId(null);
    setMultiplayerError(null);
    setShowMultiplayer(false);
    setEndResult(null);
    gameRef.current?.returnToMenu();
  };

  const handleBuyUpgrade = (key: UpgradeKey) => {
    const cfg = UPGRADES.find((u) => u.key === key);
    if (!cfg) return;
    const currentLvl = save.upgrades[key];
    if (currentLvl >= cfg.maxLevel) return;
    const cost = getUpgradeCost(cfg, currentLvl);
    if (save.coins < cost) return;

    soundEngine.playCoin();
    updateSave((prev) => ({
      ...prev,
      coins: prev.coins - cost,
      upgrades: {
        ...prev.upgrades,
        [key]: prev.upgrades[key] + 1,
      },
    }));
  };

  const handleBuyOrEquipSkin = (skinId: string) => {
    const skin = SKINS.find((s) => s.id === skinId);
    if (!skin) return;
    const owned = save.ownedSkins.includes(skinId);

    if (owned) {
      soundEngine.playUiClick();
      updateSave((prev) => ({ ...prev, equippedSkin: skinId }));
      return;
    }

    if (save.coins < skin.cost) return;
    soundEngine.playCoin();
    updateSave((prev) => ({
      ...prev,
      coins: prev.coins - skin.cost,
      ownedSkins: [...prev.ownedSkins, skinId],
      equippedSkin: skinId,
    }));
  };

  const handleToggleSetting = (key: 'sfxEnabled' | 'musicEnabled' | 'cameraShake') => {
    updateSave((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [key]: !prev.settings[key],
      },
    }));
  };

  const handleResetProgress = () => {
    const def = {
      ...getDefaultSave(),
      lastDailyRewardDate: saveRef.current.lastDailyRewardDate,
    };
    persistSaveData(def);
    setSave(def);
    setSelectedLevel(1);
    gameRef.current?.updateSaveData(def);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-sky-300">
      {/* Isolated WebGL Viewport Container */}
      <div ref={canvasMountRef} className="absolute inset-0 h-full w-full" />

      {/* Main Menu */}
      {hud.mode === 'menu' && (
        <MainMenuOverlay
          save={save}
          selectedLevel={selectedLevel}
          onSelectLevel={setSelectedLevel}
          onPlay={() => handlePlay(selectedLevel)}
          onOpenMultiplayer={() => {
            setMultiplayerError(null);
            setShowMultiplayer(true);
          }}
          onOpenShop={() => setShowShop(true)}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {/* Active Gameplay HUD */}
      {(hud.mode === 'playing' || hud.mode === 'paused') && (
        <GameplayHud
          hud={hud}
          popups={popups}
          hidePause={Boolean(multiplayerRoom)}
          multiplayerOpponent={multiplayerRoom?.players
            .filter((player) => player.id !== multiplayerPlayerId)
            .map((player) => ({ name: player.name, score: player.score }))[0]}
          onJoystickMove={(x, y) => gameRef.current?.setJoystick(x, y)}
          onPull={() => gameRef.current?.triggerPull()}
          onPause={() => gameRef.current?.setPaused(true)}
          onFinishEarly={() => gameRef.current?.finishLevelNow()}
        />
      )}

      {/* Pause Modal */}
      {hud.mode === 'paused' && (
        <PauseModal
          level={hud.level}
          onResume={() => gameRef.current?.setPaused(false)}
          onRestart={() => handlePlay(hud.level)}
          onMainMenu={handleLeaveRoom}
        />
      )}

      {/* Victory / Game Over Modal */}
      {endResult && !multiplayerRoom && (hud.mode === 'victory' || hud.mode === 'gameover') && !showShop && (
        <ResultModal
          result={endResult}
          onNextLevel={() => handlePlay(Math.min(5, endResult.level + 1))}
          onRestart={() => handlePlay(endResult.level)}
          onMainMenu={() => {
            setEndResult(null);
            gameRef.current?.returnToMenu();
          }}
          onOpenShop={() => setShowShop(true)}
        />
      )}

      {showMultiplayer && (
        <MultiplayerModal
          connected={multiplayerConnected}
          room={multiplayerRoom}
          playerId={multiplayerPlayerId}
          level={selectedLevel}
          error={multiplayerError}
          onCreate={handleCreateRoom}
          onJoin={handleJoinRoom}
          onStart={handleStartMatch}
          onClose={handleLeaveRoom}
        />
      )}

      {multiplayerRoom && endResult && multiplayerRoom.status !== 'finished' && (
        <MatchWaitingOverlay
          room={multiplayerRoom}
          playerId={multiplayerPlayerId}
          onLeave={handleLeaveRoom}
        />
      )}

      {multiplayerRoom?.status === 'finished' && (
        <MatchResultModal
          room={multiplayerRoom}
          playerId={multiplayerPlayerId}
          onMainMenu={handleLeaveRoom}
        />
      )}

      {/* Shop Modal */}
      {showShop && (
        <ShopModal
          save={save}
          onBuyUpgrade={handleBuyUpgrade}
          onBuyOrEquipSkin={handleBuyOrEquipSkin}
          onClose={() => setShowShop(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          save={save}
          onToggleSetting={handleToggleSetting}
          onResetProgress={handleResetProgress}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showDailyReward && (
        <DailyRewardModal
          coins={DAILY_LOGIN_REWARD_COINS}
          onClose={() => setShowDailyReward(false)}
        />
      )}
    </div>
  );
}
