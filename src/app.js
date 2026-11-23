import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { swaggerSpec } from './config/swagger.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { userRouter } from './routes/user.routes.js';
import { canchaRouter } from './routes/cancha.routes.js';
import { turnoRouter } from './routes/turno.routes.js';
import { reservaRouter } from './routes/reserva.routes.js';
import { partidoRouter } from './routes/partido.routes.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', config.server.trustProxy);

app.use(helmet());
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  pinoHttp({
    logger,
    redact: {
      paths: ['req.headers.cookie', 'res.headers["set-cookie"]', 'req.headers.authorization'],
      censor: '[REDACTED]',
    },
  }),
);

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => /^\/api\/health\/?$/.test(req.path),
  handler: (req, res) => {
    res.status(429).json({
      status: 'error',
      message: 'Demasiadas peticiones, intenta nuevamente mas tarde',
    });
  },
});

app.use(limiter);

app.get('/api-docs.json', (req, res) => res.status(200).json(swaggerSpec));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/canchas', canchaRouter);
app.use('/api/turnos', turnoRouter);
app.use('/api/reservas', reservaRouter);
app.use('/api/partidos', partidoRouter);

app.use(notFound);
app.use(errorHandler);

export { app };
