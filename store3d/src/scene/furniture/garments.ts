import {
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Line,
  LineBasicMaterial,
  type Material,
  Path,
  Shape,
  TorusGeometry,
  type Vector2,
  Vector3,
} from "three";
import { mesh } from "../build";

// Hanging pyjama sets for the clothing wall and the mannequin stands. Outlines are the approved
// concept drawing, kept in its own units (a 100-wide box, y down, hanger apex at y = 5) and
// converted to metres here, so tweaks are made by editing the same path data. The result is a
// soft, slightly thick cut-out facing +Z with the hook at the origin.

export type TopCut = "cami" | "tank" | "short" | "long" | "dress";
export type BottomCut = "shorts" | "pants" | "none";
export type Neck = "peterpan" | "round" | "v" | "plain";

export type GarmentStyle = {
  top: TopCut;
  bottom: BottomCut;
  neck: Neck;
  buttons: boolean;
  lace: boolean;
};

/** Concept unit → metres. A top is ~92 units wide, i.e. ~0.55 m. */
const UNIT = 0.006;
const APEX_Y = 5;
/** The tank set is solid peach (approved concept). */
export const PEACH = "#F3C6B3";
export const TRIM_CREAM = "#FFFCF6";
const OUTLINE = "#9A7C60";

/** Reads the cut from the storefront names ("Tay ngắn quần đùi", "Cổ sen phối ren"…). */
export function garmentStyleFor(categoryName: string, modelName: string): GarmentStyle {
  const type = categoryName.toLowerCase();
  const model = modelName.toLowerCase().trim();
  const top: TopCut = type.includes("đầm")
    ? "dress"
    : type.includes("hai dây")
      ? "cami"
      : type.includes("sát nách")
        ? "tank"
        : type.includes("tay dài")
          ? "long"
          : "short";
  const bottom: BottomCut = top === "dress" ? "none" : type.includes("quần dài") ? "pants" : "shorts";
  const neck: Neck = model.includes("sen") ? "peterpan" : /(^|\s)v$/.test(model) ? "v" : model.includes("tròn") ? "round" : "plain";
  return {
    top,
    bottom,
    neck,
    // Long-sleeve Peter Pan shirts button down the front, like the real set.
    buttons: model.includes("cúc") || neck === "v" || (neck === "peterpan" && top === "long"),
    lace: model.includes("ren"),
  };
}

/** Width of the cut in metres, so callers can scale a set to fit its space. */
/** Short tag title for sets without a model name ("Đầm ngắn"…), and the cut line under it. */
export function tagLines(style: GarmentStyle, modelName: string, categoryName: string): { title: string; cut: string } {
  const fallback = { dress: "Đầm ngắn", cami: "Hai dây", tank: "Sát nách", short: categoryName, long: categoryName }[style.top];
  const cut =
    style.top === "dress"
      ? "Kèm quần"
      : style.top === "cami" || style.top === "tank"
        ? "Quần đùi"
        : style.top === "long"
          ? "Tay dài"
          : style.bottom === "pants"
            ? "Quần dài"
            : "Tay ngắn";
  return { title: modelName.trim() && modelName !== categoryName ? modelName : fallback, cut };
}

export function garmentWidth(style: GarmentStyle): number {
  return (style.top === "long" || style.top === "short" || style.top === "dress" ? 92 : 72) * UNIT;
}

/** Plain-coloured sets: their fabric ignores the pattern print. */
export function isPlainSet(style: GarmentStyle): boolean {
  return style.top === "tank";
}

// ---------- Concept outlines (units, y down) ----------

