import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import { palette } from "../config/palette";

// Small procedural textures drawn once on a canvas: signs, labels, planks, fluting, mirror sheen.

type LabelOptions = {
  width?: number;
  height?: number;
  background?: string | null;
  color?: string;
  font?: string;
  radius?: number;
  border?: string | null;
  subtitle?: string;
  subtitleFont?: string;
};

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function texture(canvas: HTMLCanvasElement): CanvasTexture {
  const result = new CanvasTexture(canvas);
  result.colorSpace = SRGBColorSpace;
  result.anisotropy = 4;
  return result;
}

export function labelTexture(text: string, options: LabelOptions = {}): CanvasTexture {
  const width = options.width ?? 512;
  const height = options.height ?? 128;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  if (options.background) {
    ctx.fillStyle = options.background;
    roundRect(ctx, 4, 4, width - 8, height - 8, options.radius ?? 18);
    ctx.fill();
    if (options.border) {
      ctx.strokeStyle = options.border;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
  ctx.fillStyle = options.color ?? palette.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const hasSubtitle = Boolean(options.subtitle);
  ctx.font = options.font ?? `${Math.round(height * 0.42)}px ${SERIF}`;
  fitText(ctx, text, width * 0.9);
  ctx.fillText(text, width / 2, hasSubtitle ? height * 0.4 : height / 2 + 2);
  if (options.subtitle) {
    ctx.font = options.subtitleFont ?? `${Math.round(height * 0.24)}px ${SANS}`;
    ctx.globalAlpha = 0.8;
    fitText(ctx, options.subtitle, width * 0.9);
    ctx.fillText(options.subtitle, width / 2, height * 0.74);
    ctx.globalAlpha = 1;
  }
  return texture(canvas);
}

export function plankTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = palette.floor;
  ctx.fillRect(0, 0, 512, 512);
  const rows = 8;
  for (let row = 0; row < rows; row += 1) {
    const y = (row * 512) / rows;
    ctx.fillStyle = row % 2 ? "rgba(255,255,255,0.05)" : "rgba(120,90,60,0.035)";
    ctx.fillRect(0, y, 512, 512 / rows);
    ctx.fillStyle = palette.floorLine;
    ctx.fillRect(0, y, 512, 2);
    const offset = (row * 197) % 512;
    ctx.fillRect(offset, y, 2, 512 / rows);
  }
  const result = texture(canvas);
  result.wrapS = result.wrapT = RepeatWrapping;
  return result;
}

export function flutedTexture(base: string, groove: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 64);
  for (let x = 0; x < 256; x += 16) {
    ctx.fillStyle = groove;
    ctx.fillRect(x, 0, 3, 64);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(x + 4, 0, 4, 64);
  }
  const result = texture(canvas);
  result.wrapS = RepeatWrapping;
  return result;
}

export function mirrorTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 128, 256);
  gradient.addColorStop(0, "#F3F5F2");
  gradient.addColorStop(0.5, "#DDE4E2");
  gradient.addColorStop(1, "#EEF0EC");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 256);
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(18, 120);
  ctx.lineTo(70, 40);
  ctx.moveTo(30, 150);
  ctx.lineTo(96, 50);
  ctx.stroke();
  return texture(canvas);
}

export function blobShadowTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  gradient.addColorStop(0, "rgba(70,55,40,0.42)");
  gradient.addColorStop(1, "rgba(70,55,40,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return texture(canvas);
}

export function outsideTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const sky = ctx.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, "#F7F1E6");
  sky.addColorStop(0.65, "#EAF0EA");
  sky.addColorStop(1, "#D9DECF");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "rgba(154,165,140,0.45)";
  for (const [x, r] of [[40, 46], [120, 34], [210, 52]] as const) {
    ctx.beginPath();
    ctx.arc(x, 190, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return texture(canvas);
}

/** Small ditsy floral print (hoa nhí) for the characters' default pajamas. */
export function floralTexture(base: string, flower: string, leaf: string): CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const step = 42;
  for (let row = 0; row < size / step + 1; row += 1) {
    for (let col = 0; col < size / step + 1; col += 1) {
      const x = col * step + (row % 2 ? step / 2 : 0) + Math.sin(row * 7 + col * 3) * 5;
      const y = row * step + Math.cos(row * 5 + col * 11) * 5;
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.ellipse(x + 6, y + 5, 4, 2, 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = flower;
      for (let p = 0; p < 5; p += 1) {
        const a = (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * 3.6, y + Math.sin(a) * 3.6, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#F3E3B5";
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const result = texture(canvas);
  result.wrapS = result.wrapT = RepeatWrapping;
  return result;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): void {
  const match = /(\d+)px/.exec(ctx.font);
  if (!match) return;
  let size = Number(match[1]);
  while (size > 12 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = ctx.font.replace(/\d+px/, `${size}px`);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const fonts = { serif: SERIF, sans: SANS } as const;
