import { Injectable, BadRequestException } from '@nestjs/common';
import type { User, Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { calculateUserTier, shouldUpdateTier } from '../common/utils/tier-calculator.util';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  findMeById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        tier: true,
        creditBalance: true,
        authProvider: true,
        createdAt: true,
        updatedAt: true,
      },
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

  async syncUserTier(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const calculatedTier = calculateUserTier({
      creditBalance: user.creditBalance,
      subscriptions: user.subscriptions,
    });

    if (shouldUpdateTier(user.tier, calculatedTier)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { tier: calculatedTier },
      });
    }
  }

  async getUserWithTier(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          where: {
            status: 'active',
          },
        },
      },
    });
  }

  async updateProfile(
    userId: string,
    data: { username?: string; password?: string },
  ): Promise<User> {
    const updateData: Prisma.UserUpdateInput = {};

    if (data.username !== undefined) {
      updateData.username = data.username.trim() || null;
    }

    if (data.password !== undefined) {
      if (data.password.length < 8 || data.password.length > 72) {
        throw new BadRequestException('비밀번호는 8자 이상 72자 이하여야 합니다.');
      }
      updateData.passwordHash = await bcrypt.hash(data.password, 10);
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('변경할 정보가 없습니다.');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }
}
