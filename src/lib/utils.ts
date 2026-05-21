/**
 * Strips the WordPress backend domain (https://backend.janheder.space) from URLs
 * to ensure they load relative to the current host, routing through the middleware proxy.
 */
export function rewriteAssetUrl(url: string | null | undefined): string {
  if (!url) return '';
  return url.replace('https://backend.janheder.space', '');
}

/**
 * Rewrites backend SEO URLs (canonical, opengraph) to the public frontend site domain.
 */
export function rewriteSeoUrl(url: string | null | undefined): string {
  if (!url) return '';
  const publicSiteUrl = import.meta.env.PUBLIC_SITE_URL || 'https://janheder.space';
  return url.replace('https://backend.janheder.space', publicSiteUrl);
}

/**
 * Decodes common HTML entities and cleans HTML text for display.
 */
export function cleanHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

/**
 * Strips WooCommerce HTML price wrappers (e.g. <span class="amount">) 
 * and normalizes the space formatting into a clean plain text string (e.g., "349 Kč").
 */
export function formatPrice(priceHtml: string | null | undefined): string {
  if (!priceHtml) return '';
  // Remove all HTML tags
  let clean = priceHtml.replace(/<[^>]*>/g, '');
  // Decode space entities and trim
  return clean.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
