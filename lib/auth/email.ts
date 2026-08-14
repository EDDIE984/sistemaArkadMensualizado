import "server-only";

import nodemailer from "nodemailer";

function getMailConfig() {
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
    fromName: process.env.SMTP_FROM_NAME || "Confia",
  };
}

export async function sendActivationEmail({
  email,
  name,
  token,
}: {
  email: string;
  name: string;
  token: string;
}) {
  const config = getMailConfig();
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const activationUrl = `${appUrl}/activar-cuenta?token=${encodeURIComponent(token)}`;
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
  });

  await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: email,
    subject: "Confirma tu cuenta en Confia",
    text: `Hola ${name}. Activa tu cuenta y crea tu contraseña aquí: ${activationUrl}. El enlace expira pronto y solo puede usarse una vez.`,
    html: `
      <div style="margin:0;background:#071426;padding:32px;font-family:Arial,sans-serif;color:#ffffff">
        <div style="max-width:560px;margin:auto;border:1px solid rgba(255,255,255,.18);border-radius:20px;background:#102640;padding:32px">
          <p style="margin:0 0 12px;font-size:12px;letter-spacing:.16em;color:#8fcfff">CONFIA</p>
          <h1 style="margin:0 0 16px;font-size:28px">Confirma tu cuenta</h1>
          <p style="margin:0 0 24px;line-height:1.6;color:#d7e5f4">Hola ${escapeHtml(name)}, confirma tu correo y crea tu contraseña. Este enlace es temporal y solo puede utilizarse una vez.</p>
          <a href="${activationUrl}" style="display:inline-block;border-radius:999px;background:#ffffff;padding:14px 24px;color:#071426;text-decoration:none;font-weight:700">Crear mi contraseña</a>
          <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#91a7bd">Si no solicitaste esta cuenta, puedes ignorar este correo.</p>
        </div>
      </div>`,
  });
}

export async function sendPasswordResetEmail({
  email,
  name,
  token,
}: {
  email: string;
  name: string;
  token: string;
}) {
  const config = getMailConfig();
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const resetUrl = `${appUrl}/restablecer-contrasena?token=${encodeURIComponent(token)}`;
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
  });

  await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromEmail}>`,
    to: email,
    subject: "Restablece tu contraseña en Confia",
    text: `Hola ${name}. Puedes crear una nueva contraseña aquí: ${resetUrl}. El enlace expira pronto y solo puede usarse una vez. Si no lo solicitaste, ignora este correo.`,
    html: `
      <div style="margin:0;background:#071426;padding:32px;font-family:Arial,sans-serif;color:#ffffff">
        <div style="max-width:560px;margin:auto;border:1px solid rgba(255,255,255,.18);border-radius:20px;background:#102640;padding:32px">
          <p style="margin:0 0 12px;font-size:12px;letter-spacing:.16em;color:#8fcfff">CONFIA</p>
          <h1 style="margin:0 0 16px;font-size:28px">Crea una nueva contraseña</h1>
          <p style="margin:0 0 24px;line-height:1.6;color:#d7e5f4">Hola ${escapeHtml(name)}, recibimos una solicitud para restablecer tu contraseña. El enlace es temporal y solo puede utilizarse una vez.</p>
          <a href="${resetUrl}" style="display:inline-block;border-radius:999px;background:#ffffff;padding:14px 24px;color:#071426;text-decoration:none;font-weight:700">Restablecer mi contraseña</a>
          <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#91a7bd">Si no solicitaste este cambio, ignora el correo. Tu contraseña actual seguirá funcionando.</p>
        </div>
      </div>`,
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}
