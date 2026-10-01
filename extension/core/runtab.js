// 새 탭 실행용 '실행 표': 사이드바가 작품을 맡기고 실행 화면(run.html)이 번호로 꺼내 간다 (DOM 없음)
// 작품 내용은 주소에 넣지 않고 확장앱 저장소에만 둔다. 새로고침해도 다시 열리도록 최근 10개를 보관한다.
const KEY = 'runTickets';
const KEEP = 10;

export async function putRunTicket(storage, { work, status }, { now = Date.now(), idGen = () => Math.random().toString(36).slice(2, 10) } = {}) {
  const id = now.toString(36) + idGen();
  const list = (await storage.get(KEY)) || [];
  const next = [{ id, work, status, at: now }, ...list.filter((t) => t.id !== id)].slice(0, KEEP);
  await storage.set(KEY, next);
  return id;
}

export async function takeRunTicket(storage, id) {
  if (!id) return null;
  const list = (await storage.get(KEY)) || [];
  return list.find((t) => t.id === id) || null;
}
