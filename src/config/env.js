import 'dotenv/config';

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';

const required = (name) => {
  const value = process.env[name];
  if (isBlank(value)) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
  return String(value).trim();
};

const optional = (name, fallback = '') => {
  const value = process.env[name];
  return isBlank(value) ? fallback : String(value).trim();
};

const toNumber = (name, fallback) => {
  const value = process.env[name];
  if (isBlank(value)) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`La variable de entorno ${name} debe ser numerica`);
  }
  return parsed;
};

const toBoolean = (name, fallback = false) => {
  const value = process.env[name];
  if (isBlank(value)) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const buildSmtpConfig = () => {
  const host = optional('SMTP_HOST');
  const port = toNumber('SMTP_PORT', 587);
  const user = optional('SMTP_USER');
  const pass = optional('SMTP_PASS');
  const from = optional('SMTP_FROM');
  const secure = toBoolean('SMTP_SECURE', false);
  const enabled = Boolean(host && port && from);

  return Object.freeze({ enabled, host, port, secure, user, pass, from });
};

const config = Object.freeze({
  env: optional('NODE_ENV', 'development'),
  server: Object.freeze({
    port: toNumber('PORT', 3000),
  }),
  db: Object.freeze({
    host: required('DB_HOST'),
    port: toNumber('DB_PORT', 3306),
    name: required('DB_NAME'),
    user: required('DB_USER'),
    password: optional('DB_PASSWORD'),
  }),
  jwt: Object.freeze({
    secret: required('JWT_SECRET'),
    expiresIn: optional('JWT_EXPIRES_IN', '1d'),
  }),
  cookie: Object.freeze({
    name: optional('COOKIE_NAME', 'padel_token'),
    sameSite: optional('COOKIE_SAME_SITE', 'lax'),
  }),
  cors: Object.freeze({
    origin: optional('CLIENT_URL', 'http://localhost:5173'),
  }),
  rateLimit: Object.freeze({
    windowMs: toNumber('RATE_LIMIT_WINDOW_MS', 900000),
    max: toNumber('RATE_LIMIT_MAX', 100),
  }),
  smtp: buildSmtpConfig(),
});

export { config };
