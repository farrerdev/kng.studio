import { MathUtils, PerspectiveCamera, Vector3 } from "three";

const LIMITS = { pitchMin: 0.08, pitchMax: 1.25, distMin: 1.6, distMax: 11 } as const;
/** Default framing: wide enough to see the shelves and displays around the guest. Portrait screens
    see less sideways, so they start further back. */
const DEFAULT_VIEW = {
  /** Low enough that the ceiling shows across the top of the view, like standing in the shop. */
  landscape: { pitch: 0.3, distance: 6.6, fov: 54 },
  /** Wider lens and a higher angle: a tall screen sees little sideways otherwise. */
  portrait: { pitch: 0.44, distance: 7.0, fov: 66 },
} as const;

/**
 * Third-person camera that orbits the guest. Drag to orbit, wheel/pinch to zoom; every input is
 * eased so motion stays smooth, and `reducedMotion` snaps instead of gliding.
 */
export class FollowOrbitCamera {
  readonly camera: PerspectiveCamera;
  private yaw = 0;
  private pitch: number = DEFAULT_VIEW.landscape.pitch;
  private distance: number = DEFAULT_VIEW.landscape.distance;
  private targetYaw = 0;
  private targetPitch: number = DEFAULT_VIEW.landscape.pitch;
  private targetDistance: number = DEFAULT_VIEW.landscape.distance;
  /** Once the guest drags or zooms, screen rotations no longer reset their view. */
  private userAdjusted = false;
  private readonly focus = new Vector3();
  private readonly desiredFocus = new Vector3();
  private initialised = false;

  constructor(aspect: number, private readonly reducedMotion: boolean) {
    // Far plane reaches across the river to the Dragon Bridge and the far bank.
    this.camera = new PerspectiveCamera(50, aspect, 0.08, 240);
  }

  /** Horizontal viewing angle; keyboard movement is relative to it. */
  get heading(): number {
    return this.yaw;
  }

  setAspect(aspect: number): void {
    const view = aspect < 1 ? DEFAULT_VIEW.portrait : DEFAULT_VIEW.landscape;
    this.camera.aspect = aspect;
    this.camera.fov = view.fov;
    this.camera.updateProjectionMatrix();
    if (!this.userAdjusted) {
      this.targetPitch = view.pitch;
      this.targetDistance = view.distance;
    }
  }

  orbit(dxPixels: number, dyPixels: number): void {
    this.userAdjusted = true;
    this.targetYaw -= dxPixels * 0.0065;
    this.targetPitch = MathUtils.clamp(this.targetPitch + dyPixels * 0.005, LIMITS.pitchMin, LIMITS.pitchMax);
  }

  zoom(factor: number): void {
    this.userAdjusted = true;
    this.targetDistance = MathUtils.clamp(this.targetDistance * factor, LIMITS.distMin, LIMITS.distMax);
  }

  /** Jump to the guest on the next update instead of gliding (after a teleport). */
  snap(): void {
    this.initialised = false;
  }

  /** Gently swing behind the guest (used when they start walking with the keyboard and the view is sideways). */
  setYaw(yaw: number): void {
    this.targetYaw = yaw;
  }

  update(dt: number, target: { x: number; z: number }): void {
    this.desiredFocus.set(target.x, 1.15, target.z);
    if (!this.initialised || this.reducedMotion) {
      this.focus.copy(this.desiredFocus);
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
      this.distance = this.targetDistance;
      this.initialised = true;
    } else {
      const lambda = 9;
      this.focus.x = MathUtils.damp(this.focus.x, this.desiredFocus.x, lambda, dt);
      this.focus.y = MathUtils.damp(this.focus.y, this.desiredFocus.y, lambda, dt);
      this.focus.z = MathUtils.damp(this.focus.z, this.desiredFocus.z, lambda, dt);
      this.yaw = MathUtils.damp(this.yaw, this.targetYaw, 12, dt);
      this.pitch = MathUtils.damp(this.pitch, this.targetPitch, 12, dt);
      this.distance = MathUtils.damp(this.distance, this.targetDistance, 10, dt);
    }
    const horizontal = Math.cos(this.pitch) * this.distance;
    this.camera.position.set(
      this.focus.x + Math.sin(this.yaw) * horizontal,
      Math.max(0.35, this.focus.y + Math.sin(this.pitch) * this.distance),
      this.focus.z + Math.cos(this.yaw) * horizontal,
    );
    this.camera.lookAt(this.focus);
  }
}
