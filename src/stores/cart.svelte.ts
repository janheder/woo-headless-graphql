import { client } from '../lib/wp-client';
import { GET_CART, ADD_TO_CART, UPDATE_CART_QUANTITY } from '../lib/queries';
import { formatPrice } from '../lib/utils';
import type { 
  CartData, 
  CartItem, 
  GetCartResponse, 
  AddToCartResponse, 
  UpdateCartQuantityResponse 
} from '../types/woo.types';

class CartStore {
  // Svelte 5 runes for reactive state
  items = $state<CartItem[]>([]);
  subtotal = $state<string>('0 Kč');
  total = $state<string>('0 Kč');
  count = $state<number>(0);
  isOpen = $state<boolean>(false);
  loading = $state<boolean>(false);
  error = $state<string | null>(null);

  private isInitialized = false;

  constructor() {
    // Only run initialization on client side
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    await this.fetchCart();
  }

  // Update internal store values with returned GraphQL cart block
  private updateState(cartData: CartData | null | undefined) {
    if (!cartData) {
      this.items = [];
      this.subtotal = '0 Kč';
      this.total = '0 Kč';
      this.count = 0;
      return;
    }
    this.items = cartData.contents?.nodes || [];
    this.subtotal = formatPrice(cartData.subtotal) || '0 Kč';
    this.total = formatPrice(cartData.total) || '0 Kč';
    this.count = this.items.reduce((count, item) => count + item.quantity, 0);
  }

  // Toggle drawer visibility state
  toggleDrawer(force?: boolean) {
    this.isOpen = force !== undefined ? force : !this.isOpen;
  }

  // Fetch the current WooCommerce cart state
  async fetchCart() {
    this.loading = true;
    this.error = null;
    try {
      const response = await client.query<GetCartResponse, {}>(GET_CART, {}).toPromise();
      if (response.error) {
        this.error = response.error.message;
        console.error('[Cart Store] Fetch cart error:', response.error);
      } else {
        this.updateState(response.data?.cart);
      }
    } catch (e: any) {
      this.error = e?.message || 'Chyba při stahování košíku';
      console.error('[Cart Store] Exception fetching cart:', e);
    } finally {
      this.loading = false;
    }
  }

  // Add product by database ID to WooCommerce cart
  async addToCart(productId: number | string, quantity: number = 1) {
    this.loading = true;
    this.error = null;
    // Open drawer to give instant visual feedback
    this.isOpen = true;
    
    // Parse databaseId
    const cleanId = typeof productId === 'string' ? parseInt(productId, 10) : productId;
    if (isNaN(cleanId)) {
      this.error = 'Neplatné ID produktu';
      this.loading = false;
      return;
    }

    try {
      const response = await client.mutation<AddToCartResponse, { productId: number; quantity: number }>(
        ADD_TO_CART,
        { productId: cleanId, quantity }
      ).toPromise();

      if (response.error) {
        this.error = response.error.message;
        console.error('[Cart Store] Add to cart error:', response.error);
      } else {
        this.updateState(response.data?.addToCart?.cart);
      }
    } catch (e: any) {
      this.error = e?.message || 'Chyba při přidávání do košíku';
      console.error('[Cart Store] Exception adding to cart:', e);
    } finally {
      this.loading = false;
    }
  }

  // Update item quantity (setting to 0 deletes it)
  async updateQuantity(key: string, quantity: number) {
    this.loading = true;
    this.error = null;
    try {
      const response = await client.mutation<UpdateCartQuantityResponse, { key: string; quantity: number }>(
        UPDATE_CART_QUANTITY,
        { key, quantity }
      ).toPromise();

      if (response.error) {
        this.error = response.error.message;
        console.error('[Cart Store] Update quantity error:', response.error);
      } else {
        this.updateState(response.data?.updateItemQuantities?.cart);
      }
    } catch (e: any) {
      this.error = e?.message || 'Chyba při úpravě množství';
      console.error('[Cart Store] Exception updating quantity:', e);
    } finally {
      this.loading = false;
    }
  }
}

// Single instance for global reactive state
export const cart = new CartStore();
