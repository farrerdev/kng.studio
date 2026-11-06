import {
  CanvasTexture,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  Group,
  type Material,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { FRONT_WINDOWS, ROOM, STREET } from "../config/layout";
import { palette } from "../config/palette";
import { mesh, slab, softBox } from "./build";
import type { MaterialLibrary } from "./materials";

// The shop sits on the Hàn river front in Đà Nẵng: across the street is the riverside walk, the
// river, and the Dragon Bridge (Cầu Rồng) arching over it, with Sơn Trà mountain beyond.
// Around the shop: pavements, neighbouring houses, trees, lamps, planters and an awning.
// All static, low-poly and without shadows (the shadow map only covers the shop).

const W = ROOM.halfWidth;
const D = ROOM.halfDepth;
const quiet = { castShadow: false, receiveShadow: false } as const;

/** `awning` fades with the shop's front wall so it never blocks the view inside. */
export function buildSurroundings(materials: MaterialLibrary): { group: Group; awning: Group } {
  const group = new Group();
  group.name = "surroundings";
  const awning = buildShopFront();
  group.add(buildStreet(materials), buildNeighbours(), buildGreenery(materials), buildRiverside(materials), buildDragonBridge(), awning);
  return { group, awning };
}

// ---------- Street ----------

function buildStreet(materials: MaterialLibrary): Group {
  const group = new Group();
  const road = mesh(new PlaneGeometry(80, STREET.far - STREET.kerb), materials.surface("#CBC3B8", { roughness: 1 }), [0, -0.005, (STREET.kerb + STREET.far) / 2], group, quiet);
  road.rotation.x = -Math.PI / 2;
  road.userData.floor = true;
  // Kerbs and the far pavement.
  slab(materials.surface("#E7DFD3", { roughness: 0.9 }), -40, 40, -0.01, 0.06, STREET.kerb - 0.18, STREET.kerb, group, quiet);
  slab(materials.surface("#E7DFD3", { roughness: 0.9 }), -40, 40, -0.01, 0.06, STREET.far, STREET.far + 0.18, group, quiet);
  // Soft dashed centre line.
  const dash = materials.surface("#F4EFE6", { roughness: 1 });
  for (let x = -30; x <= 30; x += 2.4) {
    const piece = mesh(new PlaneGeometry(1.2, 0.12), dash, [x, 0.001, (STREET.kerb + STREET.far) / 2], group, quiet);
    piece.rotation.x = -Math.PI / 2;
  }
  // Pavement slabs in front of the shop.
  const paving = mesh(new PlaneGeometry(80, STREET.kerb - D - 0.2), new MeshStandardMaterial({ map: pavingTexture(), roughness: 0.95 }), [0, -0.004, (D + 0.2 + STREET.kerb) / 2], group, quiet);
  paving.rotation.x = -Math.PI / 2;
  paving.userData.floor = true;
  // Street lamps.
  const iron = materials.surface("#6E7A66", { roughness: 0.6 });
  const glow = materials.surface("#FFF3D6", { emissive: "#FFE9B8", emissiveIntensity: 0.6 });
  for (const x of [-8.5, 0.0, 8.5]) {
    const z = STREET.kerb - 0.45;
    mesh(new CylinderGeometry(0.05, 0.07, 3.4, 10), iron, [x + 3.2, 1.7, z], group, quiet);
    mesh(new SphereGeometry(0.18, 14, 10), glow, [x + 3.2, 3.45, z], group, quiet);
    mesh(new ConeGeometry(0.24, 0.18, 14), iron, [x + 3.2, 3.62, z], group, quiet);
  }
  // A bench on the pavement.
  const wood = materials.surface(palette.oak, { roughness: 0.7 });
  softBox(wood, [1.4, 0.06, 0.4], [-3.4, 0.45, STREET.kerb - 0.9], group, 0.02, quiet);
  softBox(wood, [1.4, 0.36, 0.05], [-3.4, 0.68, STREET.kerb - 0.7], group, 0.02, quiet);
  for (const x of [-4, -2.8]) slab(iron, x - 0.03, x + 0.03, 0, 0.45, STREET.kerb - 1.05, STREET.kerb - 0.75, group, quiet);
  return group;
}

function pavingTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#E4DACD";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "rgba(150, 125, 100, 0.25)";
  ctx.lineWidth = 3;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(40, 2);
  return texture;
}

