import { Group, MathUtils } from "three";
import { PLAYER_START } from "../config/layout";
import { palette } from "../config/palette";
import type { CollisionWorld } from "../world/collision";
import { HumanFigure } from "./HumanFigure";
import { blobShadow } from "./props";

const WALK_SPEED = 1.45;
const TURN_RATE = 10;
const ARRIVE_EPSILON = 0.06;
const IDLE_FACE_CAMERA_AFTER = 5;

type Target = {
  x: number;
  z: number;
  faceX?: number;
  faceZ?: number;
  onArrive?: () => void;
  /** Called instead of `onArrive` when furniture stops her well short of the target. */
  onBlocked?: () => void;
};

/** Stopped further than this from the target counts as blocked. */
const BLOCKED_DISTANCE = 0.4;

/** The guest: walks to tapped points or by keyboard, sliding along furniture. */
export class Player {
  readonly root = new Group();
  readonly figure: HumanFigure;
  private target: Target | null = null;
  private speed = 0;
  private facing: number = PLAYER_START.yaw;

  constructor(private readonly world: CollisionWorld) {
    // The guest wears a KNG floral pajama set (hoa nhí hồng) with a white Peter Pan collar.
    this.figure = new HumanFigure({
      skin: palette.skin,
      hair: palette.hairBrown,
      hairStyle: "ponytail",
      scrunchie: "#D9A3A0",
      outfit: { kind: "print", base: "#F7EFE6", flower: "#D9A3A0", leaf: "#A9B49A", trim: "#FFFFFF" },
      longSleeves: false,
      slippers: palette.rose,
    });
    this.root.add(this.figure.root, blobShadow(0.75));
    this.root.position.set(PLAYER_START.x, 0, PLAYER_START.z);
    this.root.rotation.y = this.facing;
  }

  get x(): number {
    return this.root.position.x;
  }

  get z(): number {
    return this.root.position.z;
  }

  get isMoving(): boolean {
    return this.speed > 0.05;
  }

  /** Kneel facing a point for a few seconds (petting Min). Moving cancels it. */
  crouch(seconds: number, faceX: number, faceZ: number): void {
    this.standUp();
    this.target = null;
    this.crouchLeft = seconds;
    this.pendingFace = Math.atan2(faceX - this.x, faceZ - this.z);
    this.figure.setPose("crouch");
  }

  /** Sit on a chair (position + facing); any movement stands back up where she was. */
  sit(seat: { x: number; z: number; yaw: number }): void {
    this.target = null;
    this.standPoint = { x: this.x, z: this.z };
    this.root.position.x = seat.x + Math.sin(seat.yaw) * 0.06;
    this.root.position.z = seat.z + Math.cos(seat.yaw) * 0.06;
    this.facing = seat.yaw;
    this.root.rotation.y = seat.yaw;
    this.pendingFace = null;
    this.figure.setPose("sit");
    this.figure.holdCup(true);
  }

  /** Jump straight to a spot (quick menu): no walking, so she can't get stuck on furniture. */
  teleport(x: number, z: number, faceX: number, faceZ: number): void {
    this.standUp();
    this.target = null;
    this.speed = 0;
    const free = this.world.nearestFree(x, z);
    this.root.position.x = free.x;
    this.root.position.z = free.z;
    this.facing = Math.atan2(faceX - free.x, faceZ - free.z);
    this.root.rotation.y = this.facing;
    this.pendingFace = null;
  }

  /** Scripted step (the entrance): place her, face `yaw`, animate the walk at `speed`. */
  scriptedStep(x: number, z: number, yaw: number, speed: number, dt: number): void {
    this.root.position.x = x;
    this.root.position.z = z;
    this.facing = yaw;
    this.root.rotation.y = yaw;
    this.speed = speed;
    this.figure.update(dt, speed);
  }

  get isSeated(): boolean {
    return this.standPoint !== null;
  }

  private standUp(): void {
    if (this.standPoint) {
      this.root.position.x = this.standPoint.x;
      this.root.position.z = this.standPoint.z;
      this.standPoint = null;
    }
    this.crouchLeft = 0;
    this.figure.setPose(null);
    this.figure.holdCup(false);
  }

  walkTo(target: Target): void {
    const free = this.world.nearestFree(target.x, target.z);
    this.target = { ...target, x: free.x, z: free.z };
  }

  stop(): void {
    this.target = null;
  }

  /**
   * `move` is a camera-relative direction from the keyboard (length ≤ 1), or null.
   * `camera` lets her turn and face the viewer after standing still for a while.
   */
  update(dt: number, move: { x: number; z: number } | null, camera: { x: number; z: number }): void {
    let dx = 0;
    let dz = 0;
    const wantsToMove = Boolean(move && (move.x || move.z)) || this.target !== null;
    if (wantsToMove && (this.standPoint || this.crouchLeft > 0)) this.standUp();
    if (this.crouchLeft > 0) {
      this.crouchLeft -= dt;
      if (this.crouchLeft <= 0) this.standUp();
    }
    if (move && (move.x || move.z)) {
      this.target = null;
      dx = move.x;
      dz = move.z;
    } else if (this.target) {
      const tx = this.target.x - this.x;
      const tz = this.target.z - this.z;
      const distance = Math.hypot(tx, tz);
      if (distance < ARRIVE_EPSILON) {
        this.arrive();
      } else {
        const slow = Math.min(1, distance / 0.35);
        dx = (tx / distance) * slow;
        dz = (tz / distance) * slow;
      }
    }

    const length = Math.hypot(dx, dz);
    const desired = length > 0 ? WALK_SPEED * Math.min(1, length) : 0;
    this.speed = MathUtils.damp(this.speed, desired, 10, dt);

    if (length > 0.001) {
      const step = this.speed * dt;
      const result = this.world.slide(this.x, this.z, (dx / length) * step, (dz / length) * step);
      this.root.position.x = result.x;
      this.root.position.z = result.z;
      if (!result.moved && this.target) {
        const target = this.target;
        if (target.onBlocked && Math.hypot(target.x - this.x, target.z - this.z) > BLOCKED_DISTANCE) {
          this.target = null;
          target.onBlocked();
        } else {
          this.arrive();
        }
      }
      this.turnTowards(Math.atan2(dx, dz), dt);
    } else if (this.target === null && this.pendingFace !== null) {
      this.turnTowards(this.pendingFace, dt);
    }

    const posed = this.standPoint !== null || this.crouchLeft > 0;
    this.idleTime = this.isMoving || this.target || posed ? 0 : this.idleTime + dt;
    if (this.idleTime > IDLE_FACE_CAMERA_AFTER) {
      this.turnTowards(Math.atan2(camera.x - this.x, camera.z - this.z), dt * 0.25);
    }
    this.figure.update(dt, this.speed);
  }

  private idleTime = 0;
  private crouchLeft = 0;
  /** Where she stood before sitting down. */
  private standPoint: { x: number; z: number } | null = null;

  private pendingFace: number | null = null;

  private arrive(): void {
    const target = this.target;
    this.target = null;
    if (!target) return;
    this.pendingFace =
      target.faceX !== undefined && target.faceZ !== undefined ? Math.atan2(target.faceX - this.x, target.faceZ - this.z) : null;
    target.onArrive?.();
  }

  private turnTowards(yaw: number, dt: number): void {
    const delta = Math.atan2(Math.sin(yaw - this.facing), Math.cos(yaw - this.facing));
    this.facing += delta * Math.min(1, dt * TURN_RATE);
    this.root.rotation.y = this.facing;
    if (this.pendingFace !== null && Math.abs(delta) < 0.02) this.pendingFace = null;
  }
}
