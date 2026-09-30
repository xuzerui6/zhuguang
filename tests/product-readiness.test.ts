import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { dateInShanghai, parseTrainingTime, SubmissionKey, LatestRead, safeMiniappNext } from '../shared/product-flow';
import { HomeCityController, homeCityUrl, homeTrialPrice } from '../app/_lib/home-city-state';
import { publicCoaches } from '../app/_lib/web-platform';
import { coachOnboardingEntry, type CoachOnboardingSummary } from '../shared/coach-application';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProfileView } from '../app/mobile/views/profile-view';

test('Android profile renders application progress and hides entry for suspended coaches', () => {
  const props={activeBookingCount:0,completedCount:0,savedCount:0,onAction:()=>undefined,learner:{id:'',name:'',relation:'self' as const,gender:'unspecified' as const,age:0,sport:'田径',level:'初学',goal:''}};
  const pending:CoachOnboardingSummary={status:'pending',isOnboarded:false,canApply:false,canEnterWorkspace:false};
  assert.match(renderToStaticMarkup(createElement(ProfileView,{...props,coachOnboarding:pending})),/查看审核进度/u);
  const suspended=renderToStaticMarkup(createElement(ProfileView,{...props,coachOnboarding:{...pending,status:'approved',isOnboarded:true}}));
  assert.doesNotMatch(suspended,/申请成为教练|查看审核进度/u);assert.match(suspended,/教练权限暂停/u);
});

test('onboarding entry labels do not expose applications to onboarded or suspended coaches', () => {
  const summary:CoachOnboardingSummary={status:'not_applied',isOnboarded:false,canApply:true,canEnterWorkspace:false};
  assert.equal(coachOnboardingEntry().title,'申请成为教练');
  for(const [status,title] of [['draft','继续填写'],['pending','查看审核进度'],['rejected','修改并重新提交'],['withdrawn','申请成为教练']] as const) {
    assert.equal(coachOnboardingEntry({...summary,status}).title,title);
  }
  assert.equal(coachOnboardingEntry({...summary,status:'rejected',rejectionReason:'补充真实证明'}).description,'补充真实证明');
  assert.equal(coachOnboardingEntry({...summary,status:'approved',isOnboarded:true,canEnterWorkspace:true}).kind,'coach');
  const suspended=coachOnboardingEntry({...summary,isOnboarded:true}, {auditStatus:'suspended'});
  assert.equal(suspended.kind,'coach');assert.equal(suspended.canEnter,false);
  assert.equal(coachOnboardingEntry(undefined,{auditStatus:'approved'}).kind,'coach');
});

test('coach application entry uses durable onboarding and is limited to profile', async () => {
  const mobile=await readFile(new URL('../app/mobile/views/profile-view.tsx',import.meta.url),'utf8');
  const profile=await readFile(new URL('../miniapp/src/features/student/profile.tsx',import.meta.url),'utf8');
  const discover=await readFile(new URL('../miniapp/src/features/student/discover.tsx',import.meta.url),'utf8');
  assert.match(mobile,/coachOnboardingEntry/u);assert.match(profile,/coachOnboardingEntry/u);
  assert.doesNotMatch(discover,/onCoachApplication/u);
  const index=await readFile(new URL('../miniapp/src/pages/index/index.tsx',import.meta.url),'utf8');
  assert.match(index,/account-link\/index\?next=/u);
});