// ---------- Neighbouring houses ----------

type House = { x0: number; x1: number; z0: number; z1: number; height: number; color: string; face: "+z" | "-z" | "+x" | "-x" };

const HOUSES: House[] = [
  // Left and right of the shop, past a narrow alley.
  { x0: -17, x1: -6.8, z0: -7, z1: D + 0.3, height: 5.6, color: "#EAD9C7", face: "+z" },
  { x0: 6.8, x1: 17, z0: -7, z1: D + 0.3, height: 6.2, color: "#DDE3D6", face: "+z" },
  // Behind.
  { x0: -17, x1: 17, z0: -13, z1: -7.6, height: 7.5, color: "#E5DDD2", face: "+z" },
  // Along the street on either side, so the riverside view opens up in front of the shop.
  { x0: -30, x1: -17.5, z0: -9, z1: D + 0.3, height: 7, color: "#F0DCD4", face: "+z" },
  { x0: 17.5, x1: 30, z0: -9, z1: D + 0.3, height: 6.4, color: "#E9E1CC", face: "+z" },
];

function buildNeighbours(): Group {
  const group = new Group();
  for (const house of HOUSES) {
    const wall = new MeshStandardMaterial({ color: house.color, roughness: 0.95 });
    slab(wall, house.x0, house.x1, 0, house.height, house.z0, house.z1, group, quiet);
    // Roof trim.
    slab(new MeshStandardMaterial({ color: "#B9A48E", roughness: 0.8 }), house.x0 - 0.1, house.x1 + 0.1, house.height, house.height + 0.18, house.z0 - 0.1, house.z1 + 0.1, group, quiet);
    // Windows on the street-facing side.
    const width = house.x1 - house.x0;
    const facade = new MeshStandardMaterial({ map: facadeTexture(house.color, width, house.height), transparent: true, roughness: 0.8 });
    const z = house.face === "+z" ? house.z1 + 0.01 : house.z0 - 0.01;
    const plane = mesh(new PlaneGeometry(width, house.height), facade, [(house.x0 + house.x1) / 2, house.height / 2, z], group, quiet);
    if (house.face === "-z") plane.rotation.y = Math.PI;
  }
  return group;
}

