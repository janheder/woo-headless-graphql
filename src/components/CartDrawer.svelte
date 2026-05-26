<script lang="ts">
  import { cart } from "../stores/cart.svelte";
  import { rewriteAssetUrl, formatPrice } from "../lib/utils";
  import { fade, slide } from "svelte/transition";
  import type { CartItem } from "../types/woo.types";

  /**
   * Get the variation attribute label for display (e.g., "Rozměry: Velké L").
   *
   * Uses purely DB data:
   * - `item.attributes` — raw values the customer selected (always present, even for "Any...")
   * - `item.product.node.attributes` — human-readable labels + term names from WordPress
   *
   * Falls back to variation-level attributes if `item.attributes` is not available.
   * No JS string transformations — everything comes from the database.
   */
  function getVariationLabel(item: CartItem): string | null {
    // 1. Try the actual cart-level attributes first (customer's real selection)
    const chosenAttributes = item.attributes;
    if (chosenAttributes && chosenAttributes.length > 0) {
      const productAttributes = item.product.node.attributes?.nodes || [];
      return chosenAttributes
        .map(chosen => {
          // Find the DB attribute definition by system name (e.g. "pa_size")
          const dbAttribute = productAttributes.find(
            a => a.name.toLowerCase() === chosen.name.toLowerCase()
          );
          // Human-readable label from DB (e.g. "Rozměry"), fallback to system name
          const attributeLabel = dbAttribute?.label || chosen.name;

          // Find the human-readable term name by slug (e.g. "l" → "Velké L")
          const dbTerm = dbAttribute?.terms?.nodes?.find(
            t => t.slug.toLowerCase() === chosen.value.toLowerCase()
          );
          const termName = dbTerm?.name || chosen.value;

          return `${attributeLabel}: ${termName}`;
        })
        .join(', ');
    }

    // 2. Fallback: use variation-level attributes (may miss "Any..." attributes)
    const attrs = item.variation?.node?.attributes?.nodes;
    if (!attrs || attrs.length === 0) return null;
    const validAttrs = attrs.filter(a => a.value && a.value.trim() !== '');
    if (validAttrs.length === 0) return null;
    const productAttributes = item.product.node.attributes?.nodes || [];
    return validAttrs
      .map(a => {
        const dbAttribute = productAttributes.find(
          pa => pa.name.toLowerCase() === a.name.toLowerCase()
        );
        const label = dbAttribute?.label || a.label || a.name;
        return `${label}: ${a.value}`;
      })
      .join(', ');
  }

  /**
   * Get the effective price info for a cart item, considering variations.
   */
  function getItemPriceInfo(item: CartItem) {
    const variation = item.variation?.node;
    const hasSale = variation
      ? !!(variation.onSale && variation.salePrice)
      : !!(item.product.node.onSale && item.product.node.regularPrice);
    const regularPrice = variation ? variation.regularPrice : item.product.node.regularPrice;
    const currentPrice = variation
      ? (variation.onSale && variation.salePrice ? variation.salePrice : variation.price)
      : item.product.node.price;
    return { hasSale, regularPrice, currentPrice };
  }

  // Svelte 5 effect to manage page scroll lock when drawer is active
  $effect(() => {
    if (cart.isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  });

  // Handle click on the backdrop to close
  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      cart.toggleDrawer(false);
    }
  }

  // Increment item quantity
  function incrementItem(key: string, currentQty: number) {
    cart.updateQuantity(key, currentQty + 1);
  }

  // Decrement item quantity (removes if reaches 0)
  function decrementItem(key: string, currentQty: number) {
    cart.updateQuantity(key, currentQty - 1);
  }

  // Remove item completely
  function removeItem(key: string) {
    cart.updateQuantity(key, 0);
  }
</script>

