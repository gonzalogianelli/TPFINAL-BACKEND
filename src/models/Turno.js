import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Cancha } from './Cancha.js';

const DURACION_TURNO_MINUTOS = 90;
const MILISEGUNDOS_POR_MINUTO = 60 * 1000;
const ESTADOS_TURNO = ['disponible', 'reservado', 'cancelado', 'jugado', 'bloqueado'];
const TURNOS_ACTIVOS = ['disponible', 'reservado', 'bloqueado'];

class Turno extends Model {}

Turno.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    canchaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Cancha, key: 'id' },
    },
    fechaHoraInicio: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    fechaHoraFin: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        duracionCorrecta(value) {
          if (!value || !this.fechaHoraInicio) return;
          const diferencia = new Date(value).getTime() - new Date(this.fechaHoraInicio).getTime();
          if (diferencia !== DURACION_TURNO_MINUTOS * MILISEGUNDOS_POR_MINUTO) {
            throw new Error(`La duracion del turno debe ser de ${DURACION_TURNO_MINUTOS} minutos`);
          }
        },
      },
    },
    estado: {
      type: DataTypes.ENUM(...ESTADOS_TURNO),
      allowNull: false,
      defaultValue: 'disponible',
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Turno',
    tableName: 'turnos',
    timestamps: true,
    paranoid: true,
  },
);

export { Turno, DURACION_TURNO_MINUTOS, ESTADOS_TURNO, TURNOS_ACTIVOS };
