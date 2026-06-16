import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getUsers, updateUser, addUserViaSecondaryApp, deleteUser } from '../services/db';
import { Users as UsersIcon, Plus, Edit2, Trash2, Mail, Key, User as UserIcon, Shield } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function Users() {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { success, error } = useToast();

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsersList(data);
    } catch (err) {
      console.error(err);
      error("Error al cargar los usuarios");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('user');
    setEditingUser(null);
    setIsModalOpen(false);
    setIsSubmitting(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    resetForm();
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setIsModalOpen(true);
  };

  const handleDelete = async (userId: string) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar este usuario? El usuario de autenticación de Firebase no se eliminará automáticamente desde aquí por seguridad, pero perderá acceso al sistema.")) {
      try {
        await deleteUser(userId);
        success("Usuario eliminado de la base de datos");
        await loadUsers();
      } catch (err) {
        console.error(err);
        error("Error al eliminar el usuario");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    try {
      setIsSubmitting(true);

      if (editingUser) {
        // Edit mode (we don't change password or auth email here directly to keep it simple, just metadata)
        const updatedUser: User = {
          ...editingUser,
          name,
          email, // Note: Changing email here doesn't change it in Firebase Auth automatically.
          role
        };
        await updateUser(updatedUser);
        success("Usuario actualizado correctamente");
      } else {
        // Create mode
        if (!password || password.length < 6) {
          error("La contraseña debe tener al menos 6 caracteres");
          setIsSubmitting(false);
          return;
        }

        const newUser: Omit<User, 'id'> = {
          name,
          email,
          role
        };

        await addUserViaSecondaryApp(newUser, password);
        success("Usuario creado exitosamente");
      }

      resetForm();
      await loadUsers();
    } catch (caughtError: unknown) {
      const err = caughtError as { code?: string };
      console.error(err);
      const errCode = err?.code;
      if (errCode === 'auth/email-already-in-use') {
        error("Este correo ya está registrado.");
      } else if (errCode === 'auth/invalid-email') {
        error("El formato del correo es inválido.");
      } else {
        error("Ocurrió un error al procesar el usuario.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UsersIcon className="w-6 h-6 text-indigo-600" />
            Gestión de Usuarios
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Administra los accesos de administradores y ayudantes del sistema.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Usuario
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : usersList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No hay usuarios registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rol
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {usersList.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <span className="text-indigo-600 font-bold text-lg">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {user.role === 'admin' ? 'Administrador' : 'Ayudante (Vendedor)'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-2 rounded-lg transition-colors"
                          title="Editar usuario"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-lg transition-colors"
                          title="Eliminar acceso"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for Create/Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-500/75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                    placeholder="Ej. juan@bodega.com"
                  />
                </div>
                {editingUser && (
                  <p className="mt-1 text-xs text-gray-500">
                    Cambiar el correo aquí no actualiza sus credenciales de inicio de sesión de forma automática.
                  </p>
                )}
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="password"
                      required={!editingUser}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border"
                      placeholder="Mínimo 6 caracteres"
                      minLength={6}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol en el Sistema</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Shield className="h-5 w-5 text-gray-400" />
                  </div>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 border bg-white"
                  >
                    <option value="user">Ayudante (Solo Ventas)</option>
                    <option value="admin">Administrador (Acceso Total)</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
