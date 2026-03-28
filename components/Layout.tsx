import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Package, Store, ShoppingCart, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Package className="h-6 w-6 text-primary-600" />
              <Link to="/" className="text-xl font-bold text-gray-900">
                Inventario
              </Link>
            </div>

            {/* Nav Links */}
            <nav className="hidden md:flex space-x-4">
              {isAdmin && (
                <>
                  <Link
                    to="/dashboard"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/dashboard') ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    Compras
                  </Link>
                  <Link
                    to="/inventory"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive('/inventory') ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    Inventario General
                  </Link>
                </>
              )}
              <Link
                to="/pos"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${isActive('/pos') ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <ShoppingCart className="w-4 h-4" /> POS
              </Link>
              {isAdmin && (
                <>
                  <Link
                    to="/stores"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${isActive('/stores') ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <Store className="w-4 h-4" /> Tiendas y Usuarios
                  </Link>
                  <Link
                    to="/reports"
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${isActive('/reports') ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <FileText className="w-4 h-4" /> Reportes
                  </Link>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col text-right">
              <span className="text-sm font-medium text-gray-900">{user.name}</span>
              <span className="text-xs text-gray-500 capitalize">{user.role === 'admin' ? 'Admin' : 'Vendedor'}</span>
            </div>
            {!isAdmin && (
              <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                <Store className="w-3 h-3" />
                Sucursal Asignada
              </div>
            )}
            <button
              onClick={logout}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}