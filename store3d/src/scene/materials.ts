import { Color, MeshStandardMaterial } from "three";
import type { StorePattern } from "../data/types";
import { fabricTones } from "../config/palette";
import { printTexture } from "./prints";

type SurfaceOptions = { roughness?: number; metalness?: number; emissive?: string; emissiveIntensity?: number };

/**
 * Shared material cache: one material per colour/finish, and one per fabric pattern.
 * Sharing keeps draw-state changes and GPU memory low; never mutate a material returned by `surface()`.
 */
export class MaterialLibrary {
  private readonly surfaces = new Map<string, MeshStandardMaterial>();
  private readonly fabrics = new Map<string, MeshStandardMaterial>();
  private fabricIndex = 0;

  constructor(private readonly anisotropy: number) {}

  surface(color: string, options: SurfaceOptions = {}): MeshStandardMaterial {
    const key = `${color}|${options.roughness ?? ""}|${options.metalness ?? ""}|${options.emissive ?? ""}|${options.emissiveIntensity ?? ""}`;
    let material = this.surfaces.get(key);
    if (!material) {
      material = new MeshStandardMaterial({
        color,
        roughness: options.roughness ?? 0.88,
        metalness: options.metalness ?? 0,
      });
      if (options.emissive) {
        material.emissive = new Color(options.emissive);
        material.emissiveIntensity = options.emissiveIntensity ?? 1;
      }
      this.surfaces.set(key, material);
    }
    return material;
  }

  brass(): MeshStandardMaterial {
    return this.surface("#B8976C", { roughness: 0.42, metalness: 0.55 });
  }

  /**
   * Muslin printed with a pattern's print (see prints.ts); `repeat` = print tiles per UV unit.
   * Without a pattern it is a plain soft tone (decor stacks).
   */
  fabric(pattern: StorePattern | undefined, repeat = 2): MeshStandardMaterial {
    const key = pattern ? `${pattern.name}|${repeat}` : `tone-${this.fabricIndex++ % fabricTones.length}`;
    let material = this.fabrics.get(key);
    if (material) return material;
    material = pattern
      ? new MeshStandardMaterial({ map: printTexture(pattern.name, repeat, this.anisotropy), roughness: 0.95, metalness: 0 })
      : new MeshStandardMaterial({ color: fabricTones[this.fabrics.size % fabricTones.length], roughness: 0.95, metalness: 0 });
    this.fabrics.set(key, material);
    return material;
  }

  /** Solid-colour muslin (plain sets such as the peach tank set). */
  plainFabric(color: string): MeshStandardMaterial {
    return this.surface(color, { roughness: 0.95 });
  }

  dispose(): void {
    for (const material of [...this.surfaces.values(), ...this.fabrics.values()]) {
      material.map?.dispose();
      material.dispose();
    }
    this.surfaces.clear();
    this.fabrics.clear();
  }
}
