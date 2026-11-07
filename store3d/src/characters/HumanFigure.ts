import {
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  type Mesh,
  MathUtils,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  type Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mesh } from "../scene/build";
import { floralTexture } from "../scene/canvasArt";

export type FigureStyle = {
  skin: string;
  hair: string;
  hairStyle: "ponytail" | "bun";
  /** Hair tie colour (a scrunchie, naturally). */
  scrunchie: string;
  /** Pajama set: a ditsy floral print, or plain top/bottom colours. */
  outfit:
    | { kind: "print"; base: string; flower: string; leaf: string; trim: string }
    | { kind: "plain"; top: string; bottom: string; trim: string };
  longSleeves: boolean;
  slippers: string;
  apron?: string;
  /** Shop mannequin: smooth faceless head, no hair; only the outfit is "real". */
  mannequin?: boolean;
  /** Peter Pan collar (default on); off for round-neck sets. */
  collar?: boolean;
};

const HIP_Y = 0.72;

/** 0 → 1 → 0 once every 7 seconds (lift, hold, lower). */
function sipAmount(time: number): number {
  const t = time % 7;
  if (t > 2.2) return 0;
  return Math.sin((t / 2.2) * Math.PI) ** 0.6;
}

export type FigurePose = "crouch" | "sit";

/** Joint targets per pose (radians; body drop in metres). Hip < 0 swings the thigh forward. */
const POSES: Record<FigurePose, { hip: number; knee: number; drop: number; head: number; shoulder: number; elbow: number; reach: number }> = {
  // Kneeling down to stroke the cat: right hand reaches forward and low.
  crouch: { hip: -1.35, knee: 2.25, drop: 0.38, head: 0.38, shoulder: -0.35, elbow: -0.25, reach: -1.2 },
  // Sitting on a lounge chair, hands resting on the lap.
  sit: { hip: -1.45, knee: 1.45, drop: 0.24, head: 0.05, shoulder: -0.45, elbow: -0.75, reach: -0.45 },
};

/**
 * Stylised adult woman (~1.55 m) with soft, slightly big-headed proportions: gentle and cute,
 * still grown-up. Dressed in a KNG-style pajama set (Peter Pan collar, buttons, wide-leg pants).
 * Drives its own walk / idle / wave animation; the owner positions and rotates `root`.
 */
export class HumanFigure {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly head = new Group();
  private readonly legs: Array<{ hip: Group; knee: Group }> = [];
  private readonly arms: Array<{ shoulder: Group; elbow: Group; side: number }> = [];
  private readonly eyes: Group[] = [];
  private phase = 0;
  private time = Math.random() * 10;
  private waveTime = -1;
  private blinkIn = 2 + Math.random() * 2;
  private headYaw = 0;
  private lookTarget: Vector3 | null = null;
  private pose: FigurePose | null = null;
  /** The pose being blended (kept while blending back out). */
  private blendPose: FigurePose = "crouch";
  private poseBlend = 0;
  private cup: Group | null = null;
  private outfit: { top: MeshStandardMaterial; bottom: MeshStandardMaterial };

  constructor(style: FigureStyle) {
    this.root.name = "human";
    this.root.userData.animated = true;
    this.root.add(this.body);

    const skin = new MeshStandardMaterial({ color: style.skin, roughness: 0.7 });
    const hair = new MeshStandardMaterial({ color: style.hair, roughness: 0.55 });
    const { top, bottom, trim } = outfitMaterials(style.outfit);
    this.outfit = { top, bottom };

    this.buildLegs(bottom, new MeshStandardMaterial({ color: style.slippers, roughness: 0.95 }));
    this.buildTorso(top, bottom, trim, skin, style.collar ?? true);
    this.buildArms(top, skin, style.longSleeves);
    this.buildHead(skin, hair, style);
    if (style.apron) {
      const apron = new MeshStandardMaterial({ color: style.apron, roughness: 1 });
      mesh(new RoundedBoxGeometry(0.26, 0.42, 0.018, 2, 0.008), apron, [0, HIP_Y + 0.1, 0.118], this.body);
      const strap = mesh(new TorusGeometry(0.075, 0.007, 6, 20, Math.PI), apron, [0, HIP_Y + 0.31, 0.06], this.body);
      strap.rotation.x = -0.5;
    }
    this.root.traverse((child) => {
      child.castShadow = false;
      child.receiveShadow = false;
    });
  }

