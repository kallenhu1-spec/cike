const { _electron: electron } = require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const root=path.resolve(__dirname,'..'), out=process.env.CIKE_ARTIFACT_DIR || path.join(root,'artifacts/wardrobe-20260922');fs.mkdirSync(out,{recursive:true});
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cike-wardrobe-ui-'));let app;const errors=[];
const launch=()=>electron.launch({...(process.env.CIKE_EXECUTABLE?{executablePath:process.env.CIKE_EXECUTABLE,args:[]}:{args:[root]}),env:{...process.env,CIKE_TEST_DIR:dir}});
try {
app=await launch();const pet=await app.firstWindow();await pet.waitForSelector('#pet');
const next=app.waitForEvent('window');await pet.evaluate(()=>window.cike.call('laboratory'));const lab=await next;lab.on('pageerror',e=>errors.push(e.message));
await lab.waitForFunction(()=>document.querySelector('#after').naturalWidth===220);
await lab.locator('#pattern').selectOption('flowers');
await lab.locator('#skinColor').fill('#f6e8ce');await lab.locator('#skinColor').dispatchEvent('input');
await lab.locator('#patternDensity').fill('0');await lab.locator('#patternDensity').dispatchEvent('input');
for(const outfit of ['overalls','sweater','apron','pajamas','none']) {await lab.locator(`[data-outfit="${outfit}"]`).click();assert.equal(await lab.locator(`[data-outfit="${outfit}"]`).getAttribute('aria-pressed'),'true');assert.equal(await lab.locator('#skinColor').inputValue(),'#f6e8ce');assert.equal(await lab.locator('#pattern').inputValue(),'flowers');}
await lab.locator('[data-outfit="overalls"]').click();await lab.locator('[data-preset="round"]').click();assert.equal(await lab.locator('[data-outfit="overalls"]').getAttribute('aria-pressed'),'true');await lab.locator('[data-preset="paper"]').click();
await lab.locator('[data-clothing-color="#d6aaa3"]').click();
assert.equal(await lab.locator('#outfitColor').inputValue(),'#d6aaa3');
await lab.locator('#outfitColor').fill('#b9aecb');await lab.locator('#outfitColor').dispatchEvent('input');
assert.equal(await lab.locator('#outfit-color-value').textContent(),'#B9AECB');
await lab.locator('#face').fill('-1');await lab.locator('#face').dispatchEvent('input');
assert.equal(await lab.locator('#face-value').textContent(),'上移一格');
// Preview must not mutate the saved appearance.
assert.equal((await pet.evaluate(()=>window.cike.call('get'))).appearance.outfit,'none');
await lab.locator('#apply').click();await lab.locator('#status').filter({hasText:'已经住到桌面'}).waitFor();
await lab.waitForFunction(()=>[...document.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0));
await lab.screenshot({path:path.join(out,'小衣橱-实际界面.png'),fullPage:true});
await lab.locator('.wardrobe').screenshot({path:path.join(out,'小衣橱-款式.png')});
await pet.waitForFunction(()=>document.querySelector('#creature').src.startsWith('data:'));
await pet.locator('#pet').screenshot({path:path.join(out,'小衣橱-桌面.png')});
await pet.evaluate(()=>window.cike.call('request')); await pet.locator('#bubble.visible').waitFor();
await pet.locator('#complete').click(); await pet.waitForFunction(()=>document.querySelector('#high-five').dataset.phase==='ready');
await pet.waitForFunction(()=>document.querySelector('#creature').complete && atob(document.querySelector('#creature').src.split(',')[1]).includes('data-outfit="overalls"'));
await pet.locator('#pet').screenshot({path:path.join(out,'小衣橱-击掌.png')});
await pet.locator('#high-five').click(); await pet.waitForFunction(()=>document.querySelector('#high-five').dataset.phase==='done');
assert.equal(await pet.locator('#high-five').isVisible(),false);
await pet.waitForFunction(()=>document.querySelector('#high-five').dataset.phase==='');
// Decode every outfit/pattern/shape and action variant in the actual browser.
const art=require('../src/art.cjs'),design=require('../src/appearance.js');const urls=[];
for(const shape of ['paper','round','bean']) for(const outfit of ['none','overalls','sweater','apron','pajamas']) for(const pattern of ['none','dots','stripes','flowers']) urls.push('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(design.svg({...design.defaults(),shape,outfit,pattern})));
for(const def of Object.values(require('../src/motions.js').definitions)) urls.push(art({illustration:def.illustration,night:false,motionId:def.id,animate:true,appearance:{...design.defaults(),outfit:'sweater'}}));
assert.equal(await lab.evaluate(async urls=>{for(const src of urls){const image=new Image();image.src=src;await image.decode();}return urls.length},urls),urls.length);
await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('实验室')).setSize(760,700));await lab.waitForFunction(()=>innerWidth===760);assert(await lab.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await lab.screenshot({path:path.join(out,'小衣橱-窄窗口.png'),fullPage:true});
await app.close();app=await launch();const restarted=await app.firstWindow();await restarted.waitForSelector('#pet');const saved=await restarted.evaluate(()=>window.cike.call('get'));assert.equal(saved.appearance.face,-1);assert.equal(saved.appearance.outfitColor,'#b9aecb');assert.equal(saved.appearance.outfit,'overalls');assert.equal(saved.appearance.pattern,'flowers');assert.equal(saved.appearance.skinColor,'#f6e8ce');
const n=app.waitForEvent('window');await restarted.evaluate(()=>window.cike.call('laboratory'));const again=await n;await again.waitForFunction(()=>document.querySelector('[data-outfit="overalls"]').getAttribute('aria-pressed')==='true');await again.locator('#restore').click();await again.locator('#status').filter({hasText:'已经住到桌面'}).waitFor();assert.equal((await restarted.evaluate(()=>window.cike.call('get'))).appearance.outfit,'none');assert.deepEqual(errors,[]);
console.log('PASS wardrobe: preview isolation, five outfits, skin preservation, preset preservation, apply/restart/restore, 60 appearance + 35 motion SVG decode, narrow layout; screenshots '+out);
}finally{if(app)await app.close();fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1});
