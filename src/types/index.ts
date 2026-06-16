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
  comparePrice?: number; // Precio antes (oferta) tachado
  name: string;

  // New optional fields for compatibility
  brand?: string;
  category?: string;
  gender?: string; // e.g. 'Mujer' | 'Varón' | 'Unisex'
  expirationDate?: string; // YYYY-MM-DD
  presentation?: string; // e.g. '236ml', '400g'
  sku?: string; // Barcode or custom SKU for faster matching
  minStock?: number; // Minimum stock threshold for reorder alerts
  showInCatalog?: boolean; // Whether to show in public catalog
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
  expirationDate?: string; // YYYY-MM-DD
  presentation?: string; // e.g. '236ml', '400g'
  sku?: string; // Barcode or custom SKU
  image: string;
  priceBs: number;
  wholesalePrice: number;
  sellingPrice: number;
  comparePrice?: number; // Precio antes (oferta) tachado
  minStock?: number; // Minimum stock threshold for reorder alerts
  showInCatalog?: boolean; // Whether to show in public catalog
}

export interface PublicCatalogItem {
  id: string; // Same as InventoryItem ID
  name: string;
  brand?: string;
  category?: string;
  presentation?: string;
  sku?: string;
  image: string;
  inStock: boolean;
  units: number;
  wholesalePrice: number;
  sellingPrice: number;
  comparePrice?: number; // Precio antes (oferta) tachado
  showInCatalog?: boolean;
}

export interface Purchase {
  id: string;
  name: string;
  date: string;
  createdAt: number;
}

export interface PurchaseWithTotal extends Purchase {
  totalAmount?: number;
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  amount: number; // positive or negative
  mode: 'add' | 'subtract';
  date: string; // user provided or automatic
  reason: string;
  createdAt: number;
}

export interface FinancialLot {
  id: string;
  type: 'NEW_PRODUCT' | 'RESTOCK';
  productId: string;
  productName: string;
  addedUnits: number;
  unitCost: number; // Price of cost (priceBs) at the time of entry
  totalInvestment: number; // addedUnits * unitCost
  date: string; // YYYY-MM-DD for UI filtering
  timestamp: number; // Strict chronological sorting
}
