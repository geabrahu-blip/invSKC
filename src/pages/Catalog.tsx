import { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { getInventoryItems, toggleWholesaleAvailability } from '../services/db';
import { Package, Search, Image as ImageIcon, Tags, Grid, Building2, Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Catalog() {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showWholesaleOnly, setShowWholesaleOnly] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // In a real app, you would fetch from `public_catalog` collection directly if you separate the frontend.
    // Since we are in the same app, we can just fetch from inventory, or fetch from public_catalog.
    // Fetching from inventory here works, but fetching from public_catalog guarantees we only see public data.
    const productsData = await getInventoryItems(); // Fetching from inventory for now as it's admin-facing too, but to be strictly correct with the new collection we should fetch from `public_catalog`.

    // We filter out products that are explicitly marked as not to be shown in the catalog.
    const visibleProducts = productsData.filter(p => p.showInCatalog !== false);

    // We will keep it simple and filter out 0 stock if needed, or just display them all.
    setProducts(visibleProducts);
  };

  const handleToggleWholesale = async (id: string, currentVal: boolean | undefined) => {
    const newVal = !(currentVal || false);

    // Optimistic UI update
    setProducts(prev => prev.map(p =>
      p.id === id ? { ...p, availableForWholesale: newVal } : p
    ));

    try {
      await toggleWholesaleAvailability(id, newVal);
    } catch (e) {
      console.error(e);
      // Revert on error
      setProducts(prev => prev.map(p =>
        p.id === id ? { ...p, availableForWholesale: currentVal } : p
      ));
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()));

    if (showWholesaleOnly && isAdmin) {
      return matchesSearch && p.availableForWholesale;
    }

    return matchesSearch;
  });
return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <Grid className="w-8 h-8 text-indigo-600" />
            Catálogo Comercial
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Vista de catálogo para consultar precios de venta y disponibilidad.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Wholesale Filter Toggle (Admin Only) */}
          {isAdmin && (
            <button
                        onClick={() => setShowWholesaleOnly(!showWholesaleOnly)}
                        className={`flex-shrink-0 w-full sm:w-auto px-4 py-2.5 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 border ${
                          showWholesaleOnly
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {showWholesaleOnly ? <Building2 className="w-4 h-4" /> : <Store className="w-4 h-4" />}
                        {showWholesaleOnly ? 'Viendo al Por Mayor' : 'Ver al Por Mayor'}
                      </button>
          )}

          {/* Search Bar */}
          <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex items-center w-full sm:min-w-[300px]">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border-0 bg-transparent text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500 shadow-sm">
          <Package className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No se encontraron productos</h3>
          <p className="mt-1">Intenta con otra búsqueda o asegúrate de tener inventario registrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
              <div className="aspect-square w-full bg-white relative border-b border-gray-100 flex items-center justify-center overflow-hidden shrink-0 group">
                {product.image ? (
                  <img src={product.image} alt={product.name} className="w-full h-full object-contain p-2" />
                ) : (
                  <ImageIcon className="h-12 w-12 text-gray-300" />
                )}

                {isAdmin && (
                  <>
                    <div className="absolute top-2 right-2 flex flex-col gap-2 items-end">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold shadow-sm ${
                        product.units > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        Stock: {product.units}
                      </span>
                    </div>

                    <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleWholesale(product.id, product.availableForWholesale);
                        }}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium shadow-sm border transition-colors flex items-center gap-1.5 ${
                          product.availableForWholesale
                            ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                            : 'bg-white/90 backdrop-blur border-gray-200 text-gray-700 hover:bg-white hover:border-gray-300'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        {product.availableForWholesale ? 'Habilitado x Mayor' : 'Habilitar x Mayor'}
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="p-4 flex flex-col flex-grow">
                <div className="mb-3">
                  <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2 h-10" title={product.name}>
                    {product.name}
                  </h3>
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {product.brand && (
                    <span className="inline-flex items-center text-[11px] font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                      <Tags className="w-3 h-3 mr-1" />
                      {product.brand}
                    </span>
                  )}
                  {product.presentation && (
                    <span className="inline-flex items-center text-[11px] font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                      {product.presentation}
                    </span>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-100 mt-auto space-y-1.5">
                  {isAdmin && product.wholesalePrice > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 text-xs uppercase tracking-wider font-medium">Por Mayor</span>
                      <span className="font-semibold text-blue-600">Bs. {product.wholesalePrice.toFixed(2)}</span>
                    </div>
                  )}
                  {product.comparePrice !== undefined && product.comparePrice > 0 && (
                    <div className="flex justify-between items-center text-sm mt-1">
                      <span className="text-gray-400 text-xs uppercase tracking-wider font-medium">Antes</span>
                      <span className="font-semibold text-gray-400 line-through text-xs">Bs. {product.comparePrice.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs uppercase tracking-wider font-medium">
                        {(product.comparePrice !== undefined && product.comparePrice > 0) ? 'Oferta' : 'Unidad'}
                      </span>
                      {product.comparePrice !== undefined && product.comparePrice > product.sellingPrice && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm shadow-sm">
                          -{Math.round(((product.comparePrice - product.sellingPrice) / product.comparePrice) * 100)}%
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-emerald-600 text-base">Bs. {product.sellingPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
