// 빌드 도구 없이 동작하도록, 확장앱 폴더 밖의 공용 파일을 extension/ 안으로 복사한다.
//   shared/*.js        → extension/shared/
//   design/tokens.css  → extension/ui/tokens.css
//   site/*.json        → extension/sample/   (배포 전 번들 샘플 목록)
// `--check` 를 주면 복사하지 않고 어긋난 파일이 있는지만 확인한다.
import { copyFile, mkdir, readdir, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const jobs = [];
for (const f of await readdir(new URL('shared/', root))) {
  if (f.endsWith('.js')) jobs.push([`shared/${f}`, `extension/shared/${f}`]);
}
jobs.push(['design/tokens.css', 'extension/ui/tokens.css']);
for (const f of ['catalog.json', 'reviewers.json']) jobs.push([`site/${f}`, `extension/sample/${f}`]);

const check = process.argv.includes('--check');
let stale = 0;
for (const [from, to] of jobs) {
  const src = new URL(from, root);
  const dst = new URL(to, root);
  if (check) {
    const [a, b] = await Promise.all([readFile(src), readFile(dst).catch(() => null)]);
    if (!b || !a.equals(b)) {
      console.log('어긋남:', to);
      stale++;
    }
  } else {
    await mkdir(new URL('./', dst), { recursive: true });
    await copyFile(src, dst);
  }
}
if (check) process.exit(stale ? 1 : 0);
console.log(`동기화 ${jobs.length}개 파일`);
