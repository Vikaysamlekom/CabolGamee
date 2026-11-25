import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CabolPlayer } from './player';
import { GardenEnvironment } from './garden';
import { GrassEntity, GrassManager, GrassTier } from './grass';
import { soundEngine } from './audio';
import {
  getDefaultSave,
  getLevelConfig,
  getPlayerStats,
  getSkinById,
  LevelConfig,
  SaveData,
} from './shop';

export type GameMode = 'menu' | 'playing' | 'paused' | 'victory' | 'gameover';

export interface HudSnapshot {
  mode: GameMode;
  level: number;
  levelName: string;
  score: number;
  targetScore: number;
  timeLeft: number;
  combo: number;
  maxCombo: number;
  comboTimerRatio: number;
  coinsEarned: number;
  grassPulled: number;
  hasBoss: boolean;
  bossDefeated: boolean;
  bossHp: number;
  bossMaxHp: number;
  targetGrass: {
    label: string;
    hp: number;
    maxHp: number;
    screenX: number;
    screenY: number;
  } | null;
}

export interface WorldPopup {
  id: number;
  text: string;
  subtext?: string;
  color: string;
  screenX: number;
  screenY: number;
}

export interface GameCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onPopup: (popup: WorldPopup) => void;
  onGameEnd: (result: {
    victory: boolean;
    level: number;
    score: number;
    targetScore: number;
    coinsEarned: number;
    grassPulled: number;
    maxCombo: number;
    isNewHighScore: boolean;
  }) => void;
  onTogglePauseRequest: () => void;
}

// Reusable module-scope math helpers (Zero GC in render loop)
const _projVec = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();

export class CabolGame {
  private container: HTMLElement;
  private callbacks: GameCallbacks;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private isSoftwareGl = false;

  private garden!: GardenEnvironment;
  private player!: CabolPlayer;
  private grassManager!: GrassManager;

  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;

  // Game state
  private mode: GameMode = 'menu';
  private saveData: SaveData;
  private currentLevelCfg: LevelConfig = getLevelConfig(1);
  private score = 0;
  private competitiveMode = false;
  private readonly competitiveStats = getPlayerStats(getDefaultSave());
  private timeLeft = 120;
  private combo = 0;
  private maxCombo = 0;
  private comboTimer = 0;
  private readonly comboDuration = 3.2;
  private coinsEarned = 0;
  private grassPulled = 0;
  private pullCooldown = 0;
  private cameraShake = 0;
  private menuOrbitAngle = 0;
  private popupSeq = 1;
  private lastHudPush = 0;

  // Input state
  private keys: Record<string, boolean> = {};
  private joystickVec = { x: 0, y: 0 };

  constructor(container: HTMLElement, initialSave: SaveData, callbacks: GameCallbacks) {
    this.container = container;
    this.saveData = initialSave;
    this.callbacks = callbacks;

    this.initRendererAndScene();
    this.bindEvents();
    this.setupMenuShowcase();
    this.startLoop();
  }

