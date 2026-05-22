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
  __typename?: string;
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
  title?: string | null;
  description?: string | null;
  canonicalUrl?: string | null;
  openGraph?: {
    title?: string | null;
    description?: string | null;
    image?: {
      url: string;
      secureUrl?: string;
    } | null;
  } | null;
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

/**
 * WooCommerce Cart interfaces.
 */
export interface CartItem {
  key: string;
  product: {
    node: Product;
  };
  quantity: number;
  subtotal?: string | null;
  total?: string | null;
}

export interface CartData {
  contents: {
    nodes: CartItem[];
  };
  subtotal?: string | null;
  shippingTotal?: string | null;
  total?: string | null;
}

export interface ShippingRate {
  id: string;
  instanceId?: number | null;
  methodId?: string | null;
  label: string;
  cost?: string | null;
}

export interface ShippingPackage {
  packageDetails?: string | null;
  rates: ShippingRate[];
}

export interface PaymentGateway {
  id: string;
  title: string;
  description?: string | null;
}

export interface CheckoutCartData {
  availableShippingMethods?: ShippingPackage[] | null;
  chosenShippingMethods?: string[] | null;
  subtotal?: string | null;
  shippingTotal?: string | null;
  total?: string | null;
}

export interface GetCartResponse {
  cart: CartData | null;
}

export interface AddToCartResponse {
  addToCart: {
    cart: CartData;
  } | null;
}

export interface UpdateCartQuantityResponse {
  updateItemQuantities: {
    cart: CartData;
  } | null;
}

export interface GetCheckoutDataResponse {
  paymentGateways: {
    nodes: PaymentGateway[];
  };
  cart: CheckoutCartData | null;
}

export interface UpdateShippingMethodResponse {
  updateShippingMethod: {
    cart: CheckoutCartData;
  } | null;
}

export interface CustomerAddressInput {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
}

export interface CheckoutInput {
  billing: CustomerAddressInput;
  shipping: CustomerAddressInput;
  shipToDifferentAddress?: boolean;
  shippingMethod?: string[];
  paymentMethod: string;
  customerNote?: string;
  isPaid?: boolean;
}

export interface CheckoutResponse {
  checkout: {
    result?: string | null;
    redirect?: string | null;
    order?: {
      id: string;
      orderNumber?: string | null;
      orderKey?: string | null;
      status?: string | null;
      total?: string | null;
    } | null;
  } | null;
}
