import {
  CanvasTexture,
  CylinderGeometry,
  Group,
  LatheGeometry,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  SphereGeometry,
  Vector2,
} from "three";
import { shopConfig } from "../../../../src/config/shop";
import { POLICY_SECTIONS } from "../../../../src/features/storefront/policies";
import { SERIF } from "../../config/fonts";
import { CONSOLE, COUNTER, LOUNGE, POLICY_BOARD, ROOM, WALL_FRAMES } from "../../config/layout";
import { palette } from "../../config/palette";
import { mesh, slab, softBox, tagZone } from "../build";
import { labelTexture } from "../canvasArt";
import type { MaterialLibrary } from "../materials";

export const POLICY_ZONE = "policy-board";

/** Policy board, framed decor prints and flower vases around the shop. */
export function buildWallDecor(materials: MaterialLibrary): Group {
  const group = new Group();
  group.name = "wall-decor";
  group.add(buildPolicyCorner(materials), buildFrames(materials));
  // Fresh flowers: counter, lounge table, console under the policy board.
  group.add(
    flowerVase(materials, [COUNTER.main.x1 - 0.35, COUNTER.height, COUNTER.main.z0 + 0.22], 1, [palette.rose, "#F6E3D3", palette.butter]),
    flowerVase(materials, [LOUNGE.table.x - 0.16, 0.57, LOUNGE.table.z + 0.14], 0.7, ["#F3C6B3", "#FFFFFF", palette.rose]),
  );
  return group;
}

// ---------- Policy board ----------

/**
 * Board drawn from the storefront's own policy text, so it never drifts from the shop. Two
 * columns: the short rules on the left, the lists (returns, care) on the right; large type.
 */
