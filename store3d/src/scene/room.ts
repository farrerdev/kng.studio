import {
  CanvasTexture,
  DoubleSide,
  Group,
  type Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Vector3,
} from "three";
import { DOOR, FRONT_WINDOWS, ROOM, WINDOW } from "../config/layout";
import { palette } from "../config/palette";
import { mesh, slab } from "./build";
import { plankTexture } from "./canvasArt";
import type { MaterialLibrary } from "./materials";

/** A wall shell that turns see-through when the orbit camera swings behind it. */
export type FadeWall = {
  group: Group;
  materials: Material[];
  isBehindCamera: (camera: Vector3) => boolean;
  opacity: number;
};

const { halfWidth: W, halfDepth: D, height: H, wall: T } = ROOM;

/** The glass double door: two leaves hinged at the frame, swung open for the guest's entrance. */
export type FrontDoor = { leaves: Group[]; setOpen: (amount: number) => void };

export function buildRoom(materials: MaterialLibrary): { group: Group; walls: FadeWall[]; door: FrontDoor; roof: Group } {
  const group = new Group();
  group.name = "room";

  const floorTexture = plankTexture();
  floorTexture.repeat.set(W / 1.6, D / 1.6);
  const floor = mesh(
    new PlaneGeometry(W * 2, D * 2),
    new MeshStandardMaterial({ map: floorTexture, roughness: 0.82 }),
    [0, 0, 0],
    group,
    { castShadow: false },
  );
  floor.rotation.x = -Math.PI / 2;
  floor.userData.floor = true;

  // Pavement around the shop: the wider camera sees past the faded front wall, so it must not be a void.
  const pavement = mesh(
    new PlaneGeometry(60, 60),
    new MeshStandardMaterial({ color: palette.sandDeep, roughness: 0.95 }),
    [0, -0.01, 0],
    group,
    { castShadow: false },
  );
  pavement.rotation.x = -Math.PI / 2;

  group.add(buildCeiling());
  const roof = buildRoof();
  group.add(roof);

  const front = frontWall(materials);
  const walls = [sideWall(palette.linen, -1), sideWall(palette.linen, 1), backWall(), front.wall];
  for (const wall of walls) group.add(wall.group);
  return { group, walls, door: front.door, roof };
}

function fadeMaterial(color: string, roughness = 0.95): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness, transparent: true });
}

function sideWall(color: string, side: -1 | 1): FadeWall {
  const group = new Group();
  const wallMaterial = fadeMaterial(color);
  const trim = fadeMaterial(palette.sandDeep);
  const x = side * (W + T / 2);
  slab(wallMaterial, x - T / 2, x + T / 2, 0, H, -D - T, D + T, group, { castShadow: false });
  slab(trim, side * W - side * 0.02, side * W, 0, 0.12, -D, D, group, { castShadow: false });
  return {
    group,
    materials: [wallMaterial, trim],
    isBehindCamera: (camera) => camera.x * side > W - 0.2,
    opacity: 1,
  };
}

function backWall(): FadeWall {
  const group = new Group();
  const wallMaterial = fadeMaterial(palette.sand);
  const trim = fadeMaterial(palette.sandDeep);
  slab(wallMaterial, -W - T, W + T, 0, H, -D - T, -D, group, { castShadow: false });
  slab(trim, -W, W, 0, 0.12, -D, -D + 0.02, group, { castShadow: false });
  return { group, materials: [wallMaterial, trim], isBehindCamera: (camera) => camera.z < -D + 0.2, opacity: 1 };
}

