/**
 * Shared WooCommerce Image interface.
 */
export interface WooImage {
  sourceUrl: string;
  altText?: string;
}

/**
 * Shared WooCommerce Product Category interface.
 */
export interface Category {
  id: string;
  databaseId: number;
  name: string;
  slug: string;
  image?: WooImage | null;
  count?: number | null;
}

/**
 * Shared WooCommerce Product interface.
 */
export interface Product {
  id: string;
  databaseId: number;
  name: string;
  slug: string;
  price?: string | null;
  regularPrice?: string | null;
  salePrice?: string | null;
  onSale?: boolean | null;
  image?: WooImage | null;
  galleryImages?: {
    nodes: WooImage[];
  } | null;
  shortDescription?: string | null;
  description?: string | null;
  productCategories?: {
    nodes: Category[];
  } | null;
}

/**
 * RankMath SEO metadata interface fetched via GraphQL.
 */
export interface SeoMetadata {
  title?: string;
  metaDesc?: string;
  canonical?: string;
  opengraphTitle?: string;
  opengraphDescription?: string;
  opengraphImage?: WooImage | null;
  schema?: string;
}

/**
 * API Response wrappers for type safety.
 */
export interface GetProductsResponse {
  products: {
    nodes: Product[];
  };
}

export interface GetProductBySlugResponse {
  product: Product & {
    seo?: SeoMetadata;
  };
}

export interface GetCategoriesResponse {
  productCategories: {
    nodes: Category[];
  };
}

export interface GetCategoryWithProductsResponse {
  productCategory: Category & {
    seo?: SeoMetadata;
    products: {
      nodes: Product[];
    };
  };
}
