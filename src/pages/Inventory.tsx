import { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { getInventoryItems, syncOldProductsToInventory, deleteInventoryItem, updateInventoryItem } from '../services/db';
import { Package, Search, Trash2, Edit2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Inventory = () => {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Stock adjustment state
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number | ''>('');
  const [adjustMode, setAdjustMode] = useState<'add' | 'subtract'>('subtract');
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      await syncOldProductsToInventory();
      loadData();
    };
    init();
  }, []);

  const loadData = async () => {
    const productsData = await getInventoryItems();
    setProducts(productsData);
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

  const handleOpenAdjustStock = (product: InventoryItem) => {
    setSelectedProduct(product);
    setAdjustAmount('');
    setAdjustMode('subtract');
    setIsAdjustModalOpen(true);
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !adjustAmount) return;

    const amount = Number(adjustAmount);
    if (amount <= 0) {
      alert('La cantidad debe ser mayor a 0.');
      return;
    }

    let newUnits = selectedProduct.units;
    if (adjustMode === 'add') {
      newUnits += amount;
    } else {
      newUnits -= amount;
      if (newUnits < 0) {
        alert('No puedes quitar más stock del que hay disponible.');
        return;
      }
    }

    try {
      await updateInventoryItem({
        ...selectedProduct,
        units: newUnits
      });
      setIsAdjustModalOpen(false);
      loadData();
    } catch (error) {
      console.error('Error al ajustar el stock:', error);
      alert('Hubo un error al actualizar el stock.');
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.gender && p.gender.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getExpirationStatus = (dateString?: string) => {
    if (!dateString) return null;
    const expDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: 'Vencido', color: 'bg-red-100 text-red-800' };
    } else if (diffDays <= 30) {
      return { text: `Vence en ${diffDays} días`, color: 'bg-orange-100 text-orange-800' };
    } else {
      return { text: `Vence en ${diffDays} días`, color: 'bg-green-100 text-green-800' };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-6 h-6 text-indigo-600" />
          Inventario Global
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
                <th className="px-6 py-4 text-center">Stock</th>
                <th className="px-6 py-4 text-center">Vencimiento</th>
                <th className="px-6 py-4 text-right">Precios (Compra / Mayor / Venta)</th>
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
                  <td className="px-6 py-4 text-center font-medium">
                    {product.units}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {product.expirationDate ? (
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getExpirationStatus(product.expirationDate)?.color}`}>
                        {getExpirationStatus(product.expirationDate)?.text}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col items-end gap-1 text-sm">
                      <span className="text-gray-500" title="Precio Compra">
                        C: Bs. {product.priceBs.toFixed(2)}
                      </span>
                      <span className="text-blue-600" title="Precio x Mayor">
                        M: Bs. {product.wholesalePrice.toFixed(2)}
                      </span>
                      <span className="text-emerald-600 font-medium" title="Precio Venta Unidad">
                        V: Bs. {product.sellingPrice.toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleOpenAdjustStock(product)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-md hover:bg-indigo-100 transition-colors"
                        title="Ajustar stock (Quitar / Añadir)"
                      >
                        <Edit2 className="w-4 h-4" />
                        Stock
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteItem(product.id)}
                          className="inline-flex items-center p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors"
                          title="Eliminar registro"
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

      {/* Adjust Stock Modal */}
      {isAdjustModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
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
    </div>
  );
};

export default Inventory;
