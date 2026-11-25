import * as THREE from 'three';

export interface ObstacleCollider {
  x: number;
  z: number;
  radius: number;
}

export class GardenEnvironment {
  public readonly group = new THREE.Group();
  public readonly colliders: ObstacleCollider[] = [];
  public readonly arenaHalfSize = 12.2;

  private clouds: THREE.Group[] = [];
  private meadowTexture: THREE.CanvasTexture | null = null;

  constructor(renderer: THREE.WebGLRenderer) {
    this.buildSkyAndMeadow(renderer);
    this.buildWoodenFence();
    this.buildCartoonTrees();
    this.buildGardenProps();
    this.buildInstancedFlowers();
    this.buildClouds();
  }

  private createMeadowTexture(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Cheerful tiled checker meadow grass
    const tile = 64;
    for (let y = 0; y < 512; y += tile) {
      for (let x = 0; x < 512; x += tile) {
        const isLight = ((x / tile) + (y / tile)) % 2 === 0;
        ctx.fillStyle = isLight ? '#74d64c' : '#65c93e';
        ctx.fillRect(x, y, tile, tile);
      }
    }

    // Subtle organic lawn speckles
    for (let i = 0; i < 1400; i++) {
      const px = Math.random() * 512;
      const py = Math.random() * 512;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(20,83,45,0.09)';
      ctx.fillRect(px, py, 3, 5);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(9, 9);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  private buildSkyAndMeadow(renderer: THREE.WebGLRenderer): void {
    this.meadowTexture = this.createMeadowTexture(renderer);

    // Playable garden lawn (26 x 26)
    const arenaGeo = new THREE.PlaneGeometry(26.5, 26.5);
    arenaGeo.rotateX(-Math.PI / 2);
    const arenaMat = new THREE.MeshStandardMaterial({
      map: this.meadowTexture,
      roughness: 0.92,
      metalness: 0.0,
    });
    const arenaFloor = new THREE.Mesh(arenaGeo, arenaMat);
    arenaFloor.receiveShadow = true;
    arenaFloor.position.y = 0;
    this.group.add(arenaFloor);

    // Extended rolling hills outside the fence (no empty void!)
    const outerGeo = new THREE.PlaneGeometry(150, 150, 32, 32);
    outerGeo.rotateX(-Math.PI / 2);
    const pos = outerGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const dist = Math.max(Math.abs(x), Math.abs(z));
      if (dist > 14.5) {
        const wave = Math.sin(x * 0.14) * Math.cos(z * 0.14) * 1.4 + (dist - 14.5) * 0.04;
        pos.setY(i, Math.max(-0.2, wave));
      } else {
        pos.setY(i, -0.04); // slightly below playable lawn to prevent Z-fighting
      }
    }
    outerGeo.computeVertexNormals();
    const outerMat = new THREE.MeshStandardMaterial({
      color: 0x56b839,
      roughness: 0.95,
      metalness: 0.0,
    });
    const outerTerrain = new THREE.Mesh(outerGeo, outerMat);
    outerTerrain.receiveShadow = true;
    this.group.add(outerTerrain);

    // Cute stepping stones near garden entrance
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8, metalness: 0.05 });
    const stonePositions: [number, number, number][] = [
      [0, 10.6, 0.7],
      [-0.7, 9.2, 0.55],
      [0.4, 7.9, 0.6],
      [-0.3, 6.5, 0.5],
    ];
    stonePositions.forEach(([sx, sz, r]) => {
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, 0.08, 10), stoneMat);
      stone.position.set(sx, 0.02, sz);
      stone.receiveShadow = true;
      this.group.add(stone);
    });
  }

  private buildWoodenFence(): void {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.82, metalness: 0.02 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.65, metalness: 0.05 });

    const bound = 13.0;
    const step = 2.6;

    const addPost = (x: number, z: number) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 1.35, 8), woodMat);
      post.position.set(x, 0.675, z);
      post.castShadow = true;
      post.receiveShadow = true;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.25, 8), capMat);
      cap.position.set(x, 1.45, z);
      cap.castShadow = true;
      this.group.add(post, cap);
    };

    for (let d = -bound; d <= bound + 0.01; d += step) {
      addPost(d, -bound);
      addPost(d, bound);
      if (Math.abs(d) < bound - 0.1) {
        addPost(-bound, d);
        addPost(bound, d);
      }
    }

    // Horizontal rails
    const railLen = bound * 2;
    const railGeoX = new THREE.BoxGeometry(railLen, 0.14, 0.1);
    const railGeoZ = new THREE.BoxGeometry(0.1, 0.14, railLen);

    [0.45, 0.95].forEach((y) => {
      const north = new THREE.Mesh(railGeoX, woodMat);
      north.position.set(0, y, -bound);
      north.castShadow = true;

      const south = new THREE.Mesh(railGeoX, woodMat);
      south.position.set(0, y, bound);
      south.castShadow = true;

      const west = new THREE.Mesh(railGeoZ, woodMat);
      west.position.set(-bound, y, 0);
      west.castShadow = true;

      const east = new THREE.Mesh(railGeoZ, woodMat);
      east.position.set(bound, y, 0);
      east.castShadow = true;

      this.group.add(north, south, west, east);
    });
  }

  private buildCartoonTrees(): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9, metalness: 0.0 });
    const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.72, metalness: 0.0 });
    const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.75, metalness: 0.0 });
    const fruitMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, metalness: 0.05 });

    const treeSpots: [number, number, number, boolean][] = [
      [-10.2, -10.0, 1.05, true],
      [10.2, -10.2, 1.15, true],
      [-16.5, -5.0, 1.35, false],
      [17.0, 4.0, 1.4, false],
      [-17.2, 11.0, 1.25, false],
      [15.8, -14.5, 1.5, false],
      [-5.5, -18.5, 1.3, false],
      [7.5, -17.8, 1.45, false],
      [16.5, 14.0, 1.35, false],
    ];

    treeSpots.forEach(([x, z, scale, insideArena]) => {
      const tree = new THREE.Group();
      tree.position.set(x, 0, z);
      tree.scale.setScalar(scale);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.44, 2.2, 10), trunkMat);
      trunk.position.y = 1.1;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      tree.add(trunk);

      const puff1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.35, 1), leafMat2);
      puff1.position.set(0, 2.75, 0);
      puff1.castShadow = true;
      const puff2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.0, 1), leafMat1);
      puff2.position.set(0.65, 2.45, 0.35);
      puff2.castShadow = true;
      const puff3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 1), leafMat1);
      puff3.position.set(-0.6, 2.55, -0.35);
      puff3.castShadow = true;
      const puff4 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 1), leafMat1);
      puff4.position.set(0, 3.6, 0);
      puff4.castShadow = true;
      tree.add(puff1, puff2, puff3, puff4);

      // Little apples!
      for (let i = 0; i < 3; i++) {
        const ang = i * 2.1 + x;
        const apple = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), fruitMat);
        apple.position.set(Math.cos(ang) * 1.1, 2.6 + (i % 2) * 0.4, Math.sin(ang) * 1.1);
        tree.add(apple);
      }

      this.group.add(tree);

      if (insideArena) {
        this.colliders.push({ x, z, radius: 0.75 * scale });
      }
    });
  }

  private buildGardenProps(): void {
    // Cute colorful wheelbarrow in corner
    const barrow = new THREE.Group();
    barrow.position.set(-10.3, 0, 9.8);
    barrow.rotation.y = 0.65;

    const tubMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.45, metalness: 0.2 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.1 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8, metalness: 0.0 });

    const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.45, 0.55, 10), tubMat);
    tub.position.y = 0.55;
    tub.castShadow = true;
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 14), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(0, 0.28, 0.75);
    wheel.castShadow = true;
    const handleL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), woodMat);
    handleL.rotation.x = Math.PI / 2;
    handleL.position.set(-0.32, 0.52, -0.5);
    const handleR = handleL.clone();
    handleR.position.x = 0.32;
    barrow.add(tub, wheel, handleL, handleR);

    this.group.add(barrow);
    this.colliders.push({ x: -10.3, z: 9.8, radius: 1.05 });

    // Wooden sign / crate prop in opposite corner
    const crateGroup = new THREE.Group();
    crateGroup.position.set(10.5, 0, 10.2);
    crateGroup.rotation.y = -0.45;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 1.1), woodMat);
    crate.position.y = 0.425;
    crate.castShadow = true;
    crate.receiveShadow = true;
    const potMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.65 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.38, 12), potMat);
    pot.position.set(0, 1.04, 0);
    pot.castShadow = true;
    crateGroup.add(crate, pot);
    this.group.add(crateGroup);
    this.colliders.push({ x: 10.5, z: 10.2, radius: 0.95 });
  }

  private buildInstancedFlowers(): void {
    const count = 90;
    const petalGeo = new THREE.ConeGeometry(0.16, 0.12, 6);
    petalGeo.rotateX(Math.PI);
    const petalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
    const inst = new THREE.InstancedMesh(petalGeo, petalMat, count);
    inst.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const palette = [0xfef08a, 0xf472b6, 0x38bdf8, 0xfb923c, 0xffffff];
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      // Place flowers along fence borders and outer meadow
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.2;
      const dist = 13.6 + Math.random() * 14;
      dummy.position.set(Math.cos(angle) * dist, 0.15, Math.sin(angle) * dist);
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.scale.setScalar(0.8 + Math.random() * 0.55);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      color.setHex(palette[i % palette.length]);
      inst.setColorAt(i, color);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    this.group.add(inst);
  }

  private buildClouds(): void {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.0,
    });

    for (let i = 0; i < 6; i++) {
      const cloud = new THREE.Group();
      const p1 = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 10), cloudMat);
      const p2 = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 10), cloudMat);
      p2.position.set(1.3, -0.25, 0.1);
      const p3 = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), cloudMat);
      p3.position.set(-1.2, -0.3, -0.1);
      cloud.add(p1, p2, p3);
      cloud.position.set(-28 + i * 11, 14 + (i % 3) * 2.2, -26 - (i % 2) * 8);
      cloud.scale.setScalar(1.0 + (i % 3) * 0.25);
      this.group.add(cloud);
      this.clouds.push(cloud);
    }
  }

  public update(dt: number): void {
    for (const c of this.clouds) {
      c.position.x += dt * 0.9;
      if (c.position.x > 36) c.position.x = -36;
    }
  }

  public dispose(): void {
    this.meadowTexture?.dispose();
  }
}
