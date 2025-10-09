
import React, { useState } from 'react';
import Welcome from './Welcome.jsx';
import Register from './Register.jsx';
import Login from './Login.jsx';
import FamilyPanel from './FamilyPanel.jsx';
import InviteMember from './InviteMember.jsx';
import CalendarView from './CalendarView.jsx';
import ShoppingListView from './ShoppingListView.jsx';
import Auth from './Auth';


function App() {
    // Cambia el estado inicial a 'register' para mostrar el formulario de registro al iniciar
    const [view, setView] = useState('register');
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
    };
    // Navegación principal
    if (!user) {
        if (view === 'register') {
            return <Register onRegistered={u => { setUser(u); setView('login'); }} onBack={() => setView('login')} />;
        }
        if (view === 'login') {
            return (
                <Login
                    onLogin={u => { setUser(u); setView('familyPanel'); }}
                    onNoUsers={() => setView('register')}
                    onRegister={() => setView('register')}  // 🔥 ESTA LÍNEA AGREGA EL CAMBIO DE VISTA
                />
            );
        }
    }

    // Panel principal de la familia
    if (view === 'familyPanel') {
        return <FamilyPanel
            user={user}
            onInvite={() => setView('invite')}
            onLogout={() => { setUser(null); setView('welcome'); handleLogout(); }}
            onSelectCalendar={cal => { setCalendar(cal); setView('calendar'); }}
            onCreateCalendar={() => alert('Funcionalidad para crear calendario')}
        />;
    }

    if (view === 'invite') {
        return <InviteMember onBack={() => setView('familyPanel')} />;
    }

    if (view === 'calendar') {
        return <CalendarView
            calendar={calendar}
            onSelectList={l => { setList(l); setView('shoppingList'); }}
            onBack={() => setView('familyPanel')}
        />;
    }

    if (view === 'shoppingList') {
        return <ShoppingListView
            list={list}
            onBack={() => setView('calendar')}
        />;
    }

    return (
        <Login
            onLogin={u => { setUser(u); setView('familyPanel'); }}
            onNoUsers={() => setView('register')}
            onRegister={() => setView('register')}  // 🔥 ESTA LÍNEA AGREGA EL CAMBIO DE VISTA
        />
    );
}

export default App;
