import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';

export const createTypeOrmOptions = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('DATABASE_HOST', 'postgres'),
  port: parseInt(configService.get<string>('DATABASE_PORT', '5432'), 10),
  username: configService.get<string>('POSTGRES_USER'),
  password: configService.get<string>('POSTGRES_PASSWORD'),
  database: configService.get<string>('POSTGRES_DATABASE'),
  ...(configService.get<string>('DATABASE_SSL') === 'true' && {
    ssl: { rejectUnauthorized: false },
  }),
  entities: [
    join(
      __dirname,
      '..',
      '**',
      __dirname.includes('dist') ? '*.entity.js' : '*.entity.ts',
    ),
  ],
  synchronize: configService.get<string>('NODE_ENV') === 'development',
});
