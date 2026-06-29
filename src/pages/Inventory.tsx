import { topSkincareBrands, topSkincareCategories } from "../utils/constants";
import { useState, useEffect } from 'react';
import { InventoryItem, Product } from '../types';
import { getPaginatedInventoryItems, syncOldProductsToInventory, deleteInventoryItem, updateInventoryItem, addStockAdjustment, addProduct, reindexInventorySearchKeywords } from '../services/db';
import { Package, Search, Trash2, Edit2, Archive, Layers, PenTool, Image as ImageIcon, AlertTriangle, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ProductForm from '../components/ProductForm';
import { cn } from '../components/Layout';

const Inventory = () => {
  const { isAdmin } = useAuth();
  const { success, error } = useToast();
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const uniqueBrands = Array.from(new Set([
    ...topSkincareBrands,
    ...products.map(p => p.brand).filter(Boolean) as string[]
  ]));
  const uniqueCategories = Array.from(new Set([
    ...topSkincareCategories,
    ...products.map(p => p.category).filter(Boolean) as string[]
  ]));
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);

  // Pagination state
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData, DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Stock adjustment state
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number | ''>('');
  const [adjustMode, setAdjustMode] = useState<'add' | 'subtract'>('subtract');
  const [adjustCost, setAdjustCost] = useState<number | ''>('');
  const [adjustDate, setAdjustDate] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  // Form/Add state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Edit details state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<InventoryItem>>({});
  const [smartPasteText, setSmartPasteText] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  // Debounce search effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadData(true);
    }, 500); // Wait 500ms after user stops typing to trigger search

    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, sortOrder]); // Re-fetch if search term or sort order changes

  const handleSyncCatalog = async () => {
    setIsSyncing(true);
    try {
      await syncOldProductsToInventory();
      success('Catálogo público sincronizado exitosamente.');
    } catch (err) {
      console.error(err);
      error('Hubo un error al sincronizar el catálogo.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReindex = async () => {
    if (!window.confirm("Esto actualizará las palabras clave de todos los productos antiguos. ¿Continuar?")) return;
    setIsReindexing(true);
    try {
      await reindexInventorySearchKeywords();
      success('Buscador reindexado correctamente. Todos los productos ahora son buscables.');
      loadData(true); // Refrescamos la vista
    } catch (err) {
      console.error(err);
      error('Hubo un error al reindexar la base de datos.');
    } finally {
      setIsReindexing(false);
    }
  };

  const loadData = async (reset: boolean = false) => {
    if (reset) {
      setIsSearching(true);
      setLastDoc(null); // Reset cursor on new search
      setProducts([]); // Clear current list
    }

    try {
      const { items, lastDoc: newLastDoc } = await getPaginatedInventoryItems(30, null, searchTerm);

      let finalItems = items;
      // Si hay un término de búsqueda, Firestore no nos dejó ordenar con orderBy('name') sin un índice compuesto.
      // Hacemos un sort en memoria de los resultados devueltos (son máximo 30 o la página actual)
      if (searchTerm) {
         finalItems = items.sort((a,b) => {
             // Aplicamos también la lógica del select manual de sortOrder si lo desean
             if (sortOrder === 'desc') return b.units - a.units;
             return a.units - b.units;
         });
      } else {
         if (sortOrder === 'desc') {
             finalItems = items.sort((a,b) => b.units - a.units);
         }
      }

      setProducts(finalItems);
      setLastDoc(newLastDoc);
      setHasMore(newLastDoc !== null && items.length === 30);
    } catch (error) {
       console.error("Error loading data:", error);
    } finally {
      if (reset) setIsSearching(false);
    }
  };

  const handleAddNewProduct = async (productData: Omit<Product, 'id'>) => {
    try {
      await addProduct(productData);
      setIsAddModalOpen(false);
      success('Producto ingresado correctamente al inventario continuo.');
      loadData(true); // Recargar la tabla reseteando la paginación
    } catch (err) {
      console.error(err);
      error('Error al guardar el nuevo producto.');
    }
  };

  const handleLoadMore = async () => {
    if (!lastDoc || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const { items, lastDoc: newLastDoc } = await getPaginatedInventoryItems(30, lastDoc, searchTerm);

      let finalItems = items;
      if (searchTerm || sortOrder !== 'asc') {
         finalItems = items.sort((a,b) => {
             if (sortOrder === 'desc') return b.units - a.units;
             return a.units - b.units;
         });
      }

      setProducts(prev => [...prev, ...finalItems]);
      setLastDoc(newLastDoc);
      setHasMore(newLastDoc !== null && items.length === 30);
    } catch (err) {
      console.error("Error cargando más productos:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (window.confirm('¡ATENCIÓN! Estás a punto de borrar este registro del Inventario General por completo.\n\nÚnicamente usa esto si añadiste el producto por error. ¿Estás seguro de continuar?')) {
      try {
        await deleteInventoryItem(id);
        loadData();
      } catch (error) {
        console.error('Error deleting item:', error);
        alert('Hubo un error al eliminar el registro.');
      }
    }
  };

  const handleOpenEdit = (product: InventoryItem) => {
    setSelectedProduct(product);
    setEditForm({ ...product });
    setSmartPasteText('');
    setShowDetails(false);
    setIsEditModalOpen(true);
  };

  const handleSmartPaste = (text: string) => {
    setSmartPasteText(text);

    const skinTypeMatch = text.match(/\*?\*?Tipo de piel:\*?\*?\s*(.*?)(?=\*?\*?Beneficios:|\*?\*?Ingredientes clave:|\*?\*?Modo de uso:|$)/is);
    const skinType = skinTypeMatch && skinTypeMatch[1] ? skinTypeMatch[1].trim() : editForm.skinType;

    const benefitsMatch = text.match(/\*?\*?Beneficios:\*?\*?\s*(.*?)(?=\*?\*?Tipo de piel:|\*?\*?Ingredientes clave:|\*?\*?Modo de uso:|$)/is);
    const benefits = benefitsMatch && benefitsMatch[1] ? benefitsMatch[1].trim() : editForm.benefits;

    const ingredientsMatch = text.match(/\*?\*?Ingredientes clave:\*?\*?\s*(.*?)(?=\*?\*?Tipo de piel:|\*?\*?Beneficios:|\*?\*?Modo de uso:|$)/is);
    const keyIngredients = ingredientsMatch && ingredientsMatch[1] ? ingredientsMatch[1].trim() : editForm.keyIngredients;

    const usageMatch = text.match(/\*?\*?Modo de uso:\*?\*?\s*(.*?)(?=\*?\*?Tipo de piel:|\*?\*?Beneficios:|\*?\*?Ingredientes clave:|$)/is);
    const usage = usageMatch && usageMatch[1] ? usageMatch[1].trim() : editForm.usage;

    setEditForm({
      ...editForm,
      skinType: skinType,
      benefits: benefits,
      keyIngredients: keyIngredients,
      usage: usage
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !editForm.name) return;

    try {
      const cleanedForm = {
        ...editForm,
        image: editForm.image ? editForm.image.trim() : '',
        showInCatalog: editForm.showInCatalog !== false
      };

      // Si no es admin, no puede modificar costo, mayor, unidades ni minStock
      if (!isAdmin) {
        cleanedForm.priceBs = selectedProduct.priceBs;
        cleanedForm.wholesalePrice = selectedProduct.wholesalePrice;
        cleanedForm.units = selectedProduct.units;
        cleanedForm.minStock = selectedProduct.minStock;
      }

      await updateInventoryItem(cleanedForm as InventoryItem);
      setIsEditModalOpen(false);
      success('Detalles del producto actualizados correctamente.');
      loadData();
    } catch (e) {
      const err = e as Error;
      console.error('Error saving edits:', err);
      error(`Error: ${err.message || 'No se pudieron guardar los cambios'}`);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/webp', 0.7);
          setEditForm({ ...editForm, image: compressedDataUrl });
        } else {
          setEditForm({ ...editForm, image: reader.result as string });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleOpenAdjustStock = (product: InventoryItem) => {
    setSelectedProduct(product);
    setAdjustAmount('');
    setAdjustMode('subtract');
    setAdjustCost(product.priceBs); // Autocompletado del costo actual
    setAdjustDate(new Date().toISOString().split('T')[0]); // Default to today
    setAdjustReason('');
    setIsAdjustModalOpen(true);
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !adjustAmount) return;

    if (adjustMode === 'subtract' && (!adjustDate || !adjustReason)) {
      error('La fecha y el motivo son requeridos al quitar stock.');
      return;
    }

    if (adjustMode === 'add' && adjustCost === '') {
      error('El costo unitario es requerido al añadir stock.');
      return;
    }

    const amount = Number(adjustAmount);
    if (amount <= 0) {
      error('La cantidad debe ser mayor a 0.');
      return;
    }

    let newUnits = selectedProduct.units;
    if (adjustMode === 'add') {
      newUnits += amount;
    } else {
      newUnits -= amount;
      if (newUnits < 0) {
        error('No puedes quitar más stock del que hay disponible.');
        return;
      }
    }

    try {
      await updateInventoryItem({
        ...selectedProduct,
        units: newUnits,
        // Si estamos añadiendo, el nuevo costo define el costo base actual del producto.
        priceBs: adjustMode === 'add' && adjustCost !== '' ? Number(adjustCost) : selectedProduct.priceBs
      });

      // Record adjustment history
      await addStockAdjustment({
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        amount: amount,
        mode: adjustMode,
        date: adjustMode === 'subtract' ? adjustDate : new Date().toISOString().split('T')[0],
        reason: adjustMode === 'subtract' ? adjustReason : 'Aumento manual de stock'
      });

      setIsAdjustModalOpen(false);
      success('Stock actualizado con éxito.');
      loadData();
    } catch (err) {
      console.error('Error al ajustar el stock:', err);
      error('Hubo un error al actualizar el stock.');
    }
  };

  // Eliminamos filteredProducts ya que todo lo maneja el servidor ahora
  // Usamos el arreglo de productos directamente.
  const totalProducts = products.length; // Este será el total de la página cargada
  const totalUnits = products.reduce((sum, item) => sum + item.units, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <Package className="w-6 h-6 md:w-8 md:h-8 text-indigo-600 shrink-0" />
            Inventario General
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona el stock global y las existencias de todos los productos de SKC.
          </p>
        </div>

        {/* Stats Cards & Actions */}
        <div className="flex flex-col md:flex-row gap-4 items-center w-full sm:w-auto">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {isAdmin && (
              <>
                <button
                  onClick={handleSyncCatalog}
                  disabled={isSyncing}
                  className="w-full sm:w-auto px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isSyncing ? 'Sincronizando...' : 'Sincronizar Catálogo'}
                </button>

                <button
                  onClick={handleReindex}
                  disabled={isReindexing}
                  className="w-full sm:w-auto px-4 py-2 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isReindexing ? 'Reindexando...' : 'Reindexar Buscador'}
                </button>
              </>
            )}

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="h-5 w-5" /> Agregar Producto Nuevo
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between sm:justify-start gap-4 flex-1 sm:min-w-[160px]">
              <div className="flex items-center gap-4">
                <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Productos Distintos</p>
                  <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between sm:justify-start gap-4 flex-1 sm:min-w-[160px]">
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600">
                    <Archive className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total de Unidades</p>
                    <p className="text-2xl font-bold text-gray-900">{totalUnits}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar & Filters */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-3 w-full">
        <div className="relative w-full flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, marca o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-11 pr-4 py-3 border-0 bg-transparent text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm sm:leading-6"
          />
        </div>
        <div className="flex items-center w-full md:w-auto min-w-[200px] border-t md:border-t-0 md:border-l border-gray-200 mt-2 md:mt-0 pt-2 md:pt-0">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
            className="block w-full pl-3 pr-10 py-3 text-sm text-gray-700 bg-transparent border-0 focus:ring-0"
          >
            <option value="desc">Mayor a menor stock</option>
            <option value="asc">Menor a mayor stock</option>
          </select>
        </div>
      </div>

      {/* Mobile Cards View */}
      <div className="block md:hidden space-y-4">
        {products.map((product) => {
          const isCritical = product.minStock !== undefined && product.units <= product.minStock;
          return (
            <div key={product.id} className={`bg-white rounded-xl shadow-sm border ${isCritical ? 'border-red-300' : 'border-gray-100'} overflow-hidden`}>
              {/* Cabecera */}
              <div className="p-4 flex gap-4">
                <div className="h-20 w-20 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-full h-full p-4 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <h3 className="font-medium text-gray-900 leading-tight">{product.name}</h3>
                  <div className="text-[10px] mt-2 flex flex-wrap gap-1">
                    {product.brand && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{product.brand}</span>}
                    {product.category && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{product.category}</span>}
                    {product.presentation && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{product.presentation}</span>}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex flex-col items-center justify-center shrink-0 min-w-[3rem]">
                    {isCritical ? (
                      <>
                        <span className="flex items-center gap-1 font-bold text-red-600 text-lg">
                          <AlertTriangle className="w-4 h-4" />
                          {product.units}
                        </span>
                        <span className="text-[10px] text-red-500 font-medium">Mín: {product.minStock}</span>
                      </>
                    ) : (
                      <span className="font-bold text-gray-900 text-xl">{product.units}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Bloque de Precios en 2 Columnas */}
              <div className={cn("bg-gray-50 p-4 border-y border-gray-100 grid gap-4", isAdmin ? "grid-cols-2" : "grid-cols-1")}>
                {isAdmin && (
                  <div className="flex flex-col justify-center border-r border-gray-200 pr-2">
                    <span className="text-gray-500 text-[10px] font-bold uppercase mb-1">Costo Base</span>
                    <span className="text-gray-900 font-bold bg-gray-100 px-2 py-1 rounded inline-block w-fit">
                      Bs. {product.priceBs.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex flex-col items-end gap-1.5 justify-center">
                  {isAdmin && (
                    <div className="flex items-center gap-2 justify-end w-full">
                      <span className="text-gray-400 text-[10px] font-bold uppercase">Mayor:</span>
                      <span className="text-amber-600 font-semibold text-right">Bs. {product.wholesalePrice.toFixed(2)}</span>
                    </div>
                  )}
                  {product.comparePrice && (
                    <div className="flex items-center gap-2 justify-end w-full">
                      <span className="text-gray-400 text-[10px] font-bold uppercase">Antes:</span>
                      <span className="text-gray-500 font-semibold text-right line-through">Bs. {product.comparePrice.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 justify-end w-full">
                    <span className="text-gray-400 text-[10px] font-bold uppercase">Detalle:</span>
                    <span className="text-emerald-600 font-bold text-right">Bs. {product.sellingPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Botones Grandes Táctiles */}
              <div className="p-4 flex gap-3">
                {isAdmin && (
                  <button
                    onClick={() => handleOpenAdjustStock(product)}
                    className="flex-1 flex justify-center items-center gap-2 py-3 bg-indigo-50 text-indigo-700 rounded-lg font-medium hover:bg-indigo-100 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Stock
                  </button>
                )}
                <button
                  onClick={() => handleOpenEdit(product)}
                  className="flex-1 flex justify-center items-center gap-2 py-3 bg-gray-50 text-gray-700 border border-gray-200 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                >
                  <PenTool className="w-4 h-4" />
                  Editar
                </button>
              </div>
            </div>
          );
        })}
        {products.length === 0 && !isSearching && (
          <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-100">
            No se encontraron productos en el inventario.
          </div>
        )}
        {isSearching && (
          <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-100">
            Buscando productos...
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4 w-1/3">Producto</th>
                {isAdmin && <th className="px-6 py-4 text-center w-32">Stock</th>}
                <th className="px-6 py-4 text-right w-40">Costo Base</th>
                <th className="px-6 py-4 text-right w-48">Precios de Venta</th>
                <th className="px-6 py-4 text-center w-40">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.map((product) => {
                const isCritical = product.minStock !== undefined && product.units <= product.minStock;

                return (
                <tr key={product.id} className={`hover:bg-gray-50 transition-colors ${isCritical ? 'bg-red-50/40' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-gray-100 rounded overflow-hidden shrink-0">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-full h-full p-2 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{product.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap mt-1">
                          {product.brand && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{product.brand}</span>}
                          {product.presentation && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{product.presentation}</span>}
                          {product.category && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{product.category}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-center">
                      {isCritical ? (
                        <div className="flex flex-col items-center justify-center">
                          <span className="flex items-center gap-1 font-bold text-red-600 text-lg">
                            <AlertTriangle className="w-4 h-4" />
                            {product.units}
                          </span>
                          <span className="text-xs text-red-500 font-medium">Mín: {product.minStock}</span>
                        </div>
                      ) : (
                        <span className="font-medium text-gray-900 text-lg">{product.units}</span>
                      )}
                    </td>
                  )}

                  {/* Columna: Costo Base */}
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end justify-center">
                        <span className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-0.5">Compra</span>
                        <span className="text-gray-900 font-bold text-sm bg-gray-100/80 px-2 py-1 rounded border border-gray-200/50">
                          Bs. {product.priceBs.toFixed(2)}
                        </span>
                      </div>
                    </td>
                  )}

                  {/* Columna: Precios de Venta */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      {isAdmin && (
                        <div className="flex items-center justify-end gap-2 w-full">
                          <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Mayor:</span>
                          <span className="text-amber-600 font-semibold w-20 text-right">
                            Bs. {product.wholesalePrice.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {product.comparePrice && (
                        <div className="flex items-center justify-end gap-2 w-full">
                          <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Antes:</span>
                          <span className="text-gray-500 font-semibold w-20 text-right line-through">
                            Bs. {product.comparePrice.toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-2 w-full">
                        <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Detalle:</span>
                        <span className="text-emerald-600 font-bold w-20 text-right">
                          Bs. {product.sellingPrice.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {isAdmin && (
                        <button
                          onClick={() => handleOpenAdjustStock(product)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 transition-colors"
                          title="Ajustar stock (Quitar / Añadir)"
                        >
                          <Edit2 className="w-4 h-4" />
                          Stock
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenEdit(product)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                        title="Editar detalles y precios"
                      >
                        <PenTool className="w-4 h-4" />
                        Editar
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteItem(product.id)}
                          className="inline-flex items-center p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors ml-2"
                          title="Eliminar registro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
              {products.length === 0 && !isSearching && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron productos en el inventario.
                  </td>
                </tr>
              )}
              {isSearching && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Buscando productos...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors font-medium"
          >
            {isLoadingMore ? 'Cargando...' : 'Cargar más productos'}
          </button>
        </div>
      )}

      {/* Add New Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-4 sm:my-8 relative">
            <div className="absolute top-4 right-4 z-10">
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 bg-white rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 shadow-sm border border-gray-200">
                &times;
              </button>
            </div>

            <ProductForm
              purchase={{ id: 'continuous-ledger', name: 'Inventario Continuo', date: new Date().toISOString().split('T')[0], createdAt: Date.now() }}
              onAdd={handleAddNewProduct}
            />
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {isAdjustModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md my-4 sm:my-8 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Ajustar Stock</h2>
              <button onClick={() => setIsAdjustModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleAdjustStock} className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded-md mb-4">
                <p className="font-medium text-gray-900">{selectedProduct.name}</p>
                <p className="text-sm text-gray-500">
                  Stock actual: <span className="font-bold text-gray-900">{selectedProduct.units}</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Acción</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="adjustMode"
                      value="subtract"
                      checked={adjustMode === 'subtract'}
                      onChange={() => setAdjustMode('subtract')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Quitar</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="adjustMode"
                      value="add"
                      checked={adjustMode === 'add'}
                      onChange={() => setAdjustMode('add')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Añadir</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad a {adjustMode === 'add' ? 'añadir' : 'quitar'}</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {adjustMode === 'add' && (
                <div className="pt-2 border-t border-gray-100 mt-2">
                  <label className="block text-sm font-medium text-indigo-700 mb-1">
                    Costo Unitario de Ingreso (Bs.)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">Bs.</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={adjustCost}
                      onChange={(e) => setAdjustCost(e.target.value ? Number(e.target.value) : '')}
                      className="w-full pl-9 pr-3 py-2 border border-indigo-200 bg-indigo-50/50 rounded-md focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                      placeholder="Ej. 45.50"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Modifícalo si el producto llegó con un costo distinto.
                  </p>
                </div>
              )}

              {adjustMode === 'subtract' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de la salida</label>
                    <input
                      type="date"
                      required
                      value={adjustDate}
                      onChange={(e) => setAdjustDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / Detalle</label>
                    <textarea
                      required
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="Ej: Venta local, producto defectuoso, etc."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
                    />
                  </div>
                </>
              )}

              <div className="pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                    adjustMode === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  Confirmar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Details Modal */}
      {isEditModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden my-4 sm:my-8">
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-gray-900">Editar Detalles del Producto</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-4 space-y-3">
              {/* Image Upload */}
              <div className="flex gap-3 items-start mb-4">
                <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
                  {editForm.image ? (
                    <img
                      src={editForm.image}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Actualizar Imagen</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Nombre</label>
                  <input
                    type="text"
                    required
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Código (SKU/Balanza)</label>
                  <input
                    type="text"
                    value={editForm.sku || ''}
                    onChange={(e) => setEditForm({...editForm, sku: e.target.value})}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 bg-indigo-50"
                    placeholder="Ej. CERA-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Marca</label>
                  <input
                    type="text"
                    value={editForm.brand || ''}
                    onChange={(e) => setEditForm({...editForm, brand: e.target.value})}
                    list="inventory-brands-list"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Ej. La Roche-Posay"
                  />
                  <datalist id="inventory-brands-list">
                    {uniqueBrands.map((b, i) => <option key={i} value={b} />)}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Categoría</label>
                  <input
                    type="text"
                    value={editForm.category || ''}
                    onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                    list="inventory-categories-list"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Ej. Sérums / Tratamientos"
                  />
                  <datalist id="inventory-categories-list">
                    {uniqueCategories.map((c, i) => <option key={i} value={c} />)}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Presentación (ml/g)</label>
                  <input
                    type="text"
                    value={editForm.presentation || ''}
                    onChange={(e) => setEditForm({...editForm, presentation: e.target.value})}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-0.5">Vencimiento</label>
                  <input
                    type="date"
                    value={editForm.expirationDate || ''}
                    onChange={(e) => setEditForm({...editForm, expirationDate: e.target.value})}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Detalles del Catálogo (Skincare) */}
              <div className="pt-3 mt-3 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="smart-paste-edit" className="block text-sm font-medium text-purple-700 flex items-center gap-1">
                    ✨ Pegado Rápido Gemini
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-xs font-medium text-purple-600 hover:text-purple-800 flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-md"
                  >
                    {showDetails ? (
                      <>Ocultar detalles <ChevronUp className="w-3 h-3" /></>
                    ) : (
                      <>Editar detalles <ChevronDown className="w-3 h-3" /></>
                    )}
                  </button>
                </div>
                <textarea
                  id="smart-paste-edit"
                  rows={2}
                  value={smartPasteText}
                  onChange={(e) => handleSmartPaste(e.target.value)}
                  className="w-full px-2 py-1.5 border border-purple-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 bg-purple-50 text-sm mb-3"
                  placeholder="Pega aquí el texto generado por Gemini..."
                />

                {showDetails && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 mb-3">
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Tipo de Piel</label>
                      <input
                        type="text"
                        value={editForm.skinType || ''}
                        onChange={(e) => setEditForm({...editForm, skinType: e.target.value})}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ej. Mixta a grasa"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Beneficios</label>
                      <input
                        type="text"
                        value={editForm.benefits || ''}
                        onChange={(e) => setEditForm({...editForm, benefits: e.target.value})}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ej. Controla el sebo y reduce imperfecciones"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Ingredientes Clave</label>
                      <input
                        type="text"
                        value={editForm.keyIngredients || ''}
                        onChange={(e) => setEditForm({...editForm, keyIngredients: e.target.value})}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ej. Ácido Salicílico, Zinc"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Modo de Uso</label>
                      <input
                        type="text"
                        value={editForm.usage || ''}
                        onChange={(e) => setEditForm({...editForm, usage: e.target.value})}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ej. Aplicar mañana y noche sobre el rostro húmedo"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 mt-3 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Actualización de Precios</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="col-span-1 md:col-span-2 lg:col-span-4 flex items-center mb-2">
                    <label className="flex items-center cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={editForm.showInCatalog !== false}
                          onChange={(e) => setEditForm({ ...editForm, showInCatalog: e.target.checked })}
                        />
                        <div className={`block w-8 h-5 rounded-full transition-colors ${editForm.showInCatalog !== false ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${editForm.showInCatalog !== false ? 'transform translate-x-3' : ''}`}></div>
                      </div>
                      <div className="ml-2 text-xs font-medium text-gray-700">
                        Mostrar en Catálogo Público
                      </div>
                    </label>
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Costo (Bs)</label>
                      <input
                        type="number"
                        step="0.01"
                        required={isAdmin}
                        value={editForm.priceBs || ''}
                        onChange={(e) => setEditForm({...editForm, priceBs: Number(e.target.value)})}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  )}
                  {isAdmin && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">Venta Mayor (Bs)</label>
                      <input
                        type="number"
                        step="0.01"
                        required={isAdmin}
                        value={editForm.wholesalePrice || ''}
                        onChange={(e) => setEditForm({...editForm, wholesalePrice: Number(e.target.value)})}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  )}
                  <div>
                    <label htmlFor="inv-compare-price" className="block text-xs font-medium text-gray-700 mb-0.5">Precio Antes (Oferta)</label>
                    <input
                      id="inv-compare-price"
                      type="number"
                      step="0.01"
                      value={editForm.comparePrice || ''}
                      onChange={(e) => setEditForm({...editForm, comparePrice: e.target.value !== '' && !isNaN(Number(e.target.value)) ? Number(e.target.value) : undefined})}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="inv-selling-price" className="block text-xs font-medium text-gray-700 mb-0.5">Venta Unidad (Bs)</label>
                    <input
                      id="inv-selling-price"
                      type="number"
                      step="0.01"
                      required
                      value={editForm.sellingPrice || ''}
                      onChange={(e) => setEditForm({...editForm, sellingPrice: Number(e.target.value)})}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-2 justify-end sticky bottom-0 bg-white border-t border-gray-100 mt-2 p-2 pb-0">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
