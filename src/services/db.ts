import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  limit,
  startAfter,
  orderBy,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { Purchase, Product, InventoryItem, User, StockAdjustment, PublicCatalogItem } from '../types';

// Helper to get a random ID when not provided
const generateId = () => doc(collection(db, 'dummy')).id;

// Sync to Public Catalog
const syncToPublicCatalog = async (item: InventoryItem) => {
  // We only sync items that belong to the main warehouse (bodega)
  if (item.storeId !== 'bodega') return;

  const catalogRef = doc(db, 'public_catalog', item.id);


  const publicItem: PublicCatalogItem = {
    id: item.id,
    name: item.name,
    brand: item.brand || '',
    category: item.category || '',
    presentation: item.presentation || '',
    sku: item.sku || '',
    image: item.image || '',
    inStock: item.units > 0,
    units: item.units || 0,
    wholesalePrice: item.wholesalePrice || 0,
    sellingPrice: item.sellingPrice || 0
  };

  await setDoc(catalogRef, publicItem);
};

const removeFromPublicCatalog = async (id: string) => {
  await deleteDoc(doc(db, 'public_catalog', id));
};

// Purchases
export const getPurchases = async (): Promise<Purchase[]> => {
  const q = query(collection(db, 'purchases'));
  const querySnapshot = await getDocs(q);
  const purchases = querySnapshot.docs.map(doc => doc.data() as Purchase);
  return purchases.sort((a, b) => b.createdAt - a.createdAt);
};

