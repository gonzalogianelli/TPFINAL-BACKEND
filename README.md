# Sistema de Gestión de Complejo de Pádel — Backend

API REST para un complejo de pádel. Estado actual: base del backend (Módulo 0), autenticación/roles/usuarios (Módulo 1) y gestión de canchas, turnos de 90 minutos y reservas (Módulo 2). Los partidos incompletos se incorporarán en un módulo posterior.

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

El servidor valida la configuración, se conecta a MySQL, sincroniza los modelos (creando las tablas `usuarios`, `canchas`, `turnos` y `reservas` si no existen) y recién entonces escucha en `PORT`. Si la conexión inicial a MySQL o la sincronización fallan, el proceso termina con código 1. Las variables SMTP incompletas no impiden el arranque.

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

Ambas rutas son públicas. El documento declara el esquema de seguridad `cookieAuth` (`apiKey` en cookie, con el nombre configurado en `COOKIE_NAME`, por defecto `padel_token`), los tags `Usuarios`, `Canchas`, `Turnos`, `Reservas` y `Partidos`, y describe los parámetros de ruta/consulta y las respuestas de todos los endpoints.

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

## Módulo 2: canchas, turnos y reservas

Los modelos nuevos se crean con `sequelize.sync()` al iniciar y se asocian en `src/models/index.js`:

| Tabla | Campos principales | Reglas |
| --- | --- | --- |
| `canchas` | `id`, `nombre`, `bloqueada` | `nombre` no vacío; `bloqueada` default `false` |
| `turnos` | `id`, `canchaId`, `fechaHoraInicio`, `fechaHoraFin`, `estado` | Duración fija de 90 minutos; estados `disponible`, `reservado`, `cancelado`, `jugado`, `bloqueado` |
| `reservas` | `id`, `turnoId`, `usuarioId`, `estado`, `cupoMaximo`, `cuposOcupados` | `cupoMaximo = 4`; `cuposOcupados` entre 1 y 4; estados `pendiente`, `confirmada`, `rechazada`, `cancelada` |

Las respuestas de reserva informan además `lugaresOcupados`, `lugaresFaltantes` y `esCompleta`. `Reserva.cuposOcupados` se conserva como dato histórico agregado; desde el Módulo 3 las inscripciones individuales se gestionan en la tabla `inscripciones` del partido asociado.

### Endpoints

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/canchas` | Cookie | Lista canchas con filtros `nombre`, `bloqueada`, `page`, `limit` (por defecto excluye bloqueadas) |
| `POST` | `/api/canchas` | Administrador | Crea cancha |
| `GET` | `/api/canchas/:id` | Cookie | Consulta por id de ruta |
| `PATCH` | `/api/canchas/:id` | Administrador | Edita nombre o bloqueo |
| `GET` | `/api/turnos` | Cookie | Lista turnos con filtros `fecha`, `canchaId`, `estado`, `page`, `limit`; el jugador siempre ve solo `disponible` |
| `POST` | `/api/turnos` | Administrador | Carga manual de turno de 90 minutos desde `canchaId` y `fechaHoraInicio` |
| `GET` | `/api/turnos/:id` | Cookie | Consulta por id de ruta |
| `PATCH` | `/api/turnos/:id` | Administrador | Cambia fecha/estado, bloquea, cancela, marca `jugado` o republica desde `cancelado` |
| `GET` | `/api/reservas` | Cookie | Jugador ve solo las suyas; administrador ve todas. Filtros `estado`, `turnoId`, `fecha`, `page`, `limit` |
| `POST` | `/api/reservas` | Jugador | Solicita turno indicando `turnoId` y `cuposOcupados`; el turno pasa a `reservado` |
| `GET` | `/api/reservas/:id` | Cookie | Consulta por id de ruta; reserva ajena da `404` para jugador |
| `PATCH` | `/api/reservas/:id` | Administrador | Actualiza `cuposOcupados` |
| `PATCH` | `/api/reservas/:id/confirmar` | Administrador | `pendiente` → `confirmada`; el turno sigue `reservado` |
| `PATCH` | `/api/reservas/:id/rechazar` | Administrador | `pendiente` → `rechazada`; el turno vuelve a `disponible` |
| `PATCH` | `/api/reservas/:id/cancelar` | Administrador | `confirmada` → `cancelada`; el turno queda `cancelado` y requiere republicación manual |

### Reglas de reserva y cupos

- Una sola solicitud `pendiente`/`confirmada` por turno. La creación usa una transacción con `Transaction.LOCK.UPDATE` sobre el turno: una de dos solicitudes concurrentes responde `201` y la otra `409`.
- Solapar turnos activos (`disponible`, `reservado`, `bloqueado`) de una misma cancha responde `409`. Se comparan intervalos semiabiertos `[inicio, fin)`.
- Un turno no se ofrece en el listado de disponibles cuando está `reservado`, `bloqueado`, `cancelado` o `jugado`, ni cuando su cancha está bloqueada.
- Rechazar devuelve el turno a `disponible`; cancelar no. Para republicar, el administrador ejecuta `PATCH /api/turnos/:id` con `{"estado":"disponible"}` sobre un turno cancelado.
- No se bloquea un turno con reserva `pendiente`/`confirmada`: primero debe cancelarse la reserva.
- Las escrituras de reservas por parte de un jugador devuelven `403`; las consultas sin cookie devuelven `401`.

### Flujo completo con curl

Los ejemplos usan las cuentas de prueba `admin@example.com` y `jugador@example.com` con la contraseña de prueba `secreto123`. Reemplazalos si tu base tiene otros usuarios. No se incluyen secretos de entorno.

```bash
curl -s -c admin-cookies.txt -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"secreto123"}' http://localhost:3000/api/auth/login

