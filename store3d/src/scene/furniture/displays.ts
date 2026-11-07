import {
  CylinderGeometry,
  Group,
  MeshBasicMaterial,
  PlaneGeometry,
  TorusGeometry,
} from "three";
import { MANNEQUINS, PODIUM, SCRUNCHIE_STAND } from "../../config/layout";
import { palette } from "../../config/palette";
import type { StoreCatalog, StoreProduct } from "../../data/types";
import { mesh, softBox, tagZone } from "../build";
import { labelTexture } from "../canvasArt";
import type { MaterialLibrary } from "../materials";
import { HumanFigure } from "../../characters/HumanFigure";
import { productFabric } from "./productDisplay";

export const PODIUM_ZONE = "popular";
export const SCRUNCHIE_ZONE = "scrunchies";
export const MANNEQUIN_ZONE = "mannequins";
/** Height of the mannequin plinths (the window planter outside is ~0.55 m). */
const PLINTH = 0.5;
const MANNEQUIN_WHITE = "#F4EFE7";
const TRIM_CREAM = "#FFFDF7";
/** Print scale on a mannequin (same as the people in the shop). */
const MANNEQUIN_PRINT_REPEAT = 3;

/** Two-tier round podium showing the five most-loved products, each with a numbered tag. */
export function buildPodium(catalog: StoreCatalog, materials: MaterialLibrary): Group {
  const group = new Group();
  group.name = "popular-podium";
  group.position.set(PODIUM.x, 0, PODIUM.z);
  const oak = materials.surface(palette.oak, { roughness: 0.65 });
  const oakDeep = materials.surface(palette.oakDeep, { roughness: 0.65 });
  mesh(new CylinderGeometry(PODIUM.outer, PODIUM.outer, 0.42, 48), oak, [0, 0.21, 0], group);
  mesh(new CylinderGeometry(PODIUM.outer + 0.02, PODIUM.outer + 0.02, 0.03, 48), oakDeep, [0, 0.435, 0], group);
  mesh(new CylinderGeometry(PODIUM.inner, PODIUM.inner, 0.36, 40), oak, [0, 0.63, 0], group);
  mesh(new CylinderGeometry(PODIUM.inner + 0.02, PODIUM.inner + 0.02, 0.03, 40), oakDeep, [0, 0.825, 0], group);

  const featured: Array<StoreProduct | undefined> = catalog.popular.length ? catalog.popular : [undefined, undefined, undefined];
  featured.forEach((product, index) => {
    const onTop = index === 0;
    const angle = onTop ? 0 : ((index - 1) / Math.max(1, featured.length - 1)) * Math.PI * 2 + Math.PI / 4;
    const radius = onTop ? 0 : (PODIUM.inner + PODIUM.outer) / 2;
    const y = onTop ? 0.84 : 0.45;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    for (let i = 0; i < 3; i += 1) {
      const pattern = product?.inStockPatterns[i % Math.max(1, product.inStockPatterns.length)];
      const fabric = product ? productFabric(product, pattern, materials) : materials.fabric(pattern);
      const fold = softBox(fabric, [0.34, 0.07, 0.3], [x, y + 0.035 + i * 0.07, z], group, 0.022);
      fold.rotation.y = angle + i * 0.08;
    }
    const tag = mesh(
      new PlaneGeometry(0.16, 0.16),
      new MeshBasicMaterial({
        map: labelTexture(String(index + 1), { width: 128, height: 128, background: palette.linen, radius: 64, border: palette.brass }),
        transparent: true,
      }),
      [x, y + 0.36, z],
      group,
      { castShadow: false, receiveShadow: false },
    );
    tag.userData.billboard = true;
    tag.userData.animated = true;
  });

  const sign = mesh(
    new PlaneGeometry(1.3, 0.32),
    new MeshBasicMaterial({
      map: labelTexture("Đang được yêu thích", { width: 768, height: 190, background: palette.linen, border: palette.brass, radius: 60 }),
      transparent: true,
    }),
    [0, 1.55, 0],
    group,
    { castShadow: false, receiveShadow: false },
  );
  sign.userData.billboard = true;
  sign.userData.animated = true;
  tagZone(group, PODIUM_ZONE);
  return group;
}

