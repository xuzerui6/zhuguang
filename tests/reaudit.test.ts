import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { BOOKING_LABELS, isTerminalBooking, consumesTrial } from '../shared/booking-rules';
import { getBookingStatusCopy, getBookingBucket } from '../app/mobile/domain';
import type { MobileBooking } from '../app/mobile/types';
import { recoverPageSession, type PageRecoveryState } from '../app/_lib/page-session-recovery';
import { FavoriteSync } from '../app/mobile/favorite-sync';
import { resolveServiceCity, SERVICE_AREAS } from '../shared/service-cities';

test('web city context survives directory, consultation and booking navigation',async()=>{
  assert.equal(resolveServiceCity('长春'),'changchun');
  assert.equal(resolveServiceCity('changchun'),'changchun');
  assert.equal(resolveServiceCity(null),'beijing');
  assert.equal(SERVICE_AREAS.changchun.includes('通州区'),false);
  const directory=await readFile(new URL('../app/_components/coach-directory.tsx',import.meta.url),'utf8');
  assert.ok(directory.includes('bookingHref = `/student/bookings?coach=${coach.id}&city=${cityId}`'));
  const booking=await readFile(new URL('../app/_components/student-pages.tsx',import.meta.url),'utf8');
  assert.ok(booking.includes('booking-options?city=${cityId}'));
  assert.ok(booking.includes('serviceCityId:cityId'));
  const lead=await readFile(new URL('../app/_components/service-lead-form.tsx',import.meta.url),'utf8');
  assert.ok(lead.includes('SERVICE_AREAS[cityId].map'));
  assert.ok(lead.includes('serviceCityId:cityId'));
  const detail=await readFile(new URL('../app/coaches/[id]/page.tsx',import.meta.url),'utf8');
  assert.ok(detail.includes('if (!servesCity) notFound()'));
});

test('miniapp city context and learner management do not fall back to packaged Beijing supply',async()=>{
  const api=await readFile(new URL('../miniapp/src/services/api.ts',import.meta.url),'utf8');
  assert.ok(api.includes('cityId: ServiceCityId = getStoredServiceCity()'));
  assert.ok(api.includes('TARO_APP_PREVIEW !== "true"'));
  const index=await readFile(new URL('../miniapp/src/pages/index/index.tsx',import.meta.url),'utf8');
  assert.equal(index.includes('useState<Bootstrap>(guestBootstrap)'),false);
  assert.ok(index.includes('key={serviceCity}'));
  assert.ok(index.includes('coaches:[]}'));
  const home=await readFile(new URL('../miniapp/src/features/student/home.tsx',import.meta.url),'utf8');
  assert.ok(home.includes('CoachCarousel key='));
  const learner=await readFile(new URL('../miniapp/src/pages/learner-profile/index.tsx',import.meta.url),'utf8');
  assert.ok(learner.includes('id: profileId || undefined'));
  assert.ok(learner.includes('viewOnly'));
  for(const path of ['miniapp/src/components/coach-row.tsx','miniapp/src/pages/coach-detail/index.tsx']){
    const source=await readFile(new URL(`../${path}`,import.meta.url),'utf8');
    assert.equal(source.includes('· 北京{coach.district'),false);
    assert.ok(source.includes(path.includes('coach-detail') ? 'serviceCityName(serviceCity)' : 'serviceCityName(getStoredServiceCity())'));
  }
  const config=await readFile(new URL('../miniapp/src/app.config.ts',import.meta.url),'utf8');
  const location=await readFile(new URL('../miniapp/src/services/service-city.ts',import.meta.url),'utf8');
  assert.ok(config.includes('TARO_APP_FUZZY_LOCATION_ENABLED === "true"'));
  assert.ok(location.includes('TARO_APP_FUZZY_LOCATION_ENABLED !== "true"'));
});

