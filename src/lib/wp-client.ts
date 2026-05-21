import { createClient, cacheExchange, fetchExchange } from '@urql/core';

const isServer = typeof window === 'undefined';
const wooSessionStorageKey = 'woo-session';

function normalizeWooSessionToken(token: string) {
  return token.replace(/^Session\s+/i, '').trim();
}

function getWooSessionToken() {
  if (isServer) return null;

  const token = window.localStorage.getItem(wooSessionStorageKey);
  return token ? normalizeWooSessionToken(token) : null;
}

export async function prepareNativeCartSession(path = '/cart') {
  if (isServer) return;

  const wooSession = getWooSessionToken();

  if (!wooSession) return;

  await fetch(path, {
    credentials: 'include',
    headers: {
      'woocommerce-session': `Session ${wooSession}`,
    },
  });
}

export function saveWooSessionToken(token: string | null | undefined) {
  if (isServer || !token) return;

  window.localStorage.setItem(wooSessionStorageKey, normalizeWooSessionToken(token));
}

function clearWooSessionToken() {
  if (isServer) return;

  window.localStorage.removeItem(wooSessionStorageKey);
}

async function hasInvalidCartTokenError(response: Response) {
  try {
    const body = await response.clone().json();
    return body?.errors?.some((error: any) => {
      const code = error?.extensions?.code || error?.code;
      return code === 'invalid_cart_token' || error?.message?.includes('invalid_cart_token');
    });
  } catch {
    return false;
  }
}

async function fetchWithWooSessionRetry(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);

  if (!isServer) {
    const wooSession = response.headers.get('woocommerce-session');
    saveWooSessionToken(wooSession);

    if (await hasInvalidCartTokenError(response)) {
      clearWooSessionToken();

      const retryHeaders = new Headers(init?.headers);
      retryHeaders.delete('woocommerce-session');

      const retryResponse = await fetch(input, {
        ...init,
        headers: retryHeaders,
      });

      saveWooSessionToken(retryResponse.headers.get('woocommerce-session'));
      return retryResponse;
    }
  }

  return response;
}

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
      const wooSession = getWooSessionToken();

      if (wooSession) {
        headers['woocommerce-session'] = `Session ${wooSession}`;
      }
    }

    return {
      // credentials: 'include' is critical for Svelte/Client queries to send WooCommerce cookies
      credentials: isServer ? 'same-origin' : 'include',
      headers,
    };
  },
  fetch: fetchWithWooSessionRetry,
});
