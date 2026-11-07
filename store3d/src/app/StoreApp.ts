import {
  AmbientLight,
  Clock,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  type Material,
  MathUtils,
  type MeshStandardMaterial,
  type Mesh,
  NeutralToneMapping,
  type Object3D,
  PCFSoftShadowMap,
  PointLight,
  Raycaster,
  Scene,
  SpotLight,
  Vector2,
  WebGLRenderer,
} from "three";
import { FollowOrbitCamera } from "../camera/FollowOrbitCamera";
import type { SoundBoard } from "../audio/SoundBoard";
import { Cat } from "../characters/Cat";
import { YarnBall } from "../characters/YarnBall";
import { Player } from "../characters/Player";
import { ShopOwner } from "../characters/ShopOwner";
import { ACCENT_LIGHTS, LOUNGE, PENDANT_Y, PENDANTS, PLAYER_START, ROOM, STREET } from "../config/layout";
import type { StoreCatalog, StoreProduct } from "../data/types";
import { InputController } from "../input/InputController";
import { Joystick } from "../input/Joystick";
import { freezeStatic } from "../scene/build";
import { buildCounter } from "../scene/furniture/counter";
import { buildDecor } from "../scene/furniture/decor";
import { buildMannequins, buildPodium, buildScrunchieStand } from "../scene/furniture/displays";
import { buildFittingRooms } from "../scene/furniture/fittingRooms";
import { buildShelving } from "../scene/furniture/shelving";
import { buildWallDecor } from "../scene/furniture/wallDecor";
import { Fireworks } from "../scene/fireworks";
import { productFabric } from "../scene/furniture/productDisplay";
import { buildSurroundings } from "../scene/surroundings";
import { animateMarkers, buildZoneMarkers, markerSprite, type ZoneMarker } from "../scene/markers";
import { MaterialLibrary } from "../scene/materials";
import { type FadeWall, type FrontDoor, buildRoom } from "../scene/room";
import type { Hud } from "../ui/Hud";
import type { StoreTarget } from "../shop/types";
import { CollisionWorld } from "../world/collision";
import { type Zone, buildZones, zoneAt } from "../world/zones";
import type { FaqEntry } from "../shop/faq";
import { describeOwnerChat, describeZone, type ZoneActions } from "./zoneViews";

const MAX_PIXEL_RATIO = 2;
const SKY = "#E9EDEA";
const DAY_SKY = new Color(SKY);
/** Print scale on the owner's set (same look as the guest's floral pajamas). */
const OWNER_PRINT_REPEAT = 3;
/** Dusk blue over the river, as in the evening photos of the Dragon Bridge. */
const EVENING_SKY = new Color("#3A4566");
const DAY_HEMI = new Color("#FFFFFF");
/** Indoors stays warm in the evening: the pendants carry the room, the fill only tints it. */
const EVENING_HEMI = new Color("#C8B4A8");
const DAY_SUN = new Color("#FFF6EA");
const MOON = new Color("#A9B6E0");

/**
 * Opening scene (seconds): the guest stands on the pavement outside, the glass doors open and she
 * walks in. Any tap or key skips it.
 */
const INTRO = {
  startZ: ROOM.halfDepth + 1.9, // on the pavement, just outside the door
  walk: [0.6, 3.9],
  doorOpen: [0.2, 1.0],
  doorClose: [3.6, 4.4],
  end: 4.6,
} as const;

/** Does the 2D segment a→b pass through (or start inside) the box grown by `pad`? (slab test) */
function segmentHitsBox(ax: number, az: number, bx: number, bz: number, box: { x0: number; x1: number; z0: number; z1: number }, pad: number): boolean {
  let t0 = 0;
  let t1 = 1;
  const clip = (d: number, lo: number, hi: number, start: number): boolean => {
    if (Math.abs(d) < 1e-9) return start >= lo && start <= hi;
    let near = (lo - start) / d;
    let far = (hi - start) / d;
    if (near > far) [near, far] = [far, near];
    t0 = Math.max(t0, near);
    t1 = Math.min(t1, far);
    return t0 <= t1;
  };
  return clip(bx - ax, box.x0 - pad, box.x1 + pad, ax) && clip(bz - az, box.z0 - pad, box.z1 + pad, az);
}

