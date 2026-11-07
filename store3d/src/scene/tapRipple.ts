import { DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry } from "three";
import { palette } from "../config/palette";

const DURATION = 0.7;
const POOL = 3;

type Ripple = { root: Group; rings: Mesh<RingGeometry, MeshBasicMaterial>[]; age: number };

/**
 * Feedback for "walk here": two soft rings spread out and fade on the floor where the guest tapped.
 * A few are pooled so quick taps don't cut each other off.
 */
export class TapRipple {
  readonly root = new Group();
  private readonly pool: Ripple[] = [];
  private next = 0;

  constructor() {
    this.root.name = "tap-ripples";
    this.root.userData.animated = true;
    const geometry = new RingGeometry(0.075, 0.095, 40);
    for (let i = 0; i < POOL; i += 1) {
      const group = new Group();
      group.visible = false;
      group.userData.animated = true;
      const rings = [palette.oakDeep, palette.ink].map((color) => {
        const ring = new Mesh(
          geometry,
          new MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.renderOrder = 5;
        ring.userData.animated = true;
        group.add(ring);
        return ring;
      });
      this.root.add(group);
      this.pool.push({ root: group, rings, age: DURATION });
    }
  }

  show(x: number, z: number): void {
    const ripple = this.pool[this.next]!;
    this.next = (this.next + 1) % POOL;
    ripple.root.position.set(x, 0.015, z);
    ripple.age = 0;
    ripple.root.visible = true;
  }

  update(dt: number): void {
    for (const ripple of this.pool) {
      if (!ripple.root.visible) continue;
      ripple.age += dt;
      const t = Math.min(ripple.age / DURATION, 1);
      // Outer ring leads, the darker one follows a beat behind.
      ripple.rings.forEach((ring, index) => {
        const local = Math.min(Math.max((t - index * 0.18) / (1 - index * 0.18), 0), 1);
        const eased = 1 - (1 - local) ** 3;
        ring.scale.setScalar(0.6 + eased * (index ? 1.0 : 1.5));
        ring.material.opacity = local === 0 ? 0 : (1 - local) * 0.9;
      });
      if (t >= 1) ripple.root.visible = false;
    }
  }
}
