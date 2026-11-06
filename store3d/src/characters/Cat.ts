import {
  CapsuleGeometry,
  ConeGeometry,
  Group,
  MathUtils,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
} from "three";
import { CAT_ROUTE, CAT_SEAT } from "../config/layout";
import { palette } from "../config/palette";
import { mesh } from "../scene/build";
import { labelTexture } from "../scene/canvasArt";
import type { CatSounds } from "../audio/SoundBoard";
import { blobShadow, nameTag } from "./props";
import type { YarnBall } from "./YarnBall";

type CatState = "walk" | "rest" | "petted" | "play";
/** What Min does while resting at a stop. */
type Activity = "sit" | "loaf" | "groom" | "roll";

/** An unhurried stroll. */
const WALK_SPEED = 0.3;
const POUNCE_SPEED = 0.85;
const PET_DURATION = 3.6;
const BODY_HEIGHT = 0.19;
/** Seconds between Min's occasional soft meows. */
const MEOW_EVERY: readonly [number, number] = [14, 30];
const PLAY_COOLDOWN = 35;

/** What Min needs from the shop: her toy and a voice. */
export type CatSurroundings = {
  ball: YarnBall | null;
  sounds: CatSounds | null;
};

/**
 * Min, the white shop cat. Walks the full shop loop from her window seat; at each stop she sits,
 * loafs, grooms or rolls about; now and then she chases her yarn ball. Petting makes her roll onto
 * her back and purr.
 */
export class Cat {
  readonly root = new Group();
  private readonly pose = new Group();
  private readonly head = new Group();
  private readonly legs: Group[] = [];
  private readonly tail: Group[] = [];
  private readonly tag = nameTag("Min", 0.5);
  private readonly heart: Sprite;
  private state: CatState = "rest";
  private activity: Activity = "loaf";
  private waypoint = 0;
  private restLeft = 25; // starts the visit napping in her bed
  private time = 0;
  private yaw = 0;
  private heartTime = -1;
  private rollSide = 1;
  private meowIn = 8;
  private playCooldown = 12;
  private bats = 0;
  private swipe = -1;
  private playLeft = 0;
  // Smoothed pose weights (0–1).
  private sit = 1;
  private loaf = 0;
  private groom = 0;
  private roll = 0;

