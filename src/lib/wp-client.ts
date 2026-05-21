import { createClient, cacheExchange, fetchExchange } from '@urql/core';

const isServer = typeof window === 'undefined';

// Define the API endpoint dynamically based on SSR vs. Client environment
const graphqlUrl = isServer
  ? (import.meta.env.WORDPRESS_GRAPHQL_ENDPOINT || 'https://backend.janheder.space/graphql')
  : (import.meta.env.PUBLIC_GRAPHQL_ENDPOINT || '/graphql');

/**
 * Centrally configured URQL Client.
 * Automatically forwards session cookies for WooCommerce on client-side requests
 * and targets the secure backend hostname during server-side static builds.
 */
export const client = createClient({
  url: graphqlUrl,
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: () => {
    return {
      // credentials: 'include' is critical for Svelte/Client queries to send WooCommerce cookies
      credentials: isServer ? 'same-origin' : 'include',
    };
  },
});
