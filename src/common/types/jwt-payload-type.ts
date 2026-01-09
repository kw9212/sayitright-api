export type RefreshTokenPayload = {
  sub: string;
  email: string;
  typ: 'refresh';
  jti: string;
  iat: number;
  exp: number;
};

export type AccessTokenPayload = {
  sub: string;
  email: string;
  typ: 'access';
  iat?: number;
  exp?: number;
};