  /** Crouch / sit (blended in smoothly), or `null` to stand. */
  setPose(pose: FigurePose | null): void {
    this.pose = pose;
    if (pose) this.blendPose = pose;
  }

  /** A teacup in the right hand (sitting at the lounge); she sips from it now and then. */
  holdCup(visible: boolean): void {
    if (!this.cup) {
      const hand = this.arms.find((arm) => arm.side > 0)!.elbow;
      this.cup = new Group();
      const porcelain = new MeshStandardMaterial({ color: "#FBF7F0", roughness: 0.35 });
      const tea = new MeshStandardMaterial({ color: "#C99A5B", roughness: 0.3 });
      mesh(new CylinderGeometry(0.032, 0.024, 0.045, 16), porcelain, [0, 0, 0], this.cup);
      mesh(new CylinderGeometry(0.028, 0.028, 0.004, 16), tea, [0, 0.019, 0], this.cup);
      const handle = mesh(new TorusGeometry(0.013, 0.004, 6, 12), porcelain, [0.034, 0, 0], this.cup);
      handle.rotation.x = Math.PI / 2;
      this.cup.position.set(0, -0.24, 0.035);
      hand.add(this.cup);
      this.cup.traverse((child) => {
        child.castShadow = false;
      });
    }
    this.cup.visible = visible;
  }

  /** Dresses the set (top and bottom) in another fabric, e.g. one of the shop's own prints. */
  wear(fabric: MeshStandardMaterial): void {
    const { top, bottom } = this.outfit;
    this.root.traverse((child) => {
      const piece = child as Mesh;
      if (piece.material === top || piece.material === bottom) piece.material = fabric;
    });
    this.outfit = { top: fabric, bottom: fabric };
  }

  wave(): void {
    this.waveTime = 0;
  }

  /** Head turns (within a natural range) towards a world point; `null` relaxes it. */
  lookAt(target: Vector3 | null): void {
    this.lookTarget = target;
  }

  update(dt: number, speed: number): void {
    this.time += dt;
    const amount = MathUtils.clamp(speed / 1.4, 0, 1);
    this.phase += dt * (2.2 + speed * 4.6);
    const swing = Math.sin(this.phase) * 0.5 * amount;

    this.legs.forEach(({ hip, knee }, index) => {
      hip.rotation.x = index === 0 ? swing : -swing;
      knee.rotation.x = Math.max(0, Math.sin(this.phase + (index === 0 ? -1.4 : 1.74))) * 0.7 * amount;
    });
    // A light, springy step when walking; slow breathing and a little sway when idle.
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.03 * amount;
    this.body.rotation.z = Math.sin(this.time * 0.9) * 0.012 * (1 - amount);
    this.body.scale.y = 1 + Math.sin(this.time * 1.8) * 0.006 * (1 - amount);

    for (const arm of this.arms) {
      const s = arm.side < 0 ? -swing : swing;
      arm.shoulder.rotation.x = s * 0.75 + Math.sin(this.time * 1.1 + arm.side) * 0.03 * (1 - amount);
      arm.shoulder.rotation.z = arm.side * 0.14;
      arm.elbow.rotation.x = -0.2 - amount * 0.3;
      arm.elbow.rotation.z = 0;
    }
    this.animateWave(dt);
    this.animatePose(dt);
    this.animateHead(dt);
    this.animateBlink(dt);
  }

