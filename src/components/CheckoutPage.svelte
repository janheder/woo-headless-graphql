<script lang="ts">
  import { onMount } from "svelte";
  import { cart } from "../stores/cart.svelte";
  import { client } from "../lib/wp-client";
  import { CHECKOUT, GET_CHECKOUT_DATA, UPDATE_SHIPPING_METHOD } from "../lib/queries";
  import { cleanHtml, formatPrice } from "../lib/utils";
  import type {
    CartItem,
    CheckoutInput,
    CheckoutResponse,
    GetCheckoutDataResponse,
    PaymentGateway,
    ShippingRate,
    UpdateShippingMethodResponse,
  } from "../types/woo.types";

  type CheckoutForm = {
    email: string;
    firstName: string;
    lastName: string;
    address1: string;
    address2: string;
    city: string;
    postcode: string;
    country: string;
    phone: string;
    note: string;
  };

  let form = $state<CheckoutForm>({
    email: "",
    firstName: "",
    lastName: "",
    address1: "",
    address2: "",
    city: "",
    postcode: "",
    country: "CZ",
    phone: "",
    note: "",
  });

  let paymentGateways = $state<PaymentGateway[]>([]);
  let shippingRates = $state<ShippingRate[]>([]);
  let selectedPaymentMethod = $state("");
  let selectedShippingMethod = $state("");
  let shippingTotal = $state("0 Kč");
  let checkoutTotal = $state("0 Kč");
  let loadingOptions = $state(false);
  let submitting = $state(false);
  let error = $state<string | null>(null);
  let orderNumber = $state<string | null>(null);
  let orderTotal = $state<string | null>(null);
  let acceptedTerms = $state(false);

  const canSubmit = $derived(
    cart.items.length > 0 &&
      form.email &&
      form.firstName &&
      form.lastName &&
      form.address1 &&
      form.city &&
      form.postcode &&
      form.country &&
      selectedPaymentMethod &&
      acceptedTerms &&
      !submitting
  );

  function updateCheckoutTotals(data: GetCheckoutDataResponse["cart"] | null | undefined) {
    shippingTotal = formatPrice(data?.shippingTotal) || "0 Kč";
    checkoutTotal = formatPrice(data?.total) || cart.total;
  }

  function flattenShippingRates(data: GetCheckoutDataResponse["cart"] | null | undefined) {
    return data?.availableShippingMethods?.flatMap((shippingPackage) => shippingPackage.rates || []) || [];
  }

  async function loadCheckoutData() {
    loadingOptions = true;
    error = null;

    const response = await client
      .query<GetCheckoutDataResponse, Record<string, never>>(GET_CHECKOUT_DATA, {})
      .toPromise();

    if (response.error) {
      error = response.error.message;
      loadingOptions = false;
      return;
    }

    const data = response.data;
    paymentGateways = data?.paymentGateways?.nodes || [];
    shippingRates = flattenShippingRates(data?.cart);
    selectedPaymentMethod = selectedPaymentMethod || paymentGateways[0]?.id || "";
    selectedShippingMethod =
      selectedShippingMethod ||
      data?.cart?.chosenShippingMethods?.[0] ||
      shippingRates[0]?.id ||
      "";
    updateCheckoutTotals(data?.cart);
    loadingOptions = false;
  }

  async function selectShippingMethod(rateId: string) {
    selectedShippingMethod = rateId;
    error = null;

    const response = await client
      .mutation<UpdateShippingMethodResponse, { shippingMethods: string[] }>(
        UPDATE_SHIPPING_METHOD,
        { shippingMethods: [rateId] }
      )
      .toPromise();

    if (response.error) {
      error = response.error.message;
      return;
    }

    updateCheckoutTotals(response.data?.updateShippingMethod?.cart);
    await cart.fetchCart();
  }

  async function submitOrder() {
    if (!canSubmit) return;

    submitting = true;
    error = null;
    orderNumber = null;
    orderTotal = null;

    const address = {
      firstName: form.firstName,
      lastName: form.lastName,
      address1: form.address1,
      address2: form.address2,
      city: form.city,
      state: "",
      postcode: form.postcode,
      country: form.country,
      email: form.email,
      phone: form.phone,
    };

    const input: CheckoutInput = {
      billing: address,
      shipping: address,
      shipToDifferentAddress: false,
      paymentMethod: selectedPaymentMethod,
      shippingMethod: selectedShippingMethod ? [selectedShippingMethod] : [],
      customerNote: form.note,
      isPaid: false,
    };

    const response = await client
      .mutation<CheckoutResponse, { input: CheckoutInput }>(CHECKOUT, { input })
      .toPromise();

    submitting = false;

    if (response.error) {
      error = response.error.message;
      return;
    }

    const order = response.data?.checkout?.order;
    orderNumber = order?.orderNumber || order?.id || "vytvořena";
    orderTotal = formatPrice(order?.total) || checkoutTotal;
    await cart.fetchCart();
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
   * Get the variation attribute label for display.
   * Resolves term slugs to their human-readable names.
   */
  function getVariationLabel(item: CartItem): string | null {
    const variationNode = item.variation?.node;
    const productNode = item.product?.node;
    const productAttributes = productNode?.attributes?.nodes || [];

    if (!variationNode || !productNode || productAttributes.length === 0) return null;

    const dbVariation = productNode.variations?.nodes?.find(
      (v: any) => v.databaseId === variationNode.databaseId
    );

    const targetAttrs = item.variation?.attributes || dbVariation?.attributes?.nodes || variationNode.attributes?.nodes || [];
    if (targetAttrs.length === 0) return null;

    const labelMap = buildAttributeLabelMap(item);

    return targetAttrs
      .map(a => {
        if (!a.value || a.value.trim() === '') return null;

        const attrInfo = labelMap[a.name];
        const label = attrInfo?.label || a.label || a.name;

        const globalAttr = productAttributes.find(
          pa => pa.name.toLowerCase() === a.name.toLowerCase()
        );
        const dbTerm = globalAttr?.terms?.nodes?.find(
          (t: any) => t.slug.toLowerCase() === a.value.toLowerCase()
        );
        const termName = dbTerm?.name || a.value;

        return `${label}: ${termName}`;
      })
      .filter(Boolean)
      .join(', ');
  }

  onMount(() => {
    cart.fetchCart();
    loadCheckoutData();
  });
</script>

<section class="checkout-page">
  <div class="container">
    <header class="page-header">
      <p class="eyebrow">Pokladna</p>
      <h1>Dokončení objednávky</h1>
    </header>

    {#if orderNumber}
      <div class="success-panel">
        <p class="eyebrow">Objednávka přijata</p>
        <h2>Děkujeme, objednávka {orderNumber} byla vytvořena.</h2>
        <p>Celkem: <strong>{orderTotal}</strong></p>
        <a href="/#katalog" class="btn btn-primary">Zpět do obchodu</a>
      </div>
    {:else if cart.loading && cart.items.length === 0}
      <div class="loading-state">
        <div class="spinner"></div>
        <span>Načítám košík...</span>
      </div>
    {:else if cart.items.length === 0}
      <div class="empty-state">
        <h2>Košík je prázdný</h2>
        <p>Před dokončením objednávky přidejte do košíku alespoň jeden produkt.</p>
        <a href="/#katalog" class="btn btn-primary">Zpět do katalogu</a>
      </div>
    {:else}
      <form class="checkout-layout" onsubmit={(event) => { event.preventDefault(); submitOrder(); }}>
        <div class="checkout-main">
          {#if error}
            <div class="notice error" role="alert">{error}</div>
          {/if}

          <section class="checkout-section">
            <h2>Kontaktní informace</h2>
            <label class="field">
              <span>E-mailová adresa</span>
              <input bind:value={form.email} type="email" autocomplete="email" required />
            </label>
          </section>

          <section class="checkout-section">
            <h2>Doručovací adresa</h2>
            <div class="field-grid">
              <label class="field">
                <span>Křestní jméno</span>
                <input bind:value={form.firstName} autocomplete="given-name" required />
              </label>
              <label class="field">
                <span>Příjmení</span>
                <input bind:value={form.lastName} autocomplete="family-name" required />
              </label>
            </div>
            <label class="field">
              <span>Adresa</span>
              <input bind:value={form.address1} autocomplete="address-line1" required />
            </label>
            <label class="field">
              <span>Byt č.</span>
              <input bind:value={form.address2} autocomplete="address-line2" />
            </label>
            <div class="field-grid">
              <label class="field">
                <span>Město</span>
                <input bind:value={form.city} autocomplete="address-level2" required />
              </label>
              <label class="field">
                <span>PSČ</span>
                <input bind:value={form.postcode} autocomplete="postal-code" required />
              </label>
            </div>
            <div class="field-grid">
              <label class="field">
                <span>Země/Oblast</span>
                <select bind:value={form.country} required>
                  <option value="CZ">Česká republika</option>
                </select>
              </label>
              <label class="field">
                <span>Telefon</span>
                <input bind:value={form.phone} type="tel" autocomplete="tel" />
              </label>
            </div>
          </section>

          <section class="checkout-section">
            <h2>Možnosti dopravy</h2>
            {#if loadingOptions}
              <p class="muted">Načítám dopravu...</p>
            {:else if shippingRates.length === 0}
              <p class="muted">Doprava bude potvrzena po odeslání objednávky.</p>
            {:else}
              <div class="option-list">
                {#each shippingRates as rate}
                  <label class="option">
                    <input
                      type="radio"
                      name="shipping-method"
                      value={rate.id}
                      checked={selectedShippingMethod === rate.id}
                      onchange={() => selectShippingMethod(rate.id)}
                    />
                    <span>
                      <strong>{rate.label}</strong>
                      <small>{formatPrice(rate.cost) || "Zdarma"}</small>
                    </span>
                  </label>
                {/each}
              </div>
            {/if}
          </section>

          <section class="checkout-section">
            <h2>Možnosti platby</h2>
            {#if loadingOptions}
              <p class="muted">Načítám platby...</p>
            {:else if paymentGateways.length === 0}
              <p class="muted">Momentálně není dostupná žádná platební metoda.</p>
            {:else}
              <div class="option-list">
                {#each paymentGateways as gateway}
                  <label class="option">
                    <input
                      type="radio"
                      name="payment-method"
                      value={gateway.id}
                      bind:group={selectedPaymentMethod}
                    />
                    <span>
                      <strong>{gateway.title}</strong>
                      {#if gateway.description}
                        <small>{cleanHtml(gateway.description)}</small>
                      {/if}
                    </span>
                  </label>
                {/each}
              </div>
            {/if}
          </section>

          <section class="checkout-section">
            <h2>Poznámka k objednávce</h2>
            <label class="field">
              <span>Poznámka</span>
              <textarea bind:value={form.note} rows="4"></textarea>
            </label>
          </section>

          <section class="checkout-section">
            <label class="terms-option">
              <input type="checkbox" bind:checked={acceptedTerms} required />
              <span>Souhlasím s obchodními podmínkami a zásadami ochrany osobních údajů.</span>
            </label>
          </section>
        </div>

        <aside class="summary">
          <h2>Souhrn objednávky</h2>
          <div class="summary-items">
            {#each cart.items as item}
              <div class="summary-item">
                <div class="summary-item-info">
                  <span>{item.product.node.name} × {item.quantity}</span>
                  {#if item.variation?.node?.attributes?.nodes?.length}
                    <span class="item-variation-label">{getVariationLabel(item)}</span>
                  {/if}
                </div>
                <strong>{formatPrice(item.total) || formatPrice(item.product.node.price)}</strong>
              </div>
            {/each}
          </div>
          <div class="summary-row">
            <span>Mezisoučet</span>
            <strong>{cart.subtotal}</strong>
          </div>
          <div class="summary-row">
            <span>Doprava</span>
            <strong>{shippingTotal}</strong>
          </div>
          <div class="summary-row total">
            <span>Celkem</span>
            <strong>{checkoutTotal}</strong>
          </div>
          <button class="btn btn-primary btn-full" type="submit" disabled={!canSubmit}>
            {submitting ? "Odesílám..." : "Odeslat objednávku"}
          </button>
          <a href="/cart" class="btn btn-secondary btn-full">Zpět do košíku</a>
        </aside>
      </form>
    {/if}
  </div>
</section>

<style>
  .checkout-page {
    padding: var(--spacing-xl) 0 var(--spacing-xxxl);
  }

  .page-header {
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

  .checkout-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--spacing-lg);
    align-items: start;
  }

  @media (min-width: 960px) {
    .checkout-layout {
      grid-template-columns: minmax(0, 1fr) 36rem;
    }
  }

  .checkout-main {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .checkout-section,
  .summary,
  .empty-state,
  .loading-state,
  .success-panel,
  .notice {
    background-color: var(--color-surface);
    border: 0.1rem solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .checkout-section,
  .summary,
  .success-panel,
  .notice {
    padding: var(--spacing-lg);
  }

  .checkout-section h2,
  .summary h2 {
    margin-bottom: var(--spacing-md);
    font-size: 2.2rem;
  }

  .field-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--spacing-md);
  }

  @media (min-width: 700px) {
    .field-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xxs);
    margin-bottom: var(--spacing-md);
  }

  .field:last-child {
    margin-bottom: 0;
  }

  .field span {
    color: var(--color-text-muted);
    font-size: 1.4rem;
    font-weight: 700;
  }

  input,
  select,
  textarea {
    width: 100%;
    min-height: 4.6rem;
    padding: 0 var(--spacing-md);
    border: 0.1rem solid var(--color-border);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface);
  }

  textarea {
    padding-top: var(--spacing-sm);
    resize: vertical;
  }

  input:focus,
  select:focus,
  textarea:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 0.3rem var(--color-primary-light);
  }

  .option-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .option {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    border: 0.1rem solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .terms-option {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--spacing-sm);
    align-items: start;
    color: var(--color-text-muted);
    font-size: 1.5rem;
    font-weight: 600;
  }

  .terms-option input {
    width: 1.8rem;
    min-height: 1.8rem;
    margin-top: 0.2rem;
  }

  .option:has(input:checked) {
    border-color: var(--color-primary);
    background-color: var(--color-primary-light);
  }

  .option input {
    width: 1.8rem;
    min-height: 1.8rem;
    margin-top: 0.2rem;
  }

  .option strong,
  .option small {
    display: block;
  }

  .option small,
  .muted {
    color: var(--color-text-muted);
    font-size: 1.4rem;
    line-height: 1.5;
  }

  .summary {
    position: sticky;
    top: 9rem;
  }

  .summary-items {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
    padding-bottom: var(--spacing-md);
    border-bottom: 0.1rem solid var(--color-border);
  }

  .summary-item,
  .summary-row {
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-md);
  }

  .summary-item {
    font-size: 1.4rem;
    align-items: center;
  }

  .summary-item-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .item-variation-label {
    display: block;
    font-size: 1.2rem;
    color: var(--color-text-muted);
    margin-top: 0.2rem;
    line-height: 1.4;
  }

  .summary-row {
    padding: var(--spacing-sm) 0;
    color: var(--color-text-muted);
    border-bottom: 0.1rem solid var(--color-border);
  }

  .summary-row strong {
    color: var(--color-text);
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

  .btn-primary:disabled {
    cursor: not-allowed;
    opacity: 0.55;
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

  .empty-state,
  .loading-state {
    min-height: 34rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--spacing-xl);
  }

  .success-panel {
    max-width: 72rem;
  }

  .notice.error {
    color: var(--color-error);
    font-weight: 700;
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

  @media (max-width: 700px) {
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
