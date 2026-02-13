/**
 * 실제 E2E 테스트: 노트 관리 플로우
 *
 * Docker 환경에서 실제 DB/Redis를 사용한 전체 플로우 테스트
 * - 로그인 → 노트 생성 → 조회 → 수정 → 삭제
 */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, cleanupDatabase } from './setup';

describe('Notes Flow E2E (Real)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupDatabase(app);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupDatabase(app);

    // 테스트용 사용자 생성 및 로그인
    const signupResponse = await request(app.getHttpServer()).post('/v1/auth/signup').send({
      email: 'notes-test@example.com',
      password: 'TestPassword123!',
      username: 'Notes Test User',
    });

    accessToken = signupResponse.body.accessToken;
  });

  describe('노트 CRUD 전체 플로우', () => {
    it('1. 노트 생성 성공', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          term: 'get the ball rolling',
          description: '일을 시작하다',
          example: "Let's get the ball rolling on this project.",
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('term', 'get the ball rolling');
      expect(response.body).toHaveProperty('description', '일을 시작하다');
    });

    it('2. 노트 목록 조회', async () => {
      // Given: 3개의 노트 생성
      await request(app.getHttpServer())
        .post('/v1/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ term: 'break the ice', description: '분위기를 부드럽게 하다' });

      await request(app.getHttpServer())
        .post('/v1/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ term: 'piece of cake', description: '매우 쉬운 일' });

      await request(app.getHttpServer())
        .post('/v1/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ term: 'hit the nail on the head', description: '정확히 지적하다' });

      // When: 노트 목록 조회
      const response = await request(app.getHttpServer())
        .get('/v1/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Then: 3개의 노트가 조회됨
      expect(response.body).toHaveProperty('notes');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.notes).toHaveLength(3);
    });

    it('3. 특정 노트 조회', async () => {
      // Given: 노트 생성
      const createResponse = await request(app.getHttpServer())
        .post('/v1/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          term: 'under the weather',
          description: '몸이 안 좋다',
          example: "I'm feeling under the weather today.",
        });

      const noteId = createResponse.body.id;

      // When: 특정 노트 조회
      const response = await request(app.getHttpServer())
        .get(`/v1/notes/${noteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Then: 노트 정보 반환
      expect(response.body).toHaveProperty('id', noteId);
      expect(response.body).toHaveProperty('term', 'under the weather');
      expect(response.body).toHaveProperty('description', '몸이 안 좋다');
    });

    it('4. 노트 수정', async () => {
      // Given: 노트 생성
      const createResponse = await request(app.getHttpServer())
        .post('/v1/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          term: 'kick the bucket',
          description: '죽다',
        });

      const noteId = createResponse.body.id;

      // When: 노트 수정
      const updateResponse = await request(app.getHttpServer())
        .put(`/v1/notes/${noteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          term: 'kick the bucket',
          description: '(속어) 죽다, 세상을 떠나다',
          example: 'He kicked the bucket last year.',
        })
        .expect(200);

      // Then: 수정된 정보 반환
      expect(updateResponse.body).toHaveProperty('description', '(속어) 죽다, 세상을 떠나다');
      expect(updateResponse.body).toHaveProperty('example', 'He kicked the bucket last year.');

      // Verify: DB에서 실제로 수정되었는지 확인
      const getResponse = await request(app.getHttpServer())
        .get(`/v1/notes/${noteId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(getResponse.body).toHaveProperty('description', '(속어) 죽다, 세상을 떠나다');
    });

    it('5. 노트 삭제', async () => {
      // Given: 노트 생성
      const createResponse = await request(app.getHttpServer())
        .post('/v1/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          term: 'bite the bullet',
          description: '어려운 일을 받아들이다',
        });

      const noteId = createResponse.body.id;

      // When: 노트 삭제
      await request(app.getHttpServer())
        .delete(`/v1/notes/${noteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Then: 삭제 후 조회 시 404
      await request(app.getHttpServer())
        .get(`/v1/notes/${noteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('6. 전체 플로우: 생성 → 조회 → 수정 → 삭제', async () => {
      // Step 1: 노트 생성
      const createResponse = await request(app.getHttpServer())
        .post('/v1/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          term: 'spill the beans',
          description: '비밀을 누설하다',
        })
        .expect(201);

      const noteId = createResponse.body.id;

      // Step 2: 조회
      const getResponse = await request(app.getHttpServer())
        .get(`/v1/notes/${noteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(getResponse.body).toHaveProperty('term', 'spill the beans');

      // Step 3: 수정
      await request(app.getHttpServer())
        .put(`/v1/notes/${noteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          description: '(속어) 비밀을 말하다, 폭로하다',
          example: "Don't spill the beans about the surprise party.",
        })
        .expect(200);

      // Step 4: 수정 확인
      const updatedResponse = await request(app.getHttpServer())
        .get(`/v1/notes/${noteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(updatedResponse.body).toHaveProperty('description', '(속어) 비밀을 말하다, 폭로하다');

      // Step 5: 삭제
      await request(app.getHttpServer())
        .delete(`/v1/notes/${noteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Step 6: 삭제 확인
      await request(app.getHttpServer())
        .get(`/v1/notes/${noteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('노트 검색 및 필터링', () => {
    beforeEach(async () => {
      // 테스트용 노트 3개 생성
      await request(app.getHttpServer())
        .post('/v1/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ term: 'raining cats and dogs', description: '비가 억수같이 오다' });

      await request(app.getHttpServer())
        .post('/v1/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ term: 'cost an arm and a leg', description: '매우 비싸다' });

      await request(app.getHttpServer())
        .post('/v1/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ term: 'beat around the bush', description: '빙빙 돌려 말하다' });
    });

    it('검색어로 노트 필터링', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/notes?search=cats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('notes');
      expect(response.body.notes.length).toBeGreaterThan(0);
      // 검색어를 포함하는 노트가 있는지 확인
      const hasCatsNote = response.body.notes.some((note: { term: string }) =>
        note.term.includes('cats'),
      );
      expect(hasCatsNote).toBe(true);
    });

    it('페이지네이션', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/notes?page=1&limit=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('notes');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.notes.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.limit).toBe(2);
    });
  });

  describe('권한 체크', () => {
    it('다른 사용자의 노트 수정 시도 → 403 또는 404', async () => {
      // Given: 첫 번째 사용자가 노트 생성
      const createResponse = await request(app.getHttpServer())
        .post('/v1/notes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: '내 노트',
          content: '내 내용',
        });

      const noteId = createResponse.body.id;

      // Given: 두 번째 사용자 생성 및 로그인
      const otherUserResponse = await request(app.getHttpServer()).post('/v1/auth/signup').send({
        email: 'other-user@example.com',
        password: 'TestPassword123!',
        username: 'Other User',
      });

      const otherAccessToken = otherUserResponse.body.accessToken;

      // When: 두 번째 사용자가 첫 번째 사용자의 노트 수정 시도
      const response = await request(app.getHttpServer())
        .patch(`/v1/notes/${noteId}`)
        .set('Authorization', `Bearer ${otherAccessToken}`)
        .send({
          title: '해킹 시도',
        });

      // Then: 권한 없음 또는 찾을 수 없음
      expect([403, 404]).toContain(response.status);
    });
  });
});
