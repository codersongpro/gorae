import test from 'node:test';
import assert from 'node:assert/strict';
import { sheetCsvUrls } from '../shared/market.js';
import { MARKET, marketReady } from '../extension/core/market-config.js';
import { loadMarket } from '../extension/core/market.js';
import { createMemoryStorage } from '../extension/core/storage.js';
test('운영에서 원응답 시트는 공개목록 CSV의 실패 대체 경로가 될 수 없다', async () => {
  const publicUrl='https://docs.google.com/spreadsheets/d/e/PUBLIC/pub?output=csv';
  const c={...MARKET,sheetId:'RAW',publishedCsvUrl:publicUrl};
  assert.deepEqual(sheetCsvUrls(c),[publicUrl]); assert.equal(marketReady({...MARKET,publishedCsvUrl:'',sheetId:'RAW'}),false);
  const storage=createMemoryStorage(); await storage.set('marketCache',{text:'제목,주소\n비공개,http://example.com',at:new Date().toISOString()});
  const called=[];
  await assert.rejects(loadMarket({config:c,storage,fetchFn:async(url)=>{called.push(url);throw new TypeError('offline');}}));
  assert.deepEqual(called,[publicUrl]);
});

test('공개목록 미설정은 네트워크 요청 없이 중단하고 예전 원응답 캐시도 사용하지 않는다', async () => {
  const storage = createMemoryStorage(); await storage.set('marketCache', {text:'old'});
  let requested = false;
  await assert.rejects(loadMarket({config:{...MARKET,publishedCsvUrl:''},storage,fetchFn:async()=>{requested=true;throw new Error('unexpected');}}), e=>e.code==='NOT_CONFIGURED');
  assert.equal(requested,false); assert.equal(await storage.get('marketCache'),null);
});

test('같은 고정 파일의 공개목록 탭만 요청하고 탭 지정이 없는 원응답 주소로 대체하지 않는다', async () => {
  const publicUrl = 'https://docs.google.com/spreadsheets/d/FIXED/export?format=csv&gid=PUBLIC_TAB';
  const config = {...MARKET,sheetId:'FIXED',publishedCsvUrl:publicUrl};
  const called = [];
  const csv = '닉네임,제목,앱의 종류,설명,자료의 종류,웹 앱 주소,업로드\n나눔고래,발표자료,수업자료,발표 활동,배포한 웹 앱,https://example.com/slides,';
  const r = await loadMarket({config,storage:createMemoryStorage(),fetchFn:async(url)=>{
    called.push(url); return {ok:true,status:200,url,headers:{get:()=> 'text/csv'},text:async()=>csv};
  }});
  assert.deepEqual(called,[publicUrl]); assert.equal(r.entries[0].title,'발표자료'); assert.equal(r.source,'network');
});
