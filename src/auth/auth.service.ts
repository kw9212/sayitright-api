import { RefreshTokenPayload } from '../common/types/jwt-payload-type';
import { Inject, Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import type { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { REDIS } from 'src/redis/redis.module';
import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwt: JwtService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  private signAccessToken(user: { id: string; email: string }) {
    return this.jwt.signAsync(
      { sub: user.id, email: user.email, typ: 'access' },
      { expiresIn: '5m' },
    );
  }

  private signRefreshToken(user: { id: string; email: string }, jti: string) {
    return this.jwt.signAsync(
      { sub: user.id, email: user.email, typ: 'refresh', jti },
      {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
        expiresIn: '7d',
      },
    );
  }

  private refreshKey(userId: string, jti: string) {
    return `refresh:${userId}:${jti}`;
  }

  private async storeRefreshSession(userId: string, jti: string) {
    const ttl = Number(process.env.JWT_REFRESH_TTL_SEC ?? 60 * 60 * 24 * 7);
    await this.redis.set(this.refreshKey(userId, jti), '1', 'EX', ttl);
  }

  async signup(dto: SignupDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.createLocalUser({
      email: dto.email,
      passwordHash,
      username: dto.username,
    });

    const accessToken = await this.signAccessToken(user);

    return { accessToken };
  }

  async login(dto: LoginDto): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    const accessToken = await this.signAccessToken(user);

    const jti = randomUUID();
    const refreshToken = await this.signRefreshToken(user, jti);
    await this.storeRefreshSession(user.id, jti);

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    });

    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const session = await this.redis.get(this.refreshKey(payload.sub, payload.jti));
    if (!session) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.redis.del(this.refreshKey(payload.sub, payload.jti));

    const newJti = randomUUID();
    const accessToken = await this.signAccessToken(user);
    const newRefreshToken = await this.signRefreshToken(user, newJti);
    await this.storeRefreshSession(user.id, newJti);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
      });

      if (payload.typ !== 'refresh') {
        throw new UnauthorizedException('Invalid credentials');
      }

      await this.redis.del(this.refreshKey(payload.sub, payload.jti));
    } catch {
      return;
    }
  }

  async logoutAll(refreshToken: string): Promise<void> {
    let payload: RefreshTokenPayload | null = null;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
      });
    } catch {
      return;
    }

    if (!payload || payload.typ !== 'refresh') {
      return;
    }

    const userId = payload.sub;
    const pattern = `refresh:${userId}:*`;
    const stream = this.redis.scanStream({ match: pattern, count: 100 });
    const keysToDelete: string[] = [];

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (keys: string[]) => {
        keysToDelete.push(...keys);
      });
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    if (keysToDelete.length > 0) {
      const pipeline = this.redis.pipeline();
      keysToDelete.forEach((key) => pipeline.del(key));
      await pipeline.exec();
    }
  }
}
