// Cliente API centralizado.
// Todas las llamadas HTTP de la app pasan por aquí: URLs consistentes,
// manejo de errores uniforme y un solo lugar para cambiar la base.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

async function request(path, options = {}) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        credentials: 'same-origin',
        ...options,
    });
    if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
            const data = await res.json();
            if (data && data.detail) detail = data.detail;
        } catch { /* respuesta no JSON */ }
        throw new Error(detail);
    }
    if (res.status === 204) return null;
    const data = await res.json();
    // El backend marca con X-Item-Merged cuando el item ya existía en la lista
    // y se incrementó su cantidad en lugar de crear un duplicado.
    if (data && typeof data === 'object' && res.headers.get('X-Item-Merged') === 'true') {
        data._merged = true;
    }
    return data;
}

function get(path) { return request(path); }
function post(path, body) { return request(path, { method: 'POST', body: JSON.stringify(body) }); }
function put(path, body) { return request(path, { method: 'PUT', body: JSON.stringify(body) }); }
function del(path) { return request(path, { method: 'DELETE' }); }

// --- Listas e items ---
export const listApi = {
    getItems: (listId, params = {}) => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); });
        return get(`/api/listas/${listId}/items?${qs.toString()}`);
    },
    getItemCount: (listId) => get(`/api/listas/${listId}/items?size=1`),
    getPurchasedCount: (listId) => get(`/api/listas/${listId}/items?status=comprado&size=1`),
    getFilterOptions: (listId) => get(`/api/listas/${listId}/filter-options`),
    getBudgetDetails: (listId) => get(`/api/listas/${listId}/budget-details`),
    getList: (listId) => get(`/api/listas/${listId}`),
    updateList: (listId, body) => put(`/api/listas/${listId}`, body),
    deleteList: (listId) => del(`/api/listas/${listId}`),
    getBlame: (listId) => get(`/api/blame/lista/${listId}`),
    createBlame: (listId, detalles) => post(`/api/listas/${listId}/blames`, { detalles }),
    createItem: (body) => post('/api/items/', body),
    updateItem: (itemId, body) => put(`/api/items/${itemId}`, body),
    deleteItem: (itemId) => del(`/api/items/${itemId}`),
    bulkCreateItems: (listId, items) => post(`/api/listas/${listId}/items/bulk`, { items }),
    getItemBlame: (itemId) => get(`/api/blame/item/${itemId}`),
    createItemBlame: (itemId, body) => post(`/api/items/${itemId}/blames`, body),
    createListBlame: (listId, body) => post(`/api/listas/${listId}/blames`, body),
    uploadItemImage: async (itemId, file) => {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(`${API_BASE_URL}/api/items/${itemId}/upload-image`, { method: 'POST', body: form, credentials: 'same-origin' });
        let data = null;
        try { data = await res.json(); } catch { /* respuesta no JSON */ }
        if (!res.ok) {
            const detail = data?.detail || (typeof data === 'string' ? data : `Error al subir imagen (${res.status})`);
            throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
        }
        return data;
    },
    addByUrl: (body) => post('/api/items/add-by-url', body),
};

// --- Productos ---
export const productApi = {
    search: (familyId, q, page = 1, size = 10) =>
        get(`/api/products/search?family_id=${familyId}&q=${encodeURIComponent(q)}&page=${page}&size=${size}`),
    getByFamily: (familyId, page = 1, size = 10) =>
        get(`/api/families/${familyId}/products?page=${page}&size=${size}`),
    toggleFavorite: (productId, isFavorite) => post(`/api/products/${productId}/favorite`, { favorite: isFavorite }),
    update: (productId, body) => put(`/api/products/${productId}`, body),
};

// --- Familias ---
export const familyApi = {
    getTemplates: (familyId) => get(`/api/families/${familyId}/templates`),
    getSuggestedProducts: (familyId) => get(`/api/families/${familyId}/suggested-products`),
    getFavoriteProducts: (familyId) => get(`/api/families/${familyId}/favorite-products`),
};

// --- Plantillas ---
export const templateApi = {
    create: (body) => post('/api/templates', body),
    apply: (templateId, listId) => post(`/api/templates/${templateId}/apply?list_id=${listId}`),
};

// --- Tiendas ---
export const storeApi = {
    getConnectors: () => get('/api/stores/connectors?active_only=true'),
    extractProduct: (body) => post('/api/stores/extract-product', body),
};

export default { listApi, productApi, familyApi, templateApi, storeApi };
