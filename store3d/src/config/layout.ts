// Floor plan "bản 2" in metres. Origin = shop centre, +x = right wall, +z = front (street) wall.
// The guest enters at the front and looks towards -z (back wall with fitting rooms and counter).

export type Rect = { x0: number; x1: number; z0: number; z1: number };
export type Circle = { x: number; z: number; r: number };
export type Point = { x: number; z: number };

export const ROOM = { halfWidth: 5.75, halfDepth: 4.5, height: 4.6, wall: 0.18 } as const;

export const DOOR = { x0: -0.75, x1: 0.75, height: 2.45 } as const;

/** The street in front of the shop: pavement up to the kerb, the road, then the riverside walk. */
export const STREET = { kerb: ROOM.halfDepth + 2.6, far: ROOM.halfDepth + 8.6 } as const;
/** Where the guest can walk outside: from the shop front to the riverside railing. */
export const OUTDOOR = { halfWidth: 16, zMax: STREET.far + 3.9 } as const;
export const FRONT_WINDOWS = [
  { x0: -5.1, x1: -1.25 },
  { x0: 1.25, x1: 5.1 },
] as const;
export const WINDOW = { sill: 0.55, top: 2.55 } as const;

/** Clothing wall on the left: two runs split by a full-length mirror, one hanging set per product in
    catalog order (front to back), a low cabinet with folded stock below. */
export const SHELVING = {
  wallX: -ROOM.halfWidth,
  /** Cabinet depth (also the walkable edge). */
  depth: 0.45,
  height: 2.35,
  railY: 1.95,
  cabinetHeight: 0.55,
  runs: [
    { zFrom: 3.55, zTo: 1.0 },
    { zFrom: 0.1, zTo: -2.5 },
  ],
} as const;

export const MIRRORS = {
  /** Flat wall mirrors (one between the shelf runs, one at the front end, one on the right wall). */
  wall: [
    { x: -ROOM.halfWidth + 0.03, z: 0.55, width: 0.62, height: 1.85, facing: 1 },
    { x: -ROOM.halfWidth + 0.03, z: 4.02, width: 0.5, height: 1.75, facing: 1 },
    { x: ROOM.halfWidth - 0.03, z: -0.25, width: 1.3, height: 1.85, facing: -1 },
  ],
  /** Arched photo mirror on the back wall next to the fitting rooms. */
  photo: { x: -1.25, z: -ROOM.halfDepth + 0.03, width: 0.9, height: 2.0 },
} as const;

export const FITTING_ROOMS = {
  booths: [
    { x0: -5.55, x1: -3.9 },
    { x0: -3.75, x1: -2.1 },
  ],
  z0: -ROOM.halfDepth,
  z1: -3.0,
  height: 2.45,
} as const;

export const COUNTER = {
  main: { x0: 2.0, x1: 5.65, z0: -3.4, z1: -2.85 },
  side: { x0: 5.15, x1: 5.65, z0: -2.85, z1: -1.5 },
  height: 0.98,
  backShelf: { x0: 2.4, x1: 5.0, z0: -ROOM.halfDepth, z1: -4.18, height: 1.85 },
  owner: { x: 3.55, z: -3.85 },
} as const;

export const SCRUNCHIE_STAND = { x: 1.375, z: -2.2 } as const;
export const PODIUM = { x: -0.25, z: 0.15, outer: 1.15, inner: 0.62 } as const;
export const RUG = { x: -0.25, z: 0.2, rx: 2.7, rz: 1.85 } as const;

const TEA_TABLE = { x: 4.45, z: 2.95 } as const;
/** Two armchairs turned towards the tea table (chair front = local +z). */
const facingTable = (x: number, z: number) => ({ x, z, yaw: Math.atan2(TEA_TABLE.x - x, TEA_TABLE.z - z) });
export const LOUNGE = {
  chairs: [facingTable(3.75, 2.25), facingTable(5.1, 2.25)],
  table: TEA_TABLE,
} as const;

export const CAT_SEAT = { x0: 2.9, x1: 5.5, z0: 3.78, z1: 4.32, height: 0.46, bed: { x: 4.25, z: 4.05 } } as const;
export const MANNEQUINS = [
  { x: -3.75, z: 3.75 },
  { x: -2.5, z: 3.75 },
] as const;
/** Back wall between the photo mirror and the counter: policy board above a slim console with flowers. */
export const POLICY_BOARD = { x: 0.55, y: 1.66, width: 1.45, height: 1.42 } as const;
export const CONSOLE = { x0: 0.05, x1: 1.05, depth: 0.32, height: 0.78 } as const;
/** Right wall above the lounge: the "sleep well" print and three decor prints. */
export const WALL_FRAMES = { x: ROOM.halfWidth, y: 1.65, art: { z: 1.2 }, prints: [{ z: 2.05 }, { z: 2.8 }, { z: 3.55 }] } as const;

