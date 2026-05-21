import { client } from './wp-client';

/**
 * Resilient server-side helper to fetch data from WordPress/WooCommerce GraphQL API.
 * 
 * @param query The GraphQL query string or DocumentNode
 * @param variables Optional variables object for the query
 * @returns The typed data response, or null if the request failed
 */
export async function fetchGQL<T, V = Record<string, any>>(
  query: string, 
  variables?: V
): Promise<T | null> {
  try {
    const result = await client.query<T, any>(query, variables).toPromise();
    
    if (result.error) {
      console.error('[GraphQL Error] Query execution returned error(s):');
      console.error(JSON.stringify(result.error, null, 2));
      
      // Return partial data if available, otherwise null
      return result.data || null;
    }
    
    if (!result.data) {
      console.warn('[GraphQL Warning] Query returned no data.');
      return null;
    }
    
    return result.data;
  } catch (error) {
    console.error('[GraphQL Exception] Failed to execute query via URQL:', error);
    return null;
  }
}
