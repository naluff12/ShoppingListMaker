import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Calendar from 'react-calendar';
import './custom-calendar.css';
import PreviousItemsModal from './PreviousItemsModal';
import { ArrowLeft, Plus, Trash2, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

function CalendarView() {
    const location = useLocation();
    const navigate = useNavigate();
    const calendarFromState = location.state?.calendar;

    // Try to get calendar from state or fetch by URL param
    const [calendar, setCalendar] = useState(calendarFromState || null);
    const [calendarId] = useState(() => {
        const params = new URLSearchParams(location.search);
        return calendarFromState?.id || params.get('id');
    });

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [activeStartDate, setActiveStartDate] = useState(new Date());
    const [listas, setListas] = useState([]);
    const [loading, setLoading] = useState(false);
    const calendarContainerRef = useRef(null);
    const touchStartRef = useRef(null);

    // Fetch calendar data if only ID is available (e.g. page refresh)
    useEffect(() => {
        if (!calendar && calendarId) {
            fetch(`/api/calendars/${calendarId}`)
                .then(res => res.ok ? res.json() : null)
                .then(data => { if (data) setCalendar(data); })
                .catch(() => { });
        }
    }, [calendar, calendarId]);

    // Swipe gesture handlers for month navigation
    const handleTouchStart = useCallback((e) => {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, []);

    const handleTouchEnd = useCallback((e) => {
        if (!touchStartRef.current) return;
        const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
        const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
        // Only register horizontal swipes (min 60px, predominantly horizontal)
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx > 0) {
                handlePrevMonth();
            } else {
                handleNextMonth();
            }
        }
        touchStartRef.current = null;
    }, []);

    const handlePrevMonth = () => {
        setActiveStartDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setActiveStartDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    // form state
    const [nuevaListaNombre, setNuevaListaNombre] = useState('');
    const [nuevaListaNotas, setNuevaListaNotas] = useState('');
    const [nuevaListaComentarios, setNuevaListaComentarios] = useState('');
    const [showForm, setShowForm] = useState(false);

    // modals
    const [showPreviousItemsModal, setShowPreviousItemsModal] = useState(false);
    const [newlyCreatedList, setNewlyCreatedList] = useState(null);

    const fetchLists = (startDate, endDate) => {
        if (!calendar || !calendar.id) return;
        const params = new URLSearchParams({
            calendar_id: calendar.id,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0]
        });
        setLoading(true);
        fetch(`/api/listas/?${params.toString()}`)
            .then(res => res.json())
            .then(data => setListas(Array.isArray(data?.items) ? data.items : []))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (calendar) {
            const startDate = new Date(activeStartDate.getFullYear(), activeStartDate.getMonth(), 1);
            const endDate = new Date(activeStartDate.getFullYear(), activeStartDate.getMonth() + 1, 0);
            fetchLists(startDate, endDate);
        }
    }, [calendar, activeStartDate]);

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

    function getTileClassName({ date, view }) {
        if (view !== 'month') return '';
        const key = date.toISOString().slice(0, 10);
        const listsOnDate = listasPorFecha[key];

        if (listsOnDate && listsOnDate.length > 0) {
            const isReviewed = listsOnDate.some(l => l.status === 'revisada');
            const isNotReviewed = listsOnDate.some(l => l.status === 'no revisada');

            if (isReviewed) return 'calendar-day-reviewed';
            if (isNotReviewed) return 'calendar-day-not-reviewed';
            if (listsOnDate.some(l => l.status === 'pendiente')) return 'calendar-day-pending';
            return 'calendar-day-has-list';
        }
        return '';
    }

    const handleCrearLista = async (e) => {
        e.preventDefault();
        setLoading(true);
        const dateKeyActual = selectedDate.toISOString().slice(0, 10);
        try {
            const res = await fetch(`/api/listas/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            setShowPreviousItemsModal(true);
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddItems = async (itemsToAdd) => {
        if (!newlyCreatedList) return;
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items })
            });
        } catch (err) {
            alert('Error adding items to the list.');
        }
    };

    const handleDeleteLista = async (listId) => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar esta lista?')) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/listas/${listId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Error al eliminar la lista');
            const startDate = new Date(activeStartDate.getFullYear(), activeStartDate.getMonth(), 1);
            const endDate = new Date(activeStartDate.getFullYear(), activeStartDate.getMonth() + 1, 0);
            fetchLists(startDate, endDate);
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
        <div className="app-container animate-fade-in" style={{ maxWidth: '1200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <button className="btn-premium btn-secondary" onClick={() => navigate('/family-panel')} style={{ padding: '8px 16px' }}>
                    <ArrowLeft size={18} /> Volver
                </button>
                <h2 className="text-gradient" style={{ margin: 0, fontSize: 'clamp(1.3rem, 4vw, 2rem)' }}>
                    Calendario: {calendar?.nombre || ''}
                </h2>
            </div>

            {/* Month navigation - larger touch targets */}
            <div className="calendar-month-nav">
                <button className="btn-premium btn-secondary calendar-month-btn" onClick={handlePrevMonth}>
                    <ChevronLeft size={20} /> <span className="month-btn-text">Anterior</span>
                </button>
                <div className="calendar-month-label">
                    {activeStartDate.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
                </div>
                <button className="btn-premium btn-secondary calendar-month-btn" onClick={handleNextMonth}>
                    <span className="month-btn-text">Siguiente</span> <ChevronRight size={20} />
                </button>
            </div>

            <div className="grid-mobile-stack calendar-grid" style={{ alignItems: 'flex-start' }}>
                {/* Calendar Area - with swipe support */}
                <div
                    className="glass-panel"
                    style={{ padding: '24px' }}
                    ref={calendarContainerRef}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                >
                    <Calendar
                        onChange={setSelectedDate}
                        value={selectedDate}
                        activeStartDate={activeStartDate}
                        tileClassName={getTileClassName}
                        calendarType="iso8601"
                        onActiveStartDateChange={({ activeStartDate }) => setActiveStartDate(activeStartDate)}
                        onViewChange={({ view, activeStartDate }) => {
                            if (view === 'month') {
                                setActiveStartDate(activeStartDate);
                            }
                        }}
                        className="custom-react-calendar"
                    />

                    <div style={{ marginTop: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.9rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--warning-color)' }}></span>
                            <span style={{ color: 'var(--text-secondary)' }}>Pendiente</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--success-color)' }}></span>
                            <span style={{ color: 'var(--text-secondary)' }}>Revisada</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--danger-color)' }}></span>
                            <span style={{ color: 'var(--text-secondary)' }}>No revisada</span>
                        </div>
                    </div>
                </div>

                {/* Date Details Area */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '1.5rem', marginBottom: '16px', color: 'var(--text-primary)' }}>
                        {selectedDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </h3>

                    <button className="btn-premium btn-primary" onClick={() => setShowForm(true)} style={{ width: '100%', marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
                        <Plus size={18} /> Crear lista para este día
                    </button>

                    {showForm && (
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: 'var(--border-radius-md)', marginBottom: '24px', animation: 'fadeIn 0.2s ease forwards' }}>
                            <form onSubmit={handleCrearLista} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <input className="premium-input" placeholder="Nombre de la lista" value={nuevaListaNombre} onChange={e => setNuevaListaNombre(e.target.value)} required />
                                <textarea className="premium-input" placeholder="Notas (opcional)" value={nuevaListaNotas} onChange={e => setNuevaListaNotas(e.target.value)} style={{ minHeight: '80px', resize: 'vertical' }} />
                                <textarea className="premium-input" placeholder="Comentarios (opcional)" value={nuevaListaComentarios} onChange={e => setNuevaListaComentarios(e.target.value)} style={{ minHeight: '80px', resize: 'vertical' }} />
                                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                    <button className="btn-premium btn-success" type="submit" disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
                                        {loading ? 'Creando...' : 'Guardar'}
                                    </button>
                                    <button className="btn-premium btn-secondary" type="button" onClick={() => setShowForm(false)} style={{ flex: 1, justifyContent: 'center' }}>
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div>
                        <h4 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Listas programadas</h4>
                        {listsForSelectedDate.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {listsForSelectedDate.map(list => (
                                    <div key={list.id} className="list-item" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                                        <div onClick={() => handleSelectList(list)} style={{ cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{list.name}</span>
                                            <span className="badge" style={{ background: list.status === 'revisada' ? 'var(--success-color)' : list.status === 'pendiente' ? 'var(--warning-color)' : 'var(--danger-color)' }}>
                                                {list.status}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button className="btn-premium" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '6px 10px' }} onClick={() => handleSelectList(list)}>
                                                <Eye size={18} />
                                            </button>
                                            <button className="btn-premium" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '6px 10px' }} onClick={() => handleDeleteLista(list.id)} disabled={loading}>
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="alert-info" style={{ margin: 0 }}>
                                No hay lista de compras para este día.
                            </div>
                        )}
                    </div>
                </div>
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