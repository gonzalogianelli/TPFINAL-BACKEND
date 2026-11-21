import { sequelize } from '../config/database.js';
import { logger } from '../config/logger.js';
import { User } from './User.js';

const initModels = async () => {
  await sequelize.sync();
  logger.info('Modelos sincronizados con MySQL');
  return { User };
};

export { sequelize, User, initModels };
