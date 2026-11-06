import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

// Muslin prints drawn on a canvas instead of using the product photos: photos carry lighting,
// creases and background, which read as grey blotches on small 3D garments. Each pattern's
// colours and motif come from its name ("Cúc ban mai" → daisies on butter, "Hoa nơ đỏ" → red
// bows…), so the wall reads like the real prints.

type Motif = "flower" | "daisy" | "bow" | "puppy" | "dot";

export type PrintPalette = {
  base: string;
  motif: Motif;
  main: string;
  center: string;
  leaf: string;
  accent: string;
};

/** Checked in order: specific words first ("hồng nâu" before "hồng"). */
const RULES: Array<[RegExp, PrintPalette]> = [
  [/cúc/, { base: "#FAF2D9", motif: "daisy", main: "#FFFFFF", center: "#E9A64C", leaf: "#AEB98F", accent: "#F0C98A" }],
  [/nơ/, { base: "#FBF6EF", motif: "bow", main: "#C9555B", center: "#B04A50", leaf: "#E7A3A6", accent: "#E7A3A6" }],
  [/voi/, { base: "#EEF2F5", motif: "puppy", main: "#FFFFFF", center: "#9DB3CC", leaf: "#AFC09F", accent: "#E9C0B6" }],
  [/cún|chó/, { base: "#F7F1E6", motif: "puppy", main: "#FFFFFF", center: "#B08E77", leaf: "#AFC09F", accent: "#E7B1A8" }],
  [/gà|vàng/, { base: "#FBF3D8", motif: "dot", main: "#F2CE6E", center: "#E9A64C", leaf: "#AEB98F", accent: "#F0B9A0" }],
  [/phấn|baby/, { base: "#F7E1E3", motif: "flower", main: "#FFFFFF", center: "#F3D27A", leaf: "#B9C5A8", accent: "#D99BA3" }],
  [/nâu/, { base: "#F6E7E2", motif: "flower", main: "#CF8F8E", center: "#8E6B5D", leaf: "#A8B79A", accent: "#B98A7A" }],
  [/kitty/, { base: "#FAF4EE", motif: "flower", main: "#EDB3BE", center: "#F3D27A", leaf: "#AFC09F", accent: "#A9BCD6" }],
  [/thỏ/, { base: "#F8EEEC", motif: "flower", main: "#E4A0AA", center: "#F3D27A", leaf: "#9FB08D", accent: "#E9B4B8" }],
  [/xanh/, { base: "#EEF2F5", motif: "flower", main: "#9DB3CC", center: "#F3D27A", leaf: "#AFC09F", accent: "#E9C0B6" }],
  [/hồng/, { base: "#F6E1E0", motif: "flower", main: "#D98E95", center: "#F3D27A", leaf: "#9FB08D", accent: "#E9B4B8" }],
];

/** Unknown names still get a soft print, chosen by name so it stays the same every visit. */
const FALLBACKS: PrintPalette[] = [
  { base: "#F7F1E6", motif: "flower", main: "#E6A3A8", center: "#F3D27A", leaf: "#A8B79A", accent: "#A9BCD6" },
  { base: "#F6E1E0", motif: "flower", main: "#D98E95", center: "#F3D27A", leaf: "#9FB08D", accent: "#E9B4B8" },
  { base: "#FAF2D9", motif: "daisy", main: "#FFFFFF", center: "#E9A64C", leaf: "#AEB98F", accent: "#F0C98A" },
];

function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return value >>> 0;
}

export function printPalette(patternName: string): PrintPalette {
  const name = patternName.toLowerCase();
  return RULES.find(([pattern]) => pattern.test(name))?.[1] ?? FALLBACKS[hash(name) % FALLBACKS.length]!;
}

const TILE = 256;
const CELLS = 6;

function drawMotif(ctx: CanvasRenderingContext2D, palette: PrintPalette, x: number, y: number, size: number, turn: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  switch (palette.motif) {
    case "flower":
    case "daisy": {
      const petals = palette.motif === "daisy" ? 8 : 5;
      ctx.fillStyle = palette.main;
      for (let i = 0; i < petals; i += 1) {
        const angle = (i / petals) * Math.PI * 2;
        ctx.beginPath();
        if (palette.motif === "daisy") ctx.ellipse(Math.cos(angle) * size * 0.55, Math.sin(angle) * size * 0.55, size * 0.42, size * 0.2, angle, 0, Math.PI * 2);
        else ctx.arc(Math.cos(angle) * size * 0.45, Math.sin(angle) * size * 0.45, size * 0.38, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = palette.center;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.24, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "bow": {
      ctx.fillStyle = palette.main;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(side * size * 0.9, -size * 0.7, side * size, 0);
        ctx.quadraticCurveTo(side * size * 0.9, size * 0.7, 0, 0);
        ctx.fill();
      }
      ctx.fillStyle = palette.center;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "puppy": {
      ctx.fillStyle = palette.main;
      ctx.strokeStyle = palette.center;
      ctx.lineWidth = size * 0.1;
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.7, size * 0.58, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = palette.center;
      ctx.beginPath();
      ctx.ellipse(-size * 0.5, -size * 0.35, size * 0.22, size * 0.32, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(size * 0.12, -size * 0.05, size * 0.08, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "dot": {
      ctx.fillStyle = palette.main;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

function drawTile(palette: PrintPalette, seed: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, TILE, TILE);
  const cell = TILE / CELLS;
  let random = seed || 1;
  const next = () => ((random = Math.imul(random ^ (random >>> 15), 2246822507) >>> 0) % 1000) / 1000;
  for (let row = 0; row < CELLS; row += 1) {
    for (let col = 0; col < CELLS; col += 1) {
      // Staggered rows keep the repeat from reading as a grid.
      const x = (col + (row % 2 ? 0.5 : 0) + 0.25 + next() * 0.2) * cell;
      const y = (row + 0.3 + next() * 0.2) * cell;
      const turn = next() * Math.PI;
      // Drawn at every wrap offset so motifs crossing an edge continue on the other side.
      for (const dx of [-TILE, 0, TILE]) {
        for (const dy of [-TILE, 0, TILE]) {
          const px = x + dx;
          const py = y + dy;
          drawMotif(ctx, palette, px, py, cell * 0.24, turn);
          if (palette.motif !== "dot") {
            ctx.fillStyle = palette.leaf;
            ctx.beginPath();
            ctx.ellipse(px + cell * 0.36, py + cell * 0.28, cell * 0.1, cell * 0.04, -0.6, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = palette.accent;
          ctx.beginPath();
          ctx.arc(px - cell * 0.3, py + cell * 0.42, cell * 0.05, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  return canvas;
}

const tiles = new Map<string, HTMLCanvasElement>();

/** Repeating print texture for a pattern name. `repeat` = tiles per UV unit. */
export function printTexture(patternName: string, repeat: number, anisotropy: number): Texture {
  let canvas = tiles.get(patternName);
  if (!canvas) {
    canvas = drawTile(printPalette(patternName), hash(patternName));
    tiles.set(patternName, canvas);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = anisotropy;
  return texture;
}
