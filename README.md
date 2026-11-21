# Sistema de Gestión de Complejo de Pádel — Backend

API REST para un complejo de pádel. Estado actual: base del backend (Módulo 0) más autenticación, control de roles y gestión de usuarios (Módulo 1). Canchas, turnos, reservas y partidos incompletos se incorporarán en módulos posteriores.

## Stack

- Node.js con JavaScript puro y módulos **ESM** (`import` / `export`).
- **Express 5**.
- **MySQL** mediante `mysql2` y **Sequelize** (compatible con MySQL Workbench).
- Autenticación con **JWT** en cookie **HTTPOnly** y contraseñas hasheadas con **bcryptjs**.
- Seguridad y observabilidad: `helmet`, `cors` con credenciales, `express-rate-limit`, `cookie-parser`, `pino` y `pino-http`.
- Documentación OpenAPI con `swagger-jsdoc` + `swagger-ui-express`.
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
| `JWT_SECRET` | Secreto para firmar JWT | **Sí** |
| `JWT_EXPIRES_IN` | Vigencia del JWT | No (default `1d`) |
| `COOKIE_NAME` | Nombre de la cookie HTTPOnly | No (default `padel_token`) |
| `COOKIE_SAME_SITE` | Política SameSite de la cookie | No (default `lax`) |
| `CLIENT_URL` | Origen permitido por CORS | No (default `http://localhost:5173`) |
| `RATE_LIMIT_WINDOW_MS` | Ventana del rate limit en ms | No (default `900000`) |
| `RATE_LIMIT_MAX` | Máximo de peticiones por ventana | No (default `100`) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Configuración SMTP para Nodemailer | No (si faltan, el correo queda deshabilitado) |

> `.env` está ignorado por Git. Nunca se deben versionar secretos reales. Si `JWT_SECRET` falta, el arranque falla con `Falta la variable de entorno requerida: JWT_SECRET`.

## Arranque

Modo desarrollo (reinicio automático):

```bash
npm run dev
```

Modo producción:

```bash
npm start
```

El servidor valida la configuración, se conecta a MySQL, sincroniza los modelos (creando la tabla `usuarios` si no existe) y recién entonces escucha en `PORT`. Si la conexión inicial a MySQL o la sincronización fallan, el proceso termina con código 1. Las variables SMTP incompletas no impiden el arranque.

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

## Documentación interactiva (Swagger)

- Interfaz: `http://localhost:3000/api-docs` (redirige a `/api-docs/`).
- Documento OpenAPI: `http://localhost:3000/api-docs.json`.

```bash
curl -i http://localhost:3000/api-docs.json
```

Ambas rutas son públicas. El documento declara el esquema de seguridad `cookieAuth` (`apiKey` en cookie, con el nombre configurado en `COOKIE_NAME`, por defecto `padel_token`) y describe los parámetros de ruta/consulta y las respuestas de cada endpoint de auth y usuarios.

## Modelo de usuario

Tabla `usuarios`, creada por `sequelize.sync()` al iniciar. Restricciones y valores permitidos:

| Campo | Tipo / regla |
| --- | --- |
| `id` | INTEGER, PK, autoincremental |
| `nombre` | STRING, obligatorio |
| `email` | STRING, obligatorio, único, con formato de email; se normaliza a minúsculas |
| `password` | STRING, obligatorio; se almacena como hash `bcryptjs` (salt 10) y **nunca** se devuelve en la API |
| `categoria` | ENUM: `octava`, `séptima`, `sexta`, `quinta`, `cuarta`, `tercera`, `segunda`, `primera` |
| `posicionHabitual` | ENUM: `revés`, `drive` |
| `manoDominante` | ENUM: `zurdo`, `diestro` |
| `sexo` | ENUM: `masculino`, `femenino` |
| `telefono` | STRING, obligatorio |
| `rol` | ENUM: `administrador`, `jugador` (default `jugador`) |
| `createdAt` / `updatedAt` | Timestamps de Sequelize |

La contraseña se excluye por defecto de las consultas (`defaultScope`) y de la serialización JSON. `password` debe tener al menos 8 caracteres.

## Autenticación y cookie de sesión

- `POST /api/auth/register` es público y **siempre** crea un usuario con rol `jugador`, aunque el body envíe otro `rol`.
- `POST /api/auth/login` valida credenciales y emite un JWT con `{ id, rol }`.
- El JWT se envía únicamente en una cookie HTTPOnly (`padel_token` por defecto), con `SameSite` configurable, `Secure` en producción y `Path=/`. **No se devuelve el token en el body**.
- El cliente debe conservar y reenviar la cookie (los `curl` de abajo usan `-c`/`-b`). CORS está configurado con `credentials: true`.
- `POST /api/auth/logout` limpia la cookie. No hay revocación del JWT en servidor: sigue vigente hasta `JWT_EXPIRES_IN` si se copiara fuera de la cookie.

