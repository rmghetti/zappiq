import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { JwtPayload } from '../middleware/auth.js';

export function signToken(user: { id: string; email: string; role: string }, organizationId: string): string {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    organizationId,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh' }, env.JWT_SECRET, {
    expiresIn: '30d',
  });
}

export function verifyRefreshToken(token: string): { userId: string } {
  const decoded = jwt.verify(token, env.JWT_SECRET) as any;
  if (decoded.type !== 'refresh') throw new Error('Invalid refresh token');
  return { userId: decoded.userId };
}
