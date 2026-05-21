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
  fragment SeoFields on PostTypeSEO {
    title
    metaDesc
    canonical
    opengraphTitle
    opengraphDescription
    opengraphImage {
      sourceUrl
    }
  }
`;

/**
 * GraphQL Fragment for RankMath SEO on Terms (Categories).
 */
export const TERM_SEO_FRAGMENT = `
  fragment TermSeoFields on TermNodeSEO {
    title
    metaDesc
    canonical
    opengraphTitle
    opengraphDescription
    opengraphImage {
      sourceUrl
    }
  }
`;

/**
 * GraphQL Fragment for WooCommerce Product base fields.
 * Extends fields specifically for simple and variable products to get price states.
 */
export const PRODUCT_FRAGMENT = `
  ${IMAGE_FRAGMENT}
  fragment ProductFields on Product {
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
  }
`;

/**
 * GraphQL Fragment for WooCommerce Product Category fields.
 */
export const CATEGORY_FRAGMENT = `
  ${IMAGE_FRAGMENT}
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
 * Query to fetch a list of products.
 */
export const GET_PRODUCTS = `
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
 * Query to fetch a list of product categories.
 */
export const GET_CATEGORIES = `
  ${CATEGORY_FRAGMENT}
  query GetCategories($first: Int = 20) {
    productCategories(first: $first, where: { hideEmpty: true }) {
      nodes {
        ...CategoryFields
      }
    }
  }
`;

/**
 * Query to fetch a single product details by its slug, including gallery and SEO metadata.
 */
export const GET_PRODUCT_BY_SLUG = `
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
  ${PRODUCT_FRAGMENT}
  ${CATEGORY_FRAGMENT}
  ${TERM_SEO_FRAGMENT}
  query GetCategoryWithProducts($slug: ID!) {
    productCategory(id: $slug, idType: SLUG) {
      ...CategoryFields
      seo {
        ...TermSeoFields
      }
      products(first: 50) {
        nodes {
          ...ProductFields
        }
      }
    }
  }
`;
