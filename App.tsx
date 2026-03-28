import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PurchaseDetail from './pages/PurchaseDetail';
import Stores from './pages/Stores';
import StoreInventory from './pages/StoreInventory';
import SalesReport from './pages/SalesReport';
import Inventory from './pages/Inventory';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/purchases/:id" element={<PurchaseDetail />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/stores" element={<Stores />} />
            <Route path="/pos" element={<StoreInventory />} />
            <Route path="/reports" element={<SalesReport />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;