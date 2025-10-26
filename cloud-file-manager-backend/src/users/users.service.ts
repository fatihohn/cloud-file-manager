import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entity/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoggerService } from '../logger/logger.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { USER_EVENTS_QUEUE } from '../queue/queue.constants';

export enum UserKeyPrefix {
  EMAIL = 'user:email:',
  ID = 'user:id:',
}

@Injectable()
export class UsersService {
  private readonly redis: Redis | null;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectQueue(USER_EVENTS_QUEUE)
    private readonly userEventsQueue: Queue,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {
    try {
      this.redis = this.redisService.getOrThrow();
    } catch (error) {
      this.logger.warn('Failed to load redis', String(error));
    }
  }

  private async _cacheUser(user: User) {
    if (!this.redis) return;
    const cacheSeconds = 3600;
    const keyById = `${UserKeyPrefix.ID}${user.id}`;
    const keyByEmail = `${UserKeyPrefix.EMAIL}${user.email}`;
    const userString = JSON.stringify(user);
    await this.redis.set(keyById, userString, 'EX', cacheSeconds);
    await this.redis.set(keyByEmail, userString, 'EX', cacheSeconds);
  }

  private async _dropCachedUser(user: User) {
    if (!this.redis) return;
    const keyById = `${UserKeyPrefix.ID}${user.id}`;
    const keyByEmail = `${UserKeyPrefix.EMAIL}${user.email}`;
    await this.redis.del(keyById);
    await this.redis.del(keyByEmail);
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { email, password, name } = createUserDto;

    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const salt = await bcrypt.genSalt();
    this.logger.log(`Creating User with password: ${password}`);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = this.usersRepository.create({
      email,
      password: hashedPassword,
      name,
    });

    try {
      await this.usersRepository.save(user);
    } catch (error) {
      this.logger.error('Error creating user', String(error));
      throw new ConflictException('Error creating user');
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOneById(id);
    if (!user) throw new ConflictException(`Cannot find user with ID ${id}.`);

    await this._dropCachedUser(user);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.findOneByEmail(updateUserDto.email);
      if (existingUser) throw new ConflictException('Email already in use');
      user.email = updateUserDto.email;
    }

    if (updateUserDto.password) {
      const salt = await bcrypt.genSalt();
      user.password = await bcrypt.hash(updateUserDto.password, salt);
    }

    if (updateUserDto.name) {
      user.name = updateUserDto.name;
    }

    if (
      typeof updateUserDto.currentHashedRefreshToken === 'string' ||
      updateUserDto.currentHashedRefreshToken === null
    ) {
      user.currentHashedRefreshToken = updateUserDto.currentHashedRefreshToken;
    }

    await this.usersRepository.update({ id: user.id }, user);
    const reloadedUser = await this.findOneById(user.id);
    if (reloadedUser) {
      await this._cacheUser(reloadedUser);
      return reloadedUser;
    }

    return user;
  }

  async remove(id: string): Promise<{ message: string }> {
    const user = await this.findOneById(id);
    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Cannot find user with ID ${id}.`);
    }

    await this._dropCachedUser(user!);

    await this.userEventsQueue.add('user-deletion', {
      userId: id,
      email: user?.email,
      name: user?.name,
    });

    return { message: `Deleted user with ID ${id}.` };
  }

  async findOneByEmail(email: string): Promise<User | null> {
    const key = `${UserKeyPrefix.EMAIL}${email}`;
    const cachedUser = await this.redis?.get(key);
    if (cachedUser) {
      return JSON.parse(cachedUser) as User;
    }

    const user = await this.usersRepository.findOne({ where: { email } });

    if (user) {
      await this._cacheUser(user);
    }

    return user;
  }

  async findOneById(id: string): Promise<User | null> {
    const key = `${UserKeyPrefix.ID}${id}`;
    const cachedUser = await this.redis?.get(key);
    if (cachedUser) {
      return JSON.parse(cachedUser) as User;
    }

    const user = await this.usersRepository.findOne({ where: { id } });

    if (user) {
      await this._cacheUser(user);
    }

    return user;
  }

  async findAll(options: {
    page: number;
    limit: number;
  }): Promise<{ data: User[]; count: number }> {
    const [data, count] = await this.usersRepository.findAndCount({
      skip: (options.page - 1) * options.limit,
      take: options.limit,
      order: { id: 'DESC' },
    });
    return { data, count };
  }
}