/** Street wall: two big windows with linen curtains, glass door in the middle. */
function frontWall(materials: MaterialLibrary): { wall: FadeWall; door: FrontDoor } {
  const group = new Group();
  const wallMaterial = fadeMaterial(palette.linen);
  const frame = fadeMaterial(palette.oakDeep, 0.6);
  // Clear glass: the street outside is real 3D now, so the panes only tint it slightly.
  const glass = new MeshBasicMaterial({ color: "#DCE8EA", transparent: true, opacity: 0.22, depthWrite: false });
  glass.userData.depthWrite = false; // stays see-through even when the wall is solid
  const leaves: Group[] = [];
  const curtain = new MeshStandardMaterial({ color: palette.linen, roughness: 1, side: DoubleSide, transparent: true, opacity: 0.94 });
  const z0 = D;
  const z1 = D + T;

  const openings = [...FRONT_WINDOWS.map((w) => ({ ...w, y0: WINDOW.sill, y1: WINDOW.top })), { ...DOOR, y0: 0, y1: DOOR.height }].sort(
    (a, b) => a.x0 - b.x0,
  );
  let cursor = -W - T;
  for (const opening of openings) {
    slab(wallMaterial, cursor, opening.x0, 0, H, z0, z1, group, { castShadow: false });
    if (opening.y0 > 0) slab(wallMaterial, opening.x0, opening.x1, 0, opening.y0, z0, z1, group, { castShadow: false });
    slab(wallMaterial, opening.x0, opening.x1, opening.y1, H, z0, z1, group, { castShadow: false });

    const mid = (opening.x0 + opening.x1) / 2;
    if (opening.y0 === 0) {
      // Double door: each leaf hinged at its side of the frame, glass with an oak edge.
      const leafWidth = (opening.x1 - opening.x0) / 2;
      for (const side of [-1, 1] as const) {
        const hinge = new Group();
        hinge.position.set(side < 0 ? opening.x0 : opening.x1, 0, z0 + T * 0.6);
        hinge.userData.animated = true;
        hinge.userData.side = side;
        group.add(hinge);
        const centre = -side * (leafWidth / 2);
        const pane = mesh(new PlaneGeometry(leafWidth, opening.y1), glass, [centre, opening.y1 / 2, 0], hinge, { castShadow: false, receiveShadow: false });
        pane.rotation.y = Math.PI;
        slab(frame, centre - leafWidth / 2, centre + leafWidth / 2, 0, 0.05, -0.02, 0.02, hinge, { castShadow: false });
        slab(frame, -side * leafWidth - 0.025, -side * leafWidth + 0.025, 0, opening.y1, -0.02, 0.02, hinge, { castShadow: false });
        leaves.push(hinge);
      }
    } else {
      const pane = mesh(new PlaneGeometry(opening.x1 - opening.x0, opening.y1 - opening.y0), glass, [mid, (opening.y0 + opening.y1) / 2, z0 + T * 0.6], group, {
        castShadow: false,
        receiveShadow: false,
      });
      pane.rotation.y = Math.PI;
      slab(frame, mid - 0.025, mid + 0.025, opening.y0, opening.y1, z0 - 0.03, z0, group, { castShadow: false });
    }
    slab(frame, opening.x0, opening.x1, opening.y1 - 0.04, opening.y1, z0 - 0.03, z0, group, { castShadow: false });
    if (opening.y0 > 0) {
      slab(frame, opening.x0 - 0.04, opening.x1 + 0.04, opening.y0 - 0.03, opening.y0 + 0.03, z0 - 0.16, z0, group, {
        castShadow: false,
      });
      // Linen curtains gathered at both sides of each window.
      for (const side of [-1, 1] as const) {
        const x = side < 0 ? opening.x0 + 0.22 : opening.x1 - 0.22;
        const drape = mesh(wavyPlane(0.5, WINDOW.top + 0.3), curtain, [x, (WINDOW.top + 0.3) / 2, z0 - 0.12], group, {
          castShadow: false,
        });
        drape.rotation.y = Math.PI;
      }
      slab(materials.brass(), opening.x0 - 0.1, opening.x1 + 0.1, WINDOW.top + 0.28, WINDOW.top + 0.31, z0 - 0.14, z0 - 0.11, group, {
        castShadow: false,
      });
    }
    cursor = opening.x1;
  }
  slab(wallMaterial, cursor, W + T, 0, H, z0, z1, group, { castShadow: false });

  return {
    wall: {
      group,
      materials: [wallMaterial, frame, glass, curtain],
      isBehindCamera: (camera) => camera.z > D - 0.2,
      opacity: 1,
    },
    door: {
      leaves,
      // 0 = closed, 1 = open: leaves swing inwards.
      setOpen: (amount) => {
        for (const leaf of leaves) leaf.rotation.y = -(leaf.userData.side as number) * 1.35 * amount;
      },
    },
  };
}

/** Plane with soft vertical folds, used for curtains. */
export function wavyPlane(width: number, height: number, folds = 7, depth = 0.04): PlaneGeometry {
  const geometry = new PlaneGeometry(width, height, 24, 1);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i += 1) {
    const u = position.getX(i) / width + 0.5;
    position.setZ(i, Math.sin(u * Math.PI * 2 * folds) * depth);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Linen ceiling with soft oak beams, drawn on one plane that faces down: seen whenever the camera
 * is below it (inside the shop, or looking in from the doorway), culled when the camera is above,
 * so it never hides the room from the overview.
 */
function buildCeiling(): Group {
  const group = new Group();
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#F4EFE7";
  ctx.fillRect(0, 0, 512, 512);
  // Beams across the width, with a soft shadow edge.
  for (let i = 0; i < 6; i += 1) {
    const y = 30 + i * 90;
    ctx.fillStyle = "rgba(120, 90, 60, 0.12)";
    ctx.fillRect(0, y + 22, 512, 6);
    ctx.fillStyle = "#D8BFA2";
    ctx.fillRect(0, y, 512, 22);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const ceiling = mesh(new PlaneGeometry(2 * (W + T), 2 * (D + T)), new MeshStandardMaterial({ map: texture, roughness: 1 }), [0, H, 0], group, {
    castShadow: false,
    receiveShadow: false,
  });
  ceiling.rotation.x = Math.PI / 2; // faces down
  return group;
}

/** Flat roof with a low parapet, facing up: covers the shop when seen from the street. */
function buildRoof(): Group {
  const group = new Group();
  group.name = "roof";
  group.userData.animated = true; // visibility toggles with the guest's position
  const top = new MeshStandardMaterial({ color: "#D8CFC3", roughness: 1 });
  const roof = mesh(new PlaneGeometry(2 * (W + T), 2 * (D + T)), top, [0, H + 0.02, 0], group, { castShadow: false, receiveShadow: false });
  roof.rotation.x = -Math.PI / 2; // faces up
  const parapet = new MeshStandardMaterial({ color: palette.linen, roughness: 0.95 });
  slab(parapet, -W - T, W + T, H, H + 0.35, D, D + T, group, { castShadow: false });
  slab(parapet, -W - T, W + T, H, H + 0.35, -D - T, -D, group, { castShadow: false });
  slab(parapet, -W - T, -W, H, H + 0.35, -D, D, group, { castShadow: false });
  slab(parapet, W, W + T, H, H + 0.35, -D, D, group, { castShadow: false });
  group.visible = false;
  return group;
}
