// 운영 열쇠 도구 — 관리(root) 열쇠와 파수꾼고래 검수 열쇠를 저장소 밖에서 만들고, 관리 공개키만 코드에 넣는다.
// 개인 열쇠는 암호 건 백업 파일로만, 저장소 밖 폴더에만 쓴다. 절차: docs/root-key-setup.md
//
//   node tools/keys.mjs init  --dir <저장소 밖 폴더> [--reviewer-id guard-2] [--reviewer-name 푸른물결]
//   node tools/keys.mjs apply --dir <같은 폴더>     → extension/core/rootkey.js 에 관리 공개키 반영
//   node tools/keys.mjs info  --dir <같은 폴더>     → 지문 확인
//
// 암호: 환경 변수 GORAE_ROOT_PASSPHRASE · GORAE_REVIEWER_PASSPHRASE (12자 이상).
// 없으면 init이 임의의 긴 암호를 만들어 같은 폴더의 PASSPHRASES-오프라인으로-옮기기.txt 에 적는다 (옮긴 뒤 지울 것).
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as tp from '../shared/tailprint.js';
import { encryptJwk, decryptJwk } from '../shared/keybackup.js';

const REPO = fileURLToPath(new URL('../', import.meta.url));
export const PASS_FILE = 'PASSPHRASES-오프라인으로-옮기기.txt';
const MIN_PASS = 12;
const exists = (p) => access(p).then(() => true, () => false);

// 저장소 안에는 개인 열쇠를 절대 쓰지 않는다
export function assertOutsideRepo(dir) {
  const rel = relative(REPO, resolve(dir));
  if (!rel || (!rel.startsWith('..') && !isAbsolute(rel))) throw new Error(`열쇠 폴더는 저장소 밖이어야 해요: ${resolve(dir)}`);
}

// 공개키 지문: 정렬한 JWK의 SHA-256 앞 16자리
export async function fingerprintOf(jwk) {
  const { kty, crv, x, y } = jwk;
  return 'sha256:' + (await tp.sha256Hex(tp.canonicalize({ kty, crv, x, y }))).slice(0, 16);
}

const randomPass = () => tp.toB64u(crypto.getRandomValues(new Uint8Array(24)));

// 암호 읽기: 환경 변수 → 열쇠 폴더의 암호 파일
export async function passphrases(dir) {
  const out = { root: process.env.GORAE_ROOT_PASSPHRASE || '', reviewer: process.env.GORAE_REVIEWER_PASSPHRASE || '' };
  const file = join(dir, PASS_FILE);
  if ((!out.root || !out.reviewer) && (await exists(file))) {
    const text = await readFile(file, 'utf8');
    out.root ||= (/^root=(.+)$/m.exec(text) || [])[1] || '';
    out.reviewer ||= (/^reviewer=(.+)$/m.exec(text) || [])[1] || '';
  }
  return out;
}

// 열쇠 폴더에서 개인 열쇠를 되살린다 (빌드 도구용). 반환: { root, reviewer: { id, nickname, privateKey, publicJwk } }
export async function loadKeys(dir) {
  const pass = await passphrases(dir);
  const read = async (name) => JSON.parse(await readFile(join(dir, name), 'utf8'));
  const rootBackup = await read('root.keybackup.json');
  const revBackup = await read('reviewer.keybackup.json');
  const rootJwk = await decryptJwk(rootBackup, pass.root);
  const revJwk = await decryptJwk(revBackup, pass.reviewer);
  const pub = ({ kty, crv, x, y }) => ({ kty, crv, x, y });
  return {
    root: { privateKey: await tp.importPrivateJwk(rootJwk), publicJwk: pub(rootJwk), meta: rootBackup.meta || {} },
    reviewer: { ...revBackup.meta, privateKey: await tp.importPrivateJwk(revJwk), publicJwk: pub(revJwk) },
  };
}

async function makeBackup(passphrase, kind, meta) {
  const kp = await tp.generateKeyPair({ extractable: true });
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const publicJwk = await tp.exportPublicJwk(kp.publicKey);
  return { backup: { ...(await encryptJwk(jwk, passphrase, { kind })), meta }, publicJwk };
}

