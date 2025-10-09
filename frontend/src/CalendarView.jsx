import React, { useState, useEffect, useMemo } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

function CalendarView({ calendar, onSelectList, onBack }) {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [listas, setListas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [nuevaListaNombre, setNuevaListaNombre] = useState('');
    const [nuevaListaNotas, setNuevaListaNotas] = useState('');
    const [nuevaListaComentarios, setNuevaListaComentarios] = useState('');
    const [showForm, setShowForm] = useState(false);

    // Cargar listas del calendario seleccionado
    useEffect(() => {
        if (!calendar || !calendar.id) return;
        const token = localStorage.getItem('token');
        setLoading(true);
        fetch('/api/listas/?calendar_id=' + calendar.id, {
            headers: { 'Authorization': 'Bearer ' + token }
        })
            .then(res => res.json())
            .then(data => setListas(Array.isArray(data) ? data : []))
            .finally(() => setLoading(false));
    }, [calendar]);

    // Mapear listas por list_for_date
    const listasPorFecha = useMemo(() => {
        const map = {};
        listas.forEach(l => {
            if (l.list_for_date) {
                const key = new Date(l.list_for_date).toISOString().slice(0, 10);
                map[key] = l;
            }
        });
        return map;
    }, [listas]);

    const dateKey = selectedDate.toISOString().slice(0, 10);
    const list = listasPorFecha[dateKey];
    // Estilos para días en el calendario
    function getTileClassName({ date, view }) {
        if (view !== 'month') return '';
        const key = date.toISOString().slice(0, 10);
        const l = listasPorFecha[key];
        if (l) {
            if (l.status === 'pending') return 'calendar-day-pending';
            if (l.status === 'reviewed') return 'calendar-day-reviewed';
            if (l.status === 'not-reviewed') return 'calendar-day-not-reviewed';
            return 'calendar-day-has-list';
        }
        return '';
    }

    // Crear nueva lista
    const handleCrearLista = async (e) => {
        e.preventDefault();
        setLoading(true);
        const token = localStorage.getItem('token');
        const dateKeyActual = selectedDate.toISOString().slice(0, 10);
        try {
            const res = await fetch('/api/listas/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({
                    name: nuevaListaNombre,
                    list_for_date: dateKeyActual,
                    notas: nuevaListaNotas || '',
                    comentarios: nuevaListaComentarios,
                    calendar_id: calendar.id
                })
            });
            if (!res.ok) throw new Error('Error al crear lista');
            const nueva = await res.json();
            setListas([...listas, nueva]);
            setShowForm(false);
            setNuevaListaNombre('');
            setNuevaListaNotas('');
            setNuevaListaComentarios('');
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mt-4">
            <button className="btn btn-secondary mb-3" onClick={onBack}>Volver</button>
            <h2>Calendario: {calendar?.nombre || ''}</h2>
            <div className="row">
                <div className="col-md-7">
                    <Calendar
                        onChange={setSelectedDate}
                        value={selectedDate}
                        tileClassName={getTileClassName}
                        calendarType="iso8601"
                    />
                </div>
                <div className="col-md-5">
                    <h4 className="mt-3">{selectedDate.toLocaleDateString()}</h4>
                    {list ? (
                        <div className="card p-3 mb-2">
                            <b>{list.name}</b>
                            <span className="badge ms-2">{list.status || 'Pendiente'}</span>
                            <button className="btn btn-primary btn-sm mt-2" onClick={() => onSelectList(list)}>Ver lista</button>
                        </div>
                    ) : (
                        <div className="alert alert-info mt-3">
                            No hay lista de compras para este día.<br />
                            <button className="btn btn-success btn-sm mt-2" onClick={() => setShowForm(true)}>Crear lista para este día</button>
                        </div>
                    )}
                    {showForm && (
                        <form className="mt-3" onSubmit={handleCrearLista}>
                            <input className="form-control mb-2" placeholder="Nombre de la lista" value={nuevaListaNombre} onChange={e => setNuevaListaNombre(e.target.value)} required />
                            <textarea className="form-control mb-2" placeholder="Notas (opcional)" value={nuevaListaNotas} onChange={e => setNuevaListaNotas(e.target.value)} />
                            <textarea className="form-control mb-2" placeholder="Comentarios (opcional)" value={nuevaListaComentarios} onChange={e => setNuevaListaComentarios(e.target.value)} />
                            <button className="btn btn-success btn-sm" type="submit" disabled={loading}>{loading ? 'Creando...' : 'Crear lista'}</button>
                            <button className="btn btn-secondary btn-sm ms-2" type="button" onClick={() => setShowForm(false)}>Cancelar</button>
                        </form>
                    )}
                </div>
            </div>
            <div className="mt-4">
                <small>
                    <span className="calendar-day-pending" style={{ padding: '0 10px', borderRadius: 4, marginRight: 8 }}>Pendiente</span>
                    <span className="calendar-day-reviewed" style={{ padding: '0 10px', borderRadius: 4, marginRight: 8 }}>Revisada</span>
                    <span className="calendar-day-not-reviewed" style={{ padding: '0 10px', borderRadius: 4 }}>No revisada</span>
                </small>
            </div>
        </div>
    );
}

export default CalendarView;
