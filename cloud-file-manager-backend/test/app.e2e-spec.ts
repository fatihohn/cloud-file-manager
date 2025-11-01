/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { User, UserRole } from '../src/users/entity/user.entity';
import { FileUploadStatus } from '../src/files/entities/file-upload.entity';
import { S3EventProcessor } from '../src/files/files.processor';
import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { createReadStream, existsSync, statSync } from 'fs';
import { join } from 'path';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let memberToken: string;

  const resolveSampleFile = (filename: string) => {
    const potentialPaths = [
      join(__dirname, 'test-data', filename),
      join(__dirname, '..', 'test', 'test-data', filename),
    ];
    for (const candidate of potentialPaths) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    throw new Error(`Test file not found: ${filename}`);
  };

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

    it('POST /signup (Admin)', async () => {
      return request(app.getHttpServer() as App)
        .post('/signup')
        .send(adminUser)
        .expect(201)
        .then(async (res) => {
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
  });

  describe('Files API Lifecycle', () => {
    const testFiles = [
      {
        name: 'health_data_small.csv',
        contentType: 'text/csv',
        path: resolveSampleFile('health_data_small.csv'),
      },
      {
        name: 'health_data_medium.csv',
        contentType: 'text/csv',
        path: resolveSampleFile('health_data_medium.csv'),
      },
      {
        name: 'health_data_large.csv',
        contentType: 'text/csv',
        path: resolveSampleFile('health_data_large.csv'),
      },
    ].map((f) => ({ ...f, size: statSync(f.path).size }));

    const presignedData: {
      fileId: string;
      url: string;
      fields: any;
      s3Key: string;
    }[] = [];

    it('should generate presigned URLs for multiple files', async () => {
      const fileMeta = testFiles.map(({ name, contentType, size }) => ({
        fileName: name,
        contentType,
        size,
      }));

      const res = await request(app.getHttpServer() as App)
        .post('/files/presigned-url')
        .set('Authorization', `Bearer ${memberToken}`)
        .send(fileMeta)
        .expect(201);

      expect(res.body.data).toHaveLength(testFiles.length);

      for (const data of res.body.data) {
        expect(data.fileId).toBeDefined();
        expect(data.url).toContain('.s3.ap-northeast-2.amazonaws.com');
        expect(data.fields).toBeDefined();
        presignedData.push({ ...data, s3Key: data.fields.key });
      }
    });

    it('should simulate uploading files to S3', async () => {
      const s3Client = new S3Client({
        region: process.env.AWS_REGION ?? 'ap-northeast-2',
      });
      for (let i = 0; i < testFiles.length; i++) {
        const file = testFiles[i];
        const data = presignedData[i];

        await s3Client.send(
          new PutObjectCommand({
            Bucket:
              process.env.FILES_BUCKET_NAME ??
              'cloud-file-manager-user-files-dev',
            Key: data.s3Key,
            Body: createReadStream(file.path),
          }),
        );
      }
    }, 20000); // Increase timeout for S3 uploads

    it('should verify file status as ACTIVE after S3 events', async () => {
      const s3EventProcessor = app.get(S3EventProcessor);
      for (let i = 0; i < testFiles.length; i++) {
        const file = testFiles[i];
        const data = presignedData[i];
        const mockS3Event = {
          Records: [
            {
              s3: {
                bucket: {
                  name:
                    process.env.FILES_BUCKET_NAME ??
                    'cloud-file-manager-user-files-dev',
                },
                object: { key: data.s3Key, size: file.size },
              },
            },
          ],
        };
        await s3EventProcessor.process({ data: mockS3Event } as any);
      }

      // Verify the status is updated for the first file
      const res = await request(app.getHttpServer() as App)
        .get(`/files/${presignedData[0].fileId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.status).toEqual(FileUploadStatus.ACTIVE);
      expect(res.body.sizeBytes).toEqual(String(testFiles[0].size));
    });

    it('should list the uploaded files for the user', async () => {
      const res = await request(app.getHttpServer() as App)
        .get('/files')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(testFiles.length);
      expect(
        res.body.data.some((f) => f.id === presignedData[0].fileId),
      ).toBeTruthy();
      expect(
        res.body.data.some((f) => f.id === presignedData[1].fileId),
      ).toBeTruthy();
    });

    it('should soft-delete a file', async () => {
      const fileToDelete = presignedData[0];

      await request(app.getHttpServer() as App)
        .delete(`/files/${fileToDelete.fileId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      // Verify it's gone from the list
      const res = await request(app.getHttpServer() as App)
        .get('/files')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(
        res.body.data.some((f) => f.id === fileToDelete.fileId),
      ).toBeFalsy();

      // Verify it still exists in S3
      const s3Client = new S3Client({ region: 'ap-northeast-2' });
      await expect(
        s3Client.send(
          new HeadObjectCommand({
            Bucket:
              process.env.FILES_BUCKET_NAME ??
              'cloud-file-manager-user-files-dev',
            Key: fileToDelete.s3Key,
          }),
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('Access Control & Failure Cases', () => {
    let member2Token: string;
    let member1FileId: string;

    beforeAll(async () => {
      // Create a second member
      const member2User = {
        email: `member2-${Date.now()}@test.com`,
        password: 'Sup3rSecure!3',
        name: 'Member2',
      };
      await request(app.getHttpServer() as App)
        .post('/signup')
        .send(member2User)
        .expect(201);
      const signinRes = await request(app.getHttpServer() as App)
        .post('/signin')
        .send({ email: member2User.email, password: member2User.password })
        .expect(201);
      member2Token = signinRes.body.accessToken;

      // Upload a file as member1
      const fileToUpload = {
        name: 'member1_file.csv',
        contentType: 'text/csv',
        path: resolveSampleFile('health_data_small.csv'),
      };
      const fileMeta = {
        fileName: fileToUpload.name,
        contentType: fileToUpload.contentType,
        size: statSync(fileToUpload.path).size,
      };
      const presignedRes = await request(app.getHttpServer() as App)
        .post('/files/presigned-url')
        .set('Authorization', `Bearer ${memberToken}`)
        .send([fileMeta])
        .expect(201);
      member1FileId = presignedRes.body.data[0].fileId;
      const s3Key = presignedRes.body.data[0].fields.key;

      // Simulate upload and event processing
      const s3Client = new S3Client({ region: 'ap-northeast-2' });
      await s3Client.send(
        new PutObjectCommand({
          Bucket:
            process.env.FILES_BUCKET_NAME ??
            'cloud-file-manager-user-files-dev',
          Key: s3Key,
          Body: createReadStream(fileToUpload.path),
        }),
      );
      const s3EventProcessor = app.get(S3EventProcessor);
      await s3EventProcessor.process({
        data: {
          Records: [
            {
              s3: {
                bucket: { name: 'test-bucket' },
                object: { key: s3Key, size: fileMeta.size },
              },
            },
          ],
        },
      } as any);
    });

    it("Admin should be able to list all files, including other users' files", async () => {
      const res = await request(app.getHttpServer() as App)
        .get('/files/all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.some((f) => f.id === member1FileId)).toBeTruthy();
    });

    it("Member should not be able to access another member's file metadata", async () => {
      await request(app.getHttpServer() as App)
        .get(`/files/${member1FileId}`)
        .set('Authorization', `Bearer ${member2Token}`)
        .expect(404);
    });

    it("Member should not be able to get a download URL for another member's file", async () => {
      await request(app.getHttpServer() as App)
        .get(`/files/${member1FileId}/download`)
        .set('Authorization', `Bearer ${member2Token}`)
        .expect(404);
    });

    it('should reject a presigned URL request for a file that is too large', async () => {
      const largeFilePath = resolveSampleFile('health_data_xlarge.csv');
      const fileMeta = {
        fileName: 'too_large.csv',
        contentType: 'text/csv',
        size: statSync(largeFilePath).size,
      };

      await request(app.getHttpServer() as App)
        .post('/files/presigned-url')
        .set('Authorization', `Bearer ${memberToken}`)
        .send([fileMeta])
        .expect(413);
    });
  });

  describe('User Deletion', () => {
    let tempMemberToken: string;
    let tempMemberId: string;
    let tempMemberFileId: string;

    beforeAll(async () => {
      // Create a temporary member
      const tempMemberUser = {
        email: `temp-member-${Date.now()}@test.com`,
        password: 'Sup3rSecure!4',
        name: 'TempMember',
      };
      const signupRes = await request(app.getHttpServer() as App)
        .post('/signup')
        .send(tempMemberUser)
        .expect(201);
      tempMemberId = signupRes.body.id;
      const signinRes = await request(app.getHttpServer() as App)
        .post('/signin')
        .send({
          email: tempMemberUser.email,
          password: tempMemberUser.password,
        })
        .expect(201);
      tempMemberToken = signinRes.body.accessToken;

      // Upload a file as member1
      const fileToUpload = {
        name: 'temp_member_file.csv',
        contentType: 'text/csv',
        path: resolveSampleFile('health_data_small.csv'),
      };
      const fileMeta = {
        fileName: fileToUpload.name,
        contentType: fileToUpload.contentType,
        size: statSync(fileToUpload.path).size,
      };
      const presignedRes = await request(app.getHttpServer() as App)
        .post('/files/presigned-url')
        .set('Authorization', `Bearer ${tempMemberToken}`)
        .send([fileMeta])
        .expect(201);
      tempMemberFileId = presignedRes.body.data[0].fileId;
      const s3Key = presignedRes.body.data[0].fields.key;

      // Simulate upload and event processing
      const s3Client = new S3Client({ region: 'ap-northeast-2' });
      await s3Client.send(
        new PutObjectCommand({
          Bucket:
            process.env.FILES_BUCKET_NAME ??
            'cloud-file-manager-user-files-dev',
          Key: s3Key,
          Body: createReadStream(fileToUpload.path),
        }),
      );
      const s3EventProcessor = app.get(S3EventProcessor);
      await s3EventProcessor.process({
        data: {
          Records: [
            {
              s3: {
                bucket: { name: 'test-bucket' },
                object: { key: s3Key, size: fileMeta.size },
              },
            },
          ],
        },
      } as any);
    });

    it('should allow a member to delete their own account', async () => {
      await request(app.getHttpServer() as App)
        .delete(`/users/${tempMemberId}`)
        .set('Authorization', `Bearer ${tempMemberToken}`)
        .expect(200)
        .then((res) => {
          expect(res.body.message).toContain(
            `Deleted user with ID ${tempMemberId}`,
          );
        });

      // Wait for background job to process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify that signin fails afterwards
      await request(app.getHttpServer() as App)
        .post('/signin')
        .send({
          email: `temp-member-${Date.now()}@test.com`,
          password: 'Sup3rSecure!4',
        })
        .expect(401);
    });

    // Verify that the user's files are also soft-deleted
    it("should verify that the deleted member's files are soft-deleted", async () => {
      await request(app.getHttpServer() as App)
        .get(`/files/${tempMemberFileId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    // Verify that the user's files still exist in S3
    it("should verify that the deleted member's files still exist in S3", async () => {
      const s3Client = new S3Client({ region: 'ap-northeast-2' });
      const s3Key = `${tempMemberId}/${tempMemberFileId}/temp_member_file.csv`;

      await expect(
        s3Client.send(
          new HeadObjectCommand({
            Bucket:
              process.env.FILES_BUCKET_NAME ??
              'cloud-file-manager-user-files-dev',
            Key: s3Key,
          }),
        ),
      ).resolves.toBeDefined();
    });
  });
});
