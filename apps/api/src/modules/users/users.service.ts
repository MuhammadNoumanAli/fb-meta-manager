import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { AccessService, type WorkspaceSummary } from '../access/access.service';
import { toPublicUser, type PublicUser } from '../auth/auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface CurrentUserView {
  user: PublicUser;
  workspaces: WorkspaceSummary[];
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly accessService: AccessService,
  ) {}

  async getCurrentUser(userId: string): Promise<CurrentUserView> {
    const user = await this.requireUser(userId);
    const workspaces = await this.accessService.listWorkspaces(userId);

    return { user: toPublicUser(user), workspaces };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<PublicUser> {
    const user = await this.requireUser(userId);

    if (dto.firstName !== undefined) {
      user.firstName = dto.firstName.trim();
    }

    if (dto.lastName !== undefined) {
      user.lastName = dto.lastName.trim();
    }

    await this.users.save(user);
    return toPublicUser(user);
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
