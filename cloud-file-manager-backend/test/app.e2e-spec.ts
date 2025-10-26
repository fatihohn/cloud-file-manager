import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { User, UserRole } from '../src/users/entity/user.entity';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let adminId: number;
  let memberToken: string;

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
      .expect('Hello World!');
  });

  describe('Users & Auth', () => {
    const adminUser = {
      email: `admin-${Date.now()}@test.com`,
      password: 'password1234',
      name: 'AdminUser',
    };
    const memberUser = {
      email: `member-${Date.now()}@test.com`,
      password: 'password1234',
      name: 'MemberUser',
    };
    let memberId: number;

    it('POST /signup (Admin)', async () => {
      return request(app.getHttpServer() as App)
        .post('/signup')
        .send(adminUser)
        .expect(201)
        .then(async (res) => {
          adminId = Number(res.body.id);
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
  });
});
