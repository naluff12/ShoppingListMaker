"""Genera los íconos PWA (192, 512, 512 maskable) en PNG puro (zlib+struct).

Dibuja un carrito de compras blanco sobre fondo azul degradado.
"""
import struct, zlib, math, os

def make_png(size, pixels):
    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    raw = b''
    for y in range(size):
        raw += b'\x00'  # filter none
        for x in range(size):
            r, g, b, a = pixels[y][x]
            raw += bytes((r, g, b, a))
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

def lerp(a, b, t):
    return int(a + (b - a) * t)

def in_rounded(x, y, size, radius):
    # Esquina redondeada: distancia al círculo de la esquina
    r = radius
    if x < r and y < r: return math.hypot(x - r, y - r) <= r
    if x >= size - r and y < r: return math.hypot(x - (size - r), y - r) <= r
    if x < r and y >= size - r: return math.hypot(x - r, y - (size - r)) <= r
    if x >= size - r and y >= size - r: return math.hypot(x - (size - r), y - (size - r)) <= r
    return True

def draw_cart(size, scale=1.0, maskable=False):
    """scale: 1.0 llena el canvas; maskable usa 0.62 (zona segura 80%)."""
    S = size
    px = [[(0, 0, 0, 0)] * S for _ in range(S)]
    # Fondo: gradiente azul diagonal con esquinas redondeadas
    for y in range(S):
        for x in range(S):
            if in_rounded(x, y, S, S // 8):
                t = (x + y) / (2 * S)
                px[y][x] = (lerp(0x3b, 0x1d, t), lerp(0x82, 0x4e, t), lerp(0xf6, 0xd8, t), 255)
    # Carrito: coordenadas normalizadas centradas, escaladas
    def nx(v): return S / 2 + v * S * scale / 2   # v en [-1,1]
    def ny(v): return S / 2 + v * S * scale / 2

    # Cesta (rectángulo con fondo ligeramente más oscuro y borde blanco)
    bx0, bx1 = nx(-0.62), nx(0.62)
    by0, by1 = ny(0.30), ny(0.85)
    # Ruedas
    wheel_r = S * 0.045 * scale
    for wx in (nx(-0.45), nx(0.45)):
        for yy in range(S):
            for xx in range(S):
                if math.hypot(xx - wx, yy - ny(0.85) + wheel_r * 0.3) <= wheel_r:
                    px[yy][xx] = (30, 41, 59, 255)
    # Cesta: borde blanco grueso
    for yy in range(S):
        for xx in range(S):
            if bx0 <= xx <= bx1 and by0 <= yy <= by1:
                # interior de la cesta un poco más claro que el fondo
                t = (xx + yy) / (2 * S)
                px[yy][xx] = (lerp(0x60, 0x2a, t), lerp(0xa5, 0x6b, t), lerp(0xfa, 0xe0, t), 255)
    # Borde superior de la cesta (línea más clara)
    for xx in range(S):
        if bx0 <= xx <= bx1:
            for dy in range(max(1, S // 128)):
                yy = int(by0) + dy
                if yy < S:
                    px[yy][xx] = (255, 255, 255, 255)
    # Manija (arco)
    cx, cy, rad = nx(0.0), ny(0.18), S * 0.34 * scale
    for yy in range(S):
        for xx in range(S):
            d = math.hypot(xx - cx, yy - cy)
            if rad - S * 0.028 * scale <= d <= rad and yy < cy:
                px[yy][xx] = (255, 255, 255, 255)
    return px

os.makedirs('frontend/public/icons', exist_ok=True)
for name, size, scale, mask in [
    ('pwa-192x192.png', 192, 1.0, False),
    ('pwa-512x512.png', 512, 1.0, False),
    ('pwa-maskable-512.png', 512, 0.62, True),
]:
    data = make_png(size, draw_cart(size, scale, mask))
    with open(f'frontend/public/icons/{name}', 'wb') as f:
        f.write(data)
    print(f'{name}: {size}x{size} {len(data)}B')
