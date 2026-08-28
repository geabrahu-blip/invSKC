import { useState, useEffect } from 'react';
import { getCatalogConfig, updateCatalogConfig, getInventoryItems, CatalogConfig } from '../services/db';
import { topSkincareBrands } from '../utils/constants';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Settings as SettingsIcon, Save, LayoutTemplate, Tag } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function Settings() {
  const { isAdmin } = useAuth();
  const { success, error } = useToast();
  const [featuredBrands, setFeaturedBrands] = useState<string[]>([]);
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    try {
      setLoading(true);
      // Load current settings
      const config = await getCatalogConfig();
      setFeaturedBrands(config.featuredBrands || []);

      // Load all inventory to extract unique brands
      const items = await getInventoryItems();
      const dbBrands = items.map(p => p.brand).filter(Boolean) as string[];

      // Combine with top brands and make unique
      const uniqueBrands = Array.from(new Set([...topSkincareBrands, ...dbBrands])).sort();
      setAvailableBrands(uniqueBrands);
    } catch (err) {
      console.error("Error loading settings:", err);
      error("Error al cargar la configuración");
    } finally {
      setLoading(false);
    }
  };

  const toggleBrand = (brand: string) => {
    setFeaturedBrands(prev =>
      prev.includes(brand)
        ? prev.filter(b => b !== brand)
        : [...prev, brand]
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const config: CatalogConfig = { featuredBrands };
      await updateCatalogConfig(config);
      success("Configuración guardada exitosamente");
    } catch (err) {
      console.error("Error saving settings:", err);
      error("Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  // Restrict to admins only
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-indigo-600" />
            Configuración del Catálogo
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Administra las preferencias y elementos destacados del catálogo público.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-medium text-gray-900">Carruseles de Inicio (Marcas Destacadas)</h3>
          </div>

          <div className="p-6">
            <p className="text-sm text-gray-600 mb-6">
              Selecciona las marcas que deseas destacar en la página principal del catálogo. Se generará un carrusel por cada marca seleccionada.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {availableBrands.map(brand => {
                const isSelected = featuredBrands.includes(brand);
                return (
                  <label
                    key={brand}
                    className={`
                      relative flex items-center p-4 cursor-pointer rounded-lg border-2 transition-all
                      ${isSelected
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'}
                    `}
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-3">
                      <div className={`
                        flex items-center justify-center w-8 h-8 rounded-full shrink-0
                        ${isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400'}
                      `}>
                        <Tag className="w-4 h-4" />
                      </div>
                      <span className={`block text-sm font-medium truncate ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                        {brand}
                      </span>
                    </div>
                    <div className="ml-4 shrink-0">
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 transition-colors cursor-pointer"
                        checked={isSelected}
                        onChange={() => toggleBrand(brand)}
                      />
                    </div>
                  </label>
                );
              })}
            </div>

            {availableBrands.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No hay marcas disponibles. Agrega productos al inventario primero.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
