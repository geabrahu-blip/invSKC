import { useState, useEffect } from 'react';
import { Purchase, Product } from '../types';
import { Image as ImageIcon, Plus, Save, X } from 'lucide-react';

interface ProductFormProps {
  purchase: Purchase;
  onAdd: (product: Omit<Product, 'id'>) => void;
  editingProduct?: Product;
  onCancelEdit?: () => void;
}

export default function ProductForm({ purchase, onAdd, editingProduct, onCancelEdit }: ProductFormProps) {
  const [image, setImage] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [gender, setGender] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [priceBs, setPriceBs] = useState<number | ''>('');
  const [units, setUnits] = useState<number | ''>('');
  const [wholesalePrice, setWholesalePrice] = useState<number | ''>('');
  const [sellingPrice, setSellingPrice] = useState<number | ''>('');

  useEffect(() => {
    if (editingProduct) {
      setImage(editingProduct.image || '');
      setName(editingProduct.name);
      setBrand(editingProduct.brand || '');
      setCategory(editingProduct.category || '');
      setGender(editingProduct.gender || '');
      setExpirationDate(editingProduct.expirationDate || '');
      setPriceBs(editingProduct.priceBs);
      setUnits(editingProduct.units);
      setWholesalePrice(editingProduct.wholesalePrice);
      setSellingPrice(editingProduct.sellingPrice);
    } else {
      resetForm();
    }
  }, [editingProduct]);

  const resetForm = () => {
    setImage('');
    setName('');
    setBrand('');
    setCategory('');
    setGender('');
    setExpirationDate('');
    setPriceBs('');
    setUnits('');
    setWholesalePrice('');
    setSellingPrice('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || priceBs === '' || units === '' || wholesalePrice === '' || sellingPrice === '') return;

    const totalPrice = Number(priceBs) * Number(units);

    onAdd({
      purchaseId: purchase.id,
      name,
      brand,
      category,
      gender,
      expirationDate: expirationDate || undefined,
      image,
      priceBs: Number(priceBs),
      units: Number(units),
      wholesalePrice: Number(wholesalePrice),
      sellingPrice: Number(sellingPrice),
      totalPrice,
    });

    resetForm();
  };

  const currentTotal = priceBs !== '' && units !== ''
    ? (Number(priceBs) * Number(units)).toFixed(2)
    : '0.00';

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
        {editingProduct ? (
          <>
            <Save className="h-5 w-5 text-blue-600" />
            Editar Producto
          </>
        ) : (
          <>
            <Plus className="h-5 w-5 text-primary-600" />
            Agregar Nuevo Producto
          </>
        )}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Imagen */}
        <div className="col-span-1 md:col-span-2 lg:col-span-4 flex gap-4 items-start">
          <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
            {image ? (
              <img src={image} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="h-8 w-8 text-gray-400" />
            )}
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Imagen del Producto</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
          </div>
        </div>

        {/* Nombre, Marca, Categoría */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2">
          <label htmlFor="prod-name" className="block text-sm font-medium text-gray-700 mb-1">Nombre del Producto</label>
          <input
            id="prod-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="col-span-1">
          <label htmlFor="prod-brand" className="block text-sm font-medium text-gray-700 mb-1">Marca (Opcional)</label>
          <input
            id="prod-brand"
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Ej. Carolina Herrera"
          />
        </div>

        <div className="col-span-1">
          <label htmlFor="prod-category" className="block text-sm font-medium text-gray-700 mb-1">Categoría (Opcional)</label>
          <input
            id="prod-category"
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Ej. EDP, EDT, Splash"
          />
        </div>

        <div className="col-span-1">
          <label htmlFor="prod-gender" className="block text-sm font-medium text-gray-700 mb-1">Público / Género</label>
          <select
            id="prod-gender"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Seleccionar...</option>
            <option value="Mujer">Mujer</option>
            <option value="Varón">Varón</option>
            <option value="Unisex">Unisex</option>
            <option value="Bebé">Bebé</option>
          </select>
        </div>

        <div className="col-span-1">
          <label htmlFor="prod-expiration" className="block text-sm font-medium text-gray-700 mb-1">Vencimiento (Opcional)</label>
          <input
            id="prod-expiration"
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-700"
          />
        </div>

        <div className="col-span-1 md:col-span-2 lg:col-span-4 grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-gray-100">
          <div className="col-span-1">
            <label htmlFor="prod-units" className="block text-sm font-medium text-gray-700 mb-1">Unidades</label>
            <input
              id="prod-units"
              type="number"
              min="1"
              required
              value={units}
              onChange={(e) => setUnits(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Precios de Entrada */}
          <div className="col-span-1">
            <label htmlFor="prod-price-bs" className="block text-sm font-medium text-gray-700 mb-1">Precio Compra (Bs)</label>
            <input
              id="prod-price-bs"
              type="number"
              step="0.01"
              required
              value={priceBs}
              onChange={(e) => setPriceBs(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Precios de Salida */}
          <div className="col-span-1">
            <label htmlFor="prod-price-mayor" className="block text-sm font-medium text-gray-700 mb-1">Precio x Mayor</label>
            <input
              id="prod-price-mayor"
              type="number"
              step="0.01"
              required
              value={wholesalePrice}
              onChange={(e) => setWholesalePrice(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="col-span-1">
            <label htmlFor="prod-price-unidad" className="block text-sm font-medium text-gray-700 mb-1">Precio Unidad</label>
            <input
              id="prod-price-unidad"
              type="number"
              step="0.01"
              required
              value={sellingPrice}
              onChange={(e) => setSellingPrice(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="text-sm">
          <span className="text-gray-500">Costo Total del Lote: </span>
          <span className="text-lg font-bold text-gray-900">Bs. {currentTotal}</span>
        </div>

        <div className="flex gap-2">
          {editingProduct && onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
          )}
          <button
            type="submit"
            className={`px-6 py-2 rounded-lg font-medium transition-colors text-white ${editingProduct ? 'bg-blue-600 hover:bg-blue-700' : 'bg-primary-600 hover:bg-primary-700'}`}
          >
            {editingProduct ? 'Actualizar Producto' : 'Guardar Producto'}
          </button>
        </div>
      </div>
    </form>
  );
}