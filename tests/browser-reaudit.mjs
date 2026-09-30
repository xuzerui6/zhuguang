import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { demoCoaches } from '../app/mobile/demo-data.ts';

// All backend traffic terminates here. No production secret, contact reveal, or business write is used.
const output=process.env.ZHUGUANG_QA_OUTPUT;
const modules=process.env.CODEX_NODE_MODULES;
if(!output || !modules) throw new Error('ZHUGUANG_QA_OUTPUT and CODEX_NODE_MODULES are required');
await mkdir(output,{recursive:true});
const {chromium}=createRequire(join(modules,'playwright','package.json'))('playwright');
const coaches=demoCoaches.filter(item=>item.profileKind==='real').map(item=>item.id===5?{...item,bookable:true,bookingEnabled:true,pricingStatus:'published',unavailableReason:undefined}:item);
const changchunCoaches=coaches.filter(item=>item.id===5).map(item=>({...item,serviceCities:['beijing','changchun'],serviceAreas:[{cityId:'beijing',district:'通州区'},{cityId:'changchun',district:'南关区'}]}));
const catalog={city:'北京',sports:[{id:'track-and-field',name:'田径'}],regions:[{id:'tongzhou',name:'通州区'}]};
const now=Date.now();
const review={status:'not_eligible',canSubmit:false,canResubmit:false};
const expired={id:'QA-expired',coachId:5,status:'expired',feeFen:9900,review,date:'2026-09-01',time:'12:00',endTime:'13:00',dateLabel:'周二',durationMinutes:60,paymentStatus:'offline_unpaid',venueId:'QA-venue'};
const leads=[{id:'QA-new',classification:'unclassified',classification_event_id:null,contact_name:'隔离咨询',lead_kind:'student_inquiry',sport:'田径',district:'通州区',goal:'隔离训练需求',has_email:1,status:'new',created_at:now}, {id:'QA-only',classification:'qa',classification_event_id:'qa-event',contact_name:'测试资料',lead_kind:'student_inquiry',sport:'田径',district:'通州区',goal:'隔离记录',status:'new',created_at:now}];
const releases=Array.from({length:12},(_,index)=>({versionCode:25-index,versionName:`1.3.${10-index}`,sizeBytes:6*1048576,artifactPresent:true,forced:false,minimumSupportedVersionCode:5,rolloutPercentage:100,status:'published'}));
const report={environment:'loopback fixtures only',browser:'Playwright fallback: Browser plugin not available',checks:[],consoleErrors:[],blockedExternal:[],writes:[]};
let refreshMode='ok'; let meDelay=0; let refreshCalls=0;
const fixture=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost'); const path=url.pathname;
  let data;
  if(req.method!=='GET') {
    let body='';for await(const chunk of req) body+=chunk;
    report.writes.push({path,method:req.method});
    if(path==='/api/v1/auth/refresh') {
      refreshCalls++;
      if(refreshMode==='fail'){res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({error:{code:'upstream_unavailable',message:'隔离服务失败'}}));return;}
      data={accessToken:'qa-ops',refreshToken:'qa-refreshed',contactMasked:'qa@example.invalid'};
    } else if(path==='/api/v1/operator/trust-metrics/classifications') {
      const parsed=JSON.parse(body);assert.equal(parsed.entityId,'QA-new');assert.ok(parsed.reason.length>=4);
      const lead=leads[0];lead.classification=parsed.classification;lead.classification_event_id='qa-classified';data=parsed;
    } else {res.writeHead(403,{'content-type':'application/json'});res.end(JSON.stringify({error:{code:'qa_write_blocked',message:'隔离测试禁止此操作'}}));return;}
  } else if(path==='/api/v1/me') {
    // The preview runs over HTTP, so a browser correctly refuses the product's Secure renewal cookie.
    // Accept the isolated token after one successful refresh to model the HTTPS production transition.
    if(req.headers.authorization==='Bearer qa-expired' && refreshCalls===0){res.writeHead(401,{'content-type':'application/json'});res.end(JSON.stringify({error:{code:'authentication_required'}}));return;}
    if(meDelay) await new Promise(resolve=>setTimeout(resolve,meDelay));
    const ordinary=req.headers.authorization==='Bearer qa-student';
    data={userId:'qa-user',email:ordinary?'student@example.invalid':'xuzerui6@gmail.com',roles:ordinary?['student']:['student','coach','operator'],availableModes:ordinary?['student']:['student','coach'],profile:{userId:'qa-user',nickname:'隔离测试账号',completed:true}};
  } else if(path==='/api/v1/coaches') data=url.searchParams.get('city')==='changchun'?changchunCoaches:coaches;
  else if(/^\/api\/v1\/coaches\/\d+$/.test(path)) data=changchunCoaches.find(item=>item.id===Number(path.split('/').at(-1)))||coaches.find(item=>item.id===Number(path.split('/').at(-1)));
  else if(/^\/api\/v1\/coaches\/\d+\/booking-options$/.test(path)) data={coachId:5,durationMinutes:[60,90,120],earliestStartsAt:now+2*60*60_000,latestStartsAt:now+60*24*60*60_000,regularBasePriceFen:24000,trialBasePriceFen:9900,venues:url.searchParams.get('city')==='changchun'?[]:[{id:'QA-venue',coachId:5,name:'隔离训练场',address:'北京市通州区测试地址',district:'通州区'}]};
  else if(/^\/api\/v1\/coaches\/\d+\/reviews$/.test(path)) data={items:[],nextCursor:null,summary:{total:0,averageRating:null,ratingDistribution:{1:0,2:0,3:0,4:0,5:0},tagCounts:[]}};
  else if(path==='/api/v1/catalog') data=url.searchParams.get('city')==='changchun'?{...catalog,city:'长春',regions:[{id:'changchun-nanguan',name:'南关区'}]}:catalog;
  else if(path==='/api/v1/bootstrap') data={coaches:url.searchParams.get('city')==='changchun'?changchunCoaches:coaches,catalog,favoriteCoachIds:[5],learnerProfiles:[],bookings:[expired],conversations:[]};
  else if(path==='/api/v1/coach/overview') data={coach:{...coaches[0],auditStatus:'approved'},bookings:[],conversations:[],slots:[],venues:[],trainingRecords:[],credentials:[]};
  else if(path==='/api/v1/operator/overview') data={bookings:[],coaches:[],leads:[],users:[],pushDeliveries:[],publicSupply:{total:3,byCity:[{cityId:'beijing',count:3},{cityId:'changchun',count:1}]},classifications:[{entityType:'service_lead',counts:[{classification:'unclassified',count:1},{classification:'qa',count:1}]}]};
  else if(path==='/api/v1/operator/system-health') data={generatedAt:Date.now(),queues:{bookingRequests:0,coachApplications:0,serviceLeads:1},services:{database:{ready:true},media:{ready:true},releases:{ready:true},email:{configured:true,failedDeliveries:0},push:{configured:true,failedDeliveries:0},wechat:{configured:true}}};
  else if(path==='/api/v1/operator/leads') data=leads.filter(lead=>url.searchParams.get('view')==='work_queue'?['unclassified','production_eligible'].includes(lead.classification):url.searchParams.get('classification')==='all'||lead.classification===url.searchParams.get('classification'));
  else if(path==='/api/v1/operator/releases') data=releases;
  else if(path==='/api/v1/operator/catalog') data={sports:[{id:'sport-athletics',name:'田径',status:'published',coach_count:3}],regions:[{id:'region-tongzhou',district:'通州区',status:'published',coach_count:3}]};
  else if(path==='/api/v1/operator/transactions') data={orders:[],refunds:[]};
  else if(path==='/api/v1/operator/coaches') data=coaches.map(item=>({...item,listing_status:'online',audit_status:'approved',profile_kind:'real'}));
  else if(/^\/api\/v1\/operator\/coaches\/\d+\/business-settings$/.test(path)) data={coachId:5,city:'长春',district:'南关区',priceFen:24099,trialPriceFen:9901,pricingStatus:'published',bookingEnabled:true,venues:[]};
  else if(path==='/api/v1/operator/coach-applications') data=[{id:'QA-application',user_id:'qa-user',real_name:'隔离入驻申请',title:'隔离田径教练',bio:'仅用于本地界面测试，不会公开或写入生产。',experience_years:2,status:'pending',audiences:['青少年'],goals:['体能提升'],strengths:['短跑'],honors:[],credentials:['隔离证明'],price_fen:24000,trial_price_fen:9900,sports:[{id:'sport-athletics',name:'田径',primary:1}],areas:[{id:'changchun-nanguan',cityId:'changchun',name:'南关区',primary:1}],venues:[{id:'QA-venue',name:'隔离场馆',address:'隔离测试地址',areaId:'changchun-nanguan'}],credentialTempKeys:[],submitted_at:now}];
  else if(path==='/api/v1/capabilities') data={onlineTransactions:{enabled:false,mode:'disabled'},fulfillmentV2:false,supportEvidence:false,publicTrustMetrics:false};
  else if(path==='/api/v1/health') data={environment:'test',database:true,media:true,releases:true};
  else if(path.includes('auth/email/config')) data={enabled:false,turnstileSiteKey:''};
  else if(path.includes('public/app/releases/latest')) data=null;
  else data=[];
  res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({data}));
});
await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));
const api=`http://127.0.0.1:${fixture.address().port}`;
const port=3309; const origin=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['scripts/local-preview-server.mjs'],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,PORT:String(port),HOST:'127.0.0.1',ZHUGUANG_MOBILE_API_URL:api,ZHUGUANG_PILOT_APP_KEY:'isolated-channel',ZHUGUANG_OPERATOR_API_SECRET:'isolated-proxy',PRIMARY_OPERATOR_EMAIL:'xuzerui6@gmail.com',PRODUCT_FILM_ENABLED:'false'}});
let logs='';child.stdout.on('data',chunk=>{logs+=chunk;});child.stderr.on('data',chunk=>{logs+=chunk;});
let browser;
function check(name,value){report.checks.push({name,pass:Boolean(value)});assert.ok(value,name);}
async function goto(page,path){await page.goto(origin+path,{waitUntil:'networkidle',timeout:20000});}
async function contextFor(viewport,token='qa-ops'){
  const context=await browser.newContext({viewport,reducedMotion:'reduce'});
  if(token) await context.addCookies([{name:'zg_web_access',value:token,url:origin,httpOnly:true},{name:'zg_web_refresh',value:'qa-refresh',url:origin,httpOnly:true},{name:'zg_web_device',value:'qa-device',url:origin}]);
  await context.addInitScript(()=>sessionStorage.setItem('zhuguang:profile-prompt-dismissed','true'));
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin){report.blockedExternal.push(url.origin);await route.abort();return;}
    await route.continue();
  });
  return context;
}
try {
  const until=Date.now()+10000;let ready=false;
  while(Date.now()<until){try{ready=(await fetch(origin,{signal:AbortSignal.timeout(1000)})).ok;if(ready)break;}catch{}await new Promise(resolve=>setTimeout(resolve,200));}
  assert.ok(ready,'bounded local health check');
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const viewport of [{width:390,height:844},{width:665,height:694},{width:768,height:1024},{width:1280,height:800},{width:1440,height:900}]){
    const context=await contextFor(viewport);const page=await context.newPage();page.setDefaultTimeout(7000);
    page.on('pageerror',error=>report.consoleErrors.push(error.message));
    page.on('console',message=>{if(message.type()==='error' && !message.text().includes('ERR_FAILED')) report.consoleErrors.push(message.text());});
      for(const path of ["/","/coaches","/coaches/5","/login","/download","/privacy","/terms","/service-guarantee","/coach-partnership","/student","/student/coaches","/student/bookings","/student/messages","/student/training","/student/profile","/coach-workspace","/coach-workspace/bookings","/coach-workspace/schedule","/coach-workspace/messages","/coach-workspace/courses","/coach-workspace/payments","/coach-workspace/credentials","/coach-workspace/support","/ops/matching","/ops","/ops/bookings","/ops/catalog","/ops/coaches","/ops/profile-reviews","/ops/coach-applications","/ops/users","/ops/reviews","/ops/support","/ops/content","/ops/audit","/ops/transactions","/ops/releases","/?city=changchun","/coaches?city=changchun","/coaches/5?city=changchun","/student/bookings?coach=5&city=changchun"]){
      await goto(page,path);
      check(`${viewport.width} ${path} one heading`,await page.locator('h1').count()===1);
      check(`${viewport.width} ${path} no overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      if(path==='/coaches/5?city=changchun') {
        check('Changchun detail retains booking city',await page.locator('a[href*="next="]').evaluateAll(items=>items.some(item=>decodeURIComponent(item.getAttribute('href')).includes('city=changchun'))));
        check('Changchun detail does not advertise Beijing venue',await page.getByText('北京市通州区合作训练场',{exact:false}).count()===0);
      }
      if(path==='/student/bookings?coach=5&city=changchun') {
        check('Changchun booking shows time input',await page.locator('input[type="datetime-local"]').count()===1);
        check('Changchun booking has no Beijing venue',await page.getByText('北京市通州区测试地址',{exact:false}).count()===0);
        check('Changchun custom districts are available',await page.locator('select option').filter({hasText:'南关区'}).count()>0);
      }
      await page.screenshot({path:join(output,`${viewport.width}-${path==='/'?'home':path.slice(1).replace(/[^a-zA-Z0-9-]/g,'-')}.png`),fullPage:true});
      if(path==='/student') check('expired not in current arrangements',!await page.getByText('申请已失效',{exact:true}).count());
      if(path==='/student/bookings') {
        check('expired retained in history',await page.getByText('申请已失效',{exact:true}).count()>0);
        check('booking options render without internal errors',await page.getByText('Cannot read properties',{exact:false}).count()===0);
      }
      if(path==='/ops/matching') {
        check('new lead appears by default',await page.getByText('隔离咨询',{exact:true}).count()===1);
        check('QA excluded from queue',await page.getByText('测试资料',{exact:true}).count()===0);
        await page.getByRole('button',{name:'核验分类',exact:true}).click();
        const dialog=page.getByRole('dialog',{name:'核验线索分类'});await dialog.waitFor();
        check('classification focus inside',await dialog.evaluate(el=>el.contains(document.activeElement)));
        await page.keyboard.press('Escape');check('classification esc closes',await dialog.count()===0);
        await page.getByRole('combobox',{name:'数据分类'}).selectOption('qa');await page.getByText('测试资料',{exact:true}).waitFor();
        await page.getByRole('combobox',{name:'数据分类'}).selectOption('work_queue');await page.getByText('隔离咨询',{exact:true}).waitFor();
      }
      if(path==='/ops/coach-applications'){
        await page.getByRole('button',{name:'查看申请',exact:true}).click();
        const dialog=page.getByRole('dialog',{name:'隔离入驻申请的入驻申请'});await dialog.waitFor();
        check('application details include city',await dialog.getByText('隔离场馆',{exact:false}).count()>0);
        check('application focus inside',await dialog.evaluate(el=>el.contains(document.activeElement)));
        check('application dialog no overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        const controls=await dialog.locator('button').evaluateAll(items=>items.every(item=>item.getBoundingClientRect().height>=44));
        check('application controls 44px',controls);
        await page.screenshot({path:join(output,`${viewport.width}-application-dialog.png`),fullPage:false});
        await page.keyboard.press('Escape');check('application Escape closes',await dialog.count()===0);
      }
      if(path==='/ops/coaches') {
        await page.getByRole('button',{name:'经营设置',exact:true}).first().click();
        const dialog=page.getByRole('dialog',{name:/经营设置/});
        await dialog.getByLabel('常规课价格（元）').waitFor();
        check('business price preserves cents',await dialog.getByLabel('常规课价格（元）').inputValue()==='240.99');
        check('business trial price preserves cents',await dialog.getByLabel('试课价格（元）').inputValue()==='99.01');
        check('new venue defaults to coach city',await dialog.getByLabel('场馆城市').inputValue()==='changchun');
        check('business areas match primary city',await dialog.locator('select[name="district"]').first().inputValue()==='南关区');
        check('business dialog no overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await dialog.getByRole('button',{name:'关闭',exact:true}).click();
      }
      if(path==='/ops/releases'){
        await page.getByRole('link',{name:'上传新版本',exact:true}).click();
        check('upload jump focuses heading',await page.locator('#release-upload-title').evaluate(el=>el===document.activeElement));
        await page.getByLabel('版本名称',{exact:true}).fill('1.3.100000000000000000000000');
        await page.getByLabel('更新说明',{exact:true}).fill('隔离测试较长更新说明'.repeat(30));
        const bounds=await page.locator('#release-upload input,#release-upload select,#release-upload textarea').evaluateAll(elements=>elements.map(el=>{
          const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect(),panel=el.closest('section').getBoundingClientRect();
          return {name:el.name||el.type,pass:r.width>0&&r.left>=p.left-1&&r.right<=p.right+1&&r.right+3<=panel.right&&r.height>=44};
        }));
        for(const item of bounds)check(`${viewport.width} field ${item.name} contained`,item.pass);
        await page.screenshot({path:join(output,`${viewport.width}-release-fields.png`),fullPage:true});
        await page.getByRole('button',{name:'暂停',exact:true}).first().click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');
        check('release cancellation sends no write',report.writes.length===0);
      }
    }
    await goto(page,'/ops/releases');
    if(viewport.width<=820){
      const trigger=page.getByRole('button',{name:'打开菜单',exact:true});await trigger.click();
      const drawer=page.getByRole('dialog',{name:'运营工作台菜单'});await drawer.waitFor();
      check('menu focused',await drawer.evaluate(el=>el.contains(document.activeElement)));
      for(let n=0;n<25;n++)await page.keyboard.press('Tab');
      check('menu traps tab',await drawer.evaluate(el=>el.contains(document.activeElement)));
      check('background scroll locked',await page.evaluate(()=>document.body.style.overflow==='hidden'));
      await page.keyboard.press('Escape');check('menu escaped',await trigger.getAttribute('aria-expanded')==='false');
      check('trigger focus restored',await trigger.evaluate(el=>el===document.activeElement));
      await trigger.click();await page.mouse.click(viewport.width-5,200);check('outside closes drawer',await trigger.getAttribute('aria-expanded')==='false');
      await trigger.click();await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(150);
      check('resize releases lock',await page.evaluate(()=>document.body.style.overflow!=='hidden'));
      await page.setViewportSize(viewport);
    }
    const account=page.locator('details').filter({has:page.locator('summary')}).filter({hasText:'切换工作模式'}).first();
    await account.locator('summary').click();await page.keyboard.press('Escape');check('account escape closes',!await account.getAttribute('open'));
    await account.locator('summary').click();await account.getByRole('link',{name:'学员服务'}).click();await page.waitForURL('**/student');
    check('mode navigation closes menu',await page.locator('details[open]').count()===0);
    await context.close();
  }
  for(const width of [390,768,820,821]){
    const context=await contextFor({width,height:844},null);const page=await context.newPage();await goto(page,'/');
    for(const text of ['隐私政策','用户服务协议','预约与取消规则','意见反馈']){
      const link=page.locator('footer').getByRole('link',{name:text,exact:true});await link.scrollIntoViewIfNeeded();check(`footer ${width} ${text}`,await link.isVisible());
      check(`footer touch ${width} ${text}`,(await link.boundingBox()).height>=44);
    }
    await page.screenshot({path:join(output,`${width}-footer.png`),fullPage:false});await context.close();
  }
  const ordinary=await contextFor({width:1280,height:800},'qa-student');const user=await ordinary.newPage();await goto(user,'/ops');
  check('ordinary cannot enter ops',await user.getByRole('heading',{name:'当前账号暂不能进入运营工作台'}).count()===1);await ordinary.close();
  const recovery=await contextFor({width:390,height:844},'qa-expired');const page=await recovery.newPage();
  meDelay=1000;await goto(page,'/student');await page.getByRole('heading',{name:'我的训练'}).waitFor();
  check('session recovery successful',refreshCalls===1);check('no false recovery failure',await page.getByText('登录状态需要重试').count()===0);
  await recovery.close();meDelay=0;
  check('no application exceptions',report.consoleErrors.length===0);
} finally {
  await browser?.close();child.kill();fixture.closeAllConnections();await new Promise(resolve=>fixture.close(resolve));
  await writeFile(join(output,'browser-reaudit.json'),JSON.stringify(report,null,2));
  await writeFile(join(output,'preview.log'),logs);
  console.log(JSON.stringify({checks:report.checks.length,failed:report.checks.filter(item=>!item.pass),errors:report.consoleErrors,output}));
}
