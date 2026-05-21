# Project Workflow: Headless WooCommerce (Astro + Svelte)

This file defines our iterative development process. The AI agent must strictly work only on the current phase. Once a phase is complete, we stop, review the results, and check it off.

## Phase 1: Preparation & Base Environment
- [ ] Create `specs.md` (English source of truth).
- [ ] Initialize git repository.
- [ ] Setup Astro project (`output: 'hybrid'`, TypeScript, Svelte integration).
- [ ] Implement `src/middleware.ts` (Astro Middleware proxy for `/kosik`, `/pokladna`, `/graphql`, `/wp-content`).
- [ ] Initialize `src/styles/global.css` (Reset, 62.5% font-size base, CSS variables).
- [ ] Setup `src/layouts/Layout.astro` (Base wrapper with SEO layout).
- [ ] Port `LoadingIndicator.astro` from V1.

## Phase 2: GraphQL & Data Client
- [ ] Install `@urql/core`, `graphql`.
- [ ] Create `src/lib/wp-client.ts` (URQL client setup with `credentials: 'include'`).
- [ ] Define **GraphQL Fragments** for Product, Category, and SEO in `src/lib/queries.ts`.
- [ ] Define shared TypeScript interfaces for WooGraphQL data (`src/types/woo.types.ts`).
- [ ] Create a `fetchGQL` server helper with basic error handling/fallback for build failures.
- [ ] Verify test query execution through the proxy route.

## Phase 3: Core Prerendered Pages (Astro Catalog)
- [ ] Create `src/pages/index.astro` (Homepage layout).
- [ ] Create Static Product Card / Grid components.
- [ ] Create Dynamic Product Detail routing (`src/pages/product/[slug].astro` using `getStaticPaths`).
- [ ] Implement `Breadcrumbs.astro` (Reusable structural component).
- [ ] Integrate RankMath SEO data fetching inside the Astro Global Layout.

## Phase 4: Svelte Interactivity & Global State
- [ ] Create `src/stores/cart.svelte.ts` (Global Svelte 5 store using Runes with SSR guards).
- [ ] Implement GraphQL mutation wrappers (`addToCart`, `updateCart`, `fetchCart`).
- [ ] Create `CartDrawer.svelte` (Interactive Svelte 5 Island component).
- [ ] Map the `window.cart` bridge API inside the client runtime script.
- [ ] Embed the global event tracking delegation for `.ajax-add-to-cart` nodes in `Layout.astro`.
- [ ] Add loading skeletons and instant UI toast feedback signals.

## Phase 5: Cookie & State Verification (Proxy Runtime)
- [ ] Confirm that browser network headers include `wp_woocommerce_session` cookies during GraphQL mutations.
- [ ] Verify complete cart state persistence across page hot-reloads and route changes.
- [ ] Finalize WordPress WooCommerce styling hooks (matching the Astro layout for header/footer transparency on proxy checkouts).
- [ ] Execute comprehensive frontend-to-proxy checkout transaction trials.

## Phase 6: Refinement & Deployment
- [ ] Conduct visual quality audit (Rem scaling validation, viewports check).
- [ ] Strip out fallback test utilities and unused assets.
- [ ] Push codebase to production and verify Cloudflare Pages SSR deployment pipeline.