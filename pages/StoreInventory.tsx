import { useState, useEffect } from 'react';
import { Store, InventoryItem, SaleItem } from '../types';
import { getStores, getInventoryItems, addSale, updateInventoryItem } from '../services/db';
import { Store as StoreIcon, AlertTriangle, ShoppingCart, CreditCard, QrCode, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const StoreInventory = () => {
  const { user, isAdmin } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // POS State
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [clientName, setClientName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'QR'>('Cash');

  useEffect(() => {
    loadStores();
  }, []);

  useEffect(() => {
    if (selectedStoreId) {
      loadProducts(selectedStoreId);
    } else {
      setProducts([]);
    }
  }, [selectedStoreId]);

  const loadStores = async () => {
    const data = await getStores();
    const allStores = [{ id: 'bodega', name: 'Bodega Central' }, ...data];

    if (!isAdmin && user?.storeId) {
      // User is assigned to a specific store
      const userStore = allStores.filter(s => s.id === user.storeId);
      setStores(userStore);
      setSelectedStoreId(user.storeId);
    } else {
      // Admin sees all
      setStores(allStores);
      if (!selectedStoreId) {
        setSelectedStoreId('bodega');
      }
    }
  };

  const loadProducts = async (storeId: string) => {
    const allProducts = await getInventoryItems();
    const storeProducts = allProducts.filter(p => p.storeId === storeId);
    setProducts(storeProducts);
  };

  const addToCart = (product: InventoryItem) => {
    if (product.units <= 0) {
      alert('No hay stock disponible para este producto en esta sucursal.');
      return;
    }

    const existingItem = cart.find(item => item.productId === product.id);
    if (existingItem) {
      if (existingItem.quantity >= product.units) {
        alert('No puedes agregar más unidades de las disponibles en stock.');
        return;
      }
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        price: product.sellingPrice,
        quantity: 1,
        subtotal: product.sellingPrice
      }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!clientName.trim()) {
      alert('Por favor, ingresa el nombre del cliente.');
      return;
    }

    try {
      // 1. Create Sale Record
      await addSale({
        storeId: selectedStoreId,
        clientName,
        items: cart,
        total: cartTotal,
        paymentMethod,
        date: new Date().toISOString()
      });

      // 2. Update Product Inventory (Deduct stock)
      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          await updateInventoryItem({
            ...product,
            units: product.units - item.quantity
          });
        }
      }

      // 3. Reset POS state
      setCart([]);
      setClientName('');
      alert('Venta registrada con éxito!');

      // Reload products to show updated stock
      loadProducts(selectedStoreId);

    } catch (error) {
      console.error('Error procesando venta:', error);
      alert('Ocurrió un error al procesar la venta.');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
      {/* Products Section */}
      <div className="flex-1 flex flex-col space-y-4">
        <div className="bg-white p-4 rounded-lg shadow flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-xl font-bold flex items-center gap-2 w-full sm:w-auto">
            <StoreIcon className="w-6 h-6 text-indigo-600" />
            Punto de Venta
          </h1>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              disabled={!isAdmin} // Lock for regular users
              className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 w-full sm:w-auto disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="" disabled>Selecciona una sucursal</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 bg-white p-4 rounded-lg shadow overflow-y-auto">
          {selectedStoreId ? (
            products.filter(p =>
              p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
              (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
              (p.gender && p.gender.toLowerCase().includes(searchTerm.toLowerCase()))
            ).length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.filter(p =>
                  p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
                  (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
                  (p.gender && p.gender.toLowerCase().includes(searchTerm.toLowerCase()))
                ).map(product => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="border rounded-lg p-3 cursor-pointer hover:border-indigo-500 hover:shadow-md transition-all flex flex-col h-full"
                  >
                    <div className="h-32 bg-gray-100 rounded-md mb-2 overflow-hidden flex items-center justify-center">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-400">Sin Imagen</span>
                      )}
                    </div>
                    <h3 className="font-medium text-sm line-clamp-2 flex-1">{product.name}</h3>
                    {product.gender && (
                      <span className="text-[10px] uppercase bg-indigo-50 text-indigo-600 px-1 rounded-sm w-fit mt-1">
                        {product.gender}
                      </span>
                    )}
                    <div className="mt-2 flex justify-between items-end">
                      <span className="font-bold text-indigo-600">Bs. {product.sellingPrice}</span>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        product.units > 5 ? 'bg-green-100 text-green-800' :
                        product.units > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                      }`}>
                        Stock: {product.units}
                      </span>
                    </div>
                    {product.units <= 5 && product.units > 0 && (
                      <div className="mt-2 flex items-center text-xs text-yellow-600">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Poco stock
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                Esta sucursal no tiene inventario asignado.
              </div>
            )
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              Selecciona una sucursal para ver los productos.
            </div>
          )}
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-full lg:w-[400px] bg-white rounded-lg shadow flex flex-col h-full">
        <div className="p-4 border-b flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-bold">Carrito de Venta</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.map((item, index) => (
            <div key={index} className="flex justify-between items-center border-b pb-2">
              <div className="flex-1">
                <p className="font-medium text-sm line-clamp-1">{item.name}</p>
                <p className="text-xs text-gray-500">{item.quantity} x Bs. {item.price}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm">Bs. {item.subtotal}</span>
                <button
                  onClick={() => removeFromCart(item.productId)}
                  className="text-red-500 hover:text-red-700 text-sm font-bold"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              El carrito está vacío
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nombre del cliente"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPaymentMethod('Cash')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 border rounded-md ${
                  paymentMethod === 'Cash' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white hover:bg-gray-50'
                }`}
              >
                <CreditCard className="w-4 h-4" /> Efectivo
              </button>
              <button
                onClick={() => setPaymentMethod('QR')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 border rounded-md ${
                  paymentMethod === 'QR' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white hover:bg-gray-50'
                }`}
              >
                <QrCode className="w-4 h-4" /> QR
              </button>
            </div>
          </div>

          <div className="pt-2 border-t flex justify-between items-center mb-4">
            <span className="font-bold text-lg">Total a Pagar:</span>
            <span className="font-bold text-2xl text-indigo-600">Bs. {cartTotal.toFixed(2)}</span>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${
              cart.length > 0 ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            Confirmar Venta
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoreInventory;
