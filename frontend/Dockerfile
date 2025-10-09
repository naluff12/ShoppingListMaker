
# Stage 1: Build the React app
FROM node:18 AS build

WORKDIR /app

COPY package*.json ./
COPY vite.config.js ./
# Usamos npm install para instalar las dependencias
RUN npm install


COPY ./src ./src
COPY public/ ./public
COPY index.html .//

RUN npm run build

# Stage 2: Serve the app with Nginx
FROM nginx:1.21-alpine

# Copiamos la build del stage anterior
COPY --from=build /app/build /usr/share/nginx/html

# Creamos una configuración para Nginx que redirija las llamadas /api al backend
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
