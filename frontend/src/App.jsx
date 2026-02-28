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
import { Toaster } from 'react-hot-toast';

const API_URL = 'http://localhost:8000';

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
        } catch (e) {
            console.error("Error during logout", e);
        }
        setUser(null);
        navigate('/login');
    };

    const fetchUser = async () => {
        // Check for session (automatic via cookies)
        try {
            const response = await fetch(`/api/users/me`);
            if (response.ok) {
                const userData = await response.json();
                setUser(userData);
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error('Failed to fetch user', error);
            setUser(null);
        }
        setLoading(false);
    };

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const response = await fetch(`/api/status`);
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

    const onLogin = (userData) => {
        setUser(userData);
        navigate('/family-panel');
    }

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <Toaster />
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
                        <Route path="/shopping-list/:listId" element={<ShoppingListView />} />
                        <Route path="/profile" element={<UserProfile />} />
                        {user.is_admin && <Route path="/admin" element={<AdminDashboard />} />}
                    </>
                )}
            </Routes>
        </div>
    );
}

export default App;