  private animatePose(dt: number): void {
    this.poseBlend = MathUtils.damp(this.poseBlend, this.pose ? 1 : 0, 6, dt);
    const k = this.poseBlend;
    if (k < 0.001) return;
    const target = POSES[this.blendPose];
    for (const { hip, knee } of this.legs) {
      hip.rotation.x = MathUtils.lerp(hip.rotation.x, target.hip, k);
      knee.rotation.x = MathUtils.lerp(knee.rotation.x, target.knee, k);
    }
    this.body.position.y = MathUtils.lerp(this.body.position.y, -target.drop, k);
    for (const arm of this.arms) {
      const reaching = arm.side > 0;
      // Stroking: the reaching hand moves gently back and forth.
      const stroke = reaching && this.blendPose === "crouch" ? Math.sin(this.time * 4) * 0.18 : 0;
      // Sipping: every ~7 s the cup hand comes up to the mouth for a moment.
      const sip = reaching && this.cup?.visible ? sipAmount(this.time) : 0;
      const shoulder = (reaching ? target.reach : target.shoulder) + stroke;
      arm.shoulder.rotation.x = MathUtils.lerp(arm.shoulder.rotation.x, MathUtils.lerp(shoulder, -1.25, sip), k);
      arm.shoulder.rotation.z = MathUtils.lerp(arm.shoulder.rotation.z, arm.side * (0.1 - 0.35 * sip), k);
      arm.elbow.rotation.x = MathUtils.lerp(arm.elbow.rotation.x, MathUtils.lerp(target.elbow, -2.05, sip), k);
    }
  }

  private animateWave(dt: number): void {
    if (this.waveTime < 0) return;
    this.waveTime += dt;
    const duration = 1.8;
    if (this.waveTime > duration) {
      this.waveTime = -1;
      return;
    }
    const blend = Math.min(1, this.waveTime / 0.3, (duration - this.waveTime) / 0.3);
    const arm = this.arms.find((a) => a.side > 0)!;
    arm.shoulder.rotation.z = MathUtils.lerp(0.14, 2.55, blend);
    arm.shoulder.rotation.x = 0;
    arm.elbow.rotation.x = 0;
    arm.elbow.rotation.z = MathUtils.lerp(0, 0.45 + Math.sin(this.waveTime * 12) * 0.35, blend);
    this.head.rotation.z = Math.sin(this.waveTime * 3) * 0.08 * blend;
  }

  private animateHead(dt: number): void {
    let targetYaw = 0;
    if (this.lookTarget) {
      const local = this.root.worldToLocal(this.lookTarget.clone());
      targetYaw = MathUtils.clamp(Math.atan2(local.x, local.z), -1.0, 1.0);
    }
    this.headYaw = MathUtils.damp(this.headYaw, targetYaw, 5, dt);
    this.head.rotation.y = this.headYaw;
    this.head.rotation.x = this.poseBlend * POSES[this.blendPose].head;
    if (this.waveTime < 0) this.head.rotation.z = Math.sin(this.time * 0.7) * 0.035;
  }

  private animateBlink(dt: number): void {
    this.blinkIn -= dt;
    const closed = this.blinkIn < 0.11;
    for (const eye of this.eyes) eye.scale.y = closed ? 0.12 : 1;
    if (this.blinkIn < 0) this.blinkIn = 2.4 + Math.random() * 3;
  }

  private buildLegs(pants: MeshStandardMaterial, slippers: MeshStandardMaterial): void {
    for (const side of [-1, 1]) {
      const hip = new Group();
      hip.position.set(side * 0.075, HIP_Y, 0);
      this.body.add(hip);
      mesh(new CylinderGeometry(0.074, 0.068, 0.34, 16), pants, [0, -0.17, 0], hip);
      const knee = new Group();
      knee.position.y = -0.34;
      hip.add(knee);
      // Wide-leg pajama pants flare a little at the hem.
      mesh(new CylinderGeometry(0.068, 0.08, 0.31, 16), pants, [0, -0.155, 0], knee);
      mesh(new RoundedBoxGeometry(0.09, 0.05, 0.19, 2, 0.024), slippers, [0, -0.345, 0.03], knee);
      this.legs.push({ hip, knee });
    }
  }

