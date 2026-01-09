import type { AccessTokenPayload } from './jwt-payload.type';
import type { Request } from 'express';

export type AuthRequest = Request & {
  user: AccessTokenPayload;
};
