import { useState, useEffect } from 'react';
import { RestockRequest, InventoryItem } from '../types';
import { getRestockRequests, addRestockRequest, updateRestockRequestStatus, deleteRestockRequest, getInventoryItems } from '../services/db';
import { Package, Search, Plus, CheckCircle, Trash2, X, AlertTriangle, ClipboardList } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function RestockRequests() {
  const { user, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [requests, setRequests] = useState<RestockRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [requestedUnits, setRequestedUnits] = useState<number | ''>('');

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const data = await getRestockRequests();
      setRequests(data);
    } catch (err) {
      console.error("Error cargando pedidos:", err);
      error("Error al cargar los pedidos de reposición.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenModal = async () => {
    setIsModalOpen(true);
    if (inventory.length === 0) {
      try {
        const items = await getInventoryItems();
        setInventory(items);
      } catch (err) {
        console.error("Error loading inventory:", err);
      }
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
    setSearchTerm('');
    setRequestedUnits('');
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !requestedUnits || requestedUnits <= 0) return;

    try {
      await addRestockRequest({
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        image: selectedProduct.image,
        brand: selectedProduct.brand,
        category: selectedProduct.category,
        presentation: selectedProduct.presentation,
        requestedUnits: Number(requestedUnits),
        requestedBy: user?.name || 'Usuario desconocido'
      });
      success("Pedido de reposición agregado con éxito.");
      handleCloseModal();
      loadRequests();
    } catch (err) {
      console.error("Error:", err);
      error("Error al guardar el pedido.");
    }
  };

  const handleMarkCompleted = async (id: string) => {
    try {
      await updateRestockRequestStatus(id, 'COMPLETED');
      success("Pedido marcado como completado.");
      loadRequests();
    } catch (err) {
      console.error(err);
      error("Error al actualizar el estado.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este pedido de la lista?")) return;
    try {
      await deleteRestockRequest(id);
      success("Pedido eliminado.");
      loadRequests();
    } catch (err) {
      console.error(err);
      error("Error al eliminar el pedido.");
    }
  };

  const filteredInventory = inventory.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase()))
  ).slice(0, 50); // limit to avoid lag

  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const completedRequests = requests.filter(r => r.status === 'COMPLETED');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-indigo-600" />
            Pedidos de Reposición
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Lista de productos agotados o faltantes solicitados por el equipo.
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium gap-2"
        >
          <Plus className="w-5 h-5" />
          Añadir a la lista
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* PENDING LIST */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-semibold text-gray-900">Pendientes de Reposición</h2>
              <span className="ml-auto bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded-full">
                {pendingRequests.length}
              </span>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <ClipboardList className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p>No hay pedidos pendientes actualmente.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {pendingRequests.map(req => (
                  <li key={req.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-lg border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                      {req.image ? (
                        <img src={req.image} alt={req.productName} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-8 h-8 text-gray-300" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 truncate">{req.productName}</h3>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        {req.brand && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{req.brand}</span>}
                        {req.presentation && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{req.presentation}</span>}
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        Solicitado por <span className="font-medium text-gray-700">{req.requestedBy}</span> el {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                      <div className="flex flex-col items-center sm:items-end">
                        <span className="text-[10px] uppercase font-bold text-gray-400">Cantidad</span>
                        <span className="text-xl font-bold text-orange-600">{req.requestedUnits}</span>
                      </div>

                      {isAdmin && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleMarkCompleted(req.id)}
                            className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                            title="Marcar como repuesto"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(req.id)}
                            className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                            title="Eliminar pedido"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* COMPLETED LIST (Solo admin puede ver o todos? Lo dejaremos visible para todos como historial reciente) */}
          {completedRequests.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden opacity-75">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <h2 className="text-lg font-semibold text-gray-900">Historial Reciente (Completados)</h2>
              </div>
              <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {completedRequests.map(req => (
                  <li key={req.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center gap-4">
                     <div className="w-10 h-10 bg-white rounded-md border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                      {req.image ? (
                        <img src={req.image} alt={req.productName} className="w-full h-full object-cover grayscale" />
                      ) : (
                        <Package className="w-5 h-5 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-500 line-through truncate">{req.productName}</h3>
                      <p className="text-xs text-gray-400">
                        {req.requestedUnits} uds. solicitadas por {req.requestedBy}
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(req.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* NEW REQUEST MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-4 sm:my-8 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                Añadir Pedido de Reposición
              </h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {!selectedProduct ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Buscar producto a reponer..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-gray-50"
                      autoFocus
                    />
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto bg-white">
                    {filteredInventory.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        No se encontraron productos.
                      </div>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {filteredInventory.map(product => (
                          <li
                            key={product.id}
                            onClick={() => setSelectedProduct(product)}
                            className="p-3 hover:bg-indigo-50 cursor-pointer flex items-center gap-3 transition-colors"
                          >
                            <div className="w-10 h-10 bg-white border border-gray-200 rounded overflow-hidden shrink-0">
                               {product.image ? (
                                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Package className="w-5 h-5 m-2.5 text-gray-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-sm truncate">{product.name}</p>
                              {product.brand && <p className="text-xs text-gray-500 truncate">{product.brand}</p>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitRequest} className="space-y-6">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-start gap-4">
                    <div className="w-16 h-16 bg-white border border-gray-200 rounded-lg overflow-hidden shrink-0">
                        {selectedProduct.image ? (
                          <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-8 h-8 m-4 text-gray-400" />
                        )}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{selectedProduct.name}</h3>
                      <div className="flex gap-2 text-sm text-gray-600 mt-1">
                        {selectedProduct.brand && <span>{selectedProduct.brand}</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(null)}
                        className="text-indigo-600 text-sm font-medium mt-2 hover:underline"
                      >
                        Cambiar producto
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      ¿Cuántas unidades faltan o se necesitan?
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={requestedUnits}
                      onChange={(e) => setRequestedUnits(e.target.value !== '' ? Number(e.target.value) : '')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-xl font-bold text-gray-900"
                      placeholder="Ej. 10"
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={!requestedUnits || requestedUnits <= 0}
                      className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Añadir a Pedidos
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
