# Servicio de navegador headless (Playwright/Chromium) para scraping de
# tiendas que requieren JS o tienen anti-bot (Walmart/Akamai, MercadoLibre,
# Smart, HEB, Cyberpuerta, Amazon). Expone un POST /render que recibe {url, wait_ms}
# y devuelve el DOM renderizado + título.
FROM mcr.microsoft.com/playwright/python:v1.45.0-jammy

# La imagen base trae los navegadores/Chromium + dependencias del sistema,
# pero NO el paquete python playwright. Lo instalamos con la misma versión
# para reutilizar el navegador ya descargado (sin volver a bajarlo).
RUN python -m pip install --no-cache-dir playwright==1.45.0

WORKDIR /app
COPY render_server.py /app/

EXPOSE 8580
CMD ["python", "/app/render_server.py"]