function policyTexture(): CanvasTexture {
  const width = 1160;
  const height = Math.round((width * POLICY_BOARD.height) / POLICY_BOARD.width);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const serif = SERIF;
  const sans = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const left = POLICY_SECTIONS.filter((section) => section.body);
  const right = POLICY_SECTIONS.filter((section) => section.items);
  const margin = 70;
  const gutter = 56;
  const column = (width - margin * 2 - gutter) / 2;

  for (let scale = 1; scale > 0.55; scale -= 0.05) {
    ctx.fillStyle = palette.linen;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = palette.oakDeep;
    ctx.lineWidth = 6;
    ctx.strokeRect(22, 22, width - 44, height - 44);

    ctx.textAlign = "center";
    ctx.fillStyle = palette.ink;
    ctx.font = `${Math.round(74 * scale)}px ${serif}`;
    ctx.fillText("Quy định mua hàng", width / 2, 130 * scale);
    ctx.font = `italic ${Math.round(32 * scale)}px ${serif}`;
    ctx.fillStyle = palette.brass;
    ctx.fillText(`${shopConfig.brand} · ${shopConfig.subtitle.toLowerCase()}`, width / 2, 182 * scale);
    ctx.fillRect(width / 2 - 60, 210 * scale, 120, 3);

    ctx.textAlign = "left";
    const top = 290 * scale;
    const drawColumn = (sections: typeof POLICY_SECTIONS, x: number): number => {
      let y = top;
      for (const section of sections) {
        ctx.fillStyle = palette.ink;
        ctx.font = `${Math.round(46 * scale)}px ${serif}`;
        ctx.fillText(section.title, x, y);
        y += 50 * scale;
        ctx.fillStyle = "#6B5E52";
        ctx.font = `${Math.round(33 * scale)}px ${sans}`;
        const lines = section.items ? section.items.map((item) => `• ${item}`) : [section.body];
        for (const line of lines) y = wrapText(ctx, line, x, y, column, 42 * scale) + 6 * scale;
        y += 34 * scale;
      }
      return y;
    };
    const leftEnd = drawColumn(left, margin);
    const rightEnd = drawColumn(right, margin + column + gutter);
    // Thin divider between the columns.
    ctx.fillStyle = "rgba(184, 148, 116, 0.35)";
    ctx.fillRect(width / 2 - 1, top - 40 * scale, 2, Math.max(leftEnd, rightEnd) - top);
    if (Math.max(leftEnd, rightEnd) < height - 50) break;
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function buildPolicyCorner(materials: MaterialLibrary): Group {
  const group = new Group();
  group.name = "policy-corner";
  const wallZ = -ROOM.halfDepth;
  const opts = { zoneId: POLICY_ZONE };
  // Board in an oak frame.
  softBox(materials.surface(palette.oakDeep, { roughness: 0.6 }), [POLICY_BOARD.width + 0.08, POLICY_BOARD.height + 0.08, 0.03], [POLICY_BOARD.x, POLICY_BOARD.y, wallZ + 0.02], group, 0.01, opts);
  mesh(new PlaneGeometry(POLICY_BOARD.width, POLICY_BOARD.height), new MeshBasicMaterial({ map: policyTexture() }), [POLICY_BOARD.x, POLICY_BOARD.y, wallZ + 0.037], group, {
    castShadow: false,
    ...opts,
  });

  // Slim console underneath with a bouquet and a small framed card.
  const oak = materials.surface(palette.oak, { roughness: 0.65 });
  const z0 = wallZ;
  const z1 = wallZ + CONSOLE.depth;
  slab(oak, CONSOLE.x0, CONSOLE.x1, CONSOLE.height - 0.04, CONSOLE.height, z0, z1, group, opts);
  for (const x of [CONSOLE.x0 + 0.04, CONSOLE.x1 - 0.04]) {
    for (const z of [z0 + 0.04, z1 - 0.04]) mesh(new CylinderGeometry(0.018, 0.014, CONSOLE.height - 0.04, 8), oak, [x, (CONSOLE.height - 0.04) / 2, z], group, opts);
  }
  group.add(flowerVase(materials, [CONSOLE.x0 + 0.25, CONSOLE.height, (z0 + z1) / 2], 0.9, ["#FFFFFF", palette.rose, "#F3C6B3"]));
  const card = mesh(
    new PlaneGeometry(0.22, 0.16),
    new MeshBasicMaterial({ map: labelTexture("Tặng scrunchies", { width: 360, height: 260, background: palette.linen, border: palette.oakDeep, radius: 10, subtitle: "mỗi bộ" }) }),
    [CONSOLE.x1 - 0.28, CONSOLE.height + 0.085, (z0 + z1) / 2],
    group,
    { castShadow: false, ...opts },
  );
  card.rotation.x = -0.18;
  tagZone(group, POLICY_ZONE);
  return group;
}

// ---------- Frames ----------

/** Decor prints in oak frames on the right wall: "sleep well" and three soft illustrations. */
function buildFrames(materials: MaterialLibrary): Group {
  const group = new Group();
  group.name = "frames";
  const frameMaterial = materials.surface(palette.oakDeep, { roughness: 0.6 });
  const x = WALL_FRAMES.x - 0.02;
  const facing = -Math.PI / 2;

  const hang = (z: number, y: number, width: number, height: number, art: CanvasTexture) => {
    const frame = new Group();
    frame.position.set(x, y, z);
    frame.rotation.y = facing;
    group.add(frame);
    softBox(frameMaterial, [width + 0.06, height + 0.06, 0.03], [0, 0, 0], frame, 0.01);
    mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ map: art }), [0, 0, 0.02], frame, { castShadow: false });
  };
  hang(WALL_FRAMES.art.z, WALL_FRAMES.y, 0.6, 0.44, labelTexture("sleep well", { width: 512, height: 368, background: palette.linen, radius: 4, font: `italic 72px ${SERIF}` }));
  const prints = [drawBouquet, drawMoon, drawArches];
  WALL_FRAMES.prints.forEach((spot, index) => hang(spot.z, WALL_FRAMES.y + (index % 2 ? 0.08 : -0.04), 0.4, 0.54, artTexture(prints[index % prints.length]!)));
  return group;
}

function artTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 540;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#F7F1E8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  draw(ctx, canvas.width, canvas.height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Line-drawn bouquet in a round vase. */
function drawBouquet(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = "#E6D3C2";
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.74, 70, 82, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8E9C78";
  ctx.lineWidth = 4;
  const heads: Array<[number, number, string]> = [
    [w * 0.5, h * 0.24, "#E3B5AE"], [w * 0.33, h * 0.32, "#F3D9A4"], [w * 0.67, h * 0.3, "#E3B5AE"], [w * 0.42, h * 0.42, "#FFFFFF"], [w * 0.6, h * 0.44, "#F3D9A4"],
  ];
  for (const [x, y] of heads) {
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.66);
    ctx.quadraticCurveTo((x + w / 2) / 2, (y + h * 0.66) / 2 + 20, x, y);
    ctx.stroke();
  }
  for (const [x, y, color] of heads) {
    ctx.fillStyle = color;
    for (let p = 0; p < 6; p += 1) {
      const a = (p / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 16, y + Math.sin(a) * 16, 13, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#D9A15B";
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Crescent moon and stars over soft hills: "sweet dreams". */
function drawMoon(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = "#DCE3E6";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#F3D9A4";
  ctx.beginPath();
  ctx.arc(w * 0.55, h * 0.3, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#DCE3E6";
  ctx.beginPath();
  ctx.arc(w * 0.62, h * 0.26, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  for (const [x, y, r] of [[0.2, 0.15, 5], [0.3, 0.38, 3], [0.8, 0.5, 4], [0.15, 0.55, 3], [0.82, 0.14, 3]] as const) {
    ctx.beginPath();
    ctx.arc(w * x, h * y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#C9D1C0";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.78);
  ctx.quadraticCurveTo(w * 0.3, h * 0.66, w * 0.6, h * 0.76);
  ctx.quadraticCurveTo(w * 0.8, h * 0.82, w, h * 0.72);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  ctx.fillStyle = "#6B5E52";
  ctx.font = `italic 34px ${SERIF}`;
  ctx.textAlign = "center";
  ctx.fillText("sweet dreams", w / 2, h * 0.93);
}

/** Soft overlapping arches in the shop's palette. */
function drawArches(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const arch = (x: number, width: number, top: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, h * 0.86);
    ctx.lineTo(x, top + width / 2);
    ctx.arc(x + width / 2, top + width / 2, width / 2, Math.PI, 0);
    ctx.lineTo(x + width, h * 0.86);
    ctx.fill();
  };
  arch(w * 0.12, w * 0.5, h * 0.22, "#E3C9C1");
  arch(w * 0.38, w * 0.5, h * 0.34, "#C9D1C0");
  arch(w * 0.25, w * 0.34, h * 0.5, "#F3E3B5");
  ctx.fillStyle = "#B89474";
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.2, 22, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- Flowers ----------

const VASE_PROFILE = [
  [0, 0], [0.05, 0], [0.065, 0.04], [0.07, 0.1], [0.05, 0.17], [0.03, 0.2], [0.034, 0.22], [0, 0.22],
].map(([r, y]) => new Vector2(r!, y!));
const vaseGeometry = new LatheGeometry(VASE_PROFILE, 20);
const petalGeometry = new SphereGeometry(0.026, 8, 6);
const centerGeometry = new SphereGeometry(0.014, 6, 5);
const leafGeometry = new SphereGeometry(0.045, 6, 4);

/** Ceramic vase with a loose bouquet: soft round blooms, a few leaves, thin stems. */
export function flowerVase(materials: MaterialLibrary, position: [number, number, number], scale: number, tones: string[]): Group {
  const group = new Group();
  group.position.set(...position);
  group.scale.setScalar(scale);
  mesh(vaseGeometry, materials.surface(palette.linen, { roughness: 0.35 }), [0, 0, 0], group, { castShadow: true });
  const stem = materials.surface("#8E9C78", { roughness: 0.9 });
  const leaf = materials.surface("#A3B08F", { roughness: 0.9 });
  const center = materials.surface("#E9C46A", { roughness: 0.8 });
  const blooms = 13;
  for (let i = 0; i < blooms; i += 1) {
    const angle = (i / blooms) * Math.PI * 2 + (i % 2) * 0.4;
    const spread = 0.04 + (i % 3) * 0.045;
    const top: [number, number, number] = [Math.cos(angle) * spread, 0.34 + ((i * 7) % 4) * 0.035, Math.sin(angle) * spread];
    const stalk = mesh(new CylinderGeometry(0.003, 0.003, top[1] - 0.18, 4), stem, [top[0] / 2, (top[1] + 0.18) / 2, top[2] / 2], group, { castShadow: false });
    stalk.rotation.z = -top[0] * 1.6;
    stalk.rotation.x = top[2] * 1.6;
    const petals = materials.surface(tones[i % tones.length]!, { roughness: 0.95 });
    for (let p = 0; p < 5; p += 1) {
      const a = (p / 5) * Math.PI * 2;
      const petal = mesh(petalGeometry, petals, [top[0] + Math.cos(a) * 0.024, top[1], top[2] + Math.sin(a) * 0.024], group, { castShadow: false });
      petal.scale.set(1, 0.55, 1);
    }
    mesh(centerGeometry, center, [top[0], top[1] + 0.008, top[2]], group, { castShadow: false });
    if (i % 2 === 0) {
      const l = mesh(leafGeometry, leaf, [top[0] * 0.8, top[1] - 0.09, top[2] * 0.8], group, { castShadow: false });
      l.scale.set(1, 0.25, 0.5);
      l.rotation.y = angle;
    }
  }
  return group;
}
