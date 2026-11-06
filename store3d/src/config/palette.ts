// "Linen sáng" direction approved for the 3D shop.
export const palette = {
  linen: "#F8F4EE",
  sand: "#EFE8DF",
  sandDeep: "#E4DACD",
  oat: "#D9CBB8",
  oatDeep: "#BFAE98",
  oak: "#C9AA88",
  oakDeep: "#B89474",
  brass: "#A88B6A",
  olive: "#9AA58C",
  oliveDeep: "#7F8C72",
  ink: "#5E5246",
  floor: "#D8C7B2",
  floorLine: "#C9B59C",
  rose: "#E3C9C1",
  sage: "#C9D1C0",
  butter: "#F3E3B5",
  skin: "#EBCDB9",
  hairDark: "#3F3029",
  hairBrown: "#5A4034",
  catWhite: "#FBF9F5",
} as const;

/** Muted fabric tones used before a pattern photo has loaded (and for decor stacks). */
export const fabricTones = [palette.linen, palette.oat, palette.rose, palette.sage, palette.butter, palette.oatDeep];
