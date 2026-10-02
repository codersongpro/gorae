// 사이드바(extension/)를 고치면 웹 버전(site/app/)·뷰어·검수 도구의 복사본도 같이 갱신되어야 한다.
// 어긋나 있으면 이 시험이 실패한다 → `npm run sync` 실행. (배포 때는 워크플로가 sync를 먼저 돌려 항상 최신으로 올린다)
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('웹 버전·뷰어·검수 도구 복사본이 원본(extension/·shared/·design/)과 같다', () => {
  const r = spawnSync(process.execPath, ['tools/sync.mjs', '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `어긋난 파일이 있어요. npm run sync 를 실행하세요.\n${r.stdout}`);
});
