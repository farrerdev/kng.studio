export type SizeId = "1" | "2";

export type SizeOption = {
  id: SizeId;
  label: string;
  range: string;
};

export type ProductImage = {
  id: string;
  src: string;
  alt: string;
};

export type ProductPattern = {
  id: string;
  name: string;
  accent: string;
  image: ProductImage;
  availableSizes: SizeId[];
};

export type ProductType = {
  id: string;
  name: string;
  price: string;
};

export type Product = {
  id: string;
  productTypeId: string;
  name: string;
  price: string;
  fit: string;
  material: string;
  patterns: ProductPattern[];
  modelImages: ProductImage[];
  sizeChartImage: ProductImage;
};
