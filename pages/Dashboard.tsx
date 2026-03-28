import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPurchases, addPurchase, deletePurchase } from '../services/db';
import { Purchase } from '../types';
import { Plus, ArrowRight, Calendar, PackageOpen, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    const data = await getPurchases();
    setPurchases(data);
  };

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !date) return;

    const newPurchase = await addPurchase({
      name,
      date,
    });

    setIsModalOpen(false);
    navigate(`/purchases/${newPurchase.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Historial de Compras</h1>
        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="h-5 w-5" />
            Nueva Compra
          </button>
        )}
      </div>

      {purchases.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          <PackageOpen className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Sin compras registradas</h3>
          <p className="mt-1">Comienza agregando una nueva compra al sistema.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {purchases.map((purchase) => (
            <Link
              key={purchase.id}
              to={`/purchases/${purchase.id}`}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow group flex flex-col justify-between h-full"
            >
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                  {purchase.name}
                </h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{purchase.date}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                {isAdmin && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      if (confirm('¿Estás seguro de que quieres eliminar esta compra?')) {
                        deletePurchase(purchase.id).then(loadPurchases);
                      }
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors z-10 relative"
                    title="Eliminar compra"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <div className="flex items-center text-primary-600 font-medium ml-auto">
                  <span className="text-sm">Ver detalles</span>
                  <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Registrar Nueva Compra</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleAddPurchase} className="p-6 space-y-4">
              <div>
                <label htmlFor="compra-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la Compra (ej. Compra 1)
                </label>
                <input
                  id="compra-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Compra Marzo"
                />
              </div>
              
              <div>
                <label htmlFor="compra-date" className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha
                </label>
                <input
                  id="compra-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Crear Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}