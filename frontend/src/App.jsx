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
import axios from 'axios';

const API_URL = 'http://localhost:8000';

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}


function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (user) { // Only run if user is logged in
            if ('serviceWorker' in navigator && 'PushManager' in window) {
                navigator.serviceWorker.register('/service-worker.js')
                    .then(swReg => {
                        console.log('Service Worker is registered', swReg);
                        // Ask for permission and subscribe
                        subscribeToPush(swReg);
                    })
                    .catch(error => {
                        console.error('Service Worker Error', error);
                    });
            }
        }
    }, [user]);

    const subscribeToPush = async (swReg) => {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('Push notification permission not granted.');
            return;
        }

        let subscription = await swReg.pushManager.getSubscription();
        if (subscription === null) {
            try {
                const response = await axios.get('/api/vapid/public-key');
                const vapidPublicKey = response.data.public_key;
                const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

                subscription = await swReg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: convertedVapidKey
                });

                const token = localStorage.getItem('token');
                await axios.post('/api/subscribe', subscription, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                console.log('User subscribed to push notifications.');
            } catch (error) {
                console.error('Failed to subscribe to push notifications', error);
            }
        }
    };


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