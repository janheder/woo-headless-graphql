/**
 * GraphQL Fragment for Menu Item fields.
 */
export const MENU_ITEM_FRAGMENT = `
  fragment MenuItemFields on MenuItem {
    id
    databaseId
    label
    url
    path
    target
    parentId
    cssClasses
    connectedNode {
      node {
        __typename
        uri
      }
    }
    childItems {
      nodes {
        id
        databaseId
        label
        url
        path
        target
        parentId
        cssClasses
        connectedNode {
          node {
            __typename
            uri
          }
        }
      }
    }
  }
`;

/**
 * GraphQL Fragment for MediaItem / Image fields.
 */
export const IMAGE_FRAGMENT = `
  fragment ImageFields on MediaItem {
    sourceUrl
    altText
  }
`;

/**
 * GraphQL Fragment for RankMath SEO on PostTypes (Products).
 */
export const SEO_FRAGMENT = `
  fragment SeoFields on RankMathProductObjectSeo {
    title
    description
    canonicalUrl
    openGraph {
      title
      description
      image {
        url
        secureUrl
      }
    }
  }
`;

/**
 * GraphQL Fragment for RankMath SEO on Terms (Categories).
 */
export const TERM_SEO_FRAGMENT = `
  fragment TermSeoFields on RankMathProductCategoryTermSeo {
    title
    description
    canonicalUrl
    openGraph {
      title
      description
      image {
        url
        secureUrl
      }
    }
  }
`;

/**
 * GraphQL Fragment for WooCommerce Product base fields.
 * Extends fields specifically for simple and variable products to get price states.
 */
export const PRODUCT_FRAGMENT = `
  fragment ProductFields on Product {
    __typename
    id
    databaseId
    name
    slug
    image {
      ...ImageFields
    }
    ... on SimpleProduct {
      price
      regularPrice
      salePrice
      onSale
    }
    ... on VariableProduct {
      price
      regularPrice
      salePrice
      onSale
    }
    ... on GroupProduct {
      price
      products(first: 50) {
        nodes {
          ... on SimpleProduct {
            id
            databaseId
            name
            slug
            price
            regularPrice
            salePrice
            onSale
            image {
              ...ImageFields
            }
          }
        }
      }
    }
  }
`;

/**
 * GraphQL Fragment for WooCommerce Product Category fields.
 * NOTE: `count` field only returns directly assigned products (not subcategory products).
 * For accurate total count including subcategories, use the `products` connection
 * with `pageInfo.offsetPagination.total` from the `CategoryWithProducts` fragment.
 */
export const CATEGORY_FRAGMENT = `
  fragment CategoryFields on ProductCategory {
    id
    databaseId
    name
    slug
    count
    image {
      ...ImageFields
    }
  }
`;

/**
 * GraphQL Fragment for Product Category with accurate product count
 * including products from child subcategories.
 */
export const CATEGORY_WITH_COUNT_FRAGMENT = `
  fragment CategoryWithCountFields on ProductCategory {
    id
    databaseId
    name
    slug
    image {
      ...ImageFields
    }
    products(first: 0) {
      pageInfo {
        offsetPagination {
          total
        }
      }
    }
  }
`;

/**
 * Query to fetch a list of products.
 */
export const GET_PRODUCTS = `
  ${IMAGE_FRAGMENT}
  ${PRODUCT_FRAGMENT}
  query GetProducts($first: Int = 12) {
    products(first: $first) {
      nodes {
        ...ProductFields
      }
    }
  }
`;

/**
 * Query to fetch a list of product categories with accurate product counts
 * (including products from child subcategories via offsetPagination.total).
 */
export const GET_CATEGORIES = `
  ${IMAGE_FRAGMENT}
  ${CATEGORY_WITH_COUNT_FRAGMENT}
  query GetCategories($first: Int = 20) {
    productCategories(first: $first) {
      nodes {
        ...CategoryWithCountFields
      }
    }
  }
`;

export const GET_PRODUCT_BY_SLUG = `
  ${IMAGE_FRAGMENT}
  ${PRODUCT_FRAGMENT}
  ${SEO_FRAGMENT}
  query GetProductBySlug($slug: ID!) {
    product(id: $slug, idType: SLUG) {
      ...ProductFields
      description
      shortDescription
      galleryImages {
        nodes {
          ...ImageFields
        }
      }
      productCategories {
        nodes {
          id
          databaseId
          name
          slug
        }
      }
      seo {
        ...SeoFields
      }
    }
  }
`;

