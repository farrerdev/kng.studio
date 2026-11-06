import { DoubleSide, Group, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from "three";
import { FITTING_ROOMS } from "../../config/layout";
import { palette } from "../../config/palette";
import { mesh, slab, softBox } from "../build";
import { labelTexture } from "../canvasArt";
import type { MaterialLibrary } from "../materials";
import { wavyPlane } from "../room";

export const FITTING_ZONE = "fitting";
const CURTAIN_DRAWN = 0.5;

/** Two linen-curtained booths in the back-left corner, curtains half drawn. */
export function buildFittingRooms(materials: MaterialLibrary): Group {
  const group = new Group();
  group.name = "fitting-rooms";
  const panel = materials.surface(palette.sandDeep);
  const oak = materials.surface(palette.oakDeep, { roughness: 0.7 });
  const { z0, z1, height } = FITTING_ROOMS;
  const curtainMaterial = new MeshStandardMaterial({ color: palette.linen, roughness: 1, side: DoubleSide });

  FITTING_ROOMS.booths.forEach((booth, index) => {
    slab(panel, booth.x1, booth.x1 + 0.06, 0, height, z0, z1, group, { zoneId: FITTING_ZONE });
    if (index === 0) slab(panel, booth.x0 - 0.2, booth.x0, 0, height, z0, z1, group, { zoneId: FITTING_ZONE });
    slab(oak, booth.x0 - 0.2, booth.x1 + 0.06, height, height + 0.08, z0, z1 + 0.04, group, { zoneId: FITTING_ZONE });
    slab(materials.brass(), booth.x0, booth.x1, height - 0.1, height - 0.08, z1 - 0.05, z1 - 0.03, group, { castShadow: false });

    // Stool and a hook with a robe inside each booth.
    const stool = materials.surface(palette.oak, { roughness: 0.7 });
    softBox(stool, [0.36, 0.05, 0.36], [booth.x0 + 0.4, 0.45, z0 + 0.45], group, 0.02);
    slab(stool, booth.x0 + 0.38, booth.x0 + 0.42, 0, 0.43, z0 + 0.43, z0 + 0.47, group);

    // Curtain gathered towards the left post, leaving the booth half open.
    const width = (booth.x1 - booth.x0) * CURTAIN_DRAWN;
    mesh(wavyPlane(width, height - 0.12, 6, 0.06), curtainMaterial, [booth.x0 + width / 2, (height - 0.12) / 2, z1 - 0.04], group, {
      zoneId: FITTING_ZONE,
    });
  });

  const sign = mesh(
    new PlaneGeometry(1.1, 0.28),
    new MeshBasicMaterial({ map: labelTexture("Phòng thử", { background: palette.linen, radius: 40 }), transparent: true }),
    [(FITTING_ROOMS.booths[0].x0 + FITTING_ROOMS.booths[1].x1) / 2, height + 0.3, z1 + 0.05],
    group,
    { castShadow: false, receiveShadow: false },
  );
  sign.userData.zoneId = FITTING_ZONE;
  return group;
}
