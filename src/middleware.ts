import { defineMiddleware } from "astro:middleware";

/**
 * List of paths that should bypass the Astro frontend and 
 * be proxied directly to the WordPress/WooCommerce backend.
 */
const WORDPRESS_PROXY_PATHS: string[] = [
    "/kosik",        // Czech WooCommerce cart slug
    "/pokladna",     // Czech WooCommerce checkout slug
    "/cart",         // English fallback
    "/checkout",     // English fallback
    "/wp-admin",     // WordPress Dashboard
    "/wp-login.php", // WordPress Login
    "/wp-content",   // Theme, Plugin, and Uploaded assets
    "/wp-includes",  // Core WordPress frontend assets
    "/wp-json",      // WordPress REST API
    "/graphql",      // WPGraphQL / WooGraphQL endpoint
];

export const onRequest = defineMiddleware(async (context, next) => {
    const url = new URL(context.request.url);

    // Check if the current request path matches any of the WordPress core or ecommerce paths
    const shouldProxyToWordPress = WORDPRESS_PROXY_PATHS.some((path) =>
        url.pathname.startsWith(path)
    );

    if (shouldProxyToWordPress) {
        const targetUrl = new URL(context.request.url);

        // Transparently reroute the host to the Cloudways production origin
        targetUrl.hostname = "backend.janheder.space";

        // Create a modified request preserving all original methods, headers, and credentials/cookies
        const proxiedRequest = new Request(targetUrl, context.request);

        try {
            // Fetch the live response from the Cloudways WordPress server
            return await fetch(proxiedRequest);
        } catch (error) {
            console.error(`[Proxy Error] Failed to fetch data from WordPress origin:`, error);
            return new Response("Backend temporarily unavailable.", { status: 502 });
        }
    }

    // If it's a regular marketing, product, or catalog page, let Astro handle the Hybrid/Static rendering
    return next();
});