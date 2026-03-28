import { Product } from '../types';
import { Trash2, Package, Edit2 } from 'lucide-react';

interface ProductListProps {
  products: Product[];
  onDelete?: (id: string) => void;
  onEdit?: (product: Product) => void;
  isAdmin: boolean;
}

export default function ProductList({ products, onDelete, onEdit, isAdmin }: ProductListProps) {
  if (products.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
        <Package className="mx-auto h-12 w-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No hay productos</h3>
        <p className="mt-1">Agrega el primer producto a esta compra para empezar.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200 uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Producto</th>
              <th className="px-6 py-4">Detalles</th>
              <th className="px-6 py-4 text-center">Unidades</th>
              <th className="px-6 py-4 text-right">Precio Compra (Bs)</th>
              <th className="px-6 py-4 text-right">Precio Mayor</th>
              <th className="px-6 py-4 text-right">Precio Venta</th>
              <th className="px-6 py-4 text-right font-bold bg-primary-50 text-primary-800">Costo Total Lote</th>
              {isAdmin && <th className="px-6 py-4 text-center">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-gray-100 overflow-hidden flex-shrink-0 border border-gray-200">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400">
                          <Package className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <span className="font-medium text-gray-900 line-clamp-2">{product.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {product.brand && <div className="font-medium">{product.brand}</div>}
                  {product.category && <div>{product.category}</div>}
                  {product.gender && <div>{product.gender}</div>}
                </td>
                <td className="px-6 py-4 text-center font-medium">
                  {product.units}
                </td>
                <td className="px-6 py-4 text-right text-gray-600">
                  {product.priceBs.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right text-amber-600 font-medium">
                  {product.wholesalePrice.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right text-emerald-600 font-medium">
                  {product.sellingPrice.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right font-bold text-gray-900 bg-primary-50/30">
                  {product.totalPrice.toFixed(2)}
                </td>
                {isAdmin && (
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-1">
                      <button
                        onClick={() => onEdit?.(product)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        title="Editar producto"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete?.(product.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                        title="Eliminar producto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}