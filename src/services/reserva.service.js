import { Op, Transaction } from 'sequelize';
import { Cancha, Turno, Reserva, RESERVAS_ACTIVAS } from '../models/index.js';
import { sequelize } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import {
  validateCreateReservaPayload,
  validateUpdateCuposPayload,
  parseReservaId,
  parseReservaListQuery,
  lugaresFaltantes,
  esCompleta,
} from '../utils/reservaValidation.js';

const serializeReserva = (reserva) => ({
  ...reserva.toJSON(),
  lugaresOcupados: reserva.cuposOcupados,
  lugaresFaltantes: lugaresFaltantes(reserva.cuposOcupados),
  esCompleta: esCompleta(reserva.cuposOcupados),
});

const getReservaById = async (value, user) => {
  const id = parseReservaId(value);
  const reserva = await Reserva.findByPk(id, { include: [{ model: Turno }] });

  if (!reserva || (user?.rol === 'jugador' && reserva.usuarioId !== user.id)) {
    throw new AppError('Reserva no encontrada', 404);
  }

  return serializeReserva(reserva);
};

const listReservas = async (query, user) => {
  const { page, limit, offset, turnoId, estado, fecha } = parseReservaListQuery(query);
  const where = {};

  if (user?.rol === 'jugador') where.usuarioId = user.id;
  if (turnoId) where.turnoId = turnoId;
  if (estado) where.estado = estado;

  if (fecha) {
    where['$Turno.fechaHoraInicio$'] = {
      [Op.between]: [new Date(`${fecha}T00:00:00.000Z`), new Date(`${fecha}T23:59:59.999Z`)],
    };
  }

  const { rows, count } = await Reserva.findAndCountAll({
    where,
    include: [{ model: Turno, attributes: ['id', 'fechaHoraInicio', 'fechaHoraFin', 'estado'] }],
    limit,
    offset,
    order: [['id', 'ASC']],
  });

  return { rows: rows.map(serializeReserva), count, page, limit };
};

const crearReserva = async (payload, user) => {
  const data = validateCreateReservaPayload(payload);

  return sequelize.transaction(async (transaction) => {
    const turno = await Turno.findByPk(data.turnoId, {
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });

    if (!turno) {
      throw new AppError('Turno no encontrado', 404);
    }
    if (turno.estado !== 'disponible') {
      throw new AppError('El turno ya no esta disponible', 409);
    }

    const cancha = await Cancha.findByPk(turno.canchaId, { transaction });
    if (cancha?.bloqueada) {
      throw new AppError('La cancha esta bloqueada', 409);
    }

    const reservaActiva = await Reserva.findOne({
      where: { turnoId: data.turnoId, estado: { [Op.in]: RESERVAS_ACTIVAS } },
      transaction,
    });
    if (reservaActiva) {
      throw new AppError('El turno ya tiene una solicitud activa', 409);
    }

    const reserva = await Reserva.create(
      {
        turnoId: data.turnoId,
        usuarioId: user.id,
        estado: 'pendiente',
        cuposOcupados: data.cuposOcupados,
      },
      { transaction },
    );

    await turno.update({ estado: 'reservado' }, { transaction });

    return serializeReserva(reserva);
  });
};

const findReservaForDecision = async (value, transaction) => {
  const id = parseReservaId(value);
  const reserva = await Reserva.findByPk(id, {
    transaction,
    lock: Transaction.LOCK.UPDATE,
  });

  if (!reserva) {
    throw new AppError('Reserva no encontrada', 404);
  }

  return reserva;
};

const findTurnoForDecision = async (turnoId, transaction) => {
  const turno = await Turno.findByPk(turnoId, {
    transaction,
    lock: Transaction.LOCK.UPDATE,
  });

  if (!turno) {
    throw new AppError('Turno no encontrado', 404);
  }

  return turno;
};

const confirmarReserva = async (value) =>
  sequelize.transaction(async (transaction) => {
    const reserva = await findReservaForDecision(value, transaction);
    if (reserva.estado !== 'pendiente') {
      throw new AppError('La reserva no esta pendiente', 409);
    }

    await reserva.update({ estado: 'confirmada' }, { transaction });
    return serializeReserva(reserva);
  });

const rechazarReserva = async (value) =>
  sequelize.transaction(async (transaction) => {
    const reserva = await findReservaForDecision(value, transaction);
    if (reserva.estado !== 'pendiente') {
      throw new AppError('La reserva no esta pendiente', 409);
    }

    const turno = await findTurnoForDecision(reserva.turnoId, transaction);
    await reserva.update({ estado: 'rechazada' }, { transaction });
    await turno.update({ estado: 'disponible' }, { transaction });

    return serializeReserva(reserva);
  });

const cancelarReserva = async (value) =>
  sequelize.transaction(async (transaction) => {
    const reserva = await findReservaForDecision(value, transaction);
    if (reserva.estado !== 'confirmada') {
      throw new AppError('Solo se puede cancelar una reserva confirmada', 409);
    }

    const turno = await findTurnoForDecision(reserva.turnoId, transaction);
    await reserva.update({ estado: 'cancelada' }, { transaction });
    await turno.update({ estado: 'cancelado' }, { transaction });

    return serializeReserva(reserva);
  });

const actualizarCupos = async (value, payload) => {
  const updates = validateUpdateCuposPayload(payload);

  return sequelize.transaction(async (transaction) => {
    const reserva = await findReservaForDecision(value, transaction);
    if (!RESERVAS_ACTIVAS.includes(reserva.estado)) {
      throw new AppError('No se pueden actualizar los cupos de una reserva resuelta', 409);
    }

    await reserva.update(updates, { transaction });
    return serializeReserva(reserva);
  });
};

export {
  crearReserva,
  listReservas,
  getReservaById,
  confirmarReserva,
  rechazarReserva,
  cancelarReserva,
  actualizarCupos,
};