curl -s -c jugador-cookies.txt -H "Content-Type: application/json" -d '{"email":"jugador@example.com","password":"secreto123"}' http://localhost:3000/api/auth/login

FECHA=$(node -e "process.stdout.write(new Date(Date.now() + 7*24*60*60*1000).toISOString())")

CANCHA_ID=$(curl -s -b admin-cookies.txt -H "Content-Type: application/json" -d '{"nombre":"Cancha 1"}' http://localhost:3000/api/canchas | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(String(JSON.parse(s).data.id)))")

TURNO_ID=$(curl -s -b admin-cookies.txt -H "Content-Type: application/json" -d "{\"canchaId\":$CANCHA_ID,\"fechaHoraInicio\":\"$FECHA\"}" http://localhost:3000/api/turnos | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(String(JSON.parse(s).data.id)))")

curl -s -b jugador-cookies.txt "http://localhost:3000/api/turnos?canchaId=$CANCHA_ID"

RESERVA_ID=$(curl -s -b jugador-cookies.txt -H "Content-Type: application/json" -d "{\"turnoId\":$TURNO_ID,\"cuposOcupados\":2}" http://localhost:3000/api/reservas | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(String(JSON.parse(s).data.id)))")

curl -s -b admin-cookies.txt -X PATCH -H "Content-Type: application/json" -d '{"cuposOcupados":4}' "http://localhost:3000/api/reservas/$RESERVA_ID"

curl -s -b admin-cookies.txt -X PATCH "http://localhost:3000/api/reservas/$RESERVA_ID/confirmar"

curl -s -b admin-cookies.txt -X PATCH "http://localhost:3000/api/reservas/$RESERVA_ID/cancelar"

curl -s -b jugador-cookies.txt "http://localhost:3000/api/turnos?canchaId=$CANCHA_ID"

curl -s -b admin-cookies.txt -X PATCH -H "Content-Type: application/json" -d '{"estado":"disponible"}' "http://localhost:3000/api/turnos/$TURNO_ID"

curl -s -b jugador-cookies.txt "http://localhost:3000/api/turnos?canchaId=$CANCHA_ID"
```

El primer listado de turnos incluye el turno nuevo; luego de la cancelación no lo incluye; después de la republicación vuelve a incluirlo. Los envíos SMTP quedan para el módulo de notificaciones.

## Módulo 3: partidos incompletos

El administrador crea un `Partido` sobre una reserva confirmada. Los jugadores consultan huecos y se inscriben; las bajas y la cancelación por falta de quórum nunca republican el turno automáticamente.

| Tabla | Campos principales | Reglas |
| --- | --- | --- |
| `partidos` | `id`, `reservaId`, `categoria`, `estado` | `reservaId` único; un solo partido por reserva; estados `incompleto`, `completo`, `cancelado`, `jugado` |
| `inscripciones` | `id`, `partidoId`, `usuarioId` | Única compuesta `(partidoId, usuarioId)`; máximo 4 filas por partido |

`cupoMaximo` es siempre 4. `lugaresOcupados` es la cantidad real de inscripciones y `lugaresFaltantes = 4 - lugaresOcupados`. Un partido pasa a `completo` al alcanzar 4 inscriptos.

### Reglas de categoría, cupo y concurrencia

- Categorías válidas: `octava`, `séptima`, `sexta`, `quinta`, `cuarta`, `tercera`, `segunda`, `primera` (la misma que en `usuarios`).
- Un jugador puede inscribirse si su categoría es igual a la del partido o está como máximo **una categoría por encima** (por ejemplo, en `octava` entran `octava` y `séptima`).
- El turno asociado debe estar `reservado`. El alta rechaza reservas no confirmadas o duplicadas con `409`.
- La inscripción usa `sequelize.transaction()` con `Transaction.LOCK.UPDATE` sobre el partido: ante dos inscripciones simultáneas al último lugar, una responde `201` y la otra `409`.
- Cambiar `categoria` revalida a todos los inscriptos; si alguno queda fuera de rango, responde `409`. Solo un partido `completo` puede cerrarse como `jugado`.
- Dar de baja un inscripto no modifica el turno. El administrador puede borrar cualquier inscripción; un jugador solo la propia (`403` si intenta borrar otra).
- Cancelar por quórum elimina las inscripciones y marca `partido`, `reserva` y `turno` como `cancelados`. El turno no reaparece en `GET /api/turnos` hasta una republicación manual del administrador.
- `Reserva.cuposOcupados` queda como dato histórico: no se sincroniza con el nuevo listado de inscriptos.

### Endpoints

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| `GET` | `/api/partidos` | Cookie | Lista con filtros `categoria`, `estado`, `fecha`, `page`, `limit`; el jugador solo ve `incompleto` |
| `POST` | `/api/partidos` | Administrador | Alta sobre `reservaId` confirmada y turno `reservado` |
| `GET` | `/api/partidos/:id` | Cookie | Detalle con inscriptos y huecos; jugador ve el suyo aunque esté completo, `404` si es ajeno |
| `PATCH` | `/api/partidos/:id` | Administrador | Cambia `categoria` o cierra a `jugado` (solo si está `completo`) |
| `POST` | `/api/partidos/:id/inscripciones` | Jugador | Inscripción al hueco con bloqueo transaccional |
| `DELETE` | `/api/partidos/:id/inscripciones/:usuarioId` | Cookie | Baja propia (jugador) o de cualquier inscripto (administrador) |
| `PATCH` | `/api/partidos/:id/cancelar` | Administrador | Cancelación por falta de quórum; `409` si está `completo` |

### Flujo completo con curl

```bash
curl -s -c admin-cookies.txt -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"secreto123"}' http://localhost:3000/api/auth/login

curl -s -c jugador-cookies.txt -H "Content-Type: application/json" -d '{"email":"jugador@example.com","password":"secreto123"}' http://localhost:3000/api/auth/login

J2_EMAIL="qa-sexta-$(date +%s)@example.com"
curl -s -b admin-cookies.txt -H "Content-Type: application/json" -d "{\"nombre\":\"Jugador QA\",\"email\":\"$J2_EMAIL\",\"password\":\"secreto123\",\"categoria\":\"quinta\",\"posicionHabitual\":\"drive\",\"manoDominante\":\"diestro\",\"sexo\":\"masculino\",\"telefono\":\"1144444444\",\"rol\":\"jugador\"}" http://localhost:3000/api/users
curl -s -c jugador2-cookies.txt -H "Content-Type: application/json" -d "{\"email\":\"$J2_EMAIL\",\"password\":\"secreto123\"}" http://localhost:3000/api/auth/login

CANCHA_ID=$(curl -s -b admin-cookies.txt -H "Content-Type: application/json" -d '{"nombre":"Cancha Partido 1"}' http://localhost:3000/api/canchas | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(String(JSON.parse(s).data.id)))")
FECHA=$(node -e "process.stdout.write(new Date(Date.now() + 8*24*60*60*1000).toISOString())")
TURNO_ID=$(curl -s -b admin-cookies.txt -H "Content-Type: application/json" -d "{\"canchaId\":$CANCHA_ID,\"fechaHoraInicio\":\"$FECHA\"}" http://localhost:3000/api/turnos | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(String(JSON.parse(s).data.id)))")

RESERVA_ID=$(curl -s -b jugador-cookies.txt -H "Content-Type: application/json" -d "{\"turnoId\":$TURNO_ID,\"cuposOcupados\":1}" http://localhost:3000/api/reservas | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(String(JSON.parse(s).data.id)))")
curl -s -b admin-cookies.txt -X PATCH "http://localhost:3000/api/reservas/$RESERVA_ID/confirmar"

PARTIDO_ID=$(curl -s -b admin-cookies.txt -H "Content-Type: application/json" -d "{\"reservaId\":$RESERVA_ID,\"categoria\":\"sexta\"}" http://localhost:3000/api/partidos | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(String(JSON.parse(s).data.id)))")

curl -s -b jugador-cookies.txt "http://localhost:3000/api/partidos?categoria=sexta&estado=incompleto"
curl -s -b jugador-cookies.txt "http://localhost:3000/api/partidos/$PARTIDO_ID"

curl -s -b jugador-cookies.txt -X POST "http://localhost:3000/api/partidos/$PARTIDO_ID/inscripciones"
curl -s -b jugador2-cookies.txt -X POST "http://localhost:3000/api/partidos/$PARTIDO_ID/inscripciones"
curl -s -b jugador2-cookies.txt -X DELETE "http://localhost:3000/api/partidos/$PARTIDO_ID/inscripciones/$(curl -s -b jugador2-cookies.txt http://localhost:3000/api/users/me | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(String(JSON.parse(s).data.id)))")"

curl -s -b admin-cookies.txt -X PATCH "http://localhost:3000/api/partidos/$PARTIDO_ID/cancelar"
curl -s -b jugador-cookies.txt "http://localhost:3000/api/turnos?canchaId=$CANCHA_ID"
```

El detalle del partido informa `lugaresOcupados`/`lugaresFaltantes` en cada paso. Después de la cancelación, `partidos`, `reservas` y `turnos` quedan con estado `cancelado`/`cancelada` y el turno no aparece en el último listado.

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
│   ├── user.controller.js
│   ├── cancha.controller.js
│   ├── turno.controller.js
│   ├── reserva.controller.js
│   └── partido.controller.js
├── middlewares/
│   ├── notFound.js           # 404 JSON
│   ├── errorHandler.js       # Manejo global de errores
│   └── auth.js               # authenticate y requireRole
├── models/
│   ├── index.js              # initModels(), asociaciones y sequelize.sync()
│   ├── User.js               # Modelo Usuario (tabla usuarios)
│   ├── Cancha.js             # Modelo Cancha (tabla canchas)
│   ├── Turno.js              # Modelo Turno (tabla turnos)
│   ├── Reserva.js            # Modelo Reserva (tabla reservas)
│   ├── Partido.js            # Modelo Partido (tabla partidos)
│   └── Inscripcion.js        # Modelo Inscripcion (tabla inscripciones)
├── routes/
│   ├── health.routes.js
│   ├── auth.routes.js
│   ├── user.routes.js
│   ├── cancha.routes.js
│   ├── turno.routes.js
│   ├── reserva.routes.js
│   └── partido.routes.js
├── services/
│   ├── auth.service.js
│   ├── user.service.js
│   ├── cancha.service.js
│   ├── turno.service.js
│   ├── reserva.service.js
│   └── partido.service.js
└── utils/
    ├── AppError.js           # Error de aplicación con statusCode
    ├── asyncHandler.js       # Wrapper para controladores async
    ├── userValidation.js     # Enums, validación de payloads y parseo de query
    ├── canchaValidation.js
    ├── turnoValidation.js
    ├── reservaValidation.js
    └── partidoValidation.js
```

## Manejo de errores

Los errores de negocio se lanzan con `AppError(message, statusCode)` y se responden como `{ "status": "error", "message": "..." }`. Los errores inesperados devuelven HTTP `500` con un mensaje genérico (sin detalles internos en producción) y se registran con Pino.

## Apagado

`SIGINT` (Ctrl+C) y `SIGTERM` cierran el servidor HTTP y luego la conexión Sequelize antes de finalizar el proceso.
