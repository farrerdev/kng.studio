import { BoxGeometry, type BufferGeometry, type Material, Mesh, type Object3D } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Tiny helpers that keep the furniture modules declarative.

export type MeshOptions = { castShadow?: boolean; receiveShadow?: boolean; zoneId?: string };

export function mesh(
  geometry: BufferGeometry,
  material: Material,
  position: [number, number, number],
  parent?: Object3D,
  options: MeshOptions = {},
): Mesh {
  const result = new Mesh(geometry, material);
  result.position.set(...position);
  result.castShadow = options.castShadow ?? true;
  result.receiveShadow = options.receiveShadow ?? true;
  if (options.zoneId) result.userData.zoneId = options.zoneId;
  parent?.add(result);
  return result;
}

/** Axis-aligned box from min/max corners: handy when copying numbers from the floor plan. */
export function slab(
  material: Material,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  parent?: Object3D,
  options?: MeshOptions,
): Mesh {
  const size = [Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)] as const;
  return mesh(
    softGeometry(size[0], size[1], size[2]),
    material,
    [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
    parent,
    options,
  );
}

/** Pieces longer than this are architecture (walls, floors, house fronts): those stay crisp. */
const ROUND_MAX = 3.2;

/**
 * Furniture-sized boxes get softly rounded edges (the shop's soft, cosy look); very thin parts
 * and big architecture stay plain boxes.
 */
function softGeometry(width: number, height: number, depth: number): BufferGeometry {
  const thinnest = Math.min(width, height, depth);
  if (Math.max(width, height, depth) > ROUND_MAX || thinnest < 0.012) return new BoxGeometry(width, height, depth);
  const radius = Math.min(0.03, Math.max(0.004, thinnest * 0.32));
  return new RoundedBoxGeometry(width, height, depth, 2, radius);
}

export function softBox(
  material: Material,
  size: [number, number, number],
  position: [number, number, number],
  parent?: Object3D,
  radius = 0.03,
  options?: MeshOptions,
): Mesh {
  const r = Math.min(radius, Math.min(...size) / 2 - 0.001);
  return mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 2, Math.max(r, 0.001)), material, position, parent, options);
}

/** Freeze transforms of objects that never move: skips per-frame matrix recomputation. */
export function freezeStatic(root: Object3D): void {
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (child.userData.animated) return;
    child.matrixAutoUpdate = false;
  });
}

export function tagZone(root: Object3D, zoneId: string): void {
  root.traverse((child) => {
    if ((child as Mesh).isMesh) child.userData.zoneId = zoneId;
  });
}