test('reaudit P2-9 unused workspace styles are removed; pages use shared styles',async()=>{
  for(const page of ['ops-pages','coach-pages','student-pages']) {
    await assert.rejects(readFile(new URL(`../app/_components/${page}.module.css`,import.meta.url)),{code:'ENOENT'});
    const source=await readFile(new URL(`../app/_components/${page}.tsx`,import.meta.url),'utf8');
    assert.ok(source.includes('./platform-pages.module.css'));
  }
});

test('reaudit P2-8 customer copy and metric hierarchy stay task focused',async()=>{
  for(const path of ['app/page.tsx','app/_components/student-pages.tsx','app/_components/coach-pages.tsx']) {
    const source=await readFile(new URL(`../${path}`,import.meta.url),'utf8');
    assert.equal(/资料真实，比数字热闹更重要|把训练安排在真正合适的位置|正式数据库|空数据不会用演示记录补齐|不展示虚构课量或进度|条真实记录/.test(source),false);
  }
  const ops=await readFile(new URL('../app/_components/ops-pages.tsx',import.meta.url),'utf8');
  assert.ok(ops.includes('/ops/matching?classification=unclassified'));
  assert.ok(ops.indexOf('styles.metrics')<ops.indexOf('styles.verificationSummary'));
});

test('reaudit P2-7 baseline browser mapping includes the targeted security patch',async()=>{
  const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
  const [major,minor]=lock.packages['node_modules/baseline-browser-mapping'].version.split('.').map(Number);
  assert.ok(major>2 || major===2 && minor>=11);
});