  constructor(private readonly surroundings: CatSurroundings = { ball: null, sounds: null }) {
    this.root.userData.animated = true;
    this.root.add(this.pose, blobShadow(0.55), this.tag);
    this.tag.position.y = 0.62;
    this.build();
    const start = CAT_ROUTE[0]!;
    this.root.position.set(start.x, 0, start.z);
    this.heart = new Sprite(
      new SpriteMaterial({
        map: labelTexture("♥", { width: 128, height: 128, color: "#D98C8C", font: "96px Georgia, serif" }),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.heart.scale.set(0.18, 0.18, 1);
    this.root.add(this.heart);
  }

  get x(): number {
    return this.root.position.x;
  }

  get z(): number {
    return this.root.position.z;
  }

  get petDuration(): number {
    return PET_DURATION;
  }

  /** Belly up, purring, hearts. */
  pet(): void {
    this.state = "petted";
    this.activity = "roll";
    this.rollSide = Math.random() < 0.5 ? -1 : 1;
    this.restLeft = PET_DURATION;
    this.heartTime = 0;
    this.surroundings.sounds?.meow(0.45);
    this.surroundings.sounds?.purr(PET_DURATION);
  }

  update(dt: number, guest: { x: number; z: number }): void {
    this.time += dt;
    this.playCooldown -= dt;
    const guestDistance = Math.hypot(guest.x - this.x, guest.z - this.z);
    let moving = false;

    // A soft meow now and then, louder the closer the guest is.
    this.meowIn -= dt;
    if (this.meowIn <= 0) {
      this.meowIn = MathUtils.randFloat(...MEOW_EVERY);
      // Audible anywhere in the shop, a little louder up close.
      if (this.state !== "petted") this.surroundings.sounds?.meow(0.45 + 0.45 * Math.max(0, 1 - guestDistance / 6));
    }

    switch (this.state) {
      case "walk": {
        const target = CAT_ROUTE[this.waypoint]!;
        moving = this.moveTowards(target.x, target.z, WALK_SPEED, dt, 0.05);
        if (!moving) this.reachWaypoint();
        else this.maybeStartPlaying();
        break;
      }
      case "play":
        moving = this.play(dt);
        break;
      default:
        this.restLeft -= dt;
        if (this.state === "rest" && guestDistance < 1.6 && this.activity !== "roll") {
          this.turnTo(Math.atan2(guest.x - this.x, guest.z - this.z), dt, 2.5);
        }
        if (this.restLeft <= 0) {
          if (this.state === "petted") {
            // Stretch back up and sit a moment before wandering off.
            this.state = "rest";
            this.activity = "sit";
            this.restLeft = 2;
          } else {
            this.leave();
          }
        }
    }

    // Hop onto the window seat when she reaches it.
    const onSeat = this.z > CAT_SEAT.z0 - 0.06 && this.x > CAT_SEAT.x0 && this.x < CAT_SEAT.x1;
    this.root.position.y = MathUtils.damp(this.root.position.y, onSeat ? CAT_SEAT.height : 0, 14, dt);

    this.animate(dt, moving, guestDistance);
  }

  /** Steps towards a point; false once within `arrive`. */
  private moveTowards(x: number, z: number, speed: number, dt: number, arrive: number): boolean {
    const dx = x - this.x;
    const dz = z - this.z;
    const distance = Math.hypot(dx, dz);
    if (distance < arrive) return false;
    const step = Math.min(distance, speed * dt);
    this.root.position.x += (dx / distance) * step;
    this.root.position.z += (dz / distance) * step;
    this.turnTo(Math.atan2(dx, dz), dt, 7);
    return true;
  }

  private maybeStartPlaying(): void {
    const ball = this.surroundings.ball;
    if (!ball || this.playCooldown > 0) return;
    if (Math.hypot(ball.x - this.x, ball.z - this.z) > 2.4) return;
    this.state = "play";
    this.surroundings.sounds?.meow(0.5);
    this.bats = MathUtils.randInt(2, 4);
    this.playLeft = 14;
  }

  /** Chase the ball, bat it with a front paw, repeat; then back to the route. */
  private play(dt: number): boolean {
    const ball = this.surroundings.ball!;
    this.playLeft -= dt;
    if (this.swipe >= 0) {
      this.swipe += dt;
      if (this.swipe > 0.16 && this.swipe - dt <= 0.16) {
        const angle = this.yaw + MathUtils.randFloatSpread(1.1);
        ball.push(Math.sin(angle), Math.cos(angle), MathUtils.randFloat(1.1, 1.9));
        this.surroundings.sounds?.jingle(0.6);
      }
      if (this.swipe > 0.45) {
        this.swipe = -1;
        this.bats -= 1;
      }
      return false;
    }
    if (this.bats <= 0 || this.playLeft <= 0) {
      this.state = "walk";
      this.playCooldown = PLAY_COOLDOWN;
      return false;
    }
    if (ball.speed > 0.4) {
      // Watch it roll before chasing.
      this.turnTo(Math.atan2(ball.x - this.x, ball.z - this.z), dt, 6);
      return false;
    }
    const moving = this.moveTowards(ball.x, ball.z, POUNCE_SPEED, dt, 0.24);
    if (!moving) {
      this.turnTo(Math.atan2(ball.x - this.x, ball.z - this.z), dt, 12);
      this.swipe = 0;
    }
    return moving;
  }

  private reachWaypoint(): void {
    const point = CAT_ROUTE[this.waypoint]!;
    if (point.pause) {
      if (this.waypoint === 0) this.surroundings.sounds?.meow(0.4); // back home
      this.state = "rest";
      this.restLeft = MathUtils.randFloat(point.pause[0], point.pause[1]);
      this.activity = this.pickActivity();
    } else {
      this.advance();
    }
  }

  private pickActivity(): Activity {
    const onSeat = this.root.position.y > 0.2;
    const roll = Math.random();
    if (onSeat) return roll < 0.6 ? "loaf" : "sit";
    if (roll < 0.35) return "sit";
    if (roll < 0.6) return "loaf";
    if (roll < 0.85) return "groom";
    this.rollSide = Math.random() < 0.5 ? -1 : 1;
    return "roll";
  }

  private leave(): void {
    this.state = "walk";
    this.advance();
  }

  private advance(): void {
    this.waypoint = (this.waypoint + 1) % CAT_ROUTE.length;
  }

  private turnTo(yaw: number, dt: number, rate: number): void {
    const delta = Math.atan2(Math.sin(yaw - this.yaw), Math.cos(yaw - this.yaw));
    this.yaw += delta * Math.min(1, dt * rate);
    this.root.rotation.y = this.yaw;
  }

  private animate(dt: number, moving: boolean, guestDistance: number): void {
    const resting = this.state === "rest" || this.state === "petted";
    const act = resting ? this.activity : null;
    this.sit = MathUtils.damp(this.sit, !moving && (act === "sit" || act === "groom" || this.state === "play") ? 1 : 0, 5, dt);
    this.loaf = MathUtils.damp(this.loaf, act === "loaf" ? 1 : 0, 4, dt);
    this.groom = MathUtils.damp(this.groom, act === "groom" ? 1 : 0, 4, dt);
    this.roll = MathUtils.damp(this.roll, act === "roll" ? 1 : 0, 3.5, dt);

    const gait = this.time * (this.state === "play" ? 13 : 9);
    this.legs.forEach((leg, index) => {
      const phase = index === 0 || index === 3 ? 0 : Math.PI;
      leg.rotation.x = moving ? Math.sin(gait + phase) * 0.55 : 0;
    });

    // Sitting: hind drops, chest rises, front legs straight.
    const upright = this.sit * (1 - this.roll);
    this.pose.rotation.x = -0.42 * upright;
    this.legs[2]!.rotation.x += 0.9 * upright + 1.3 * this.loaf;
    this.legs[3]!.rotation.x += 0.9 * upright + 1.3 * this.loaf;
    this.legs[0]!.rotation.x += 0.42 * upright - 1.3 * this.loaf;
    this.legs[1]!.rotation.x += 0.42 * upright - 1.3 * this.loaf;

    // Grooming: one front paw up to the face, head dipping to lick it.
    if (this.groom > 0.01) {
      this.legs[0]!.rotation.x += -1.7 * this.groom + Math.sin(this.time * 6) * 0.15 * this.groom;
    }
    // Batting the ball.
    if (this.swipe >= 0) this.legs[0]!.rotation.x += -1.4 * Math.sin(Math.min(1, this.swipe / 0.3) * Math.PI);

    // Rolling onto her back: turn around the body's long axis about its own centre, paws paddling.
    const angle = this.rollSide * 2.45 * this.roll;
    this.pose.rotation.z = angle;
    const centre = BODY_HEIGHT - 0.08 * this.roll - 0.07 * this.loaf;
    this.pose.position.x = BODY_HEIGHT * Math.sin(angle);
    this.pose.position.y = centre - BODY_HEIGHT * Math.cos(angle) - 0.02 * upright;
    if (this.roll > 0.01) {
      this.legs.forEach((leg, index) => {
        leg.rotation.x += Math.sin(this.time * 4 + index * 1.7) * 0.5 * this.roll;
      });
    }

    this.head.rotation.x =
      0.42 * upright + Math.sin(this.time * 0.8) * 0.05 + this.groom * (0.45 + Math.sin(this.time * 6) * 0.12) - 0.2 * this.loaf;
    this.head.rotation.z = this.state === "petted" ? Math.sin(this.time * 3) * 0.2 : 0;

    const wag = this.state === "petted" ? 2.5 : this.state === "play" ? 3 : moving ? 1.6 : 0.7;
    this.tail.forEach((segment, index) => {
      segment.rotation.z = Math.sin(this.time * wag - index * 0.6) * (0.18 + 0.12 * this.loaf);
      segment.rotation.x = -0.35 - upright * 0.15 + this.loaf * 0.3;
    });

    const tagMaterial = this.tag.material;
    tagMaterial.opacity += ((guestDistance < 2.4 ? 1 : 0) - tagMaterial.opacity) * Math.min(1, dt * 6);

    if (this.heartTime >= 0) {
      this.heartTime += dt;
      const t = this.heartTime / 1.6;
      this.heart.position.set(0, 0.55 + t * 0.4, 0.15);
      this.heart.material.opacity = t < 1 ? Math.sin(t * Math.PI) : 0;
      if (t >= 1) this.heartTime = this.state === "petted" ? 0 : -1;
    }
  }

  private build(): void {
    const fur = new MeshStandardMaterial({ color: palette.catWhite, roughness: 1 });
    const pink = new MeshStandardMaterial({ color: "#F0B7B3", roughness: 0.9 });
    const dark = new MeshBasicMaterial({ color: "#3B3431" });
    const collar = new MeshStandardMaterial({ color: palette.olive, roughness: 0.8 });
    const bell = new MeshStandardMaterial({ color: "#C9A86A", roughness: 0.35, metalness: 0.6 });

    const body = mesh(new CapsuleGeometry(0.085, 0.22, 6, 14), fur, [0, 0.19, 0], this.pose);
    body.rotation.x = Math.PI / 2;
    body.scale.set(1.05, 1, 0.95);

    for (const [x, z] of [[-0.05, 0.11], [0.05, 0.11], [-0.05, -0.11], [0.05, -0.11]] as const) {
      const leg = new Group();
      leg.position.set(x, 0.16, z);
      this.pose.add(leg);
      mesh(new CapsuleGeometry(0.024, 0.1, 4, 8), fur, [0, -0.08, 0], leg);
      this.legs.push(leg);
    }

    this.head.position.set(0, 0.29, 0.2);
    this.pose.add(this.head);
    mesh(new SphereGeometry(0.078, 22, 16), fur, [0, 0, 0], this.head).scale.set(1.08, 0.95, 0.95);
    mesh(new SphereGeometry(0.035, 14, 10), fur, [0, -0.025, 0.06], this.head).scale.set(1.3, 0.8, 0.8);
    for (const side of [-1, 1]) {
      const ear = mesh(new ConeGeometry(0.032, 0.06, 4), fur, [side * 0.045, 0.07, -0.005], this.head);
      ear.rotation.z = -side * 0.35;
      const inner = mesh(new ConeGeometry(0.018, 0.035, 4), pink, [side * 0.045, 0.066, 0.008], this.head);
      inner.rotation.z = -side * 0.35;
      mesh(new SphereGeometry(0.011, 10, 8), dark, [side * 0.03, 0.008, 0.07], this.head).scale.set(1, 1.2, 0.6);
    }
    mesh(new SphereGeometry(0.008, 8, 6), pink, [0, -0.012, 0.094], this.head);
    const ring = mesh(new TorusGeometry(0.052, 0.009, 8, 20), collar, [0, 0.245, 0.15], this.pose);
    ring.rotation.x = Math.PI / 2 - 0.5;
    mesh(new SphereGeometry(0.013, 10, 8), bell, [0, 0.2, 0.2], this.pose);

    let parent = this.pose;
    let y = 0.21;
    let z = -0.2;
    for (let i = 0; i < 5; i += 1) {
      const segment = new Group();
      segment.position.set(0, y, z);
      parent.add(segment);
      mesh(new CapsuleGeometry(0.018 - i * 0.002, 0.05, 3, 8), fur, [0, 0.03, -0.01], segment).rotation.x = -0.3;
      this.tail.push(segment);
      parent = segment;
      y = 0.055;
      z = -0.015;
    }
    this.root.traverse((child) => {
      child.castShadow = false;
    });
  }
}