async function init(dir, { reviewerId, reviewerName }) {
  assertOutsideRepo(dir);
  await mkdir(dir, { recursive: true });
  if (await exists(join(dir, 'root.keybackup.json'))) throw new Error('이미 관리 열쇠가 있어요. 덮어쓰지 않습니다: ' + dir);
  const pass = { root: process.env.GORAE_ROOT_PASSPHRASE || randomPass(), reviewer: process.env.GORAE_REVIEWER_PASSPHRASE || randomPass() };
  for (const [k, v] of Object.entries(pass)) if (v.length < MIN_PASS) throw new Error(`${k} 암호는 ${MIN_PASS}자 이상이어야 해요.`);
  const issuedAt = new Date().toISOString();
  const root = await makeBackup(pass.root, 'root', { id: 'root-' + issuedAt.slice(0, 7), issuedAt });
  const rev = await makeBackup(pass.reviewer, 'reviewer', { id: reviewerId, nickname: reviewerName });
  await writeFile(join(dir, 'root.keybackup.json'), JSON.stringify(root.backup));
  await writeFile(join(dir, 'root.public.jwk'), JSON.stringify(root.publicJwk));
  await writeFile(join(dir, 'reviewer.keybackup.json'), JSON.stringify(rev.backup));
  await writeFile(join(dir, 'reviewer.public.jwk'), JSON.stringify(rev.publicJwk));
  if (!process.env.GORAE_ROOT_PASSPHRASE || !process.env.GORAE_REVIEWER_PASSPHRASE) {
    await writeFile(join(dir, PASS_FILE), [
      '# 고래곳간 열쇠 백업 암호 — 종이·암호 관리자 등 오프라인으로 옮긴 뒤 이 파일을 지우세요.',
      '# 이 파일과 백업 파일을 같은 곳에 두면 암호를 건 의미가 없습니다.',
      `root=${pass.root}`,
      `reviewer=${pass.reviewer}`,
      '',
    ].join('\n'));
  }
  console.log('열쇠를 만들었어요:', dir);
  console.log('관리 공개키 지문:', await fingerprintOf(root.publicJwk));
  console.log('파수꾼고래:', reviewerId, reviewerName, await fingerprintOf(rev.publicJwk));
}

export async function rootKeySource(publicJwk, meta = {}) {
  const info = { kind: 'production', id: meta.id || 'root', issuedAt: meta.issuedAt || '', fingerprint: await fingerprintOf(publicJwk) };
  return [
    '// 고래곳간 관리 공개키 (운영용). 짝이 되는 관리 개인 열쇠는 저장소 밖에 오프라인으로 보관한다 — docs/root-key-setup.md',
    '// 이 파일은 tools/keys.mjs apply 로만 바꾼다. 개인 열쇠(d 값)는 절대 넣지 않는다.',
    `export const ROOT_KEY_INFO = ${JSON.stringify(info)};`,
    `export const ROOT_PUBLIC_JWK = ${JSON.stringify(publicJwk)};`,
    '',
  ].join('\n');
}

async function apply(dir) {
  const publicJwk = JSON.parse(await readFile(join(dir, 'root.public.jwk'), 'utf8'));
  const meta = JSON.parse(await readFile(join(dir, 'root.keybackup.json'), 'utf8')).meta || {};
  await writeFile(new URL('../extension/core/rootkey.js', import.meta.url), await rootKeySource(publicJwk, meta));
  console.log('extension/core/rootkey.js 에 관리 공개키를 넣었어요.', await fingerprintOf(publicJwk));
  console.log('다음: node tools/build-sample.mjs (족보·목록 다시 서명) → npm test');
}

async function info(dir) {
  for (const f of ['root.public.jwk', 'reviewer.public.jwk']) {
    const p = join(dir, f);
    if (await exists(p)) console.log(f, await fingerprintOf(JSON.parse(await readFile(p, 'utf8'))));
  }
}

// 명령줄
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const arg = (name, def) => { const i = rest.indexOf('--' + name); return i >= 0 ? rest[i + 1] : def; };
  const dir = arg('dir', process.env.GORAE_KEY_DIR);
  if (!dir) throw new Error('--dir <저장소 밖 열쇠 폴더> 를 주세요.');
  if (cmd === 'init') await init(dir, { reviewerId: arg('reviewer-id', 'guard-2'), reviewerName: arg('reviewer-name', '푸른물결') });
  else if (cmd === 'apply') await apply(dir);
  else if (cmd === 'info') await info(dir);
  else throw new Error('명령: init | apply | info');
}
