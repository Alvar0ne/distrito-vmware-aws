export type ProductCategory =
  | "poleras"
  | "polerones"
  | "chaquetas"
  | "accesorios"
  | "conjuntos";

export type Product = {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  price: number;
  compareAtPrice?: number;
  images: string[];
  sizes: string[];
  stockBySize: Record<string, number>;
  featured?: boolean;
  description: string;
};

export const products: Product[] = [
  {
    id: "ck-polera-logo-classic",
    name: "Polera logo classic fit",
    brand: "Calvin Klein",
    category: "poleras",
    price: 29990,
    images: [
      "https://images.unsplash.com/photo-1503341504253-dff4815485f1?auto=format&fit=crop&w=900&q=82"
    ],
    sizes: ["S", "M"],
    stockBySize: { S: 2, M: 3 },
    featured: true,
    description: "Polera casual original, calce comodo y logo frontal."
  },
  {
    id: "tommy-poleroon-hooded-importado",
    name: "Poleron hooded importado",
    brand: "Tommy",
    category: "polerones",
    price: 49990,
    images: [
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=82"
    ],
    sizes: ["M", "L"],
    stockBySize: { M: 1, L: 2 },
    featured: true,
    description: "Poleron urbano de temporada, ideal para uso diario."
  },
  {
    id: "guess-chaqueta-urbana-premium",
    name: "Chaqueta urbana premium",
    brand: "Guess",
    category: "chaquetas",
    price: 89990,
    images: [
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=900&q=82"
    ],
    sizes: ["S", "M"],
    stockBySize: { S: 1, M: 1 },
    featured: true,
    description: "Chaqueta original con look urbano y terminaciones premium."
  },
  {
    id: "mk-cartera-crossbody-original",
    name: "Cartera crossbody original",
    brand: "Michael Kors",
    category: "accesorios",
    price: 199990,
    images: [
      "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=82"
    ],
    sizes: ["U"],
    stockBySize: { U: 1 },
    featured: true,
    description: "Cartera original formato crossbody, stock unitario."
  }
];

export const categories: { id: ProductCategory | "all"; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "poleras", label: "Poleras" },
  { id: "polerones", label: "Polerones" },
  { id: "chaquetas", label: "Chaquetas" },
  { id: "accesorios", label: "Accesorios" },
  { id: "conjuntos", label: "Conjuntos" }
];