  private detectSoftwareWebGL(): boolean {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private initRendererAndScene(): void {
    this.isSoftwareGl = this.detectSoftwareWebGL();
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const skyColor = 0x7dd3fc;
    this.scene.background = new THREE.Color(skyColor);
    this.scene.fog = new THREE.FogExp2(skyColor, 0.013);

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 160);
    this.camera.position.set(0, 8.5, 11.5);

    // Mandatory studio environment map for PBR reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Warm Sun Key + Cool Sky/Earth Fill + Rim Light
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x3f6212, 0.85);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.55);
    sunLight.position.set(14, 22, 12);
    sunLight.castShadow = !this.isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 60;
    const d = 16;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    this.scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xbae6fd, 0.45);
    rimLight.position.set(-12, 10, -14);
    this.scene.add(rimLight);

    this.garden = new GardenEnvironment(this.renderer);
    this.scene.add(this.garden.group);

    this.player = new CabolPlayer(getSkinById(this.saveData.equippedSkin));
    this.scene.add(this.player.group);

    this.grassManager = new GrassManager();
    this.scene.add(this.grassManager.group);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private setupMenuShowcase(): void {
    this.mode = 'menu';
    this.player.position.set(0, 0, 2.5);
    this.player.yaw = 0;
    this.grassManager.initLevel(getLevelConfig(1), this.garden.colliders);
    this.pushHud(true);
  }

  public updateSaveData(nextSave: SaveData): void {
    this.saveData = nextSave;
    this.player.applySkin(getSkinById(nextSave.equippedSkin));
    soundEngine.setSettings(nextSave.settings.sfxEnabled, nextSave.settings.musicEnabled);
  }

  public startLevel(levelNumber: number, options: { competitive?: boolean } = {}): void {
    soundEngine.unlock();
    soundEngine.startMusic();
    this.currentLevelCfg = getLevelConfig(levelNumber);
    this.competitiveMode = options.competitive ?? false;
    this.mode = 'playing';
    this.score = 0;
    this.timeLeft = this.currentLevelCfg.durationSec;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.coinsEarned = 0;
    this.grassPulled = 0;
    this.pullCooldown = 0;
    this.cameraShake = 0;

    this.player.position.set(0, 0, 7.5);
    this.player.yaw = Math.PI;
    this.grassManager.initLevel(this.currentLevelCfg, this.garden.colliders);
    this.pushHud(true);
  }

  public setPaused(paused: boolean): void {
    if (this.mode !== 'playing' && this.mode !== 'paused') return;
    this.mode = paused ? 'paused' : 'playing';
    this.pushHud(true);
  }

  public returnToMenu(): void {
    soundEngine.stopMusic();
    this.setupMenuShowcase();
  }

  public setJoystick(x: number, y: number): void {
    this.joystickVec.x = x;
    this.joystickVec.y = y;
  }

  public triggerPull(): void {
    if (this.mode !== 'playing' || this.pullCooldown > 0) return;
    soundEngine.unlock();
    this.pullCooldown = 0.28;

    const stats = this.competitiveMode ? this.competitiveStats : getPlayerStats(this.saveData);
    const target = this.grassManager.findNearestTarget(this.player.position.x, this.player.position.z);

    if (target) {
      // Face AWAY from the grass so the character squats & pulls with their padded backside toward the grass!
      const dx = target.x - this.player.position.x;
      const dz = target.z - this.player.position.z;
      this.player.yaw = Math.atan2(-dx, -dz);
    }

    this.player.triggerSquat();
    soundEngine.playSquat();

    if (!target) return;

    const res = this.grassManager.applyPull(target, stats.pullPower);

    if (res.uprooted) {
      this.player.triggerPop();
      this.grassPulled++;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.comboTimer = this.comboDuration;

      const comboMult = 1 + Math.min(this.combo - 1, 10) * 0.15;
      const earnedScore = Math.round(res.points * comboMult * stats.scoreMultiplier);
      const earnedCoins = res.coins + (this.combo >= 3 ? 2 : 0) + stats.coinBonusFlat;

      this.score += earnedScore;
      this.coinsEarned += earnedCoins;

      if (res.tier === 'boss') {
        soundEngine.playBossPop();
        this.cameraShake = 0.55;
      } else {
        soundEngine.playPop(this.combo);
        this.cameraShake = 0.22;
      }

      if (this.combo === 3 || this.combo === 5 || this.combo === 10) {
        soundEngine.playComboMilestone();
      }

      this.emitWorldPopup(
        res.x,
        1.4,
        res.z,
        `+${earnedScore}`,
        this.combo >= 2 ? `COMBO x${this.combo}!` : res.tier === 'boss' ? 'BOSS TUMBANG!' : undefined,
        res.tier === 'boss' ? '#f43f5e' : this.combo >= 3 ? '#facc15' : '#4ade80',
      );

      // Check immediate victory condition if Boss Grass defeated & target score met, or let player keep racking up bonus score?
      // Actually in timed score-chase games, completing Boss + Target Score or surviving to win feels great—let's trigger instant Victory if Boss Grass is defeated AND score >= targetScore on Level 5, or keep playing until time runs out? Wait: let's make Level 5 trigger Victory as soon as Boss Grass is defeated AND score >= targetScore, and Levels 1-4 allow racking up high scores until time ends OR hitting a big Victory button? No! Wait: "Pemain harus mengumpulkan skor sebanyak mungkin sebelum waktu habis" + "Setiap level memiliki target skor dan tingkat kesulitan yang meningkat."
      // Best arcade loop: When time hits 0, if score >= targetScore (and boss defeated on L5) => VICTORY! And if on L5 they beat Boss Grass AND already reached targetScore, let's celebrate Victory immediately or give a clear banner! Actually checking at timer = 0 OR letting player click "Selesai" isn't expected; wait—what if a player reaches 400 pts in 25 seconds on Level 1 and wants to advance without waiting 95 seconds?
      // Let's handle both cleanly:
      // 1) Keep playing to maximize High Score & Coins, OR once target score is met on Level 1-4 (or Boss defeated + target met on Level 5), show a "TARGET TERCAPAI! Lanjut / Kejar High Score" or auto-advance when timer finishes—actually even better: in the HUD bottom bar, when Target Score is reached, show a glowing "SELESAI & KLAIM MENANG" button right next to the progress bar so players can EITHER finish immediately to unlock the next level OR keep farming points & coins until the 120s timer ends! That's super player-friendly!
      this.pushHud(true);
    } else {
      soundEngine.playTugHit();
      this.cameraShake = 0.1;
      this.emitWorldPopup(res.x, 1.2, res.z, 'HNNNGH!', 'Tarik lagi!', '#fb923c');
      this.pushHud(true);
    }
  }

  public finishLevelNow(): void {
    if (this.mode !== 'playing') return;
    const bossOk = !this.currentLevelCfg.hasBoss || this.grassManager.isBossDefeated();
    if (this.score >= this.currentLevelCfg.targetScore && bossOk) {
      this.endGame(true);
    }
  }

  private endGame(victory: boolean): void {
    this.mode = victory ? 'victory' : 'gameover';
    soundEngine.stopMusic();
    if (victory) {
      soundEngine.playVictory();
    } else {
      soundEngine.playGameOver();
    }
    const isNewHighScore = this.score > this.saveData.highScore;
    this.pushHud(true);
    this.callbacks.onGameEnd({
      victory,
      level: this.currentLevelCfg.level,
      score: this.score,
      targetScore: this.currentLevelCfg.targetScore,
      coinsEarned: this.coinsEarned,
      grassPulled: this.grassPulled,
      maxCombo: this.maxCombo,
      isNewHighScore,
    });
  }

  private emitWorldPopup(wx: number, wy: number, wz: number, text: string, subtext: string | undefined, color: string): void {
    const pos = this.projectToScreen(wx, wy, wz);
    if (!pos) return;
    this.callbacks.onPopup({
      id: this.popupSeq++,
      text,
      subtext,
      color,
      screenX: pos.x,
      screenY: pos.y,
    });
  }

  private projectToScreen(wx: number, wy: number, wz: number): { x: number; y: number } | null {
    _projVec.set(wx, wy, wz);
    _projVec.project(this.camera);
    if (_projVec.z > 1) return null;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    return {
      x: ((_projVec.x + 1) * 0.5) * w,
      y: ((-_projVec.y + 1) * 0.5) * h,
    };
  }

  private getMovementInput(): { mx: number; mz: number } {
    let mx = this.joystickVec.x;
    let mz = this.joystickVec.y;

    if (this.keys['KeyA'] || this.keys['ArrowLeft']) mx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) mx += 1;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) mz -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) mz += 1;

    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    return { mx, mz };
  }

  private resolveCollisions(nx: number, nz: number): { x: number; z: number } {
    const bound = this.garden.arenaHalfSize - this.player.radius;
    let x = THREE.MathUtils.clamp(nx, -bound, bound);
    let z = THREE.MathUtils.clamp(nz, -bound, bound);

    // Collide with static garden obstacles
    for (const obs of this.garden.colliders) {
      const dx = x - obs.x;
      const dz = z - obs.z;
      const minDist = this.player.radius + obs.radius;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDist * minDist && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const push = (minDist - dist) / dist;
        x += dx * push;
        z += dz * push;
      }
    }

    // Soft bump collision against big/tough/boss grass clumps so player feels physical presence
    for (const g of this.grassManager.grasses) {
      if (g.uprooted || g.tier === 'easy') continue;
      const dx = x - g.x;
      const dz = z - g.z;
      const minDist = this.player.radius * 0.75 + g.radius * 0.65;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDist * minDist && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const push = (minDist - dist) / dist;
        x += dx * push;
        z += dz * push;
      }
    }

    return { x, z };
  }

  private updateSimulation(dt: number, elapsed: number): void {
    this.garden.update(dt);

    if (this.mode === 'paused') return;

    let isMoving = false;
    let moveSpeedRatio = 0;
    let nearestGrass: GrassEntity | null = null;

    if (this.mode === 'playing') {
      if (this.pullCooldown > 0) this.pullCooldown = Math.max(0, this.pullCooldown - dt);

      // Combo decay
      if (this.combo > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
          this.combo = 0;
          this.comboTimer = 0;
        }
      }

      // Countdown timer
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      if (this.timeLeft <= 0) {
        const bossOk = !this.currentLevelCfg.hasBoss || this.grassManager.isBossDefeated();
        const victory = this.score >= this.currentLevelCfg.targetScore && bossOk;
        this.endGame(victory);
        return;
      }

      // Movement
      const { mx, mz } = this.getMovementInput();
      const mag = Math.hypot(mx, mz);
      if (mag > 0.08 && this.player.animState !== 'squat') {
        isMoving = true;
        moveSpeedRatio = Math.min(1, mag);
        const stats = this.competitiveMode ? this.competitiveStats : getPlayerStats(this.saveData);
        const step = stats.moveSpeed * dt;
        const nextPos = this.resolveCollisions(
          this.player.position.x + mx * step,
          this.player.position.z + mz * step,
        );
        this.player.position.x = nextPos.x;
        this.player.position.z = nextPos.z;
        this.player.yaw = Math.atan2(mx, mz);
      }

      nearestGrass = this.grassManager.update(
        dt,
        elapsed,
        this.currentLevelCfg,
        this.garden.colliders,
        this.player.position.x,
        this.player.position.z,
      );
    } else if (this.mode === 'menu') {
      this.grassManager.update(dt, elapsed, null, this.garden.colliders, 999, 999);
    } else {
      this.grassManager.update(dt, elapsed, null, this.garden.colliders, this.player.position.x, this.player.position.z);
    }

    this.player.update(dt, isMoving, moveSpeedRatio, this.mode);

    // Camera choreography
    if (this.mode === 'menu') {
      this.menuOrbitAngle += dt * 0.22;
      _camDesired.set(
        Math.sin(this.menuOrbitAngle) * 7.2,
        4.1,
        2.5 + Math.cos(this.menuOrbitAngle) * 7.2,
      );
      _camTarget.set(0, 1.2, 2.5);
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camDesired.x, 5, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camDesired.y, 5, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camDesired.z, 5, dt);
      this.camera.lookAt(_camTarget);
    } else {
      // Smooth third-person angled chase camera
      _camDesired.set(
        this.player.position.x * 0.88,
        8.6,
        this.player.position.z + 9.2,
      );

      let shakeX = 0;
      let shakeY = 0;
      if (this.cameraShake > 0) {
        this.cameraShake = Math.max(0, this.cameraShake - dt * 1.8);
        if (this.saveData.settings.cameraShake) {
          shakeX = (Math.random() - 0.5) * this.cameraShake * 0.7;
          shakeY = (Math.random() - 0.5) * this.cameraShake * 0.7;
        }
      }

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camDesired.x, 8, dt) + shakeX;
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camDesired.y, 8, dt) + shakeY;
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camDesired.z, 8, dt);

      _camTarget.set(this.player.position.x, 0.9, this.player.position.z - 0.5);
      this.camera.lookAt(_camTarget);
    }

    // Push HUD snapshot ~15Hz or on changes
    if (elapsed - this.lastHudPush >= 0.065) {
      this.lastHudPush = elapsed;
      this.pushHud(false, nearestGrass);
    }
  }

  private pushHud(force: boolean, nearestGrass?: GrassEntity | null): void {
    if (!force && this.mode === 'menu') return;
    const target = nearestGrass ?? this.grassManager.findNearestTarget(this.player.position.x, this.player.position.z);
    let targetInfo: HudSnapshot['targetGrass'] = null;
    if (target && this.mode === 'playing') {
      const screen = this.projectToScreen(target.x, 1.55, target.z);
      if (screen) {
        targetInfo = {
          label: target.label,
          hp: Math.max(0, Math.ceil(target.hp * 10) / 10),
          maxHp: target.maxHp,
          screenX: screen.x,
          screenY: screen.y,
        };
      }
    }

    const bossProg = this.grassManager.getBossProgress();

    this.callbacks.onHudUpdate({
      mode: this.mode,
      level: this.currentLevelCfg.level,
      levelName: this.currentLevelCfg.name,
      score: this.score,
      targetScore: this.currentLevelCfg.targetScore,
      timeLeft: Math.ceil(this.timeLeft),
      combo: this.combo,
      maxCombo: this.maxCombo,
      comboTimerRatio: this.combo > 0 ? Math.max(0, this.comboTimer / this.comboDuration) : 0,
      coinsEarned: this.coinsEarned,
      grassPulled: this.grassPulled,
      hasBoss: this.currentLevelCfg.hasBoss,
      bossDefeated: this.grassManager.isBossDefeated(),
      bossHp: bossProg?.current ?? 0,
      bossMaxHp: bossProg?.max ?? 10,
      targetGrass: targetInfo,
    });
  }

  private startLoop(): void {
    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (this.disposed) return;
      const dt = Math.min(this.clock.getDelta(), 0.08);
      const elapsed = this.clock.getElapsedTime();

      this.updateSimulation(dt, elapsed);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;
    if (e.code === 'Space') {
      if (this.mode === 'playing') {
        e.preventDefault();
        if (!e.repeat) this.triggerPull();
      }
    } else if (e.code === 'Escape') {
      if (this.mode === 'playing' || this.mode === 'paused') {
        e.preventDefault();
        this.callbacks.onTogglePauseRequest();
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    soundEngine.stopMusic();
    this.garden.dispose();
    this.renderer.dispose();
  }
}