const PATHS = {
  shorts: "M20 98 C19 108 17 118 16 127 C26 130 37 130 47 127 L50 115 L53 127 C63 130 74 130 84 127 C83 118 81 108 80 98 Z",
  pants: "M20 98 C18 150 15 200 13 250 C23 253 34 253 44 250 C46 208 48 162 50 132 C52 162 54 208 56 250 C66 253 77 253 87 250 C85 200 82 150 80 98 Z",
  topShort:
    "M38 16 C44 22 56 22 62 16 C70 17 78 19 83 23 C90 31 95 41 96 49 C92 53 86 55 81 53 C80 51 79 49 78 48 C79 67 80 87 81 106 C61 109 39 109 19 106 C20 87 21 67 22 48 C21 49 20 51 19 53 C14 55 8 53 4 49 C5 41 10 31 17 23 C22 19 30 17 38 16 Z",
  topLongBody: "M38 16 C44 22 56 22 62 16 C69 17 75 19 79 23 C79 52 80 80 81 108 C61 111 39 111 19 108 C20 80 21 52 21 23 C25 19 31 17 38 16 Z",
  sleeveLeft: "M22 23 C14 32 9 62 6 104 C10 108 16 108 21 106 C22 84 24 64 27 48 Z",
  sleeveRight: "M78 23 C86 32 91 62 94 104 C90 108 84 108 79 106 C78 84 76 64 73 48 Z",
  tank: "M30 16 L37 16 C42 28 58 28 63 16 L70 16 C70 30 74 40 80 47 C81 65 82 84 82 104 C61 107 39 107 18 104 C18 84 19 65 20 47 C26 40 30 30 30 16 Z",
  cami: "M28 34 C42 40 58 40 72 34 C77 54 81 76 85 98 C62 103 38 103 15 98 C19 76 23 54 28 34 Z",
  strapLeft: "M33 15 L35.5 15 L32.5 35 L30 35 Z",
  strapRight: "M64.5 15 L67 15 L70 35 L67.5 35 Z",
  dress:
    "M38 14 C44 20 56 20 62 14 C70 15 76 17 79 20 C88 22 93 30 93 38 C89 42 83 43 78 40 L77 50 C85 72 92 96 95 120 C65 126 35 126 5 120 C8 96 15 72 23 50 L22 40 C17 43 11 42 7 38 C7 30 12 22 21 20 C24 17 30 15 38 14 Z",
  collarSen: "M39 15 C31 22 33 33 45 33 C49 32 50 27 50 21 C50 27 51 32 55 33 C67 33 69 22 61 15 C56 21 44 21 39 15 Z",
  laceCollar: "M37 14 C28 22 31 35 45 35 C49 34 50 28 50 22 C50 28 51 34 55 35 C69 35 72 22 63 14",
  laceHem: "M18 104 C40 108 60 108 82 104",
  neckBand: "M38 16 C44 27 56 27 62 16 C56 29.5 44 29.5 38 16 Z",
  bowLeft: "M46 28 C43 25 43 31 46 29 Z",
  bowRight: "M54 28 C57 25 57 31 54 29 Z",
  lapel: "M38 16 L47 30 L50 42 L53 30 L62 16 L58 16 L50 36 L42 16 Z",
  foldLeft: "M35 58 C37 74 36 90 33 104",
  foldRight: "M66 60 C64 76 65 92 68 104",
  dressYoke: "M23 50 C40 55 60 55 77 50",
  dressTier: "M12 96 C36 101 64 101 88 96",
  creaseLeft: "M32 140 C31 180 30 215 29 248",
  creaseRight: "M68 140 C69 180 70 215 71 248",
} as const;

const toMetres = (x: number, y: number): [number, number] => [(x - 50) * UNIT, -(y - APEX_Y) * UNIT];

/** Minimal reader for the absolute M/L/C/Z path data above. */
function readPath<T extends Path>(d: string, target: T): T {
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+/g) ?? [];
  let i = 0;
  const point = (): [number, number] => {
    const x = Number(tokens[i++]);
    const y = Number(tokens[i++]);
    return toMetres(x, y);
  };
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === "M") target.moveTo(...point());
    else if (command === "L") target.lineTo(...point());
    else if (command === "C") {
      const a = point();
      const b = point();
      const c = point();
      target.bezierCurveTo(a[0], a[1], b[0], b[1], c[0], c[1]);
    } else if (command === "Z") target.closePath();
  }
  return target;
}

/** Soft cut-out: thin, with a rounded edge so the lighting gives it some body. */
const FABRIC_DEPTH = { depth: 0.008, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 3, curveSegments: 14 };
const TRIM_DEPTH = { depth: 0.002, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 12 };
/** Gap between stacked pieces (bottoms → top → collar → buttons): more than a fabric piece's
    full thickness (depth + bevel on both faces), so each layer sits in front of the last. */
const LAYER = 0.016;

const lines = {
  outline: new LineBasicMaterial({ color: OUTLINE, transparent: true, opacity: 0.5 }),
  fold: new LineBasicMaterial({ color: OUTLINE, transparent: true, opacity: 0.22 }),
};

export type GarmentMaterials = { fabric: Material; trim: Material; bow: Material; wood: Material; brass: Material };

/**
 * One set on a wooden hanger: bottoms behind, the top in front, collar and trims on top.
 * Origin = hook; faces +Z. `zoneId` makes every piece tappable.
 */
