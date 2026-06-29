import { topSkincareBrands, topSkincareCategories } from "../utils/constants";
import { useState, useEffect, useRef } from 'react';
import { Purchase, Product, InventoryItem } from '../types';
import { Image as ImageIcon, Plus, Save, X, ChevronDown, ChevronUp } from 'lucide-react';
import { getInventoryItems } from '../services/db';
import { useAuth } from '../context/AuthContext';

interface ProductFormProps {
  purchase: Purchase;
  onAdd: (product: Omit<Product, 'id'>) => void;
  editingProduct?: Product;
  onCancelEdit?: () => void;
}

export default function ProductForm({ purchase, onAdd, editingProduct, onCancelEdit }: ProductFormProps) {
  const { isAdmin } = useAuth();
  const [image, setImage] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [presentation, setPresentation] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [sku, setSku] = useState('');
  const [priceBs, setPriceBs] = useState<number | ''>('');
  const [units, setUnits] = useState<number | ''>('');
  const [wholesalePrice, setWholesalePrice] = useState<number | ''>('');
  const [sellingPrice, setSellingPrice] = useState<number | ''>('');
  const [comparePrice, setComparePrice] = useState<number | ''>('');
  const [minStock, setMinStock] = useState<number | ''>('');
  const [showInCatalog, setShowInCatalog] = useState<boolean>(true);

  // Skincare Specific Fields
  const [skinType, setSkinType] = useState('');
  const [benefits, setBenefits] = useState('');
  const [keyIngredients, setKeyIngredients] = useState('');
  const [usage, setUsage] = useState('');
  const [smartPasteText, setSmartPasteText] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  const [existingItems, setExistingItems] = useState<InventoryItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadItems = async () => {
      const items = await getInventoryItems();
      setExistingItems(items);
    };
    loadItems();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (editingProduct) {
      setImage(editingProduct.image || '');
      setName(editingProduct.name);
      setBrand(editingProduct.brand || '');
      setCategory(editingProduct.category || '');
      setPresentation(editingProduct.presentation || '');
      setExpirationDate(editingProduct.expirationDate || '');
      setSku(editingProduct.sku || '');
      setPriceBs(editingProduct.priceBs);
      setUnits(editingProduct.units);
      setWholesalePrice(editingProduct.wholesalePrice);
      setSellingPrice(editingProduct.sellingPrice);
      setComparePrice(editingProduct.comparePrice ?? '');
      setMinStock(editingProduct.minStock ?? '');
      setShowInCatalog(editingProduct.showInCatalog ?? true);
      setSkinType(editingProduct.skinType || '');
      setBenefits(editingProduct.benefits || '');
      setKeyIngredients(editingProduct.keyIngredients || '');
      setUsage(editingProduct.usage || '');
    } else {
      resetForm();
    }
  }, [editingProduct]);

  const resetForm = () => {
    setImage('');
    setName('');
    setBrand('');
    setCategory('');
    setPresentation('');
    setExpirationDate('');
    setSku('');
    setPriceBs('');
    setUnits('');
    setWholesalePrice('');
    setSellingPrice('');
    setComparePrice('');
    setMinStock('');
    setShowInCatalog(true);
    setSkinType('');
    setBenefits('');
    setKeyIngredients('');
    setUsage('');
    setSmartPasteText('');
  };

  const handleSuggestionSelect = (item: InventoryItem) => {
    setName(item.name);
    setBrand(item.brand || '');
    setCategory(item.category || '');
    setPresentation(item.presentation || '');
    setSku(item.sku || '');
    setPriceBs(item.priceBs);
    setWholesalePrice(item.wholesalePrice);
    setSellingPrice(item.sellingPrice);
    if (item.comparePrice !== undefined) setComparePrice(item.comparePrice);
    if (item.minStock !== undefined) setMinStock(item.minStock);
    if (item.showInCatalog !== undefined) setShowInCatalog(item.showInCatalog);
    if (item.image) setImage(item.image);
    setSkinType(item.skinType || '');
    setBenefits(item.benefits || '');
    setKeyIngredients(item.keyIngredients || '');
    setUsage(item.usage || '');
    setShowSuggestions(false);
  };

  const handleSmartPaste = (text: string) => {
    setSmartPasteText(text);

    const skinTypeMatch = text.match(/\*?\*?Tipo de piel:\*?\*?\s*(.*?)(?=\*?\*?Beneficios:|\*?\*?Ingredientes clave:|\*?\*?Modo de uso:|$)/is);
    if (skinTypeMatch && skinTypeMatch[1]) setSkinType(skinTypeMatch[1].trim());

    const benefitsMatch = text.match(/\*?\*?Beneficios:\*?\*?\s*(.*?)(?=\*?\*?Tipo de piel:|\*?\*?Ingredientes clave:|\*?\*?Modo de uso:|$)/is);
    if (benefitsMatch && benefitsMatch[1]) setBenefits(benefitsMatch[1].trim());

    const ingredientsMatch = text.match(/\*?\*?Ingredientes clave:\*?\*?\s*(.*?)(?=\*?\*?Tipo de piel:|\*?\*?Beneficios:|\*?\*?Modo de uso:|$)/is);
    if (ingredientsMatch && ingredientsMatch[1]) setKeyIngredients(ingredientsMatch[1].trim());

    const usageMatch = text.match(/\*?\*?Modo de uso:\*?\*?\s*(.*?)(?=\*?\*?Tipo de piel:|\*?\*?Beneficios:|\*?\*?Ingredientes clave:|$)/is);
    if (usageMatch && usageMatch[1]) setUsage(usageMatch[1].trim());
  };


  const uniqueBrands = Array.from(new Set([
    ...topSkincareBrands,
    ...existingItems.map(i => i.brand).filter(Boolean) as string[]
  ]));

  const uniqueCategories = Array.from(new Set([
    ...topSkincareCategories,
    ...existingItems.map(i => i.category).filter(Boolean) as string[]
  ]));

  const filteredSuggestions = name.length > 1
    ? existingItems.filter(i => i.name.toLowerCase().includes(name.toLowerCase()) || (i.sku && i.sku.includes(name)))
    : [];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Image compression logic
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; // Optimal size for catalog viewing
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress to webp format, 0.7 quality
          const compressedDataUrl = canvas.toDataURL('image/webp', 0.7);
          setImage(compressedDataUrl);
        } else {
          // Fallback if canvas fails
          setImage(reader.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalPriceBs = isAdmin ? priceBs : 0;
    const finalWholesalePrice = isAdmin ? wholesalePrice : 0;
    const finalUnits = isAdmin ? units : 0;
    const finalMinStock = isAdmin ? minStock : 0;

    // Remove finalUnits and finalPriceBs from the strict validation if not admin
    if (!name || sellingPrice === '') {
      alert("Por favor, asegúrate de llenar todos los campos requeridos.");
      return;
    }

    if (isAdmin && (finalPriceBs === '' || finalUnits === '' || finalWholesalePrice === '')) {
      alert("Por favor, asegúrate de llenar todos los campos requeridos con valores numéricos válidos.");
      return;
    }

    const totalPrice = Number(finalPriceBs) * Number(finalUnits);

    onAdd({
      purchaseId: purchase.id,
      name,
      brand,
      category,
      presentation: presentation || undefined,
      expirationDate: expirationDate || undefined,
      sku: sku || undefined,
      image: image ? image.trim() : '',
      priceBs: Number(finalPriceBs),
      units: Number(finalUnits),
      wholesalePrice: Number(finalWholesalePrice),
      sellingPrice: Number(sellingPrice),
      comparePrice: comparePrice !== '' && !isNaN(Number(comparePrice)) ? Number(comparePrice) : undefined,
      totalPrice,
      minStock: finalMinStock !== '' ? Number(finalMinStock) : undefined,
      showInCatalog,
      skinType: skinType || undefined,
      benefits: benefits || undefined,
      keyIngredients: keyIngredients || undefined,
      usage: usage || undefined,
    });

    resetForm();
  };

  const currentTotal = priceBs !== '' && units !== ''
    ? (Number(priceBs) * Number(units)).toFixed(2)
    : '0.00';

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <h2 className="text-md font-semibold text-gray-900 flex items-center gap-2">
        {editingProduct ? (
          <>
            <Save className="h-4 w-4 text-blue-600" />
            Editar Producto
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 text-primary-600" />
            Agregar Nuevo Producto
          </>
        )}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Imagen */}
        <div className="col-span-1 md:col-span-2 lg:col-span-4 flex gap-3 items-start">
          <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
            {image ? (
              <img
                src={image}
                alt="Preview"
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <ImageIcon className="h-6 w-6 text-gray-400" />
            )}
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-0.5">Imagen del Producto</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
          </div>
        </div>

        {/* Código de Barras / SKU */}
        <div className="col-span-1 md:col-span-2 lg:col-span-1">
          <label htmlFor="prod-sku" className="block text-xs font-medium text-gray-700 mb-0.5">Código (SKU/Balanza)</label>
          <input
            id="prod-sku"
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-indigo-50"
            placeholder="Ej. CERA-100"
          />
        </div>

        {/* Nombre, Marca, Categoría */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3 relative" ref={suggestionRef}>
          <label htmlFor="prod-name" className="block text-xs font-medium text-gray-700 mb-0.5">Nombre del Producto</label>
          <input
            id="prod-name"
            type="text"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Ej. Effaclar Gel Purificante Moussant"
          />
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-y-auto">
              <ul className="py-1">
                {filteredSuggestions.map(item => (
                  <li
                    key={item.id}
                    onClick={() => handleSuggestionSelect(item)}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.brand} - {item.presentation}</p>
                    </div>
                    <span className="text-xs text-emerald-600 font-medium">Últ. Costo: Bs. {item.priceBs}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="col-span-1">
          <label htmlFor="prod-brand" className="block text-xs font-medium text-gray-700 mb-0.5">Marca (Opcional)</label>
          <input
            id="prod-brand"
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            list="brands-list"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Ej. La Roche-Posay"
          />
          <datalist id="brands-list">
            {uniqueBrands.map((b, i) => <option key={i} value={b} />)}
          </datalist>
        </div>

        <div className="col-span-1 md:col-span-2">
          <label htmlFor="prod-category" className="block text-xs font-medium text-gray-700 mb-0.5">Categoría Skincare</label>
          <input
            id="prod-category"
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            list="categories-list"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Ej. Sérums / Tratamientos"
          />
          <datalist id="categories-list">
            {uniqueCategories.map((c, i) => <option key={i} value={c} />)}
          </datalist>
        </div>

        <div className="col-span-1">
          <label htmlFor="prod-presentation" className="block text-xs font-medium text-gray-700 mb-0.5">Presentación (ml/g)</label>
          <input
            id="prod-presentation"
            type="text"
            value={presentation}
            onChange={(e) => setPresentation(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Ej. 236ml, 50g"
          />
        </div>

        <div className="col-span-1">
          <label htmlFor="prod-expiration" className="block text-xs font-medium text-gray-700 mb-0.5">Vencimiento (Opcional)</label>
          <input
            id="prod-expiration"
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-700"
          />
        </div>

        {isAdmin && (
          <div className="col-span-1">
            <label htmlFor="prod-min-stock" className="block text-xs font-medium text-gray-700 mb-0.5">Stock Mínimo (Alerta)</label>
            <input
              id="prod-min-stock"
              type="number"
              min="0"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value !== '' ? Number(e.target.value) : '')}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-orange-50"
              placeholder="Ej. 5"
            />
          </div>
        )}

        <div className="col-span-1 md:col-span-2 lg:col-span-4 grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 mt-1 border-t border-gray-100">
          {isAdmin && (
            <div className="col-span-1">
              <label htmlFor="prod-units" className="block text-xs font-medium text-gray-700 mb-0.5">Unidades</label>
              <input
                id="prod-units"
                type="number"
                min="1"
                required={isAdmin}
                value={units}
                onChange={(e) => setUnits(Number(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          {/* Precios de Entrada */}
          {isAdmin && (
            <div className="col-span-1">
              <label htmlFor="prod-price-bs" className="block text-xs font-medium text-gray-700 mb-0.5">Costo (Bs)</label>
              <input
                id="prod-price-bs"
                type="number"
                step="0.01"
                required={isAdmin}
                value={priceBs}
                onChange={(e) => setPriceBs(Number(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          {/* Precios de Salida */}
          {isAdmin && (
            <div className="col-span-1">
              <label htmlFor="prod-price-mayor" className="block text-xs font-medium text-gray-700 mb-0.5">Precio x Mayor</label>
              <input
                id="prod-price-mayor"
                type="number"
                step="0.01"
                required={isAdmin}
                value={wholesalePrice}
                onChange={(e) => setWholesalePrice(Number(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          <div className="col-span-1">
            <label htmlFor="prod-compare-price" className="block text-xs font-medium text-gray-700 mb-0.5">Precio Antes</label>
            <input
              id="prod-compare-price"
              type="number"
              step="0.01"
              value={comparePrice}
              onChange={(e) => setComparePrice(e.target.value !== '' && !isNaN(Number(e.target.value)) ? Number(e.target.value) : '')}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-500 line-through decoration-gray-400"
              placeholder="Ej. 150.00"
            />
          </div>

          <div className="col-span-1">
            <label htmlFor="prod-price-unidad" className="block text-xs font-medium text-gray-700 mb-0.5">Precio Venta</label>
            <input
              id="prod-price-unidad"
              type="number"
              step="0.01"
              required
              value={sellingPrice}
              onChange={(e) => setSellingPrice(Number(e.target.value))}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700"
            />
          </div>
        </div>
      </div>

      {/* Detalles del Catálogo (Skincare) */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="smart-paste" className="block text-sm font-medium text-purple-700 flex items-center gap-1">
            ✨ Pegado Rápido Gemini
          </label>
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs font-medium text-purple-600 hover:text-purple-800 flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-md"
          >
            {showDetails ? (
              <>Ocultar detalles <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>Editar detalles <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        </div>
        <textarea
          id="smart-paste"
          rows={2}
          value={smartPasteText}
          onChange={(e) => handleSmartPaste(e.target.value)}
          className="w-full px-2 py-1.5 border border-purple-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 bg-purple-50 text-sm mb-2"
          placeholder="Pega aquí el texto generado por Gemini..."
        />

        {showDetails && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="col-span-1">
              <label htmlFor="prod-skin-type" className="block text-xs font-medium text-gray-700 mb-0.5">Tipo de Piel</label>
              <input
                id="prod-skin-type"
                type="text"
                value={skinType}
                onChange={(e) => setSkinType(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Ej. Mixta a grasa"
              />
            </div>
            <div className="col-span-1">
              <label htmlFor="prod-benefits" className="block text-xs font-medium text-gray-700 mb-0.5">Beneficios</label>
              <input
                id="prod-benefits"
                type="text"
                value={benefits}
                onChange={(e) => setBenefits(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Ej. Controla el sebo y reduce imperfecciones"
              />
            </div>
            <div className="col-span-1">
              <label htmlFor="prod-ingredients" className="block text-xs font-medium text-gray-700 mb-0.5">Ingredientes Clave</label>
              <input
                id="prod-ingredients"
                type="text"
                value={keyIngredients}
                onChange={(e) => setKeyIngredients(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Ej. Ácido Salicílico, Zinc"
              />
            </div>
            <div className="col-span-1">
              <label htmlFor="prod-usage" className="block text-xs font-medium text-gray-700 mb-0.5">Modo de Uso</label>
              <input
                id="prod-usage"
                type="text"
                value={usage}
                onChange={(e) => setUsage(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Ej. Aplicar mañana y noche sobre el rostro húmedo"
              />
            </div>
          </div>
        )}
      </div>

      {/* Switch: Mostrar en Catálogo */}
      <div className="flex items-center pt-3 border-t border-gray-100">
        <label className="flex items-center cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={showInCatalog}
              onChange={(e) => setShowInCatalog(e.target.checked)}
            />
            <div className={`block w-8 h-5 rounded-full transition-colors ${showInCatalog ? 'bg-primary-500' : 'bg-gray-300'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${showInCatalog ? 'transform translate-x-3' : ''}`}></div>
          </div>
          <div className="ml-2 text-xs font-medium text-gray-700">
            Mostrar en Catálogo Público
          </div>
        </label>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="text-xs">
          {isAdmin && (
            <>
              <span className="text-gray-500">Costo Total Lote: </span>
              <span className="text-sm font-bold text-gray-900">Bs. {currentTotal}</span>
            </>
          )}
        </div>

        <div className="flex gap-2">
          {editingProduct && onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Cancelar
            </button>
          )}
          <button
            type="submit"
            className={`px-4 py-1.5 text-xs rounded-md font-medium transition-colors text-white ${editingProduct ? 'bg-blue-600 hover:bg-blue-700' : 'bg-primary-600 hover:bg-primary-700'}`}
          >
            {editingProduct ? 'Actualizar' : 'Guardar'}
          </button>
        </div>
      </div>
    </form>
  );
}