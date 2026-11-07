import { BoxGeometry, type BufferGeometry, type Material, Matrix4, Mesh, type Object3D } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
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

/**
 * Draw-call diet: furniture is hundreds of small meshes that never move. Meshes sharing a material
 * (and the same tap target / floor flag / shadow flags) are baked into one mesh in world space, so
 * the GPU draws a few dozen batches instead of ~600 meshes. Skipped: anything animated, fading
 * (occluders), billboards, transparent or specially ordered materials. Returns the merged meshes
 * (in world coordinates, to add to the scene root); the originals are removed from their parents.
 * With `space`, batches are built in that object's local coordinates and added to it (used inside
 * a fading tree or house, which must stay one object).
 */
export function mergeStaticMeshes(roots: Object3D[], space?: Object3D): Mesh[] {
  const buckets = new Map<string, Mesh[]>();
  const visit = (object: Object3D) => {
    const data = object.userData;
    if (data.animated || data.occluder || data.billboard || data.spin) return;
    const mesh = object as Mesh;
    if (mesh.isMesh) {
      const material = mesh.material as Material;
      const geometry = mesh.geometry;
      const mergeable =
        !Array.isArray(mesh.material) &&
        !material.transparent &&
        mesh.renderOrder === 0 &&
        mesh.visible &&
        geometry.attributes.position !== undefined;
      if (mergeable) {
        const attributes = Object.keys(geometry.attributes).sort().join(",");
        const key = [material.uuid, data.zoneId ?? "", data.floor ? 1 : 0, mesh.castShadow ? 1 : 0, mesh.receiveShadow ? 1 : 0, attributes, geometry.index ? "i" : "n"].join("|");
        const bucket = buckets.get(key);
        if (bucket) bucket.push(mesh);
        else buckets.set(key, [mesh]);
      }
    }
    for (const child of object.children) visit(child);
  };
  for (const root of roots) {
    root.updateMatrixWorld(true);
    visit(root);
  }

  const merged: Mesh[] = [];
  const toSpace = new Matrix4();
  const spaceInverse = space ? new Matrix4().copy(space.matrixWorld).invert() : null;
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue;
    const parts = meshes.map((mesh) => {
      toSpace.copy(mesh.matrixWorld);
      if (spaceInverse) toSpace.premultiply(spaceInverse);
      const part = mesh.geometry.clone().applyMatrix4(toSpace);
      part.clearGroups();
      return part;
    });
    const geometry = mergeGeometries(parts, false);
    for (const part of parts) part.dispose();
    if (!geometry) continue;
    const first = meshes[0]!;
    const batch = new Mesh(geometry, first.material);
    batch.castShadow = first.castShadow;
    batch.receiveShadow = first.receiveShadow;
    if (first.userData.zoneId) batch.userData.zoneId = first.userData.zoneId;
    if (first.userData.floor) batch.userData.floor = true;
    batch.name = "static-batch";
    for (const mesh of meshes) mesh.removeFromParent();
    space?.add(batch);
    merged.push(batch);
  }
  return merged;
}

/** Bakes each fading object (tree, plant, house) into as few meshes as possible, kept inside it. */
export function mergeOccluders(roots: Object3D[]): void {
  const occluders: Object3D[] = [];
  for (const root of roots) {
    root.traverse((object) => {
      if (object.userData.occluder) occluders.push(object);
    });
  }
  for (const occluder of occluders) {
    occluder.updateMatrixWorld(true);
    mergeStaticMeshes([...occluder.children], occluder);
  }
}
