import * as THREE from 'three';
import { LevelConfig } from './shop';
import { ObstacleCollider } from './garden';

export type GrassTier = 'easy' | 'medium' | 'big' | 'tough' | 'boss';

export interface GrassEntity {
  id: number;
  tier: GrassTier;
  label: string;
  group: THREE.Group;
  tuftGroup: THREE.Group;
  rootsGroup: THREE.Group;
  mound: THREE.Mesh;
  x: number;
  z: number;
  radius: number;
  pullRange: number;
  hp: number;
  maxHp: number;
  points: number;
  coins: number;
  shakeTimer: number;
  stretchAmount: number;
  uprooted: boolean;
  flyVy: number;
  flyVx: number;
  flyVz: number;
  flySpinX: number;
  flySpinZ: number;
  flyLife: number;
  swayOffset: number;
}

interface DirtParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  rz: number;
  life: number;
  maxLife: number;
  active: boolean;
}

const TIER_DEFS: Record<
  GrassTier,
  {
    label: string;
    hp: number;
    points: number;
    coins: number;
    scale: number;
    radius: number;
    pullRange: number;
    bladeColor: number;
    tipColor: number;
    bladeCount: number;
  }
> = {
  easy: {
    label: 'Rumput Muda',
    hp: 1,
    points: 50,
    coins: 5,
    scale: 0.85,
    radius: 0.35,
    pullRange: 2.15,
    bladeColor: 0x4ade80,
    tipColor: 0xa3e635,
    bladeCount: 6,
  },
  medium: {
    label: 'Rumput Liar',
    hp: 2,
    points: 95,
    coins: 10,
    scale: 1.08,
    radius: 0.45,
    pullRange: 2.25,
    bladeColor: 0x22c55e,
    tipColor: 0xf43f5e,
    bladeCount: 8,
  },
  big: {
    label: 'Rumput Besar',
    hp: 3,
    points: 170,
    coins: 16,
    scale: 1.42,
    radius: 0.62,
    pullRange: 2.45,
    bladeColor: 0x15803d,
    tipColor: 0xfacc15,
    bladeCount: 10,
  },
  tough: {
    label: 'Akar Besi',
    hp: 4,
    points: 260,
    coins: 25,
    scale: 1.55,
    radius: 0.68,
    pullRange: 2.5,
    bladeColor: 0x0f766e,
    tipColor: 0x94a3b8,
    bladeCount: 11,
  },
  boss: {
    label: 'BOSS GRASS!',
    hp: 10,
    points: 950,
    coins: 125,
    scale: 2.55,
    radius: 1.15,
    pullRange: 3.15,
    bladeColor: 0x14532d,
    tipColor: 0xd946ef,
    bladeCount: 14,
  },
};

export class GrassManager {
  public readonly group = new THREE.Group();
  public grasses: GrassEntity[] = [];
  private flyingGrasses: GrassEntity[] = [];
  private particles: DirtParticle[] = [];
  private targetRing: THREE.Mesh;
  private nextId = 1;
  private spawnTimer = 0;
  private bossSpawned = false;
  private bossDefeated = false;