/**
 * Query to fetch a single category with its products by its slug, including category term SEO metadata.
 */
export const GET_CATEGORY_WITH_PRODUCTS = `
  ${IMAGE_FRAGMENT}
  ${PRODUCT_FRAGMENT}
  ${CATEGORY_FRAGMENT}
  ${TERM_SEO_FRAGMENT}
  query GetCategoryWithProducts($slug: ID!) {
    productCategory(id: $slug, idType: SLUG) {
      ...CategoryFields
      products(first: 50) {
        nodes {
          ...ProductFields
        }
      }
      seo {
        ...TermSeoFields
      }
    }
  }
`;

/**
 * Query to fetch the WooCommerce cart state.
 */
export const GET_CART = `
  ${IMAGE_FRAGMENT}
  ${PRODUCT_FRAGMENT}
  query GetCart {
    cart {
      contents(first: 100) {
        nodes {
          key
          product {
            node {
              ...ProductFields
            }
          }
          quantity
          subtotal
          total
        }
      }
      subtotal
      total
    }
  }
`;

/**
 * Mutation to add a product to the WooCommerce cart.
 */
export const ADD_TO_CART = `
  ${IMAGE_FRAGMENT}
  ${PRODUCT_FRAGMENT}
  mutation AddToCart($productId: Int!, $quantity: Int = 1) {
    addToCart(input: { productId: $productId, quantity: $quantity }) {
      cart {
        contents(first: 100) {
          nodes {
            key
            product {
              node {
                ...ProductFields
              }
            }
            quantity
            subtotal
            total
          }
        }
        subtotal
        total
      }
    }
  }
`;

/**
 * Mutation to update a WooCommerce cart item quantity.
 */
export const UPDATE_CART_QUANTITY = `
  ${IMAGE_FRAGMENT}
  ${PRODUCT_FRAGMENT}
  mutation UpdateCartQuantity($key: ID!, $quantity: Int!) {
    updateItemQuantities(input: { items: [{ key: $key, quantity: $quantity }] }) {
      cart {
        contents(first: 100) {
          nodes {
            key
            product {
              node {
                ...ProductFields
              }
            }
            quantity
            subtotal
            total
          }
        }
        subtotal
        total
      }
    }
  }
`;

/**
 * Query checkout options that come from WooCommerce settings and the current cart session.
 */
export const GET_CHECKOUT_DATA = `
  query GetCheckoutData {
    paymentGateways(first: 20) {
      nodes {
        id
        title
        description
      }
    }
    cart {
      availableShippingMethods {
        packageDetails
        rates {
          id
          instanceId
          methodId
          label
          cost
        }
      }
      chosenShippingMethods
      subtotal
      shippingTotal
      total
    }
  }
`;

/**
 * Query to fetch a WordPress navigation menu by its location or name.
 * Uses the `MENU_ITEM_FRAGMENT` for consistent menu item fields.
 */
export const GET_MENU = `
  ${MENU_ITEM_FRAGMENT}
  query GetMenu($id: ID!, $idType: MenuNodeIdTypeEnum = LOCATION) {
    menu(id: $id, idType: $idType) {
      id
      databaseId
      name
      slug
      menuItems(first: 100) {
        nodes {
          ...MenuItemFields
        }
      }
    }
  }
`;

/**
 * Select a WooCommerce shipping method for the active cart session.
 */
export const UPDATE_SHIPPING_METHOD = `
  mutation UpdateShippingMethod($shippingMethods: [String]) {
    updateShippingMethod(input: { shippingMethods: $shippingMethods }) {
      cart {
        chosenShippingMethods
        shippingTotal
        subtotal
        total
      }
    }
  }
`;

/**
 * Submit the active WooCommerce cart through WooGraphQL checkout.
 */
export const CHECKOUT = `
  mutation Checkout($input: CheckoutInput!) {
    checkout(input: $input) {
      result
      redirect
      order {
        id
        orderNumber
        orderKey
        status
        total
      }
    }
  }
`;
