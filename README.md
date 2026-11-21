# Sistema de Gestión de Complejo de Pádel — Backend

API REST para la gestión de un complejo de pádel (canchas, turnos de 90 minutos, reservas, cancelaciones y partidos incompletos). Este repositorio corresponde al **Módulo 0: base del backend** (configuración, conexión a MySQL, manejo de errores, observabilidad y health check).

## Stack

- Node.js con JavaScript puro y módulos **ESM** (`import` / `export`).
- **Express 5**.
- **MySQL** mediante `mysql2` y **Sequelize** (compatible con MySQL Workbench).
- Seguridad y observabilidad: `helmet`, `cors` con credenciales, `express-rate-limit`, `cookie-parser`, `pino` y `pino-http`.
- Variables de entorno con `dotenv`.

## Requisitos

- Node.js 18 o superior.
- MySQL en ejecución y un esquema creado (por defecto `sistema_padel`).

## Instalación

```bash
npm install
```

## Variables de entorno

Copiar `.env.example` a `.env` y completar los valores:

```bash
cp .env.example .env
```

| Variable | Descripción | Requerida |
| --- | --- | --- |
| `PORT` | Puerto HTTP del servidor | No (default `3000`) |
| `NODE_ENV` | Entorno (`development`, `production`, `test`) | No (default `development`) |
| `DB_HOST` | Host de MySQL | Sí |
| `DB_PORT` | Puerto de MySQL | No (default `3306`) |
| `DB_NAME` | Nombre del esquema | Sí |
| `DB_USER` | Usuario de MySQL | Sí |
| `DB_PASSWORD` | Contraseña de MySQL | No (puede ser vacía en local) |
| `JWT_SECRET` | Secreto para firmar JWT | No (requerido por módulos de auth) |
| `JWT_EXPIRES_IN` | Vigencia del JWT | No (default `1d`) |
| `COOKIE_NAME` | Nombre de la cookie HTTPOnly | No (default `padel_token`) |
| `COOKIE_SAME_SITE` | Política SameSite de la cookie | No (default `lax`) |
| `CLIENT_URL` | Origen permitido por CORS | No (default `http://localhost:5173`) |
| `RATE_LIMIT_WINDOW_MS` | Ventana del rate limit en ms | No (default `900000`) |
| `RATE_LIMIT_MAX` | Máximo de peticiones por ventana | No (default `100`) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Configuración SMTP para Nodemailer | No (si faltan, el correo queda deshabilitado) |

> `.env` está ignorado por Git. Nunca se deben versionar secretos reales.

## Arranque

Modo desarrollo (reinicio automático):

```bash
npm run dev
```

Modo producción:

```bash
npm start
```

El servidor valida la configuración, se conecta a MySQL y recién entonces escucha en `PORT`. Si la conexión inicial a MySQL falla, el proceso termina con código 1. Las variables SMTP incompletas no impiden el arranque.

## Verificación del estado

```bash
curl http://localhost:3000/api/health
```

- MySQL disponible:

```json
{
  "status": "ok",
  "server": "up",
  "database": "up",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

- MySQL no disponible (HTTP `503`):

```json
{
  "status": "degraded",
  "server": "up",
  "database": "down",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

El endpoint no requiere autenticación y está excluido del rate limit.

## Estructura

```
src/
├── app.js                  # Definición de la app Express (sin abrir puerto)
├── server.js               # Punto de entrada: conexión a MySQL, listen y apagado ordenado
├── config/
│   ├── env.js              # Carga y validación de variables de entorno
│   ├── database.js         # Instancia Sequelize y health de la base
│   └── logger.js           # Logger Pino
├── controllers/
│   └── health.controller.js
├── middlewares/
│   ├── notFound.js         # 404 JSON
│   └── errorHandler.js     # Manejo global de errores
├── routes/
│   └── health.routes.js
└── utils/
    ├── AppError.js         # Error de aplicación con statusCode
    └── asyncHandler.js     # Wrapper para controladores async
```

## Manejo de errores

Los errores de negocio se lanzan con `AppError(message, statusCode)` y se responden como `{ "status": "error", "message": "..." }`. Los errores inesperados devuelven HTTP `500` con un mensaje genérico (sin detalles internos en producción) y se registran con Pino.

## Apagado

`SIGINT` (Ctrl+C) y `SIGTERM` cierran el servidor HTTP y luego la conexión Sequelize antes de finalizar el proceso.
