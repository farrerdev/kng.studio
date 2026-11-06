import { CylinderGeometry, Group, MeshBasicMaterial, PlaneGeometry } from "three";
import { SHELVING } from "../../config/layout";
import { palette } from "../../config/palette";
import type { StoreCatalog, StoreProduct } from "../../data/types";
import { mesh, slab, softBox } from "../build";
import { labelTexture } from "../canvasArt";
import type { MaterialLibrary } from "../materials";
import { productFabric, productGarment, productTag } from "./productDisplay";

export type ShelfSection = {
  zoneId: string;
  product: StoreProduct | null;
  zFrom: number;
  zTo: number;
  center: number;
};

const FOLD = { w: 0.3, h: 0.065, d: 0.26 } as const;
/** Narrowest section that still fits a hanging set and a readable tag. */
const MIN_SECTION = 0.34;
/** Empty sections shown while the catalog is unavailable. */
const PLACEHOLDER_SECTIONS = 8;
const TAG = { y: SHELVING.railY + 0.2, height: 0.17 } as const;

/**
 * Left-wall clothing display: one equal-width section per product, in storefront order. Each
 * section hangs that product as a set (cut by its type and model), with a name + price tag above
 * and its other in-stock patterns folded on the cabinet below.
 */
export function buildShelving(catalog: StoreCatalog, materials: MaterialLibrary): { group: Group; sections: ShelfSection[] } {
  const group = new Group();
  group.name = "clothing-wall";
  const oak = materials.surface(palette.oak, { roughness: 0.7 });
  const oakDeep = materials.surface(palette.oakDeep, { roughness: 0.7 });
  const x0 = SHELVING.wallX;

  const runLengths = SHELVING.runs.map((run) => run.zFrom - run.zTo);
  const capacity = runLengths.reduce((sum, length) => sum + Math.floor(length / MIN_SECTION), 0);
  if (catalog.products.length > capacity) {
    console.warn(`[store3d] ${catalog.products.length} products, the wall fits ${capacity}; the rest are only in the menu`);
  }
  const items: Array<StoreProduct | null> = catalog.products.length
    ? catalog.products.slice(0, capacity)
    : Array.from({ length: PLACEHOLDER_SECTIONS }, () => null);
  const perRun = splitByLength(items.length, runLengths);
  const sections: ShelfSection[] = [];

  let next = 0;
  SHELVING.runs.forEach((run, runIndex) => {
    const length = runLengths[runIndex]!;
    const centerZ = (run.zFrom + run.zTo) / 2;
    // Slatted back panel, cornice, rail on two brackets, cabinet.
    slab(oak, x0, x0 + 0.03, 0, SHELVING.height, run.zTo, run.zFrom, group, { castShadow: false });
    slab(oakDeep, x0, x0 + 0.12, SHELVING.height - 0.05, SHELVING.height, run.zTo, run.zFrom, group);
    const rail = mesh(new CylinderGeometry(0.012, 0.012, length - 0.04, 10), materials.brass(), [x0 + 0.12, SHELVING.railY, centerZ], group, {
      castShadow: false,
    });
    rail.rotation.x = Math.PI / 2;
    for (const z of [run.zFrom - 0.03, run.zTo + 0.03]) slab(materials.brass(), x0 + 0.03, x0 + 0.13, SHELVING.railY - 0.012, SHELVING.railY + 0.012, z - 0.012, z + 0.012, group);
    slab(oak, x0, x0 + SHELVING.depth, 0, SHELVING.cabinetHeight - 0.03, run.zTo, run.zFrom, group);
    slab(oakDeep, x0, x0 + SHELVING.depth + 0.02, SHELVING.cabinetHeight - 0.03, SHELVING.cabinetHeight, run.zTo, run.zFrom, group);

    const runItems = items.slice(next, next + perRun[runIndex]!);
    next += runItems.length;
    if (!runItems.length) return;
    const width = length / runItems.length;
    runItems.forEach((product, index) => {
      const zFrom = run.zFrom - width * index;
      const zTo = zFrom - width;
      const section: ShelfSection = {
        zoneId: `shelf:${product?.id ?? `empty-${runIndex}-${index}`}`,
        product,
        zFrom,
        zTo,
        center: (zFrom + zTo) / 2,
      };
      buildSection(group, section, materials);
      // Cabinet door seams between sections.
      if (index > 0) slab(oakDeep, x0 + SHELVING.depth, x0 + SHELVING.depth + 0.004, 0.06, SHELVING.cabinetHeight - 0.06, zFrom - 0.003, zFrom + 0.003, group);
      sections.push(section);
    });
  });

  return { group, sections };
}

/** Splits `count` sections across runs in proportion to their length. */
function splitByLength(count: number, lengths: number[]): number[] {
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const counts = lengths.map((length) => Math.floor((count * length) / total));
  let left = count - counts.reduce((sum, value) => sum + value, 0);
  for (let i = 0; left > 0; i = (i + 1) % counts.length, left -= 1) counts[i]! += 1;
  return counts;
}

function buildSection(parent: Group, section: ShelfSection, materials: MaterialLibrary): void {
  const { zoneId, product, zFrom, zTo, center } = section;
  const x0 = SHELVING.wallX;
  const width = zFrom - zTo;
  const group = new Group();
  group.name = zoneId;
  parent.add(group);

  const patterns = product?.inStockPatterns ?? [];
  if (product) {
    // The set on its hanger, facing into the shop and scaled to fit the section.
    const garment = productGarment(product, materials, zoneId);
    garment.group.scale.setScalar(Math.min(0.85, (width - 0.04) / garment.width));
    garment.group.position.set(x0 + 0.17, SHELVING.railY - 0.012, center);
    garment.group.rotation.y = Math.PI / 2;
    group.add(garment.group);
  }

  // Folded stock on the cabinet: the next patterns, so more than one print shows per product.
  const folded = patterns.length > 1 ? patterns.slice(1, 4) : patterns.slice(0, 1);
  const stack = folded.length ? folded : [undefined, undefined];
  stack.forEach((pattern, level) => {
    softBox(
      product ? productFabric(product, pattern, materials) : materials.fabric(pattern),
      [FOLD.w, FOLD.h, Math.min(FOLD.d, width - 0.08)],
      [x0 + 0.24 + (level % 2) * 0.012, SHELVING.cabinetHeight + FOLD.h / 2 + level * FOLD.h, center],
      group,
      0.022,
      { zoneId },
    );
  });

  // Name + cut/price tag above the rail, facing into the shop.
  const tagWidth = width - 0.06;
  const tagText = product ? productTag(product) : { title: "Đang cập nhật", subtitle: "" };
  const tag = mesh(
    new PlaneGeometry(tagWidth, TAG.height),
    new MeshBasicMaterial({
      map: labelTexture(tagText.title, {
        width: Math.round((256 * tagWidth) / TAG.height),
        height: 256,
        background: palette.linen,
        border: palette.oakDeep,
        radius: 26,
        subtitle: tagText.subtitle,
      }),
      transparent: true,
    }),
    [x0 + 0.13, TAG.y, center],
    group,
    { castShadow: false, receiveShadow: false, zoneId },
  );
  tag.rotation.y = Math.PI / 2;
}
