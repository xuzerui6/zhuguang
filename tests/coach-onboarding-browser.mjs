import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

// Browser plugin not available; exercise the real mobile bundle with isolated API responses.
const modules=process.env.CODEX_NODE_MODULES;
const output=process.env.ZHUGUANG_QA_OUTPUT;
if(!modules||!output)throw new Error('Explicit Playwright runtime and QA output directory required');
const {chromium}=createRequire(path.join(modules,'playwright/package.json'))('playwright');
const root=path.resolve('native/mobile/www');
const mime={'.js':'application/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.webp':'image/webp','.avif':'image/avif'};
const server=createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://localhost').pathname;
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(404).end();return;}
    res.setHeader('content-type',mime[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const checks=[];
const profile={userId:'isolated-qa',nickname:'隔离测试',completed:true,district:'通州区',bio:'',updatedAt:0,completionPercent:100};
try {
  await mkdir(output,{recursive:true});
  for(const [width,height] of [[390,844],[768,1024],[1280,800],[1440,900]]) {
    for(const status of ['not_applied','draft','pending','rejected','approved','suspended','guest']) {
      const onboarded=status==='approved'||status==='suspended';
      const summary={status:status==='suspended'?'approved':status,isOnboarded:onboarded,canApply:!onboarded&&status!=='pending',canEnterWorkspace:status==='approved',rejectionReason:status==='rejected'?'请补充可以核验的真实证明材料，原资料会保留供你修改后重新提交。':undefined};
      const identity={userId:'isolated-qa',availableModes:status==='approved'?['student','coach']:['student'],contactMasked:'***0541',profile,coachOnboarding:summary,...(onboarded?{coach:{id:42,name:'隔离测试教练',sport:'田径',title:'专项教练',auditStatus:status==='approved'?'approved':'suspended',pendingBookingCount:0}}:{})};
      const context=await browser.newContext({viewport:{width,height},reducedMotion:width===768?'reduce':'no-preference'});
      await context.addInitScript(({identity,guest})=>{
        localStorage.setItem('CapacitorStorage.zhuguang-privacy-consent-v1','accepted');
        localStorage.setItem('CapacitorStorage.zhuguang-student-last-tab','profile');
        if(!guest)sessionStorage.setItem('zhuguang-mobile-session',JSON.stringify({...identity,accessToken:'isolated-access',refreshToken:'isolated-refresh',expiresAt:Date.now()+900000}));
      },{identity,guest:status==='guest'});
      await context.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.origin===origin)return route.continue();
        if(url.pathname.startsWith('/api/v1/')) {
          let data=[];
          if(url.pathname==='/api/v1/me')data=identity;
          else if(url.pathname==='/api/v1/bootstrap')data={coaches:[],bookings:[],conversations:[],favoriteCoachIds:[],learnerProfiles:[],...(status==='guest'?{}:{accountIdentity:identity,accountProfile:profile})};
          else if(url.pathname==='/api/v1/capabilities')data={};
          else if(url.pathname==='/api/v1/coach-applications/mine')data=[];
          else if(url.pathname==='/api/v1/catalog')data={city:'北京',sports:[],regions:[],serviceAreas:[]};
          return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data})});
        }
        return route.abort();
      });
      const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(origin,{waitUntil:'domcontentloaded'});
      const entry=page.locator('.zg-profile-view .zg-coach-entry');await entry.waitFor({timeout:10000});
      const title=onboarded?'教练工作台':status==='draft'?'继续填写':status==='pending'?'查看审核进度':status==='rejected'?'修改并重新提交':'申请成为教练';
      await entry.getByText(title,{exact:true}).waitFor({timeout:10000});
      assert.ok((await entry.innerText()).includes(title),`${status}: ${await entry.innerText()}`);
      assert.equal(await page.locator('[role="dialog"]').count(),0);
      if(status==='suspended')assert.ok((await entry.innerText()).includes('权限暂停'));
      if(status==='not_applied') {
        await entry.click();await page.getByRole('heading',{name:'申请成为教练'}).waitFor();
        const name=page.getByLabel('真实姓名',{exact:true});await name.fill('隔离示例');assert.equal(await name.inputValue(),'隔离示例');
        await page.waitForTimeout(280);
        await page.screenshot({path:path.join(output,`application-form-${width}.png`)});
        await page.getByRole('button',{name:'关闭',exact:true}).click();await entry.waitFor();
      }
      if(status==='guest') {
        await entry.click();await page.locator('[role="dialog"]').waitFor();
        assert.equal(await page.getByRole('heading',{name:'申请成为教练',exact:true}).count(),0);
        await page.getByRole('button',{name:'关闭',exact:true}).click();await entry.waitFor();
      }
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      assert.equal(overflow,false);assert.deepEqual(errors,[]);
      const box=await entry.boundingBox();assert.ok(box.height>=44);
      await page.screenshot({path:path.join(output,`profile-${status}-${width}.png`)});
      checks.push({status,width,height,title,overflow,errors});await context.close();
    }
  }
  await writeFile(path.join(output,'report.json'),JSON.stringify({kind:'isolated mobile browser QA, not native device validation',checks},null,2));
  console.log(`PASS ${checks.length} isolated profile checks`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