export function buildGarment(style: GarmentStyle, materials: GarmentMaterials, zoneId: string): Group {
  const group = new Group();
  const opts = { castShadow: false, receiveShadow: false, zoneId };
  let z = 0;
  /** Just in front of the piece at the current layer (lines, buttons, lace). */
  const surface = () => z + 0.0155;

  const piece = (d: string, material: Material, depth = FABRIC_DEPTH, next = true) => {
    const shape = readPath(d, new Shape());
    mesh(new ExtrudeGeometry(shape, depth), material, [0, 0, z], group, opts);
    if (material === materials.fabric && depth === FABRIC_DEPTH) curve(group, shape.getPoints(24), surface(), lines.outline, true);
    if (next) z += LAYER;
  };
  const line = (d: string, material: LineBasicMaterial) => curve(group, readPath(d, new Path()).getPoints(16), surface(), material, false);

  // Hanger: brass hook and two wooden arms from the apex to the shoulders.
  const hook = mesh(new TorusGeometry(0.022, 0.0035, 6, 14, Math.PI * 1.3), materials.brass, [0, 0.022, 0], group, opts);
  hook.rotation.z = -Math.PI * 0.15;
  for (const side of [-1, 1]) {
    const arm = mesh(new CylinderGeometry(0.007, 0.007, 0.18, 8), materials.wood, [side * 0.082, -0.03, -0.006], group, opts);
    arm.rotation.z = side * (Math.PI / 2 - 0.37);
  }

  if (style.bottom === "shorts") piece(PATHS.shorts, materials.fabric);
  if (style.bottom === "pants") {
    piece(PATHS.pants, materials.fabric);
    line(PATHS.creaseLeft, lines.fold);
    line(PATHS.creaseRight, lines.fold);
  }

  switch (style.top) {
    case "long":
      piece(PATHS.sleeveLeft, materials.fabric, FABRIC_DEPTH, false);
      piece(PATHS.sleeveRight, materials.fabric);
      piece(PATHS.topLongBody, materials.fabric);
      break;
    case "short":
      piece(PATHS.topShort, materials.fabric);
      break;
    case "tank":
      piece(PATHS.tank, materials.fabric);
      break;
    case "cami":
      piece(PATHS.strapLeft, materials.fabric, TRIM_DEPTH, false);
      piece(PATHS.strapRight, materials.fabric, TRIM_DEPTH);
      piece(PATHS.cami, materials.fabric);
      break;
    case "dress":
      piece(PATHS.dress, materials.fabric);
      line(PATHS.dressYoke, lines.outline);
      line(PATHS.dressTier, lines.fold);
      break;
  }
  if (style.top !== "dress") {
    line(PATHS.foldLeft, lines.fold);
    line(PATHS.foldRight, lines.fold);
  }

  switch (style.neck) {
    case "peterpan":
      piece(PATHS.collarSen, materials.trim, TRIM_DEPTH);
      if (style.lace) {
        dotsAlong(group, PATHS.laceCollar, surface(), 26, materials.trim, opts);
        dotsAlong(group, PATHS.laceHem, surface(), 22, materials.trim, opts);
      }
      break;
    case "round":
      piece(PATHS.neckBand, materials.fabric, TRIM_DEPTH);
      piece(PATHS.bowLeft, materials.bow, TRIM_DEPTH, false);
      piece(PATHS.bowRight, materials.bow, TRIM_DEPTH);
      mesh(new CircleGeometry(1.4 * UNIT, 12), materials.bow, [...toMetres(50, 28.5), surface()], group, opts);
      break;
    case "v":
      piece(PATHS.lapel, materials.trim, TRIM_DEPTH);
      break;
    case "plain":
      break;
  }

  if (style.buttons) {
    const ys = style.neck === "v" ? [52, 68, 84] : [46, 62, 78, 94];
    const button = new CircleGeometry(2.5 * UNIT, 14);
    for (const y of ys) mesh(button, materials.trim, [...toMetres(50, y), surface()], group, opts);
  }
  return group;
}

function curve(group: Group, points: Vector2[], z: number, material: LineBasicMaterial, closed: boolean): void {
  const vertices = points.map((p) => new Vector3(p.x, p.y, z));
  if (closed && vertices.length) vertices.push(vertices[0]!.clone());
  group.add(new Line(new BufferGeometry().setFromPoints(vertices), material));
}

/** Small discs along a path: the lace scallops on the collar and hem. */
function dotsAlong(group: Group, d: string, z: number, count: number, material: Material, opts: { zoneId: string; castShadow: boolean; receiveShadow: boolean }): void {
  const disc = new CircleGeometry(0.0055, 10);
  for (const p of readPath(d, new Path()).getSpacedPoints(count)) mesh(disc, material, [p.x, p.y, z], group, opts);
}
