import React from 'react';
import './Skeleton.css';

const ShoppingListItemSkeleton = () => {
    return (
        <div className="shopping-list-item-skeleton">
            <div className="skeleton skeleton-switch-small"></div>
            <div className="skeleton skeleton-image-small"></div>
            <div className="skeleton skeleton-text" style={{ flexGrow: 1 }}></div>
            <div className="skeleton skeleton-text" style={{ width: '100px' }}></div>
            <div className="skeleton skeleton-text" style={{ width: '80px' }}></div>
            <div className="skeleton skeleton-button-small"></div>
            <div className="skeleton skeleton-button-small"></div>
            <div className="skeleton skeleton-button-small"></div>
        </div>
    );
};

export default ShoppingListItemSkeleton;
