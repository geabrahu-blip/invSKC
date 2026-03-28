import React, { useState, useEffect } from 'react';
import { InventoryItem, Store } from '../types';
import { getInventoryItems, getStores, addTransfer, updateInventoryItem, syncOldProductsToInventory, deleteInventoryItem } from '../services/db';
import { Package, ArrowRightLeft, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Inventory = () => {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Transfer state
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [transferQuantity, setTransferQuantity] = useState<number | ''>('');
  const [targetStoreId, setTargetStoreId] = useState('');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      await syncOldProductsToInventory();
      loadData();
    };
    init();
  }, []);

  const loadData = async () => {
    const [productsData, storesData] = await Promise.all([
      getInventoryItems(),
      getStores()
    ]);
    // group by store and product? We will just show them as is.
    setProducts(productsData);
    setStores(storesData);
  };

  const getStoreName = (storeId?: string) => {
    if (!storeId || storeId === 'bodega') return 'Bodega Central';
    const store = stores.find(s => s.id === storeId);
    return store ? store.name : 'Desconocida';
  };

  const handleOpenTransfer = (product: InventoryItem) => {
    setSelectedProduct(product);
    setTransferQuantity('');
    setTargetStoreId('');
    setIsTransferModalOpen(true);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !transferQuantity || !targetStoreId) return;

    const qty = Number(transferQuantity);
    if (qty <= 0 || qty > selectedProduct.units) {
      alert('Cantidad inválida. Verifica el stock disponible.');
      return;
    }

    try {
      // 1. Record transfer
      await addTransfer({
        productId: selectedProduct.id,
        fromStoreId: selectedProduct.storeId || 'bodega',
        toStoreId: targetStoreId,
        quantity: qty,
        date: new Date().toISOString()
      });

      // 2. Deduct from origin
      const originUpdated = {
        ...selectedProduct,
        units: selectedProduct.units - qty
      };
      await updateInventoryItem(originUpdated);

      // 3. Add to destination (Check if product already exists in target store)
      const existingInTarget = products.find(p =>
        p.productId === selectedProduct.productId &&
        p.storeId === targetStoreId
      );

      if (existingInTarget) {
        await updateInventoryItem({
          ...existingInTarget,
          units: existingInTarget.units + qty
        });
      } else {
        // Create new inventory item record for the target store
        const newInventoryForStore: InventoryItem = {
          ...selectedProduct,
          id: crypto.randomUUID(),
          storeId: targetStoreId,
          units: qty,
        };
        await updateInventoryItem(newInventoryForStore);
      }

      setIsTransferModalOpen(false);
      loadData();
      alert('Transferencia realizada con éxito');
    } catch (error) {
      console.error('Error transfer:', error);
      alert('Hubo un error al realizar la transferencia');
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

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.gender && p.gender.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-6 h-6 text-indigo-600" />
          Inventario Global y Transferencias
        </h1>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nombre, marca o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Producto</th>
                <th className="px-6 py-4">Ubicación</th>
                <th className="px-6 py-4 text-center">Stock</th>
                <th className="px-6 py-4 text-right">Precio Venta</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-gray-100 rounded overflow-hidden">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-full h-full p-2 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{product.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap">
                          {product.brand && <span className="bg-gray-100 px-1 rounded">{product.brand}</span>}
                          {product.category && <span className="bg-gray-100 px-1 rounded">{product.category}</span>}
                          {product.gender && <span className="bg-indigo-50 text-indigo-700 px-1 rounded">{product.gender}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      (!product.storeId || product.storeId === 'bodega')
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {getStoreName(product.storeId)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-medium">
                    {product.units}
                  </td>
                  <td className="px-6 py-4 text-right text-emerald-600 font-medium">
                    Bs. {product.sellingPrice.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleOpenTransfer(product)}
                        disabled={product.units === 0}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Transferir stock"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                        Mover
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteItem(product.id)}
                          className="inline-flex items-center p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors"
                          title="Eliminar por error"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron productos en el inventario.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transfer Modal */}
      {isTransferModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Transferir Inventario</h2>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleTransfer} className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded-md mb-4">
                <p className="font-medium text-gray-900">{selectedProduct.name}</p>
                <p className="text-sm text-gray-500">
                  Origen: {getStoreName(selectedProduct.storeId)} (Stock: {selectedProduct.units})
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad a transferir</label>
                <input
                  type="number"
                  min="1"
                  max={selectedProduct.units}
                  required
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destino</label>
                <select
                  required
                  value={targetStoreId}
                  onChange={(e) => setTargetStoreId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="" disabled>Selecciona un destino</option>
                  {(!selectedProduct.storeId || selectedProduct.storeId !== 'bodega') && (
                    <option value="bodega">Bodega Central</option>
                  )}
                  {stores.map(store => {
                    if (store.id !== selectedProduct.storeId) {
                      return <option key={store.id} value={store.id}>{store.name}</option>;
                    }
                    return null;
                  })}
                </select>
              </div>

              <div className="pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                >
                  Confirmar Transferencia
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
