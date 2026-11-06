import { type CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, Sprite, SpriteMaterial } from "three";
import { palette } from "../config/palette";
import { blobShadowTexture, labelTexture } from "../scene/canvasArt";

let shadowTexture: CanvasTexture | null = null;

/** Soft contact shadow under a moving character (moving objects stay out of the static shadow map). */
export function blobShadow(size: number): Mesh {
  shadowTexture ??= blobShadowTexture();
  const shadow = new Mesh(
    new PlaneGeometry(size, size),
    new MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  shadow.renderOrder = 1;
  return shadow;
}

/** Floating name tag that fades in when the guest is close. */
export function nameTag(text: string, width = 0.5): Sprite {
  const sprite = new Sprite(
    new SpriteMaterial({
      map: labelTexture(text, { width: 256, height: 96, background: palette.linen, border: palette.oatDeep, radius: 44 }),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  sprite.scale.set(width, width * 0.375, 1);
  sprite.renderOrder = 2;
  return sprite;
}
