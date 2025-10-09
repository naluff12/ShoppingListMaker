import React, { useState } from 'react';
import Login from './Login';
import Register from './Register';

function Auth() {
    const [view, setView] = useState('login'); // Puede ser 'login' o 'register'
    const [user, setUser] = useState(null);

    const handleLogin = (userData) => {
        console.log('✅ Usuario logueado:', userData);
        setUser(userData);
        // Aquí podrías redirigir al dashboard, por ejemplo:
        // navigate('/dashboard');
    };

    const handleRegistered = (newUser) => {
        console.log('✅ Usuario registrado:', newUser);
        // Después del registro, volvemos al login automáticamente
        setView('login');
    };

    const handleNoUsers = () => {
        // Si no hay usuarios registrados, redirige al registro
        setView('register');
    };

    const handleRegisterClick = () => {
        setView('register');
    };

    const handleBackToLogin = () => {
        setView('login');
    };

    return (
        <div className="auth-wrapper" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {view === 'login' && (
                <Login
                    onLogin={handleLogin}
                    onNoUsers={handleNoUsers}
                    onRegister={handleRegisterClick}
                />
            )}
            {view === 'register' && (
                <Register
                    onRegistered={handleRegistered}
                    onBack={handleBackToLogin}
                />
            )}
        </div>
    );
}

export default Auth;
