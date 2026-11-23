import { Op, Transaction } from 'sequelize';
import { Cancha, Turno, TURNOS_ACTIVOS, Reserva, RESERVAS_ACTIVAS } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import {
  calcularFechaHoraFin,
  validateCreateTurnoPayload,
  validateUpdateTurnoPayload,
  parseTurnoId,
  parseTurnoListQuery,
  esTransicionTurnoValida,
} from '../utils/turnoValidation.js';

const MENSAJES_RESERVA_ACTIVA = {
  disponible: 'No se puede republicar un turno con una reserva pendiente o confirmada',
  bloqueado: 'No se puede bloquear un turno con una reserva pendiente o confirmada',
  cancelado: 'No se puede cancelar un turno con una reserva pendiente o confirmada',
};

const ensureSinSolape = async (canchaId, inicio, fin, transaction, excludeId) => {
  const where = {
    canchaId,
    estado: { [Op.in]: TURNOS_ACTIVOS },
    fechaHoraInicio: { [Op.lt]: fin },
    fechaHoraFin: { [Op.gt]: inicio },
  };

  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }

  const solape = await Turno.findOne({ where, transaction });
  if (solape) {
    throw new AppError('El turno se superpone con otro turno activo de la cancha', 409);
  }
};

const getTurnoById = async (value) => {
  const id = parseTurnoId(value);
  const turno = await Turno.findByPk(id, { include: [{ model: Cancha }] });
  if (!turno) {
    throw new AppError('Turno no encontrado', 404);
  }
  return turno;
};

const listTurnos = async (query, user) => {
  const { page, limit, offset, canchaId, estado, fecha } = parseTurnoListQuery(query);
  const where = {};

  if (canchaId) where.canchaId = canchaId;
  if (user?.rol === 'jugador') {
    where.estado = 'disponible';
  } else if (estado) {
    where.estado = estado;
  }

  if (fecha) {
    where.fechaHoraInicio = {
      [Op.between]: [new Date(`${fecha}T00:00:00.000Z`), new Date(`${fecha}T23:59:59.999Z`)],
    };
  }

  const include = user?.rol === 'jugador'
    ? [{ model: Cancha, where: { bloqueada: false }, attributes: ['id', 'nombre'] }]
    : [{ model: Cancha, attributes: ['id', 'nombre'] }];

  const { rows, count } = await Turno.findAndCountAll({
    where,
    include,
    limit,
    offset,
    order: [['fechaHoraInicio', 'ASC'], ['id', 'ASC']],
  });

  return { rows, count, page, limit };
};

const createTurno = async (payload) => {
  const data = validateCreateTurnoPayload(payload);
  const fechaHoraFin = calcularFechaHoraFin(data.fechaHoraInicio);

  return sequelize.transaction(async (transaction) => {
    const cancha = await Cancha.findByPk(data.canchaId, {
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });

    if (!cancha) {
      throw new AppError('Cancha no encontrada', 404);
    }
    if (cancha.bloqueada) {
      throw new AppError('La cancha esta bloqueada', 409);
    }

    await ensureSinSolape(data.canchaId, data.fechaHoraInicio, fechaHoraFin, transaction);

    return Turno.create(
      {
        canchaId: data.canchaId,
        fechaHoraInicio: data.fechaHoraInicio,
        fechaHoraFin,
        estado: data.estado,
      },
      { transaction },
    );
  });
};

const updateTurno = async (value, payload) => {
  const id = parseTurnoId(value);
  const updates = validateUpdateTurnoPayload(payload);

  return sequelize.transaction(async (transaction) => {
    const turno = await Turno.findByPk(id, {
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });

    if (!turno) {
      throw new AppError('Turno no encontrado', 404);
    }

    if (updates.estado !== undefined && !esTransicionTurnoValida(turno.estado, updates.estado)) {
      throw new AppError('Transicion de estado del turno no permitida', 409);
    }

    if (
      MENSAJES_RESERVA_ACTIVA[updates.estado] &&
      updates.estado !== turno.estado
    ) {
      const reservasActivas = await Reserva.findAll({
        where: { turnoId: turno.id, estado: { [Op.in]: RESERVAS_ACTIVAS } },
        attributes: ['id'],
        transaction,
        lock: Transaction.LOCK.UPDATE,
      });
      if (reservasActivas.length > 0) {
        throw new AppError(MENSAJES_RESERVA_ACTIVA[updates.estado], 409);
      }
    }

    const cancha = await Cancha.findByPk(turno.canchaId, {
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });

    const inicio = updates.fechaHoraInicio || turno.fechaHoraInicio;
    const fin = updates.fechaHoraInicio
      ? calcularFechaHoraFin(updates.fechaHoraInicio)
      : turno.fechaHoraFin;

    if (updates.fechaHoraInicio && cancha?.bloqueada) {
      throw new AppError('La cancha esta bloqueada', 409);
    }

    if (updates.fechaHoraInicio) {
      await ensureSinSolape(turno.canchaId, inicio, fin, transaction, turno.id);
    }

    if (Object.keys(updates).length > 0) {
      if (updates.fechaHoraInicio) {
        updates.fechaHoraFin = fin;
      }
      await turno.update(updates, { transaction });
    }

    return turno;
  });
};

export { listTurnos, getTurnoById, createTurno, updateTurno };
