import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getCurrentUser(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }
}
