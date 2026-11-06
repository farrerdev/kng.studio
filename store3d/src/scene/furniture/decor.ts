import {
  Vector3,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
} from "three";
import { ACCENT_LIGHTS, CAT_SEAT, LOUNGE, MIRRORS, PENDANTS, PENDANT_Y, PLANTS, ROOM, RUG } from "../../config/layout";
import { palette } from "../../config/palette";
import { mesh, slab, softBox, tagZone } from "../build";
import { labelTexture, mirrorTexture } from "../canvasArt";
import type { MaterialLibrary } from "../materials";

export const LOUNGE_ZONE = "lounge";
export const CAT_SEAT_ZONE = "cat-seat";

export function buildDecor(materials: MaterialLibrary): Group {
  const group = new Group();
  group.name = "decor";
  group.add(buildRug(materials), buildMirrors(materials), buildLounge(materials), buildCatSeat(materials), buildPlants(materials));
  group.add(buildPendants(materials), buildTrackLights(materials));
  return group;
}

function buildRug(materials: MaterialLibrary): Group {
  const group = new Group();
  const rug = mesh(new CircleGeometry(1, 64), materials.surface(palette.sandDeep, { roughness: 1 }), [RUG.x, 0.006, RUG.z], group, {
    castShadow: false,
  });
  rug.rotation.x = -Math.PI / 2;
  rug.scale.set(RUG.rx, RUG.rz, 1);
  const border = mesh(new CircleGeometry(1, 64), materials.surface(palette.oat, { roughness: 1 }), [RUG.x, 0.004, RUG.z], group, {
    castShadow: false,
  });
  border.rotation.x = -Math.PI / 2;
  border.scale.set(RUG.rx + 0.08, RUG.rz + 0.08, 1);
  return group;
}

function buildMirrors(materials: MaterialLibrary): Group {
  const group = new Group();
  const glass = new MeshBasicMaterial({ map: mirrorTexture() });
  const brass = materials.brass();

  MIRRORS.wall.forEach((spec) => {
    const mirror = new Group();
    mirror.position.set(spec.x, 0, spec.z);
    mirror.rotation.y = spec.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(mirror);
    mesh(new PlaneGeometry(spec.width, spec.height), glass, [0, 0.15 + spec.height / 2, 0.012], mirror, { castShadow: false });
    slab(brass, -spec.width / 2 - 0.03, spec.width / 2 + 0.03, 0.12, 0.15, -0.01, 0.03, mirror, { castShadow: false });
    slab(brass, -spec.width / 2 - 0.03, spec.width / 2 + 0.03, 0.15 + spec.height, 0.18 + spec.height, -0.01, 0.03, mirror, { castShadow: false });
    for (const side of [-1, 1]) {
      slab(brass, side * (spec.width / 2) - 0.03, side * (spec.width / 2), 0.12, 0.18 + spec.height, -0.01, 0.03, mirror, { castShadow: false });
    }
  });

  // Arched mirror (decor) with a small olive garland.
  const { x, z, width, height } = MIRRORS.photo;
  const arch = new Shape();
  const r = width / 2;
  arch.moveTo(-r, 0);
  arch.lineTo(-r, height - r);
  arch.absarc(0, height - r, r, Math.PI, 0, true);
  arch.lineTo(r, 0);
  arch.lineTo(-r, 0);
  const frame = new Shape();
  const fr = r + 0.06;
  frame.moveTo(-fr, -0.06);
  frame.lineTo(-fr, height - r);
  frame.absarc(0, height - r, fr, Math.PI, 0, true);
  frame.lineTo(fr, -0.06);
  frame.lineTo(-fr, -0.06);
  const photo = new Group();
  photo.position.set(x, 0.25, z);
  group.add(photo);
  mesh(new ShapeGeometry(frame, 24), brass, [0, 0, 0.005], photo, { castShadow: false });
  mesh(new ShapeGeometry(arch, 24), glass, [0, 0, 0.012], photo, { castShadow: false });
  const leaf = materials.surface(palette.olive, { roughness: 1 });
  for (let i = 0; i <= 10; i += 1) {
    const a = Math.PI - (i / 10) * Math.PI;
    const berry = mesh(new SphereGeometry(0.035, 8, 6), leaf, [Math.cos(a) * (fr + 0.02), height - r + Math.sin(a) * (fr + 0.02), 0.03], photo, { castShadow: false });
    berry.scale.set(1, 0.6, 0.6);
    berry.rotation.z = a;
  }
  return group;
}