{#if cart.isOpen}
  <!-- Cart Backdrop with fade-in effect -->
  <div
    class="cart-backdrop"
    onclick={handleBackdropClick}
    transition:fade={{ duration: 250 }}
    role="presentation"
  >
    <!-- Cart Sliding Panel -->
    <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
    <aside
      class="cart-panel"
      transition:slide={{ axis: "x", duration: 300 }}
      role="dialog"
      aria-modal="true"
      aria-label="Nákupní košík"
    >
      <!-- Panel Header -->
      <header class="cart-header">
        <h2 class="cart-title">
          Košík <span class="item-count-badge">{cart.count}</span>
        </h2>
        <button
          class="close-button"
          onclick={() => cart.toggleDrawer(false)}
          aria-label="Zavřít košík"
        >
          &times;
        </button>
      </header>

      <!-- Main Scrollable Content -->
      <div class="cart-body">
        {#if cart.loading && cart.items.length === 0}
          <div class="skeleton-container">
            {#each Array(3) as _}
              <div class="skeleton-item">
                <div class="skeleton-thumb"></div>
                <div class="skeleton-details">
                  <div class="skeleton-line skeleton-title"></div>
                  <div class="skeleton-line skeleton-price"></div>
                </div>
              </div>
            {/each}
          </div>
        {:else if cart.items.length === 0}
          <div class="empty-state" in:fade>
            <div class="empty-icon">🛒</div>
            <h3>Váš košík je prázdný</h3>
            <p>Vyberte si z naší nabídky produktů a naplňte svůj košík.</p>
            <button
              class="btn btn-primary"
              onclick={() => cart.toggleDrawer(false)}
            >
              Pokračovat v nákupu
            </button>
          </div>
        {:else}
          <div class="items-list">
            {#each cart.items as item (item.key)}
              <div class="cart-item" out:slide|local={{ duration: 200 }}>
                <!-- Product Image -->
                <div class="item-image-wrapper">
                  {#if item.variation?.node?.image?.sourceUrl || item.product.node.image?.sourceUrl}
                    {@const imgSrc = item.variation?.node?.image?.sourceUrl || item.product.node.image?.sourceUrl}
                    <img
                      src={rewriteAssetUrl(imgSrc)}
                      alt={item.product.node.image?.altText ||
                        item.product.node.name}
                      class="item-image"
                    />
                  {:else}
                    <div class="item-image-placeholder"></div>
                  {/if}
                </div>

                <!-- Product Details -->
                <div class="item-info">
                  <div class="item-header">
                    <a
                      href={`/product/${item.product.node.slug}`}
                      class="item-name"
                      onclick={() => cart.toggleDrawer(false)}
                    >
                      {item.product.node.name}
                    </a>
                    {#if getVariationLabel(item)}
                      <span class="item-variation-label">
                        {getVariationLabel(item)}
                      </span>
                    {/if}
                    <button
                      class="remove-button"
                      onclick={() => removeItem(item.key)}
                      aria-label="Odstranit položku"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        ><polyline points="3 6 5 6 21 6"></polyline><path
                          d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                        ></path><line x1="10" y1="11" x2="10" y2="17"
                        ></line><line x1="14" y1="11" x2="14" y2="17"
                        ></line></svg
                      >
                    </button>
                  </div>

                  <!-- Price and Quantity Controls -->
                  <div class="item-controls-price">
                    <div class="qty-controller">
                      <button
                        class="qty-btn"
                        onclick={() => decrementItem(item.key, item.quantity)}
                        disabled={cart.loading}
                        aria-label="Snížit množství"
                      >
                        -
                      </button>
                      <span class="qty-value">{item.quantity}</span>
                      <button
                        class="qty-btn"
                        onclick={() => incrementItem(item.key, item.quantity)}
                        disabled={cart.loading}
                        aria-label="Zvýšit množství"
                      >
                        +
                      </button>
                    </div>

                    <!-- Price Box (Single and Subtotal) -->
                    <div class="price-display">
                      {#if getItemPriceInfo(item).hasSale && getItemPriceInfo(item).regularPrice}
                        <span class="price-old"
                          >{formatPrice(getItemPriceInfo(item).regularPrice)}</span
                        >
                      {/if}
                      <span class="price-current"
                        >{formatPrice(getItemPriceInfo(item).currentPrice)}</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Drawer Footer (Sticky Summary) -->
      {#if cart.items.length > 0}
        <footer class="cart-footer">
          <div class="summary-row">
            <span class="summary-label">Mezisoučet</span>
            <span class="summary-value">{cart.subtotal}</span>
          </div>
          <div class="summary-row shipping-row">
            <span class="summary-label">Doprava</span>
            <span class="summary-value success">Zdarma</span>
          </div>
          <div class="summary-row total-row">
            <span class="summary-label">Celkem</span>
            <span class="summary-value highlight">{cart.total}</span>
          </div>

          <!-- Checkout Redirect Buttons -->
          <div class="action-buttons">
            <a
              href="/cart"
              class="btn btn-primary btn-full cart-link"
              disabled={cart.loading}
              onclick={() => cart.toggleDrawer(false)}
            >
              {#if cart.loading}
                Aktualizuji...
              {:else}
                Přejít k pokladně
              {/if}
            </a>
            <button
              class="btn btn-secondary btn-full continue-shopping"
              onclick={() => cart.toggleDrawer(false)}
            >
              Pokračovat v nákupu
            </button>
          </div>
        </footer>
      {/if}

      <!-- Loading Overlay indicator -->
      {#if cart.loading && cart.items.length > 0}
        <div class="loading-overlay" transition:fade={{ duration: 150 }}>
          <div class="spinner"></div>
        </div>
      {/if}
    </aside>
  </div>
{/if}

<style>
  /* Base Layout */
  .cart-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(0.4rem);
    z-index: 2000;
    display: flex;
    justify-content: flex-end;
  }

  .cart-panel {
    width: 100%;
    max-width: 48rem;
    height: 100%;
    background-color: var(--color-surface);
    box-shadow: var(--shadow-xl);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

  /* Header Styles */
  .cart-header {
    height: 7rem;
    padding: 0 var(--spacing-lg);
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 0.1rem solid var(--color-border);
  }

  .cart-title {
    font-size: 2.2rem;
    font-weight: 700;
    color: var(--color-text);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .item-count-badge {
    background-color: var(--color-primary-light);
    color: var(--color-primary);
    font-size: 1.3rem;
    font-weight: 700;
    padding: 0.2rem var(--spacing-sm);
    border-radius: var(--radius-full);
  }

  .close-button {
    font-size: 3.6rem;
    color: var(--color-text-muted);
    background: none;
    border: none;
    cursor: pointer;
    line-height: 1;
    transition: color var(--transition-fast);
  }

  .close-button:hover {
    color: var(--color-primary);
  }

  /* Body Content Styles */
  .cart-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
  }

  /* Items Styling */
  .items-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .cart-item {
    display: flex;
    gap: var(--spacing-md);
    padding-bottom: var(--spacing-md);
    border-bottom: 0.1rem solid var(--color-border);
  }

  .item-image-wrapper {
    width: 8rem;
    height: 8rem;
    border-radius: var(--radius-md);
    border: 0.1rem solid var(--color-border);
    overflow: hidden;
    flex-shrink: 0;
    background-color: var(--color-bg);
  }

  .item-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .item-image-placeholder {
    width: 100%;
    height: 100%;
    background-color: var(--color-border);
  }

  .item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-xs);
  }

  .item-name {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-text);
    text-decoration: none;
    line-height: 1.4;
    transition: color var(--transition-fast);
  }

  .item-name:hover {
    color: var(--color-primary);
  }

  .item-variation-label {
    display: block;
    font-size: 1.2rem;
    color: var(--color-text-muted);
    margin-top: 0.2rem;
    line-height: 1.4;
  }

  .remove-button {
    background: none;
    border: none;
    color: var(--color-text-light);
    cursor: pointer;
    padding: 0.2rem;
    transition: color var(--transition-fast);
    display: flex;
    align-items: center;
  }

  .remove-button:hover {
    color: var(--color-error);
  }

  .item-controls-price {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  /* Quantity Controller */
  .qty-controller {
    display: inline-flex;
    align-items: center;
    border: 0.1rem solid var(--color-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .qty-btn {
    width: 3.2rem;
    height: 3.2rem;
    background: var(--color-surface);
    border: none;
    font-size: 1.6rem;
    font-weight: 600;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .qty-btn:hover:not(:disabled) {
    background-color: var(--color-surface-hover);
    color: var(--color-text);
  }

  .qty-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .qty-value {
    font-size: 1.4rem;
    font-weight: 600;
    width: 3.6rem;
    text-align: center;
  }

  /* Price Displays */
  .price-display {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .price-current {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .price-old {
    font-size: 1.2rem;
    color: var(--color-text-muted);
    text-decoration: line-through;
    margin-bottom: 0.2rem;
  }

  /* Sticky Footer Summary styling */
  .cart-footer {
    border-top: 0.1rem solid var(--color-border);
    padding: var(--spacing-lg);
    background-color: var(--color-surface);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    font-size: 1.5rem;
    color: var(--color-text-muted);
  }

  .summary-value {
    color: var(--color-text);
    font-weight: 600;
  }

  .summary-value.success {
    color: var(--color-success);
    font-weight: 700;
  }

  .total-row {
    font-size: 1.8rem;
    color: var(--color-text);
    padding-top: var(--spacing-sm);
    border-top: 0.1rem dashed var(--color-border);
  }

  .total-row .highlight {
    font-size: 2.2rem;
    font-weight: 800;
    color: var(--color-primary);
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    margin-top: var(--spacing-sm);
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-sm) var(--spacing-xl);
    font-size: 1.5rem;
    font-weight: 600;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: center;
    border: none;
    text-decoration: none;
  }

  .btn-full {
    width: 100%;
  }

  .btn-primary {
    background-color: var(--color-primary);
    color: var(--color-surface);
  }

  .btn-primary:hover:not([disabled]) {
    background-color: var(--color-primary-hover);
    transform: translateY(-0.2rem);
    box-shadow: 0 0.4rem 1.2rem rgba(171, 71, 129, 0.15);
  }

  .btn-primary[disabled] {
    background-color: var(--color-border-hover);
    color: var(--color-text-light);
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: transparent;
    border: 0.1rem solid var(--color-border);
    color: var(--color-text);
  }

  .btn-secondary:hover {
    background-color: var(--color-surface-hover);
    border-color: var(--color-border-hover);
  }

  /* Empty State */
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--spacing-xxl) 0;
  }

  .empty-icon {
    font-size: 6.4rem;
    margin-bottom: var(--spacing-md);
  }

  .empty-state h3 {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: var(--spacing-xs);
  }

  .empty-state p {
    font-size: 1.5rem;
    color: var(--color-text-muted);
    margin-bottom: var(--spacing-xl);
    max-width: 28rem;
  }

  /* Skeleton Loading Styles */
  .skeleton-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .skeleton-item {
    display: flex;
    gap: var(--spacing-md);
    padding-bottom: var(--spacing-md);
    border-bottom: 0.1rem solid var(--color-border);
  }

  .skeleton-thumb {
    width: 8rem;
    height: 8rem;
    border-radius: var(--radius-md);
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .skeleton-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--spacing-xs);
  }

  .skeleton-line {
    height: 1.4rem;
    border-radius: var(--radius-xs);
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .skeleton-title {
    width: 70%;
  }

  .skeleton-price {
    width: 40%;
  }

  /* Spinners & Overlays */
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(0.1rem);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .spinner {
    width: 4rem;
    height: 4rem;
    border: 0.3rem solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: var(--radius-full);
    animation: spin 0.8s linear infinite;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
