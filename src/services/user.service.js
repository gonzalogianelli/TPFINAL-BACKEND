import { Op } from 'sequelize';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import {
  validateCreateUserPayload,
  validateUpdateUserPayload,
  parseUserListQuery,
} from '../utils/userValidation.js';
import { notifyUserRegistered } from './notification.service.js';

const isUniqueConstraintError = (error) => error?.name === 'SequelizeUniqueConstraintError';

const ensureEmailAvailable = async (email, excludeId) => {
  const where = { email };
  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }
  const existing = await User.findOne({ where });
  if (existing) {
    throw new AppError('El email ya esta registrado', 409);
  }
};

const getUserById = async (id) => {
  const user = await User.findByPk(id);
  if (!user) {
    throw new AppError('Usuario no encontrado', 404);
  }
  return user;
};

const updateOwnProfile = async (user, payload) => {
  const updates = validateUpdateUserPayload(payload, { allowRole: false });

  if (updates.email && updates.email !== user.email) {
    await ensureEmailAvailable(updates.email, user.id);
  }

  if (Object.keys(updates).length === 0) {
    return user;
  }

  try {
    await user.update(updates);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError('El email ya esta registrado', 409);
    }
    throw error;
  }

  return user;
};

const listUsers = async (query) => {
  const { page, limit, offset, rol, categoria, search } = parseUserListQuery(query);

  const where = {};
  if (rol) where.rol = rol;
  if (categoria) where.categoria = categoria;
  if (search) {
    where[Op.or] = [
      { nombre: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
    ];
  }

  const { rows, count } = await User.findAndCountAll({
    where,
    limit,
    offset,
    order: [['id', 'ASC']],
  });

  return { rows, count, page, limit };
};

const createUser = async (payload, deps = {}) => {
  const data = validateCreateUserPayload(payload, { allowRole: true });
  await ensureEmailAvailable(data.email);

  try {
    const user = await User.create(data);
    notifyUserRegistered(user, deps);
    return user;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError('El email ya esta registrado', 409);
    }
    throw error;
  }
};

const updateUser = async (id, payload) => {
  const user = await getUserById(id);
  const updates = validateUpdateUserPayload(payload, { allowRole: true });

  if (updates.email && updates.email !== user.email) {
    await ensureEmailAvailable(updates.email, user.id);
  }

  if (Object.keys(updates).length === 0) {
    return user;
  }

  try {
    await user.update(updates);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError('El email ya esta registrado', 409);
    }
    throw error;
  }

  return user;
};

export { getUserById, updateOwnProfile, listUsers, createUser, updateUser };
