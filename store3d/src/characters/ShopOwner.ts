import { Group, Vector3 } from "three";
import { COUNTER } from "../config/layout";
import { palette } from "../config/palette";
import { HumanFigure } from "./HumanFigure";
import { nameTag } from "./props";

const NOTICE_DISTANCE = 3.6;
const WAVE_COOLDOWN = 25;

/** Shop owner NPC behind the counter: greets the guest with a wave and follows them with her eyes. */
export class ShopOwner {
  readonly root = new Group();
  private readonly figure = new HumanFigure({
    skin: palette.skin,
    hair: palette.hairDark,
    hairStyle: "bun",
    scrunchie: palette.sage,
    outfit: { kind: "plain", top: palette.linen, bottom: palette.oatDeep, trim: "#FFFFFF" },
    longSleeves: true,
    slippers: palette.ink,
    apron: palette.oat,
  });
  private readonly tag = nameTag("Chủ tiệm", 0.62);
  private readonly lookPoint = new Vector3();
  private lastWave = -Infinity;
  private time = 0;

  constructor() {
    this.root.position.set(COUNTER.owner.x, 0, COUNTER.owner.z);
    this.root.add(this.figure.root, this.tag);
    this.tag.position.y = 1.95;
  }

  update(dt: number, guest: { x: number; z: number }): void {
    this.time += dt;
    const distance = Math.hypot(guest.x - this.root.position.x, guest.z - this.root.position.z);
    const near = distance < NOTICE_DISTANCE;
    if (near) {
      this.figure.lookAt(this.lookPoint.set(guest.x, 1.5, guest.z));
      if (this.time - this.lastWave > WAVE_COOLDOWN) {
        this.lastWave = this.time;
        this.figure.wave();
      }
    } else {
      this.figure.lookAt(null);
    }
    const material = this.tag.material;
    material.opacity += ((near ? 1 : 0) - material.opacity) * Math.min(1, dt * 6);
    this.figure.update(dt, 0);
  }

  greet(): void {
    this.figure.wave();
    this.lastWave = this.time;
  }
}
