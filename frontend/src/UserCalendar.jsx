import React, { useEffect, useState } from 'react';
import LocalComponent from './LocalComponent.jsx'; // Example local component import

function UserCalendar({ user }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true);
        fetch(`/calendar/${user}`)
            .then(res => {
                if (!res.ok) throw new Error('No se pudo cargar el calendario');
                return res.json();
            })
            .then(data => setEvents(data))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [user]);

    return (
        <div>
            <h2>Calendario de {user}</h2>
            {loading && <p>Cargando...</p>}
            {error && <div style={{ color: 'red' }}>{error}</div>}
            <ul>
                {events.map(ev => (
                    <li key={ev.id}>{ev.date}: {ev.title}</li>
                ))}
            </ul>
            {(!loading && events.length === 0 && !error) && <p>No hay eventos.</p>}
        </div>
    );
}

export default UserCalendar;
