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
  DocumentData,
  updateDoc
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { Purchase, Product, InventoryItem, User, StockAdjustment, PublicCatalogItem, FinancialLot, RestockRequest } from '../types';

// Helper to get a random ID when not provided
const generateId = () => doc(collection(db, 'dummy')).id;

const removeFromPublicCatalog = async (id: string) => {
  await deleteDoc(doc(db, 'public_catalog', id));
};

// Sync to Public Catalog
const syncToPublicCatalog = async (item: InventoryItem) => {
  // We only sync items that belong to the main warehouse (bodega)
  if (item.storeId !== 'bodega') return;

  // Si se ha marcado para no mostrar en el catálogo, lo eliminamos y salimos
  if (item.showInCatalog === false) {
    await removeFromPublicCatalog(item.id);
    return;
  }

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
    sellingPrice: item.sellingPrice || 0,
    comparePrice: Number(item.comparePrice) || 0,
    showInCatalog: true, // Si llegó aquí es porque no es explícitamente false
  };

  await setDoc(catalogRef, publicItem);
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

// Helper para generar palabras clave de búsqueda (prefijos para auto-completado)
const generateSearchKeywords = (product: { name: string, brand?: string, sku?: string, category?: string }): string[] => {
  const keywords = new Set<string>();

  const fieldsToTokenize = [
    product.name,
    product.brand,
    product.sku,
    product.category
  ];

  fieldsToTokenize.forEach(field => {
    if (!field) return;

    // Limpiamos y dividimos en palabras en minúsculas
    const words = field.toLowerCase().trim().split(/[\s\-_]+/);

    words.forEach(word => {
      // Evitar guardar prefijos de palabras muy cortas como conectores
      if (word.length === 0) return;

      keywords.add(word);

      // Generar prefijos letra a letra (ej: c, ce, cer, cera, cerav, cerave)
      let prefix = '';
      for (const char of word) {
        prefix += char;
        keywords.add(prefix);
      }
    });

    // Guardar también la frase completa por si la buscan exacta
    keywords.add(field.toLowerCase().trim());
  });

  return Array.from(keywords);
};

// Helper to remove undefined properties and convert undefined strings to empty strings for Firestore compatibility
const sanitizeForFirestore = <T extends Record<string, unknown>>(obj: T): T => {
  const sanitized = { ...obj };

  // Convert known optional string fields to "" if undefined
  const stringFields = ['sku', 'brand', 'category', 'presentation', 'expirationDate', 'gender'];
  stringFields.forEach(field => {
    if (sanitized[field] === undefined) {
      (sanitized as Record<string, unknown>)[field] = "";
    }
  });

  // Force specific price fields to be strictly numbers if they exist
  const numberFields = ['priceBs', 'wholesalePrice', 'sellingPrice', 'comparePrice', 'units', 'totalPrice', 'minStock'];
  numberFields.forEach(field => {
    if (sanitized[field] !== undefined && sanitized[field] !== null && sanitized[field] !== '') {
      (sanitized as Record<string, unknown>)[field] = Number(sanitized[field]);
      if (isNaN((sanitized as Record<string, number>)[field])) {
        delete sanitized[field]; // Remove if it's completely invalid text
      }
    }
  });

  // Remove completely undefined numeric or complex fields to prevent crash
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined || sanitized[key] === '') {
      if (!stringFields.includes(key)) {
         delete sanitized[key];
      }
    }
  });

  return sanitized;
};

