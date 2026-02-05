/**
 * UsersService 테스트
 *
 * 사용자 관리 서비스의 핵심 로직을 테스트
 * - 사용자 조회 (이메일, ID)
 * - 사용자 생성
 * - 프로필 업데이트
 * - 티어 동기화
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createMockPrismaService, createTestUser, expectToThrowAsync } from '../test/test-helpers';

// bcrypt mock
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('UsersService', () => {
  let service: UsersService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('사용자 조회', () => {
    describe('findByEmail', () => {
      it('이메일로 사용자를 조회할 수 있어야 한다', async () => {
        // Given: 존재하는 사용자
        const user = createTestUser({ email: 'test@example.com' });
        prisma.user.findUnique.mockResolvedValue(user);

        // When: 이메일로 조회
        const result = await service.findByEmail('test@example.com');

        // Then: 사용자가 반환됨
        expect(result).toEqual(user);
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { email: 'test@example.com' },
        });
      });

      it('존재하지 않는 이메일이면 null을 반환해야 한다', async () => {
        // Given: 존재하지 않는 사용자
        prisma.user.findUnique.mockResolvedValue(null);

        // When: 이메일로 조회
        const result = await service.findByEmail('notfound@example.com');

        // Then: null 반환
        expect(result).toBeNull();
      });
    });

    describe('findById', () => {
      it('ID로 사용자를 조회할 수 있어야 한다', async () => {
        // Given: 존재하는 사용자
        const user = createTestUser({ id: 'user-123' });
        prisma.user.findUnique.mockResolvedValue(user);

        // When: ID로 조회
        const result = await service.findById('user-123');

        // Then: 사용자가 반환됨
        expect(result).toEqual(user);
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { id: 'user-123' },
        });
      });

      it('존재하지 않는 ID면 null을 반환해야 한다', async () => {
        // Given: 존재하지 않는 사용자
        prisma.user.findUnique.mockResolvedValue(null);

        // When: ID로 조회
        const result = await service.findById('invalid-id');

        // Then: null 반환
        expect(result).toBeNull();
      });
    });

    describe('findMeById', () => {
      it('내 정보를 조회할 때 필요한 필드만 반환해야 한다', async () => {
        // Given: 사용자 정보
        const userInfo = {
          id: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          tier: 'free' as const,
          creditBalance: 0,
          authProvider: 'local' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        prisma.user.findUnique.mockResolvedValue(userInfo);

        // When: 내 정보 조회
        const result = await service.findMeById('user-123');

        // Then: 선택된 필드만 반환됨
        expect(result).toEqual(userInfo);
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { id: 'user-123' },
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
      });
    });
  });

  describe('사용자 생성', () => {
    describe('createLocalUser', () => {
      it('로컬 사용자를 생성할 수 있어야 한다', async () => {
        // Given: 새 사용자 정보
        const params = {
          email: 'newuser@example.com',
          passwordHash: 'hashed-password',
          username: 'newuser',
        };
        const newUser = createTestUser(params);
        prisma.user.create.mockResolvedValue(newUser);

        // When: 사용자 생성
        const result = await service.createLocalUser(params);

        // Then: 사용자가 생성됨
        expect(result).toEqual(newUser);
        expect(prisma.user.create).toHaveBeenCalledWith({
          data: {
            email: params.email,
            passwordHash: params.passwordHash,
            username: params.username,
            authProvider: 'local',
          },
        });
      });

      it('username 없이도 사용자를 생성할 수 있어야 한다', async () => {
        // Given: username 없는 사용자 정보
        const params = {
          email: 'newuser@example.com',
          passwordHash: 'hashed-password',
        };
        const newUser = createTestUser({ ...params, username: null });
        prisma.user.create.mockResolvedValue(newUser);

        // When: 사용자 생성
        const result = await service.createLocalUser(params);

        // Then: 사용자가 생성됨
        expect(result).toEqual(newUser);
        expect(prisma.user.create).toHaveBeenCalledWith({
          data: {
            email: params.email,
            passwordHash: params.passwordHash,
            username: undefined,
            authProvider: 'local',
          },
        });
      });
    });
  });

  describe('프로필 업데이트', () => {
    describe('updateProfile', () => {
      const userId = 'user-123';

      it('username을 업데이트할 수 있어야 한다', async () => {
        // Given: 업데이트할 username
        const updateData = { username: 'newusername' };
        const updatedUser = createTestUser({ id: userId, username: 'newusername' });
        prisma.user.update.mockResolvedValue(updatedUser);

        // When: 프로필 업데이트
        const result = await service.updateProfile(userId, updateData);

        // Then: username이 업데이트됨
        expect(result).toEqual(updatedUser);
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: userId },
          data: { username: 'newusername' },
        });
      });

      it('username을 빈 문자열로 업데이트하면 null로 저장해야 한다', async () => {
        // Given: 빈 username
        const updateData = { username: '   ' };
        const updatedUser = createTestUser({ id: userId, username: null });
        prisma.user.update.mockResolvedValue(updatedUser);

        // When: 프로필 업데이트
        const result = await service.updateProfile(userId, updateData);

        // Then: null로 저장됨
        expect(result).toEqual(updatedUser);
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: userId },
          data: { username: null },
        });
      });

      it('비밀번호를 업데이트할 수 있어야 한다', async () => {
        // Given: 새 비밀번호
        const updateData = { password: 'newpassword123' };
        const updatedUser = createTestUser({ id: userId });
        mockedBcrypt.hash.mockResolvedValue('new-hashed-password' as never);
        prisma.user.update.mockResolvedValue(updatedUser);

        // When: 프로필 업데이트
        const result = await service.updateProfile(userId, updateData);

        // Then: 비밀번호가 해시되어 업데이트됨
        expect(result).toEqual(updatedUser);
        expect(mockedBcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: userId },
          data: { passwordHash: 'new-hashed-password' },
        });
      });

      it('비밀번호가 8자 미만이면 BadRequestException을 던진다', async () => {
        // Given: 너무 짧은 비밀번호
        const updateData = { password: 'short' };

        // When & Then: BadRequestException 발생
        await expectToThrowAsync(
          () => service.updateProfile(userId, updateData),
          BadRequestException,
          '비밀번호는 8자 이상 72자 이하여야 합니다',
        );

        expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it('비밀번호가 72자 초과면 BadRequestException을 던진다', async () => {
        // Given: 너무 긴 비밀번호
        const updateData = { password: 'a'.repeat(73) };

        // When & Then: BadRequestException 발생
        await expectToThrowAsync(
          () => service.updateProfile(userId, updateData),
          BadRequestException,
          '비밀번호는 8자 이상 72자 이하여야 합니다',
        );

        expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it('username과 password를 동시에 업데이트할 수 있어야 한다', async () => {
        // Given: username과 password 모두 업데이트
        const updateData = {
          username: 'newusername',
          password: 'newpassword123',
        };
        const updatedUser = createTestUser({ id: userId, username: 'newusername' });
        mockedBcrypt.hash.mockResolvedValue('new-hashed-password' as never);
        prisma.user.update.mockResolvedValue(updatedUser);

        // When: 프로필 업데이트
        const result = await service.updateProfile(userId, updateData);

        // Then: 둘 다 업데이트됨
        expect(result).toEqual(updatedUser);
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: userId },
          data: {
            username: 'newusername',
            passwordHash: 'new-hashed-password',
          },
        });
      });

      it('변경할 정보가 없으면 BadRequestException을 던진다', async () => {
        // Given: 빈 업데이트 데이터
        const updateData = {};

        // When & Then: BadRequestException 발생
        await expectToThrowAsync(
          () => service.updateProfile(userId, updateData),
          BadRequestException,
          '변경할 정보가 없습니다',
        );

        expect(prisma.user.update).not.toHaveBeenCalled();
      });
    });

    describe('updateTier', () => {
      it('사용자의 티어를 업데이트할 수 있어야 한다', async () => {
        // Given: 티어 업데이트
        const userId = 'user-123';
        const updatedUser = createTestUser({ id: userId, tier: 'premium' });
        prisma.user.update.mockResolvedValue(updatedUser);

        // When: 티어 업데이트
        const result = await service.updateTier(userId, 'premium');

        // Then: 티어가 업데이트됨
        expect(result).toEqual(updatedUser);
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: userId },
          data: { tier: 'premium' },
        });
      });
    });
  });

  describe('티어 동기화', () => {
    describe('syncUserTier', () => {
      const userId = 'user-123';

      it('구독이 있으면 premium 티어로 업데이트해야 한다', async () => {
        // Given: 활성 구독이 있는 free 티어 사용자
        const now = new Date();
        const user = createTestUser({
          id: userId,
          tier: 'free',
          creditBalance: 0,
        });
        const activeSubscription = {
          id: 'sub-123',
          userId,
          status: 'active' as const,
          startAt: new Date(now.getTime() - 86400000),
          endAt: new Date(now.getTime() + 86400000 * 30),
          createdAt: now,
          updatedAt: now,
        };

        prisma.user.findUnique.mockResolvedValue({
          ...user,
          subscriptions: [activeSubscription],
        });
        prisma.user.update.mockResolvedValue({ ...user, tier: 'premium' });

        // When: 티어 동기화
        await service.syncUserTier(userId);

        // Then: premium으로 업데이트됨
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: userId },
          data: { tier: 'premium' },
        });
      });

      it('크레딧이 있으면 premium 티어로 업데이트해야 한다', async () => {
        // Given: 크레딧이 있는 사용자
        const user = createTestUser({
          id: userId,
          tier: 'free',
          creditBalance: 10,
        });

        prisma.user.findUnique.mockResolvedValue({
          ...user,
          subscriptions: [],
        });
        prisma.user.update.mockResolvedValue({ ...user, tier: 'premium' });

        // When: 티어 동기화
        await service.syncUserTier(userId);

        // Then: premium으로 업데이트됨
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: userId },
          data: { tier: 'premium' },
        });
      });

      it('구독도 크레딧도 없으면 free 티어로 업데이트해야 한다', async () => {
        // Given: 구독도 크레딧도 없는 사용자
        const user = createTestUser({
          id: userId,
          tier: 'premium',
          creditBalance: 0,
        });

        prisma.user.findUnique.mockResolvedValue({
          ...user,
          subscriptions: [],
        });
        prisma.user.update.mockResolvedValue({ ...user, tier: 'free' });

        // When: 티어 동기화
        await service.syncUserTier(userId);

        // Then: free로 업데이트됨
        expect(prisma.user.update).toHaveBeenCalledWith({
          where: { id: userId },
          data: { tier: 'free' },
        });
      });

      it('티어가 변경되지 않으면 업데이트하지 않아야 한다', async () => {
        // Given: 이미 올바른 티어를 가진 사용자
        const user = createTestUser({
          id: userId,
          tier: 'free',
          creditBalance: 0,
        });

        prisma.user.findUnique.mockResolvedValue({
          ...user,
          subscriptions: [],
        });

        // When: 티어 동기화
        await service.syncUserTier(userId);

        // Then: 업데이트하지 않음
        expect(prisma.user.update).not.toHaveBeenCalled();
      });

      it('사용자가 존재하지 않으면 에러를 던진다', async () => {
        // Given: 존재하지 않는 사용자
        prisma.user.findUnique.mockResolvedValue(null);

        // When & Then: 에러 발생
        await expect(service.syncUserTier(userId)).rejects.toThrow('User not found');
      });
    });

    describe('getUserWithTier', () => {
      it('활성 구독과 함께 사용자를 조회해야 한다', async () => {
        // Given: 활성 구독이 있는 사용자
        const user = createTestUser({ id: 'user-123' });
        const activeSubscription = {
          id: 'sub-123',
          userId: 'user-123',
          status: 'active' as const,
          startAt: new Date('2024-01-01'),
          endAt: new Date('2025-01-01'),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        prisma.user.findUnique.mockResolvedValue({
          ...user,
          subscriptions: [activeSubscription],
        });

        // When: 티어 정보와 함께 사용자 조회
        const result = await service.getUserWithTier('user-123');

        // Then: 구독 정보가 포함됨
        expect(result).toEqual({
          ...user,
          subscriptions: [activeSubscription],
        });
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
          where: { id: 'user-123' },
          include: {
            subscriptions: {
              where: {
                status: 'active',
              },
            },
          },
        });
      });
    });
  });
});