  private buildTorso(top: MeshStandardMaterial, bottom: MeshStandardMaterial, trim: MeshStandardMaterial, skin: MeshStandardMaterial, collar: boolean): void {
    const pelvis = [[0, 0], [0.135, 0], [0.15, 0.06], [0.142, 0.12], [0, 0.14]].map(([r, y]) => new Vector2(r, y));
    mesh(new LatheGeometry(pelvis, 24), bottom, [0, HIP_Y - 0.06, 0], this.body).scale.z = 0.8;

    // Pajama top with a soft flared hem, cinched waist and rounded shoulders.
    const shirt = [
      [0, 0], [0.165, 0], [0.156, 0.06], [0.136, 0.16], [0.14, 0.26], [0.15, 0.33], [0.145, 0.38], [0.1, 0.42], [0.055, 0.44], [0, 0.44],
    ].map(([r, y]) => new Vector2(r, y));
    mesh(new LatheGeometry(shirt, 28), top, [0, HIP_Y - 0.04, 0], this.body).scale.z = 0.78;
    const hem = mesh(new TorusGeometry(0.163, 0.008, 6, 32), trim, [0, HIP_Y - 0.036, 0], this.body);
    hem.rotation.x = Math.PI / 2;
    hem.scale.y = 0.78;

    // Peter Pan collar (cổ sen), the shop's signature, plus three buttons.
    for (const side of collar ? [-1, 1] : []) {
      const leaf = mesh(new SphereGeometry(0.05, 16, 10), trim, [side * 0.042, HIP_Y + 0.385, 0.08], this.body);
      leaf.scale.set(1.15, 0.24, 0.9);
      leaf.rotation.z = side * -0.28;
      leaf.rotation.x = 0.35;
    }
    for (const [i, y] of [0.3, 0.22, 0.14].entries()) {
      mesh(new SphereGeometry(0.009, 8, 6), trim, [0, HIP_Y + y, 0.113 - i * 0.003], this.body);
    }
    mesh(new CylinderGeometry(0.036, 0.04, 0.09, 12), skin, [0, HIP_Y + 0.44, 0], this.body);
  }

  private buildArms(top: MeshStandardMaterial, skin: MeshStandardMaterial, longSleeves: boolean): void {
    for (const side of [-1, 1]) {
      const shoulder = new Group();
      shoulder.position.set(side * 0.152, HIP_Y + 0.355, 0);
      this.body.add(shoulder);
      mesh(new SphereGeometry(0.06, 14, 10), top, [0, -0.03, 0], shoulder).scale.set(1, 1.15, 0.95);
      mesh(new CapsuleGeometry(0.033, 0.14, 4, 10), longSleeves ? top : skin, [0, -0.12, 0], shoulder);
      const elbow = new Group();
      elbow.position.y = -0.235;
      shoulder.add(elbow);
      mesh(new CapsuleGeometry(0.03, 0.14, 4, 10), longSleeves ? top : skin, [0, -0.09, 0], elbow);
      mesh(new SphereGeometry(0.034, 12, 8), skin, [0, -0.2, 0.004], elbow).scale.set(0.85, 1.1, 0.7);
      this.arms.push({ shoulder, elbow, side });
    }
  }

  private buildHead(skin: MeshStandardMaterial, hair: MeshStandardMaterial, style: FigureStyle): void {
    this.head.position.set(0, HIP_Y + 0.62, 0);
    this.body.add(this.head);
    if (style.mannequin) {
      // A smooth egg-shaped head, like a boutique mannequin.
      mesh(new SphereGeometry(0.13, 32, 24), skin, [0, 0, 0], this.head).scale.set(0.9, 1.08, 0.92);
      return;
    }
    mesh(new SphereGeometry(0.14, 32, 24), skin, [0, 0, 0], this.head).scale.set(0.96, 1, 0.94);
    this.buildFace(skin, hair);

    // Hair: crown, back volume, soft bangs and face-framing strands.
    const crown = mesh(new SphereGeometry(0.152, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.58), hair, [0, 0.012, -0.012], this.head);
    crown.rotation.x = -0.55;
    mesh(new SphereGeometry(0.145, 28, 20), hair, [0, -0.02, -0.035], this.head).scale.set(1.02, 1, 0.92);
    for (let i = -2; i <= 2; i += 1) {
      const a = i * 0.33;
      const bang = mesh(new SphereGeometry(0.05, 14, 10), hair, [Math.sin(a) * 0.118, 0.074 - Math.abs(i) * 0.014, Math.cos(a) * 0.112 - 0.004], this.head);
      bang.scale.set(0.9, 0.62, 0.42);
      bang.rotation.set(0.2, a, -i * 0.15);
    }
    for (const side of [-1, 1]) {
      const lock = mesh(new CapsuleGeometry(0.024, 0.15, 4, 10), hair, [side * 0.132, -0.065, 0.005], this.head);
      lock.rotation.z = side * 0.12;
    }

    const tie = new MeshStandardMaterial({ color: style.scrunchie, roughness: 1 });
    if (style.hairStyle === "ponytail") {
      const scrunchie = mesh(new TorusGeometry(0.034, 0.017, 10, 18), tie, [0, -0.07, -0.142], this.head);
      scrunchie.rotation.x = 0.6;
      const tail = mesh(new CapsuleGeometry(0.048, 0.2, 6, 12), hair, [0, -0.2, -0.17], this.head);
      tail.rotation.x = 0.25;
      tail.scale.z = 0.8;
      tail.userData.animated = true;
    } else {
      mesh(new SphereGeometry(0.068, 18, 14), hair, [0, -0.025, -0.16], this.head);
      const scrunchie = mesh(new TorusGeometry(0.05, 0.016, 10, 20), tie, [0, -0.03, -0.112], this.head);
      scrunchie.rotation.x = 0.1;
    }
  }

