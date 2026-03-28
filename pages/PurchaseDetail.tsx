import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPurchaseById, getProductsByPurchaseId } from '../services/db';
import { Purchase, Product } from '../types';
import { 
  ArrowLeft, 
  TrendingUp, 
  Wallet, 
  DollarSign, 
  Package, 
  Boxes 
} from 'lucide-react';
import { cn } from '../components/Layout';
import ProductForm from '../components/ProductForm';
import ProductList from '../components/ProductList';
import { addProduct, deleteProduct, updateProduct } from '../services/db';

export default function PurchaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();

  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id]);

  const loadData = async (purchaseId: string) => {
    const [purchaseData, productsData] = await Promise.all([
      getPurchaseById(purchaseId),
      getProductsByPurchaseId(purchaseId)
    ]);
    setPurchase(purchaseData);
    setProducts(productsData);
  };

  if (!purchase) {
    return (
      <div className="flex justify-center items-center h-64 text-gray-500">
        Cargando detalles de la compra...
      </div>
    );
  }

  // Cálculos principales de la lógica de negocio
  const totalInvestment = products.reduce(
    (acc, product) => acc + product.priceBs * product.units,
    0
  );

  const expectedWholesale = products.reduce(
    (acc, product) => acc + product.wholesalePrice * product.units,
    0
  );

  const expectedRetail = products.reduce(
    (acc, product) => acc + product.sellingPrice * product.units,
    0
  );

  const handleAddProduct = async (productData: Omit<Product, 'id'>) => {
    if (!purchase) return;
    if (editingProduct) {
      const updatedProduct = await updateProduct({ ...productData, id: editingProduct.id } as Product);
      setProducts(products.map(p => p.id === updatedProduct.id ? updatedProduct : p));
      setEditingProduct(undefined);
    } else {
      const newProduct = await addProduct(productData);
      setProducts([...products, newProduct]);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    // Scroll to top to see the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingProduct(undefined);
  };

  const handleDeleteProduct = async (productId: string) => {
    await deleteProduct(productId);
    setProducts(products.filter((p) => p.id !== productId));
  };

  const netProfitWholesale = expectedWholesale - totalInvestment;
  const netProfitRetail = expectedRetail - totalInvestment;

  const totalQuantity = products.reduce((acc, product) => acc + product.units, 0);
  const totalUniqueProducts = products.length;

  const statCards = [
    {
      title: 'Inversión Total',
      value: `Bs. ${totalInvestment.toFixed(2)}`,
      icon: Wallet,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Venta Esperada (x Mayor)',
      value: `Bs. ${expectedWholesale.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      title: 'Ganancia Neta (x Mayor)',
      value: `Bs. ${netProfitWholesale.toFixed(2)}`,
      icon: TrendingUp,
      color: netProfitWholesale >= 0 ? 'text-primary-600' : 'text-red-600',
      bgColor: netProfitWholesale >= 0 ? 'bg-primary-50' : 'bg-red-50',
    },
    {
      title: 'Venta Esperada (Al Detalle)',
      value: `Bs. ${expectedRetail.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      title: 'Ganancia Neta (Al Detalle)',
      value: `Bs. ${netProfitRetail.toFixed(2)}`,
      icon: TrendingUp,
      color: netProfitRetail >= 0 ? 'text-primary-600' : 'text-red-600',
      bgColor: netProfitRetail >= 0 ? 'bg-primary-50' : 'bg-red-50',
    },
    {
      title: 'Productos Únicos',
      value: totalUniqueProducts,
      icon: Package,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Unidades Totales',
      value: totalQuantity,
      icon: Boxes,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-4 border-b border-gray-200 pb-4">
        <Link 
          to="/dashboard"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{purchase.name}</h1>
          <div className="flex gap-4 text-sm text-gray-500 mt-1">
            <span>Fecha: {purchase.date}</span>
          </div>
        </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {statCards.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col items-center justify-center text-center">
            <div className={cn("p-2 rounded-full mb-2", stat.bgColor, stat.color)}>
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium text-gray-500 mb-1 leading-tight">{stat.title}</p>
            <p className={cn("text-sm font-bold", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Lista y Formulario de Productos */}
      <div className="space-y-6 mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Productos</h2>
        </div>
        
        {isAdmin && (
          <div className="mb-8">
            <ProductForm
              purchase={purchase}
              onAdd={handleAddProduct}
              editingProduct={editingProduct}
              onCancelEdit={handleCancelEdit}
            />
          </div>
        )}

        <ProductList 
          products={products} 
          isAdmin={isAdmin} 
          onDelete={handleDeleteProduct}
          onEdit={handleEditProduct}
        />
      </div>
    </div>
  );
}