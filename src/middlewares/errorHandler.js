import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

const isProduction = config.env === 'production';

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const isOperational = err instanceof Error && err.isOperational === true;
  const statusCode = isOperational && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const message = isOperational ? err.message : 'Error interno del servidor';

  logger.error(
    {
      err,
      method: req.method,
      url: req.originalUrl,
      statusCode,
    },
    'Error en la peticion',
  );

  const body = { status: 'error', message };

  if (!isProduction && !isOperational && err instanceof Error && err.stack) {
    body.stack = err.stack;
  }

  return res.status(statusCode).json(body);
};

export { errorHandler };
