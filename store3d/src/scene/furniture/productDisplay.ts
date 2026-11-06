import type { Group, MeshStandardMaterial } from "three";
import { palette } from "../../config/palette";
import type { StorePattern, StoreProduct } from "../../data/types";
import type { MaterialLibrary } from "../materials";
import { printPalette } from "../prints";
import { PEACH, TRIM_CREAM, buildGarment, garmentStyleFor, garmentWidth, isPlainSet, tagLines, type GarmentStyle } from "./garments";

/** Print tiles per metre on hanging garments (garment UVs are in metres): ~2.5 cm between motifs. */
const GARMENT_PRINT_REPEAT = 7;
/** Print tiles per face on folded sets (box UVs are 0–1 per face). */
const FOLD_PRINT_REPEAT = 2.4;

/** Fabric for a product in a given pattern: its print, or the solid colour of a plain set. */
export function productFabric(product: StoreProduct, pattern: StorePattern | undefined, materials: MaterialLibrary, repeat = FOLD_PRINT_REPEAT): MeshStandardMaterial {
  const style = garmentStyleFor(product.categoryName, product.shortName);
  return isPlainSet(style) ? materials.plainFabric(PEACH) : materials.fabric(pattern, repeat);
}

/** The product as a set on a hanger (cut from its type and model name, first in-stock print). */
export function productGarment(product: StoreProduct, materials: MaterialLibrary, zoneId: string): { group: Group; style: GarmentStyle; width: number } {
  const style = garmentStyleFor(product.categoryName, product.shortName);
  const pattern = product.inStockPatterns[0];
  const group = buildGarment(
    style,
    {
      fabric: productFabric(product, pattern, materials, GARMENT_PRINT_REPEAT),
      trim: materials.surface(TRIM_CREAM, { roughness: 0.95 }),
      bow: materials.surface(pattern ? printPalette(pattern.name).accent : palette.rose, { roughness: 0.9 }),
      wood: materials.surface(palette.oak, { roughness: 0.6 }),
      brass: materials.brass(),
    },
    zoneId,
  );
  return { group, style, width: garmentWidth(style) };
}

/** "Cổ sen" / "Tay ngắn · 250k": the wall tag for a product. */
export function productTag(product: StoreProduct): { title: string; subtitle: string } {
  const style = garmentStyleFor(product.categoryName, product.shortName);
  const { title, cut } = tagLines(style, product.shortName, product.categoryName);
  const thousands = Number(product.price.replace(/\D/g, "")) / 1000;
  return { title, subtitle: Number.isFinite(thousands) && thousands > 0 ? `${cut} · ${thousands}k` : cut };
}
