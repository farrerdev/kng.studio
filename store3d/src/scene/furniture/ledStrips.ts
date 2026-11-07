import { AdditiveBlending, CanvasTexture, CylinderGeometry, DoubleSide, Group, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, TorusGeometry } from "three";
import { CAT_SEAT, COUNTER, FITTING_ROOMS, PODIUM, ROOM, SHELVING } from "../../config/layout";
import { mesh, slab } from "../build";

const quiet = { castShadow: false, receiveShadow: false } as const;

/**
 * Warm-white LED strips tucked under edges and along the ceiling: they glow softly by day and
 * light up in the evening (StoreApp lerps `userData.glow`).
 */
export function buildLedStrips(): Group {
  const group = new Group();
  group.name = "led-strips";
  const led = new MeshStandardMaterial({
    // Warm white, like a lamp: bright, only a hint of yellow.
    color: "#FFF8EC",
    emissive: "#FFEBCB",
    emissiveIntensity: 1.6,
    roughness: 0.4,
    // Full colour: tone mapping would wash the yellow out against the bright linen walls.
    toneMapped: false,
    userData: { glow: { day: 1.6, night: 3.2 } },
  });
  const t = 0.018; // strip thickness
  const wash = new MeshBasicMaterial({
    map: haloTexture(),
    color: "#FFE9C8",
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
  });
  /** Soft light spilling from a strip: a plane fading away from its `base` edge. */
  const halo = (width: number, height: number, at: [number, number, number], rotation: [number, number, number]) => {
    const plane = mesh(new PlaneGeometry(width, height), wash, at, group, quiet);
    plane.rotation.set(...rotation);
    plane.renderOrder = 2;
  };

  // Ceiling cove all around the room, a little below the ceiling.
  const coveY = ROOM.height - 0.32;
  const hw = ROOM.halfWidth - 0.02;
  const hd = ROOM.halfDepth - 0.02;
  slab(led, -hw, -hw + t, coveY, coveY + 0.03, -hd, hd, group, quiet);
  slab(led, hw - t, hw, coveY, coveY + 0.03, -hd, hd, group, quiet);
  slab(led, -hw, hw, coveY, coveY + 0.03, -hd, -hd + t, group, quiet);
  slab(led, -hw, hw, coveY, coveY + 0.03, hd - t, hd, group, quiet);
  // Light washing up the walls from the cove (texture fades towards +v = up).
  const washH = 0.32;
  halo(2 * hd, washH, [-hw + 0.012, coveY + 0.03 + washH / 2, 0], [0, Math.PI / 2, 0]);
  halo(2 * hd, washH, [hw - 0.012, coveY + 0.03 + washH / 2, 0], [0, -Math.PI / 2, 0]);
  halo(2 * hw, washH, [0, coveY + 0.03 + washH / 2, -hd + 0.012], [0, 0, 0]);
  halo(2 * hw, washH, [0, coveY + 0.03 + washH / 2, hd - 0.012], [0, Math.PI, 0]);

  // Cashier counter: under the worktop's lip and a glowing line along the floor.
  const { main, side, height } = COUNTER;
  slab(led, main.x0, main.x1, height - 0.06, height - 0.045, main.z1 + 0.012, main.z1 + 0.026, group, quiet);
  slab(led, side.x0 - 0.026, side.x0 - 0.012, height - 0.06, height - 0.045, side.z0, side.z1, group, quiet);
  slab(led, main.x0, side.x0, 0.012, 0.022, main.z1 + 0.004, main.z1 + 0.016, group, quiet);
  slab(led, side.x0 - 0.016, side.x0 - 0.004, 0.012, 0.022, side.z0, side.z1, group, quiet);
  // Glow down the fluted front and onto the floor in front of the counter.
  halo(main.x1 - main.x0, 0.28, [(main.x0 + main.x1) / 2, height - 0.19, main.z1 + 0.006], [Math.PI, 0, 0]);
  halo(side.x0 - main.x0, 0.35, [(main.x0 + side.x0) / 2, 0.004, main.z1 + 0.18], [-Math.PI / 2, 0, Math.PI]);

  // Podium: a ring of light under each tier's rim.
  for (const [radius, y] of [
    [PODIUM.outer + 0.012, 0.405],
    [PODIUM.inner + 0.012, 0.795],
  ] as const) {
    const ring = mesh(new TorusGeometry(radius, 0.007, 6, 72), led, [PODIUM.x, y, PODIUM.z], group, quiet);
    ring.rotation.x = Math.PI / 2;
  }

  // Clothing wall: a floor line under the cabinets.
  const front = SHELVING.wallX + SHELVING.depth;
  for (const run of SHELVING.runs) {
    slab(led, front + 0.004, front + 0.016, 0.012, 0.022, run.zTo, run.zFrom, group, quiet);
    halo(run.zFrom - run.zTo, 0.3, [front + 0.16, 0.004, (run.zFrom + run.zTo) / 2], [-Math.PI / 2, 0, -Math.PI / 2]);
  }

  // Fitting rooms: soft line along the top of the curtains.
  for (const booth of FITTING_ROOMS.booths) {
    slab(led, booth.x0, booth.x1, FITTING_ROOMS.height - 0.05, FITTING_ROOMS.height - 0.035, FITTING_ROOMS.z1 + 0.05, FITTING_ROOMS.z1 + 0.062, group, quiet);
  }

  // Min's window seat: glow under the bench.
  slab(led, CAT_SEAT.x0 + 0.05, CAT_SEAT.x1 - 0.05, 0.03, 0.042, CAT_SEAT.z0 - 0.014, CAT_SEAT.z0 - 0.002, group, quiet);
  halo(CAT_SEAT.x1 - CAT_SEAT.x0 - 0.1, 0.3, [(CAT_SEAT.x0 + CAT_SEAT.x1) / 2, 0.004, CAT_SEAT.z0 - 0.15], [-Math.PI / 2, 0, 0]);

  // Short glowing posts at the ends of the clothing runs, like little shelf lamps.
  for (const run of SHELVING.runs) {
    for (const z of [run.zFrom - 0.06, run.zTo + 0.06]) {
      mesh(new CylinderGeometry(0.008, 0.008, SHELVING.height - SHELVING.cabinetHeight - 0.1, 8), led, [SHELVING.wallX + 0.08, (SHELVING.height + SHELVING.cabinetHeight) / 2, z], group, quiet);
    }
  }
  return group;
}

/** Vertical gradient, bright at the bottom edge (v = 0) fading to nothing at the top. */
function haloTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 64, 0, 0);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.25, "rgba(255,255,255,0.45)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 64);
  return new CanvasTexture(canvas);
}
