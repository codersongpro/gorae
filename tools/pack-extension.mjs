// extension/ 폴더만 압축해 site/gorae-extension.zip 으로 만든다 (외부 도구 없이 ZIP 형식을 직접 쓴다).
// 같은 내용이면 같은 파일이 나오도록 파일 순서·날짜를 고정한다 → sync 검사에서 오래된 압축 파일을 잡아낸다.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';

const root = new URL('../', import.meta.url);
export const ZIP_PATH = 'site/gorae-extension.zip';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

async function listFiles(dirUrl, prefix = '') {
  const out = [];
  for (const e of (await readdir(dirUrl, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.isDirectory()) out.push(...(await listFiles(new URL(e.name + '/', dirUrl), prefix + e.name + '/')));
    else out.push(prefix + e.name);
  }
  return out;
}

export async function buildZip() {
  const names = await listFiles(new URL('extension/', root));
  const DOS_TIME = 0, DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01 00:00 (고정)
  const locals = [], centrals = [];
  let offset = 0;
  for (const name of names) {
    const data = await readFile(new URL('extension/' + name, root));
    const comp = deflateRawSync(data, { level: 9 });
    const useDeflate = comp.length < data.length;
    const body = useDeflate ? comp : data;
    const nameBuf = Buffer.from('extension/' + name, 'utf8'); // 압축을 풀면 extension 폴더 아래에 파일이 들어간다
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); // UTF-8 이름
    local.writeUInt16LE(useDeflate ? 8 : 0, 8); local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, body);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(useDeflate ? 8 : 0, 10); cen.writeUInt16LE(DOS_TIME, 12); cen.writeUInt16LE(DOS_DATE, 14);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(body.length, 20); cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    centrals.push(cen, nameBuf);
    offset += 30 + nameBuf.length + body.length;
  }
  const cenBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cenBuf, end]);
}

if (import.meta.url === new URL(process.argv[1], 'file:///').href || process.argv[1]?.endsWith('pack-extension.mjs')) {
  const buf = await buildZip();
  await writeFile(new URL(ZIP_PATH, root), buf);
  console.log(`압축 완료: ${ZIP_PATH} (${buf.length} bytes)`);
}
