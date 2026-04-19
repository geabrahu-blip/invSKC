import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';

// Lazy loading pages for faster initial load
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PurchaseDetail = lazy(() => import('./pages/PurchaseDetail'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Catalog = lazy(() => import('./pages/Catalog'));

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-pulse flex flex-col items-center"><div className="h-12 w-12 bg-indigo-200 rounded-full mb-4"></div><div className="h-4 w-32 bg-indigo-100 rounded"></div></div></div>}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/purchases/:id" element={<PurchaseDetail />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/catalog" element={<Catalog />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;