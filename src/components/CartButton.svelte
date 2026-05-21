<script lang="ts">
  import { cart } from '../stores/cart.svelte';
</script>

<a 
  href="/cart" 
  class="nav-cart-btn" 
  onclick={(e) => {
    e.preventDefault();
    cart.toggleDrawer(true);
  }}
  aria-label={`Nákupní košík, ${cart.count} položek`}
>
  <span class="cart-label">Košík</span>
  {#if cart.count > 0}
    <span class="cart-badge">{cart.count}</span>
  {/if}
</a>

<style>
  .nav-cart-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    text-decoration: none;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-text-muted);
    transition: color var(--transition-fast) ease;
    padding: 0.6rem var(--spacing-sm);
    border-radius: var(--radius-sm);
    background-color: transparent;
  }

  .nav-cart-btn:hover {
    color: var(--color-primary);
    background-color: var(--color-surface-hover);
  }

  .cart-badge {
    background-color: var(--color-primary);
    color: var(--color-surface);
    font-size: 1.1rem;
    font-weight: 700;
    line-height: 1;
    min-width: 2.0rem;
    height: 2.0rem;
    padding: 0 0.5rem;
    border-radius: var(--radius-full);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0.2rem 0.5rem rgba(171, 71, 129, 0.2);
    animation: pop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes pop {
    0% { transform: scale(0.4); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
</style>
