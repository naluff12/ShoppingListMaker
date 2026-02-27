import React, { useState } from 'react';
import { Users, Home, Package } from 'lucide-react';
import UserManagement from './UserManagement';
import FamilyManagement from './FamilyManagement';
import ProductManagement from './ProductManagement';

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('users');

  const renderContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagement />;
      case 'families':
        return <FamilyManagement />;
      case 'products':
        return <ProductManagement />;
      default:
        return <UserManagement />;
    }
  };

  return (
    <div className="app-container animate-fade-in" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 className="text-gradient" style={{ marginBottom: '32px', textAlign: 'center' }}>Panel de Administración</h1>
      
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
        <button 
            className={`btn-premium ${activeTab === 'users' ? 'btn-primary' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('users')}
        >
            <Users size={18} /> Gestión de Usuarios
        </button>
        <button 
            className={`btn-premium ${activeTab === 'families' ? 'btn-primary' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('families')}
        >
            <Home size={18} /> Gestión de Familias
        </button>
        <button 
            className={`btn-premium ${activeTab === 'products' ? 'btn-primary' : ''}`}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab('products')}
        >
            <Package size={18} /> Gestión de Productos
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '24px' }}>
        {renderContent()}
      </div>
    </div>
  );
}

export default AdminDashboard;
