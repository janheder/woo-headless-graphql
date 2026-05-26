<script lang="ts">
  import { cart } from "../stores/cart.svelte";
  import { formatPrice, rewriteAssetUrl } from "../lib/utils";
  import type { CartItem } from "../types/woo.types";

  function incrementItem(key: string, currentQty: number) {
    cart.updateQuantity(key, currentQty + 1);
  }

  function decrementItem(key: string, currentQty: number) {
    cart.updateQuantity(key, currentQty - 1);
  }

  function removeItem(key: string) {
    cart.updateQuantity(key, 0);
  }

  /**
   * Build a lookup map from the parent product's attributes.
   * Maps the raw attribute name (e.g. "pa_size") to an object containing
   * the human-readable label and the full attribute data (including terms).
   */
  function buildAttributeLabelMap(item: CartItem): Record<string, { label: string; terms?: { nodes: { slug: string; name: string }[] } | null }> {
    const map: Record<string, { label: string; terms?: { nodes: { slug: string; name: string }[] } | null }> = {};
    const productAttrs = item.product.node.attributes?.nodes;
    if (productAttrs) {
      for (const attr of productAttrs) {
        map[attr.name] = {
          label: attr.label || attr.name,
          terms: attr.terms,
        };
      }
    }
    return map;
  }

  /**
   * Get the variation attributes as an array of { label, value } objects.
   * Uses purely DB data and handles "Any..." (empty value) variations by matching databaseId.
   * Resolves term slugs to their human-readable names from the global attribute terms.
   */
  function getVariationAttributes(item: CartItem): { label: string; value: string }[] {
    const variationNode = item.variation?.node;
    const productNode = item.product?.node;
    const productAttributes = productNode?.attributes?.nodes || [];

    if (!variationNode || !productNode || productAttributes.length === 0) return [];

    // Find the complete DB variation data from the product's variations list by databaseId
    const dbVariation = productNode.variations?.nodes?.find(
      (v: any) => v.databaseId === variationNode.databaseId
    );

    // Use attributes from the cart level variation data first (contains actual user choices for Any...),
    // fall back to db variation attributes, and then to variation node attributes.
    const targetAttrs = item.variation?.attributes || dbVariation?.attributes?.nodes || variationNode.attributes?.nodes || [];
    if (targetAttrs.length === 0) return [];

    // Build the label map from parent product attributes
    const labelMap = buildAttributeLabelMap(item);

    return targetAttrs
      .map(a => {
        // Skip if value is still empty even in DB data
        if (!a.value || a.value.trim() === '') return null;

        // Get the human-readable attribute label
        const attrInfo = labelMap[a.name];
        const label = attrInfo?.label || a.label || a.name;

        // Resolve term slug to human-readable name from global attribute terms
        const globalAttr = productAttributes.find(
          pa => pa.name.toLowerCase() === a.name.toLowerCase()
        );
        const dbTerm = globalAttr?.terms?.nodes?.find(
          (t: any) => t.slug.toLowerCase() === a.value.toLowerCase()
        );
        const termName = dbTerm?.name || a.value;

        return { label, value: termName };
      })
      .filter(Boolean) as { label: string; value: string }[];
  }
</script>

