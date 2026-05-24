<script lang="ts">
  import { cart } from '../stores/cart.svelte';
  import { formatPrice, rewriteAssetUrl } from '../lib/utils';
  import type { ProductAttribute, ProductVariation } from '../types/woo.types';

  interface Props {
    productId: number;
    productName: string;
    attributes: ProductAttribute[];
    variations: ProductVariation[];
    defaultImage?: string;
  }

  let {
    productId,
    productName,
    attributes,
    variations,
    defaultImage,
  }: Props = $props();

  // Track selected attribute values: e.g. { "pa_color": "red", "pa_size": "large" }
  let selectedAttributes: Record<string, string> = $state({});
  let selectedVariation: ProductVariation | null = $state(null);
  let quantity: number = $state(1);
  let isAdding: boolean = $state(false);
  let errorMessage: string | null = $state(null);

  // Derive the list of variation attribute names (normalized)
  let variationAttrNames: string[] = $derived(
    attributes.filter(a => a.variation).map(a => a.name)
  );

  // Initialize selected attributes with empty strings
  $effect(() => {
    const initial: Record<string, string> = {};
    for (const attr of attributes) {
      initial[attr.name] = '';
    }
    selectedAttributes = initial;
  });

  /**
   * Normalize an attribute name by removing 'pa_' prefix and lowercasing.
   */
  function normalizeAttrName(name: string): string {
    return name.toLowerCase().replace('pa_', '');
  }

  /**
   * Check if a variation attribute node matches a given attribute name and value.
   * Handles both full taxonomy names (pa_color) and short names (color).
   */
  function variationAttrMatches(
    va: { name: string; label?: string | null; value: string },
    attrName: string,
    attrValue: string
  ): boolean {
    const vaName = normalizeAttrName(va.name);
    const vaLabel = normalizeAttrName(va.label || '');
    const checkName = normalizeAttrName(attrName);
    return (vaName === checkName || vaLabel === checkName) && va.value === attrValue;
  }

  /**
   * Compute which options are available for each attribute given current selections.
   * An option is available if there exists at least one variation matching
   * the current selections plus this option.
   */
  let optionAvailability: Record<string, Record<string, boolean>> = $derived.by(() => {
    const result: Record<string, Record<string, boolean>> = {};

    for (const attr of attributes.filter(a => a.variation)) {
      result[attr.name] = {};
      for (const option of attr.options) {
        // Build candidate selection: current selections + this option for this attribute
        const candidate = { ...selectedAttributes, [attr.name]: option };

        // Check if any variation matches the candidate
        const isAvailable = variations.some(v => {
          const vAttrs = v.attributes?.nodes || [];
          return variationAttrNames.every(van => {
            const desiredValue = candidate[van];
            if (!desiredValue) return true; // not yet selected, skip
            return vAttrs.some(va => variationAttrMatches(va, van, desiredValue));
          });
        });

        result[attr.name][option] = isAvailable;
      }
    }

    return result;
  });

  // Find matching variation when attributes change
  $effect(() => {
    const selectedValues = Object.entries(selectedAttributes)
      .filter(([, value]) => value !== '')
      .map(([name, value]) => ({ name, value }));

    if (selectedValues.length === 0) {
      selectedVariation = null;
      return;
    }

    // Check if all variation attributes are selected
    const allSelected = variationAttrNames.every(name => selectedAttributes[name] !== '');

    if (!allSelected) {
      selectedVariation = null;
      return;
    }

    // Find the variation that matches all selected attributes
    const match = variations.find(v => {
      const vAttrs = v.attributes?.nodes || [];
      return selectedValues.every(sv => {
        return vAttrs.some(va => variationAttrMatches(va, sv.name, sv.value));
      });
    });

    selectedVariation = match || null;
  });

  // Check if all required variation attributes are selected
  function allAttributesSelected(): boolean {
    const variationAttrs = attributes.filter(a => a.variation);
    return variationAttrs.every(attr => selectedAttributes[attr.name] !== '');
  }

  // Get the current display price
  function getDisplayPrice(): string {
    if (selectedVariation) {
      if (selectedVariation.onSale && selectedVariation.salePrice) {
        return formatPrice(selectedVariation.salePrice);
      }
      return formatPrice(selectedVariation.price);
    }
    // Show the minimum price from variations
    const prices = variations
      .map(v => {
        const p = v.onSale && v.salePrice ? v.salePrice : v.price;
        return p ? parseFloat(p.replace(/[^0-9.,]/g, '').replace(',', '.')) : Infinity;
      })
      .filter(p => p !== Infinity);
    if (prices.length > 0) {
      const min = Math.min(...prices);
      return `${min.toFixed(2)} Kč`;
    }
    return '';
  }

  // Get the current display regular price (for sale comparison)
  function getDisplayRegularPrice(): string | null {
    if (selectedVariation?.onSale && selectedVariation.regularPrice) {
      return formatPrice(selectedVariation.regularPrice);
    }
    return null;
  }

  // Get the current image URL
  function getDisplayImage(): string {
    if (selectedVariation?.image?.sourceUrl) {
      return rewriteAssetUrl(selectedVariation.image.sourceUrl);
    }
    return defaultImage || '';
  }

  // Handle attribute change
  function handleAttributeChange(attrName: string, value: string) {
    selectedAttributes = { ...selectedAttributes, [attrName]: value };
    errorMessage = null;
  }

  // Reset all selections
  function resetSelections() {
    const reset: Record<string, string> = {};
    for (const attr of attributes) {
      reset[attr.name] = '';
    }
    selectedAttributes = reset;
    selectedVariation = null;
    quantity = 1;
    errorMessage = null;
  }

  // Add to cart
  async function handleAddToCart() {
    if (!allAttributesSelected()) {
      errorMessage = 'Prosím vyberte všechny varianty produktu.';
      return;
    }

    if (!selectedVariation) {
      errorMessage = 'Tato kombinace variant není dostupná.';
      return;
    }

    isAdding = true;
    errorMessage = null;

    try {
      await cart.addVariationToCart(productId, selectedVariation.databaseId, quantity);
    } catch (e: any) {
      errorMessage = e?.message || 'Chyba při přidávání do košíku.';
    } finally {
      isAdding = false;
    }
  }