/** Rows of soft windows with shutters and a ground-floor door, sized to the wall. */
function facadeTexture(color: string, width: number, height: number): CanvasTexture {
  const pxPerMetre = 48;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * pxPerMetre);
  canvas.height = Math.round(height * pxPerMetre);
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const floors = Math.max(1, Math.floor(height / 2.6));
  const columns = Math.max(1, Math.floor(width / 2.4));
  for (let floor = 0; floor < floors; floor += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cx = ((column + 0.5) * width) / columns;
      const top = height - (floor + 1) * 2.6 + 0.7;
      const x = (cx - 0.5) * pxPerMetre;
      const y = (height - top - 1.3) * pxPerMetre;
      const w = 1.0 * pxPerMetre;
      const h = 1.3 * pxPerMetre;
      if (floor === floors - 1 && column === Math.floor(columns / 2)) {
        // Door on the ground floor.
        ctx.fillStyle = "#B89474";
        ctx.fillRect(x, canvas.height - 2.2 * pxPerMetre, w, 2.2 * pxPerMetre);
        continue;
      }
      ctx.fillStyle = "#F6F1E8";
      ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
      ctx.fillStyle = "#AFC0C8";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(x + w * 0.1, y + h * 0.1, w * 0.25, h * 0.8);
      // Shutters in a deeper shade of the wall colour.
      ctx.fillStyle = shade(color, -0.18);
      ctx.fillRect(x - w * 0.42, y, w * 0.36, h);
      ctx.fillRect(x + w * 1.06, y, w * 0.36, h);
      // Flower box under some windows.
      if ((floor + column) % 2 === 0) {
        ctx.fillStyle = "#9AA58C";
        ctx.fillRect(x - 2, y + h + 4, w + 4, 8);
        ctx.fillStyle = "#E3A6A6";
        for (let f = 0; f < 6; f += 1) ctx.fillRect(x + (f * w) / 6 + 2, y + h, 5, 5);
      }
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function shade(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.max(0, Math.min(255, Math.round(((value >> shift) & 255) * (1 + amount))));
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

// ---------- Trees and planters ----------

function tree(parent: Group, x: number, z: number, scale: number, trunk: Material, leaves: Material[]): void {
  const group = new Group();
  group.userData.occluder = { x, z, radius: 1.0 * scale, height: 2.4 * scale };
  parent.add(group);
  mesh(new CylinderGeometry(0.08 * scale, 0.12 * scale, 1.8 * scale, 8), trunk, [x, 0.9 * scale, z], group, quiet);
  const blobs: Array<[number, number, number, number]> = [
    [0, 2.2, 0, 0.9],
    [0.45, 1.95, 0.2, 0.62],
    [-0.42, 2.0, -0.15, 0.66],
    [0.1, 2.65, -0.2, 0.6],
  ];
  blobs.forEach(([dx, dy, dz, r], index) => {
    mesh(new SphereGeometry(r * scale, 12, 9), leaves[index % leaves.length]!, [x + dx * scale, dy * scale, z + dz * scale], group, quiet);
  });
}

function buildGreenery(materials: MaterialLibrary): Group {
  const group = new Group();
  const trunk = materials.surface("#8B6E55", { roughness: 0.9 });
  const leaves = [materials.surface("#9AA58C", { roughness: 1 }), materials.surface("#A9B49A", { roughness: 1 }), materials.surface("#8E9C7E", { roughness: 1 })];
  // Street trees along the kerb, a few more in the alleys and across the road.
  for (const x of [-13, -9.5, 8.5, 12.5]) tree(group, x, STREET.kerb - 0.6, 1.1, trunk, leaves);
  for (const [x, z] of [[-6.4, -2], [6.4, 1.5], [-6.4, 2.6], [6.4, -4.5]] as const) tree(group, x, z, 0.9, trunk, leaves);

  // Window planters under the shop's front windows.
  const box = materials.surface(palette.oak, { roughness: 0.7 });
  const blooms = [materials.surface(palette.rose, { roughness: 1 }), materials.surface("#FFFFFF", { roughness: 1 }), materials.surface(palette.butter, { roughness: 1 })];
  const foliage = materials.surface("#A3B08F", { roughness: 1 });
  for (const window of FRONT_WINDOWS) {
    const x0 = window.x0 + 0.15;
    const x1 = window.x1 - 0.15;
    const z = D + ROOM.wall + 0.18;
    softBox(box, [x1 - x0, 0.3, 0.3], [(x0 + x1) / 2, 0.38, z], group, 0.02, quiet);
    for (let i = 0; i < Math.floor((x1 - x0) / 0.12); i += 1) {
      const x = x0 + 0.06 + i * 0.12;
      mesh(new SphereGeometry(0.075, 8, 6), foliage, [x, 0.56, z + ((i % 2) - 0.5) * 0.08], group, quiet);
      if (i % 2 === 0) mesh(new SphereGeometry(0.045, 8, 6), blooms[i % 3]!, [x + 0.03, 0.63, z + 0.05], group, quiet);
    }
  }
  return group;
}

// ---------- Shop front ----------

/** Striped linen awning over the shop front. */
function buildShopFront(): Group {
  const group = new Group();
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 16;
  const ctx = canvas.getContext("2d")!;
  for (let i = 0; i < 16; i += 1) {
    ctx.fillStyle = i % 2 ? "#F8F4EE" : "#D9B8A6";
    ctx.fillRect(i * 16, 0, 16, 16);
  }
  const stripes = new CanvasTexture(canvas);
  stripes.colorSpace = SRGBColorSpace;
  stripes.wrapS = RepeatWrapping;
  stripes.repeat.set(3, 1);
  const awning = mesh(new PlaneGeometry(W * 2 + 0.2, 1.1), new MeshStandardMaterial({ map: stripes, roughness: 1, side: 2, transparent: true }), [0, 2.95, D + ROOM.wall + 0.5], group, quiet);
  awning.rotation.x = -Math.PI / 2 + 0.55;
  // Scalloped valance hint: a slim oak bar at the lower edge.
  slab(new MeshStandardMaterial({ color: palette.oakDeep, roughness: 0.7, transparent: true }), -W - 0.1, W + 0.1, 2.62, 2.66, D + ROOM.wall + 0.92, D + ROOM.wall + 0.98, group, quiet);
  return group;
}

// ---------- Hàn river and the Dragon Bridge ----------

const RIVER = { near: STREET.far + 4.2, far: STREET.far + 78 } as const;
/** The bridge crosses the river towards the far bank, a little to the side of the shop. */
const BRIDGE = { x: 15, deck: 3.4, width: 5.2 } as const;
const DRAGON_GOLD = "#F0B92A";

function buildRiverside(materials: MaterialLibrary): Group {
  const group = new Group();
  // Riverside walk with palms and a white railing.
  const walk = mesh(new PlaneGeometry(120, RIVER.near - STREET.far - 0.2), materials.surface("#E9E0D2", { roughness: 0.95 }), [0, -0.003, (STREET.far + 0.2 + RIVER.near) / 2], group, quiet);
  walk.rotation.x = -Math.PI / 2;
  walk.userData.floor = true;
  const rail = materials.surface("#F6F2EA", { roughness: 0.6 });
  slab(rail, -60, 60, 0.95, 1.0, RIVER.near - 0.08, RIVER.near - 0.02, group, quiet);
  for (let x = -60; x <= 60; x += 1.6) slab(rail, x - 0.03, x + 0.03, 0, 0.95, RIVER.near - 0.08, RIVER.near - 0.02, group, quiet);
  const trunk = materials.surface("#A08368", { roughness: 0.9 });
  const frond = materials.surface("#8FA27C", { roughness: 1 });
  for (const x of [-22, -12, -2, 8, 24, 34]) palm(group, x, (STREET.far + RIVER.near) / 2 + 0.6, trunk, frond);

  // The river: a wide, calm sheet of water.
  const water = mesh(new PlaneGeometry(240, RIVER.far - RIVER.near), new MeshStandardMaterial({ color: "#A7C6C7", roughness: 0.25, metalness: 0.15 }), [0, -0.6, (RIVER.near + RIVER.far) / 2], group, quiet);
  water.rotation.x = -Math.PI / 2;
  // River wall below the railing.
  slab(materials.surface("#D8CDBE", { roughness: 0.9 }), -120, 120, -0.6, 0, RIVER.near - 0.05, RIVER.near + 0.3, group, quiet);

  // Far bank: a low skyline and Sơn Trà mountain behind it, softened by the haze.
  const tones = ["#E7E2DA", "#DCE2E3", "#EBDFD2", "#E2E6DC"];
  for (let i = 0; i < 22; i += 1) {
    const x0 = -90 + i * 8.5;
    const height = 6 + ((i * 37) % 11);
    slab(new MeshStandardMaterial({ color: tones[i % tones.length], roughness: 1 }), x0, x0 + 7, 0, height, RIVER.far, RIVER.far + 6, group, quiet);
  }
  const mountain = mesh(new SphereGeometry(40, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new MeshStandardMaterial({ color: "#B9C7B6", roughness: 1 }), [55, -6, RIVER.far + 45], group, quiet);
  mountain.scale.set(1.6, 0.55, 1);
  return group;
}

function palm(parent: Group, x: number, z: number, trunk: Material, frond: Material): void {
  const height = 4.2;
  const group = new Group();
  group.userData.occluder = { x, z, radius: 1.0, height: 3.5 };
  parent.add(group);
  const stem = mesh(new CylinderGeometry(0.11, 0.17, height, 8), trunk, [x, height / 2, z], group, quiet);
  stem.rotation.z = 0.06;
  for (let i = 0; i < 7; i += 1) {
    const leaf = mesh(new ConeGeometry(0.22, 1.9, 5), frond, [x + 0.25, height + 0.05, z], group, quiet);
    leaf.rotation.order = "YZX";
    leaf.rotation.y = (i / 7) * Math.PI * 2;
    leaf.rotation.z = Math.PI / 2 + 0.45;
    leaf.position.x = x + Math.cos((i / 7) * Math.PI * 2) * 0.8;
    leaf.position.z = z - Math.sin((i / 7) * Math.PI * 2) * 0.8;
    leaf.position.y = height - 0.15;
    leaf.scale.set(1, 1, 0.35);
  }
}

/**
 * Cầu Rồng, modelled on the real bridge: a long deck on massive round piers, and the golden steel
 * dragon weaving along its middle, dipping under the deck between arches and rising in three
 * arches (white hangers beneath them), head raised high at the near end, tail flicking up at the
 * far bank. Lamp posts with flags line the deck.
 */
function buildDragonBridge(): Group {
  const group = new Group();
  group.name = "dragon-bridge";
  const concrete = new MeshStandardMaterial({ color: "#D8D3CA", roughness: 0.9 });
  const underside = new MeshStandardMaterial({ color: "#5D6062", roughness: 0.9 });
  const gold = new MeshStandardMaterial({ color: DRAGON_GOLD, roughness: 0.4, metalness: 0.35, emissive: "#5A3C00", emissiveIntensity: 0.15 });
  const hanger = new MeshStandardMaterial({ color: "#F4F2EE", roughness: 0.6 });
  const start = STREET.far + 1.5;
  const end = RIVER.far - 1;
  const length = end - start;
  const half = BRIDGE.width / 2;
  const deckTop = BRIDGE.deck;
  const at = (fraction: number) => start + fraction * length;

  // Deck: thick slab with a dark underside, kerbs and railings.
  slab(underside, BRIDGE.x - half, BRIDGE.x + half, deckTop - 0.75, deckTop - 0.3, start, end, group, quiet);
  slab(concrete, BRIDGE.x - half - 0.1, BRIDGE.x + half + 0.1, deckTop - 0.3, deckTop, start, end, group, quiet);
  for (const side of [-1, 1]) {
    const x = BRIDGE.x + side * (half + 0.05);
    slab(hanger, x - 0.03, x + 0.03, deckTop + 0.85, deckTop + 0.9, start, end, group, quiet);
    for (let z = start; z < end; z += 1.2) slab(hanger, x - 0.02, x + 0.02, deckTop, deckTop + 0.88, z - 0.02, z + 0.02, group, quiet);
  }
  // Massive round piers standing in the river.
  for (const fraction of [0.17, 0.5, 0.83]) {
    const z = at(fraction);
    const height = deckTop - 0.75 + 0.6;
    mesh(new CylinderGeometry(1.7, 1.9, height, 24), concrete, [BRIDGE.x, -0.6 + height / 2, z], group, quiet).scale.set(1.25, 1, 0.8);
  }
  // Lamp posts with little flags (red, blue, green) along both sides.
  const pole = new MeshStandardMaterial({ color: "#7D8487", roughness: 0.6 });
  const flags = ["#D9483B", "#3C6FB5", "#3E9C5A"].map((color) => new MeshStandardMaterial({ color, roughness: 0.8, side: 2 }));
  let flagIndex = 0;
  for (let z = start + 2; z < end; z += 5.5) {
    for (const side of [-1, 1]) {
      const x = BRIDGE.x + side * (half - 0.15);
      mesh(new CylinderGeometry(0.04, 0.05, 2.6, 6), pole, [x, deckTop + 1.3, z], group, quiet);
      mesh(new SphereGeometry(0.1, 8, 6), hanger, [x - side * 0.25, deckTop + 2.55, z], group, quiet);
      const flag = mesh(new PlaneGeometry(0.4, 0.28), flags[flagIndex++ % flags.length]!, [x + side * 0.2, deckTop + 2.05, z], group, quiet);
      flag.rotation.y = Math.PI / 2;
    }
  }

  // The dragon's path: offsets above (+) and below (-) the deck along the bridge.
  // Starts high at the head (the neck rises straight into it).
  const profile: Array<[number, number]> = [
    [-0.02, 8.4], [0.0, 6.4], [0.05, 2.6], [0.1, -1.2], [0.17, -2.2], [0.24, -1.0], [0.3, 2.5], [0.37, 6.6], [0.44, 2.6],
    [0.5, -1.4], [0.56, -2.2], [0.62, -0.8], [0.68, 2.6], [0.75, 6.0], [0.82, 2.2], [0.87, -1.6], [0.92, -1.0],
    [0.96, 1.6], [1.0, 3.6],
  ];
  const curve = new CatmullRomCurve3(profile.map(([f, y]) => new Vector3(BRIDGE.x, deckTop + y, at(f))));
  mesh(new TubeGeometry(curve, 400, 0.66, 14, false), gold, [0, 0, 0], group, quiet);

  // Scales: a crest of flat plates along the back, and white hangers under each arch.
  const samples = 260;
  for (let i = 4; i < samples; i += 2) {
    const point = curve.getPointAt(i / samples);
    const tangent = curve.getTangentAt(i / samples);
    const plate = mesh(new ConeGeometry(0.42, 1.0, 3), gold, [point.x, point.y + 0.7, point.z], group, quiet);
    plate.scale.set(1, 1, 0.25);
    plate.rotation.y = Math.PI / 2;
    plate.rotation.x = -Math.atan2(tangent.y, tangent.z) * 0.6 - 0.25;
    // Hangers under the arches only (not under the raised neck).
    if (i > samples * 0.1 && point.y > deckTop + 1.2 && i % 4 === 0) {
      const drop = point.y - 0.5 - deckTop;
      mesh(new CylinderGeometry(0.035, 0.035, drop, 5), hanger, [point.x, deckTop + drop / 2, point.z], group, quiet);
    }
  }

  // Head at the top of the neck, looking out over the street: long open jaws, big eyes, horns,
  // and a mane of flame-shaped plates sweeping back (flattened sideways so it reads in profile).
  const top = curve.getPointAt(0);
  const head = new Group();
  head.position.set(top.x, top.y + 0.2, top.z - 0.2);
  head.scale.setScalar(1.25);
  group.add(head);
  const red = new MeshStandardMaterial({ color: "#B4472F", roughness: 0.6 });
  const skull = mesh(new SphereGeometry(0.95, 18, 14), gold, [0, 0.1, 0], head, quiet);
  skull.scale.set(0.85, 0.85, 1.15);
  const upper = mesh(new SphereGeometry(0.75, 16, 12), gold, [0, 0.12, -1.25], head, quiet);
  upper.scale.set(0.72, 0.5, 1.45);
  upper.rotation.x = -0.12;
  const lower = mesh(new SphereGeometry(0.62, 14, 10), gold, [0, -0.55, -1.05], head, quiet);
  lower.scale.set(0.66, 0.3, 1.35);
  lower.rotation.x = 0.32;
  const mouth = mesh(new SphereGeometry(0.5, 12, 8), red, [0, -0.22, -1.2], head, quiet);
  mouth.scale.set(0.6, 0.35, 1.3);
  const eyeWhite = new MeshStandardMaterial({ color: "#F6E7B0", roughness: 0.4 });
  const eyeDark = new MeshStandardMaterial({ color: "#3B3431" });
  for (const side of [-1, 1]) {
    mesh(new SphereGeometry(0.24, 12, 10), eyeWhite, [side * 0.5, 0.42, -0.65], head, quiet);
    mesh(new SphereGeometry(0.11, 8, 6), eyeDark, [side * 0.6, 0.44, -0.75], head, quiet);
    const horn = mesh(new ConeGeometry(0.15, 1.7, 8), gold, [side * 0.4, 0.95, 0.35], head, quiet);
    horn.rotation.x = 1.0;
    horn.rotation.z = -side * 0.2;
    const whisker = mesh(new CylinderGeometry(0.05, 0.012, 2.0, 6), gold, [side * 0.55, -0.1, -2.25], head, quiet);
    whisker.rotation.x = Math.PI / 2 + 0.35;
    whisker.rotation.z = side * 0.5;
  }
  // Ridge plates along the snout.
  for (let i = 0; i < 4; i += 1) {
    const ridge = mesh(new ConeGeometry(0.22, 0.6, 3), gold, [0, 0.55 - i * 0.04, -1.6 + i * 0.4], head, quiet);
    ridge.scale.set(0.3, 1, 1);
    ridge.rotation.x = 0.35;
  }
  // Mane: two layers of flame plates fanning from straight up to back-and-down.
  for (const layer of [-0.28, 0.28]) {
    for (let i = 0; i < 9; i += 1) {
      const angle = -0.25 + (i / 8) * 2.5;
      const reach = 1.05;
      const plate = mesh(new ConeGeometry(0.42, 2.0, 3), gold, [layer, 0.2 + Math.cos(angle) * reach, 0.35 + Math.sin(angle) * reach], head, quiet);
      plate.scale.set(0.28, 1, 1);
      plate.rotation.x = angle;
    }
  }
  return group;
}
