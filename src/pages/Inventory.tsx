import { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { getInventoryItems, syncOldProductsToInventory, deleteInventoryItem, updateInventoryItem, addStockAdjustment } from '../services/db';
import { Package, Search, Trash2, Edit2, Archive, Layers, PenTool, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const Inventory = () => {
  const { isAdmin } = useAuth();
  const { success, error } = useToast();
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isSyncing, setIsSyncing] = useState(false);

  // Stock adjustment state
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number | ''>('');
  const [adjustMode, setAdjustMode] = useState<'add' | 'subtract'>('subtract');
  const [adjustDate, setAdjustDate] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  // Edit details state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<InventoryItem>>({});

  useEffect(() => {
    loadData();
  }, []);

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

  const handleOpenEdit = (product: InventoryItem) => {
    setSelectedProduct(product);
    setEditForm({ ...product });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !editForm.name) return;

    try {
      await updateInventoryItem(editForm as InventoryItem);
      setIsEditModalOpen(false);
      success('Detalles del producto actualizados correctamente.');
      loadData();
    } catch (err) {
      console.error('Error saving edits:', err);
      error('No se pudieron guardar los cambios.');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
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
        units: newUnits
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

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.gender && p.gender.toLowerCase().includes(searchTerm.toLowerCase()))
  ).sort((a, b) => {
    if (sortOrder === 'desc') {
      return b.units - a.units;
    } else {
      return a.units - b.units;
    }
  });

  const totalProducts = filteredProducts.length;
  const totalUnits = filteredProducts.reduce((sum, item) => sum + item.units, 0);

  const getExpirationStatus = (dateString?: string) => {
    if (!dateString) return null;
    const expDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (expDate < today) {
      return { text: 'Vencido', color: 'bg-red-100 text-red-800' };
    }

    let years = expDate.getFullYear() - today.getFullYear();
    let months = expDate.getMonth() - today.getMonth();
    let days = expDate.getDate() - today.getDate();

    if (days < 0) {
      months -= 1;
      // Get the days in the previous month
      const prevMonth = new Date(expDate.getFullYear(), expDate.getMonth(), 0).getDate();
      days += prevMonth;
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    const parts = [];
    if (years > 0) parts.push(`${years} ${years === 1 ? 'año' : 'años'}`);
    if (months > 0) parts.push(`${months} ${months === 1 ? 'mes' : 'meses'}`);
    if (days > 0) parts.push(`${days} ${days === 1 ? 'día' : 'días'}`);

    if (parts.length === 0) return { text: 'Vence hoy', color: 'bg-red-100 text-red-800' };

    const text = `Quedan ${parts.join(', ')}`;
    const totalDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (totalDays <= 30) {
      return { text, color: 'bg-orange-100 text-orange-800' };
    } else {
      return { text, color: 'bg-green-100 text-green-800' };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <Package className="w-8 h-8 text-indigo-600" />
            Inventario General
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona el stock global y las existencias de todos los productos de SKC.
          </p>
        </div>

        {/* Stats Cards & Actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          {isAdmin && (
            <button
              onClick={handleSyncCatalog}
              disabled={isSyncing}
              className="w-full sm:w-auto px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isSyncing ? 'Sincronizando...' : 'Sincronizar Catálogo'}
            </button>
          )}
          <div className="flex gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4 min-w-[160px]">
              <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Productos Distintos</p>
                <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4 min-w-[160px]">
              <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600">
                <Archive className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total de Unidades</p>
                <p className="text-2xl font-bold text-gray-900">{totalUnits}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar & Filters */}
      <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-3">
        <div className="relative w-full max-w-xl flex-1">
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
        <div className="flex items-center min-w-[200px]">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
            className="block w-full pl-3 pr-10 py-3 text-sm text-gray-700 bg-transparent border-l border-gray-200 focus:ring-0 focus:border-gray-200"
          >
            <option value="desc">Mayor a menor stock</option>
            <option value="asc">Menor a mayor stock</option>
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Producto</th>
                <th className="px-6 py-4 text-center">Stock</th>
                <th className="px-6 py-4 text-center">Vencimiento</th>
                <th className="px-6 py-4 text-right">Costo (Compra)</th>
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
                        <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap mt-1">
                          {product.brand && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{product.brand}</span>}
                          {product.presentation && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{product.presentation}</span>}
                          {product.category && <span className="bg-gray-100 px-1.5 py-0.5 rounded">{product.category}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-medium text-lg">
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
                    <span className="text-gray-600 font-medium" title="Precio Compra">
                      Bs. {product.priceBs.toFixed(2)}
                    </span>
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
                        <>
                          <button
                            onClick={() => handleOpenEdit(product)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                            title="Editar detalles y precios"
                          >
                            <PenTool className="w-4 h-4" />
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteItem(product.id)}
                            className="inline-flex items-center p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors ml-2"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold text-gray-900">Editar Detalles del Producto</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {/* Image Upload */}
              <div className="flex gap-4 items-start mb-6">
                <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
                  {editForm.image ? (
                    <img src={editForm.image} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Actualizar Imagen</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
                  <input
                    type="text"
                    value={editForm.brand || ''}
                    onChange={(e) => setEditForm({...editForm, brand: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <input
                    type="text"
                    value={editForm.category || ''}
                    onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Presentación (ml/g)</label>
                  <input
                    type="text"
                    value={editForm.presentation || ''}
                    onChange={(e) => setEditForm({...editForm, presentation: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vencimiento</label>
                  <input
                    type="date"
                    value={editForm.expirationDate || ''}
                    onChange={(e) => setEditForm({...editForm, expirationDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-gray-200">
                <h3 className="font-medium text-gray-900 mb-4">Actualización de Precios</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Costo (Bs)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editForm.priceBs || ''}
                      onChange={(e) => setEditForm({...editForm, priceBs: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Venta Mayor (Bs)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editForm.wholesalePrice || ''}
                      onChange={(e) => setEditForm({...editForm, wholesalePrice: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Venta Unidad (Bs)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editForm.sellingPrice || ''}
                      onChange={(e) => setEditForm({...editForm, sellingPrice: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-6 flex gap-3 justify-end sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
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
