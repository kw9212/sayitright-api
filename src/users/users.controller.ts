import type { AuthRequest } from '../common/types/auth-request.type';
import { UsersService } from './users.service';
import { Controller, Get, Put, Body, NotFoundException, Req, UseGuards } from '@nestjs/common';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateTierDto } from './dto/update-tier.dto';

@UseGuards(JwtAccessGuard)
@Controller('v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @Get('me')
  async me(@Req() req: AuthRequest) {
    const user = await this.usersService.findMeById(req.user.sub);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Put('me')
  async updateProfile(@Req() req: AuthRequest, @Body() dto: UpdateProfileDto) {
    const user = await this.usersService.updateProfile(req.user.sub, {
      username: dto.username,
      password: dto.password,
    });

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      updatedAt: user.updatedAt,
    };
  }

  @Put('me/tier')
  async updateTier(@Req() req: AuthRequest, @Body() dto: UpdateTierDto) {
    const user = await this.usersService.updateTier(req.user.sub, dto.tier);

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      tier: user.tier,
      updatedAt: user.updatedAt,
    };
  }
}