function buildLounge(materials: MaterialLibrary): Group {
  const group = new Group();
  const boucle = materials.surface("#F4EFE7", { roughness: 1 });
  const oak = materials.surface(palette.oakDeep, { roughness: 0.6 });
  for (const chair of LOUNGE.chairs) {
    const seat = new Group();
    seat.position.set(chair.x, 0, chair.z);
    seat.rotation.y = chair.yaw;
    group.add(seat);
    softBox(boucle, [0.72, 0.32, 0.66], [0, 0.3, 0], seat, 0.12);
    softBox(boucle, [0.74, 0.46, 0.2], [0, 0.6, -0.26], seat, 0.1);
    softBox(boucle, [0.16, 0.3, 0.6], [-0.33, 0.52, 0], seat, 0.08);
    softBox(boucle, [0.16, 0.3, 0.6], [0.33, 0.52, 0], seat, 0.08);
    softBox(materials.surface(palette.oat, { roughness: 1 }), [0.34, 0.16, 0.1], [0.05, 0.6, -0.12], seat, 0.06);
    for (const [lx, lz] of [[-0.28, -0.25], [0.28, -0.25], [-0.28, 0.25], [0.28, 0.25]] as const) {
      mesh(new CylinderGeometry(0.02, 0.018, 0.14, 8), oak, [lx, 0.07, lz], seat);
    }
  }
  const { x, z } = LOUNGE.table;
  mesh(new CylinderGeometry(0.32, 0.32, 0.035, 36), oak, [x, 0.55, z], group);
  mesh(new CylinderGeometry(0.035, 0.05, 0.53, 12), oak, [x, 0.27, z], group);
  mesh(new CylinderGeometry(0.18, 0.2, 0.02, 24), oak, [x, 0.01, z], group);
  const ceramic = materials.surface(palette.linen, { roughness: 0.35 });
  mesh(new SphereGeometry(0.075, 18, 12), ceramic, [x - 0.06, 0.63, z + 0.02], group).scale.set(1, 0.8, 1);
  mesh(new CylinderGeometry(0.012, 0.016, 0.08, 8), ceramic, [x + 0.02, 0.65, z + 0.02], group).rotation.z = -0.9;
  for (const [cx, cz] of [[0.14, -0.08], [0.1, 0.14]] as const) {
    mesh(new CylinderGeometry(0.035, 0.028, 0.05, 14), ceramic, [x + cx, 0.595, z + cz], group);
  }
  // Small candle with a warm flame.
  mesh(new CylinderGeometry(0.03, 0.03, 0.06, 12), materials.surface(palette.butter), [x - 0.14, 0.6, z - 0.12], group);
  mesh(new SphereGeometry(0.012, 8, 6), materials.surface("#FFE2A8", { emissive: "#FFC97A", emissiveIntensity: 2 }), [x - 0.14, 0.645, z - 0.12], group, {
    castShadow: false,
  }).scale.set(1, 1.6, 1);
  tagZone(group, LOUNGE_ZONE);
  return group;
}

/** Min's window seat: cushioned bench with a round cat bed. */
function buildCatSeat(materials: MaterialLibrary): Group {
  const group = new Group();
  const oak = materials.surface(palette.oak, { roughness: 0.65 });
  const { x0, x1, z0, z1, height, bed } = CAT_SEAT;
  slab(oak, x0, x1, 0, height - 0.06, z0, z1, group);
  softBox(materials.surface(palette.linen, { roughness: 1 }), [x1 - x0 - 0.04, 0.08, z1 - z0 - 0.04], [(x0 + x1) / 2, height - 0.02, (z0 + z1) / 2], group, 0.03);
  const ring = mesh(new TorusGeometry(0.2, 0.07, 12, 28), materials.surface(palette.oat, { roughness: 1 }), [bed.x, height + 0.06, bed.z], group);
  ring.rotation.x = Math.PI / 2;
  mesh(new CylinderGeometry(0.2, 0.2, 0.04, 24), materials.surface(palette.rose, { roughness: 1 }), [bed.x, height + 0.03, bed.z], group);
  const nameTag = mesh(
    new PlaneGeometry(0.34, 0.1),
    new MeshBasicMaterial({ map: labelTexture("Min", { background: palette.linen, radius: 40 }), transparent: true }),
    [bed.x, height - 0.2, z0 - 0.005],
    group,
    { castShadow: false, receiveShadow: false },
  );
  nameTag.rotation.y = Math.PI;
  tagZone(group, CAT_SEAT_ZONE);
  return group;
}

