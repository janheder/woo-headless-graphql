import { createClient, cacheExchange, fetchExchange } from '@urql/core';

const isServer = typeof window === 'undefined';
const wooSessionStorageKey = 'woo-session';

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
    const headers: Record<string, string> = {};

    if (!isServer) {
      const wooSession = window.localStorage.getItem(wooSessionStorageKey);

      if (wooSession) {
        headers['woocommerce-session'] = wooSession;
      }
    }

    return {
      // credentials: 'include' is critical for Svelte/Client queries to send WooCommerce cookies
      credentials: isServer ? 'same-origin' : 'include',
      headers,
    };
  },
  fetch: async (input, init) => {
    const response = await fetch(input, init);

    if (!isServer) {
      const wooSession = response.headers.get('woocommerce-session');

      if (wooSession) {
        window.localStorage.setItem(wooSessionStorageKey, wooSession);
      }
    }

    return response;
  },
});
