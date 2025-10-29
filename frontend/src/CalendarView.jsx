import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import './custom-calendar.css'; // Asegúrate que la ruta es correcta
import PreviousItemsModal from './PreviousItemsModal'; // Importar el modal

const API_URL = 'http://localhost:8000';

function CalendarView() {
    const location = useLocation();
    const navigate = useNavigate();
    const calendar = location.state?.calendar;

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [listas, setListas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [nuevaListaNombre, setNuevaListaNombre] = useState('');
    const [nuevaListaNotas, setNuevaListaNotas] = useState('');
    const [nuevaListaComentarios, setNuevaListaComentarios] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [showPreviousItemsModal, setShowPreviousItemsModal] = useState(false);
    const [newlyCreatedList, setNewlyCreatedList] = useState(null);

    const fetchLists = () => {
        if (!calendar || !calendar.id) return;
        const token = localStorage.getItem('token');
        setLoading(true);
        fetch(`/api/listas/?calendar_id=${calendar.id}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        })
            .then(res => res.json())
            .then(data => setListas(Array.isArray(data?.items) ? data.items : []))
            .finally(() => setLoading(false));
    };

    // Cargar listas del calendario seleccionado
    useEffect(() => {
        fetchLists();
    }, [calendar]);

    // Mapear listas por list_for_date
    const listasPorFecha = useMemo(() => {
        const map = {};
        listas.forEach(l => {
            if (l.list_for_date) {
                const key = new Date(l.list_for_date).toISOString().slice(0, 10);
                if (!map[key]) {
                    map[key] = [];
                }
                map[key].push(l);
            }
        });
        return map;
    }, [listas]);

    const dateKey = selectedDate.toISOString().slice(0, 10);
    const listsForSelectedDate = listasPorFecha[dateKey] || [];
    // Estilos para días en el calendario
    function getTileClassName({ date, view }) {
        if (view !== 'month') return '';
        const key = date.toISOString().slice(0, 10);
        const listsOnDate = listasPorFecha[key];

        if (listsOnDate && listsOnDate.length > 0) {
            // Lógica de coloreado mejorada
            const isReviewed = listsOnDate.some(l => l.status === 'revisada');
            const isNotReviewed = listsOnDate.some(l => l.status === 'no revisada');

            if (isReviewed) return 'calendar-day-reviewed';
            if (isNotReviewed) return 'calendar-day-not-reviewed';
            if (listsOnDate.some(l => l.status === 'pendiente')) return 'calendar-day-pending';
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
            const res = await fetch(`/api/listas/`, {
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
            setNewlyCreatedList(nueva);
            setShowForm(false);
            setNuevaListaNombre('');
            setNuevaListaNotas('');
            setNuevaListaComentarios('');
            setShowPreviousItemsModal(true); // Show modal after creating the list
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddItems = async (itemsToAdd) => {
        if (!newlyCreatedList) return;
        const token = localStorage.getItem('token');
        const items = itemsToAdd.map(item => ({
            nombre: item.nombre,
            cantidad: item.cantidad,
            unit: item.unit,
            comentario: item.comentario,
            precio_estimado: item.precio_estimado,
        }));

        try {
            await fetch(`/api/listas/${newlyCreatedList.id}/items/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ items })
            });
        } catch (err) {
            alert('Error adding items to the list.');
        }
    };

    const handleDeleteLista = async (listId) => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar esta lista?')) return;
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/listas/${listId}`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) throw new Error('Error al eliminar la lista');
            fetchLists(); // Recargar las listas
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

 const handleSelectList = (list) => {
        navigate(`/shopping-list/${list.id}`, { state: { list } });
    };

    return (
        <div className="container mt-4">
            <button className="btn btn-secondary mb-3" onClick={() => navigate('/family-panel')}>Volver</button>
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
                    <button className="btn btn-success btn-sm mt-2" onClick={() => setShowForm(true)}>Crear lista para este día</button>
                    <hr />
                    {listsForSelectedDate.length > 0 ? (
                        <div className="list-group">
                            {listsForSelectedDate.map(list => (
                                <div key={list.id} className="list-group-item d-flex justify-content-between align-items-center">
                                    <span onClick={() => handleSelectList(list)} style={{ cursor: 'pointer' }}>
                                        {list.name} <span className={`badge bg-${list.status === 'revisada' ? 'success' : 'warning'}`}>{list.status}</span>
                                    </span>
                                    <div>
                                        <button className="btn btn-sm btn-primary me-2" onClick={() => handleSelectList(list)}>Ver</button>
                                        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteLista(list.id)} disabled={loading}>
                                            {loading ? <span className="spinner-border spinner-border-sm"></span> : 'X'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="alert alert-info mt-3">
                            No hay lista de compras para este día.<br />
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
            <PreviousItemsModal
                show={showPreviousItemsModal}
                handleClose={() => setShowPreviousItemsModal(false)}
                familyId={calendar?.family_id}
                handleAddItems={handleAddItems}
            />
        </div>
    );
}

export default CalendarView;