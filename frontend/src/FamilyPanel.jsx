import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, CalendarPlus, Calendar, ChevronDown, X } from 'lucide-react';

function FamilyPanel() {
    const [families, setFamilies] = useState([]);
    const [selectedFamily, setSelectedFamily] = useState(null);
    const [calendars, setCalendars] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [showCreateFamily, setShowCreateFamily] = useState(false);
    const [newFamilyName, setNewFamilyName] = useState('');

    const [showJoinFamily, setShowJoinFamily] = useState(false);
    const [joinCode, setJoinCode] = useState('');

    const [showCreateCalendar, setShowCreateCalendar] = useState(false);
    const [newCalendarName, setNewCalendarName] = useState('');

    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    const navigate = useNavigate();

    const fetchFamilies = useCallback(async () => {
        const token = localStorage.getItem('token');
        try {
            setLoading(true);
            const res = await fetch(`/api/families/my`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) throw new Error('Could not fetch families');
            const data = await res.json();
            setFamilies(data);
            if (data.length > 0) {
                setSelectedFamily(data[0]);
            } else {
                setSelectedFamily(null);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFamilies();
    }, [fetchFamilies]);

    useEffect(() => {
        const fetchCalendars = async () => {
            if (!selectedFamily) {
                setCalendars([]);
                return;
            }
            const token = localStorage.getItem('token');
            try {
                const res = await fetch(`/api/families/${selectedFamily.id}/calendars`, {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const data = await res.json();
                setCalendars(Array.isArray(data) ? data : []);
            } catch (error) {
                setCalendars([]);
            }
        };

        fetchCalendars();
    }, [selectedFamily]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleCreateFamily = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/families`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ nombre: newFamilyName })
            });
            if (!res.ok) throw new Error('Failed to create family');
            setShowCreateFamily(false);
            setNewFamilyName('');
            fetchFamilies();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleJoinFamily = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/families/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ code: joinCode })
            });
            if (!res.ok) throw new Error('Failed to join family');
            setShowJoinFamily(false);
            setJoinCode('');
            fetchFamilies();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleCreateCalendar = async (e) => {
        e.preventDefault();
        if (!selectedFamily) return;
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/families/${selectedFamily.id}/calendars`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ nombre: newCalendarName })
            });
            if (!res.ok) throw new Error('Error al crear calendario.');
            const newCal = await res.json();
            setCalendars([...calendars, newCal]);
            setShowCreateCalendar(false);
            setNewCalendarName('');
        } catch (err) {
            alert(err.message);
        }
    };

    const handleSelectCalendar = (calendar) => {
        navigate('/calendar', { state: { calendar } });
    };

    if (loading) {
        return (
            <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <div className="text-gradient" style={{ fontSize: '1.5rem', fontWeight: 600 }}>Cargando...</div>
            </div>
        );
    }

    return (
        <div className="app-container animate-fade-in" style={{ maxWidth: '800px' }}>
            <h2 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '8px' }}>Panel de Familia</h2>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <button className="btn-premium btn-success" style={{ background: 'var(--success-color)', color: 'white' }} onClick={() => setShowCreateFamily(true)}>
                    <Users size={18} /> Crear Familia
                </button>
                <button className="btn-premium btn-primary" onClick={() => setShowJoinFamily(true)}>
                    <UserPlus size={18} /> Join Family
                </button>
            </div>

            {families.length > 0 ? (
                <div className="dropdown-container" ref={dropdownRef} style={{ marginBottom: '24px' }}>
                    <button 
                        className="premium-input" 
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}
                        onClick={() => setShowDropdown(!showDropdown)}
                    >
                        <span>Familia seleccionada: {selectedFamily ? selectedFamily.nombre : 'None'}</span>
                        <ChevronDown size={20} />
                    </button>
                    {showDropdown && (
                        <div className="dropdown-menu" style={{ display: 'flex', width: '100%' }}>
                            {families.map(fam => (
                                <button 
                                    key={fam.id} 
                                    className="dropdown-item" 
                                    onClick={() => { setSelectedFamily(fam); setShowDropdown(false); }}
                                >
                                    {fam.nombre}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="alert-info">
                    Aun no eres parte de ninguna familia. Crea una o unete a una para empezar!
                </div>
            )}

            {selectedFamily && (
                <div className="animate-fade-in">
                    <div className="glass-panel" style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Detalles de la Familia</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <p><b>Nombre de la Familia:</b> <span style={{ color: 'var(--text-secondary)' }}>{selectedFamily.nombre}</span></p>
                            <p><b>Creador:</b> <span style={{ color: 'var(--text-secondary)' }}>{selectedFamily.owner?.username || 'N/A'}</span></p>
                            <p>
                                <b>Codigo de invitacion:</b> <span style={{ background: 'var(--primary-glow)', color: 'var(--primary-color)', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>{selectedFamily.code}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginLeft: '8px' }}>(Compartelo con quien quieras que pueda ver tus calendarios)</span>
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ margin: 0 }}>Calendarios for {selectedFamily.nombre}</h4>
                        <button className="btn-premium btn-secondary" onClick={() => setShowCreateCalendar(true)}>
                            <CalendarPlus size={18} /> Crear Calendario
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {calendars.map(cal => (
                            <div key={cal.id} className="list-item" onClick={() => handleSelectCalendar(cal)}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Calendar className="text-gradient" size={24} />
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{cal.nombre}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Creador: {cal.owner?.username || 'N/A'}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {calendars.length === 0 && <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay calendarios para esta familia aun.</p>}
                    </div>
                </div>
            )}

            {/* Modal Create Family */}
            {showCreateFamily && ReactDOM.createPortal(
                <div className="modal-backdrop" onClick={() => setShowCreateFamily(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h5 className="modal-title">Crear Familia</h5>
                            <button className="modal-close" onClick={() => setShowCreateFamily(false)}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleCreateFamily}>
                            <div className="modal-body">
                                <input 
                                    type="text" 
                                    className="premium-input" 
                                    placeholder="Nombre de la familia" 
                                    value={newFamilyName} 
                                    onChange={e => setNewFamilyName(e.target.value)} 
                                    required 
                                />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-premium btn-secondary" onClick={() => setShowCreateFamily(false)}>Cancelar</button>
                                <button type="submit" className="btn-premium btn-primary">Crear</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal Join Family */}
            {showJoinFamily && ReactDOM.createPortal(
                <div className="modal-backdrop" onClick={() => setShowJoinFamily(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h5 className="modal-title">Unirse a Familia</h5>
                            <button className="modal-close" onClick={() => setShowJoinFamily(false)}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleJoinFamily}>
                            <div className="modal-body">
                                <input 
                                    type="text" 
                                    className="premium-input" 
                                    placeholder="Código de la familia" 
                                    value={joinCode} 
                                    onChange={e => setJoinCode(e.target.value)} 
                                    required 
                                />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-premium btn-secondary" onClick={() => setShowJoinFamily(false)}>Cancelar</button>
                                <button type="submit" className="btn-premium btn-primary">Unirse</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal Create Calendar */}
            {showCreateCalendar && ReactDOM.createPortal(
                <div className="modal-backdrop" onClick={() => setShowCreateCalendar(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h5 className="modal-title">Crear Calendario</h5>
                            <button className="modal-close" onClick={() => setShowCreateCalendar(false)}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleCreateCalendar}>
                            <div className="modal-body">
                                <input 
                                    type="text" 
                                    className="premium-input" 
                                    placeholder="Nombre del calendario" 
                                    value={newCalendarName} 
                                    onChange={e => setNewCalendarName(e.target.value)} 
                                    required 
                                />
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-premium btn-secondary" onClick={() => setShowCreateCalendar(false)}>Cancelar</button>
                                <button type="submit" className="btn-premium btn-primary">Crear</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

export default FamilyPanel;