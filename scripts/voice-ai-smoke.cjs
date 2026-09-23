// Real offline inference against a system-synthesized test reference, never a child sample.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {VoiceStore,wavInfo}=require('../src/voice-store.cjs');
const {VoiceAI}=require('../src/voice-ai.cjs');
(async()=>{
 const dir=path.resolve('.private/voice-verification/store');
 const s=new VoiceStore(dir),ai=new VoiceAI(path.resolve('.private/voice-runtime'),s);
 s.save({text:'你好呀，我是你的小纸团。你忙你的，我在这里陪着你。我们一起喝口水，再来击个掌吧。',bytes:fs.readFileSync('.private/voice-verification/reference.wav'),reference:true});
 const text='耶，击掌！这件事完成啦。',start=Date.now();
 await ai.generate(text);assert.equal(s.audio(text),null);assert.ok(s.audio(text,true));
 const bytes=Buffer.from(s.data.clips[require('../src/voice-store.cjs').key(text)].audio,'base64');
 const info=wavInfo(bytes);assert.ok(info.duration>1);fs.writeFileSync('artifacts/0.7.0-AI链路测试-非女儿声音.wav',bytes);
 const result={source:'macOS Tingting system synthetic voice, not daughter',target:text,elapsedSeconds:(Date.now()-start)/1000,duration:info.duration,model:'Qwen3-TTS-12Hz-0.6B-Base-bf16',offline:true,approved:false};
 fs.writeFileSync('artifacts/0.7.0-AI链路测试.json',JSON.stringify(result,null,2));console.log(result);
})().catch(e=>{console.error(e);process.exitCode=1;});
