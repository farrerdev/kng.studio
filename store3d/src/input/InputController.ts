type Handlers = {
  onTap: (clientX: number, clientY: number) => void;
  onOrbit: (dx: number, dy: number) => void;
  onZoom: (factor: number) => void;
};

const TAP_SLOP = 6;
const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

/**
 * Unifies mouse, touch and keyboard: one-finger drag orbits, two-finger pinch zooms,
 * a short press without movement is a tap, WASD/arrows move relative to the camera.
 */
export class InputController {
  private readonly pointers = new Map<number, { x: number; y: number; startX: number; startY: number }>();
  private dragged = false;
  private pinchDistance = 0;
  private readonly pressed = new Set<string>();
  private readonly abort = new AbortController();

  constructor(
    private readonly element: HTMLElement,
    private readonly handlers: Handlers,
  ) {
    const signal = this.abort.signal;
    element.addEventListener("pointerdown", this.onPointerDown, { signal });
    element.addEventListener("pointermove", this.onPointerMove, { signal });
    element.addEventListener("pointerup", this.onPointerUp, { signal });
    element.addEventListener("pointercancel", this.onPointerCancel, { signal });
    element.addEventListener("wheel", this.onWheel, { passive: false, signal });
    element.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });
    window.addEventListener("keydown", this.onKeyDown, { signal });
    window.addEventListener("keyup", this.onKeyUp, { signal });
    window.addEventListener("blur", () => this.pressed.clear(), { signal });
  }

  /** Keyboard intent as (strafe, forward), each in [-1, 1]; null when idle. */
  get keyboardIntent(): { x: number; y: number } | null {
    let x = 0;
    let y = 0;
    for (const code of this.pressed) {
      const vector = MOVE_KEYS[code];
      if (!vector) continue;
      x += vector[0];
      y += vector[1];
    }
    if (!x && !y) return null;
    const length = Math.hypot(x, y);
    return { x: x / length, y: y / length };
  }

  dispose(): void {
    this.abort.abort();
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    this.element.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
    if (this.pointers.size === 1) this.dragged = false;
    if (this.pointers.size === 2) {
      this.dragged = true;
      this.pinchDistance = this.currentPinchDistance();
    }
    this.element.classList.add("is-grabbing");
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;

    if (this.pointers.size >= 2) {
      const distance = this.currentPinchDistance();
      if (this.pinchDistance > 0 && distance > 0) this.handlers.onZoom(this.pinchDistance / distance);
      this.pinchDistance = distance;
      return;
    }
    if (!this.dragged && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > TAP_SLOP) this.dragged = true;
    if (this.dragged) this.handlers.onOrbit(dx, dy);
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    const wasSingle = this.pointers.size === 1;
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.pinchDistance = 0;
    if (!this.pointers.size) this.element.classList.remove("is-grabbing");
    if (wasSingle && !this.dragged && event.button === 0) this.handlers.onTap(event.clientX, event.clientY);
  };

  private readonly onPointerCancel = (event: PointerEvent) => {
    this.pointers.delete(event.pointerId);
    if (!this.pointers.size) this.element.classList.remove("is-grabbing");
  };

  private readonly onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    this.handlers.onZoom(Math.exp(delta * 0.0012));
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (!(event.code in MOVE_KEYS) || isTypingTarget(event.target)) return;
    this.pressed.add(event.code);
    if (event.code.startsWith("Arrow")) event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.pressed.delete(event.code);
  };

  private currentPinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}