function buildPlants(materials: MaterialLibrary): Group {
  const group = new Group();
  const pot = materials.surface(palette.linen, { roughness: 0.45 });
  const leafA = materials.surface(palette.olive, { roughness: 1 });
  const leafB = materials.surface(palette.oliveDeep, { roughness: 1 });
  const trunk = materials.surface(palette.oakDeep, { roughness: 1 });
  const leafGeometry = new IcosahedronGeometry(1, 1);
  for (const plant of PLANTS) {
    const s = plant.size;
    const g = new Group();
    g.position.set(plant.x, 0, plant.z);
    g.scale.setScalar(s);
    // Fades out when it stands between the camera and the guest (see StoreApp.updateOccluders).
    g.userData.occluder = { radius: 0.45 * s, height: 1.3 * s };
    group.add(g);
    mesh(new CylinderGeometry(0.2, 0.15, 0.4, 20), pot, [0, 0.2, 0], g);
    mesh(new CylinderGeometry(0.015, 0.025, 0.9, 6), trunk, [0, 0.82, 0], g);
    for (let i = 0; i < 7; i += 1) {
      const a = i * 2.4;
      const blob = mesh(leafGeometry, i % 2 ? leafA : leafB, [Math.cos(a) * 0.17, 1.05 + (i % 3) * 0.17, Math.sin(a) * 0.17], g);
      blob.scale.set(0.16, 0.11, 0.16);
    }
  }
  return group;
}

function buildPendants(materials: MaterialLibrary): Group {
  const group = new Group();
  const cord = materials.surface(palette.ink, { roughness: 0.6 });
  const shade = new MeshStandardMaterial({
    color: "#F4EBDD",
    roughness: 0.9,
    emissive: "#FFDFAE",
    emissiveIntensity: 0.55,
    userData: { glow: { day: 0.55, night: 1.6 } },
  });
  for (const pendant of PENDANTS) {
    const cordLength = ROOM.height - PENDANT_Y - 0.12;
    mesh(new CylinderGeometry(0.006, 0.006, cordLength, 5), cord, [pendant.x, ROOM.height - cordLength / 2, pendant.z], group, { castShadow: false });
    mesh(new CylinderGeometry(0.06, 0.06, 0.02, 16), cord, [pendant.x, ROOM.height - 0.01, pendant.z], group, { castShadow: false });
    mesh(new ConeGeometry(0.26, 0.24, 28, 1, true), shade, [pendant.x, PENDANT_Y, pendant.z], group, { castShadow: false });
  }
  return group;
}

/** Small ceiling spot heads aimed at the products; their lenses glow in the evening. */
function buildTrackLights(materials: MaterialLibrary): Group {
  const group = new Group();
  group.name = "track-lights";
  const housing = materials.surface(palette.ink, { roughness: 0.5, metalness: 0.3 });
  const lens = new MeshStandardMaterial({ color: "#FFF4DE", emissive: "#FFE2B0", emissiveIntensity: 1.6, userData: { glow: { day: 1.6, night: 3 } } });
  const up = new Vector3(0, 1, 0);
  for (const accent of ACCENT_LIGHTS) {
    const head = new Group();
    head.position.set(...accent.at);
    // Point the head's -Y axis (its lens) at the target.
    const direction = new Vector3(...accent.aim).sub(head.position).normalize();
    head.quaternion.setFromUnitVectors(up, direction.negate());
    group.add(head);
    mesh(new CylinderGeometry(0.012, 0.012, 0.22, 6), housing, [0, 0.11, 0], head, { castShadow: false });
    mesh(new CylinderGeometry(0.065, 0.05, 0.16, 14), housing, [0, -0.04, 0], head, { castShadow: false });
    mesh(new CircleGeometry(0.048, 14), lens, [0, -0.121, 0], head, { castShadow: false }).rotation.x = Math.PI / 2;
  }
  return group;
}