const smoothstep = (from: number, to: number, t: number) => {
  const x = MathUtils.clamp((t - from) / (to - from), 0, 1);
  return x * x * (3 - 2 * x);
};

/** What the scene needs from the shopping layer (the main store's storefront, see shop/mountShop.tsx). */
export type ShopBridge = {
  open: (target: StoreTarget) => void;
  /** Keyboard belongs to the storefront while any of it is open. */
  readonly isOpen: boolean;
  /** The storefront page covers the whole screen: skip rendering. */
  readonly coversScene: boolean;
};
const CAT_ZONE_DISTANCE = 1.15;

/** Owns the renderer, the world and the frame loop. Created once by main.ts. */
export class StoreApp {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly cameraRig: FollowOrbitCamera;
  private readonly clock = new Clock();
  private readonly materials: MaterialLibrary;
  private readonly collision = new CollisionWorld();
  private readonly player: Player;
  private readonly owner = new ShopOwner();
  private readonly cat: Cat;
  /** Min's yarn ball, on the floor between the podium and the lounge. */
  private readonly ball: YarnBall;
  private readonly input: InputController;
  private readonly joystick: Joystick;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly resizeObserver: ResizeObserver;

  private walls: FadeWall[] = [];
  private awning: Object3D | null = null;
  /** Plants and trees that fade when they stand between the camera and the guest. */
  private occluders: Array<{
    x: number;
    z: number;
    radius: number;
    height: number;
    box?: { x0: number; x1: number; z0: number; z1: number };
    opacity: number;
    materials: Material[];
  }> = [];
  private door: FrontDoor | null = null;
  /** Flat roof, shown only while the guest is outside (inside, the camera looks in from above). */
  private roof: Object3D | null = null;
  private intro: { time: number; done: () => void } | null = null;
  private zones: Zone[] = [];
  private pickables: Object3D[] = [];
  private billboards: Object3D[] = [];
  private spinners: Object3D[] = [];
  private mannequinProducts: StoreProduct[] = [];
  private activeZoneKey: string | null = null;
  /** Door prompts only after the guest has really left the doorway (see updateZone). */
  private readonly doorArmed = { "door-in": false, "door-out": true };
  /** Spot the guest tapped from afar: its panel opens when they arrive (or `then` runs instead). */
  private pendingOpenKey: string | null = null;
  private pendingThen: (() => void) | null = null;
  private markers: ZoneMarker[] = [];
  private elapsed = 0;
  private pixelRatio: number;
  private frameTimes: number[] = [];

  constructor(
    private readonly host: HTMLElement,
    private readonly hud: Hud,
    private readonly catalog: StoreCatalog,
    private readonly shop: ShopBridge,
    /** What the shop owner can answer (published info only, see shop/faq.ts). */
    private readonly faq: FaqEntry[],
    sounds: SoundBoard,
  ) {
    this.ball = new YarnBall(this.collision, { x: 1.7, z: 1.55 });
    this.cat = new Cat({ ball: this.ball, sounds });
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    // Furniture never moves: render the shadow map once instead of every frame.
    this.renderer.shadowMap.autoUpdate = false;
    host.append(this.renderer.domElement);

    this.cameraRig = new FollowOrbitCamera(1, reducedMotion);
    this.materials = new MaterialLibrary(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    this.player = new Player(this.collision);

    // Soft daylight sky; a light haze blends the far end of the street into it.
    this.scene.background = new Color(SKY);
    this.scene.fog = new Fog(SKY, 40, 140);
    this.buildWorld();
    this.input = new InputController(host, {
      onTap: (x, y) => this.handleTap(x, y),
      onOrbit: (dx, dy) => this.cameraRig.orbit(dx, dy),
      onZoom: (factor) => this.cameraRig.zoom(factor),
    });
    this.joystick = new Joystick(hud.root);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
  }

  /** Compiles shaders up front so the first seconds of walking don't hitch. */
  async warmUp(): Promise<void> {
    this.cameraRig.update(0, this.player);
    this.updateWalls(10); // settle wall fading before the first visible frame
    await this.renderer.compileAsync(this.scene, this.cameraRig.camera);
    this.renderer.shadowMap.needsUpdate = true;
  }

  /** The guest arrives from the street and walks in through the glass doors. */
  playIntro(done: () => void): void {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      done();
      return;
    }
    this.intro = { time: 0, done };
    this.player.scriptedStep(PLAYER_START.x, INTRO.startZ, Math.PI, 0, 0);
    this.cameraRig.snap();
    this.hud.setIntro(true);
  }

