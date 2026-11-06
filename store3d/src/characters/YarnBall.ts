import { Group, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector3 } from "three";
import { mesh } from "../scene/build";
import type { CollisionWorld } from "../world/collision";
import { blobShadow } from "./props";

const RADIUS = 0.06;
/** Rolling friction: speed falls to ~20 % per second. */
const FRICTION = 1.6;

/** Min's toy: a pink yarn ball that rolls when she bats it (or the guest bumps into it). */
export class YarnBall {
  readonly root = new Group();
  private readonly spin = new Group();
  private readonly velocity = new Vector3();
  private readonly axis = new Vector3();

  constructor(
    private readonly world: CollisionWorld,
    start: { x: number; z: number },
  ) {
    this.root.userData.animated = true;
    this.root.position.set(start.x, RADIUS, start.z);
    this.spin.userData.animated = true;
    this.root.add(this.spin, blobShadow(0.16));
    const yarn = new MeshStandardMaterial({ color: "#E9AFAE", roughness: 1 });
    const strand = new MeshStandardMaterial({ color: "#DB9C9B", roughness: 1 });
    mesh(new SphereGeometry(RADIUS, 16, 12), yarn, [0, 0, 0], this.spin, { castShadow: false });
    for (let i = 0; i < 4; i += 1) {
      const wrap = mesh(new TorusGeometry(RADIUS * 0.98, 0.006, 5, 24), strand, [0, 0, 0], this.spin, { castShadow: false });
      wrap.rotation.set(i * 0.8, i * 1.3, i * 0.4);
    }
    // Shadow sits on the floor, not at the ball's centre.
    this.root.children[1]!.position.y = -RADIUS + 0.002;
  }

  get x(): number {
    return this.root.position.x;
  }

  get z(): number {
    return this.root.position.z;
  }

  get speed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  /** Sends the ball rolling along (dx, dz) at `speed` m/s. */
  push(dx: number, dz: number, speed: number): void {
    const length = Math.hypot(dx, dz) || 1;
    this.velocity.set((dx / length) * speed, 0, (dz / length) * speed);
  }

  update(dt: number): void {
    const speed = this.speed;
    if (speed < 0.01) return;
    let nextX = this.x + this.velocity.x * dt;
    let nextZ = this.z + this.velocity.z * dt;
    // Bounce softly off furniture and walls.
    if (this.world.isBlocked(nextX, this.z, RADIUS)) {
      this.velocity.x *= -0.55;
      nextX = this.x;
    }
    if (this.world.isBlocked(nextX, nextZ, RADIUS)) {
      this.velocity.z *= -0.55;
      nextZ = this.z;
    }
    this.root.position.x = nextX;
    this.root.position.z = nextZ;
    // Roll: turn around the axis perpendicular to the motion.
    this.axis.set(this.velocity.z, 0, -this.velocity.x).normalize();
    this.spin.rotateOnWorldAxis(this.axis, (speed * dt) / RADIUS);
    this.velocity.multiplyScalar(Math.exp(-FRICTION * dt));
  }
}
