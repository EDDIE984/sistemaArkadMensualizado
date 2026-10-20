import "server-only";

import nodemailer from "nodemailer";

/** Configuración SMTP compartida por todos los correos de la plataforma. */
export function getMailConfig() {
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const fromEmail = process.env.SMTP_FROM_EMAIL || user;

  if (!user || !password || !fromEmail) {
    throw new Error("Falta configurar SMTP_USER, SMTP_PASSWORD o SMTP_FROM_EMAIL.");
  }

  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    user,
    password,
    fromEmail,
    fromName: process.env.SMTP_FROM_NAME || "Kuantiq",
  };
}

export function createMailTransport(config = getMailConfig()) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
  });
}
