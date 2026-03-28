import React, { useState, useEffect } from 'react';
import { Store, User } from '../types';
import { getStores, addStore, deleteStore, getUsers, deleteUser, clearAllData } from '../services/db';
import { MapPin, Plus, Trash2, User as UserIcon, Shield, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Stores = () => {
  const { logout } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Store form
  const [storeName, setStoreName] = useState('');
  const [location, setLocation] = useState('');

  // User form
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [assignedStoreId, setAssignedStoreId] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [storesData, usersData] = await Promise.all([getStores(), getUsers()]);
    setStores(storesData);
    setUsers(usersData);
  };

  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) return;

    await addStore({ name: storeName, location });
    setStoreName('');
    setLocation('');
    loadData();
  };

  const handleDeleteStore = async (id: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta sucursal?')) {
      await deleteStore(id);
      loadData();
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim() || !email.trim() || !password.trim()) return;

    alert('Para crear un usuario en Firebase con este panel, debes usar la Consola de Firebase -> Authentication. Solo lectura disponible en el dashboard por ahora.');
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      await deleteUser(id);
      loadData();
    }
  };

  const getStoreName = (storeId?: string) => {
    if (!storeId) return 'Ninguna / Todas';
    if (storeId === 'bodega') return 'Bodega Central';
    const store = stores.find(s => s.id === storeId);
    return store ? store.name : 'Desconocida';
  };

  const handleClearData = async () => {
    const pass = prompt('¡PELIGRO! Esto borrará todas las compras, ventas, productos, tiendas y usuarios.\n\nEscribe "BORRAR TODO" para confirmar:');
    if (pass === 'BORRAR TODO') {
      await clearAllData();
      alert('Base de datos reiniciada. Serás desconectado.');
      logout();
    } else if (pass !== null) {
      alert('Texto incorrecto. No se borró nada.');
    }
  };

  return (
    <div className="space-y-8">
      {/* SECCION PELIGRO */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-red-800">
          <AlertTriangle className="w-8 h-8 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-lg">Zona de Peligro: Restablecer Sistema</h3>
            <p className="text-sm">Elimina todos los datos de pruebas (compras, ventas, inventario) para empezar de cero.</p>
          </div>
        </div>
        <button
          onClick={handleClearData}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium whitespace-nowrap transition-colors"
        >
          Borrar Toda la Base de Datos
        </button>
      </div>

      {/* SECCION TIENDAS */}
      <section className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Sucursales</h1>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium mb-4">Añadir Nueva Sucursal</h2>
          <form onSubmit={handleAddStore} className="flex gap-4 flex-wrap sm:flex-nowrap">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Nombre de la sucursal"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Ubicación (opcional)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="w-5 h-5 mr-1" /> Añadir
            </button>
          </form>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium mb-4">Sucursales Actuales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stores.map((store) => (
              <div key={store.id} className="border border-gray-200 rounded-lg p-4 flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-900">{store.name}</h3>
                  {store.location && (
                    <p className="text-sm text-gray-500 flex items-center mt-1">
                      <MapPin className="w-4 h-4 mr-1" />
                      {store.location}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteStore(store.id)}
                  className="text-red-600 hover:text-red-900 p-1"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
            {stores.length === 0 && (
              <p className="text-gray-500 col-span-full">No hay sucursales registradas aún.</p>
            )}
          </div>
        </div>
      </section>

      <hr className="border-gray-200" />

      {/* SECCION USUARIOS */}
      <section className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios (Firebase)</h1>

        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg">
          <strong>Nota:</strong> Ahora que el sistema usa Firebase, la creación de nuevos usuarios debe realizarse desde la <strong>Consola de Firebase (Authentication)</strong> para mayor seguridad.
        </div>

        <div className="bg-white p-6 rounded-lg shadow opacity-50 pointer-events-none">
          <h2 className="text-lg font-medium mb-4">Añadir Nuevo Usuario (Deshabilitado)</h2>
          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
              <input
                type="text"
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico (Login)</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="user">Vendedor (Acceso Limitado)</option>
                <option value="admin">Administrador Maestro</option>
              </select>
            </div>

            {role === 'user' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Sucursal Asignada</label>
                <select
                  required
                  value={assignedStoreId}
                  onChange={(e) => setAssignedStoreId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="" disabled>Seleccione una sucursal para este vendedor</option>
                  <option value="bodega">Bodega Central</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                className="inline-flex justify-center items-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Crear Usuario
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium mb-4">Usuarios Registrados</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3">Nombre</th>
                  <th className="px-6 py-3">Correo Electrónico</th>
                  <th className="px-6 py-3">Rol</th>
                  <th className="px-6 py-3">Sucursal Asignada</th>
                  <th className="px-6 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-gray-400" />
                      {user.name}
                    </td>
                    <td className="px-6 py-4">{user.email}</td>
                    <td className="px-6 py-4">
                      {user.role === 'admin' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <Shield className="w-3 h-3 mr-1" /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Vendedor
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {getStoreName(user.storeId)}
                    </td>
                    <td className="px-6 py-4">
                      {user.role !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Stores;
