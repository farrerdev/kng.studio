import type { Product, ProductType, SizeOption } from "../types/catalog";

export const sizeOptions: SizeOption[] = [
  { id: "1", label: "Size 1", range: "Dưới 55kg" },
  { id: "2", label: "Size 2", range: "55 - 65kg" },
];

export const productTypes: ProductType[] = [
  {
    id: "type-set-bo",
    name: "Set bộ",
    price: "390.000đ",
    coverImage: {
      id: "type-set-bo-cover",
      src: "/images/moc-hoa-nhi.webp",
      alt: "Ảnh bìa Set bộ",
    },
    sizeChartImage: {
      id: "type-set-bo-size-chart",
      src: "/images/size-chart-moc.webp",
      alt: "Bảng size Set bộ",
    },
  },
  {
    id: "type-dam-ngu",
    name: "Đầm ngủ",
    price: "420.000đ",
    coverImage: {
      id: "type-dam-ngu-cover",
      src: "/images/may-cham-bi.webp",
      alt: "Ảnh bìa Đầm ngủ",
    },
    sizeChartImage: {
      id: "type-dam-ngu-size-chart",
      src: "/images/size-chart-may.webp",
      alt: "Bảng size Đầm ngủ",
    },
  },
  {
    id: "type-pajama",
    name: "Pajama dài",
    price: "460.000đ",
    coverImage: {
      id: "type-pajama-cover",
      src: "/images/an-caro-kem.webp",
      alt: "Ảnh bìa Pajama dài",
    },
    sizeChartImage: {
      id: "type-pajama-size-chart",
      src: "/images/size-chart-an.webp",
      alt: "Bảng size Pajama dài",
    },
  },
];

export const products: Product[] = [
  {
    id: "moc-set",
    productTypeId: "type-set-bo",
    name: "Mộc Set",
    price: "390.000đ",
    fit: "Form suông nhẹ, áo cổ V, quần lưng thun mềm.",
    material: "Muslin cotton 2 lớp",
    patterns: [
      {
        id: "moc-hoa-nhi",
        name: "Hoa nhí",
        accent: "#a9b99f",
        image: {
          id: "moc-hoa-nhi-product",
          src: "/images/moc-hoa-nhi.webp",
          alt: "Mộc Set họa tiết hoa nhí",
        },
        availableSizes: ["1", "2"],
      },
      {
        id: "moc-ke-hong",
        name: "Kẻ hồng",
        accent: "#cf9a91",
        image: {
          id: "moc-ke-hong-product",
          src: "/images/moc-ke-hong.webp",
          alt: "Mộc Set họa tiết kẻ hồng",
        },
        availableSizes: ["1"],
      },
      {
        id: "moc-soc-manh",
        name: "Sọc mảnh",
        accent: "#6e7a8b",
        image: {
          id: "moc-soc-manh-product",
          src: "/images/moc-soc-manh.webp",
          alt: "Mộc Set họa tiết sọc mảnh",
        },
        availableSizes: ["2"],
      },
    ],
    modelImages: [
      {
        id: "moc-model-1",
        src: "/images/moc-model-1.webp",
        alt: "Mẫu mặc Mộc Set dáng đứng",
      },
      {
        id: "moc-model-2",
        src: "/images/moc-model-2.webp",
        alt: "Mẫu mặc Mộc Set dáng ngồi",
      },
    ],
    sizeChartImage: {
      id: "moc-size-chart",
      src: "/images/size-chart-moc.webp",
      alt: "Bảng size Mộc Set",
    },
  },
  {
    id: "may-dress",
    productTypeId: "type-dam-ngu",
    name: "Mây Dress",
    price: "420.000đ",
    fit: "Đầm ngủ dáng A, tay bồng ngắn, có túi hai bên.",
    material: "Muslin nhăn tự nhiên",
    patterns: [
      {
        id: "may-cham-bi",
        name: "Chấm bi",
        accent: "#d8bc70",
        image: {
          id: "may-cham-bi-product",
          src: "/images/may-cham-bi.webp",
          alt: "Mây Dress họa tiết chấm bi",
        },
        availableSizes: ["1", "2"],
      },
      {
        id: "may-hoa-lua",
        name: "Hoa lụa",
        accent: "#bfa7c8",
        image: {
          id: "may-hoa-lua-product",
          src: "/images/may-hoa-lua.webp",
          alt: "Mây Dress họa tiết hoa lụa",
        },
        availableSizes: ["1"],
      },
    ],
    modelImages: [
      {
        id: "may-model-1",
        src: "/images/may-model-1.webp",
        alt: "Mẫu mặc Mây Dress phía trước",
      },
      {
        id: "may-model-2",
        src: "/images/may-model-2.webp",
        alt: "Mẫu mặc Mây Dress chuyển động",
      },
    ],
    sizeChartImage: {
      id: "may-size-chart",
      src: "/images/size-chart-may.webp",
      alt: "Bảng size Mây Dress",
    },
  },
  {
    id: "an-pajama",
    productTypeId: "type-pajama",
    name: "An Pajama",
    price: "460.000đ",
    fit: "Pajama dài tay, cổ bẻ nhỏ, quần dài thoải mái.",
    material: "Muslin cotton phối viền",
    patterns: [
      {
        id: "an-caro-kem",
        name: "Caro kem",
        accent: "#dfd1b8",
        image: {
          id: "an-caro-kem-product",
          src: "/images/an-caro-kem.webp",
          alt: "An Pajama họa tiết caro kem",
        },
        availableSizes: ["1"],
      },
      {
        id: "an-vien-no",
        name: "Viền nơ",
        accent: "#9b7066",
        image: {
          id: "an-vien-no-product",
          src: "/images/an-vien-no.webp",
          alt: "An Pajama họa tiết viền nơ",
        },
        availableSizes: ["2"],
      },
    ],
    modelImages: [
      {
        id: "an-model-1",
        src: "/images/an-model-1.webp",
        alt: "Mẫu mặc An Pajama toàn thân",
      },
      {
        id: "an-model-2",
        src: "/images/an-model-2.webp",
        alt: "Chi tiết An Pajama khi mặc",
      },
    ],
    sizeChartImage: {
      id: "an-size-chart",
      src: "/images/size-chart-an.webp",
      alt: "Bảng size An Pajama",
    },
  },
];
