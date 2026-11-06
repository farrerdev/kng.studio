import { CAT_SEAT, COUNTER, FITTING_ROOMS, LOUNGE, MANNEQUINS, MIRRORS, PODIUM, POLICY_BOARD, ROOM, SCRUNCHIE_STAND, SHELVING } from "../config/layout";
import type { StoreProduct } from "../data/types";
import { COUNTER_ZONE } from "../scene/furniture/counter";
import { CAT_SEAT_ZONE, LOUNGE_ZONE, MIRROR_ZONE_PREFIX, PHOTO_ZONE } from "../scene/furniture/decor";
import { MANNEQUIN_ZONE, PODIUM_ZONE, SCRUNCHIE_ZONE } from "../scene/furniture/displays";
import { FITTING_ZONE } from "../scene/furniture/fittingRooms";
import { POLICY_ZONE } from "../scene/furniture/wallDecor";
import type { ShelfSection } from "../scene/furniture/shelving";

export type ZoneKind = "shelf" | "popular" | "counter" | "fitting" | "mirror" | "scrunchies" | "lounge" | "mannequins" | "cat-seat" | "policy" | "door-out" | "door-in";

export type Zone = {
  id: string;
  kind: ZoneKind;
  /** Where the guest stands to use this spot (also the walk target when it is tapped). */
  approach: { x: number; z: number; faceX: number; faceZ: number };
  /** Activation area around the approach point. */
  radius: number;
  /** Optional activation ring around a round display instead (any side counts). */
  area?: { x: number; z: number; r: number };
  /** Shelf sections: the product on that section. */
  product?: StoreProduct | null;
};

export function buildZones(sections: ShelfSection[]): Zone[] {
  const shelfX = SHELVING.wallX + SHELVING.depth + 0.55;
  const zones: Zone[] = sections.map((section) => ({
    id: section.zoneId,
    kind: "shelf",
    approach: { x: shelfX, z: section.center, faceX: SHELVING.wallX, faceZ: section.center },
    // Neighbouring sections overlap; zoneAt picks the closest, i.e. the section the guest faces.
    radius: Math.max(0.65, (section.zFrom - section.zTo) / 2 + 0.15),
    product: section.product,
  }));

  const fittingFront = FITTING_ROOMS.z1 + 0.55;
  const fittingX = (FITTING_ROOMS.booths[0].x0 + FITTING_ROOMS.booths[1].x1) / 2;
  zones.push(
    {
      id: PODIUM_ZONE,
      kind: "popular",
      approach: { x: PODIUM.x, z: PODIUM.z + PODIUM.outer + 0.45, faceX: PODIUM.x, faceZ: PODIUM.z },
      radius: 1.15,
      area: { x: PODIUM.x, z: PODIUM.z, r: PODIUM.outer + 0.85 },
    },
    {
      id: COUNTER_ZONE,
      kind: "counter",
      approach: { x: COUNTER.owner.x, z: COUNTER.main.z1 + 0.5, faceX: COUNTER.owner.x, faceZ: COUNTER.owner.z },
      radius: 1.1,
    },
    {
      id: FITTING_ZONE,
      kind: "fitting",
      approach: { x: fittingX, z: fittingFront, faceX: fittingX, faceZ: FITTING_ROOMS.z0 },
      radius: 1.25,
    },
    {
      id: PHOTO_ZONE,
      kind: "mirror",
      approach: { x: MIRRORS.photo.x, z: MIRRORS.photo.z + 1.5, faceX: MIRRORS.photo.x, faceZ: MIRRORS.photo.z },
      radius: 0.75,
    },
    ...MIRRORS.wall.map((mirror, index) => ({
      id: `${MIRROR_ZONE_PREFIX}${index}`,
      kind: "mirror" as const,
      approach: { x: mirror.x + mirror.facing * 1.2, z: mirror.z, faceX: mirror.x, faceZ: mirror.z },
      radius: 0.55,
    })),
    {
      id: SCRUNCHIE_ZONE,
      kind: "scrunchies",
      approach: { x: SCRUNCHIE_STAND.x - 0.1, z: SCRUNCHIE_STAND.z + 0.7, faceX: SCRUNCHIE_STAND.x, faceZ: SCRUNCHIE_STAND.z },
      radius: 0.7,
    },
    {
      id: LOUNGE_ZONE,
      kind: "lounge",
      approach: { x: LOUNGE.table.x - 0.85, z: LOUNGE.table.z + 0.05, faceX: LOUNGE.table.x, faceZ: LOUNGE.table.z },
      radius: 0.95,
    },
    {
      id: MANNEQUIN_ZONE,
      kind: "mannequins",
      approach: {
        x: (MANNEQUINS[0].x + MANNEQUINS[1].x) / 2,
        z: MANNEQUINS[0].z - 0.85,
        faceX: (MANNEQUINS[0].x + MANNEQUINS[1].x) / 2,
        faceZ: MANNEQUINS[0].z,
      },
      radius: 0.9,
    },
    // The front door, from inside (go out to the street) and from the pavement (come back in).
    {
      id: "door-out",
      kind: "door-out",
      approach: { x: 0, z: ROOM.halfDepth - 0.7, faceX: 0, faceZ: ROOM.halfDepth + 2 },
      radius: 0.45,
    },
    {
      id: "door-in",
      kind: "door-in",
      approach: { x: 0, z: ROOM.halfDepth + ROOM.wall + 1.0, faceX: 0, faceZ: ROOM.halfDepth - 2 },
      radius: 0.7,
    },
    {
      id: POLICY_ZONE,
      kind: "policy",
      approach: { x: POLICY_BOARD.x, z: -ROOM.halfDepth + 1.2, faceX: POLICY_BOARD.x, faceZ: -ROOM.halfDepth },
      radius: 0.75,
    },
    {
      id: CAT_SEAT_ZONE,
      kind: "cat-seat",
      approach: { x: CAT_SEAT.bed.x - 0.95, z: CAT_SEAT.z0 - 0.45, faceX: CAT_SEAT.bed.x, faceZ: CAT_SEAT.bed.z },
      radius: 0.75,
    },
  );
  return zones;
}

/** The closest zone whose activation area contains the guest, or null. */
export function zoneAt(zones: Zone[], x: number, z: number): Zone | null {
  let best: Zone | null = null;
  let bestDistance = Infinity;
  for (const zone of zones) {
    const center = zone.area ?? zone.approach;
    const radius = zone.area?.r ?? zone.radius;
    const score = Math.hypot(x - center.x, z - center.z) / radius;
    if (score <= 1 && score < bestDistance) {
      best = zone;
      bestDistance = score;
    }
  }
  return best;
}
