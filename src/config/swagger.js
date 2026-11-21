import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './env.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const routesGlob = path.join(currentDir, '..', 'routes', '*.js').replaceAll('\\', '/');

const usuarioSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', example: 1 },
    nombre: { type: 'string', example: 'Ana Perez' },
    email: { type: 'string', format: 'email', example: 'ana@example.com' },
    categoria: {
      type: 'string',
      enum: ['octava', 'séptima', 'sexta', 'quinta', 'cuarta', 'tercera', 'segunda', 'primera'],
      example: 'sexta',
    },
    posicionHabitual: { type: 'string', enum: ['revés', 'drive'], example: 'revés' },
    manoDominante: { type: 'string', enum: ['zurdo', 'diestro'], example: 'zurdo' },
    sexo: { type: 'string', enum: ['masculino', 'femenino'], example: 'femenino' },
    telefono: { type: 'string', example: '1123456789' },
    rol: { type: 'string', enum: ['administrador', 'jugador'], example: 'jugador' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

const userFields = {
  nombre: { type: 'string', example: 'Ana Perez' },
  email: { type: 'string', format: 'email', example: 'ana@example.com' },
  password: { type: 'string', minLength: 8, example: 'secreto123' },
  categoria: {
    type: 'string',
    enum: ['octava', 'séptima', 'sexta', 'quinta', 'cuarta', 'tercera', 'segunda', 'primera'],
  },
  posicionHabitual: { type: 'string', enum: ['revés', 'drive'] },
  manoDominante: { type: 'string', enum: ['zurdo', 'diestro'] },
  sexo: { type: 'string', enum: ['masculino', 'femenino'] },
  telefono: { type: 'string', example: '1123456789' },
  rol: { type: 'string', enum: ['administrador', 'jugador'] },
};

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'API Sistema de Gestion de Padel',
      version: '1.0.0',
      description:
        'API REST del complejo de padel. La sesion se mantiene en una cookie HTTPOnly con JWT.',
    },
    servers: [{ url: `http://localhost:${config.server.port}`, description: 'Servidor local' }],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: config.cookie.name,
        },
      },
      schemas: {
        Usuario: usuarioSchema,
        ErrorResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'error' },
            message: { type: 'string', example: 'Mensaje de error' },
          },
        },
        SuccessUserResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'success' },
            data: { $ref: '#/components/schemas/Usuario' },
          },
        },
        SuccessUsersResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'success' },
            data: { type: 'array', items: { $ref: '#/components/schemas/Usuario' } },
            meta: {
              type: 'object',
              properties: {
                page: { type: 'integer', example: 1 },
                limit: { type: 'integer', example: 10 },
                total: { type: 'integer', example: 25 },
              },
            },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: [
            'nombre',
            'email',
            'password',
            'categoria',
            'posicionHabitual',
            'manoDominante',
            'sexo',
            'telefono',
          ],
          properties: {
            nombre: userFields.nombre,
            email: userFields.email,
            password: userFields.password,
            categoria: userFields.categoria,
            posicionHabitual: userFields.posicionHabitual,
            manoDominante: userFields.manoDominante,
            sexo: userFields.sexo,
            telefono: userFields.telefono,
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: userFields.email,
            password: { type: 'string', example: 'secreto123' },
          },
        },
        UserCreateRequest: {
          type: 'object',
          required: [
            'nombre',
            'email',
            'password',
            'categoria',
            'posicionHabitual',
            'manoDominante',
            'sexo',
            'telefono',
          ],
          properties: {
            nombre: userFields.nombre,
            email: userFields.email,
            password: userFields.password,
            categoria: userFields.categoria,
            posicionHabitual: userFields.posicionHabitual,
            manoDominante: userFields.manoDominante,
            sexo: userFields.sexo,
            telefono: userFields.telefono,
            rol: userFields.rol,
          },
        },
        UserUpdateRequest: {
          type: 'object',
          properties: {
            nombre: userFields.nombre,
            email: userFields.email,
            password: userFields.password,
            categoria: userFields.categoria,
            posicionHabitual: userFields.posicionHabitual,
            manoDominante: userFields.manoDominante,
            sexo: userFields.sexo,
            telefono: userFields.telefono,
            rol: userFields.rol,
          },
        },
      },
    },
  },
  apis: [routesGlob],
};

const swaggerSpec = swaggerJsdoc(options);

export { swaggerSpec };
