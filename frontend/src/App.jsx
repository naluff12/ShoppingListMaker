
import React, { useState, useEffect } from 'react';
import Welcome from './Welcome.jsx';
import Register from './Register.jsx';
import Login from './Login.jsx';
import FamilyPanel from './FamilyPanel.jsx';
import CalendarView from './CalendarView.jsx';
import ShoppingListView from './ShoppingListView.jsx';


function App() {
    // Cambia el estado inicial a 'register' para mostrar el formulario de registro al iniciar
    const [view, setView] = useState('login');
    const [user, setUser] = useState(null); // { username, isAdmin, family }
    const [calendar, setCalendar] = useState(null); // nombre del calendario
    const [list, setList] = useState(null); // nombre de la lista

    // DEBUG: Mensaje visible para confirmar render
    if (!window.__REACT_DEBUG_SHOWN) {
        window.__REACT_DEBUG_SHOWN = true;
        console.log('React App está montando correctamente');
    }

    const handleLogout = async () => {
        //devolver a login y eliminar token de localstorage
        localStorage.removeItem('token');
        setUser(null);
        setView('login');
    };

    // Check for token on initial load
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            // Aquí podrías validar el token con el backend y obtener datos del usuario
            // Por ahora, asumimos que si hay token, el usuario está "logueado"
            // y necesita que se carguen sus datos.
            // Para simplificar, vamos a FamilyPanel, que ya carga datos del usuario.
            // Idealmente, tendrías un endpoint /users/me que te devuelve el usuario.
            // Asumimos que el objeto user se llenará en FamilyPanel o donde sea necesario.
            setUser({}); // Pone un objeto de usuario temporal para pasar la guarda !user
            setView('familyPanel');
        }
    }, []);

    const renderView = () => {
        if (!user) {
            switch (view) {
                case 'register':
                    return <Register onRegistered={() => setView('login')} onBack={() => setView('login')} />;
                case 'login':
                    return <Login onLogin={u => { setUser(u); setView('familyPanel'); }} onRegister={() => setView('register')} />;
                default:
                    return <Welcome onLogin={() => setView('login')} onRegister={() => setView('register')} />;
            }
        }

        switch (view) {
            case 'familyPanel':
                return <FamilyPanel
                    user={user}
                    onLogout={handleLogout}
                    onSelectCalendar={cal => { setCalendar(cal); setView('calendar'); }}
                />;
            case 'calendar':
                return <CalendarView
                    calendar={calendar}
                    onSelectList={l => { setList(l); setView('shoppingList'); }}
                    onBack={() => setView('familyPanel')}
                />;
            case 'shoppingList':
                return <ShoppingListView
                    list={list}
                    onBack={() => setView('calendar')}
                />;
            default:
                // Si por alguna razón el estado es inválido, vuelve al panel familiar.
                return <FamilyPanel user={user} onLogout={handleLogout} onSelectCalendar={cal => { setCalendar(cal); setView('calendar'); }} />;
        }
    };

    return (
        <div>
            {renderView()}
        </div>
    );
    }

export default App;
