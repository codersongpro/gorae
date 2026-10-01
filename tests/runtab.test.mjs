// HTML 작품을 웨일 새 탭에서 실행: 실행 표 보관·꺼내기
import test from 'node:test';
import assert from 'node:assert/strict';
import { putRunTicket, takeRunTicket } from '../extension/core/runtab.js';
import { createMemoryStorage } from '../extension/core/storage.js';

const work = { id: 'w', title: '뽑기', type: 'html', html: '<p>a</p>' };
const status = { ok: false, reason: 'NO_TAILPRINT' };

test('맡긴 작품은 실행 번호로만 꺼낼 수 있고, 새로고침해도 다시 꺼낼 수 있다', async () => {
  const st = createMemoryStorage();
  const id = await putRunTicket(st, { work, status });
  assert.match(id, /^[0-9a-z]+$/);
  assert.equal((await takeRunTicket(st, id)).work.title, '뽑기');
  assert.equal((await takeRunTicket(st, id)).work.title, '뽑기'); // 다시 열어도 됨
  assert.equal(await takeRunTicket(st, 'nope'), null);
  assert.equal(await takeRunTicket(st, ''), null);
});

test('실행 표는 최근 10개만 보관한다', async () => {
  const st = createMemoryStorage();
  const ids = [];
  for (let i = 0; i < 12; i++) ids.push(await putRunTicket(st, { work: { ...work, title: 't' + i }, status }, { now: 1000 + i }));
  assert.equal((await st.get('runTickets')).length, 10);
  assert.equal(await takeRunTicket(st, ids[0]), null);
  assert.equal((await takeRunTicket(st, ids[11])).work.title, 't11');
});
