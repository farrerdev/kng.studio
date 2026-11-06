import { CanvasTexture, Group, SRGBColorSpace, Sprite, SpriteMaterial } from "three";
import { palette } from "../config/palette";
import type { Zone, ZoneKind } from "../world/zones";

/** Where along face → approach the marker floats (0 = on the object, 1 = where the guest stands). */
const ANCHOR_ALONG: Partial<Record<ZoneKind, number>> = { shelf: 0.3, fitting: 0.65, mirror: 0.1, policy: 0.05 };
/** Height above the floor per kind of spot (metres). */
const ANCHOR_HEIGHT: Record<ZoneKind, number> = {
  shelf: 2.45, // above the name tag
  popular: 1.45,
  counter: 2.1,
  fitting: 2.3,
  mirror: 2.05,
  scrunchies: 1.95,
  lounge: 1.25,
  mannequins: 2.05,
  "cat-seat": 1.05,
  policy: 2.5,
  "door-out": 2.75,
  "door-in": 2.75,
};
const SIZE = 0.3;

export type ZoneMarker = { zoneId: string; sprite: Sprite; baseY: number; phase: number };

let sharedTexture: CanvasTexture | null = null;

/** "Hotspot" dot: linen disc, brass ring and centre, soft halo. Shared by every marker. */
function markerTexture(): CanvasTexture {
  if (sharedTexture) return sharedTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const halo = ctx.createRadialGradient(64, 64, 30, 64, 64, 64);
  halo.addColorStop(0, "rgba(255, 250, 242, 0.55)");
  halo.addColorStop(1, "rgba(255, 250, 242, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 128, 128);
  ctx.beginPath();
  ctx.arc(64, 64, 36, 0, Math.PI * 2);
  ctx.fillStyle = palette.linen;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = palette.oakDeep;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(64, 64, 13, 0, Math.PI * 2);
  ctx.fillStyle = palette.oakDeep;
  ctx.fill();
  sharedTexture = new CanvasTexture(canvas);
  sharedTexture.colorSpace = SRGBColorSpace;
  return sharedTexture;
}

/** A marker sprite tagged with `zoneId`, so tapping it counts as tapping the spot. */
export function markerSprite(zoneId: string): Sprite {
  const sprite = new Sprite(new SpriteMaterial({ map: markerTexture(), transparent: true, depthWrite: false }));
  sprite.scale.setScalar(SIZE);
  sprite.renderOrder = 10;
  sprite.userData.zoneId = zoneId;
  sprite.userData.animated = true;
  return sprite;
}

/** Floating markers that show which spots can be tapped. */
export function buildZoneMarkers(zones: Zone[]): { group: Group; markers: ZoneMarker[] } {
  const group = new Group();
  group.name = "zone-markers";
  const markers = zones.map((zone, index): ZoneMarker => {
    const along = ANCHOR_ALONG[zone.kind] ?? 0;
    const { faceX, faceZ, x, z } = zone.approach;
    const sprite = markerSprite(zone.id);
    const baseY = ANCHOR_HEIGHT[zone.kind];
    sprite.position.set(faceX + (x - faceX) * along, baseY, faceZ + (z - faceZ) * along);
    group.add(sprite);
    return { zoneId: zone.id, sprite, baseY, phase: index * 0.7 };
  });
  return { group, markers };
}

/** Gentle bob for all markers; the spot the guest is at grows and pulses so it reads as "tap here". */
export function animateMarkers(markers: ZoneMarker[], activeZoneId: string | null, time: number): void {
  for (const marker of markers) {
    const active = marker.zoneId === activeZoneId;
    marker.sprite.position.y = marker.baseY + Math.sin(time * 2.2 + marker.phase) * 0.035;
    const scale = active ? SIZE * (1.45 + Math.sin(time * 5) * 0.12) : SIZE;
    marker.sprite.scale.setScalar(scale);
  }
}