</script>

<div class="variations-wrapper">
  <!-- Variation Image Preview -->
  {#if selectedVariation?.image?.sourceUrl}
    <div class="variation-image-preview">
      <img
        src={rewriteAssetUrl(selectedVariation.image.sourceUrl)}
        alt={selectedVariation.name || productName}
      />
    </div>
  {/if}

  <!-- Attribute Dropdowns -->
  <table class="variations" cellspacing="0" role="presentation">
    <tbody>
      {#each attributes.filter(a => a.variation) as attr}
        <tr>
          <th class="label">
            <label for={attr.name}>{attr.label || attr.name}</label>
          </th>
          <td class="value">
            <select
              id={attr.name}
              name={attr.name}
              data-attribute_name={attr.name}
              data-show_option_none="yes"
              value={selectedAttributes[attr.name] || ''}
              onchange={(e) => handleAttributeChange(attr.name, (e.target as HTMLSelectElement).value)}
            >
              <option value="">Vyberte možnost</option>
              {#each attr.options as option}
                {@const isAvail = optionAvailability[attr.name]?.[option] ?? true}
                <option
                  value={option}
                  disabled={!isAvail}
                  class={isAvail ? 'attached enabled' : 'attached disabled'}
                >
                  {option}
                </option>
              {/each}
            </select>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <button class="reset_variations" onclick={resetSelections} type="button">
    Vyčistit
  </button>

  <!-- Price Display -->
  <div class="variation-price">
    {#if selectedVariation?.onSale && selectedVariation?.salePrice}
      <span class="price-old">{getDisplayRegularPrice()}</span>
      <span class="price-new price-discounted">{getDisplayPrice()}</span>
    {:else if selectedVariation}
      <span class="price-new">{getDisplayPrice()}</span>
    {:else if allAttributesSelected() && !selectedVariation}
      <span class="price-unavailable">Tato kombinace není dostupná</span>
    {:else}
      <span class="price-from">Od {getDisplayPrice()}</span>
    {/if}
  </div>

  <!-- Stock Status -->
  {#if selectedVariation}
    <div class="stock-status">
      {#if selectedVariation.stockStatus === 'IN_STOCK' || !selectedVariation.stockStatus}
        <span class="in-stock">✓ Skladem</span>
      {:else if selectedVariation.stockStatus === 'OUT_OF_STOCK'}
        <span class="out-of-stock">✗ Není skladem</span>
      {:else if selectedVariation.stockStatus === 'ON_BACKORDER'}
        <span class="on-backorder">⟳ Na objednávku</span>
      {/if}
    </div>
  {/if}

  <!-- Quantity Selector -->
  <div class="quantity-selector">
    <label for="variation-qty">Množství</label>
    <div class="qty-controls">
      <button
        class="qty-btn"
        onclick={() => { if (quantity > 1) quantity--; }}
        disabled={quantity <= 1}
        aria-label="Snížit množství"
      >-</button>
      <input
        id="variation-qty"
        type="number"
        bind:value={quantity}
        min="1"
        step="1"
        aria-label="Množství"
      />
      <button
        class="qty-btn"
        onclick={() => quantity++}
        aria-label="Zvýšit množství"
      >+</button>
    </div>
  </div>

  <!-- Add to Cart Button -->
  <button
    class="btn btn-primary btn-large single_add_to_cart_button"
    onclick={handleAddToCart}
    disabled={isAdding || !selectedVariation || (selectedVariation.stockStatus === 'OUT_OF_STOCK')}
  >
    {#if isAdding}
      Přidávám...
    {:else if !allAttributesSelected()}
      Vyberte varianty
    {:else if !selectedVariation}
      Nedostupné
    {:else}
      Přidat do košíku
    {/if}
  </button>

  <!-- Error Message -->
  {#if errorMessage}
    <div class="error-message">{errorMessage}</div>
  {/if}
</div>

<style>
  .variations-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .variation-image-preview {
    border: 0.1rem solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
    max-width: 20rem;
  }

  .variation-image-preview img {
    width: 100%;
    height: auto;
    display: block;
  }

  .variations {
    width: 100%;
    border-collapse: collapse;
  }

  .variations .label {
    padding: var(--spacing-sm) var(--spacing-md) var(--spacing-sm) 0;
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
    vertical-align: middle;
  }

  .variations .label label {
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .variations .value {
    padding: var(--spacing-sm) 0;
    vertical-align: middle;
  }

  .variations select {
    width: 100%;
    max-width: 28rem;
    padding: 0.8rem var(--spacing-sm);
    font-size: 1.4rem;
    border: 0.1rem solid var(--color-border);
    border-radius: var(--radius-sm);
    background-color: var(--color-bg);
    color: var(--color-text);
    cursor: pointer;
    transition: border-color var(--transition-fast);
    appearance: auto;
  }

  .variations select:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 0.2rem var(--color-primary-light);
  }

  .variations select option.disabled {
    color: var(--color-text-muted);
    background-color: var(--color-surface);
  }

  .reset_variations {
    font-size: 1.3rem;
    color: var(--color-text-muted);
    text-decoration: underline;
    cursor: pointer;
    display: inline-block;
    align-self: flex-start;
    transition: color var(--transition-fast);
  }

  .reset_variations:hover {
    color: var(--color-primary);
  }

  .variation-price {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }

  .price-new {
    font-size: 2.4rem;
    font-weight: 800;
    color: var(--color-text);
  }

  .price-discounted {
    color: var(--color-primary);
  }

  .price-old {
    font-size: 1.6rem;
    color: var(--color-text-muted);
    text-decoration: line-through;
    font-weight: 500;
  }

  .price-from {
    font-size: 1.6rem;
    color: var(--color-text-muted);
    font-weight: 500;
  }

  .price-unavailable {
    font-size: 1.5rem;
    color: var(--color-error);
    font-weight: 600;
  }

  .stock-status {
    font-size: 1.4rem;
    font-weight: 600;
  }

  .in-stock {
    color: var(--color-success);
  }

  .out-of-stock {
    color: var(--color-error);
  }

  .on-backorder {
    color: var(--color-warning, #e67e22);
  }

  .quantity-selector {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .quantity-selector label {
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .qty-controls {
    display: inline-flex;
    align-items: center;
    border: 0.1rem solid var(--color-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
    align-self: flex-start;
  }

  .qty-btn {
    width: 3.6rem;
    height: 3.6rem;
    background: var(--color-surface);
    border: none;
    font-size: 1.8rem;
    font-weight: 600;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: background-color var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .qty-btn:hover:not(:disabled) {
    background-color: var(--color-surface-hover);
    color: var(--color-text);
  }

  .qty-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .qty-controls input[type="number"] {
    width: 5rem;
    height: 3.6rem;
    text-align: center;
    font-size: 1.5rem;
    font-weight: 600;
    border: none;
    border-left: 0.1rem solid var(--color-border);
    border-right: 0.1rem solid var(--color-border);
    background-color: var(--color-bg);
    color: var(--color-text);
    -moz-appearance: textfield;
  }

  .qty-controls input[type="number"]::-webkit-outer-spin-button,
  .qty-controls input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .single_add_to_cart_button {
    align-self: flex-start;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-sm) var(--spacing-xl);
    font-size: 1.5rem;
    font-weight: 600;
    border-radius: var(--radius-md);
    border: none;
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: center;
    text-decoration: none;
  }

  .btn-primary {
    background-color: var(--color-primary);
    color: var(--color-surface);
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--color-primary-hover);
    transform: translateY(-0.2rem);
    box-shadow: 0 0.4rem 1.2rem rgba(171, 71, 129, 0.2);
  }

  .btn-primary:active:not(:disabled) {
    transform: translateY(0);
  }

  .btn-primary:disabled {
    background-color: var(--color-border-hover);
    color: var(--color-text-light);
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .btn-large {
    padding: var(--spacing-md) var(--spacing-xxl);
    font-size: 1.8rem;
    border-radius: var(--radius-lg);
  }

  .error-message {
    font-size: 1.4rem;
    color: var(--color-error);
    background-color: var(--color-surface);
    border: 0.1rem solid var(--color-error);
    border-radius: var(--radius-sm);
    padding: var(--spacing-sm) var(--spacing-md);
  }
</style>
