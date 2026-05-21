# Project Specification: Headless WooCommerce (Astro + Svelte + GraphQL)

## 1. Core Tech Stack
*   **Frontend Framework:** Astro (latest) - focus on Islands Architecture.
*   **Rendering Mode:** Astro Hybrid Mode (`output: 'hybrid'`). Marketing, categories, and product details are prerendered statically at build time; dynamic routes use SSR.
*   **UI Library:** Svelte 5 (using Runes for interactive components like Cart, Login, Filters).
*   **Data Layer:** GraphQL (WPGraphQL + WooGraphQL).
*   **GraphQL Client:** `@urql/core` (lightweight, document caching).
*   **Styling:** Scoped Vanilla CSS (within components) + Global CSS Variables.
*   **Language:** TypeScript (Strict mode).

## 2. Backend Environment (WordPress)
*   **Source:** WordPress + WooCommerce hosted on Cloudways.
*   **WordPress Origin URL:** `backend.janheder.space` (Hidden origin domain used by Astro during build time and by the middleware proxy at runtime).
*   **Public GraphQL Endpoint:** `janheder.space/graphql` (The proxied public route used by client-side queries).
*   **Required Plugins:**
    *   WPGraphQL (Core)
    *   WooGraphQL (WooCommerce integration)
    *   WPGraphQL JWT Authentication (For customer login)
    *   WPGraphQL RankMath (For SEO metadata via GQL)

## 3. Styling & Design System
*   **Design Mode:** Strictly **Light Mode** only.
*   **Unit System:** Use **rem** for all sizes, spacing, and typography.
*   **Base Calculation:** The `html` font-size is set to **62.5%**, meaning **1rem = 10px**.
    *   *Example:* 16px = 1.6rem, 24px = 2.4rem, 10px = 1rem.
*   **Global Styles:** Located in `src/styles/global.css`.
    *   Contains Modern CSS Reset, Typography, and global HTML tag styles.
    *   Defines a `:root` element with CSS Variables for colors, spacing, and fonts.
*   **Component Styling:**
    *   Every `.astro` and `.svelte` component MUST have its own `<style>` block.
    *   **NO Tailwind CSS** or utility-first frameworks.
    *   Always use `var(--variable-name)` for colors and spacing.
*   **Responsivity:** Use standard CSS Media Queries within component styles.

## 4. Data Handling & Architecture (Hybrid Checkout)
*   **Cart Management:**
    *   Managed via a Svelte "Drawer" component on the frontend.
    *   Communicates with WooGraphQL mutations (`addToCart`, `updateItemQuantities`, etc.).
*   **Cart Strategy (Headless GraphQL):**
    *   The frontend implements the cart drawer and `/cart` page in Astro/Svelte.
    *   Cart state is read and updated only through WooGraphQL mutations and queries.

## 5. Routing & Proxy Strategy (Astro Middleware Proxy)
*   **Public Domain:** `janheder.space` (Single public domain for the entire user experience).
*   **Infrastructure:** Astro frontend deployed on Cloudflare Pages using the `@astrojs/cloudflare` adapter.
*   **Proxy Implementation:** Handled natively inside the project via Astro Middleware (`src/middleware.ts`).
*   **Middleware Rerouting Rules:** Any incoming request matching the following paths bypasses Astro rendering and is transparently fetched from `backend.janheder.space` (preserving all headers, methods, and cookies):
    *   `/wp-content/*`, `/wp-includes/*` (WordPress core assets, uploads, and media)
    *   `/wp-json/*` (WordPress REST API)
    *   `/graphql` (The WPGraphQL / WooGraphQL endpoint)

## 6. Coding Standards for AI (Gemini)
*   **Component Pattern:** Logic/Script block first, followed by HTML structure, followed by Scoped CSS.
*   **Naming Conventions:**
    *   **Components:** Always `PascalCase` (e.g., `Breadcrumbs.astro`, `CartDrawer.svelte`).
    *   **Filenames:** Must match the component name exactly.
    *   **CSS Classes:** Always `kebab-case` (e.g., `.product-grid`).
*   **Language:** ALL code, variable names, architecture configurations, and comments MUST be in English.
*   **Type Safety:** Define explicit Interfaces for all GraphQL query and mutation results.
*   **API Client:** 
    *   Centralize GraphQL execution in `src/lib/wp-client.ts` using `urql`.
    *   **CRITICAL:** Every runtime fetch/request originating from the client MUST include `credentials: 'include'` to pass WooCommerce session cookies.

## 7. SEO & Metadata
*   **RankMath Integration:** RankMath SEO inside WordPress is the single source of truth.
*   **Base URL:** Configured as `janheder.space` inside WordPress settings.
*   **Implementation:** Astro fetches SEO metadata (title, meta tags, OpenGraph) via GraphQL for each route during generation and injects them into the global `<head>`.
*   **Sitemap:** The sitemap XML is served from WordPress via the proxy but must reference frontend public URLs.

## 8. Environment Variables (.env)
*   `WORDPRESS_GRAPHQL_ENDPOINT="https://backend.janheder.space/graphql"` (Used by Astro server-side during build time to fetch static catalog data).
*   `PUBLIC_GRAPHQL_ENDPOINT="/graphql"` (Relative path used by Svelte 5 components on the client side to target the middleware proxy wrapper).
*   `PUBLIC_SITE_URL="https://janheder.space"`

## 9. Media & URL Rewrite Strategy
*   **Media Handling:** All image optimization (WebP, Compression) is offloaded to WordPress/Cloudways.
*   **Asset Paths:** WordPress returns absolute backend URLs in GraphQL payloads (e.g., `https://backend.janheder.space/wp-content/uploads/...`). The frontend must strip the backend hostname or replace it with a relative path (`/wp-content/uploads/...`) so assets load securely through the public middleware proxy.
*   **Lazy Loading:** Use native `loading="lazy"` for all non-hero images.

## 10. Svelte 5 & State Management Patterns
*   **Reactivity:** Use `$state` and `$derived` (Runes) for all shared frontend state. Avoid legacy Svelte 4 writable stores.
*   **Bridge Pattern:** Initialize a global `window.cart` object from the Svelte rune state to handle interactions.
*   **SSR Safety:** Svelte 5 components and shared runes accessing browser-only globals (e.g., `window`, `document`, `localStorage`) MUST guard execution using `if (typeof window !== 'undefined')` or encapsulate logic within `$effect` run blocks to prevent Astro build failures during server-side pre-rendering.
*   **Static Interaction:** Implement a single, global event listener in `Layout.astro` targeting `.ajax-add-to-cart` click triggers to minimize the hydration JavaScript footprint on static pages.

## 11. GraphQL Pattern (Fragments)
*   **DRY Content:** Enforce strict use of GraphQL fragments for repeating data nodes (Product fields, Image structures, Category blocks) to ensure consistency across Astro layouts and Svelte templates.
*   **Error Handling:** Implement resilient data fetching with fallback states (Stale-While-Revalidate behavior) ensuring Astro builds successfully using stale cached data if the WordPress GraphQL API is momentarily unreachable during a deployment build.
