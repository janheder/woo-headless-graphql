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

  /**
   * Normalize an attribute name by removing 'pa_' prefix and lowercasing.
   */
  function normalizeAttrName(name: string): string {
    return name.toLowerCase().replace('pa_', '');
  }

  // Initialize selected attributes with empty strings
  $effect(() => {
    const initial: Record<string, string> = {};
    for (const attr of attributes) {
      initial[attr.name] = '';
    }
    selectedAttributes = initial;
  });

  /**
   * Compute which options are available for each attribute given current selections.
   */
  let optionAvailability: Record<string, Record<string, boolean>> = $state({});

  $effect(() => {
    const result: Record<string, Record<string, boolean>> = {};
    const variationAttrs = attributes.filter(a => a.variation);

    // Build variation data maps (normalized attr name -> value)
    const variationData = variations.map(v => {
      const attrs = v.attributes?.nodes || [];
      const map: Record<string, string> = {};
      for (const va of attrs) {
        const key = normalizeAttrName(va.name);
        if (key) map[key] = va.value;
        if (va.label) {
          const labelKey = normalizeAttrName(va.label);
          if (labelKey && !(labelKey in map)) map[labelKey] = va.value;
        }
      }
      return map;
    });

    for (const attr of variationAttrs) {
      result[attr.name] = {};
      for (const option of attr.options) {
        // Build checks from already-selected attributes (excluding current attr)
        const checks: { key: string; val: string }[] = [];
        for (const [name, value] of Object.entries(selectedAttributes)) {
          if (name !== attr.name && value !== '') {
            checks.push({ key: normalizeAttrName(name), val: value.toLowerCase() });
          }
        }

        // If no other attributes are selected yet, all options are available
        if (checks.length === 0) {
          result[attr.name][option] = true;
          continue;
        }

        // Check if there's any variation matching the already-selected attributes
        // combined with this option.
        // A variation matches if:
        //   - its value equals the option, OR
        //   - its value is "" (empty string = "Any..." in WooCommerce, meaning all options are valid)
        const isAvailable = variationData.some(vmap => {
          const attrKey = normalizeAttrName(attr.name);
          const vAttrValue = vmap[attrKey]?.toLowerCase() || '';
          return (
            (vAttrValue === option.toLowerCase() || vAttrValue === '') &&
            checks.every(c => (vmap[c.key]?.toLowerCase() || '') === c.val || (vmap[c.key] || '') === '')
          );
        });
        result[attr.name][option] = isAvailable;
      }
    }

    optionAvailability = result;
  });

  // Find matching variation when attributes change
  $effect(() => {
    const selectedEntries = Object.entries(selectedAttributes)
      .filter(([, value]) => value !== '')
      .map(([name, value]) => ({
        key: normalizeAttrName(name),
        value: value.toLowerCase()
      }));

    if (selectedEntries.length === 0) {
      selectedVariation = null;
      return;
    }

    // Check if all variation attributes are selected
    const variationAttrs = attributes.filter(a => a.variation);
    const allSelected = variationAttrs.every(attr => selectedAttributes[attr.name] !== '');

    if (!allSelected) {
      selectedVariation = null;
      return;
    }

    // Find the variation that matches all selected attributes.
    // A variation matches if:
    //   - its value equals the selected value, OR
    //   - its value is "" (empty string = "Any..." in WooCommerce)
    const match = variations.find(v => {
      const vAttrs = v.attributes?.nodes || [];
      const vmap: Record<string, string> = {};
      for (const va of vAttrs) {
        const k = normalizeAttrName(va.name);
        if (k) vmap[k] = va.value;
        if (va.label) {
          const lk = normalizeAttrName(va.label);
          if (lk) vmap[lk] = va.value;
        }
      }
      return selectedEntries.every(({ key, value }) => {
        const vAttrValue = vmap[key]?.toLowerCase() || '';
        return vAttrValue === value || vAttrValue === '';
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

  // Build the attributes array for the WooCommerce addToCart mutation
  function buildCartAttributes(): { attributeName: string; attributeValue: string }[] {
    const attrs: { attributeName: string; attributeValue: string }[] = [];
    for (const [name, value] of Object.entries(selectedAttributes)) {
      if (value !== '') {
        attrs.push({ attributeName: name, attributeValue: value });
      }
    }
    return attrs;
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
      const cartAttributes = buildCartAttributes();
      await cart.addVariationToCart(selectedVariation.databaseId, quantity, cartAttributes);
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

  <!-- SKU Display -->
  <div class="sku_wrapper">
    SKU: <span class="sku" data-o_content={selectedVariation?.sku || ''}>{selectedVariation?.sku || ''}</span>
  </div>

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

  .sku_wrapper {
    font-size: 1.4rem;
    color: var(--color-text-muted);
  }

  .sku_wrapper .sku {
    font-weight: 600;
    color: var(--color-text);
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
