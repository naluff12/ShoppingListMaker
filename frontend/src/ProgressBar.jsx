import React from 'react';

function ProgressBar({ progress, variant, label }) {
    const bgColor = variant === 'danger' ? 'var(--danger-color)' : variant === 'success' ? 'var(--success-color)' : variant === 'warning' ? 'var(--warning-color)' : 'var(--info-color, #3b82f6)';
    return (
        <div style={{ position: 'relative', width: '100%', height: '24px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden', marginTop: '8px' }}>
            <div style={{ height: '100%', width: `${Math.min(100, progress)}%`, backgroundColor: bgColor, transition: 'width 0.3s ease' }}></div>
            {label && <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{label}</div>}
        </div>
    );
}

export default ProgressBar;