// Helper to upload base64 images to Firebase Storage
const uploadImageToStorage = async (base64String: string, pathRef: string): Promise<string> => {
  // Defensive bypass: If it's already a public URL or empty, short-circuit immediately.
  // This prevents Firebase from firing XHR pre-flights that cause CORS freezes.
  if (!base64String || base64String.startsWith('http://') || base64String.startsWith('https://')) {
    return base64String;
  }

  // Only upload if it's a valid data url
  if (!base64String.startsWith('data:image')) {
    return base64String;
  }

  // Configurar timeout agresivo para evitar congelamientos por reintentos de CORS del SDK
  storage.maxUploadRetryTime = 1000;
  storage.maxOperationRetryTime = 1000;

  try {
    const imageRef = ref(storage, pathRef);
    await uploadString(imageRef, base64String, 'data_url');
    return await getDownloadURL(imageRef);
  } catch (error) {
    // Si la subida falla (CORS, red, etc), capturamos el error rápido y usamos fallback
    console.error("Storage upload aborted (CORS/Timeout). Falling back to Base64:", error);
    return base64String;
  }
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
export const registerStockEntry = async (
  entry: Omit<FinancialLot, 'id' | 'timestamp'>
): Promise<void> => {
  const id = generateId();
  const financialLot: FinancialLot = {
    ...entry,
    id,
    timestamp: Date.now(),
  };
  await setDoc(doc(db, 'stock_entries', id), financialLot);
};

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

  // Generar y adjuntar palabras clave para búsquedas en la BD
  const searchKeywords = generateSearchKeywords(newProduct);
  const productToSave = sanitizeForFirestore({ ...newProduct, searchKeywords });

  await setDoc(doc(db, 'products', id), productToSave);

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
      image: newProduct.image || existingInv.image, // update image if new one provided
      minStock: newProduct.minStock ?? existingInv.minStock // update minStock if provided
    };
    // Asegurarnos de actualizar las searchKeywords también en el inventario
    const invKeywords = generateSearchKeywords(updatedInv);
    const invToSave = sanitizeForFirestore({ ...updatedInv, searchKeywords: invKeywords });

    await setDoc(doc(db, 'inventory', existingInv.id), invToSave);
    await syncToPublicCatalog(invToSave);

    // Registro financiero automático (RESTOCK)
    if (newProduct.units > 0) {
      await registerStockEntry({
        type: 'RESTOCK',
        productId: invToSave.id,
        productName: invToSave.name,
        addedUnits: newProduct.units,
        unitCost: invToSave.priceBs,
        totalInvestment: newProduct.units * invToSave.priceBs,
        date: new Date().toISOString().split('T')[0]
      });
    }

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
      sellingPrice: newProduct.sellingPrice,
      minStock: newProduct.minStock || 0
    };
    const invKeywords = generateSearchKeywords(invItem);
    const invToSave = sanitizeForFirestore({ ...invItem, searchKeywords: invKeywords });

    await setDoc(doc(db, 'inventory', invId), invToSave);
    await syncToPublicCatalog(invToSave);

    // Registro financiero automático (NEW_PRODUCT)
    if (newProduct.units > 0) {
      await registerStockEntry({
        type: 'NEW_PRODUCT',
        productId: invId,
        productName: invToSave.name,
        addedUnits: newProduct.units,
        unitCost: invToSave.priceBs,
        totalInvestment: newProduct.units * invToSave.priceBs,
        date: new Date().toISOString().split('T')[0]
      });
    }
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

  const searchKeywords = generateSearchKeywords(updatedProduct);
  const productToSave = sanitizeForFirestore({ ...updatedProduct, image: imageUrl, searchKeywords });

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
      minStock: updatedProduct.minStock ?? existingInv.minStock // inherit or update minStock
    };

    const invKeywords = generateSearchKeywords(updatedInv);
    const invToSave = sanitizeForFirestore({ ...updatedInv, searchKeywords: invKeywords });

    await setDoc(doc(db, 'inventory', existingInv.id), invToSave);
    await syncToPublicCatalog(invToSave);

    // Registro financiero automático (RESTOCK en Actualización de Compra)
    if (unitDifference > 0) {
      await registerStockEntry({
        type: 'RESTOCK',
        productId: invToSave.id,
        productName: invToSave.name,
        addedUnits: unitDifference,
        unitCost: invToSave.priceBs,
        totalInvestment: unitDifference * invToSave.priceBs,
        date: new Date().toISOString().split('T')[0]
      });
    }
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

// Helper para obtener productos con riesgo de vencimiento (FEFO)
export const getExpiringProducts = async (limitCount: number = 30): Promise<InventoryItem[]> => {
  const q = query(
    collection(db, 'inventory'),
    where('storeId', '==', 'bodega'),
    where('expirationDate', '!=', ''), // Excluir productos sin fecha asignada
    orderBy('expirationDate', 'asc'),  // Ordenar: Los más próximos a vencer primero
    limit(limitCount)
  );

  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(doc => doc.data() as InventoryItem);

  // Filtramos localmente productos cuyo stock ya es 0 para evitar pedir un índice compuesto en Firestore
  return items.filter(item => item.expirationDate && item.units > 0);
};

