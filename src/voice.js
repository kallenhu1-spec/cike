const $ = id => document.getElementById(id), api = window.cike;
let summary, lines = [], busy = false, recorder, stream, deadline, ticker, recordTarget, recordingText, cancelled = false;
function message(text, error = false) { $('status').textContent = text; $('activity').classList.toggle('error', error); }
function selected() { return lines[Number($('line-select').value)]; }
function lock(value) {
  busy = value;
  for (const id of ['record-reference','import-reference','record-line','import-line','generate','batch','line-select','reference-text','delete-reference','clear','silent-line']) $(id).disabled = value;
  $('stop').hidden = !value;
  if (!value) {updateClip();if(pendingSelection!==null){const text=pendingSelection;pendingSelection=null;action(()=>loadLines(text));}}
}
async function refresh() {
  summary = await api.call('voice-summary');
  if (summary.error) message(summary.error, true);
  $('enabled').checked = summary.enabled; $('effects').checked = summary.effects; $('volume').value = summary.volume * 100;
  $('reference-status').textContent = summary.reference ? `声音样本已保存 · ${summary.reference.duration.toFixed(1)} 秒 · 仅本机` : '还没有声音样本。亲录台词不需要先录样本。';
  if (summary.reference && !busy && document.activeElement !== $('reference-text')) $('reference-text').value = summary.reference.text;
  $('listen-reference').disabled = !summary.reference;
  $('delete-reference').disabled = !summary.reference || busy;
  $('save-reference-text').disabled = !summary.reference || busy;
  const s = await api.call('voice-engine');
  $('engine-status').textContent = s.ready ? '● 本机 AI 已准备好' : '○ 本机 AI 尚未准备好 · 仍可亲自录台词';
  $('runtime-help').textContent = s.ready ? '这台电脑的引擎已安装，可直接录样本生成。' : '本机 AI 是可选扩展，当前体验包不包含引擎。可直接录音或导入音频；安装说明见随包使用说明。';
  const active = lines.filter(r=>!r.title.includes('仅试听'));
  const silent = active.filter(r=>(summary.silent || []).includes(r.text)).length;
  const ready = active.filter(r=>!(summary.silent || []).includes(r.text) && summary.clips.some(c=>c.text===r.text && c.approved)).length;
  const pending = active.filter(r=>!(summary.silent || []).includes(r.text) && summary.clips.some(c=>c.text===r.text && !c.approved)).length;
  $('coverage').textContent = '日常台词 '+active.length+' 句 · 已启用 '+ready+' · 待试听 '+pending+' · 不配音 '+silent+' · 尚未配音 '+(active.length-ready-pending-silent)+'。录样本不会自动生成全部台词。';
  updateClip();
}
function updateClip() {
  const row = selected(); if (!row || !summary) return;
  const clip = summary.clips.find(c => c.text === row.text);
  $('silent-line').checked = (summary.silent || []).includes(row.text);
  $('line-text').textContent = row.text;
  $('clip-status').textContent = clip ? `${clip.source === 'ai' ? 'AI 配音' : '亲录原声'} · ${clip.approved ? '已启用' : '待试听启用'}` : '还没有配音';
  $('listen-line').disabled = busy || !clip;
  $('approve').disabled = busy || !clip || clip.approved;
  $('delete-line').disabled = busy || !clip;
}
function consent() { if (!$('consent').checked) throw Error('请先确认声音属于你，或已获得声音主人的同意'); }
async function action(fn) { try { await fn(); } catch(e) { message(e.message || '这次没有完成，请重试', true); } }
async function encode(file) {
  if (file.size > 15000000) throw Error('录音文件请小于 15 MB');
  const ctx = new AudioContext({sampleRate:24000});
  try { const audio = await ctx.decodeAudioData(await file.arrayBuffer()); return CikeSound.wav(audio); }
  finally { await ctx.close(); }
}
async function saveAudio(blob, reference, text) {
  const bytes = await encode(blob);
  const result = await api.call('voice-save', {bytes, reference, text, consent: true});
  message(result.clipped ? '已保存，但声音有些过响，建议离麦克风远一点重录。' : reference ? '样本保存好了。现在可以选一句台词，让 AI 试着说。' : '录好了！先试听，喜欢了再点“用这版声音”。');
  await refresh();
}
async function record(reference) {
  consent(); CikeSound.stop();
  recordingText = reference ? $('reference-text').value.trim() : selected().text;
  if (!recordingText) throw Error('先填写实际要说的话');
  recordTarget = reference; lock(true); cancelled = false;
  try {
    const allowed = await api.call('voice-microphone');
    if (!allowed) throw Error('麦克风没有获准使用。请到系统设置允许此刻，或导入一段录音');
    stream = await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:false});
    if (cancelled) { stream.getTracks().forEach(t=>t.stop()); stream=null; lock(false); return; }
    recorder = new MediaRecorder(stream); const chunks = [];
    recorder.ondataavailable = e => { if(e.data.size) chunks.push(e.data); };
    recorder.onerror = () => { cancelled=true; stopRecording(); message('录音中断，请重试',true); };
    recorder.onstop = async () => {
      stream?.getTracks().forEach(t=>t.stop()); stream=null; clearTimeout(deadline); clearInterval(ticker); recorder=null;
      await action(async()=>{ if (!cancelled) await saveAudio(new Blob(chunks,{type:chunks[0]?.type}),recordTarget,recordingText); });
      lock(false); await refresh();
    };
    recorder.start(); const start=Date.now();
    $('stop').textContent='录好了，保存'; message('正在录音 · 0 秒。可以开始说啦。');
    ticker=setInterval(()=>message(`正在录音 · ${Math.floor((Date.now()-start)/1000)} 秒。说完点“录好了，保存”。`),500);
    deadline=setTimeout(stopRecording,reference?19500:29000);
  } catch(e) {stream?.getTracks().forEach(t=>t.stop()); stream=null; lock(false); throw e;}
}
function stopRecording() {if(recorder?.state==='recording') recorder.stop();}
$('record-reference').onclick=()=>action(()=>record(true));
$('record-line').onclick=()=>action(()=>record(false));
let importReference=false;
function importAudio(reference) {consent(); importReference=reference; $('file').value=''; $('file').click();}
$('import-reference').onclick=()=>action(()=>importAudio(true));
$('import-line').onclick=()=>action(()=>importAudio(false));
$('file').onchange=()=>action(async()=>{
  const file=$('file').files[0]; if(!file)return; lock(true);
  try {await saveAudio(file,importReference,importReference?$('reference-text').value:selected().text);}finally{lock(false);}
});
$('silent-line').onchange=()=>action(async()=>{CikeSound.stop();await api.call('voice-silent',{text:selected().text,silent:$('silent-line').checked});await refresh();message($('silent-line').checked?'这句会安静显示，已有录音保留。':'已恢复这句的配音；已启用的录音可以自动播放。');});
$('line-select').onchange=()=>{CikeSound.stop();updateClip();};
$('listen-reference').onclick=()=>action(async()=>{await CikeSound.play(await api.call('voice-preview','__reference__'),summary.volume);});
$('listen-line').onclick=()=>action(async()=>{await CikeSound.play(await api.call('voice-preview',selected().text),summary.volume);message('正在试听。确认内容和声音后，再启用这一版。');});
$('approve').onclick=()=>action(async()=>{await api.call('voice-approve',selected().text);await refresh();message('已启用。小纸团出现这句台词时，就会用这版声音。');});
$('delete-line').onclick=()=>action(async()=>{CikeSound.stop();await api.call('voice-delete',selected().text);await refresh();message('这句录音已删除。');});
$('save-reference-text').onclick=()=>action(async()=>{consent();await api.call('voice-reference-text',$('reference-text').value);await refresh();message('样本文字已更新，之后生成会使用这份文字。');});
$('delete-reference').onclick=()=>action(async()=>{CikeSound.stop();await api.call('voice-delete','__reference__');await refresh();message('样本已删除；已保存的台词配音仍保留，可单独删除。');});
async function generate(batch=false) {
  consent(); CikeSound.stop();
  const targets=batch?lines.filter(r=>!r.title.includes('仅试听') && !(summary.silent || []).includes(r.text) && !summary.clips.some(c=>c.text===r.text)).slice(0,5):[selected()];
  if(!targets.length){message('没有需要补配的台词。已有录音、不配音和仅试听句已跳过。');return;}
  if(!batch && (summary.silent || []).includes(selected().text)) throw Error('这句已选择不配音，请先取消勾选');
  if(summary.reference && $('reference-text').value.trim() !== summary.reference.text) throw Error('样本文字已修改，请先点“保存样本文字”再生成');
  if(!batch&&summary.clips.some(c=>c.text===selected().text))throw Error('这句已有录音。若要重配，请先试听，再删除旧版');
  cancelled=false;lock(true);$('stop').textContent='停止生成';
  let count=0;
  try {
    for(const row of targets){if(cancelled)break;message(`本机 AI 正在配第 ${count+1}/${targets.length} 句，可能需要几分钟…`);await api.call('voice-generate',{text:row.text,consent:true});count++;await refresh();}
    message(`已生成 ${count} 句，等待你逐句试听并启用。`);
  } finally {lock(false);await refresh();}
}
$('generate').onclick=()=>action(()=>generate());$('batch').onclick=()=>action(()=>generate(true));
$('stop').onclick=()=>action(async()=>{if(recorder){stopRecording();}else{cancelled=true;await api.call('voice-cancel');message('正在停止…');}});
for(const id of ['enabled','effects','volume'])$(id).onchange=()=>action(async()=>{CikeSound.stop();await api.call('voice-settings',{enabled:$('enabled').checked,effects:$('effects').checked,volume:Number($('volume').value)/100});await refresh();});
$('clap').onclick=()=>action(async()=>{if(!summary.enabled||!summary.effects){message('先开启声音和击掌音效，就能试听。');return;}await CikeSound.clap();message('啪！击掌音效已试听。');});
$('clear').onclick=()=>action(async()=>{CikeSound.stop();const result=await api.call('voice-clear');await refresh();message(result?'全部录音、样本与 AI 配音已清除。':'已保留声音资料。');});
$('engine-help').onclick=()=>$('help').showModal();$('close-help').onclick=()=>$('help').close();
window.addEventListener('beforeunload',()=>{cancelled=true;stream?.getTracks().forEach(t=>t.stop());clearTimeout(deadline);clearInterval(ticker);CikeSound.stop();});
async function loadLines(text) {
  const keep=text || selected()?.text;
  lines=await api.call('voice-lines');
  $('line-select').replaceChildren(...lines.map((r,i)=>{const o=document.createElement('option');o.value=i;o.textContent=r.title+' · '+r.text.slice(0,20);return o;}));
  const index=lines.findIndex(r=>r.text===keep);if(index>=0)$('line-select').value=index;
  await refresh();
}
api.on('voice-changed',()=>action(refresh));
let pendingSelection=null;
api.on('voice-select',text=>{if(busy)pendingSelection=text;else action(()=>loadLines(text));});
action(async()=>loadLines(await api.call('voice-selection')));
