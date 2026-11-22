import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

let transporter;

if (!config.smtp.enabled) {
  logger.warn(
    { event: 'email.disabled' },
    'SMTP no configurado; las notificaciones por correo estan deshabilitadas',
  );
}

const buildTransporter = () => {
  if (!config.smtp.enabled) return null;

  const auth =
    config.smtp.user && config.smtp.pass
      ? { user: config.smtp.user, pass: config.smtp.pass }
      : undefined;

  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    ...(auth ? { auth } : {}),
  });
};

const getTransporter = () => {
  if (transporter === undefined) {
    transporter = buildTransporter();
  }
  return transporter;
};

const recipientCount = (to) => (Array.isArray(to) ? to.length : 1);

const sendEmail = async (message, overrideTransporter) => {
  const activeTransporter = overrideTransporter ?? getTransporter();
  if (!activeTransporter) {
    return { delivered: false, reason: 'disabled' };
  }

  try {
    await activeTransporter.sendMail({
      from: config.smtp.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    logger.info(
      { event: message.event, recipientCount: recipientCount(message.to) },
      'Correo enviado',
    );
    return { delivered: true };
  } catch (error) {
    logger.warn(
      {
        event: message.event,
        recipientCount: recipientCount(message.to),
        error: error?.message,
      },
      'No se pudo enviar el correo',
    );
    return { delivered: false, reason: 'error' };
  }
};

export { sendEmail };
