import React from 'react';
import './Skeleton.css';

const ShoppingListItemSkeleton = () => {
    return (
        <div className="glass-panel" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
            <div className="skeleton skeleton-switch" style={{ margin: 0, flexShrink: 0 }}></div>
            <div className="skeleton skeleton-image" style={{ width: '60px', height: '60px', flexShrink: 0 }}></div>
            <div style={{ flexGrow: 1 }}>
                <div className="skeleton skeleton-text" style={{ marginBottom: '8px' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '60%', margin: 0 }}></div>
            </div>
            <div className="skeleton skeleton-text" style={{ width: '100px', margin: 0, flexShrink: 0 }}></div>
            <div className="skeleton skeleton-text" style={{ width: '80px', margin: 0, flexShrink: 0 }}></div>
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                <div className="skeleton skeleton-button-small" style={{ margin: 0 }}></div>
                <div className="skeleton skeleton-button-small" style={{ margin: 0 }}></div>
                <div className="skeleton skeleton-button-small" style={{ margin: 0 }}></div>
            </div>
        </div>
    );
};

export default ShoppingListItemSkeleton;
