import { useState, useEffect } from 'react';
import { Sale, Store } from '../types';
import { getSales, getStores, deleteSale } from '../services/db';
import { FileText, Calendar, Filter, DollarSign, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SalesReport = () => {
  const { isAdmin } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);

  // Filters
  const [filterStore, setFilterStore] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [sales, filterStore, filterDate]);

  const loadData = async () => {
    const [salesData, storesData] = await Promise.all([getSales(), getStores()]);
    setSales(salesData);
    setStores(storesData);
  };

  const applyFilters = () => {
    let result = sales;

    if (filterStore !== 'all') {
      result = result.filter(sale => sale.storeId === filterStore);
    }

    if (filterDate) {
      result = result.filter(sale => sale.date.startsWith(filterDate));
    }

    setFilteredSales(result);
  };

  const getStoreName = (storeId: string) => {
    if (storeId === 'bodega') return 'Bodega Central';
    const store = stores.find(s => s.id === storeId);
    return store ? store.name : 'Desconocida';
  };

  const handleDelete = async (saleId: string) => {
    if (confirm('¿Estás seguro de eliminar esta venta? Se regresará el stock a la sucursal correspondiente.')) {
      await deleteSale(saleId);
      loadData();
    }
  };

  const totalSalesAmount = filteredSales.reduce((sum, sale) => sum + sale.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-indigo-600" />
          Reporte de Ventas
        </h1>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <Filter className="w-4 h-4" /> Sucursal
          </label>
          <select
            value={filterStore}
            onChange={(e) => setFilterStore(e.target.value)}
            className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">Todas las sucursales</option>
            {stores.map(store => (
              <option key={store.id} value={store.id}>{store.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
            <Calendar className="w-4 h-4" /> Fecha
          </label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <button
          onClick={() => { setFilterStore('all'); setFilterDate(''); }}
          className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          Limpiar Filtros
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-indigo-500">
          <p className="text-sm font-medium text-gray-500">Total Ingresos (Filtro Actual)</p>
          <p className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-500" /> Bs. {totalSalesAmount.toFixed(2)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-sm font-medium text-gray-500">Ventas Realizadas</p>
          <p className="text-2xl font-bold text-gray-900">{filteredSales.length}</p>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Fecha y Hora</th>
                <th className="px-6 py-4">Sucursal</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Productos</th>
                <th className="px-6 py-4">Pago</th>
                <th className="px-6 py-4 text-right">Total</th>
                {isAdmin && <th className="px-6 py-4 text-center">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {new Date(sale.date).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {getStoreName(sale.storeId)}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {sale.clientName}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs">
                    <ul className="list-disc list-inside">
                      {sale.items.map((item, idx) => (
                        <li key={idx}>{item.quantity}x {item.name}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      sale.paymentMethod === 'QR' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {sale.paymentMethod}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-indigo-600">
                    Bs. {sale.total.toFixed(2)}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDelete(sale.id)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded-full transition-colors"
                        title="Eliminar venta y devolver stock"
                      >
                        <Trash2 className="w-5 h-5 mx-auto" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron ventas para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SalesReport;