<section class="cart-page">
  <div class="container">
    <header class="page-header">
      <div>
        <p class="eyebrow">Nákupní košík</p>
        <h1>Košík</h1>
      </div>
      {#if cart.count > 0}
        <span class="cart-count">{cart.count} položek</span>
      {/if}
    </header>

    {#if cart.error}
      <div class="notice error" role="alert">
        {cart.error}
      </div>
    {/if}

    {#if cart.loading && cart.items.length === 0}
      <div class="loading-state">
        <div class="spinner"></div>
        <span>Načítám košík...</span>
      </div>
    {:else if cart.items.length === 0}
      <div class="empty-state">
        <h2>Košík je prázdný</h2>
        <p>Vyberte si produkt z katalogu a přidejte ho do košíku.</p>
        <a href="/#katalog" class="btn btn-primary">Zpět do katalogu</a>
      </div>
    {:else}
      <div class="cart-layout">
        <div class="cart-items" aria-label="Položky v košíku">
          {#each cart.items as item (item.key)}
            <article class="cart-item">
              <a href={`/product/${item.product.node.slug}`} class="image-link">
                {#if item.product.node.image?.sourceUrl}
                  <img
                    src={rewriteAssetUrl(item.product.node.image.sourceUrl)}
                    alt={item.product.node.image.altText || item.product.node.name}
                    class="item-image"
                  />
                {:else}
                  <div class="image-placeholder"></div>
                {/if}
              </a>

              <div class="item-main">
                <div class="item-copy">
                  <a href={`/product/${item.product.node.slug}`} class="item-name">
                    {item.product.node.name}
                  </a>
                  {#if item.variation?.node?.attributes?.nodes?.length}
                    {@const attrs = getVariationAttributes(item)}
                    <div class="item-variation-labels">
                      {#each attrs as attr}
                        <span class="item-variation-single">{attr.label}: {attr.value}</span>
                      {/each}
                    </div>
                  {/if}
                  <div class="item-price">
                    {#if item.product.node.onSale && item.product.node.regularPrice}
                      <span class="price-old">{formatPrice(item.product.node.regularPrice)}</span>
                    {/if}
                    <span>{formatPrice(item.product.node.price)}</span>
                  </div>
                </div>

                <div class="item-actions">
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

                  <button
                    class="remove-btn"
                    onclick={() => removeItem(item.key)}
                    disabled={cart.loading}
                  >
                    Odebrat
                  </button>
                </div>
              </div>
            </article>
          {/each}
        </div>

        <aside class="summary" aria-label="Souhrn košíku">
          <h2>Souhrn</h2>
          <div class="summary-row">
            <span>Mezisoučet</span>
            <strong>{cart.subtotal}</strong>
          </div>
          <div class="summary-row">
            <span>Doprava</span>
            <strong class="success">Zdarma</strong>
          </div>
          <div class="summary-row total">
            <span>Celkem</span>
            <strong>{cart.total}</strong>
          </div>

          <a href="/checkout" class="btn btn-primary btn-full">
            Pokračovat k platbě
          </a>
          <a href="/#katalog" class="btn btn-secondary btn-full">
            Pokračovat v nákupu
          </a>
        </aside>
      </div>
    {/if}

    {#if cart.loading && cart.items.length > 0}
      <div class="updating" aria-live="polite">
        Aktualizuji košík...
      </div>
    {/if}
  </div>
</section>

<style>
  .cart-page {
    padding: var(--spacing-xl) 0 var(--spacing-xxxl);
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-xl);
  }

  .eyebrow {
    margin-bottom: var(--spacing-xxs);
    color: var(--color-primary);
    font-size: 1.3rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .page-header h1 {
    margin-bottom: 0;
  }

  .cart-count {
    padding: 0.6rem var(--spacing-sm);
    border-radius: var(--radius-full);
    background-color: var(--color-primary-light);
    color: var(--color-primary);
    font-size: 1.4rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .notice,
  .loading-state,
  .empty-state,
  .summary,
  .cart-item {
    background-color: var(--color-surface);
    border: 0.1rem solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .notice {
    margin-bottom: var(--spacing-lg);
    padding: var(--spacing-md);
    color: var(--color-error);
    font-weight: 600;
  }

  .loading-state,
  .empty-state {
    min-height: 34rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--spacing-xl);
  }

  .empty-state h2 {
    margin-bottom: var(--spacing-xs);
  }

  .empty-state p {
    color: var(--color-text-muted);
    margin-bottom: var(--spacing-lg);
  }

  .cart-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--spacing-lg);
    align-items: start;
  }

  @media (min-width: 900px) {
    .cart-layout {
      grid-template-columns: minmax(0, 1fr) 34rem;
    }
  }

  .cart-items {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .cart-item {
    display: grid;
    grid-template-columns: 9.6rem minmax(0, 1fr);
    gap: var(--spacing-md);
    padding: var(--spacing-md);
  }

  .image-link,
  .item-image,
  .image-placeholder {
    width: 9.6rem;
    height: 9.6rem;
  }

  .image-link {
    display: block;
    overflow: hidden;
    border-radius: var(--radius-sm);
    border: 0.1rem solid var(--color-border);
    background-color: var(--color-bg);
  }

  .item-image {
    object-fit: cover;
  }

  .image-placeholder {
    background-color: var(--color-border);
  }

  .item-main {
    min-width: 0;
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-md);
  }

  .item-copy {
    min-width: 0;
  }

  .item-name {
    display: inline-block;
    color: var(--color-text);
    font-size: 1.8rem;
    font-weight: 700;
    line-height: 1.35;
  }

  .item-name:hover {
    color: var(--color-primary);
  }

  .item-variation-labels {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.8rem;
    margin-top: 0.2rem;
  }

  .item-variation-single {
    font-size: 1.3rem;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  .item-price {
    display: flex;
    align-items: baseline;
    gap: var(--spacing-xs);
    margin-top: var(--spacing-xs);
    color: var(--color-text);
    font-weight: 700;
  }

  .price-old {
    color: var(--color-text-muted);
    font-size: 1.4rem;
    font-weight: 500;
    text-decoration: line-through;
  }

  .item-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--spacing-sm);
  }

  .qty-controller {
    display: inline-flex;
    align-items: center;
    border: 0.1rem solid var(--color-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .qty-btn,
  .qty-value {
    width: 3.6rem;
    height: 3.6rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .qty-btn {
    background-color: var(--color-surface);
    color: var(--color-text-muted);
    font-weight: 700;
  }

  .qty-btn:hover:not(:disabled) {
    background-color: var(--color-surface-hover);
    color: var(--color-text);
  }

  .qty-btn:disabled,
  .remove-btn:disabled,
  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .qty-value {
    font-size: 1.4rem;
    font-weight: 700;
  }

  .remove-btn {
    color: var(--color-error);
    font-size: 1.4rem;
    font-weight: 700;
  }

  .summary {
    position: sticky;
    top: 9rem;
    padding: var(--spacing-lg);
  }

  .summary h2 {
    margin-bottom: var(--spacing-md);
    font-size: 2.2rem;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) 0;
    color: var(--color-text-muted);
    border-bottom: 0.1rem solid var(--color-border);
  }

  .summary-row strong {
    color: var(--color-text);
  }

  .summary-row .success {
    color: var(--color-success);
  }

  .summary-row.total {
    margin-bottom: var(--spacing-md);
    color: var(--color-text);
    font-size: 1.8rem;
    font-weight: 700;
    border-bottom: none;
  }

  .summary-row.total strong {
    color: var(--color-primary);
    font-size: 2rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 4.6rem;
    padding: var(--spacing-sm) var(--spacing-lg);
    border-radius: var(--radius-md);
    font-size: 1.5rem;
    font-weight: 700;
    text-align: center;
    text-decoration: none;
    transition: all var(--transition-fast);
  }

  .btn-full {
    width: 100%;
  }

  .btn-primary {
    background-color: var(--color-primary);
    color: var(--color-surface);
  }

  .btn-primary:not(:disabled):hover {
    background-color: var(--color-primary-hover);
  }

  .btn-secondary {
    margin-top: var(--spacing-xs);
    border: 0.1rem solid var(--color-border);
    color: var(--color-text);
    background-color: var(--color-surface);
  }

  .btn-secondary:hover {
    background-color: var(--color-surface-hover);
  }

  .updating {
    position: fixed;
    right: var(--spacing-lg);
    bottom: var(--spacing-lg);
    z-index: 1000;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-full);
    background-color: var(--color-text);
    color: var(--color-surface);
    font-size: 1.4rem;
    font-weight: 700;
    box-shadow: var(--shadow-lg);
  }

  .spinner {
    width: 3.6rem;
    height: 3.6rem;
    margin-bottom: var(--spacing-sm);
    border: 0.3rem solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: var(--radius-full);
    animation: spin 0.8s linear infinite;
  }

  @media (max-width: 640px) {
    .page-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .cart-item {
      grid-template-columns: 7.2rem minmax(0, 1fr);
    }

    .image-link,
    .item-image,
    .image-placeholder {
      width: 7.2rem;
      height: 7.2rem;
    }

    .item-main {
      flex-direction: column;
    }

    .item-actions {
      align-items: flex-start;
    }

    .summary {
      position: static;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
