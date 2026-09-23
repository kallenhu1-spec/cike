const {_electron:electron}=require('playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {VoiceStore,trimSilence,wavInfo}=require('../src/voice-store.cjs');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cike-071-')),out=path.resolve('artifacts/0.7.1');fs.mkdirSync(out,{recursive:true});let app;
 try{
 const rate=24000,b=Buffer.alloc(44+rate*10*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);
 for(let i=rate*3;i<rate*8;i++) b.writeInt16LE(Math.round(4000*Math.sin(i*.1)),44+i*2);
 const trimmed=trimSilence(b);assert.ok(wavInfo(trimmed).duration>5&&wavInfo(trimmed).duration<5.4);
 const store=new VoiceStore(path.join(dir,"voices"));store.save({text:'耶，击掌！这件事完成啦。',bytes:b});assert.equal(store.data.clips[Object.keys(store.data.clips)[0]].audio,b.toString('base64'));
 app=await electron.launch({...(process.env.CIKE_EXECUTABLE?{executablePath:process.env.CIKE_EXECUTABLE,args:[]}:{args:[path.resolve(__dirname,'..')]}),env:{...process.env,CIKE_TEST_DIR:dir}});
 await app.evaluate(({powerMonitor})=>powerMonitor.getSystemIdleTime=()=>600);
 const p=await app.firstWindow(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.waitForSelector('#pet.scene');
 await p.evaluate(()=>{const Base=Date;window.testHour=21;window.Date=class extends Base{getHours(){return window.testHour;}};});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('speak',{text:'我在，你忙你的。'}));
 await p.waitForSelector('#bubble.visible');assert.ok(await p.locator('#complete').isVisible());await p.screenshot({path:path.join(out,'点击后击掌入口.png')});
 await p.locator('#complete').click();assert.equal(await p.evaluate(async()=>{highFive();await new Promise(r=>setTimeout(r,3100));return fivePhase;}),'done');await p.screenshot({path:path.join(out,'配音中击掌.png')});await p.waitForFunction(()=>fivePhase==='',{},{timeout:9000});
 await p.evaluate(async()=>{hideCard();window.testHour=22;await refreshMoment();});await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>pet.dataset.sleeping),'true');let a=await p.locator('#creature').getAttribute('src');assert.ok(Buffer.from(a.split(',')[1],'base64').toString().includes('M'));
 await p.evaluate(()=>idleTick());await p.waitForTimeout(100);assert.equal(a,await p.locator('#creature').getAttribute('src'));await p.screenshot({path:path.join(out,'晚上十点闭眼.png')});
 await p.evaluate(async()=>{window.testHour=5;await refreshMoment();});assert.equal(await p.evaluate(()=>sleeping()),true);
 await p.evaluate(async()=>{window.testHour=6;await refreshMoment();});assert.equal(await p.evaluate(()=>sleeping()),false);
 assert.deepEqual(errors,[]);console.log('PASS: 普通卡击掌入口、3秒静音裁剪、原声保留、5秒完整播放后收起、22/5/6时边界、睡觉不轮换、无页面错误');
 }finally{if(app)await app.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
