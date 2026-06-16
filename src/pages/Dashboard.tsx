import { useState, useEffect } from 'react';
import { getExpiringProducts, getStockEntries } from '../services/db';
import { InventoryItem, FinancialLot } from '../types';
import { Calendar, PackageOpen, DollarSign, AlertCircle, ArrowUpRight, PlusCircle, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { isAdmin } = useAuth();

  // Rango de fechas por defecto: Últimos 30 días
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  // States
  const [entries, setEntries] = useState<FinancialLot[]>([]);
  const [expiringProducts, setExpiringProducts] = useState<InventoryItem[]>([]);

  useEffect(() => {
    loadExpiring();
    loadFinancials();
  }, []);

  const loadExpiring = async () => {
    try {
      const expiring = await getExpiringProducts(30);
      setExpiringProducts(expiring);
    } catch (err) {
      console.error("Error cargando productos por vencer:", err);
    }
  };

  const loadFinancials = async () => {
    try {
      const allEntries = await getStockEntries();
      setEntries(allEntries);
    } catch (err) {
      console.error("Error cargando lotes financieros:", err);
    }
  };

  // Filtrar los lotes (Continuous Ledger) por las fechas elegidas
  const filteredEntries = entries.filter(e => e.date >= startDate && e.date <= endDate);

  // 1. Inversión Total en el Rango
  const totalInvestment = filteredEntries.reduce((sum, e) => sum + e.totalInvestment, 0);

  // 2. Top 5 de Productos por Inversión
  const investmentByProduct = filteredEntries.reduce((acc, entry) => {
    acc[entry.productName] = (acc[entry.productName] || 0) + entry.totalInvestment;
    return acc;
  }, {} as Record<string, number>);

  const top5 = Object.entries(investmentByProduct)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const maxTopInvestment = top5.length > 0 ? top5[0].total : 1;

  // --- FEFO Logic Processing ---
  const fefoToday = new Date();
  fefoToday.setHours(0, 0, 0, 0);

  const expired: (InventoryItem & { counter: string })[] = [];
  const highRisk: (InventoryItem & { counter: string })[] = [];
  const mediumRisk: (InventoryItem & { counter: string })[] = [];

  expiringProducts.forEach(prod => {
    const expDate = new Date(prod.expirationDate!);
    const diffTime = expDate.getTime() - fefoToday.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let counter = '';
    if (diffDays < 0) counter = `${Math.abs(diffDays)}d vencido`;
    else if (diffDays === 0) counter = 'hoy';
    else if (diffDays < 30) counter = `${diffDays}d`;
    else {
      const months = Math.floor(diffDays / 30);
      counter = `${months} mes${months > 1 ? 'es' : ''}`;
    }

    const item = { ...prod, counter };

    if (diffDays < 0) expired.push(item);
    else if (diffDays <= 90) highRisk.push(item);
    else if (diffDays <= 180) mediumRisk.push(item);
  });
  // -----------------------------

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <Activity className="w-8 h-8 text-indigo-600" />
            Dashboard Financiero
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Analítica de inversiones y alertas de vencimiento.
          </p>
        </div>

        {/* Date Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 flex items-center gap-2">
          <div className="flex flex-col px-2">
            <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm border-0 bg-transparent focus:ring-0 p-0 text-gray-700"
            />
          </div>
          <div className="h-8 w-px bg-gray-200"></div>
          <div className="flex flex-col px-2">
            <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm border-0 bg-transparent focus:ring-0 p-0 text-gray-700"
            />
          </div>
        </div>
      </div>

      {/* FEFO Dashboard Section */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-gray-700" />
          Alertas de Vencimiento (FEFO)
        </h2>

        <div className="grid gap-4 md:grid-cols-3">
          {/* BLOQUE ROJO: Vencidos */}
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-red-800 flex justify-between items-center mb-3">
              <span>🔴 Vencidos</span>
              <span className="bg-red-200 text-red-800 text-xs px-2 py-1 rounded-full">{expired.length}</span>
            </h3>
            {expired.length === 0 ? (
              <p className="text-sm text-red-400 italic">No hay productos vencidos.</p>
            ) : (
              <ul className="divide-y divide-red-100/50 max-h-60 overflow-y-auto pr-1">
                {expired.map(p => (
                  <li key={p.id} className="py-2 flex justify-between items-start">
                    <div>
                      <p className="font-medium text-red-900 text-sm leading-tight">
                        {p.name} <span className="text-red-500 font-normal text-xs ml-1">({p.counter})</span>
                      </p>
                      {p.brand && <p className="text-xs text-red-700 opacity-80 mt-0.5">{p.brand}</p>}
                    </div>
                    <span className="font-bold text-red-900 text-sm ml-2 bg-red-100 px-1.5 py-0.5 rounded shrink-0">
                      {p.units} un.
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* BLOQUE NARANJA: Riesgo Alto (90 días) */}
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-orange-800 flex justify-between items-center mb-3">
              <span>🟠 Riesgo Alto (90d)</span>
              <span className="bg-orange-200 text-orange-800 text-xs px-2 py-1 rounded-full">{highRisk.length}</span>
            </h3>
            {highRisk.length === 0 ? (
              <p className="text-sm text-orange-400 italic">Sin riesgo a corto plazo.</p>
            ) : (
              <ul className="divide-y divide-orange-100/50 max-h-60 overflow-y-auto pr-1">
                {highRisk.map(p => (
                  <li key={p.id} className="py-2 flex justify-between items-start">
                    <div>
                      <p className="font-medium text-orange-900 text-sm leading-tight">
                        {p.name} <span className="text-orange-500 font-normal text-xs ml-1">({p.counter})</span>
                      </p>
                      {p.brand && <p className="text-xs text-orange-700 opacity-80 mt-0.5">{p.brand}</p>}
                    </div>
                    <span className="font-bold text-orange-900 text-sm ml-2 bg-orange-100 px-1.5 py-0.5 rounded shrink-0">
                      {p.units} un.
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* BLOQUE AMARILLO: Riesgo Medio (180 días) */}
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 shadow-sm">
            <h3 className="font-semibold text-yellow-800 flex justify-between items-center mb-3">
              <span>🟡 Riesgo Medio (6m)</span>
              <span className="bg-yellow-200 text-yellow-800 text-xs px-2 py-1 rounded-full">{mediumRisk.length}</span>
            </h3>
            {mediumRisk.length === 0 ? (
              <p className="text-sm text-yellow-500 italic">Sin riesgo a mediano plazo.</p>
            ) : (
              <ul className="divide-y divide-yellow-100/50 max-h-60 overflow-y-auto pr-1">
                {mediumRisk.map(p => (
                  <li key={p.id} className="py-2 flex justify-between items-start">
                    <div>
                      <p className="font-medium text-yellow-900 text-sm leading-tight">
                        {p.name} <span className="text-yellow-600 font-normal text-xs ml-1">({p.counter})</span>
                      </p>
                      {p.brand && <p className="text-xs text-yellow-700 opacity-80 mt-0.5">{p.brand}</p>}
                    </div>
                    <span className="font-bold text-yellow-900 text-sm ml-2 bg-yellow-100 px-1.5 py-0.5 rounded shrink-0">
                      {p.units} un.
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>

      {isAdmin && (
        <>
          {/* Financial Analytics Area */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">

            {/* Total Investment Card */}
        <div className="md:col-span-1 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl shadow-lg p-6 text-white flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 bg-white/10 w-32 h-32 rounded-full blur-2xl"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-indigo-100 mb-2">
              <DollarSign className="w-5 h-5" />
              <h3 className="font-medium text-sm uppercase tracking-wider">Inversión en Período</h3>
            </div>
            <p className="text-4xl font-extrabold tracking-tight">Bs. {totalInvestment.toFixed(2)}</p>
            <p className="text-indigo-200 text-sm mt-3 flex items-center gap-1">
              <PackageOpen className="w-4 h-4" /> {filteredEntries.reduce((s, e) => s + e.addedUnits, 0)} unidades ingresadas
            </p>
          </div>
        </div>

        {/* Top 5 Products Card */}
        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-gray-800 font-bold mb-4 flex items-center gap-2">
            <ArrowUpRight className="w-5 h-5 text-indigo-500" />
            Top 5 Productos (Mayor Inversión)
          </h3>

          {top5.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-gray-400 italic text-sm">
              No hay movimientos en este rango de fechas.
            </div>
          ) : (
            <div className="space-y-4">
              {top5.map((item, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700 truncate pr-4">{item.name}</span>
                    <span className="text-gray-900 font-bold">Bs. {item.total.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(item.total / maxTopInvestment) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
            </div>
          </div>

          {/* Audit Log / Continuous Ledger */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-700" />
              Registro Contable (Lotes)
            </h2>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {filteredEntries.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No hay ingresos registrados en estas fechas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3">Fecha</th>
                    <th className="px-6 py-3">Operación</th>
                    <th className="px-6 py-3">Producto</th>
                    <th className="px-6 py-3 text-center">Unidades</th>
                    <th className="px-6 py-3 text-right">Costo Invertido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredEntries.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{entry.date}</td>
                      <td className="px-6 py-3">
                        {entry.type === 'NEW_PRODUCT' ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs font-medium border border-emerald-100">
                            <PlusCircle className="w-3 h-3" /> Nuevo Producto
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium border border-blue-100">
                            <ArrowUpRight className="w-3 h-3" /> Reabastecimiento
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 font-medium text-gray-900">{entry.productName}</td>
                      <td className="px-6 py-3 text-center font-bold text-gray-700">+{entry.addedUnits}</td>
                      <td className="px-6 py-3 text-right font-medium text-indigo-700">
                        Bs. {entry.totalInvestment.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
}