export const getAllProducts = async (): Promise<Product[]> => {
  const q = query(collection(db, 'products'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as Product);
};

export const getPurchaseById = async (id: string): Promise<Purchase | null> => {
  const docRef = doc(db, 'purchases', id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? (docSnap.data() as Purchase) : null;
};

export const addPurchase = async (purchase: Omit<Purchase, 'id' | 'createdAt'>): Promise<Purchase> => {
  const id = generateId();
  const newPurchase: Purchase = {
    ...purchase,
    id,
    createdAt: Date.now(),
  };
  await setDoc(doc(db, 'purchases', id), newPurchase);
  return newPurchase;
};

// Helper to upload base64 images to Firebase Storage
const uploadImageToStorage = async (base64String: string, pathRef: string): Promise<string> => {
  // Only upload if it's a data url, otherwise assume it's already a public URL or empty
  if (!base64String || !base64String.startsWith('data:image')) {
    return base64String;
  }
  const imageRef = ref(storage, pathRef);
  await uploadString(imageRef, base64String, 'data_url');
  return await getDownloadURL(imageRef);
};

// Helper para buscar directamente en Firestore sin bajar toda la colección
const findExistingInventoryItem = async (product: { sku?: string, name: string, brand?: string, category?: string }): Promise<InventoryItem | null> => {
  // Primero intentamos buscar por SKU, ya que es un identificador único exacto
  if (product.sku) {
    const qSku = query(
      collection(db, 'inventory'),
      where('storeId', '==', 'bodega'),
      where('sku', '==', product.sku),
      limit(1)
    );
    const snapSku = await getDocs(qSku);
    if (!snapSku.empty) {
      return snapSku.docs[0].data() as InventoryItem;
    }
  }

  // Si no hay SKU o no se encontró, buscamos exactamente por Nombre, Marca y Categoría.
  const qDetails = query(
    collection(db, 'inventory'),
    where('storeId', '==', 'bodega'),
    where('name', '==', product.name.trim()),
    where('brand', '==', product.brand || ''),
    where('category', '==', product.category || ''),
    limit(1)
  );

  const snapDetails = await getDocs(qDetails);
  if (!snapDetails.empty) {
    return snapDetails.docs[0].data() as InventoryItem;
  }

  return null;
};

export const deletePurchase = async (id: string): Promise<void> => {
  // 1. Get all products associated with this purchase
  const products = await getProductsByPurchaseId(id);

  // 2. Reverse inventory operations
  for (const product of products) {
    const invItem = await findExistingInventoryItem(product);

    if (invItem) {
      const newUnits = Math.max(0, invItem.units - product.units);
      if (newUnits === 0) {
        // Option 1: Delete the inventory item if units hit 0
        await deleteInventoryItem(invItem.id);
      } else {
        // Option 2: Update with reduced units
        const updatedItem = {
          ...invItem,
          units: newUnits
        };
        await updateInventoryItem(updatedItem);
      }
    }

    // 3. Delete the product itself
    await deleteDoc(doc(db, 'products', product.id));
  }

  // 4. Finally, delete the purchase
  await deleteDoc(doc(db, 'purchases', id));
};

// Products
export const getProductsByPurchaseId = async (purchaseId: string): Promise<Product[]> => {
  const q = query(collection(db, 'products'), where('purchaseId', '==', purchaseId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as Product);
};

export const addProduct = async (product: Omit<Product, 'id'>): Promise<Product> => {
  const id = generateId();

  let imageUrl = product.image;
  if (imageUrl) {
    imageUrl = await uploadImageToStorage(imageUrl, `products/${id}_${Date.now()}.webp`);
  }

  const newProduct: Product = { ...product, id, image: imageUrl };
  await setDoc(doc(db, 'products', id), newProduct);

  // Look for existing product in Bodega to merge stock instead of duplicate
  const existingInv = await findExistingInventoryItem(newProduct);

  if (existingInv) {
    // Update existing inventory item (add units, update prices to latest)
    const updatedInv = {
      ...existingInv,
      units: existingInv.units + newProduct.units,
      priceBs: newProduct.priceBs, // Update to latest cost
      wholesalePrice: newProduct.wholesalePrice,
      sellingPrice: newProduct.sellingPrice,
      gender: newProduct.gender || existingInv.gender,
      presentation: newProduct.presentation || existingInv.presentation,
      expirationDate: newProduct.expirationDate || existingInv.expirationDate,
      sku: newProduct.sku || existingInv.sku,
      image: newProduct.image || existingInv.image // update image if new one provided
    };
    await setDoc(doc(db, 'inventory', existingInv.id), updatedInv);
    await syncToPublicCatalog(updatedInv);
  } else {
    // Create an initial inventory record in Bodega
    const invId = generateId();
    const invItem: InventoryItem = {
      id: invId,
      productId: id, // acts as reference to the original product that created it
      storeId: 'bodega',
      units: newProduct.units,
      name: newProduct.name,
      brand: newProduct.brand,
      category: newProduct.category,
      gender: newProduct.gender,
      presentation: newProduct.presentation,
      expirationDate: newProduct.expirationDate,
      sku: newProduct.sku,
      image: newProduct.image,
      priceBs: newProduct.priceBs,
      wholesalePrice: newProduct.wholesalePrice,
      sellingPrice: newProduct.sellingPrice
    };
    await setDoc(doc(db, 'inventory', invId), invItem);
    await syncToPublicCatalog(invItem);
  }

  return newProduct;
};

export const updateProduct = async (updatedProduct: Product): Promise<Product> => {
  // First, get the old product to calculate unit differences
  const docRef = doc(db, 'products', updatedProduct.id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error("Producto original no encontrado");
  const oldProduct = docSnap.data() as Product;

  let imageUrl = updatedProduct.image;
  if (imageUrl && imageUrl.startsWith('data:image')) {
    imageUrl = await uploadImageToStorage(imageUrl, `products/${updatedProduct.id}_${Date.now()}.webp`);
  }
  const productToSave = { ...updatedProduct, image: imageUrl };

  // Save updated product record
  await setDoc(doc(db, 'products', productToSave.id), productToSave);

  // We must update the inventory item in Bodega
  const existingInv = await findExistingInventoryItem(oldProduct);

  if (existingInv) {
    const unitDifference = updatedProduct.units - oldProduct.units;
    // We update the inventory item replacing text fields and adjusting the units based on difference
    const updatedInv = {
      ...existingInv,
      name: updatedProduct.name,
      brand: updatedProduct.brand,
      category: updatedProduct.category,
      gender: updatedProduct.gender,
      presentation: updatedProduct.presentation,
      expirationDate: updatedProduct.expirationDate,
      sku: updatedProduct.sku || existingInv.sku,
      image: updatedProduct.image || existingInv.image,
      priceBs: updatedProduct.priceBs,
      wholesalePrice: updatedProduct.wholesalePrice,
      sellingPrice: updatedProduct.sellingPrice,
      units: Math.max(0, existingInv.units + unitDifference), // Avoid negative inventory
    };
    await setDoc(doc(db, 'inventory', existingInv.id), updatedInv);
    await syncToPublicCatalog(updatedInv);
  }

  return updatedProduct;
};

export const deleteProduct = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'products', id));
};

// Inventory Items
export const getInventoryItems = async (): Promise<InventoryItem[]> => {
  const q = query(collection(db, 'inventory'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as InventoryItem);
};

export const getPaginatedInventoryItems = async (
  pageSize: number = 30,
  lastVisibleDoc: QueryDocumentSnapshot<DocumentData, DocumentData> | null = null
): Promise<{ items: InventoryItem[], lastDoc: QueryDocumentSnapshot<DocumentData, DocumentData> | null }> => {
  let q = query(
    collection(db, 'inventory'),
    orderBy('name', 'asc'),
    limit(pageSize)
  );

  if (lastVisibleDoc) {
    q = query(
      collection(db, 'inventory'),
      orderBy('name', 'asc'),
      startAfter(lastVisibleDoc),
      limit(pageSize)
    );
  }

  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(doc => doc.data() as InventoryItem);

  const lastDoc = querySnapshot.docs.length > 0
    ? querySnapshot.docs[querySnapshot.docs.length - 1]
    : null;

  return { items, lastDoc };
};

export const updateInventoryItem = async (item: InventoryItem): Promise<InventoryItem> => {
  let imageUrl = item.image;
  if (imageUrl && imageUrl.startsWith('data:image')) {
    imageUrl = await uploadImageToStorage(imageUrl, `inventory/${item.id}_${Date.now()}.webp`);
  }
  const itemToSave = { ...item, image: imageUrl };

  await setDoc(doc(db, 'inventory', itemToSave.id), itemToSave);
  await syncToPublicCatalog(itemToSave);
  return itemToSave;
};

export const deleteInventoryItem = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'inventory', id));
  await removeFromPublicCatalog(id);
};

