import * as THREE from 'three';
import { SkinConfig } from './shop';

export type PlayerAnimState = 'idle' | 'run' | 'squat' | 'pop' | 'victory' | 'gameover';

export class CabolPlayer {
  public readonly group = new THREE.Group();
  public readonly position = this.group.position;
  public radius = 0.58;

  private bodyPivot = new THREE.Group();
  private hipGroup = new THREE.Group();
  private torsoGroup = new THREE.Group();
  private headGroup = new THREE.Group();
  private leftArmPivot = new THREE.Group();
  private rightArmPivot = new THREE.Group();
  private leftLegPivot = new THREE.Group();
  private rightLegPivot = new THREE.Group();
  private hatAnchor = new THREE.Group();

  // Expressive facial features
  private leftPupil!: THREE.Mesh;
  private rightPupil!: THREE.Mesh;
  private leftBrow!: THREE.Mesh;
  private rightBrow!: THREE.Mesh;
  private mouthMesh!: THREE.Mesh;
  private leftCheek!: THREE.Mesh;
  private rightCheek!: THREE.Mesh;
  private sweatDrop!: THREE.Mesh;

  // Materials updated dynamically by skin
  private shirtMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.72, metalness: 0.02 });
  private pantsMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.88, metalness: 0.0 });
  private beltMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.5, metalness: 0.1 });
  private buckleMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.22, metalness: 0.85 });
  private shoeMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.45, metalness: 0.08 });
  private skinMat = new THREE.MeshStandardMaterial({ color: 0xffcfa3, roughness: 0.6, metalness: 0.0 });
  private gloveMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55, metalness: 0.02 });
  private eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.0 });
  private darkMat = new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 0.3, metalness: 0.05 });
  private cheekMat = new THREE.MeshStandardMaterial({ color: 0xfb7185, roughness: 0.65, metalness: 0.0 });

  // Animation state
  public yaw = 0;
  public animState: PlayerAnimState = 'idle';
  private animTime = 0;
  private squatTimer = 0;
  private popTimer = 0;
  private blinkTimer = 2.5;
  private squashY = 1;
  private squashXZ = 1;

  constructor(initialSkin: SkinConfig) {
    this.buildCharacter();
    this.applySkin(initialSkin);
  }

  private buildCharacter(): void {
    // Contact shadow disc grounded at y = 0.02
    const shadowGeo = new THREE.CircleGeometry(0.68, 24);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x052e16,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.position.y = 0.02;
    this.group.add(contactShadow);

    this.group.add(this.bodyPivot);

    // 1. LEGS & CHUNKY BOOTS (pivoted at hip socket y = 0.56)
    const buildLeg = (side: -1 | 1): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.24, 0.56, 0);

      const thighGeo = new THREE.CapsuleGeometry(0.16, 0.2, 6, 12);
      const thigh = new THREE.Mesh(thighGeo, this.pantsMat);
      thigh.position.y = -0.18;
      thigh.castShadow = true;
      pivot.add(thigh);

      // Chunky cartoon shoe
      const shoeGroup = new THREE.Group();
      shoeGroup.position.set(0, -0.44, 0.07);

      const shoeSole = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.38), this.darkMat);
      shoeSole.position.y = -0.04;
      shoeSole.castShadow = true;
      shoeGroup.add(shoeSole);

      const shoeUpper = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), this.shoeMat);
      shoeUpper.scale.set(0.85, 0.72, 1.32);
      shoeUpper.position.set(0, 0.03, 0.02);
      shoeUpper.castShadow = true;
      shoeGroup.add(shoeUpper);

      pivot.add(shoeGroup);
      return pivot;
    };

    this.leftLegPivot = buildLeg(-1);
    this.rightLegPivot = buildLeg(1);
    this.bodyPivot.add(this.leftLegPivot, this.rightLegPivot);

    // 2. HIP / THICK PADDED CARTOON PANTS GROUP (comedic center of gravity!)
    this.hipGroup.position.set(0, 0.66, 0);
    this.bodyPivot.add(this.hipGroup);

    // Main trouser pelvis cylinder
    const pelvisGeo = new THREE.CylinderGeometry(0.42, 0.44, 0.36, 18);
    const pelvis = new THREE.Mesh(pelvisGeo, this.pantsMat);
    pelvis.castShadow = true;
    pelvis.receiveShadow = true;
    this.hipGroup.add(pelvis);

    // Comedic plump padded cartoon pant-seat (strictly clothed thick trousers!)
    const cushionGeo = new THREE.SphereGeometry(0.28, 16, 14);
    const leftCushion = new THREE.Mesh(cushionGeo, this.pantsMat);
    leftCushion.position.set(-0.19, -0.02, -0.24);
    leftCushion.scale.set(1.02, 0.96, 1.15);
    leftCushion.castShadow = true;
    leftCushion.receiveShadow = true;

    const rightCushion = new THREE.Mesh(cushionGeo, this.pantsMat);
    rightCushion.position.set(0.19, -0.02, -0.24);
    rightCushion.scale.set(1.02, 0.96, 1.15);
    rightCushion.castShadow = true;
    rightCushion.receiveShadow = true;

    // Thick stitched pocket patches on back of pants for extra playful cartoon charm
    const pocketGeo = new THREE.BoxGeometry(0.16, 0.16, 0.04);
    const leftPocket = new THREE.Mesh(pocketGeo, this.beltMat);
    leftPocket.position.set(-0.2, 0.0, -0.52);
    leftPocket.rotation.y = 0.25;
    const rightPocket = new THREE.Mesh(pocketGeo, this.beltMat);
    rightPocket.position.set(0.2, 0.0, -0.52);
    rightPocket.rotation.y = -0.25;

    // Belt + Shiny Gold Buckle
    const beltGeo = new THREE.CylinderGeometry(0.435, 0.435, 0.1, 18);
    const belt = new THREE.Mesh(beltGeo, this.beltMat);
    belt.position.y = 0.16;
    belt.castShadow = true;

    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.13, 0.08), this.buckleMat);
    buckle.position.set(0, 0.16, 0.42);
    buckle.castShadow = true;

    this.hipGroup.add(leftCushion, rightCushion, leftPocket, rightPocket, belt, buckle);

    // 3. TORSO GROUP (attached above hips)
    this.torsoGroup.position.set(0, 0.22, 0);
    this.hipGroup.add(this.torsoGroup);

    const chestGeo = new THREE.CapsuleGeometry(0.35, 0.34, 8, 16);
    const chest = new THREE.Mesh(chestGeo, this.shirtMat);
    chest.position.y = 0.32;
    chest.scale.set(1.06, 1, 0.96);
    chest.castShadow = true;
    chest.receiveShadow = true;
    this.torsoGroup.add(chest);

    // Collar ring
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.055, 8, 16), this.gloveMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.62;
    this.torsoGroup.add(collar);

    // 4. ARMS & CARTOON GLOVED HANDS
    const buildArm = (side: -1 | 1): THREE.Group => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.44, 0.48, 0);

      const sleeve = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), this.shirtMat);
      sleeve.castShadow = true;
      pivot.add(sleeve);

      const armMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.26, 6, 10), this.skinMat);
      armMesh.position.set(side * 0.06, -0.2, 0.04);
      armMesh.rotation.z = side * 0.18;
      armMesh.castShadow = true;
      pivot.add(armMesh);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), this.gloveMat);
      hand.position.set(side * 0.1, -0.4, 0.08);
      hand.castShadow = true;
      pivot.add(hand);

      return pivot;
    };

    this.leftArmPivot = buildArm(-1);
    this.rightArmPivot = buildArm(1);
    this.torsoGroup.add(this.leftArmPivot, this.rightArmPivot);

    // 5. OVERSIZED EXPRESSIVE HEAD
    this.headGroup.position.set(0, 0.72, 0.02);
    this.torsoGroup.add(this.headGroup);

    const headSphere = new THREE.Mesh(new THREE.SphereGeometry(0.44, 20, 18), this.skinMat);
    headSphere.position.y = 0.32;
    headSphere.scale.set(1.06, 0.96, 1.02);
    headSphere.castShadow = true;
    headSphere.receiveShadow = true;
    this.headGroup.add(headSphere);

    // Big button nose
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), this.cheekMat);
    nose.position.set(0, 0.28, 0.44);
    nose.scale.set(1.1, 0.85, 0.9);
    this.headGroup.add(nose);

    // Ears
    const earGeo = new THREE.SphereGeometry(0.11, 10, 10);
    const leftEar = new THREE.Mesh(earGeo, this.skinMat);
    leftEar.position.set(-0.44, 0.3, 0);
    const rightEar = new THREE.Mesh(earGeo, this.skinMat);
    rightEar.position.set(0.44, 0.3, 0);
    this.headGroup.add(leftEar, rightEar);

    // Rosy cartoon cheeks
    const cheekGeo = new THREE.SphereGeometry(0.085, 10, 8);
    this.leftCheek = new THREE.Mesh(cheekGeo, this.cheekMat);
    this.leftCheek.position.set(-0.26, 0.21, 0.36);
    this.leftCheek.scale.set(1.2, 0.7, 0.5);
    this.rightCheek = new THREE.Mesh(cheekGeo, this.cheekMat);
    this.rightCheek.position.set(0.26, 0.21, 0.36);
    this.rightCheek.scale.set(1.2, 0.7, 0.5);
    this.headGroup.add(this.leftCheek, this.rightCheek);

    // Googly Eyes
    const eyeScleraGeo = new THREE.SphereGeometry(0.115, 12, 10);
    const leftEye = new THREE.Mesh(eyeScleraGeo, this.eyeWhiteMat);
    leftEye.position.set(-0.16, 0.38, 0.37);
    leftEye.scale.set(0.95, 1.15, 0.7);
    const rightEye = new THREE.Mesh(eyeScleraGeo, this.eyeWhiteMat);
    rightEye.position.set(0.16, 0.38, 0.37);
    rightEye.scale.set(0.95, 1.15, 0.7);

    const pupilGeo = new THREE.SphereGeometry(0.055, 10, 8);
    this.leftPupil = new THREE.Mesh(pupilGeo, this.darkMat);
    this.leftPupil.position.set(-0.15, 0.38, 0.44);
    this.rightPupil = new THREE.Mesh(pupilGeo, this.darkMat);
    this.rightPupil.position.set(0.15, 0.38, 0.44);

    // Thick Expressive Eyebrows
    const browGeo = new THREE.BoxGeometry(0.17, 0.045, 0.05);
    this.leftBrow = new THREE.Mesh(browGeo, this.darkMat);
    this.leftBrow.position.set(-0.16, 0.52, 0.41);
    this.rightBrow = new THREE.Mesh(browGeo, this.darkMat);
    this.rightBrow.position.set(0.16, 0.52, 0.41);

    // Mouth (morphs via scale for O-strain / grin / frown)
    this.mouthMesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), this.darkMat);
    this.mouthMesh.position.set(0, 0.14, 0.4);
    this.mouthMesh.scale.set(1.2, 0.5, 0.5);

    // Funny comic sweat drop (visible during intense squat pull!)
    const sweatMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.15,
      metalness: 0.1,
    });
    this.sweatDrop = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.13, 8), sweatMat);
    this.sweatDrop.position.set(0.38, 0.52, 0.25);
    this.sweatDrop.rotation.z = -0.35;
    this.sweatDrop.visible = false;

    this.headGroup.add(
      leftEye,
      rightEye,
      this.leftPupil,
      this.rightPupil,
      this.leftBrow,
      this.rightBrow,
      this.mouthMesh,
      this.sweatDrop,
    );

    // Hat anchor on top of head
    this.hatAnchor.position.set(0, 0.66, 0);
    this.headGroup.add(this.hatAnchor);
  }

  public applySkin(skin: SkinConfig): void {
    this.shirtMat.color.setHex(skin.shirtColor);
    this.pantsMat.color.setHex(skin.pantsColor);
    this.beltMat.color.setHex(skin.beltColor);
    this.shoeMat.color.setHex(skin.shoeColor);
    this.skinMat.color.setHex(skin.skinTone);

    // Clear previous hat
    while (this.hatAnchor.children.length > 0) {
      const child = this.hatAnchor.children.pop()!;
      child.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    }

    const hatMat = new THREE.MeshStandardMaterial({ color: skin.hatColor, roughness: 0.65, metalness: 0.05 });
    const bandMat = new THREE.MeshStandardMaterial({ color: skin.beltColor, roughness: 0.5, metalness: 0.15 });

    if (skin.hatType === 'straw') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.72, 0.06, 20), hatMat);
      brim.castShadow = true;
      const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.24, 18), hatMat);
      dome.position.y = 0.14;
      dome.castShadow = true;
      const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.425, 0.43, 0.07, 18), bandMat);
      ribbon.position.y = 0.06;
      this.hatAnchor.add(brim, dome, ribbon);
    } else if (skin.hatType === 'headband') {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.065, 8, 20), hatMat);
      band.rotation.x = Math.PI / 2;
      band.position.y = -0.15;
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), hatMat);
      knot.position.set(0, -0.15, -0.45);
      const tail1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.03), hatMat);
      tail1.position.set(-0.08, -0.25, -0.5);
      tail1.rotation.set(0.3, 0, -0.35);
      const tail2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.03), hatMat);
      tail2.position.set(0.08, -0.24, -0.5);
      tail2.rotation.set(0.3, 0, 0.35);
      this.hatAnchor.add(band, knot, tail1, tail2);
    } else if (skin.hatType === 'frog') {
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hatMat);
      hood.position.y = -0.25;
      hood.castShadow = true;
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), hatMat);
      eyeL.position.set(-0.24, 0.14, 0.18);
      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), hatMat);
      eyeR.position.set(0.24, 0.14, 0.18);
      const wL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), this.eyeWhiteMat);
      wL.position.set(-0.24, 0.16, 0.26);
      const wR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), this.eyeWhiteMat);
      wR.position.set(0.24, 0.16, 0.26);
      const pL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), this.darkMat);
      pL.position.set(-0.24, 0.16, 0.32);
      const pR = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), this.darkMat);
      pR.position.set(0.24, 0.16, 0.32);
      this.hatAnchor.add(hood, eyeL, eyeR, wL, wR, pL, pR);
    } else if (skin.hatType === 'helmet') {
      const visorMat = new THREE.MeshStandardMaterial({
        color: skin.hatColor,
        roughness: 0.12,
        metalness: 0.35,
        transparent: true,
        opacity: 0.45,
      });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.56, 20, 16), visorMat);
      dome.position.y = -0.32;
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.26, 8), this.buckleMat);
      antenna.position.set(0, 0.32, 0);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), hatMat);
      tip.position.set(0, 0.46, 0);
      this.hatAnchor.add(dome, antenna, tip);
    } else if (skin.hatType === 'crown') {
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2, metalness: 0.85 });
      const gemMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.15, metalness: 0.2 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.18, 12), crownMat);
      base.position.y = 0.08;
      base.castShadow = true;
      this.hatAnchor.add(base);
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 6), crownMat);
        spike.position.set(Math.cos(ang) * 0.2, 0.24, Math.sin(ang) * 0.2);
        this.hatAnchor.add(spike);
      }
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), gemMat);
      gem.position.set(0, 0.1, 0.24);
      this.hatAnchor.add(gem);
    }
  }

  public triggerSquat(): void {
    this.animState = 'squat';
    this.squatTimer = 0.28;
    this.squashY = 0.72;
    this.squashXZ = 1.24;
  }

  public triggerPop(): void {
    this.animState = 'pop';
    this.popTimer = 0.32;
    this.squashY = 1.28;
    this.squashXZ = 0.82;
  }

  public update(dt: number, isMoving: boolean, moveSpeedRatio: number, gameMode: 'menu' | 'playing' | 'paused' | 'victory' | 'gameover'): void {
    this.animTime += dt;

    // Eye blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      if (this.blinkTimer < -0.1) this.blinkTimer = 2.2 + Math.random() * 2.5;
    }
    const isBlinking = this.blinkTimer < 0;
    const eyeScaleY = isBlinking ? 0.12 : 1.0;

    if (gameMode === 'victory') {
      this.animState = 'victory';
    } else if (gameMode === 'gameover') {
      this.animState = 'gameover';
    } else if (this.squatTimer > 0) {
      this.squatTimer -= dt;
      this.animState = 'squat';
      if (this.squatTimer <= 0) {
        this.animState = isMoving ? 'run' : 'idle';
      }
    } else if (this.popTimer > 0) {
      this.popTimer -= dt;
      this.animState = 'pop';
      if (this.popTimer <= 0) {
        this.animState = isMoving ? 'run' : 'idle';
      }
    } else {
      this.animState = isMoving ? 'run' : 'idle';
    }

    // Smooth squash & stretch recovery
    this.squashY = THREE.MathUtils.damp(this.squashY, 1.0, 14, dt);
    this.squashXZ = THREE.MathUtils.damp(this.squashXZ, 1.0, 14, dt);

    // Defaults
    let targetBodyY = 0;
    let hipRotZ = 0;
    let hipRotX = 0;
    let hipScaleZ = 1;
    let torsoRotX = 0;
    let leftArmX = 0;
    let rightArmX = 0;
    let leftArmZ = 0.18;
    let rightArmZ = -0.18;
    let leftLegX = 0;
    let rightLegX = 0;
    let browAngle = 0;
    let mouthScaleX = 1.1;
    let mouthScaleY = 0.45;
    this.sweatDrop.visible = false;

    const t = this.animTime;

    if (this.animState === 'idle') {
      targetBodyY = Math.sin(t * 3.2) * 0.03;
      hipRotZ = Math.sin(t * 1.8) * 0.05;
      leftArmZ = 0.22 + Math.sin(t * 3.2) * 0.04;
      rightArmZ = -0.22 - Math.sin(t * 3.2) * 0.04;
    } else if (this.animState === 'run') {
      const freq = 12 + moveSpeedRatio * 4;
      const swing = Math.sin(t * freq);
      targetBodyY = Math.abs(Math.cos(t * freq)) * 0.12;
      hipRotZ = swing * 0.12;
      torsoRotX = 0.16;
      leftLegX = swing * 0.72;
      rightLegX = -swing * 0.72;
      leftArmX = -swing * 0.85;
      rightArmX = swing * 0.85;
      leftArmZ = 0.28;
      rightArmZ = -0.28;
      mouthScaleX = 1.3;
      mouthScaleY = 0.75;
    } else if (this.animState === 'squat') {
      // HILARIOUS DEEP SQUAT & HIP-WIGGLE PULL!
      const wiggle = Math.sin(t * 38);
      targetBodyY = -0.26;
      hipRotZ = wiggle * 0.24;
      hipRotX = 0.25;
      hipScaleZ = 1.24 + Math.abs(wiggle) * 0.1;
      torsoRotX = 0.42;
      leftLegX = -0.65;
      rightLegX = -0.65;
      leftArmX = -0.95;
      rightArmX = -0.95;
      leftArmZ = 0.52;
      rightArmZ = -0.52;
      browAngle = 0.35; // Furious determination!
      mouthScaleX = 0.85;
      mouthScaleY = 1.25; // Big funny "OOO!" strain mouth
      this.sweatDrop.visible = true;
      this.sweatDrop.position.y = 0.52 + Math.sin(t * 25) * 0.03;
    } else if (this.animState === 'pop') {
      // Triumphant recoil hop after popping grass out!
      const hop = Math.sin((this.popTimer / 0.32) * Math.PI);
      targetBodyY = hop * 0.48;
      torsoRotX = -0.22;
      leftArmX = -2.2;
      rightArmX = -2.2;
      leftArmZ = 0.45;
      rightArmZ = -0.45;
      browAngle = -0.25;
      mouthScaleX = 1.65;
      mouthScaleY = 1.15;
    } else if (this.animState === 'victory') {
      targetBodyY = Math.abs(Math.sin(t * 7)) * 0.42;
      hipRotZ = Math.sin(t * 10) * 0.22;
      leftArmX = -2.4 + Math.sin(t * 12) * 0.35;
      rightArmX = -2.4 - Math.sin(t * 12) * 0.35;
      leftLegX = Math.sin(t * 7) * 0.35;
      rightLegX = -Math.sin(t * 7) * 0.35;
      mouthScaleX = 1.7;
      mouthScaleY = 1.2;
      this.group.rotation.y += dt * 2.2;
    } else if (this.animState === 'gameover') {
      targetBodyY = -0.12;
      torsoRotX = 0.32;
      this.headGroup.rotation.z = Math.sin(t * 5) * 0.14;
      leftArmZ = 0.12;
      rightArmZ = -0.12;
      browAngle = -0.3;
      mouthScaleX = 1.2;
      mouthScaleY = 0.28;
    }

    if (this.animState !== 'victory') {
      // Smoothly interpolate character facing yaw
      const currentYaw = this.group.rotation.y;
      let diff = this.yaw - currentYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.group.rotation.y = currentYaw + diff * Math.min(1, dt * 15);
      this.headGroup.rotation.z = THREE.MathUtils.damp(this.headGroup.rotation.z, 0, 10, dt);
    }

    this.bodyPivot.position.y = THREE.MathUtils.damp(this.bodyPivot.position.y, targetBodyY, 18, dt);
    this.bodyPivot.scale.set(this.squashXZ, this.squashY, this.squashXZ);

    this.hipGroup.rotation.z = THREE.MathUtils.damp(this.hipGroup.rotation.z, hipRotZ, 20, dt);
    this.hipGroup.rotation.x = THREE.MathUtils.damp(this.hipGroup.rotation.x, hipRotX, 18, dt);
    this.hipGroup.scale.z = THREE.MathUtils.damp(this.hipGroup.scale.z, hipScaleZ, 18, dt);

    this.torsoGroup.rotation.x = THREE.MathUtils.damp(this.torsoGroup.rotation.x, torsoRotX, 16, dt);

    this.leftArmPivot.rotation.x = THREE.MathUtils.damp(this.leftArmPivot.rotation.x, leftArmX, 18, dt);
    this.rightArmPivot.rotation.x = THREE.MathUtils.damp(this.rightArmPivot.rotation.x, rightArmX, 18, dt);
    this.leftArmPivot.rotation.z = THREE.MathUtils.damp(this.leftArmPivot.rotation.z, leftArmZ, 16, dt);
    this.rightArmPivot.rotation.z = THREE.MathUtils.damp(this.rightArmPivot.rotation.z, rightArmZ, 16, dt);

    this.leftLegPivot.rotation.x = THREE.MathUtils.damp(this.leftLegPivot.rotation.x, leftLegX, 18, dt);
    this.rightLegPivot.rotation.x = THREE.MathUtils.damp(this.rightLegPivot.rotation.x, rightLegX, 18, dt);

    // Facial expressions
    this.leftPupil.scale.y = eyeScaleY;
    this.rightPupil.scale.y = eyeScaleY;
    this.leftBrow.rotation.z = THREE.MathUtils.damp(this.leftBrow.rotation.z, -browAngle, 16, dt);
    this.rightBrow.rotation.z = THREE.MathUtils.damp(this.rightBrow.rotation.z, browAngle, 16, dt);
    this.mouthMesh.scale.x = THREE.MathUtils.damp(this.mouthMesh.scale.x, mouthScaleX, 16, dt);
    this.mouthMesh.scale.y = THREE.MathUtils.damp(this.mouthMesh.scale.y, mouthScaleY, 16, dt);
  }
}
