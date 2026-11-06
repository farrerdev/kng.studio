import { CylinderGeometry, Group, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from "three";
import { COUNTER, ROOM } from "../../config/layout";
import { palette } from "../../config/palette";
import { mesh, slab, softBox } from "../build";
import { flutedTexture, labelTexture } from "../canvasArt";
import { shopConfig } from "../../../../src/config/shop";
import type { MaterialLibrary } from "../materials";

/** "muslin homewear" under the brand, as on the storefront. */
const TAGLINE = shopConfig.subtitle.toLowerCase();

export const COUNTER_ZONE = "counter";

/** L-shaped oak cashier counter with fluted front, back shelf and the shop sign. */
export function buildCounter(materials: MaterialLibrary): Group {
  const group = new Group();
  group.name = "counter";
  const fluteMap = flutedTexture(palette.oak, palette.oakDeep);
  const front = new MeshStandardMaterial({ map: fluteMap, roughness: 0.7 });
  const top = materials.surface(palette.oakDeep, { roughness: 0.55 });
  const { main, side, height } = COUNTER;
  const opts = { zoneId: COUNTER_ZONE };

  fluteMap.repeat.set((main.x1 - main.x0) / 0.5, 1);
  slab(front, main.x0, main.x1, 0, height - 0.04, main.z0, main.z1, group, opts);
  slab(front, side.x0, side.x1, 0, height - 0.04, side.z0, side.z1, group, opts);
  slab(top, main.x0 - 0.04, main.x1, height - 0.04, height, main.z0 - 0.02, main.z1 + 0.04, group, opts);
  slab(top, side.x0 - 0.04, side.x1, height - 0.04, height, side.z0, side.z1 + 0.04, group, opts);

  const brandPlate = mesh(
    new PlaneGeometry(1.3, 0.3),
    new MeshBasicMaterial({
      map: labelTexture("KNG.studio", { width: 640, height: 148, color: palette.linen, subtitle: TAGLINE, subtitleFont: "italic 30px Georgia, serif" }),
      transparent: true,
    }),
    [(main.x0 + main.x1) / 2 - 0.25, height * 0.55, main.z1 + 0.005],
    group,
    { castShadow: false, receiveShadow: false, zoneId: COUNTER_ZONE },
  );
  brandPlate.name = "brand-plate";

  // Countertop props: ceramic vase with dried pampas, register, gift boxes.
  const ceramic = materials.surface(palette.linen, { roughness: 0.4 });
  mesh(new CylinderGeometry(0.07, 0.09, 0.26, 18), ceramic, [main.x0 + 0.3, height + 0.13, main.z0 + 0.25], group);
  const pampas = materials.surface(palette.oat, { roughness: 1 });
  for (let i = 0; i < 5; i += 1) {
    const stem = mesh(new CylinderGeometry(0.004, 0.006, 0.55, 5), pampas, [main.x0 + 0.3, height + 0.5, main.z0 + 0.25], group, {
      castShadow: false,
    });
    stem.rotation.z = (i - 2) * 0.16;
    stem.rotation.x = ((i % 2) - 0.5) * 0.25;
    const plume = mesh(new CylinderGeometry(0.035, 0.012, 0.22, 8), pampas, [0, 0.3, 0], stem, { castShadow: false });
    plume.rotation.z = 0.05;
  }
  softBox(materials.surface(palette.ink, { roughness: 0.5 }), [0.3, 0.12, 0.24], [main.x0 + 1.9, height + 0.06, main.z0 + 0.22], group, 0.02);
  softBox(materials.surface(palette.linen), [0.24, 0.12, 0.2], [main.x0 + 1.2, height + 0.06, main.z0 + 0.25], group, 0.01);
  softBox(materials.surface(palette.rose), [0.18, 0.1, 0.16], [main.x0 + 1.22, height + 0.17, main.z0 + 0.25], group, 0.01);

  // Back shelf with wrapped stock and the shop sign above it.
  const back = COUNTER.backShelf;
  const oak = materials.surface(palette.oak, { roughness: 0.7 });
  slab(oak, back.x0, back.x1, 0, back.height, back.z0, back.z1, group, { castShadow: false });
  for (const [i, y] of [0.7, 1.25].entries()) {
    slab(materials.surface(palette.oakDeep), back.x0 + 0.05, back.x1 - 0.05, y, y + 0.03, back.z1, back.z1 + 0.06, group);
    for (let k = 0; k < 6; k += 1) {
      const tone = [palette.linen, palette.oat, palette.rose, palette.sage][(k + i) % 4]!;
      softBox(materials.surface(tone), [0.26, 0.16, 0.22], [back.x0 + 0.3 + k * 0.4, y + 0.11, back.z1 + 0.02], group, 0.01);
    }
  }
  mesh(
    new PlaneGeometry(1.9, 0.56),
    new MeshBasicMaterial({
      map: labelTexture("KNG.studio", { width: 1024, height: 302, subtitle: TAGLINE, subtitleFont: "italic 54px Georgia, serif" }),
      transparent: true,
    }),
    [(back.x0 + back.x1) / 2, 2.45, -ROOM.halfDepth + 0.02],
    group,
    { castShadow: false, receiveShadow: false },
  );
  return group;
}
