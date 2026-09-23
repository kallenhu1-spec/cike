const {_electron:electron}=require('playwright');
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
const {VoiceStore}=require('../src/voice-store.cjs');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cike-072-'));let app;try{
const wav=fs.readFileSync('assets/audio/high-five.wav'),text='耶，击掌！这件事完成啦。';
let store=new VoiceStore(path.join(dir,'voices'));store.save({text,bytes:wav});store.setSilent(text,true);assert.equal(store.audio(text),null);assert.ok(store.audio(text,true));store=new VoiceStore(store.dir);assert.equal(store.audio(text),null);store.setSilent(text,false);assert.ok(store.audio(text));
app=await electron.launch({executablePath:path.resolve('dist/0.7.2/mac-arm64/此刻.app/Contents/MacOS/此刻'),args:[],env:{...process.env,CIKE_TEST_DIR:dir}});
const pet=await app.firstWindow();await pet.waitForSelector('#pet.scene');await pet.evaluate(()=>cike.call('voice-room'));let voice;for(let i=0;i<30;i++){voice=app.windows().find(p=>p.url().endsWith('voice.html'));if(voice)break;await pet.waitForTimeout(100);}await voice.waitForFunction(()=>document.querySelector('#coverage').textContent.includes('已启用 1'));
const errors=[];voice.on('pageerror',e=>errors.push(e.message));await voice.locator('#silent-line').check();await voice.waitForFunction(()=>document.querySelector('#coverage').textContent.includes('不配音 1'));assert.equal(await pet.evaluate(t=>cike.call('voice-play',t),text).then(r=>r.url),null);
await voice.locator('#silent-line').uncheck();await voice.waitForFunction(()=>document.querySelector('#coverage').textContent.includes('已启用 1'));
// Use the real native menu builder, then invoke its checkbox callback.
await app.evaluate(({Menu})=>{const original=Menu.buildFromTemplate;Menu.buildFromTemplate=function(rows){global.testMenu=rows;return original.call(this,rows)};Menu.prototype.popup=function(){};});await pet.evaluate(()=>cike.call('menu'));
await app.evaluate(()=>{const item=global.testMenu.find(x=>x.label==='播放声音');if(!item||!item.checked)throw Error('missing sound menu');item.click({checked:false});});
await voice.waitForFunction(()=>!document.querySelector('#enabled').checked);assert.equal(await pet.evaluate(t=>cike.call('voice-play',t),text),null);
await app.evaluate(()=>global.testMenu.find(x=>x.label==='播放声音').click({checked:true}));await voice.waitForFunction(()=>document.querySelector('#enabled').checked);
// Stub inference only to verify queue selection without generating or changing personal audio.
await app.evaluate(({ipcMain})=>{global.generated=[];ipcMain.removeHandler('voice-generate');ipcMain.handle('voice-generate',(_e,input)=>{global.generated.push(input.text);return {ok:true,value:{}}})});
const excluded=await voice.evaluate(async()=>{const skip=lines[2].text;await api.call('voice-silent',{text:skip,silent:true});await refresh();$('consent').checked=true;await generate(true);return {skip,trial:lines[1].text}});
const queued=await app.evaluate(()=>global.generated);assert.equal(queued.length,5);assert.ok(!queued.includes(excluded.skip));assert.ok(!queued.includes(excluded.trial));
await voice.evaluate(async()=>{await refresh();message("声音由你决定，不需要每个动作都说话。");});fs.mkdirSync('artifacts/0.7.2',{recursive:true});await voice.screenshot({path:'artifacts/0.7.2/声音控制.png',fullPage:true});assert.deepEqual(errors,[]);await app.close();app=null;
store=new VoiceStore(path.join(dir,'voices'));assert.equal(store.data.enabled,true);assert.equal(store.data.clips[Object.keys(store.data.clips)[0]].audio,wav.toString('base64'));
console.log('PASS 0.7.2: final package, menu toggle, silent per line, persistence, original preserved, coverage, batch skips (mock inference), screenshot');
}finally{if(app)await app.close();fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exitCode=1});
