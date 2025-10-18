import React from 'react';
import { Link } from 'react-router-dom';
import { CSSTransition } from 'react-transition-group';
import { useState, useEffect, useRef } from 'react';

function Welcome() {
    const [show, setShow] = useState(false);
    const nodeRef = useRef(null);
    useEffect(() => { setShow(true); }, []);
    return (
        <CSSTransition in={show} timeout={600} classNames="fade" appear unmountOnExit nodeRef={nodeRef}>
            <div ref={nodeRef} className="text-center mt-5 fade">
                <h1>Bienvenido a Family Shopping List</h1>
                <p>Organiza tus compras en familia, por fechas y grupos.</p>
                <Link to="/login" className="btn btn-primary m-2 px-4 py-2">Iniciar sesión</Link>
                <Link to="/register" className="btn btn-success m-2 px-4 py-2">Registrarse</Link>
            </div>
        </CSSTransition>
    );
}

export default Welcome;
