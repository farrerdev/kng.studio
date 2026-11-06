import { el } from "../ui/dom";

/** Knob travel in px; also the radius at which the guest walks at full speed. */
const RADIUS = 44;
/** Small movements around the centre are ignored so a light touch doesn't drift. */
const DEAD_ZONE = 0.14;

/**
 * On-screen thumbstick for touch screens. Gives the same (strafe, forward) intent as WASD, but
 * analog: a short push walks slowly. Its own element captures the pointer, so dragging it never
 * orbits the camera.
 */
export class Joystick {
  readonly element: HTMLElement;
  private readonly knob: HTMLElement;
  private pointerId: number | null = null;
  private centerX = 0;
  private centerY = 0;
  private value: { x: number; y: number } | null = null;

  constructor(host: HTMLElement) {
    this.element = el("div", "joystick");
    this.element.setAttribute("aria-hidden", "true"); // keyboard users have WASD/arrows
    this.knob = el("div", "joystick__knob");
    this.element.append(this.knob);
    host.append(this.element);

    this.element.addEventListener("pointerdown", this.onDown);
    this.element.addEventListener("pointermove", this.onMove);
    this.element.addEventListener("pointerup", this.onUp);
    this.element.addEventListener("pointercancel", this.onUp);
    this.element.addEventListener("lostpointercapture", this.onUp);
  }

  /** Intent as (strafe, forward), length in [0, 1]; null when untouched. */
  get intent(): { x: number; y: number } | null {
    return this.value;
  }

  dispose(): void {
    this.element.remove();
  }

  private readonly onDown = (event: PointerEvent): void => {
    if (this.pointerId !== null) return;
    event.preventDefault();
    this.pointerId = event.pointerId;
    this.element.setPointerCapture(event.pointerId);
    const rect = this.element.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;
    this.element.classList.add("is-active");
    this.update(event);
  };

  private readonly onMove = (event: PointerEvent): void => {
    if (event.pointerId === this.pointerId) this.update(event);
  };

  private readonly onUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.value = null;
    this.knob.style.transform = "";
    this.element.classList.remove("is-active");
  };

  private update(event: PointerEvent): void {
    let dx = event.clientX - this.centerX;
    let dy = event.clientY - this.centerY;
    const distance = Math.hypot(dx, dy);
    if (distance > RADIUS) {
      dx = (dx / distance) * RADIUS;
      dy = (dy / distance) * RADIUS;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const strength = Math.min(distance, RADIUS) / RADIUS;
    this.value = strength < DEAD_ZONE ? null : { x: dx / RADIUS, y: -dy / RADIUS };
  }
}
