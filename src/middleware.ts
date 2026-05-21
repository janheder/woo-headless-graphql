import { defineMiddleware } from "astro:middleware";

/**
 * List of paths that should bypass the Astro frontend and 
 * be proxied directly to the WordPress/WooCommerce backend.
 * 
 * NOTE: /wp-admin and /wp-login.php are intentionally omitted 
 * to keep the WordPress dashboard secured strictly under the backend subdomain.
 */
const WORDPRESS_PROXY_PATHS: string[] = [
  "/kosik",       // Czech WooCommerce cart slug
  "/pokladna",    // Czech WooCommerce checkout slug
  "/cart",        // English fallback
  "/checkout",    // English fallback
  "/wp-content",  // Theme, Plugin, and Uploaded media assets
  "/wp-includes", // Core WordPress frontend shared core assets
  "/wp-json",     // WordPress REST API
  "/graphql",     // WPGraphQL / WooGraphQL endpoint
];

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);

  // Check if the current request path matches any of the allowed proxy paths
  const shouldProxyToWordPress = WORDPRESS_PROXY_PATHS.some((path) =>
    url.pathname.startsWith(path)
  );

  if (shouldProxyToWordPress) {
    const targetUrl = new URL(context.request.url);
    
    // Transparently route the hostname to the Cloudways origin backend
    targetUrl.hostname = "backend.janheder.space";

    // Clone and extend the original incoming headers
    const forwardedHeaders = new Headers(context.request.headers);
    
    // Critical headers for the modified wp-config.php to detect the public host mapping
    forwardedHeaders.set("X-Forwarded-Host", url.host);
    forwardedHeaders.set("X-Forwarded-Proto", "https");

    // Construct the proxy request payload context using a loose type map
    // to prevent TypeScript compilation failures during the GitHub Actions build step.
    const requestOptions: Record<string, any> = {
      method: context.request.method,
      headers: forwardedHeaders,
      body: context.request.body,
      duplex: "half", // Critically needed by Cloudflare to stream request bodies (POST data)
      credentials: "include", // Forwards WooCommerce session identifiers
    };

    // We cast to unknown first, then to RequestInit to make the Request constructor happy
    const proxiedRequest = new Request(targetUrl, requestOptions as unknown as RequestInit);

    try {
      // Securely fetch the live streaming asset or document from the Cloudways node
      return await fetch(proxiedRequest);
    } catch (error) {
      console.error(`[Proxy Error] Failed to transparently route request to WordPress origin:`, error);
      return new Response("Backend ecommerce engine is temporarily unavailable.", { status: 502 });
    }
  }

  // If it's a regular marketing, dynamic catalog or static route, delegate execution back to Astro
  return next();
});