  // Shared geometries & materials for efficiency
  private soilMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.95 });
  private rootMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 });
  private dirtParticleGeo = new THREE.DodecahedronGeometry(0.11, 0);
  private leafParticleGeo = new THREE.BoxGeometry(0.16, 0.04, 0.08);
  private dirtParticleMat = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.9 });
  private leafParticleMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.7 });
  private sparkParticleMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });

  constructor() {
    // Ground target ring beneath nearest pullable grass
    const ringGeo = new THREE.RingGeometry(0.55, 0.78, 28);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.targetRing = new THREE.Mesh(ringGeo, ringMat);
    this.targetRing.position.y = 0.04;
    this.targetRing.visible = false;
    this.group.add(this.targetRing);

    // Pre-allocate 120 pooled particles
    for (let i = 0; i < 120; i++) {
      const isLeaf = i % 3 === 0;
      const mesh = new THREE.Mesh(
        isLeaf ? this.leafParticleGeo : this.dirtParticleGeo,
        isLeaf ? this.leafParticleMat : this.dirtParticleMat,
      );
      mesh.visible = false;
      this.group.add(mesh);
      this.particles.push({
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        rz: 0,
        life: 0,
        maxLife: 0.8,
        active: false,
      });
    }
  }

  public initLevel(levelCfg: LevelConfig, obstacles: ObstacleCollider[]): void {
    this.clearAll();
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.spawnTimer = 0;

    if (levelCfg.hasBoss) {
      this.spawnGrass('boss', obstacles, 0, -2.5);
      this.bossSpawned = true;
    }

    const initialCount = Math.min(levelCfg.maxGrassCount, 12);
    for (let i = 0; i < initialCount; i++) {
      const tier = this.pickTier(levelCfg);
      this.spawnGrass(tier, obstacles);
    }
  }

  public clearAll(): void {
    for (const g of this.grasses) {
      this.group.remove(g.group);
    }
    for (const fg of this.flyingGrasses) {
      this.group.remove(fg.group);
    }
    this.grasses = [];
    this.flyingGrasses = [];
    this.targetRing.visible = false;
    for (const p of this.particles) {
      p.active = false;
      p.mesh.visible = false;
    }
  }

  public isBossDefeated(): boolean {
    return this.bossDefeated;
  }

  public hasActiveBoss(): boolean {
    return this.grasses.some((g) => g.tier === 'boss');
  }

  public getBossProgress(): { current: number; max: number } | null {
    const boss = this.grasses.find((g) => g.tier === 'boss');
    if (!boss) return null;
    return { current: Math.max(0, boss.hp), max: boss.maxHp };
  }

  private pickTier(cfg: LevelConfig): GrassTier {
    const r = Math.random();
    const w = cfg.weights;
    if (r < w.easy) return 'easy';
    if (r < w.easy + w.medium) return 'medium';
    if (r < w.easy + w.medium + w.big) return 'big';
    return 'tough';
  }

  private findFreeSpot(obstacles: ObstacleCollider[], radius: number): { x: number; z: number } {
    for (let attempt = 0; attempt < 30; attempt++) {
      const x = (Math.random() * 2 - 1) * 10.6;
      const z = (Math.random() * 2 - 1) * 10.6;
      let blocked = false;

      // Avoid center spawn pad slightly if very close
      for (const obs of obstacles) {
        const dx = x - obs.x;
        const dz = z - obs.z;
        if (dx * dx + dz * dz < (obs.radius + radius + 0.6) ** 2) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      for (const g of this.grasses) {
        const dx = x - g.x;
        const dz = z - g.z;
        if (dx * dx + dz * dz < (g.radius + radius + 0.9) ** 2) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return { x, z };
    }
    return { x: (Math.random() * 2 - 1) * 9.5, z: (Math.random() * 2 - 1) * 9.5 };
  }

  public spawnGrass(tier: GrassTier, obstacles: ObstacleCollider[], forceX?: number, forceZ?: number): GrassEntity {
    const def = TIER_DEFS[tier];
    const spot =
      forceX !== undefined && forceZ !== undefined
        ? { x: forceX, z: forceZ }
        : this.findFreeSpot(obstacles, def.radius);

    const group = new THREE.Group();
    group.position.set(spot.x, 0, spot.z);

    // Dirt mound anchored at ground
    const moundGeo = new THREE.CylinderGeometry(def.radius * 0.72, def.radius * 1.15, 0.22 * def.scale, 12);
    const mound = new THREE.Mesh(moundGeo, this.soilMat);
    mound.position.y = 0.08 * def.scale;
    mound.receiveShadow = true;
    mound.castShadow = true;
    group.add(mound);

    // Tuft group (uproots and flies away!)
    const tuftGroup = new THREE.Group();
    group.add(tuftGroup);

    const bladeMat = new THREE.MeshStandardMaterial({
      color: def.bladeColor,
      roughness: tier === 'tough' ? 0.35 : 0.65,
      metalness: tier === 'tough' ? 0.3 : 0.02,
    });
    const tipMat = new THREE.MeshStandardMaterial({
      color: def.tipColor,
      roughness: 0.45,
      metalness: tier === 'boss' ? 0.35 : 0.05,
      emissive: tier === 'boss' ? 0x701a75 : 0x000000,
      emissiveIntensity: tier === 'boss' ? 0.4 : 0,
    });

    // Radial grass blades
    for (let i = 0; i < def.bladeCount; i++) {
      const ang = (i / def.bladeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const h = (0.65 + Math.random() * 0.45) * def.scale;
      const w = (0.12 + Math.random() * 0.06) * def.scale;
      const blade = new THREE.Mesh(new THREE.ConeGeometry(w, h, 5), bladeMat);
      const dist = (0.08 + Math.random() * 0.14) * def.scale;
      blade.position.set(Math.cos(ang) * dist, h * 0.48, Math.sin(ang) * dist);
      blade.rotation.z = -Math.cos(ang) * (0.28 + Math.random() * 0.22);
      blade.rotation.x = Math.sin(ang) * (0.28 + Math.random() * 0.22);
      blade.castShadow = true;
      tuftGroup.add(blade);
    }

    // Center stem & distinctive top ornament per tier
    if (tier === 'medium') {
      const bud = new THREE.Mesh(new THREE.SphereGeometry(0.16 * def.scale, 8, 8), tipMat);
      bud.position.y = 0.88 * def.scale;
      bud.castShadow = true;
      tuftGroup.add(bud);
    } else if (tier === 'big') {
      const bulb = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24 * def.scale, 0), tipMat);
      bulb.position.y = 0.95 * def.scale;
      bulb.castShadow = true;
      tuftGroup.add(bulb);
    } else if (tier === 'tough') {
      // Metallic iron-root collar ring
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.28 * def.scale, 0.06 * def.scale, 8, 12),
        tipMat,
      );
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 0.22 * def.scale;
      tuftGroup.add(collar);
    } else if (tier === 'boss') {
      // Boss Grass angry cartoon face + golden crown!
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45 * def.scale, 14, 12), bladeMat);
      bulb.position.y = 0.52 * def.scale;
      bulb.castShadow = true;
      tuftGroup.add(bulb);

      const eyeMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfacc15, emissiveIntensity: 0.6 });
      const pupilMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12 * def.scale, 8, 8), eyeMat);
      eyeL.position.set(-0.16 * def.scale, 0.56 * def.scale, 0.39 * def.scale);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.16 * def.scale;
      const pL = new THREE.Mesh(new THREE.SphereGeometry(0.06 * def.scale, 6, 6), pupilMat);
      pL.position.set(-0.16 * def.scale, 0.56 * def.scale, 0.48 * def.scale);
      const pR = pL.clone();
      pR.position.x = 0.16 * def.scale;

      // Crown
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * def.scale, 0.22 * def.scale, 0.28 * def.scale, 6), tipMat);
      crown.position.y = 1.02 * def.scale;
      crown.castShadow = true;
      tuftGroup.add(eyeL, eyeR, pL, pR, crown);
    }

    // Cartoon dangling roots hidden underground until uprooted!
    const rootsGroup = new THREE.Group();
    rootsGroup.visible = false;
    for (let r = 0; r < 5; r++) {
      const ang = (r / 5) * Math.PI * 2;
      const root = new THREE.Mesh(new THREE.ConeGeometry(0.07 * def.scale, 0.5 * def.scale, 5), this.rootMat);
      root.rotation.x = Math.PI;
      root.rotation.z = Math.cos(ang) * 0.35;
      root.position.set(Math.cos(ang) * 0.12 * def.scale, -0.22 * def.scale, Math.sin(ang) * 0.12 * def.scale);
      rootsGroup.add(root);
    }
    tuftGroup.add(rootsGroup);

    // Pop-in spawn scale animation
    tuftGroup.scale.setScalar(0.1);

    this.group.add(group);
    const entity: GrassEntity = {
      id: this.nextId++,
      tier,
      label: def.label,
      group,
      tuftGroup,
      rootsGroup,
      mound,
      x: spot.x,
      z: spot.z,
      radius: def.radius,
      pullRange: def.pullRange,
      hp: def.hp,
      maxHp: def.hp,
      points: def.points,
      coins: def.coins,
      shakeTimer: 0,
      stretchAmount: 0,
      uprooted: false,
      flyVy: 0,
      flyVx: 0,
      flyVz: 0,
      flySpinX: 0,
      flySpinZ: 0,
      flyLife: 0,
      swayOffset: Math.random() * Math.PI * 2,
    };

    this.grasses.push(entity);
    return entity;
  }

  public findNearestTarget(px: number, pz: number): GrassEntity | null {
    let best: GrassEntity | null = null;
    let bestDistSq = Infinity;
    for (const g of this.grasses) {
      if (g.uprooted) continue;
      const dx = g.x - px;
      const dz = g.z - pz;
      const dSq = dx * dx + dz * dz;
      if (dSq <= g.pullRange * g.pullRange && dSq < bestDistSq) {
        bestDistSq = dSq;
        best = g;
      }
    }
    return best;
  }

  public emitSoilBurst(x: number, z: number, count: number, isBossOrCombo = false): void {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.active) continue;
      p.active = true;
      p.life = 0;
      p.maxLife = 0.45 + Math.random() * 0.4;
      p.mesh.visible = true;
      p.mesh.position.set(x + (Math.random() - 0.5) * 0.4, 0.2, z + (Math.random() - 0.5) * 0.4);
      const ang = Math.random() * Math.PI * 2;
      const spd = 2.2 + Math.random() * 4.5;
      p.vx = Math.cos(ang) * spd;
      p.vz = Math.sin(ang) * spd;
      p.vy = 4.2 + Math.random() * 4.8;
      p.rx = (Math.random() - 0.5) * 14;
      p.rz = (Math.random() - 0.5) * 14;
      if (isBossOrCombo && spawned % 3 === 0) {
        p.mesh.material = this.sparkParticleMat;
        p.mesh.scale.setScalar(1.3);
      } else {
        p.mesh.material = spawned % 2 === 0 ? this.dirtParticleMat : this.leafParticleMat;
        p.mesh.scale.setScalar(0.8 + Math.random() * 0.8);
      }
      spawned++;
      if (spawned >= count) break;
    }
  }

  public applyPull(
    target: GrassEntity,
    power: number,
  ): { uprooted: boolean; tier: GrassTier; points: number; coins: number; x: number; z: number } {
    target.hp -= power;
    target.shakeTimer = 0.35;
    target.stretchAmount = 0.45;

    if (target.hp <= 0) {
      target.uprooted = true;
      target.rootsGroup.visible = true;
      // Detach tuft into flying list and fade mound
      const idx = this.grasses.indexOf(target);
      if (idx !== -1) this.grasses.splice(idx, 1);
      this.flyingGrasses.push(target);

      const ang = Math.random() * Math.PI * 2;
      target.flyVy = target.tier === 'boss' ? 11.5 : 8.5;
      target.flyVx = Math.cos(ang) * 2.4;
      target.flyVz = Math.sin(ang) * 2.4;
      target.flySpinX = (Math.random() > 0.5 ? 1 : -1) * 9;
      target.flySpinZ = (Math.random() - 0.5) * 8;
      target.flyLife = 0;

      if (target.tier === 'boss') {
        this.bossDefeated = true;
        this.emitSoilBurst(target.x, target.z, 36, true);
      } else {
        this.emitSoilBurst(target.x, target.z, 14, false);
      }

      return {
        uprooted: true,
        tier: target.tier,
        points: target.points,
        coins: target.coins,
        x: target.x,
        z: target.z,
      };
    }

    // Partial pull dirt spray
    this.emitSoilBurst(target.x, target.z, 6, false);
    return {
      uprooted: false,
      tier: target.tier,
      points: 0,
      coins: 0,
      x: target.x,
      z: target.z,
    };
  }

  public update(dt: number, elapsed: number, levelCfg: LevelConfig | null, obstacles: ObstacleCollider[], playerX: number, playerZ: number): GrassEntity | null {
    // Respawn grass gradually during active gameplay
    if (levelCfg) {
      this.spawnTimer += dt;
      if (this.grasses.length < levelCfg.maxGrassCount && this.spawnTimer >= 1.15) {
        this.spawnTimer = 0;
        const tier = this.pickTier(levelCfg);
        this.spawnGrass(tier, obstacles);
      }
      if (levelCfg.hasBoss && !this.bossSpawned) {
        this.spawnGrass('boss', obstacles, 0, -2.5);
        this.bossSpawned = true;
      }
    }

    // Nearest target highlight ring
    const nearest = this.findNearestTarget(playerX, playerZ);
    if (nearest) {
      this.targetRing.visible = true;
      this.targetRing.position.x = nearest.x;
      this.targetRing.position.z = nearest.z;
      const pulse = 1 + Math.sin(elapsed * 10) * 0.12;
      const rScale = nearest.radius * 1.55 * pulse;
      this.targetRing.scale.set(rScale, 1, rScale);
    } else {
      this.targetRing.visible = false;
    }

    // Animate grounded grasses (sway, spawn pop-in, pull shake & stretch)
    for (const g of this.grasses) {
      const s = THREE.MathUtils.damp(g.tuftGroup.scale.x, 1, 10, dt);
      let stretchY = s;
      if (g.stretchAmount > 0) {
        g.stretchAmount = Math.max(0, g.stretchAmount - dt * 2.2);
        stretchY = s * (1 + g.stretchAmount);
      }
      g.tuftGroup.scale.set(s, stretchY, s);

      if (g.shakeTimer > 0) {
        g.shakeTimer -= dt;
        g.tuftGroup.rotation.z = Math.sin(elapsed * 55) * 0.25;
        g.tuftGroup.rotation.x = Math.cos(elapsed * 48) * 0.2;
      } else {
        g.tuftGroup.rotation.z = Math.sin(elapsed * 2.4 + g.swayOffset) * 0.06;
        g.tuftGroup.rotation.x = Math.cos(elapsed * 2.0 + g.swayOffset) * 0.04;
      }
    }

    // Animate uprooted flying grasses
    for (let i = this.flyingGrasses.length - 1; i >= 0; i--) {
      const fg = this.flyingGrasses[i];
      fg.flyLife += dt;
      fg.flyVy -= 22 * dt;
      fg.tuftGroup.position.x += fg.flyVx * dt;
      fg.tuftGroup.position.y += fg.flyVy * dt;
      fg.tuftGroup.position.z += fg.flyVz * dt;
      fg.tuftGroup.rotation.x += fg.flySpinX * dt;
      fg.tuftGroup.rotation.z += fg.flySpinZ * dt;

      if (fg.flyLife > 0.55) {
        const shrink = Math.max(0.01, 1 - (fg.flyLife - 0.55) / 0.35);
        fg.tuftGroup.scale.setScalar(shrink);
        fg.mound.scale.setScalar(shrink);
      }

      if (fg.flyLife >= 0.9) {
        this.group.remove(fg.group);
        this.flyingGrasses.splice(i, 1);
      }
    }

    // Animate 3D soil & leaf particles
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life += dt;
      p.vy -= 18 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += p.rx * dt;
      p.mesh.rotation.z += p.rz * dt;

      if (p.mesh.position.y < 0.06) {
        p.mesh.position.y = 0.06;
        p.vy = -p.vy * 0.35;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }

      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
      }
    }

    return nearest;
  }
}
