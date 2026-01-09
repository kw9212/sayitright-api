import type { AuthRequest } from '../common/types/auth-request.type';
import { UsersService } from './users.service';
import { Controller, Get, NotFoundException, Req, UseGuards } from '@nestjs/common';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';

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
}
