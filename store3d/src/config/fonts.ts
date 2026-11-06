// Lora (self-hosted, with its Vietnamese subset) replaces Georgia: Georgia on Windows has no proper
// Vietnamese glyphs, so tone marks rendered detached in Chrome. Canvas textures (signs, tags, the
// policy board) draw with these too, so main.ts waits for the font before building the scene.
import "@fontsource/lora/400.css";
import "@fontsource/lora/400-italic.css";
import "@fontsource/lora/500.css";

export const SERIF = '"Lora", Georgia, "Times New Roman", serif';

/** Resolves once Lora (Latin + Vietnamese) is ready to draw on canvases; never rejects. */
export function loadFonts(): Promise<void> {
  const sample = "KNG.studio Quy định mua hàng ắ ồ ữ ỹ đ";
  return Promise.all([
    document.fonts.load(`400 32px "Lora"`, sample),
    document.fonts.load(`italic 400 32px "Lora"`, sample),
    document.fonts.load(`500 32px "Lora"`, sample),
  ])
    .then(() => undefined)
    .catch(() => undefined);
}
