import React from 'react';
import './Skeleton.css';

const ShoppingItemCardSkeleton = () => {
    return (
        <div className="glass-panel" style={{ padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="skeleton skeleton-text" style={{ width: '60%', margin: 0 }}></div>
                <div className="skeleton skeleton-switch" style={{ margin: 0 }}></div>
            </div>
            <div style={{ padding: '16px', display: 'flex', gap: '16px', overflow: 'hidden' }}>
                <div style={{ width: '100px', height: '100px', flexShrink: 0 }}>
                    <div className="skeleton skeleton-image" style={{ width: '100px', height: '100px' }}></div>
                </div>
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <div className="skeleton skeleton-text" style={{ width: '40%' }}></div>
                    <div className="skeleton skeleton-text" style={{ width: '100%' }}></div>
                    <div className="skeleton skeleton-text" style={{ width: '80%' }}></div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                        <div className="skeleton skeleton-button"></div>
                        <div className="skeleton skeleton-button"></div>
                        <div className="skeleton skeleton-button"></div>
                    </div>
                </div>
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
                <div className="skeleton skeleton-text" style={{ width: '40%', margin: 0 }}></div>
            </div>
        </div>
    );
};

export default ShoppingItemCardSkeleton;
