const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {VoiceStore,wavInfo}=require('../src/voice-store.cjs');
function wav(seconds=1, amplitude=.2) {
 const b=Buffer.alloc(44+24000*2*seconds);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(b.length-44,40);for(let i=44;i<b.length;i+=2)b.writeInt16LE(Math.round(Math.sin(i/12)*amplitude*32767),i);return b;
}
test('WAV 校验拒绝损坏、静音、超长和过短的 AI 样本',()=>{
 assert.equal(wavInfo(wav()).duration,1);assert.throws(()=>wavInfo(Buffer.from('invalid')));
 assert.throws(()=>wavInfo(wav(1,0)),/太轻/);assert.throws(()=>wavInfo(wav(1),5,20),/5–20/);
 const damaged=wav();damaged.writeUInt32LE(999999,40);assert.throws(()=>wavInfo(damaged),/不完整/);
 assert.throws(()=>wavInfo(wav(21),5,20),/5–20/);
});
test('只有确认的精确台词才能播放，样本私有、重启保存和删除生效',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cike-voice-'));
 try {
 let s=new VoiceStore(dir);s.save({text:'喝口水吧。',bytes:wav(),source:'ai',approved:false});
 assert.equal(s.audio('喝口水吧。'),null);assert.ok(s.audio('喝口水吧。',true));
 assert.equal(s.audio('其他文字'),null);s.approve('喝口水吧。');assert.ok(s.audio('喝口水吧。'));
 s.save({text:'样本文字',bytes:wav(5),reference:true});assert.equal(s.summary().reference.duration,5);assert.equal(s.summary().reference.audio,undefined);
 s=new VoiceStore(dir);assert.ok(s.audio('喝口水吧。'));assert.equal(s.summary().clips[0].audio,undefined);
 s.remove('__reference__');assert.equal(s.data.reference,null);assert.ok(s.audio('喝口水吧。'));
 s.remove('喝口水吧。');assert.equal(s.audio('喝口水吧。'),null);
 s.settings({enabled:false,effects:false,volume:0});assert.equal(new VoiceStore(dir).summary().enabled,false);
 assert.throws(()=>s.settings({enabled:true,effects:true,volume:NaN}));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('无引擎或无样本时明确失败，不生成假音频',async()=>{
 const {VoiceAI}=require('../src/voice-ai.cjs');const ai=new VoiceAI('/not-present',{dir:'/not-present',data:{reference:null}});
 await assert.rejects(ai.generate('你好'),/尚未准备/);assert.equal(ai.child,null);
});
test('损坏声音资料不阻止启动且不覆盖原文件，明确清除后才能重写',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cike-voice-corrupt-'));
 try{fs.writeFileSync(path.join(dir,'voice.json'),'{broken');const s=new VoiceStore(dir);assert.match(s.summary().error,/无法读取/);assert.throws(()=>s.settings({enabled:true,effects:true,volume:.5}),/无法读取/);assert.equal(fs.readFileSync(path.join(dir,'voice.json'),'utf8'),'{broken');s.reset();assert.equal(new VoiceStore(dir).summary().error,null);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('启动只清理配音生成临时目录，保留其他目录',()=>{
 const {VoiceAI}=require('../src/voice-ai.cjs');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cike-clean-'));
 try{fs.mkdirSync(path.join(dir,'generation-abcdef'));fs.mkdirSync(path.join(dir,'other'));new VoiceAI('/not-present',{dir});assert.equal(fs.existsSync(path.join(dir,'generation-abcdef')),false);assert.equal(fs.existsSync(path.join(dir,'other')),true);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
