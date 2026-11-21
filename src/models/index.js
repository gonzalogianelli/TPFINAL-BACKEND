import { sequelize } from '../config/database.js';
import { logger } from '../config/logger.js';
import { User } from './User.js';
import { Cancha } from './Cancha.js';
import { Turno, DURACION_TURNO_MINUTOS, ESTADOS_TURNO, TURNOS_ACTIVOS } from './Turno.js';
import { Reserva, CUPO_MAXIMO, ESTADOS_RESERVA, RESERVAS_ACTIVAS } from './Reserva.js';

Cancha.hasMany(Turno, { foreignKey: 'canchaId' });
Turno.belongsTo(Cancha, { foreignKey: 'canchaId' });

Turno.hasMany(Reserva, { foreignKey: 'turnoId' });
Reserva.belongsTo(Turno, { foreignKey: 'turnoId' });

User.hasMany(Reserva, { foreignKey: 'usuarioId' });
Reserva.belongsTo(User, { foreignKey: 'usuarioId' });

const initModels = async () => {
  await sequelize.sync();
  logger.info('Modelos sincronizados con MySQL');
  return { User, Cancha, Turno, Reserva };
};

export {
  sequelize,
  User,
  Cancha,
  Turno,
  Reserva,
  DURACION_TURNO_MINUTOS,
  ESTADOS_TURNO,
  TURNOS_ACTIVOS,
  CUPO_MAXIMO,
  ESTADOS_RESERVA,
  RESERVAS_ACTIVAS,
  initModels,
};
