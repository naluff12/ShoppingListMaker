import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, ListChecks, ShoppingBag } from 'lucide-react';

function Welcome() {
    const [lastLists, setLastLists] = useState([]);
    const [lastProducts, setLastProducts] = useState([]);
    const [families, setFamilies] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [listsRes, productsRes, userRes] = await Promise.all([
                    fetch(`/api/home/last-lists`),
                    fetch(`/api/home/last-products`),
                    fetch(`/api/users/me`)
                ]);

                if (listsRes.ok) {
                    const listsData = await listsRes.json();
                    setLastLists(listsData);
                }

                if (productsRes.ok) {
                    const productsData = await productsRes.json();
                    setLastProducts(productsData);
                }

                if (userRes.ok) {
                    const userData = await userRes.json();
                    setFamilies(userData.families || []);
                }
            } catch (error) {
                console.error("Failed to fetch home data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <div className="text-gradient" style={{ fontSize: '1.5rem', fontWeight: 600 }}>Cargando...</div>
            </div>
        );
    }

    return (
        <div className="app-container animate-fade-in">
            <header style={{ marginBottom: '24px' }}>
                <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '8px' }}>Bienvenido</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                    Aquí tienes un resumen de la actividad reciente en tus familias.
                </p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                
                {/* Familias */}
                <div className="glass-panel">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.2)', borderRadius: '50%', color: 'var(--primary-color)' }}>
                            <Users size={24} />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Mis Familias</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {families.length > 0 ? (
                            families.map(family => (
                                <div key={family.id} style={{ padding: '12px', background: 'rgba(240, 246, 252, 0.05)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                                    <span style={{ fontWeight: 500 }}>{family.nombre}</span>
                                </div>
                            ))
                        ) : (
                            <p style={{ color: 'var(--text-muted)' }}>No perteneces a ninguna familia.</p>
                        )}
                    </div>
                </div>

                {/* Listas */}
                <div className="glass-panel">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '50%', color: 'var(--success-color)' }}>
                            <ListChecks size={24} />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Últimas Listas</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {lastLists.length > 0 ? (
                            lastLists.map(list => (
                                <Link to={`/shopping-list/${list.id}`} key={list.id} style={{ padding: '12px', background: 'rgba(240, 246, 252, 0.05)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{list.name}</span>
                                    <span style={{ fontSize: '0.8rem', padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                                        {new Date(list.list_for_date).toLocaleDateString()}
                                    </span>
                                </Link>
                            ))
                        ) : (
                            <p style={{ color: 'var(--text-muted)' }}>No hay listas recientes.</p>
                        )}
                    </div>
                </div>

                {/* Productos */}
                <div className="glass-panel">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ padding: '8px', background: 'rgba(245, 158, 11, 0.2)', borderRadius: '50%', color: 'var(--warning-color)' }}>
                            <ShoppingBag size={24} />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Últimos Productos</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {lastProducts.length > 0 ? (
                            lastProducts.map(product => (
                                <div key={product.id} style={{ padding: '12px', background: 'rgba(240, 246, 252, 0.05)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
                                    <span style={{ fontWeight: 500 }}>{product.name}</span>
                                </div>
                            ))
                        ) : (
                            <p style={{ color: 'var(--text-muted)' }}>No hay productos recientes.</p>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

export default Welcome;
