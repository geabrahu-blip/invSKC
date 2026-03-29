import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getPurchases, getAllProducts, addPurchase, deletePurchase } from '../services/db';
import { PurchaseWithTotal } from '../types';
import { Plus, ArrowRight, Calendar, PackageOpen, Trash2, Search, DollarSign, Filter } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<PurchaseWithTotal[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState(''); // 'YYYY-MM'
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    const [purchasesData, productsData] = await Promise.all([
      getPurchases(),
      getAllProducts()
    ]);

    // Map total prices to each purchase
    const productsByPurchase = productsData.reduce((acc, prod) => {
      if (!acc[prod.purchaseId]) acc[prod.purchaseId] = 0;
      acc[prod.purchaseId] += prod.totalPrice;
      return acc;
    }, {} as Record<string, number>);

    const purchasesWithTotals: PurchaseWithTotal[] = purchasesData.map(p => ({
      ...p,
      totalAmount: productsByPurchase[p.id] || 0
    }));

    setPurchases(purchasesWithTotals);
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

  const filteredPurchases = purchases.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMonth = filterMonth ? p.date.startsWith(filterMonth) : true;
    return matchesSearch && matchesMonth;
  });

  const totalInvestment = filteredPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);

  // Generate unique months for the filter dropdown
  const uniqueMonths = Array.from(new Set(purchases.map(p => p.date.substring(0, 7)))).sort().reverse();

  const getMonthName = (yearMonth: string) => {
    const [y, m] = yearMonth.split('-');
    const date = new Date(Number(y), Number(m) - 1);
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <PackageOpen className="w-8 h-8 text-indigo-600" />
            Historial de Compras
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Registra y administra los lotes de productos ingresados.
          </p>
        </div>

        {/* Investment Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4 min-w-[200px]">
          <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Inversión Total</p>
            <p className="text-2xl font-bold text-gray-900">Bs. {totalInvestment.toFixed(2)}</p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="h-5 w-5" />
            Nueva Compra
          </button>
        )}
      </div>

      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar compra por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
        <div className="relative min-w-[200px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Filter className="h-5 w-5 text-gray-400" />
          </div>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm appearance-none"
          >
            <option value="">Todos los meses</option>
            {uniqueMonths.map(month => (
              <option key={month} value={month}>
                {getMonthName(month)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredPurchases.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          <PackageOpen className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Sin compras registradas</h3>
          <p className="mt-1">Comienza agregando una nueva compra al sistema.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPurchases.map((purchase) => (
            <Link
              key={purchase.id}
              to={`/purchases/${purchase.id}`}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow group flex flex-col justify-between h-full"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {purchase.name}
                  </h3>
                  <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                    <Calendar className="mr-1 h-3 w-3" />
                    {purchase.date}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mt-4">
                  <p>Inversión del lote:</p>
                  <p className="text-xl font-bold text-gray-900">Bs. {purchase.totalAmount?.toFixed(2)}</p>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
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
                <div className="flex items-center text-indigo-600 font-medium ml-auto">
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
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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