### Endpoints

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Público | Alta pública de jugador; responde `201` y deja la sesión iniciada |
| `POST` | `/api/auth/login` | Público | Inicia sesión; responde `200` y establece la cookie |
| `POST` | `/api/auth/logout` | Público | Limpia la cookie; responde `200` |
| `GET` | `/api/users/me` | Cookie | Devuelve el perfil propio; `401` sin sesión |
| `PATCH` | `/api/users/me` | Cookie | Edita el perfil propio; rechaza `rol` con `400` |
| `GET` | `/api/users` | Administrador | Lista con filtros `rol`, `categoria`, `search`, `page`, `limit` |
| `POST` | `/api/users` | Administrador | Crea usuario; permite asignar `rol` |
| `GET` | `/api/users/:id` | Administrador | Consulta por id de ruta; `400` si no es entero positivo, `404` si no existe |
| `PATCH` | `/api/users/:id` | Administrador | Edita usuario y permite cambiar `rol` |

No hay baja/eliminación de usuarios en este módulo. Un `jugador` recibe `403` en los endpoints de gestión; una solicitud sin cookie recibe `401`.

Respuestas: éxito `{ "status": "success", "data": ... }`; los listados agregan `meta: { "page", "limit", "total" }`. Error: `{ "status": "error", "message": "..." }` con códigos `400`, `401`, `403`, `404`, `409` o `500`.

## Verificación rápida

Con el servidor levantado y un email aún no registrado:

```bash
curl -i -c cookies.txt -H "Content-Type: application/json" -d '{"nombre":"Ana Perez","email":"ana.perez@example.com","password":"secreto123","categoria":"sexta","posicionHabitual":"drive","manoDominante":"diestro","sexo":"femenino","telefono":"1123456789"}' http://localhost:3000/api/auth/register

curl -i -b cookies.txt http://localhost:3000/api/users/me

curl -i -X PATCH -b cookies.txt -H "Content-Type: application/json" -d '{"nombre":"Ana Perezactual"}' http://localhost:3000/api/users/me

curl -i http://localhost:3000/api-docs.json
```

El registro y el login devuelven un header `Set-Cookie: padel_token=...; HttpOnly; Path=/; SameSite=Lax` y un body sin `password` ni token. Si el email ya existe, el registro responde `409`; usá otro email.

Para los endpoints de administración, iniciá sesión con un administrador y reutilizá su cookie:

```bash
curl -i -c admin-cookies.txt -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"secreto123"}' http://localhost:3000/api/auth/login

curl -i -b admin-cookies.txt "http://localhost:3000/api/users?rol=jugador&page=1&limit=10"

curl -i -b admin-cookies.txt http://localhost:3000/api/users/<id>

curl -i -b admin-cookies.txt -H "Content-Type: application/json" -d '{"nombre":"Nuevo Jugador","email":"nuevo@example.com","password":"secreto123","categoria":"octava","posicionHabitual":"drive","manoDominante":"diestro","sexo":"masculino","telefono":"1133333333","rol":"jugador"}' http://localhost:3000/api/users

curl -i -X PATCH -b admin-cookies.txt -H "Content-Type: application/json" -d '{"rol":"administrador"}' http://localhost:3000/api/users/<id>
```

Reemplazá `<id>` por un id devuelto por el listado. Para verificar en MySQL Workbench, revisá la tabla `usuarios`: el campo `password` debe contener un hash que empieza con `$2`, nunca el texto original.

## Estructura

```
src/
├── app.js                    # Definición de la app Express (sin abrir puerto)
├── server.js                 # Punto de entrada: MySQL, sync de modelos, listen y apagado ordenado
├── config/
│   ├── env.js                # Carga y validación de variables de entorno
│   ├── database.js           # Instancia Sequelize y health de la base
│   ├── logger.js             # Logger Pino
│   └── swagger.js            # Documento OpenAPI y esquema cookieAuth
├── controllers/
│   ├── health.controller.js
│   ├── auth.controller.js
│   └── user.controller.js
├── middlewares/
│   ├── notFound.js           # 404 JSON
│   ├── errorHandler.js       # Manejo global de errores
│   └── auth.js               # authenticate y requireRole
├── models/
│   ├── index.js              # initModels() + sequelize.sync()
│   └── User.js               # Modelo Usuario (tabla usuarios)
├── routes/
│   ├── health.routes.js
│   ├── auth.routes.js
│   └── user.routes.js
├── services/
│   ├── auth.service.js
│   └── user.service.js
└── utils/
    ├── AppError.js           # Error de aplicación con statusCode
    ├── asyncHandler.js       # Wrapper para controladores async
    └── userValidation.js     # Enums, validación de payloads y parseo de query
```

## Manejo de errores

Los errores de negocio se lanzan con `AppError(message, statusCode)` y se responden como `{ "status": "error", "message": "..." }`. Los errores inesperados devuelven HTTP `500` con un mensaje genérico (sin detalles internos en producción) y se registran con Pino.

## Apagado

`SIGINT` (Ctrl+C) y `SIGTERM` cierran el servidor HTTP y luego la conexión Sequelize antes de finalizar el proceso.
