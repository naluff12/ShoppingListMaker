import React, { useState, useRef, useEffect } from 'react';

/**
 * Texto colapsado a 1 línea con ellipsis + tooltip anclado al texto
 * (arriba del elemento, o debajo si no cabe) con el contenido completo
 * con wrap. Se muestra al pasar el cursor (desktop) o mantener pulsado
 * 350ms (móvil). El tooltip nunca se sale de la pantalla.
 */
const TruncatedText = ({ text, className = '', style = {}, tooltipMaxWidth = 300, maxChars = null }) => {
    const [show, setShow] = useState(false);
    const [rect, setRect] = useState(null);
    const ref = useRef(null);
    const timerRef = useRef(null);

    if (!text) return null;

    // Corte por caracteres (determinista): "Cafetera Expreso DEAR DAY XH-V9…"
    const display = maxChars && text.length > maxChars
        ? `${text.slice(0, maxChars).trimEnd()}…`
        : text;
    const isTruncated = display !== text;

    const captureRect = () => {
        const r = ref.current?.getBoundingClientRect();
        if (r) setRect({ top: r.top, left: r.left, width: r.width, bottom: r.bottom });
        return r;
    };

    const showTip = () => {
        captureRect();
        setShow(true);
    };
    const hideTip = () => {
        setShow(false);
        setRect(null);
    };

    const handleTouchStart = () => {
        // Long-press 350ms en móvil para mostrar el tooltip
        timerRef.current = setTimeout(showTip, 350);
    };
    const handleTouchEnd = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    };
    useEffect(() => () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    }, []);

    // ¿Hay espacio arriba del texto? (para no sacar el tooltip de la pantalla)
    const showAbove = !rect || rect.top >= 150;

    return (
        <span
            ref={ref}
            className={`truncated-text ${className}`}
            style={{
                display: 'inline-block',
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                verticalAlign: 'bottom',
                cursor: 'default',
                ...style,
            }}
            onMouseEnter={showTip}
            onMouseLeave={hideTip}
            onFocus={showTip}
            onBlur={hideTip}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchEnd}
            tabIndex={0}
            role="button"
            aria-label={text}
        >
            {display}
            {show && rect && isTruncated && (
                <span
                    className="truncated-tooltip"
                    style={{
                        position: 'fixed',
                        left: Math.max(12, Math.min(rect.left, window.innerWidth - Math.min(tooltipMaxWidth, window.innerWidth - 32) - 12)),
                        top: showAbove ? rect.top - 8 : rect.bottom + 8,
                        transform: showAbove ? 'translateY(-100%)' : 'none',
                        zIndex: 4000,
                        background: 'rgba(15, 23, 42, 0.96)',
                        color: '#f8fafc',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        lineHeight: 1.45,
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        maxWidth: `min(${tooltipMaxWidth}px, calc(100vw - 32px))`,
                        boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                        pointerEvents: 'none',
                        textAlign: 'left',
                    }}
                >
                    {text}
                </span>
            )}
        </span>
    );
};

export default TruncatedText;