/** Rotating stand of scrunchies next to the counter (decor until scrunchies are listed in the catalog). */
export function buildScrunchieStand(materials: MaterialLibrary): Group {
  const group = new Group();
  group.name = "scrunchie-stand";
  group.position.set(SCRUNCHIE_STAND.x, 0, SCRUNCHIE_STAND.z);
  const brass = materials.brass();
  mesh(new CylinderGeometry(0.2, 0.24, 0.04, 28), brass, [0, 0.02, 0], group);
  mesh(new CylinderGeometry(0.018, 0.018, 1.35, 10), brass, [0, 0.69, 0], group);
  const tones = [palette.rose, palette.sage, palette.butter, palette.linen, palette.oat, palette.oatDeep];
  const rotor = new Group();
  rotor.userData.animated = true;
  rotor.userData.spin = 0.25;
  group.add(rotor);
  for (const [tier, y] of [0.6, 0.92, 1.24].entries()) {
    mesh(new CylinderGeometry(0.008, 0.008, 0.32, 6), brass, [0, y, 0], rotor).rotation.z = Math.PI / 2;
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2 + tier * 0.4;
      const scrunchie = mesh(
        new TorusGeometry(0.045, 0.022, 10, 20),
        materials.surface(tones[(i + tier) % tones.length]!, { roughness: 1 }),
        [Math.cos(angle) * 0.15, y - 0.04, Math.sin(angle) * 0.15],
        rotor,
      );
      scrunchie.rotation.y = -angle;
    }
  }
  const sign = mesh(
    new PlaneGeometry(0.7, 0.18),
    new MeshBasicMaterial({ map: labelTexture("Tặng scrunchies", { background: palette.linen, radius: 40 }), transparent: true }),
    [0, 1.55, 0],
    group,
    { castShadow: false, receiveShadow: false },
  );
  sign.userData.billboard = true;
  sign.userData.animated = true;
  tagZone(group, SCRUNCHIE_ZONE);
  return group;
}

/** Two display stands by the left window, each showing one of the two newest products as a hanging set. */
export function buildMannequins(catalog: StoreCatalog, materials: MaterialLibrary): { group: Group; products: StoreProduct[] } {
  const group = new Group();
  group.name = "mannequins";
  // Long-pants sets suit a full-length figure; the newest ones go in the window first.
  const longPants = [...catalog.products].reverse().filter((product) => /quần dài/i.test(product.categoryName));
  const products = (longPants.length >= MANNEQUINS.length ? longPants : [...catalog.products].reverse()).slice(0, MANNEQUINS.length);
  const oakDeep = materials.surface(palette.oakDeep, { roughness: 0.6 });

  MANNEQUINS.forEach((spot, index) => {
    const stand = new Group();
    stand.position.set(spot.x, 0, spot.z);
    // Facing the street, turned slightly towards each other, so passers-by see the outfits.
    stand.rotation.y = index ? -0.3 : 0.3;
    group.add(stand);
    // A tall round plinth lifts the figure above the window planter, so it shows from the street.
    mesh(new CylinderGeometry(0.27, 0.29, PLINTH, 40), oakDeep, [0, PLINTH / 2, 0], stand);
    mesh(new CylinderGeometry(0.25, 0.25, 0.012, 32), materials.surface(palette.linen, { roughness: 0.8 }), [0, PLINTH + 0.006, 0], stand);
    const product = products[index];
    const figure = new HumanFigure({
      skin: MANNEQUIN_WHITE,
      hair: MANNEQUIN_WHITE,
      hairStyle: "bun",
      scrunchie: MANNEQUIN_WHITE,
      outfit: { kind: "plain", top: palette.linen, bottom: palette.linen, trim: TRIM_CREAM },
      longSleeves: product ? /tay dài/i.test(product.categoryName) : true,
      slippers: MANNEQUIN_WHITE,
      mannequin: true,
      collar: product ? !/cổ (tròn|v)\b/i.test(product.shortName) : true,
    });
    if (product) figure.wear(productFabric(product, product.inStockPatterns[0], materials, MANNEQUIN_PRINT_REPEAT));
    figure.root.position.y = PLINTH + 0.012;
    // Mannequins stand still: let them be baked with the rest of the furniture.
    figure.root.traverse((part) => {
      delete part.userData.animated;
    });
    stand.add(figure.root);
  });
  tagZone(group, MANNEQUIN_ZONE);
  return { group, products };
}
