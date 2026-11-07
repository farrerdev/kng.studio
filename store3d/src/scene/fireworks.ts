import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, Group, Points, PointsMaterial } from "three";
import { STREET } from "../config/layout";

/** Sparks per burst; a rocket's rising trail uses the first one. */
const SPARKS = 200;
/** Each spark leaves this many fading dots behind it, so bursts read as crisp streaks. */
const TRAIL = 3;
const GRAVITY = 3.2;
/** Seconds a burst glows before it has faded out. */
const LIFE = 2.6;
const RISE = 1.1;
const TONES = ["#FFD27A", "#FF9FB0", "#FFF4E0", "#A8E6CF", "#FFB36B", "#C9B8FF"];

type Burst = {
  points: Points<BufferGeometry, PointsMaterial>;
  trail: Points<BufferGeometry, PointsMaterial>;
  velocity: Float32Array;
  origin: { x: number; y: number; z: number };
  age: number;
  burst: boolean;
};

/** Soft round spark, so points render as glowing dots instead of squares. */
function sparkTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  // Hard bright core with a thin halo: sharp dots rather than soft blobs.
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.32, "rgba(255,255,255,1)");
  gradient.addColorStop(0.42, "rgba(255,255,255,0.2)");
  gradient.addColorStop(0.6, "rgba(255,255,255,0)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}

/**
 * Evening fireworks over the far side of the Hàn river (as on Đà Nẵng's festival nights): a rocket
 * climbs, bursts into a sphere of sparks that drift down and fade. A small pool is reused.
 */
export class Fireworks {
  readonly root = new Group();
  private readonly pool: Burst[] = [];
  private readonly texture = sparkTexture();
  private untilNext = 0.5;

  constructor() {
    this.root.name = "fireworks";
    this.root.visible = false;
    for (let i = 0; i < 12; i += 1) this.pool.push(this.makeBurst());
  }

  /** `evening` is 0 (day) … 1 (night); rockets launch only after dark. */
  update(dt: number, evening: number): void {
    const active = this.pool.some((burst) => burst.points.visible);
    if (evening < 0.6 && !active) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    if (evening >= 0.6) {
      this.untilNext -= dt;
      if (this.untilNext <= 0) {
        this.launch();
        // Now and then a second one right after, like a real show.
        this.untilNext = Math.random() < 0.45 ? 0.15 + Math.random() * 0.2 : 0.5 + Math.random() * 0.9;
      }
    }
    for (const burst of this.pool) if (burst.points.visible) this.step(burst, dt);
  }

  private makeBurst(): Burst {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(SPARKS * 3), 3));
    const material = new PointsMaterial({
      size: 0.9,
      map: this.texture,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
      // Full brightness: tone mapping would dull the sparks against the night sky.
      toneMapped: false,
    });
    const points = new Points(geometry, material);
    points.visible = false;
    points.frustumCulled = false;
    const trailGeometry = new BufferGeometry();
    trailGeometry.setAttribute("position", new BufferAttribute(new Float32Array(SPARKS * TRAIL * 3), 3));
    const trail = new Points(trailGeometry, material.clone());
    trail.material.size = 0.75;
    trail.frustumCulled = false;
    points.add(trail); // shown and hidden with its burst
    trail.visible = false;
    this.root.add(points);
    return { points, trail, velocity: new Float32Array(SPARKS * 3), origin: { x: 0, y: 0, z: 0 }, age: 0, burst: false };
  }

  private launch(): void {
    const burst = this.pool.find((candidate) => !candidate.points.visible);
    if (!burst) return;
    burst.origin = {
      x: -38 + Math.random() * 62,
      y: 16 + Math.random() * 12,
      z: STREET.far + 34 + Math.random() * 26,
    };
    burst.age = 0;
    burst.burst = false;
    const tone = new Color(TONES[Math.floor(Math.random() * TONES.length)]!);
    burst.points.material.color = tone;
    burst.trail.material.color = tone;
    burst.trail.visible = false;
    burst.points.material.opacity = 1;
    burst.points.material.size = 1.2;
    burst.points.geometry.setDrawRange(0, 1);
    burst.points.visible = true;
    this.setAll(burst, burst.origin.x, 0, burst.origin.z);
  }

  private step(burst: Burst, dt: number): void {
    burst.age += dt;
    const positions = burst.points.geometry.getAttribute("position") as BufferAttribute;
    const array = positions.array as Float32Array;
    if (!burst.burst) {
      // Rising rocket: a single spark easing up to the burst height.
      const t = Math.min(burst.age / RISE, 1);
      array[1] = burst.origin.y * (1 - (1 - t) * (1 - t));
      positions.needsUpdate = true;
      if (t >= 1) this.explode(burst);
      return;
    }
    const life = burst.age;
    for (let i = 0; i < SPARKS; i += 1) {
      const v = i * 3;
      burst.velocity[v + 1]! -= GRAVITY * dt;
      const drag = Math.exp(-1.4 * dt);
      burst.velocity[v]! *= drag;
      burst.velocity[v + 1]! *= drag;
      burst.velocity[v + 2]! *= drag;
      array[v]! += burst.velocity[v]! * dt;
      array[v + 1]! += burst.velocity[v + 1]! * dt;
      array[v + 2]! += burst.velocity[v + 2]! * dt;
    }
    positions.needsUpdate = true;
    // Trail dots sit behind each spark along its motion, fainter the further back.
    const trailPositions = burst.trail.geometry.getAttribute("position") as BufferAttribute;
    const trailArray = trailPositions.array as Float32Array;
    for (let i = 0; i < SPARKS; i += 1) {
      const v = i * 3;
      for (let step = 1; step <= TRAIL; step += 1) {
        const t = (i * TRAIL + step - 1) * 3;
        const back = step * 0.045;
        trailArray[t] = array[v]! - burst.velocity[v]! * back;
        trailArray[t + 1] = array[v + 1]! - burst.velocity[v + 1]! * back;
        trailArray[t + 2] = array[v + 2]! - burst.velocity[v + 2]! * back;
      }
    }
    trailPositions.needsUpdate = true;
    const fade = 1 - life / LIFE;
    // Fade out with a little twinkle at the end, like real sparks burning out.
    const twinkle = fade < 0.45 ? 0.6 + Math.random() * 0.4 : 1;
    burst.points.material.opacity = Math.max(0, fade * fade * twinkle);
    burst.trail.material.opacity = burst.points.material.opacity * 0.45;
    if (life >= LIFE) burst.points.visible = false;
  }

  private explode(burst: Burst, speed = 10 + Math.random() * 5, inner = false): void {
    burst.burst = true;
    burst.age = 0;
    burst.points.visible = true;
    burst.points.geometry.setDrawRange(0, SPARKS);
    burst.points.material.opacity = 1;
    burst.points.material.size = 1.8;
    burst.trail.visible = true;
    this.setAll(burst, burst.origin.x, burst.origin.y, burst.origin.z);
    // Often a smaller sphere of another colour opens inside the first, like a real two-tone shell.
    if (!inner && Math.random() < 0.45) {
      const core = this.pool.find((candidate) => !candidate.points.visible);
      if (core) {
        core.origin = { ...burst.origin };
        const tone = new Color(TONES[Math.floor(Math.random() * TONES.length)]!);
        core.points.material.color = tone;
        core.trail.material.color = tone;
        this.explode(core, speed * 0.5, true);
      }
    }
    for (let i = 0; i < SPARKS; i += 1) {
      // Even spread over a sphere (golden-spiral), a little jitter in speed.
      const y = 1 - (2 * (i + 0.5)) / SPARKS;
      const r = Math.sqrt(1 - y * y);
      const angle = i * 2.39996;
      const s = speed * (0.85 + Math.random() * 0.3);
      burst.velocity[i * 3] = Math.cos(angle) * r * s;
      burst.velocity[i * 3 + 1] = y * s;
      burst.velocity[i * 3 + 2] = Math.sin(angle) * r * s;
    }
  }

  private setAll(burst: Burst, x: number, y: number, z: number): void {
    const positions = burst.points.geometry.getAttribute("position") as BufferAttribute;
    const array = positions.array as Float32Array;
    for (let i = 0; i < SPARKS; i += 1) {
      array[i * 3] = x;
      array[i * 3 + 1] = y;
      array[i * 3 + 2] = z;
    }
    positions.needsUpdate = true;
  }
}
