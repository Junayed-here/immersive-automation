import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signUnsubscribeToken(buyerId) {
  return jwt.sign({ type: 'unsubscribe', c: String(buyerId) }, env.linkSecret, { expiresIn: '1y' });
}

export function verifyUnsubscribeToken(token) {
  const payload = jwt.verify(token, env.linkSecret);
  if (payload.type !== 'unsubscribe') {
    throw new Error('Not an unsubscribe token.');
  }
  return { buyerId: payload.c };
}

export function buildUnsubscribeUrl(token) {
  return `${env.appUrl}/unsubscribe/${token}`;
}
