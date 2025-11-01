import { ApiProperty } from '@nestjs/swagger';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'Admin',
  MEMBER = 'Member',
}

export const PASSWORD_COMPLEXITY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).+$/;

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'User ID', format: 'uuid' })
  id: string;

  @Column({ unique: true })
  @ApiProperty({
    description: 'User email',
    example: 'johndoe@test.com',
    type: 'string',
    format: 'email',
  })
  email: string;

  @Column()
  password: string;

  @Column()
  @ApiProperty({
    example: 'John Doe',
    description: 'User name',
    type: 'string',
  })
  name: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.MEMBER,
  })
  @ApiProperty({
    example: 'Member',
    description: 'User role: Admin or Member',
    type: 'string',
  })
  role: UserRole;

  @Column({ type: 'text', nullable: true })
  currentHashedRefreshToken?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
