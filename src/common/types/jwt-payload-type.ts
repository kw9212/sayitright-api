export type RefreshTokenPayload = {
  sub: string;
  email: string;
  typ: 'refresh';
  jti: string;
  iat: number;
  exp: number;
};