// Stock Adjustments
export const addStockAdjustment = async (adjustment: Omit<StockAdjustment, 'id' | 'createdAt'>): Promise<StockAdjustment> => {
  const id = generateId();
  const newAdjustment: StockAdjustment = {
    ...adjustment,
    id,
    createdAt: Date.now(),
  };
  await setDoc(doc(db, 'adjustments', id), newAdjustment);
  return newAdjustment;
};

export const getStockAdjustments = async (): Promise<StockAdjustment[]> => {
  const q = query(collection(db, 'adjustments'));
  const querySnapshot = await getDocs(q);
  const adjustments = querySnapshot.docs.map(doc => doc.data() as StockAdjustment);
  return adjustments.sort((a, b) => b.createdAt - a.createdAt);
};

export const syncOldProductsToInventory = async (): Promise<void> => {
  // Migrates all existing items from the 'inventory' collection to 'public_catalog'
  const allInventory = await getInventoryItems();
  const syncPromises = allInventory.map(item => syncToPublicCatalog(item));
  await Promise.all(syncPromises);
  console.log("Inventario sincronizado con catálogo público.");
};

// Users
export const getUsers = async (): Promise<User[]> => {
  const q = query(collection(db, 'users'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as User);
};

// We don't expose addUser directly for Firebase Auth flow here,
// usually you create the user in Auth first, then save to DB.
// But we keep this for backwards compatibility where the UI uses it (needs to be refactored eventually if creating users from UI)
export const addUser = async (user: Omit<User, 'id'>, uid?: string): Promise<User> => {
  const id = uid || generateId();
  const newUser: User = { ...user, id };
  await setDoc(doc(db, 'users', id), newUser);
  return newUser;
};

export const updateUser = async (user: User): Promise<User> => {
  await setDoc(doc(db, 'users', user.id), user);
  return user;
};

export const deleteUser = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'users', id));
};

export const getUserByUsername = async (username: string): Promise<User | null> => {
  const q = query(collection(db, 'users'), where('username', '==', username));
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  return querySnapshot.docs[0].data() as User;
};

// Database Reset
export const clearAllData = async (): Promise<void> => {
  // Warning: This clears almost all collections, but should ONLY be used in development or testing.
  const collectionsToClear = ['purchases', 'products', 'inventory'];

  for (const collectionName of collectionsToClear) {
    const q = query(collection(db, collectionName));
    const querySnapshot = await getDocs(q);
    const deletePromises = querySnapshot.docs.map(docSnapshot => deleteDoc(doc(db, collectionName, docSnapshot.id)));
    await Promise.all(deletePromises);
  }
};
