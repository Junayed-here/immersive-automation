import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let cachedSmtpTransport = null;
const mockSentMessages = [];

function getSmtpTransport() {
  if (!cachedSmtpTransport) {
    cachedSmtpTransport = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      // 465 is implicit TLS; anything else (587, MailDev's 1025) negotiates
      // STARTTLS opportunistically if the server offers it, plain otherwise.
      secure: env.smtpPort === 465,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
    });
  }
  return cachedSmtpTransport;
}

/**
 * MAIL_TRANSPORT=mock pushes into an in-memory array instead of hitting SMTP -
 * used by tests to assert on sends without needing MailDev running, and to
 * deterministically simulate a per-recipient send failure.
 */
export async function sendMail({ to, subject, html, replyTo }) {
  if (env.mailTransport === 'mock') {
    if (!to || !EMAIL_RE.test(to)) {
      throw new Error(`Refusing to send to invalid address "${to}".`);
    }
    const message = {
      to,
      subject,
      html,
      replyTo,
      messageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    mockSentMessages.push(message);
    return message;
  }

  const transport = getSmtpTransport();
  return transport.sendMail({ from: env.mailFrom, to, replyTo, subject, html });
}

export function getMockSentMessages() {
  return mockSentMessages;
}

export function clearMockSentMessages() {
  mockSentMessages.length = 0;
}
