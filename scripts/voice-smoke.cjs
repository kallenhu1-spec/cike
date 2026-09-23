const {_electron:electron}=require('playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const output=process.env.CIKE_ARTIFACT_DIR || 'artifacts/voice-regression';fs.mkdirSync(output,{recursive:true});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cike-voice-ui-'));let app; const errors=[];
 async function launch(){const launched=await electron.launch({...(process.env.CIKE_EXECUTABLE?{executablePath:process.env.CIKE_EXECUTABLE,args:[]}:{args:[path.resolve(__dirname,'..')]}),env:{...process.env,CIKE_TEST_DIR:dir}});launched.process().stderr.on('data',b=>{if(process.env.CIKE_TEST_AI)fs.appendFileSync('.private/voice-verification/electron.log',b);});return launched;}
 try{
  app=await launch();await app.evaluate(({powerMonitor})=>powerMonitor.getSystemIdleTime=()=>600);
  const pet=await app.firstWindow();pet.on('pageerror',e=>errors.push(e.message));await pet.waitForSelector('#pet.scene');
  await assert.rejects(pet.evaluate(()=>window.cike.call('voice-preview','__reference__')),/配音室/);
  await pet.evaluate(()=>window.cike.call('voice-room'));
  const room=await app.waitForEvent('window');room.on('pageerror',e=>errors.push(e.message));await room.waitForSelector('#line-select option',{state:'attached'});
  assert.equal(await room.locator('#approve').isEnabled(),false);
  await room.locator('#generate').click();await room.waitForFunction(()=>document.querySelector('#status').textContent.includes('同意'));
  await room.locator('#consent').check();
  // Exercise encoding, decoding, storage and approval with a synthetic signal, not a child's recording.
  await room.evaluate(async()=>{
    const ctx=new AudioContext({sampleRate:24000}), b=ctx.createBuffer(1,24000,24000);
    for(let i=0;i<24000;i++)b.getChannelData(0)[i]=.16*Math.sin(i*.11);
    await window.cike.call('voice-save',{text:'耶，击掌！这件事完成啦。',bytes:CikeSound.wav(b),consent:true});await ctx.close();await refresh();
  });
  await room.waitForFunction(()=>document.querySelector('#clip-status').textContent.includes('待试听'));
  assert.equal(await pet.evaluate(()=>window.cike.call('voice-play','耶，击掌！这件事完成啦。').then(r=>r.url)),null);
  await room.locator('#listen-line').click();await room.locator('#approve').click();
  await room.waitForFunction(()=>document.querySelector('#clip-status').textContent.includes('已启用'));
  assert.ok(await pet.evaluate(()=>window.cike.call('voice-play','耶，击掌！这件事完成啦。').then(r=>r.url)));
  await pet.evaluate(()=>{const OriginalAudio=window.Audio;window.Audio=class extends OriginalAudio{constructor(...args){super(...args);window.observedAudio=this;}};});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/pet.html')).webContents.send('speak',{id:'voice-test',text:'称呼，耶，击掌！这件事完成啦。',voiceText:'耶，击掌！这件事完成啦。'}));
  await pet.waitForFunction(()=>window.observedAudio && !observedAudio.paused);
  await pet.locator('#dismiss').click();assert.equal(await pet.evaluate(()=>observedAudio.paused),true);
  await room.locator('#enabled').uncheck();
  await room.waitForFunction(()=>summary.enabled===false);
  assert.equal(await pet.evaluate(()=>window.cike.call('voice-play','耶，击掌！这件事完成啦。')),null);
  await room.locator('#enabled').check();await room.waitForFunction(()=>summary.enabled===true);
  await pet.evaluate(()=>window.cike.call('request'));await pet.locator('#complete').click();await pet.locator('#high-five').click();
  await pet.waitForFunction(()=>document.querySelector('#high-five').dataset.phase==='done');
  assert.equal(await pet.locator('#high-five').isVisible(),false);
  await room.locator('#line-select').selectOption('2');
  await room.evaluate(()=>message('准备好，就从一句“你好呀”开始。'));
  await room.locator('#consent').uncheck();
  await room.screenshot({path:path.join(output,'小小配音室.png'),fullPage:true});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.getTitle().includes('配音室')).setSize(620,900));
  await room.screenshot({path:path.join(output,'配音室窄窗口.png'),fullPage:true});
  assert.equal(await room.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  // Native microphone denied path: do not record the user's actual microphone in tests.
  await app.evaluate(({systemPreferences})=>systemPreferences.askForMediaAccess=async()=>false);
  await room.locator('#consent').check();
  await room.locator('#record-line').click();await room.waitForFunction(()=>document.querySelector('#status').textContent.includes('麦克风没有获准'));
  await app.evaluate(({systemPreferences})=>systemPreferences.askForMediaAccess=async()=>true);
  await room.evaluate(()=>{
    window.fakeCtx=new AudioContext();const oscillator=fakeCtx.createOscillator(),destination=fakeCtx.createMediaStreamDestination();
    oscillator.connect(destination);oscillator.start();window.fakeStream=destination.stream;
    navigator.mediaDevices.getUserMedia=async()=>fakeStream;
  });
  await room.locator('#record-line').click();await room.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('正在录音'));
  await room.waitForTimeout(1000);await room.locator('#stop').click();
  await room.waitForFunction(()=>document.querySelector('#clip-status').textContent.includes('待试听'));
  assert.equal(await room.evaluate(()=>fakeStream.getTracks()[0].readyState),'ended');
  await room.evaluate(()=>fakeCtx.close());
  await app.close();app=await launch();const p=await app.firstWindow();await p.waitForSelector('#pet');
  assert.ok(await p.evaluate(()=>window.cike.call('voice-play','耶，击掌！这件事完成啦。').then(r=>r.url)));
  const roomEvent=app.waitForEvent('window');await p.evaluate(()=>window.cike.call('voice-room'));const r=await roomEvent;await r.waitForSelector('#line-select option',{state:'attached'});
  await r.locator('#delete-line').click();await r.waitForFunction(()=>document.querySelector('#clip-status').textContent==='还没有配音');
  assert.equal(await p.evaluate(()=>window.cike.call('voice-play','耶，击掌！这件事完成啦。').then(r=>r.url)),null);
  if(process.env.CIKE_TEST_AI){
    const reference=fs.readFileSync('.private/voice-verification/reference.wav');
    await r.evaluate(async encoded=>{
      const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)).buffer;
      await window.cike.call('voice-save',{bytes,reference:true,consent:true,text:'你好呀，我是你的小纸团。你忙你的，我在这里陪着你。我们一起喝口水，再来击个掌吧。'});
      await window.cike.call('voice-generate',{text:'耶，击掌！这件事完成啦。',consent:true});
      await refresh();
    },reference.toString("base64"));
    assert.equal(await r.locator('#clip-status').textContent(),'AI 配音 · 待试听启用');
    await r.screenshot({path:path.join(output,'AI测试状态-非女儿声音.png'),fullPage:true});
    const pending=r.evaluate(()=>window.cike.call('voice-generate',{text:'取消测试。',consent:true}).then(()=> 'unexpected',e=>e.message));
    await r.waitForFunction(async()=> (await window.cike.call('voice-engine')).busy);
    await r.evaluate(()=>window.cike.call('voice-cancel'));
    assert.match(await pending,/停止/);
    assert.equal(fs.readdirSync(path.join(dir,'voices')).some(n=>n.startsWith('generation-')),false);
  }
  await app.evaluate(({dialog})=>dialog.showMessageBox=async()=>({response:0}));
  assert.equal(await r.evaluate(()=>window.cike.call('voice-clear')),false);
  assert.ok((await r.evaluate(()=>window.cike.call('voice-summary'))).clips.length>0);
  await app.evaluate(({dialog})=>dialog.showMessageBox=async()=>({response:1}));
  assert.equal(await r.evaluate(()=>window.cike.call('voice-clear')),true);
  const cleared=await r.evaluate(()=>window.cike.call('voice-summary'));assert.deepEqual(cleared.clips,[]);assert.equal(cleared.reference,null);
  assert.deepEqual(errors,[]);console.log('PASS: 真实 AI 验证开关='+Boolean(process.env.CIKE_TEST_AI));
  console.log('PASS: 配音窗口、同意检查、音频编解码、待审/启用、静音、击掌、重启恢复、删除、窄屏、麦克风拒绝、IPC 隔离');
 }finally{if(app)await app.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