test('market beta copy and account controls consistently describe dual-city self-service onboarding', async () => {
  const files = await Promise.all([
    '../app/page.tsx', '../app/coach-partnership/page.tsx', '../app/service-guarantee/page.tsx',
    '../app/not-found.tsx', '../app/_components/workspace-shell.tsx', '../app/_components/ops-pages.tsx',
    '../server/api/security.ts',
  ].map(file => readFile(new URL(file, import.meta.url), 'utf8')));
  const source = files.join('\n');
  assert.doesNotMatch(source, /北京试点|不开放(?:线上)?自助注册/u);
  assert.doesNotMatch(source, /北京服务目录/u);
  assert.match(source, /北京(?:与|、)吉林长春|北京、长春/u);
  const profile = await readFile(new URL('../app/_components/student-pages.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(profile, /北京所在区/u);
  assert.match(profile, /服务城市/u);
});

test('workspace routes provide delayed structural loading instead of a blank content stage', async () => {
  const loading = await readFile(new URL('../app/student/loading.tsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../app/_components/workspace-shell.module.css', import.meta.url), 'utf8');
  assert.match(loading, /WorkspaceRouteLoading/u);
  assert.match(styles, /animation-delay:\s*150ms/u);
  assert.match(styles, /prefers-reduced-motion/u);
});

test('miniapp experience build fails closed unless WeChat login and credentials are enabled', async () => {
  const script = await readFile(new URL('../scripts/invoke-miniapp-build.ps1', import.meta.url), 'utf8');
  const readiness = await readFile(new URL('../miniapp/scripts/check-readiness.mjs', import.meta.url), 'utf8');
  const workflow = await readFile(new URL('../.github/workflows/native-builds.yml', import.meta.url), 'utf8');
  assert.match(script, /\[switch\]\$EnableWechatLogin/u);
  assert.match(script, /TARO_APP_WECHAT_LOGIN_ENABLED\s*=\s*if\s*\(\$EnableWechatLogin\)/u);
  assert.match(readiness, /TARO_APP_CHANNEL_KEY/u);
  assert.match(workflow, /miniapp-check/u);
  assert.match(workflow, /WECHAT_MINIAPP_APP_ID/u);
});

test('release manifest records reproducible public build facts without secrets', async () => {
  const script = await readFile(new URL('../scripts/generate-release-manifest.mjs', import.meta.url), 'utf8');
  assert.match(script, /migrations/u);
  assert.match(script, /sha256/u);
  assert.match(script, /featureFlags/u);
  assert.match(script, /ZHUGUANG_API_WORKER_VERSION/u);
  assert.doesNotMatch(script, /SECRET_KEY|APP_SECRET|MASTER_SECRET/u);
});

test('coach action dashboards isolate QA and unclassified history without deleting it', async () => {
  const repository = await readFile(new URL('../server/api/repository.ts', import.meta.url), 'utf8');
  const web = await readFile(new URL('../app/_components/coach-pages.tsx', import.meta.url), 'utf8');
  const native = await readFile(new URL('../app/mobile/coach/coach-app.tsx', import.meta.url), 'utf8');
  assert.match(repository, /metricEligible:\s*row\.metric_eligible/u);
  assert.match(web, /operationalBookings[\s\S]*metricEligible !== false/u);
  assert.match(native, /operationalBookings[\s\S]*metricEligible !== false/u);
  assert.match(web, /BookingManager bookings=\{state\.data\.bookings\}/u);
});

test('homepage navigation shares committed city instead of returning to Beijing', async () => {
  const page = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const content = await readFile(new URL('../app/_components/home-city-content.tsx', import.meta.url), 'utf8');
  const header = await readFile(new URL('../app/_components/public-header.tsx', import.meta.url), 'utf8');
  assert.match(page, /<HomeCityProvider[^>]*>[\s\S]*?<HomePublicHeader\s*\/>/u);
  assert.match(content, /<PublicHeader cityId=\{data\.cityId\}/u);
  assert.match(header, /href=\{navigationHref\(item\.href\)\}/u);
  assert.equal((header.match(/href=\{navigationHref\(item\.href\)\}/gu) || []).length, 2);
});

test('home city changes commit supply atomically, deduplicate and ignore stale reads', async () => {
  const initial = { cityId: 'beijing' as const, coaches: publicCoaches, catalog: { city: '北京', sports: [], regions: [] } };
  let finish!: (value: typeof initial | { cityId: 'changchun'; coaches: typeof publicCoaches; catalog: typeof initial.catalog }) => void;
  let calls = 0;
  const state = new HomeCityController(initial, async () => {
    calls++;
    return new Promise(resolve => { finish = resolve; });
  });
  const first = state.load('changchun');
  const duplicate = state.load('changchun');
  assert.equal(calls, 1);
  assert.equal(state.getSnapshot().data.cityId, 'beijing');
  assert.equal(state.getSnapshot().pendingCity, 'changchun');
  await state.load('beijing');
  finish({ cityId: 'changchun', coaches: [], catalog: { city: '长春', sports: [], regions: [] } });
  assert.equal(await first, false);
  assert.equal(await duplicate, false);
  assert.equal(state.getSnapshot().data.cityId, 'beijing');
  assert.equal(state.getSnapshot().pendingCity, null);
});

test('home city failure preserves prior data and permits retry', async () => {
  const initial = { cityId: 'beijing' as const, coaches: publicCoaches, catalog: { city: '北京', sports: [], regions: [] } };
  let fails = true;
  const state = new HomeCityController(initial, async cityId => {
    if (fails) throw new Error('network unavailable');
    return { cityId, coaches: publicCoaches.slice(0, 1), catalog: { city: '长春', sports: [], regions: [] } };
  });
  assert.equal(await state.load('changchun'), false);
  assert.equal(state.getSnapshot().data, initial);
  assert.ok(state.getSnapshot().error);
  fails = false;
  assert.equal(await state.load('changchun'), true);
  assert.equal(state.getSnapshot().data.cityId, 'changchun');
  assert.equal(state.getSnapshot().data.coaches.length, 1);
  assert.equal(state.getSnapshot().error, null);
});

test('home city URL preserves unrelated context but removes unsupported coaches', () => {
  const initial = new URL('https://example.invalid/?coach=6&goal=中考体育#service-inquiry');
  assert.equal(new URL(homeCityUrl(initial, 'changchun', [5]), initial).searchParams.has('coach'), false);
  const valid = new URL(homeCityUrl(new URL('https://example.invalid/?coach=5#service-inquiry'), 'changchun', [5]), initial);
  assert.equal(valid.searchParams.get('coach'), '5');
  assert.equal(valid.searchParams.get('city'), 'changchun');
  assert.equal(valid.hash, '#service-inquiry');
});

test('home trial price only includes published real bookable supply', () => {
  const coach = publicCoaches[0];
  assert.equal(homeTrialPrice([{ ...coach, bookable: true, bookingEnabled: true, pricingStatus: 'published', trialPrice: 99 }]), 99);
  assert.equal(homeTrialPrice([{ ...coach, bookingEnabled: false, trialPrice: 1 }]), undefined);
  assert.equal(homeTrialPrice([{ ...coach, profileKind: 'demo', trialPrice: 1 }]), undefined);
  assert.equal(homeTrialPrice([]), undefined);
});

test('product booking date is deterministic across timezones and rejects invalid dates', () => {
  assert.equal(dateInShanghai(Date.UTC(2026, 8, 17, 18)), '2026-09-18');
  assert.equal(parseTrainingTime('2026-09-18', '18:30'), Date.UTC(2026, 8, 18, 10, 30));
  assert.ok(Number.isNaN(parseTrainingTime('2026-02-30', '18:30')));
  assert.ok(Number.isNaN(parseTrainingTime('2026-09-18', '25:00')));
});

test('product submission reuses keys for retries but not changed payloads', () => {
  let sequence = 0;
  const key = new SubmissionKey(() => `key_${++sequence}`);
  assert.equal(key.for({ learner: 'one', duration: 60 }), 'key_1');
  assert.equal(key.for({ learner: 'one', duration: 60 }), 'key_1');
  assert.equal(key.for({ learner: 'two', duration: 90 }), 'key_2');
  key.clear();
  assert.equal(key.for({ learner: 'two', duration: 90 }), 'key_3');
});

test('product latest read rejects stale polling results after mutations or navigation', () => {
  const reads = new LatestRead();
  const poll = reads.begin();
  const send = reads.begin();
  assert.equal(reads.isCurrent(poll), false);
  assert.equal(reads.isCurrent(send), true);
  reads.cancel();
  assert.equal(reads.isCurrent(send), false);
});

test('product login return only permits registered local miniapp pages', () => {
  assert.equal(safeMiniappNext('/pages/booking/index?coach=5&city=changchun'), '/pages/booking/index?coach=5&city=changchun');
  assert.equal(safeMiniappNext('https://evil.invalid'), '/pages/index/index?tab=profile');
  assert.equal(safeMiniappNext('/pages/missing/index'), '/pages/index/index?tab=profile');
});

test('product miniapp booking supports selected learners, visible resume and readable terms', async () => {
  const source = await readFile(new URL('../miniapp/src/pages/booking/index.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('selectedLearnerId'));
  assert.ok(source.includes('useDidShow'));
  assert.ok(source.includes('/pages/legal/index'));
  assert.ok(source.includes('bookingSubmissionKeys'));
});

test('product miniapp overview polling respects page visibility and favorite authority', async () => {
  const source = await readFile(new URL('../miniapp/src/pages/index/index.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('useDidHide'));
  assert.ok(source.includes('visible.current'));
  const detail = await readFile(new URL('../miniapp/src/pages/coach-detail/index.tsx', import.meta.url), 'utf8');
  assert.equal(detail.includes('data.favoriteCoachIds.length ?'), false);
});

test('miniapp carousel resets its page when supply changes and preserves the selected city', async () => {
  const source = await readFile(new URL('../miniapp/src/components/coach-carousel.tsx', import.meta.url), 'utf8');
  assert.ok(source.includes('Math.min(current, Math.max(0, visible.length - 1))'));
  const home = await readFile(new URL('../miniapp/src/features/student/home.tsx', import.meta.url), 'utf8');
  assert.ok(home.includes('CoachCarousel key='));
  assert.ok(source.includes('duration={260}'));
  assert.ok(source.includes('8_000'));
  assert.ok(source.includes('coach=${coach.id}&city=${cityId}'));
  const detail = await readFile(new URL('../miniapp/src/pages/coach-detail/index.tsx', import.meta.url), 'utf8');
  assert.ok(detail.includes('bootstrap(serviceCity)'));
  assert.ok(detail.includes('serviceCityName(serviceCity)'));
});

test('product coach proposals include custom locations in both native clients', async () => {
  for (const file of ['../miniapp/src/pages/coach-request/index.tsx', '../app/mobile/coach/coach-app.tsx']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.ok(source.includes('customDistrict'), file);
    assert.ok(source.includes('locationType'), file);
  }
});

test('learner navigation preserves the booking return and validates fresh acceptance', async () => {
  const booking = await readFile(new URL('../miniapp/src/pages/booking/index.tsx', import.meta.url), 'utf8');
  assert.ok(booking.includes('openLearnerPage'));
  assert.equal(booking.includes('setSession(login.session)'), false, 'wx.login already persists the session; do not change the draft owner twice');
  assert.ok(booking.includes('freshCoach'));
  const learners = await readFile(new URL('../miniapp/src/pages/learner-profile/index.tsx', import.meta.url), 'utf8');
  assert.ok(learners.includes('nextQuery'));
  const overview = await readFile(new URL('../miniapp/src/pages/index/index.tsx', import.meta.url), 'utf8');
  assert.equal(overview.includes('setSession(result.session)'), false);
  assert.ok(overview.includes('result.effectiveOnline'));
  const records = await readFile(new URL('../miniapp/src/pages/service-records/index.tsx', import.meta.url), 'utf8');
  assert.ok(records.includes('item.booking_id === bookingId'));
  assert.ok(records.includes('useDidHide'));
});
import ts from 'typescript';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function miniappHarness() {
  const storage = new Map<string, unknown>();
  const taro = { getStorageSync: (key: string) => storage.get(key), setStorageSync: (key: string, value: unknown) => storage.set(key, value), removeStorageSync: (key: string) => storage.delete(key), request: async (input: { data?: unknown; url: string; method: string }): Promise<unknown> => { void input; return { statusCode: 200, data: { data: {} } }; } };
  const cache = new Map<string, { exports: Record<string, unknown> }>();
  const nativeRequire = createRequire(import.meta.url);
  function load(file: string): Record<string, (...args: unknown[]) => unknown> {
    const filename = path.resolve(file);
    const existing = cache.get(filename); if (existing) return existing.exports as Record<string, (...args: unknown[]) => unknown>;
    const compiled = { exports: {} }; cache.set(filename, compiled);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const require = (name: string) => name === '@tarojs/taro' ? taro : name.startsWith('.') ? load(path.resolve(path.dirname(filename), name + '.ts')) : nativeRequire(name);
    vm.runInThisContext(`(function(require,module,exports,process){${code}\n})`, { filename })(require, compiled, compiled.exports, { env: {} });
    return compiled.exports;
  }
  return { load, taro };
}

test('miniapp refresh recovers approved coach identity without replacing session tokens', async () => {
  const { load,taro }=miniappHarness();const api=load('miniapp/src/services/api.ts');const storage=load('miniapp/src/services/storage.ts');
  storage.setSession({userId:'isolated-user',accessToken:'isolated-access',refreshToken:'isolated-refresh',availableModes:['student']});
  const identity={userId:'isolated-user',availableModes:['student','coach'],coach:{id:42,auditStatus:'approved'},coachOnboarding:{status:'approved',isOnboarded:true,canApply:false,canEnterWorkspace:true}};
  taro.request=async()=>({statusCode:200,data:{data:{coaches:[],bookings:[],conversations:[],favoriteCoachIds:[],learnerProfiles:[],accountIdentity:identity}}});
  await api.bootstrap();
  const refreshed=storage.getSession() as {accessToken:string;refreshToken:string;availableModes:string[];coachOnboarding:{isOnboarded:boolean}};
  assert.equal(refreshed.accessToken,'isolated-access');assert.equal(refreshed.refreshToken,'isolated-refresh');assert.equal(refreshed.coachOnboarding.isOnboarded,true);assert.ok(refreshed.availableModes.includes('coach'));
  taro.request=async()=>{throw new Error('offline');};await assert.rejects(api.bootstrap() as Promise<unknown>);assert.deepEqual(storage.getSession(),refreshed);
});

test('miniapp identity response from an old account cannot grant the new account coach mode', async () => {
  const {load,taro}=miniappHarness();const api=load('miniapp/src/services/api.ts');const storage=load('miniapp/src/services/storage.ts');
  storage.setSession({userId:'old',accessToken:'old-access',refreshToken:'old-refresh',availableModes:['student']});
  let finish:(value:unknown)=>void=()=>undefined;
  taro.request=async()=>new Promise(resolve=>{finish=resolve;});
  const read=api.refreshAccountIdentity() as Promise<unknown>;const rejected=assert.rejects(read,{code:'session_changed'});
  storage.setSession({userId:'new',accessToken:'new-access',refreshToken:'new-refresh',availableModes:['student']});
  finish({statusCode:200,data:{data:{userId:'old',availableModes:['student','coach']}}});await rejected;
  assert.deepEqual((storage.getSession() as {availableModes:string[]}).availableModes,['student']);
});

test('Taro adapter sends the actual availability contract and rejects HTML responses', async () => {
  const { load, taro } = miniappHarness(); const api = load('miniapp/src/services/api.ts');
  taro.request = async input => { assert.deepEqual(input.data, { online: false }); return { statusCode: 200, data: { data: { effectiveOnline: false, online: false } } }; };
  await api.updateCoachAvailability(false);
  taro.request = async () => ({ statusCode: 200, data: '<html>upstream failure</html>' });
  await assert.rejects(api.legalDocuments() as Promise<unknown>, (error: unknown) => (error as { code: string }).code === 'invalid_response');
});

test('Taro network errors distinguish domain configuration, timeout and offline retries', async () => {
  const { load, taro } = miniappHarness(); const api = load('miniapp/src/services/api.ts');
  for (const [errMsg, code] of [['request:fail url not in domain list', 'wechat_domain_not_configured'], ['request:fail timeout', 'request_timeout'], ['request:fail network error', 'network_unavailable']]) {
    taro.request = async () => { throw { errMsg }; };
    await assert.rejects(api.legalDocuments() as Promise<unknown>, (error: unknown) => (error as {code:string}).code === code);
  }
});

test('a refresh that completes after logout cannot restore the old account', async () => {
  const { load, taro } = miniappHarness(); const api = load('miniapp/src/services/api.ts'); const storage = load('miniapp/src/services/storage.ts');
  const session = { accessToken: 'isolated-old', refreshToken: 'isolated-refresh', availableModes: ['student'] };
  storage.setSession(session);
  let resolve: (value: unknown) => void = () => undefined;
  let began: () => void = () => undefined; const started = new Promise<void>(r => { began = r; });
  taro.request = async input => input.url.endsWith('/auth/refresh') ? new Promise(r => { resolve = r; began(); }) : ({ statusCode: 401, data: { error: { code: 'authentication_required' } } });
  const pending = api.bootstrap() as Promise<unknown>; const rejected = assert.rejects(pending, (error: unknown) => (error as { code: string }).code === 'session_changed');
  await started; storage.setSession(null);
  resolve({ statusCode: 200, data: { data: { ...session, accessToken: 'isolated-new' } } });
  await rejected; assert.equal(storage.getSession(), null);
});

test('miniapp refresh upstream failure preserves the account and remains retryable', async () => {
  const { load, taro } = miniappHarness(); const api = load('miniapp/src/services/api.ts'); const storage = load('miniapp/src/services/storage.ts');
  storage.setSession({ accessToken: 'isolated-old', refreshToken: 'isolated-refresh', availableModes: ['student'] });
  taro.request = async input => input.url.endsWith('/auth/refresh')
    ? ({ statusCode: 503, data: { error: { code: 'upstream_unavailable' } } })
    : ({ statusCode: 401, data: { error: { code: 'authentication_required' } } });
  await assert.rejects(api.bootstrap() as Promise<unknown>, (error: unknown) => (error as { code: string; status: number }).code === 'session_refresh_unavailable' && (error as {status:number}).status === 503);
  assert.ok(storage.getSession());
});

test('miniapp favorites serialize rapid toggles and accept an empty authoritative snapshot', async () => {
  const { load, taro } = miniappHarness(); const storage = load('miniapp/src/services/storage.ts'); const favorites = load('miniapp/src/services/favorites.ts');
  storage.setSession({ accessToken: 'isolated', refreshToken: 'isolated', availableModes: ['student'] });
  let finish: (value: unknown) => void = () => undefined; let calls = 0;
  taro.request = async input => { calls++; if (calls === 1) return new Promise(r => { finish = r; }); assert.equal(input.method, 'DELETE'); return { statusCode: 200, data: { data: { favoriteCoachIds: [] } } }; };
  const first = favorites.changeFavorite(5); const second = favorites.changeFavorite(5);
  finish({ statusCode: 200, data: { data: { favoriteCoachIds: [5] } } }); await first; await second;
  assert.equal(calls, 2); assert.deepEqual(favorites.favoriteIds(), []);
  favorites.acceptFavorites([5], favorites.favoriteTicket()); favorites.acceptFavorites([], favorites.favoriteTicket());
  assert.deepEqual(favorites.favoriteIds(), []);
  storage.setSession(null); assert.deepEqual(favorites.favoriteIds(), []);
});

test('booking drafts survive the guest login return but cannot cross city or account boundaries', () => {
  const { load } = miniappHarness(); const drafts = load('miniapp/src/services/booking-draft.ts'); const storage = load('miniapp/src/services/storage.ts');
  const value = { date:'2026-09-20', time:'18:30', duration:90, locationType:'custom', venueId:'', district:'南关区', address:'Isolated location', note:'Isolated', selectedLearnerId:'isolated-learner' };
  drafts.saveBookingDraft(5, 'changchun', value, true);
  storage.setSession({ accessToken:'isolated-one', refreshToken:'isolated', availableModes:['student'] });
  assert.deepEqual(drafts.readBookingDraft(5,'changchun'), value);
  assert.equal(drafts.readBookingDraft(5,'beijing'), undefined);
  const keys = drafts.bookingSubmissionKeys(5, 'changchun') as SubmissionKey;
  const first = keys.for(value);
  assert.equal((drafts.bookingSubmissionKeys(5, 'changchun') as SubmissionKey).for(value), first);
  storage.setSession({ accessToken:'isolated-two', refreshToken:'isolated', availableModes:['student'] });
  assert.equal(drafts.readBookingDraft(5,'changchun'), undefined);
  assert.notEqual((drafts.bookingSubmissionKeys(5, 'changchun') as SubmissionKey).for(value), first);
});
