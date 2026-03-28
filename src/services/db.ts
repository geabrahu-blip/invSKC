import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import { db } from './firebase';
import { Purchase, Product, InventoryItem, User } from '../types';

// Helper to get a random ID when not provided
const generateId = () => doc(collection(db, 'dummy')).id;

// Purchases
export const getPurchases = async (): Promise<Purchase[]> => {
  const q = query(collection(db, 'purchases'));
  const querySnapshot = await getDocs(q);
  const purchases = querySnapshot.docs.map(doc => doc.data() as Purchase);
  return purchases.sort((a, b) => b.createdAt - a.createdAt);
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

export const deletePurchase = async (id: string): Promise<void> => {
  // 1. Get all products associated with this purchase
  const products = await getProductsByPurchaseId(id);
  const allInventory = await getInventoryItems();

  // 2. Reverse inventory operations
  for (const product of products) {
    const invItem = allInventory.find(item =>
      item.storeId === 'bodega' &&
      item.name.toLowerCase().trim() === product.name.toLowerCase().trim() &&
      (item.brand || '') === (product.brand || '') &&
      (item.category || '') === (product.category || '')
    );

    if (invItem) {
      const newUnits = Math.max(0, invItem.units - product.units);
      if (newUnits === 0) {
        // Option 1: Delete the inventory item if units hit 0
        await deleteDoc(doc(db, 'inventory', invItem.id));
      } else {
        // Option 2: Update with reduced units
        await setDoc(doc(db, 'inventory', invItem.id), {
          ...invItem,
          units: newUnits
        });
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
  const newProduct: Product = { ...product, id };
  await setDoc(doc(db, 'products', id), newProduct);

  // Look for existing product in Bodega to merge stock instead of duplicate
  const allInventory = await getInventoryItems();
  const existingInv = allInventory.find(item =>
    item.storeId === 'bodega' &&
    item.name.toLowerCase().trim() === newProduct.name.toLowerCase().trim() &&
    (item.brand || '') === (newProduct.brand || '') &&
    (item.category || '') === (newProduct.category || '')
  );

  if (existingInv) {
    // Update existing inventory item (add units, update prices to latest)
    await setDoc(doc(db, 'inventory', existingInv.id), {
      ...existingInv,
      units: existingInv.units + newProduct.units,
      priceBs: newProduct.priceBs, // Update to latest cost
      wholesalePrice: newProduct.wholesalePrice,
      sellingPrice: newProduct.sellingPrice,
      gender: newProduct.gender || existingInv.gender,
      expirationDate: newProduct.expirationDate || existingInv.expirationDate,
      image: newProduct.image || existingInv.image // update image if new one provided
    });
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
      expirationDate: newProduct.expirationDate,
      image: newProduct.image,
      priceBs: newProduct.priceBs,
      wholesalePrice: newProduct.wholesalePrice,
      sellingPrice: newProduct.sellingPrice
    };
    await setDoc(doc(db, 'inventory', invId), invItem);
  }

  return newProduct;
};

export const updateProduct = async (updatedProduct: Product): Promise<Product> => {
  // First, get the old product to calculate unit differences
  const docRef = doc(db, 'products', updatedProduct.id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error("Producto original no encontrado");
  const oldProduct = docSnap.data() as Product;

  // Save updated product record
  await setDoc(doc(db, 'products', updatedProduct.id), updatedProduct);

  // We must update the inventory item in Bodega
  const allInventory = await getInventoryItems();
  const existingInv = allInventory.find(item =>
    item.storeId === 'bodega' &&
    item.name.toLowerCase().trim() === oldProduct.name.toLowerCase().trim() &&
    (item.brand || '') === (oldProduct.brand || '') &&
    (item.category || '') === (oldProduct.category || '')
  );

  if (existingInv) {
    const unitDifference = updatedProduct.units - oldProduct.units;
    // We update the inventory item replacing text fields and adjusting the units based on difference
    await setDoc(doc(db, 'inventory', existingInv.id), {
      ...existingInv,
      name: updatedProduct.name,
      brand: updatedProduct.brand,
      category: updatedProduct.category,
      gender: updatedProduct.gender,
      expirationDate: updatedProduct.expirationDate,
      image: updatedProduct.image || existingInv.image,
      priceBs: updatedProduct.priceBs,
      wholesalePrice: updatedProduct.wholesalePrice,
      sellingPrice: updatedProduct.sellingPrice,
      units: Math.max(0, existingInv.units + unitDifference), // Avoid negative inventory
    });
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

export const updateInventoryItem = async (item: InventoryItem): Promise<InventoryItem> => {
  await setDoc(doc(db, 'inventory', item.id), item);
  return item;
};

export const deleteInventoryItem = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'inventory', id));
};

export const syncOldProductsToInventory = async (): Promise<void> => {
  // Obsolete function since everything is new in Firebase, but keeping signature for safety.
  console.log("Sync not needed for Firebase initialized projects.");
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
