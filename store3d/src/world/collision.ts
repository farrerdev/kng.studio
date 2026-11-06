import {
  type Circle,
  DOOR,
  OBSTACLE_CIRCLES,
  OBSTACLE_RECTS,
  OUTDOOR,
  OUTDOOR_CIRCLES,
  OUTDOOR_RECTS,
  ROOM,
  type Rect,
} from "../config/layout";

const BODY_RADIUS = 0.24;

/** Flat 2D collision against the static floor plan (the shop is a single level). */
export class CollisionWorld {
  constructor(
    private readonly rects: readonly Rect[] = [...OBSTACLE_RECTS, ...OUTDOOR_RECTS],
    private readonly circles: readonly Circle[] = [...OBSTACLE_CIRCLES, ...OUTDOOR_CIRCLES],
  ) {}

  /** Inside the shop, out through the front door, and along the street to the riverside. */
  private outOfBounds(x: number, z: number, radius: number): boolean {
    const front = ROOM.halfDepth;
    const outside = front + ROOM.wall;
    if (z < front - radius) return Math.abs(x) > ROOM.halfWidth - radius || z < -ROOM.halfDepth + radius;
    if (z <= outside + radius) return x < DOOR.x0 + radius || x > DOOR.x1 - radius; // the doorway
    return Math.abs(x) > OUTDOOR.halfWidth - radius || z > OUTDOOR.zMax - radius;
  }

  isBlocked(x: number, z: number, radius = BODY_RADIUS): boolean {
    if (this.outOfBounds(x, z, radius)) return true;
    for (const r of this.rects) {
      if (x > r.x0 - radius && x < r.x1 + radius && z > r.z0 - radius && z < r.z1 + radius) return true;
    }
    for (const c of this.circles) {
      if (Math.hypot(x - c.x, z - c.z) < c.r + radius) return true;
    }
    return false;
  }

  /**
   * Moves from (x, z) by (dx, dz), sliding along obstacles instead of stopping dead.
   * Returns the reachable position.
   */
  slide(x: number, z: number, dx: number, dz: number): { x: number; z: number; moved: boolean } {
    if (!this.isBlocked(x + dx, z + dz)) return { x: x + dx, z: z + dz, moved: true };
    if (dx && !this.isBlocked(x + dx, z)) return { x: x + dx, z, moved: true };
    if (dz && !this.isBlocked(x, z + dz)) return { x, z: z + dz, moved: true };
    return { x, z, moved: false };
  }

  /** Nearest free spot to a requested point (used when the guest taps on furniture). */
  nearestFree(x: number, z: number): { x: number; z: number } {
    if (!this.isBlocked(x, z)) return { x, z };
    for (let ring = 1; ring <= 12; ring += 1) {
      const radius = ring * 0.15;
      for (let step = 0; step < 16; step += 1) {
        const a = (step / 16) * Math.PI * 2;
        const px = x + Math.cos(a) * radius;
        const pz = z + Math.sin(a) * radius;
        if (!this.isBlocked(px, pz)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }
}
