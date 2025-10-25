/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../auth/decorator/roles.decorator';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { User, UserRole } from './entity/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoggerService } from '../logger/logger.service';
import { ApiBearerAuth, ApiOkResponse, ApiOperation } from '@nestjs/swagger';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly logger: LoggerService,
  ) {}

  @Get('/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get My Info' })
  @ApiOkResponse({ type: User })
  getMyInfo(@Req() req: { user: User }) {
    return req.user;
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get All Users (Admin only)' })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const { data, count } = await this.usersService.findAll({ page, limit });

    const users = data.map((user: User) => {
      const { password, ...rest } = user;
      return rest;
    });

    return { data: users, count };
  }

  @Get('/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get User by ID' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: User },
  ) {
    const requestingUser = req.user;
    if (requestingUser.role !== UserRole.ADMIN && requestingUser.id !== id) {
      throw new ForbiddenException('Invalid access request');
    }
    const user = await this.usersService.findOneById(id);

    if (!user) {
      throw new NotFoundException(`Cannot find user with ID ${id}.`);
    }

    const { password, ...result } = user;

    return result;
  }

  @Put('/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update User by ID' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: { user: User },
  ) {
    const requestingUser = req.user;
    if (requestingUser.role !== UserRole.ADMIN && requestingUser.id !== id) {
      throw new ForbiddenException('Invalid access request');
    }
    return this.usersService.update(id, updateUserDto);
  }

  @Delete('/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete User by ID' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: { user: User }) {
    const requestingUser = req.user;
    if (requestingUser.role !== UserRole.ADMIN && requestingUser.id !== id) {
      throw new ForbiddenException('Invalid access request');
    }

    return this.usersService.remove(id);
  }
}