/** Potted plants, kept out of the sight lines to the clothing wall and the mannequins. */
export const PLANTS = [
  { x: 5.35, z: 1.0, size: 1.15 },
  { x: 1.75, z: -4.1, size: 0.9 },
] as const;
/** Pendant shades hang at this height whatever the ceiling height. */
export const PENDANT_Y = 2.75;
export const PENDANTS = [
  { x: -0.25, z: 0.15 },
  { x: 3.0, z: -2.6 },
  { x: 4.6, z: -2.6 },
] as const;

export const PLAYER_START = { x: 0, z: 3.3, yaw: Math.PI } as const;

/** Min walks a full loop of the shop and returns to her window seat. `pause` = seconds range to linger. */
export const CAT_ROUTE: ReadonlyArray<Point & { pause?: readonly [number, number] }> = [
  // Her bed by the window: the long nap.
  { x: 4.25, z: 3.98, pause: [35, 60] },
  { x: 3.05, z: 1.0, pause: [5, 9] },
  { x: 4.1, z: -1.0 },
  { x: 4.35, z: -1.95, pause: [6, 11] },
  { x: 1.75, z: -1.6, pause: [5, 9] },
  { x: -1.0, z: -2.6 },
  { x: -2.6, z: -2.65, pause: [5, 9] },
  { x: -3.75, z: -2.15 },
  { x: -4.15, z: 0.55, pause: [5, 8] },
  { x: -4.1, z: 2.0 },
  { x: -3.1, z: 3.35, pause: [6, 10] },
  { x: 0, z: 3.3 },
];

/** Static obstacles for the guest (and a sanity reference for Min's route). */
export const OBSTACLE_RECTS: readonly Rect[] = [
  ...SHELVING.runs.map((run) => ({ x0: -ROOM.halfWidth, x1: -ROOM.halfWidth + SHELVING.depth + 0.05, z0: run.zTo, z1: run.zFrom })),
  { x0: -ROOM.halfWidth, x1: FITTING_ROOMS.booths[1].x1 + 0.05, z0: -ROOM.halfDepth, z1: FITTING_ROOMS.z1 },
  COUNTER.main,
  COUNTER.side,
  { x0: COUNTER.main.x0, x1: ROOM.halfWidth, z0: -ROOM.halfDepth, z1: COUNTER.main.z0 },
  { x0: CAT_SEAT.x0, x1: CAT_SEAT.x1, z0: CAT_SEAT.z0, z1: ROOM.halfDepth },
  { x0: CONSOLE.x0, x1: CONSOLE.x1, z0: -ROOM.halfDepth, z1: -ROOM.halfDepth + CONSOLE.depth + 0.05 },
];

/** Outside: window planters, the bench, neighbouring house fronts. */
export const OUTDOOR_RECTS: readonly Rect[] = [
  ...FRONT_WINDOWS.map((w) => ({ x0: w.x0 + 0.15, x1: w.x1 - 0.15, z0: ROOM.halfDepth + ROOM.wall, z1: ROOM.halfDepth + ROOM.wall + 0.36 })),
  { x0: -4.15, x1: -2.65, z0: STREET.kerb - 1.12, z1: STREET.kerb - 0.66 },
  { x0: -30, x1: -6.8, z0: ROOM.halfDepth, z1: ROOM.halfDepth + 0.35 },
  { x0: 6.8, x1: 30, z0: ROOM.halfDepth, z1: ROOM.halfDepth + 0.35 },
];
/** Outside: lamp posts, street trees and riverside palms (trunks). */
export const OUTDOOR_CIRCLES: readonly Circle[] = [
  ...[-5.3, 3.2, 11.7].map((x) => ({ x, z: STREET.kerb - 0.45, r: 0.12 })),
  ...[-13, -9.5, 8.5, 12.5].map((x) => ({ x, z: STREET.kerb - 0.6, r: 0.2 })),
  ...[-22, -12, -2, 8, 17, 36].map((x) => ({ x, z: STREET.far + 2.7, r: 0.2 })),
];

export const OBSTACLE_CIRCLES: readonly Circle[] = [
  { x: PODIUM.x, z: PODIUM.z, r: PODIUM.outer + 0.05 },
  { x: SCRUNCHIE_STAND.x, z: SCRUNCHIE_STAND.z, r: 0.32 },
  ...LOUNGE.chairs.map((c) => ({ x: c.x, z: c.z, r: 0.45 })),
  { x: LOUNGE.table.x, z: LOUNGE.table.z, r: 0.33 },
  ...MANNEQUINS.map((m) => ({ x: m.x, z: m.z, r: 0.3 })),
  ...PLANTS.map((p) => ({ x: p.x, z: p.z, r: 0.32 * p.size })),
];
