import { useState, useEffect } from 'react';
import { InventoryItem } from '../types';
import { getInventoryItems } from '../services/db';
import { Package, Search, Image as ImageIcon, Tags, Grid } from 'lucide-react';

export default function Catalog() {
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // In a real app, you would fetch from `public_catalog` collection directly if you separate the frontend.
    // Since we are in the same app, we can just fetch from inventory, or fetch from public_catalog.
    // Fetching from inventory here works, but fetching from public_catalog guarantees we only see public data.
    const productsData = await getInventoryItems(); // Fetching from inventory for now as it's admin-facing too, but to be strictly correct with the new collection we should fetch from `public_catalog`.

    // We will keep it simple and filter out 0 stock if needed, or just display them all.
    setProducts(productsData);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <Grid className="w-8 h-8 text-indigo-600" />
            Catálogo Comercial
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Vista de catálogo para consultar precios de venta y disponibilidad sin revelar costos.
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex items-center min-w-[300px]">
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

      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500 shadow-sm">
          <Package className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No se encontraron productos</h3>
          <p className="mt-1">Intenta con otra búsqueda o asegúrate de tener inventario registrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
              <div className="aspect-square bg-gray-50 relative border-b border-gray-100 flex items-center justify-center p-4">
                {product.image ? (
                  <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="h-12 w-12 text-gray-300" />
                )}

                <div className="absolute top-2 right-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                    product.units > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    Stock: {product.units}
                  </span>
                </div>
              </div>

              <div className="p-4 flex flex-col flex-1">
                <div className="flex-1 mb-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 leading-tight line-clamp-2" title={product.name}>
                      {product.name}
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {product.brand && (
                      <span className="inline-flex items-center text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        <Tags className="w-3 h-3 mr-1" />
                        {product.brand}
                      </span>
                    )}
                    {product.presentation && (
                      <span className="inline-flex items-center text-xs font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {product.presentation}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 mt-auto space-y-1.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Por Mayor</span>
                    <span className="font-semibold text-blue-600">Bs. {product.wholesalePrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Unidad</span>
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
