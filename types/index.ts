export type Role = 'admin' | 'user';

export interface User {
  id: string; // Firebase Auth UID
  name: string;
  email: string;
  role: Role;
  storeId?: string; // assigned store for standard user
}

export interface Product {
  id: string;
  purchaseId: string;
  image: string; // base64 or URL
  priceBs: number;
  units: number;
  totalPrice: number; // calculated
  wholesalePrice: number;
  sellingPrice: number;
  name: string;

  // New optional fields for compatibility
  brand?: string;
  category?: string;
  gender?: string; // e.g. 'Mujer' | 'Varón' | 'Unisex'
}

export interface InventoryItem {
  id: string; // unique ID for this inventory entry
  productId: string; // reference to the original product/purchase
  storeId: string; // 'bodega' or specific store ID
  units: number; // current stock in this store

  // Denormalized fields for easy access without joining
  name: string;
  brand?: string;
  category?: string;
  gender?: string;
  image: string;
  priceBs: number;
  wholesalePrice: number;
  sellingPrice: number;
}

export interface Purchase {
  id: string;
  name: string;
  date: string;
  createdAt: number;
}

export interface Store {
  id: string;
  name: string;
  location?: string;
}

export interface Transfer {
  id: string;
  productId: string;
  fromStoreId: string; // 'bodega' or store.id
  toStoreId: string;
  quantity: number;
  date: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  storeId: string;
  clientName: string;
  items: SaleItem[];
  total: number;
  paymentMethod: 'Cash' | 'QR';
  date: string;
}
