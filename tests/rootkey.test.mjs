// 운영 관리 공개키와 개인 열쇠 보관 규칙 (docs/root-key-setup.md)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { ROOT_PUBLIC_JWK, ROOT_KEY_INFO } from '../extension/core/rootkey.js';
import { fingerprintOf, rootKeySource, assertOutsideRepo } from '../tools/keys.mjs';
import { verifyReviewerList } from '../shared/tailprint.js';

const root = new URL('../', import.meta.url);

test('관리 공개키는 운영용으로 표시되고 지문이 공개키와 맞는다 (테스트용 표시 없음)', async () => {
  const src = await readFile(new URL('extension/core/rootkey.js', root), 'utf8');
  assert.ok(!/테스트/.test(src));
  assert.equal(ROOT_KEY_INFO.kind, 'production');
  assert.equal(ROOT_KEY_INFO.fingerprint, await fingerprintOf(ROOT_PUBLIC_JWK));
  assert.equal('d' in ROOT_PUBLIC_JWK, false); // 공개키에는 개인 값이 없다
  assert.equal(src, await rootKeySource(ROOT_PUBLIC_JWK, ROOT_KEY_INFO)); // tools/keys.mjs apply 로 만든 모양 그대로
});

test('게시된 고래 족보는 내장된 관리 공개키로 검증된다', async () => {
  const list = JSON.parse(await readFile(new URL('site/reviewers.json', root), 'utf8'));
  const r = await verifyReviewerList(list, ROOT_PUBLIC_JWK, 0);
  assert.equal(r.ok, true);
  assert.ok(r.version >= 2);
});

// 배포되는 폴더(사이트·확장앱·공용 코드·문서·도구)에 개인 열쇠나 열쇠 백업이 섞이지 않았는지
async function walk(dir, out = []) {
  for (const e of await readdir(new URL(dir, root), { withFileTypes: true })) {
    const rel = dir + e.name;
    if (e.isDirectory()) await walk(rel + '/', out);
    else if (/\.(js|mjs|json|jwk|html|md|txt|keybackup)$/.test(e.name)) out.push(rel);
  }
  return out;
}
test('사이트·확장앱·공용 코드에 개인 열쇠나 열쇠 백업 파일이 없다', async () => {
  const files = (await Promise.all(['site/', 'extension/', 'shared/', 'docs/', 'tools/', 'samples/'].map((d) => walk(d)))).flat();
  assert.ok(files.length > 50);
  for (const f of files) {
    assert.ok(!/\.keybackup|\.private\.jwk|PASSPHRASES/i.test(f), f);
    const text = await readFile(new URL(f, root), 'utf8');
    assert.ok(!/"kty"\s*:\s*"EC"[^}]*"d"\s*:\s*"/.test(text), `개인 열쇠(d 값)가 들어 있음: ${f}`);
    assert.ok(!/"format"\s*:\s*"gorae-keybackup"/.test(text) || f === 'shared/keybackup.js', `열쇠 백업이 들어 있음: ${f}`);
  }
});

test('열쇠 도구는 저장소 안 폴더에 개인 열쇠를 쓰지 않는다', () => {
  assert.throws(() => assertOutsideRepo(new URL('site/', root).pathname.replace(/^\/(\w:)/, '$1')));
  assert.throws(() => assertOutsideRepo(new URL('./', root).pathname.replace(/^\/(\w:)/, '$1')));
});
