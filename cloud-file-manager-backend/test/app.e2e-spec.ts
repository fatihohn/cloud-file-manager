import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { User, UserRole } from '../src/users/entity/user.entity';
import { join } from 'path';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import {
  FileUpload,
  FileUploadStatus,
} from '../src/files/entities/file-upload.entity';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

const createS3Client = () => {
  const region = process.env.AWS_REGION ?? 'ap-northeast-2';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  return new S3Client({
    region,
    credentials:
      accessKeyId && secretAccessKey
        ? {
            accessKeyId,
            secretAccessKey,
          }
        : undefined,
  });
};

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let adminId: string;
  let memberToken: string;

  process.env.MAX_UPLOAD_BYTES = String(200 * 1024 * 1024);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer() as App)
      .get('/')
      .expect(200)
      .expect('Cloud File Manager API is running!');
  });

  describe('Users & Auth', () => {
    const adminUser = {
      email: `admin-${Date.now()}@test.com`,
      password: 'Sup3rSecure!1',
      name: 'AdminUser',
    };
    const memberUser = {
      email: `member-${Date.now()}@test.com`,
      password: 'Sup3rSecure!2',
      name: 'MemberUser',
    };
    let memberId: string;
    let uploadedFileId: string;
    let secondFileId: string;
    let uploadedLargeFileId: string;
    const bucketName =
      process.env.FILES_BUCKET_NAME ?? 'cloud-file-manager-user-files-dev';
    const resolveSampleFile = (filename: string, fallbackSizeBytes = 1024) => {
      const repoRoot = join(__dirname, '..', '..');
      const potentialPaths = [
        join(__dirname, 'test-data', filename),
        join(repoRoot, 'test', 'test-data', filename),
        join(
          repoRoot,
          'cloud-file-manager-backend',
          'test',
          'test-data',
          filename,
        ),
      ];
      for (const candidate of potentialPaths) {
        if (existsSync(candidate)) {
          return candidate;
        }
      }
      const fallbackDir = join(repoRoot, 'tmp-test-files');
      if (!existsSync(fallbackDir)) {
        mkdirSync(fallbackDir, { recursive: true });
      }
      const fallbackPath = join(fallbackDir, filename);
      if (!existsSync(fallbackPath)) {
        const stream = createWriteStream(fallbackPath);
        stream.write('timestamp,value\n');
        const row = '2025-01-01T00:00:00Z,1\n';
        let written = row.length;
        while (written < fallbackSizeBytes) {
          stream.write(row);
          written += row.length;
        }
        stream.end();
      }
      return fallbackPath;
    };

    const sampleFileSmall = resolveSampleFile('health_data_small.csv');
    const sampleFileMedium = resolveSampleFile(
      'health_data_medium.csv',
      35 * 1024 * 1024,
    );
    const sampleFileLarge = resolveSampleFile(
      'health_data_large.csv',
      117 * 1024 * 1024,
    );
    const sampleFileExtraLarge = resolveSampleFile(
      'health_data_xlarge.csv',
      586 * 1024 * 1024,
    );

    it('POST /signup (Admin)', async () => {
      return request(app.getHttpServer() as App)
        .post('/signup')
        .send(adminUser)
        .expect(201)
        .then(async (res) => {
          adminId = res.body.id;
          const dataSource = app.get(DataSource);
          await dataSource
            .getRepository(User)
            .update({ id: res.body.id }, { role: UserRole.ADMIN });
        });
    });

    it('POST /signup (Member)', async () => {
      return request(app.getHttpServer() as App)
        .post('/signup')
        .send(memberUser)
        .expect(201)
        .then((res) => {
          expect(res.body.email).toEqual(memberUser.email);
          memberId = res.body.id;
        });
    });

    it('POST /signin (Member)', async () => {
      return request(app.getHttpServer() as App)
        .post('/signin')
        .send({ email: memberUser.email, password: memberUser.password })
        .expect(201)
        .then((res) => {
          expect(res.body.accessToken).toBeDefined();
          memberToken = res.body.accessToken;
        });
    });

    it('POST /signin (Admin)', async () => {
      return request(app.getHttpServer() as App)
        .post('/signin')
        .send({ email: adminUser.email, password: adminUser.password })
        .expect(201)
        .then((res) => {
          expect(res.body.accessToken).toBeDefined();
          adminToken = res.body.accessToken;
        });
    });

    it('GET /users (Admin)', async () => {
      return request(app.getHttpServer() as App)
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then((res) => {
          expect(
            res.body.data?.find(
              (user: User) => user.email === memberUser.email,
            ),
          ).toBeDefined();
          expect(
            res.body.data?.find((user: User) => user.email === adminUser.email),
          ).toBeDefined();
        });
    });

    it('GET /users (Member tries to access all users) -> 403 Forbidden', async () => {
      return request(app.getHttpServer() as App)
        .get('/users')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('GET /users/me (Member)', async () => {
      return request(app.getHttpServer() as App)
        .get('/users/me')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.email).toEqual(memberUser.email);
        });
    });

    it('GET /users/:id (Member)', async () => {
      return request(app.getHttpServer() as App)
        .get(`/users/${memberId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.email).toEqual(memberUser.email);
        });
    });

    it('GET /users/:id (Member tries to access another user) -> 403 Forbidden', async () => {
      return request(app.getHttpServer() as App)
        .get(`/users/${adminId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('PUT /users/:id (Unauthorized user tries to update another user) -> 401 Unauthorized', async () => {
      return request(app.getHttpServer() as App)
        .put(`/users/${memberId}`)
        .send({ name: 'Unauthorized' })
        .expect(401);
    });

    it('PUT /users/:id (Member tries to update another user) -> 403 Forbidden', async () => {
      return request(app.getHttpServer() as App)
        .put(`/users/${adminId}`)
        .send({ name: 'Hacker' })
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('PUT /users/:id (Member updates self)', async () => {
      const newName = 'Updated MemberUser';
      return request(app.getHttpServer() as App)
        .put(`/users/${memberId}`)
        .send({ name: newName })
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.name).toEqual(newName);
        });
    });

    it('PUT /users/:id (Admin updates other user)', async () => {
      const newName = 'Updated By Admin';
      return request(app.getHttpServer() as App)
        .put(`/users/${memberId}`)
        .send({ name: newName })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.name).toEqual(newName);
        });
    });

    describe('Files API', () => {
      it('POST /files (upload multiple csv)', async () => {
        return request(app.getHttpServer() as App)
          .post('/files')
          .set('Authorization', `Bearer ${memberToken}`)
          .attach('files', sampleFileSmall)
          .attach('files', sampleFileMedium)
          .expect(201)
          .then((res) => {
            expect(Array.isArray(res.body.data)).toBeTruthy();
            expect(res.body.data).toHaveLength(2);
            uploadedFileId = res.body.data[0].id;
            secondFileId = res.body.data[1].id;
          });
      });

      it('POST /files (upload large csv via multipart streaming)', async () => {
        return request(app.getHttpServer() as App)
          .post('/files')
          .set('Authorization', `Bearer ${memberToken}`)
          .attach('files', sampleFileLarge)
          .expect(201)
          .then((res) => {
            expect(Array.isArray(res.body.data)).toBeTruthy();
            expect(res.body.data).toHaveLength(1);
            uploadedLargeFileId = res.body.data[0].id;
          });
      }, 20000);

      it('POST /files (upload extra large csv via multipart streaming)', async () => {
        return request(app.getHttpServer() as App)
          .post('/files')
          .set('Authorization', `Bearer ${memberToken}`)
          .attach('files', sampleFileExtraLarge)
          .expect(413);
      });

      it('GET /files (list my files)', async () => {
        return request(app.getHttpServer() as App)
          .get('/files')
          .set('Authorization', `Bearer ${memberToken}`)
          .expect(200)
          .then((res) => {
            expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
            expect(
              res.body.data.find((file) => file.id === uploadedFileId),
            ).toBeDefined();
            expect(
              res.body.data.find((file) => file.id === uploadedLargeFileId),
            ).toBeDefined();
          });
      });

      it('GET /files/all (User cannot list all files)', async () => {
        return request(app.getHttpServer() as App)
          .get('/files/all')
          .set('Authorization', `Bearer ${memberToken}`)
          .expect(403);
      });

      it('GET /files/all (Admin can list all files)', async () => {
        return request(app.getHttpServer() as App)
          .get('/files/all')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
          .then((res) => {
            expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
          });
      });

      it('GET /files/:id/download (presigned url)', async () => {
        return request(app.getHttpServer() as App)
          .get(`/files/${uploadedFileId}/download`)
          .set('Authorization', `Bearer ${memberToken}`)
          .expect(200)
          .then((res) => {
            expect(res.body.url).toContain('https://');
            expect(res.body.expiresAt).toBeDefined();
          });
      });
    });

    it('DELETE /files/:id (soft delete) after uploads)', async () => {
      const dataSource = app.get(DataSource);
      const fileRepo = dataSource.getRepository(FileUpload);
      const fileBefore = await fileRepo.findOne({
        where: { id: secondFileId },
      });
      expect(fileBefore).toBeDefined();

      await request(app.getHttpServer() as App)
        .delete(`/files/${secondFileId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.code).toEqual('FILE_SOFT_DELETED');
        });

      const deletedFile = await fileRepo.findOne({
        where: { id: secondFileId },
      });
      expect(deletedFile?.status).toEqual(FileUploadStatus.SOFT_DELETED);

      if (bucketName) {
        const s3Client = createS3Client();
        await expect(
          s3Client.send(
            new HeadObjectCommand({
              Bucket: bucketName,
              Key: deletedFile!.s3Key,
            }),
          ),
        ).resolves.toBeDefined();
      }
    });

    it('DELETE /users/:id (Unauthorized user tries to delete another user) -> 401 Unauthorized', async () => {
      return request(app.getHttpServer() as App)
        .delete(`/users/${memberId}`)
        .send({ name: 'Unauthorized' })
        .expect(401);
    });

    it('DELETE /users/:id (Member tries to delete another user) -> 403 Forbidden', async () => {
      return request(app.getHttpServer() as App)
        .delete(`/users/${adminId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });

    it('DELETE /users/:id (Member deletes self)', async () => {
      return request(app.getHttpServer() as App)
        .delete(`/users/${memberId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
    });

    it('DELETE /users/:id (Admin deletes self)', async () => {
      return request(app.getHttpServer() as App)
        .delete(`/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