  private buildFace(skin: MeshStandardMaterial, hair: MeshStandardMaterial): void {
    const iris = new MeshBasicMaterial({ color: "#3B2C27" });
    const shine = new MeshBasicMaterial({ color: "#FFFFFF" });
    for (const side of [-1, 1]) {
      const eye = new Group();
      eye.position.set(side * 0.05, -0.01, 0.122);
      this.head.add(eye);
      mesh(new SphereGeometry(0.021, 14, 12), iris, [0, 0, 0], eye).scale.set(0.85, 1.2, 0.45);
      mesh(new SphereGeometry(0.007, 8, 6), shine, [0.006, 0.009, 0.008], eye);
      mesh(new SphereGeometry(0.0038, 6, 4), shine, [-0.005, -0.009, 0.008], eye);
      const lash = mesh(new CapsuleGeometry(0.0035, 0.016, 2, 6), iris, [side * 0.018, 0.017, -0.002], eye);
      lash.rotation.z = side * -1.05;
      this.eyes.push(eye);

      const brow = mesh(new CapsuleGeometry(0.0034, 0.028, 2, 6), hair, [side * 0.05, 0.05, 0.126], this.head);
      brow.rotation.z = Math.PI / 2 + side * 0.12;
      const blush = mesh(
        new SphereGeometry(0.025, 12, 8),
        new MeshBasicMaterial({ color: "#F2A7A0", transparent: true, opacity: 0.45, depthWrite: false }),
        [side * 0.083, -0.05, 0.106],
        this.head,
      );
      blush.scale.set(1, 0.55, 0.25);
    }
    mesh(new SphereGeometry(0.01, 10, 8), skin, [0, -0.03, 0.134], this.head).scale.set(1, 0.8, 0.7);
    const smile = mesh(new TorusGeometry(0.014, 0.0034, 6, 14, Math.PI), new MeshBasicMaterial({ color: "#C9827A" }), [0, -0.064, 0.128], this.head);
    smile.rotation.z = Math.PI;
  }

  dispose(): void {
    this.root.traverse((child) => {
      const target = child as { geometry?: { dispose(): void }; material?: { dispose(): void } };
      target.geometry?.dispose();
      target.material?.dispose();
    });
  }
}

function outfitMaterials(outfit: FigureStyle["outfit"]): {
  top: MeshStandardMaterial;
  bottom: MeshStandardMaterial;
  trim: MeshStandardMaterial;
} {
  const trim = new MeshStandardMaterial({ color: outfit.trim, roughness: 0.9 });
  if (outfit.kind === "print") {
    const map = floralTexture(outfit.base, outfit.flower, outfit.leaf);
    map.repeat.set(3, 3);
    const fabric = new MeshStandardMaterial({ map, roughness: 0.95 });
    return { top: fabric, bottom: fabric, trim };
  }
  return {
    top: new MeshStandardMaterial({ color: outfit.top, roughness: 0.95 }),
    bottom: new MeshStandardMaterial({ color: outfit.bottom, roughness: 0.95 }),
    trim,
  };
}
