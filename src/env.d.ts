/// <reference types="astro/client" />

/**
 * Declare module types for CSS side-effect imports.
 * Vite/Astro handle these imports at build time, but TypeScript needs a declaration
 * to avoid "Cannot find module" errors.
 *
 * This covers:
 * - Direct CSS file imports: `import './styles.css'`
 * - Package CSS subpath imports: `import '@splidejs/splide/css'`
 */
declare module '*.css' {}
declare module '@splidejs/splide/css' {}
