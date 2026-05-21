import { defineMiddleware } from "astro:middleware";

const WORDPRESS_BACKEND_HOST = "backend.janheder.space";

/**
 * List of paths that should bypass the Astro frontend and 
 * be proxied directly to the WordPress/WooCommerce backend.
 * 
 * NOTE: /wp-admin and /wp-login.php are intentionally omitted 
 * to keep the WordPress dashboard secured strictly under the backend subdomain.
 */
const WORDPRESS_PROXY_PATHS: string[] = [
  "/cart",        // Native WooCommerce cart
  "/wp-content",  // Theme, Plugin, and Uploaded media assets
  "/wp-includes", // Core WordPress frontend shared core assets
  "/wp-json",     // WordPress REST API
  "/graphql",     // WPGraphQL / WooGraphQL endpoint
];

function splitSetCookieHeader(header: string) {
  return header.split(/,(?=\s*[^;,]+=)/g).map((cookie) => cookie.trim());
}

function getSetCookieHeaders(headers: Headers) {
  const getSetCookie = (headers as any).getSetCookie;

  if (typeof getSetCookie === "function") {
    return getSetCookie.call(headers) as string[];
  }

  const header = headers.get("set-cookie");
  return header ? splitSetCookieHeader(header) : [];
}

function createPublicProxyResponse(response: Response, publicUrl: URL) {
  const headers = new Headers(response.headers);
  const setCookieHeaders = getSetCookieHeaders(response.headers);
  const location = headers.get("location");

  headers.delete("set-cookie");

  for (const cookie of setCookieHeaders) {
    headers.append(
      "set-cookie",
      cookie.replace(/;\s*domain=[^;]+/gi, "")
    );
  }

  if (location) {
    headers.set(
      "location",
      location.replaceAll(`https://${WORDPRESS_BACKEND_HOST}`, publicUrl.origin)
    );
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);

  // Check if the current request path matches any of the allowed proxy paths
  const shouldProxyToWordPress = WORDPRESS_PROXY_PATHS.some((path) =>
    url.pathname.startsWith(path)
  );

  if (shouldProxyToWordPress) {
    const targetUrl = new URL(context.request.url);
    
    // Transparently route the hostname to the Cloudways origin backend
    targetUrl.hostname = WORDPRESS_BACKEND_HOST;

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
      const response = await fetch(proxiedRequest);
      return createPublicProxyResponse(response, url);
    } catch (error) {
      console.error(`[Proxy Error] Failed to transparently route request to WordPress origin:`, error);
      return new Response("Backend ecommerce engine is temporarily unavailable.", { status: 502 });
    }
  }

  // If it's a regular marketing, dynamic catalog or static route, delegate execution back to Astro
  return next();
});