test('reaudit P2-6 public footer never hides policy and feedback group', async()=>{
  const css=await readFile(new URL('../app/_components/public-site.module.css',import.meta.url),'utf8');
  assert.equal(/\.footerMain\s*>\s*div:last-child\s*\{\s*display:\s*none/.test(css),false);
  const source=await readFile(new URL('../app/_components/public-footer.tsx',import.meta.url),'utf8');
  for(const href of ['/privacy','/terms','/service-guarantee#booking','/service-guarantee#feedback']) assert.ok(source.includes(`href="${href}"`));
});

test('reaudit P2-5 workspace menu has modal lifecycle and account dismiss handlers', async()=>{
  const source=await readFile(new URL('../app/_components/workspace-shell.tsx',import.meta.url),'utf8');
  assert.ok(source.includes('showModal()'));
  assert.ok(source.includes('aria-expanded={menuOpen}'));
  assert.ok(source.includes("'pointerdown'"));
  assert.ok(source.includes("'Escape'"));
});

test('reaudit P2-4 release controls use container-aware bounds and direct upload entry', async()=>{
  const css=await readFile(new URL('../app/_components/platform-pages.module.css',import.meta.url),'utf8');
  const source=await readFile(new URL('../app/_components/release-center.tsx',import.meta.url),'utf8');
  assert.ok(css.includes('container-type: inline-size'));
  assert.ok(css.includes('@container (max-width: 440px)'));
  assert.ok(source.includes('href="#release-upload"'));
});

test('reaudit P2-3 server snapshots, pending removal, races and account isolation', async () => {
  const sync = new FavoriteSync(); sync.activate('a', { ids:[7], pending:[] });
  sync.accept([],sync.ticket()); assert.deepEqual(sync.ids(),[]);
  sync.accept([7],sync.ticket()); const stale=sync.ticket();
  sync.toggle(7); sync.accept([7],stale); assert.deepEqual(sync.ids(),[]);
  const offline=sync.save(); sync.activate('a',offline); assert.deepEqual(sync.ids(),[]);
  let calls=0;
  await assert.rejects(sync.flush(async()=>{ calls++; throw new Error('offline'); }));
  assert.equal(sync.save().pending.length,1); assert.deepEqual(sync.ids(),[]);
  await sync.flush(async(id,favorite)=>{ assert.equal(id,7); assert.equal(favorite,false); calls++; return []; });
  assert.equal(calls,2); assert.equal(sync.save().pending.length,0);
  sync.toggle(7);
  let finish!: (ids:number[])=>void;
  const send=sync.flush(()=>new Promise(resolve=>{ finish=resolve; }));
  sync.toggle(7); finish([7]); await send;
  assert.deepEqual(sync.ids(),[]);
  assert.equal(sync.save().pending[0].favorite,false);
  const old=sync.ticket(); sync.activate('b',{ids:[5],pending:[]});
  sync.accept([7],old); assert.deepEqual(sync.ids(),[5]);
  assert.equal(sync.save().pending.length,0);
});

test('reaudit P2-2 recovery success stays successful during slow navigation; failures and unmount', async () => {
  const states: PageRecoveryState[] = []; let navigations = 0;
  const controller = new AbortController();
  await recoverPageSession(Promise.resolve(true), state=>states.push(state), ()=>{ navigations++; }, controller.signal);
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.deepEqual(states,['succeeded']); assert.equal(navigations,1);
  for (const result of [Promise.resolve(false), Promise.reject(new Error('503')), Promise.reject(new DOMException('timeout','TimeoutError'))]) {
    await recoverPageSession(result,state=>states.push(state),()=>{ navigations++; },controller.signal);
    assert.equal(states.at(-1),'failed');
  }
  controller.abort(); const count=states.length;
  await recoverPageSession(Promise.resolve(true), state=>states.push(state),()=>{ navigations++; },controller.signal);
  assert.equal(states.length,count); assert.equal(navigations,1);
});

test('reaudit P2-1 all terminal bookings remain history, never upcoming', async () => {
  const source = await readFile(new URL('../app/_components/student-pages.tsx', import.meta.url), 'utf8');
  assert.match(source, /data\.bookings\.find\(\(booking\) => !isTerminalBooking\(booking.status\)\)/);
  for (const status of Object.keys(BOOKING_LABELS)) {
    const terminal = ['completed','rejected','expired','cancelled','cancelled_by_student','cancelled_by_coach'].includes(status);
    assert.equal(isTerminalBooking(status), terminal);
    assert.equal(getBookingBucket({status} as MobileBooking) === 'completed', terminal);
    assert.equal(getBookingStatusCopy(status as MobileBooking['status']).label, BOOKING_LABELS[status]);
    assert.equal(consumesTrial(status), ['pending_coach','confirmed','reschedule_requested','completed'].includes(status));
  }
});

test('WeChat miniapp keeps reviews, dual roles and reschedule state connected to real APIs', async () => {
  const [appConfig, api, detail, bookings, index, coachRequests, bookingPage, coachRow] = await Promise.all([
    readFile(new URL('../miniapp/src/app.config.ts', import.meta.url), 'utf8'),
    readFile(new URL('../miniapp/src/services/api.ts', import.meta.url), 'utf8'),
    readFile(new URL('../miniapp/src/pages/coach-detail/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../miniapp/src/features/student/bookings.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../miniapp/src/pages/index/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../miniapp/src/features/coach/requests.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../miniapp/src/pages/booking/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../miniapp/src/components/coach-row.tsx', import.meta.url), 'utf8'),
  ]);
  assert.ok(appConfig.includes('pages/review/index'));
  assert.ok(api.includes('/api/v1/coaches/${coachId}/reviews?sort=recent'));
  assert.ok(api.includes('/api/v1/reviews/${encodeURIComponent(reviewId)}/resubmit'));
  assert.ok(detail.includes('listCoachReviews(id)'));
  assert.ok(bookings.includes('booking.review?.canSubmit || booking.review?.canResubmit'));
  assert.ok(index.includes('进入教练工作台'));
  assert.ok(index.includes('setInterval(() => { if (visible.current) void load(true); }, 15_000)'));
  assert.ok(index.includes('useDidHide'));
  assert.ok(coachRequests.includes('等待学员回应'));
  assert.doesNotMatch(bookingPage, /realCoaches\[0\]/u);
  assert.match(bookingPage, /if \(!coach \|\| !options\)/u);
  assert.match(bookingPage, /预约配置加载失败/u);
  assert.match(coachRow, /\{onFavorite \?/u);
});
