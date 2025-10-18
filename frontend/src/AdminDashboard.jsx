import React, { useState } from 'react';
import { Nav } from 'react-bootstrap';
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
    <div className="container mt-3">
      <h1>Admin Dashboard</h1>
      <Nav variant="tabs" defaultActiveKey="users" onSelect={(k) => setActiveTab(k)}>
        <Nav.Item>
          <Nav.Link eventKey="users">User Management</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="families">Family Management</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="products">Product Management</Nav.Link>
        </Nav.Item>
      </Nav>
      <div className="mt-3">
        {renderContent()}
      </div>
    </div>
  );
}

export default AdminDashboard;