export const getPaginatedInventoryItems = async (
  pageSize: number = 30,
  lastVisibleDoc: QueryDocumentSnapshot<DocumentData, DocumentData> | null = null,
  searchTerm: string = ''
): Promise<{ items: InventoryItem[], lastDoc: QueryDocumentSnapshot<DocumentData, DocumentData> | null }> => {
  const baseQueryConstraints: import('firebase/firestore').QueryConstraint[] = [];

  if (searchTerm) {
    const cleanTerm = searchTerm.toLowerCase().trim();
    // Cuando usamos array-contains, Firestore no requiere orderBy para funcionar,
    // de hecho, si hay un orderBy en un campo distinto puede pedir índices compuestos.
    // Para simplificar, ordenamos en memoria si hay búsqueda.
    baseQueryConstraints.push(where('searchKeywords', 'array-contains', cleanTerm));
  } else {
    // Si no hay búsqueda, ordenamos alfabéticamente
    baseQueryConstraints.push(orderBy('name', 'asc'));
  }

  let q = query(
    collection(db, 'inventory'),
    ...baseQueryConstraints,
    limit(pageSize)
  );

  if (lastVisibleDoc) {
    q = query(
      collection(db, 'inventory'),
      ...baseQueryConstraints,
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
  // Check old item to calculate unit differences for continuous ledger logging
  const oldDocSnap = await getDoc(doc(db, 'inventory', item.id));

  let imageUrl = item.image;
  if (imageUrl) {
    imageUrl = await uploadImageToStorage(imageUrl, `inventory/${item.id}_${Date.now()}.webp`);
  }

  const searchKeywords = generateSearchKeywords(item);
  const itemToSave = sanitizeForFirestore({ ...item, image: imageUrl, searchKeywords });

  await setDoc(doc(db, 'inventory', itemToSave.id), itemToSave);
  await syncToPublicCatalog(itemToSave);

  if (oldDocSnap.exists()) {
    const oldItem = oldDocSnap.data() as InventoryItem;
    const unitDifference = itemToSave.units - oldItem.units;

    if (unitDifference > 0) {
      await registerStockEntry({
        type: 'RESTOCK',
        productId: itemToSave.id,
        productName: itemToSave.name,
        addedUnits: unitDifference,
        unitCost: itemToSave.priceBs, // Takes the latest cost defined by user
        totalInvestment: unitDifference * itemToSave.priceBs,
        date: new Date().toISOString().split('T')[0]
      });
    }
  }

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

export const getStockEntries = async (): Promise<FinancialLot[]> => {
  const q = query(collection(db, 'stock_entries'), orderBy('timestamp', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as FinancialLot);
};

export const syncOldProductsToInventory = async (): Promise<void> => {
  // Migrates all existing items from the 'inventory' collection to 'public_catalog'
  const allInventory = await getInventoryItems();
  const syncPromises = allInventory.map(item => syncToPublicCatalog(item));
  await Promise.all(syncPromises);
  console.log("Inventario sincronizado con catálogo público.");
};

export const reindexInventorySearchKeywords = async (): Promise<void> => {
  const q = query(collection(db, 'inventory'));
  const snap = await getDocs(q);

  const updatePromises = snap.docs.map(async (docSnap) => {
    const item = docSnap.data() as InventoryItem;
    const keywords = generateSearchKeywords(item);
    return setDoc(doc(db, 'inventory', item.id), { ...item, searchKeywords: keywords }, { merge: true });
  });

  await Promise.all(updatePromises);
  console.log(`Reindexados ${snap.docs.length} productos con éxito.`);
};

// Users
export const getUsers = async (): Promise<User[]> => {
  const q = query(collection(db, 'users'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as User);
};

// Helper para crear usuarios sin cerrar la sesión actual
import { createUserWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { secondaryAuth } from './firebase';

export const addUserViaSecondaryApp = async (user: Omit<User, 'id'>, password: string): Promise<User> => {
  // 1. Create the user in Firebase Auth using the secondary app instance
  const userCredential = await createUserWithEmailAndPassword(secondaryAuth, user.email, password);
  const uid = userCredential.user.uid;

  // 2. Log out the secondary app immediately so it doesn't leave an active token
  await firebaseSignOut(secondaryAuth);

  // 3. Save the custom user document in Firestore
  const newUser: User = { ...user, id: uid };
  await setDoc(doc(db, 'users', uid), newUser);

  return newUser;
};

// We keep this for backwards compatibility
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

// --- Restock Requests ---
export const getRestockRequests = async (): Promise<RestockRequest[]> => {
  const q = query(collection(db, 'restock_requests'), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as RestockRequest);
};

export const addRestockRequest = async (request: Omit<RestockRequest, 'id' | 'createdAt' | 'status'>): Promise<RestockRequest> => {
  const id = generateId();
  const newRequest: RestockRequest = {
    ...request,
    id,
    status: 'PENDING',
    createdAt: Date.now(),
  };
  await setDoc(doc(db, 'restock_requests', id), sanitizeForFirestore(newRequest as unknown as Record<string, unknown>));
  return newRequest;
};

export const updateRestockRequestStatus = async (id: string, status: 'PENDING' | 'COMPLETED'): Promise<void> => {
  await updateDoc(doc(db, 'restock_requests', id), { status });
};

export const deleteRestockRequest = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'restock_requests', id));
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
