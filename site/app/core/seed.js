// 처음 실행할 때 내 곳간에 샘플 작품을 한 번만 담는다 (시연용). 지운 뒤에는 다시 담지 않는다. (DOM 없음)
import { checkWork } from './checker.js';

const FLAG = 'mypodSeeded';

// samples: [작품 카드]. 반환: 담은 작품 id 목록 (이미 담았던 기기면 빈 배열)
export async function seedMypod({ storage, store, samples }) {
  if (await storage.get(FLAG)) return [];
  const added = [];
  for (const work of samples || []) {
    const r = await store.add(work, { source: 'maker', checkReport: checkWork(work), extra: { sample: true } });
    if (r.ok) added.push(work.id);
  }
  await storage.set(FLAG, true);
  return added;
}

// 학급 꾸러미에 미리 골라 둘 샘플: 내 곳간에 아직 있는 것만
export async function samplesInMypod(store, samples) {
  const ids = new Set((await store.list()).map((r) => r.id));
  return (samples || []).map((w) => w.id).filter((id) => ids.has(id));
}