  private finishIntro(): void {
    const intro = this.intro;
    if (!intro) return;
    this.intro = null;
    this.player.scriptedStep(PLAYER_START.x, PLAYER_START.z, Math.PI, 0, 0);
    this.door?.setOpen(0);
    this.cameraRig.snap();
    this.hud.setIntro(false);
    intro.done();
  }

  private updateIntro(dt: number): void {
    const intro = this.intro!;
    intro.time += dt;
    const t = intro.time;
    const walk = smoothstep(INTRO.walk[0], INTRO.walk[1], t);
    const walking = t > INTRO.walk[0] && t < INTRO.walk[1];
    this.player.scriptedStep(PLAYER_START.x, MathUtils.lerp(INTRO.startZ, PLAYER_START.z, walk), Math.PI, walking ? 1.3 : 0, dt);
    this.door?.setOpen(smoothstep(INTRO.doorOpen[0], INTRO.doorOpen[1], t) * (1 - smoothstep(INTRO.doorClose[0], INTRO.doorClose[1], t)));

    this.cameraRig.update(dt, this.player);
    if (t >= INTRO.end) this.finishIntro();
  }

  start(): void {
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.input.dispose();
    this.joystick.dispose();
    this.materials.dispose();
    this.scene.traverse((object) => {
      const mesh = object as Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material as Material | Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private buildWorld(): void {
    const { group: room, walls, door, roof } = buildRoom(this.materials);
    this.door = door;
    this.roof = roof;
    this.walls = walls;
    const shelving = buildShelving(this.catalog, this.materials);
    const mannequins = buildMannequins(this.catalog, this.materials);
    const surroundings = buildSurroundings(this.materials);
    this.awning = surroundings.awning;
    this.mannequinProducts = mannequins.products;

    const furniture = [
      shelving.group,
      buildFittingRooms(this.materials),
      buildCounter(this.materials),
      buildPodium(this.catalog, this.materials),
      buildScrunchieStand(this.materials),
      mannequins.group,
      buildDecor(this.materials),
      buildWallDecor(this.materials),
      surroundings.group,
    ];
    this.scene.add(room, ...furniture);
    for (const object of [room, ...furniture]) freezeStatic(object);

    this.scene.traverse((object) => {
      if (object.userData.zoneId || object.userData.floor) this.pickables.push(object);
      if (object.userData.billboard) this.billboards.push(object);
      if (object.userData.spin) this.spinners.push(object);
      if (object.userData.occluder) this.registerOccluder(object);
      const material = (object as Mesh).material as MeshStandardMaterial | undefined;
      if (material?.userData?.glow && !this.glowMaterials.includes(material as never)) this.glowMaterials.push(material as never);
    });

    this.dressOwner();
    this.addLights();
    this.scene.add(this.player.root, this.owner.root, this.cat.root, this.ball.root, this.fireworks.root);
    this.zones = buildZones(shelving.sections);

    // Markers show what can be tapped; they are pickable like the furniture they float over.
    const markers = buildZoneMarkers(this.zones);
    this.markers = markers.markers;
    const catMarker = markerSprite("cat");
    catMarker.position.y = 0.78;
    this.cat.root.add(catMarker);
    this.markers.push({ zoneId: "cat", sprite: catMarker, baseY: 0.78, phase: 0 });
    this.scene.add(markers.group);
    this.setupQuickActions();
    this.pickables.push(...markers.markers.map((marker) => marker.sprite));
  }

  /** The owner wears the shop's own long-sleeve, long-pants set (Peter Pan collar first), in stock. */
  private dressOwner(): void {
    const longSets = this.catalog.products.filter((product) => /tay dài.*quần dài/i.test(product.categoryName) && product.inStockPatterns.length);
    const product = longSets.find((candidate) => /cổ sen/i.test(candidate.shortName)) ?? longSets[0];
    if (product) this.owner.wear(productFabric(product, product.inStockPatterns[0], this.materials, OWNER_PRINT_REPEAT));
  }

  private addLights(): void {
    this.hemisphere = new HemisphereLight("#FFFFFF", "#EDE3D6", 1.5);
    this.ambient = new AmbientLight("#FFFFFF", 0.3);
    this.scene.add(this.hemisphere, this.ambient);
    const sun = new DirectionalLight("#FFF6EA", 1.5);
    this.sun = sun;
    sun.position.set(3, 8, 10);
    sun.target.position.set(-0.5, 0, -1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
    this.scene.add(sun, sun.target);
    for (const pendant of PENDANTS) {
      const light = new PointLight("#FFE2BC", 2.4, 6.5, 2);
      light.position.set(pendant.x, PENDANT_Y - 0.12, pendant.z);
      this.scene.add(light);
      this.pendantLights.push(light);
    }
    // Accent spots on the products: on all day, stronger in the evening (see applyEvening).
    for (const accent of ACCENT_LIGHTS) {
      const spot = new SpotLight("#FFE6C4", 0, 9, accent.angle, 0.55, 1.1);
      spot.position.set(...accent.at);
      spot.target.position.set(...accent.aim);
      this.scene.add(spot, spot.target);
      this.accentLights.push(spot);
    }
    // Street lamps light the pavement in the evening only.
    for (const x of [-5.3, 3.2, 11.7]) {
      const light = new PointLight("#FFD9A0", 0, 9, 1.6);
      light.position.set(x, 3.3, STREET.kerb - 0.45);
      this.scene.add(light);
      this.streetLights.push(light);
    }
  }

  // ---------- Evening ----------

  private hemisphere!: HemisphereLight;
  private ambient!: AmbientLight;
  private sun!: DirectionalLight;
  private readonly pendantLights: PointLight[] = [];
  private readonly streetLights: PointLight[] = [];
  private readonly accentLights: SpotLight[] = [];
  private readonly glowMaterials: Array<MeshStandardMaterial & { userData: { glow: { day: number; night: number } } }> = [];
  /** 0 = day, 1 = evening; eased towards `eveningTarget`. */
  private evening = 0;
  private readonly fireworks = new Fireworks();
  private eveningTarget = 0;

  /** Switches between daylight and the evening look (lights on, dusk sky). */
  setEvening(on: boolean, instant = false): void {
    this.eveningTarget = on ? 1 : 0;
    if (instant) this.evening = this.eveningTarget;
    this.applyEvening();
  }

  private updateEvening(dt: number): void {
    if (this.evening === this.eveningTarget) return;
    this.evening = MathUtils.damp(this.evening, this.eveningTarget, 3, dt);
    if (Math.abs(this.evening - this.eveningTarget) < 0.002) this.evening = this.eveningTarget;
    this.applyEvening();
  }

  private applyEvening(): void {
    const k = this.evening;
    const lerp = MathUtils.lerp;
    const sky = this.scene.background as Color;
    sky.copy(DAY_SKY).lerp(EVENING_SKY, k);
    this.scene.fog?.color.copy(sky);
    this.hemisphere.intensity = lerp(1.5, 1.45, k);
    this.hemisphere.color.copy(DAY_HEMI).lerp(EVENING_HEMI, k);
    this.ambient.intensity = lerp(0.3, 0.85, k);
    this.sun.intensity = lerp(1.5, 0.22, k);
    this.sun.color.copy(DAY_SUN).lerp(MOON, k);
    for (const light of this.pendantLights) {
      light.intensity = lerp(2.4, 11, k);
      light.distance = lerp(6.5, 9.5, k);
    }
    for (const light of this.streetLights) light.intensity = lerp(0, 7, k);
    // Product spotlights stay on all day; they just matter more after dark.
    for (const light of this.accentLights) light.intensity = lerp(7, 15, k);
    for (const material of this.glowMaterials) material.emissiveIntensity = lerp(material.userData.glow.day, material.userData.glow.night, k);
  }



  private resize(): void {
    const width = this.host.clientWidth || window.innerWidth;
    const height = this.host.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.cameraRig.setAspect(width / height);
  }

  private frame(): void {
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    if (this.shop.coversScene) return; // nothing visible; also keeps phones cool while shopping
    this.trackPerformance(dt);

    if (this.intro) {
      this.updateIntro(dt);
      this.owner.update(dt, this.player);
      this.cat.update(dt, this.player);
      this.updateWalls(dt);
      this.updateBillboards(dt);
      this.fireworks.update(dt, this.evening);
      this.renderer.render(this.scene, this.cameraRig.camera);
      return;
    }

    // Arrow keys belong to the shop panel/help while they are open.
    const intent = this.shop.isOpen || this.hud.isHelpOpen ? null : this.input.keyboardIntent ?? this.joystick.intent;
    let move: { x: number; z: number } | null = null;
    if (intent) {
      this.pendingOpenKey = null; // steering by hand cancels "open when I get there"
      const heading = this.cameraRig.heading;
      // forward = away from the camera, right = screen right
      move = {
        x: -Math.sin(heading) * intent.y + Math.cos(heading) * intent.x,
        z: -Math.cos(heading) * intent.y - Math.sin(heading) * intent.x,
      };
    }
    this.player.update(dt, move, this.cameraRig.camera.position);
    this.owner.update(dt, this.player);
    this.cat.update(dt, this.player);
    this.updateBall(dt);
    this.cameraRig.update(dt, this.player);

    this.updateWalls(dt);
    this.updateDoor(dt);
    this.updateEvening(dt);
    this.fireworks.update(dt, this.evening);
    this.updateOccluders(dt);
    this.updateBillboards(dt);
    this.updateZone();
    this.elapsed += dt;
    animateMarkers(this.markers, this.activeZoneKey, this.elapsed);

    this.renderer.render(this.scene, this.cameraRig.camera);
  }

  private updateWalls(dt: number): void {
    const cameraPosition = this.cameraRig.camera.position;
    // The awning hangs off the front wall: it fades together with it.
    const front = this.walls[this.walls.length - 1];
    if (this.awning && front) {
      this.awning.visible = front.opacity > 0.1;
      this.awning.traverse((child) => {
        const material = (child as Mesh).material as Material | undefined;
        if (material) material.opacity = front.opacity;
      });
    }
    if (this.roof) this.roof.visible = this.player.z > ROOM.halfDepth - 0.3;
    for (const wall of this.walls) {
      // Inside: walls between the camera and the room fade. Outside (and during the entrance) the
      // front stays up so the shop front shows, unless the camera itself is inside looking out.
      const outside = this.player.z > ROOM.halfDepth - 0.3;
      // Side and back walls fade whenever the camera is beyond them; the front only when the camera
      // and the guest are on opposite sides of it.
      const hides = wall === front && outside ? cameraPosition.z < ROOM.halfDepth + 0.3 : wall.isBehindCamera(cameraPosition);
      const target = hides ? 0 : 1;
      wall.opacity = MathUtils.damp(wall.opacity, target, 10, dt);
      const solid = wall.opacity > 0.97;
      wall.group.visible = wall.opacity > 0.1;
      for (const material of wall.materials) {
        material.opacity = (material.userData.baseOpacity ??= material.opacity) * wall.opacity;
        material.depthWrite = solid && material.userData.depthWrite !== false;
      }
    }
  }

  private doorOpen = 0;

  /** The glass doors open by themselves when the guest comes near them (from either side). */
  private updateDoor(dt: number): void {
    const near = Math.abs(this.player.x) < 1.4 && Math.abs(this.player.z - ROOM.halfDepth) < 1.0;
    this.doorOpen = MathUtils.damp(this.doorOpen, near ? 1 : 0, 6, dt);
    this.door?.setOpen(this.doorOpen);
  }

  /** Gives the occluder its own materials (so fading it leaves shared ones alone) and tracks it. */
  private registerOccluder(object: Object3D): void {
    const info = object.userData.occluder as {
      x?: number;
      z?: number;
      radius?: number;
      height: number;
      box?: { x0: number; x1: number; z0: number; z1: number };
    };
    const materials: Material[] = [];
    object.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const own = (mesh.material as Material).clone();
      own.transparent = true;
      mesh.material = own;
      materials.push(own);
    });
    this.occluders.push({
      x: info.x ?? object.position.x,
      z: info.z ?? object.position.z,
      radius: info.radius ?? 0,
      height: info.height,
      ...(info.box ? { box: info.box } : {}),
      opacity: 1,
      materials,
    });
  }

  /** Fade plants/trees on the line of sight from the camera to the guest. */
  private updateOccluders(dt: number): void {
    const camera = this.cameraRig.camera.position;
    const fx = this.player.x;
    const fz = this.player.z;
    const dx = fx - camera.x;
    const dz = fz - camera.z;
    const lengthSq = dx * dx + dz * dz || 1;
    for (const occluder of this.occluders) {
      if (occluder.box) {
        // Buildings: fade when the camera is inside one or it cuts the line to the guest.
        const blocking = camera.y < occluder.height + 1 && segmentHitsBox(camera.x, camera.z, fx, fz, occluder.box, 0.4);
        this.fadeOccluder(occluder, blocking, dt);
        continue;
      }
      const t = ((occluder.x - camera.x) * dx + (occluder.z - camera.z) * dz) / lengthSq;
      const px = camera.x + dx * MathUtils.clamp(t, 0, 1);
      const pz = camera.z + dz * MathUtils.clamp(t, 0, 1);
      const near = Math.hypot(occluder.x - px, occluder.z - pz) < occluder.radius + 0.25;
      // Only when it is in front of the guest and the camera looks down on it from about its height.
      const inWay = near && t > 0.02 && t < 0.97 && camera.y < occluder.height + 4;
      this.fadeOccluder(occluder, inWay, dt);
    }
  }

  private fadeOccluder(occluder: { opacity: number; materials: Material[] }, inWay: boolean, dt: number): void {
    occluder.opacity = MathUtils.damp(occluder.opacity, inWay ? 0.15 : 1, 8, dt);
    for (const material of occluder.materials) {
      material.opacity = occluder.opacity;
      material.depthWrite = occluder.opacity > 0.95;
    }
  }

  private updateBillboards(dt: number): void {
    const camera = this.cameraRig.camera.position;
    for (const object of this.billboards) {
      const world = object.parent ? object.parent.localToWorld(object.position.clone()) : object.position;
      object.rotation.y = Math.atan2(camera.x - world.x, camera.z - world.z) - (object.parent?.rotation.y ?? 0);
    }
    for (const spinner of this.spinners) spinner.rotation.y += (spinner.userData.spin as number) * dt;
  }

  private updateZone(): void {
    // A spot the guest stands at wins over Min wandering past; Min's panel shows when there is no
    // other spot, or when the guest went to her on purpose.
    const catClose = Math.hypot(this.cat.x - this.player.x, this.cat.z - this.player.z) < CAT_ZONE_DISTANCE;
    // Stepping through the door shouldn't instantly offer to go back: "Vào tiệm" waits until the
    // guest has walked a little way out, "Ra ngoài" until she is properly back inside.
    const { x, z } = this.player;
    const outside = z > ROOM.halfDepth;
    if (outside) {
      this.doorArmed["door-out"] = false;
      if (Math.hypot(x, z - (ROOM.halfDepth + ROOM.wall)) > 1.9) this.doorArmed["door-in"] = true;
    } else {
      this.doorArmed["door-in"] = false;
      if (z < ROOM.halfDepth - 1.4 || Math.abs(x) > 1.4) this.doorArmed["door-out"] = true;
    }
    let spot = zoneAt(this.zones, x, z);
    if ((spot?.kind === "door-in" || spot?.kind === "door-out") && !this.doorArmed[spot.kind] && this.pendingOpenKey !== spot.id) spot = null;
    const nearCat = catClose && (!spot || this.pendingOpenKey === "cat" || this.activeZoneKey === "cat");
    const zone = nearCat ? null : spot;
    const key = nearCat ? "cat" : zone?.id ?? null;
    if (key === this.activeZoneKey) return;
    this.activeZoneKey = key;
    this.hud.show(key, key ? describeZone(nearCat ? "cat" : zone!, this.catalog, this.zoneActions) : null);
    if (key && key === this.pendingOpenKey) {
      const then = this.pendingThen;
      this.pendingOpenKey = null;
      this.pendingThen = null;
      this.hud.openCurrent();
      then?.();
    }
  }

  private readonly zoneActions: ZoneActions = {
    openStore: (target) => this.shop.open(target),
    greetOwner: () => this.owner.greet(),
    shelfPosition: (zoneId) => {
      const shelves = this.shelfZones();
      return { index: shelves.findIndex((zone) => zone.id === zoneId), count: shelves.length };
    },
    goToShelf: (index) => {
      const target = this.shelfZones()[index];
      if (target) this.goToSpot(target.id, target.approach);
    },
    showOwnerChat: () => {
      this.owner.greet();
      this.hud.replaceView(describeOwnerChat(this.zoneActions));
    },
    showCounter: () => {
      const counter = this.zones.find((zone) => zone.kind === "counter");
      if (counter) this.hud.replaceView(describeZone(counter, this.catalog, this.zoneActions));
    },
    faq: () => this.faq,
    petCat: () => {
      const pet = () => {
        // Kneel down beside her; she rolls over and purrs.
        this.player.crouch(this.cat.petDuration, this.cat.x, this.cat.z);
        this.cat.pet();
        this.hud.toast("Min lăn ra kêu gừ gừ, thích lắm");
      };
      if (Math.hypot(this.cat.x - this.player.x, this.cat.z - this.player.z) < 1.3) pet();
      else {
        const spot = { x: this.cat.x + 0.55, z: this.cat.z + 0.55, faceX: this.cat.x, faceZ: this.cat.z };
        this.player.walkTo({ ...spot, onArrive: pet, onBlocked: () => (this.hopTo(spot), pet()) });
      }
    },
    goOutside: () => {
      this.hud.closePanel();
      this.walkRoute({ x: 0.4, z: ROOM.halfDepth + 2.4, faceX: 0.4, faceZ: ROOM.halfDepth + 10 });
    },
    goInside: () => {
      this.hud.closePanel();
      this.walkRoute({ x: PLAYER_START.x, z: PLAYER_START.z - 0.4, faceX: 0, faceZ: 0 });
    },
    sitDown: () => {
      // The free chair closest to the guest; she walks to its front and sits facing the room.
      const chair = [...LOUNGE.chairs].sort(
        (a, b) => Math.hypot(a.x - this.player.x, a.z - this.player.z) - Math.hypot(b.x - this.player.x, b.z - this.player.z),
      )[0]!;
      const front = { x: chair.x + Math.sin(chair.yaw) * 0.6, z: chair.z + Math.cos(chair.yaw) * 0.6 };
      this.hud.closePanel();
      this.player.walkTo({ ...front, onArrive: () => this.player.sit(chair), onBlocked: () => this.player.sit(chair) });
    },
    mannequinProducts: () => this.mannequinProducts,
    catAtHome: () => Math.hypot(this.cat.x - 4.25, this.cat.z - 3.98) < 0.4,
  };

  private handleTap(clientX: number, clientY: number): void {
    if (this.intro) {
      this.finishIntro();
      return;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.cameraRig.camera);

    // Nearest visible thing under the finger: Min, a spot (furniture or its marker) or the floor.
    const hit = this.raycaster
      .intersectObjects([...this.pickables, this.cat.root], true)
      .find((h) => h.object.visible && ((h.object as Mesh).material as Material | undefined)?.opacity !== 0);
    if (!hit) return;
    let node: Object3D | null = hit.object;
    while (node && node !== this.cat.root) node = node.parent;
    if (node === this.cat.root) {
      this.goToSpot("cat", { x: this.cat.x + 0.6, z: this.cat.z + 0.6, faceX: this.cat.x, faceZ: this.cat.z });
      return;
    }
    const zoneId = hit.object.userData.zoneId as string | undefined;
    const zone = zoneId ? this.zones.find((z) => z.id === zoneId) : undefined;
    if (zone) {
      this.goToSpot(zone.id, zone.approach);
    } else if (hit.object.userData.floor) {
      this.pendingOpenKey = null;
      this.walkRoute({ x: hit.point.x, z: hit.point.z });
    }
  }

  /** Panels open only when asked: right away if the guest is already there, otherwise on arrival. */
  private goToSpot(key: string, approach: { x: number; z: number; faceX?: number; faceZ?: number }, then?: () => void): void {
    if (key === this.activeZoneKey) {
      this.pendingOpenKey = null;
      this.pendingThen = null;
      this.hud.openCurrent();
      then?.();
      return;
    }
    this.pendingOpenKey = key;
    this.pendingThen = then ?? null;
    // If furniture is in the way, hop the rest of the way instead of getting stuck.
    this.walkRoute({ ...approach, onBlocked: () => this.hopTo(approach) });
  }

  /** Walks to a point, going through the front door when it is on the other side of the wall. */
  private walkRoute(target: { x: number; z: number; faceX?: number; faceZ?: number; onArrive?: () => void; onBlocked?: () => void }): void {
    const indoors = (z: number) => z < ROOM.halfDepth;
    if (indoors(this.player.z) === indoors(target.z)) {
      this.player.walkTo(target);
      return;
    }
    const inner = { x: 0, z: ROOM.halfDepth - 0.6 };
    const outer = { x: 0, z: ROOM.halfDepth + ROOM.wall + 0.7 };
    const [first, second] = indoors(this.player.z) ? [inner, outer] : [outer, inner];
    const hop = (point: { x: number; z: number }, next: () => void) => () => {
      this.hopTo(point);
      next();
    };
    const last = () => this.player.walkTo(target);
    const middle = () => this.player.walkTo({ ...second, onArrive: last, onBlocked: hop(second, last) });
    this.player.walkTo({ ...first, onArrive: middle, onBlocked: hop(first, middle) });
  }

  private hopTo(spot: { x: number; z: number; faceX?: number; faceZ?: number }): void {
    this.hud.flash();
    this.player.teleport(spot.x, spot.z, spot.faceX ?? spot.x, spot.faceZ ?? spot.z + 1);
    this.cameraRig.snap();
  }



  /** Quick menu: jump straight to a key spot and open it (no walking, so nothing to get stuck on). */
  private teleportTo(zone: Zone | undefined, then?: () => void): void {
    if (!zone) return;
    this.hud.closePanel();
    this.hud.flash();
    const { x, z, faceX, faceZ } = zone.approach;
    this.player.teleport(x, z, faceX, faceZ);
    this.cameraRig.snap();
    this.activeZoneKey = null; // re-announce the spot even if she was already there
    this.pendingOpenKey = zone.id;
    this.pendingThen = then ?? null;
  }

  /** "Đi tới": only the spots that matter most. */
  private setupQuickActions(): void {
    const kind = (k: Zone["kind"]) => this.zones.find((zone) => zone.kind === k);
    this.hud.setQuickActions([
      {
        title: "Đi tới",
        actions: [
          { label: "Xem hàng", hint: "mẫu đang hot nhất", run: () => this.teleportTo(this.hottestShelf()) },
          { label: "Quy định mua hàng", hint: "bảng trên tường", run: () => this.teleportTo(kind("policy")) },
          { label: "Hỏi shop", hint: "quầy chủ tiệm", run: () => this.teleportTo(kind("counter"), () => this.zoneActions.showOwnerChat()) },
        ],
      },
    ]);
  }


  /** Roll the yarn ball; the guest nudges it when she walks into it. */
  private updateBall(dt: number): void {
    const dx = this.ball.x - this.player.x;
    const dz = this.ball.z - this.player.z;
    if (this.player.isMoving && Math.hypot(dx, dz) < 0.32 && this.ball.speed < 0.3) this.ball.push(dx, dz, 1.1);
    this.ball.update(dt);
  }

  /** The wall section of the most-loved product (first section if there is no ranking yet). */
  private hottestShelf(): Zone | undefined {
    const shelves = this.shelfZones();
    const top = this.catalog.popular[0];
    return shelves.find((zone) => zone.product?.id === top?.id) ?? shelves[0];
  }

  /** Shelf sections with a product, in wall order (front to back). */
  private shelfZones(): Zone[] {
    return this.zones.filter((zone) => zone.kind === "shelf" && zone.product);
  }


  /** Drops the pixel ratio on devices that can't hold ~45 fps, so walking stays smooth. */
  private trackPerformance(dt: number): void {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 120) return;
    const average = this.frameTimes.reduce((sum, t) => sum + t, 0) / this.frameTimes.length;
    this.frameTimes = [];
    if (average > 1 / 45 && this.pixelRatio > 1) {
      this.pixelRatio = Math.max(1, this.pixelRatio - 0.25);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.resize();
    }
  }
}
