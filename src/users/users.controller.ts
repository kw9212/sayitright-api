import type { AuthRequest } from '../common/types/auth-request.type';
import { UsersService } from './users.service';
import { Controller, Get, Put, Body, NotFoundException, Req, UseGuards } from '@nestjs/common';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';

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
}
