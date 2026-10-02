// 빌드 도구 없이 동작하도록, 폴더 밖의 공용 파일을 확장앱(extension/)과 웹 사이트(site/) 안으로 복사한다.
//   shared/*.js            → extension/shared/ , site/shared/
//   design/tokens.css      → extension/ui/tokens.css , site/tokens.css
//   site/{catalog,reviewers}.json → extension/sample/   (배포 전 번들 샘플 목록)
//   extension/core/rootkey.js     → site/rootkey.js     (대왕고래 공개키)
//   extension/ui/strings.js       → site/strings.js     (화면 문구 한 곳 유지)
//   extension/ui/dom.js           → site/dom.js
// `--check` 를 주면 복사하지 않고 어긋난 파일이 있는지만 확인한다.
import { copyFile, mkdir, readdir, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const jobs = [];
for (const f of await readdir(new URL('shared/', root))) {
  if (f.endsWith('.js')) {
    jobs.push([`shared/${f}`, `extension/shared/${f}`]);
    jobs.push([`shared/${f}`, `site/shared/${f}`]);
  }
}
jobs.push(['design/tokens.css', 'extension/ui/tokens.css']);
jobs.push(['design/tokens.css', 'site/tokens.css']);
for (const f of ['catalog.json', 'reviewers.json']) jobs.push([`site/${f}`, `extension/sample/${f}`]);
jobs.push(['extension/core/rootkey.js', 'site/rootkey.js']);
jobs.push(['extension/ui/strings.js', 'site/strings.js']);
jobs.push(['extension/ui/dom.js', 'site/dom.js']); // 뷰어·검수 도구가 쓰는 작은 DOM 도우미

const check = process.argv.includes('--check');
let stale = 0;

// 웹 버전(site/app/): 확장앱 코드를 그대로 복사한다. 웨일 전용 파일(manifest·sidebar.html·run.html)은 제외 —
// 웹용 index.html·run.html·web-shim.js·web.css는 site/app/ 에 직접 둔다.
const SKIP = new Set(['manifest.json', 'sidebar.html', 'run.html', 'README.md']);
async function listFiles(dir, base = '') {
  const out = [];
  for (const e of await readdir(new URL(dir, root), { withFileTypes: true })) {
    const rel = base + e.name;
    if (e.isDirectory()) out.push(...(await listFiles(`${dir}${e.name}/`, `${rel}/`)));
    else if (!SKIP.has(rel)) out.push(rel);
  }
  return out;
}
// 확장앱 폴더의 생성물(shared·sample·tokens)이 먼저 만들어진 뒤 복사해야 하므로 1차 복사를 먼저 한다
async function copyJobs(list) {
  for (const [from, to] of list) {
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
}
await copyJobs(jobs);
const appJobs = (await listFiles('extension/')).map((f) => [`extension/${f}`, `site/app/${f}`]);
await copyJobs(appJobs);
jobs.push(...appJobs);
if (check) process.exit(stale ? 1 : 0);
console.log(`동기화 ${jobs.length}개 파일`);
