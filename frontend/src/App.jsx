import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Welcome from './Welcome.jsx';
import Register from './Register.jsx';
import Login from './Login.jsx';
import FamilyPanel from './FamilyPanel.jsx';
import CalendarView from './CalendarView.jsx';
import ShoppingListView from './ShoppingListView.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import UserProfile from './UserProfile.jsx';
import NavigationBar from './NavigationBar.jsx';
import Setup from './Setup.jsx';

const API_URL = 'http://localhost:8000';

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        setUser(null);
        navigate('/login');
    };

    const fetchUser = async () => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const response = await fetch(`/api/users/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });
                if (response.ok) {
                    const userData = await response.json();
                    setUser(userData);
                } else {
                    localStorage.removeItem('token');
                    setUser(null);
                }
            } catch (error) {
                console.error('Failed to fetch user', error);
                localStorage.removeItem('token');
                setUser(null);
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await fetch(`/api/api/status`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.needs_setup) {
                        navigate('/setup');
                        setLoading(false);
                    } else {
                        fetchUser();
                    }
                } else {
                    fetchUser();
                }
            } catch (error) {
                console.error('Failed to fetch status', error);
                fetchUser();
            }
        };
        checkStatus();
    }, [navigate]);

    const onLogin = () => {
        setLoading(true);
        fetchUser();
        navigate('/family-panel');
    }

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <NavigationBar user={user} onLogout={handleLogout} />
            <Routes>
                <Route path="/setup" element={<Setup />} />
                {!user ? (
                    <>
                        <Route path="/login" element={<Login onLogin={onLogin} />} />
                        <Route path="/register" element={<Register onRegistered={() => navigate('/login')} />} />
                        <Route path="/*" element={<Login onLogin={onLogin} />} />
                    </>
                ) : (
                    <>
                        <Route path="/" element={<Welcome />} />
                        <Route path="/family-panel" element={<FamilyPanel user={user} />} />
                        <Route path="/calendar" element={<CalendarView />} />
                        <Route path="/shopping-list" element={<ShoppingListView />} />
                        <Route path="/profile" element={<UserProfile />} />
                        {user.is_admin && <Route path="/admin" element={<AdminDashboard />} />}
                    </>
                )}
            </Routes>
        </div>
    );
}

export default App;