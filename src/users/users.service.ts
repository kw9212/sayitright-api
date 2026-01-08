import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  createLocalUser(params: {
    email: string;
    passwordHash: string;
    username?: string;
  }): Promise<User> {
    const { email, passwordHash, username } = params;
    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        username,
        authProvider: 'local',
      },
    });
  }
}
