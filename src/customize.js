const $=id=>document.getElementById(id),api=window.cike;
const aboutVersion=[...document.querySelectorAll('#data .note p')].find(p=>/Mac Apple Silicon 体验版/.test(p.textContent));
if(aboutVersion)aboutVersion.textContent='0.11.0 · 一张图生成透明动作 · Mac Apple Silicon 体验版';
let state,rows=[],selectedId=null,draftImage=null,lookDraft=null,dirty=false,motions={};
const characterCss=document.createElement('link');characterCss.rel='stylesheet';characterCss.href='character.css';document.head.append(characterCss);
const portraitPanel=document.createElement('section');portraitPanel.id='portrait';portraitPanel.className='panel';portraitPanel.hidden=true;portraitPanel.innerHTML=`<div class="eyebrow">01 / ONE IMAGE TO MOTION</div><h1>一张图，生成一个透明桌面动作。</h1><p class="intro">普通照片先选角色候选；已经满意的卡通角色图可以直接作为母版。后台自动完成动作首帧、4秒视频和透明背景。</p><div class="portrait-grid"><div class="portrait-upload"><div class="image-well"><img id="portrait-image" src="../assets/creature.svg" alt="图片预览"></div><button id="pick-portrait" class="primary">选择一张图片</button><label class="authorization"><input id="portrait-authorization" type="checkbox"> 我确认拥有这张图片及人物形象的使用授权</label><p class="hint">选择图片只在本机预览。点击生成后，图片会发送给火山方舟 Seedream／Seedance，并产生模型费用。</p></div><div><h2>选一种风格</h2><div class="style-options">${['彩绘风','线条风','3D风','插画风','手办风'].map((s,i)=>`<button data-style="${s}" aria-pressed="${i===3}"><b>${s}</b><span>${s==='插画风'?'日系Q版插画 · 推荐':'保持同一人物的风格配方'}</span></button>`).join('')}</div><p id="character-engine" class="hint">正在检查生产能力…</p><div class="buttons"><button id="use-upload-as-character" disabled>这张图已经是角色母版</button><button id="generate-candidates" disabled>生成 6 个角色候选</button></div></div></div><div id="candidate-stage" hidden><h2>选定唯一角色母版</h2><p class="hint">动作只从你选中的这一张生成。</p><div id="candidate-grid" class="candidate-grid"></div></div><div id="action-stage" hidden><h2>生成一个动作视频</h2><p class="hint">本次只生成“喝水”：角色双手持杯、举到嘴边、喝一口并放回起始位置。</p><button id="generate-action-video" class="primary">生成透明喝水动作</button><div id="pipeline-progress" class="pipeline-progress" hidden><b id="pipeline-step">准备开始</b><p>生成通常需要几分钟；不会因超时自动重新扣费。</p></div><video id="action-video" muted loop playsinline controls hidden></video><div class="buttons"><button id="apply-character" hidden>把母版作为静态桌面形象</button><button id="show-action-on-desktop" class="primary" hidden>在桌面播放这个动作</button></div></div>`;document.querySelector('main').insertBefore(portraitPanel,document.getElementById('look'));
portraitPanel.classList.add("development-only");
const developmentNotice=document.createElement("div");
developmentNotice.className="note development-notice";
developmentNotice.innerHTML="<h2>定制形象正在开发中</h2><p>角色资产母版还没有设置好。现在先使用团子形象；完成后这里会支持一张照片定制，并把确认好的角色带回“安排治愈小事”。</p>";
portraitPanel.prepend(developmentNotice);
portraitPanel.querySelector(".portrait-grid").hidden=true;
portraitPanel.querySelector("#candidate-stage").hidden=true;
portraitPanel.querySelector("#action-stage").hidden=true;
function message(text){$('status').textContent=text;$('editor-status').textContent=text;}
async function run(fn){try{return await fn();}catch(e){message(e.message);return null;}}
function tab(name){document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!==name);document.querySelectorAll('[data-tab]').forEach(b=>{if(b.dataset.tab===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});window.scrollTo(0,0);}
document.querySelectorAll('[data-tab],[data-go]').forEach(b=>b.onclick=()=>tab(b.dataset.tab||b.dataset.go));
let portraitDraft=null,portraitStyle='插画风',characterReady=false,candidates=[],selectedCharacter=null,generatedVideo=null;
function authorized(){return $('portrait-authorization').checked;}
function updateCharacterButton(){const ready=!!(portraitDraft&&characterReady&&authorized());$('generate-candidates').disabled=!ready;$('use-upload-as-character').disabled=!ready;}
$('portrait-authorization').onchange=updateCharacterButton;
document.querySelectorAll('[data-style]').forEach(button=>button.onclick=()=>{portraitStyle=button.dataset.style;document.querySelectorAll('[data-style]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));});
$('pick-portrait').onclick=()=>run(async()=>{const image=await api.call('image-pick');if(!image)return;portraitDraft=image;candidates=[];selectedCharacter=null;generatedVideo=null;$('portrait-image').src=image;$('portrait-authorization').checked=false;$('candidate-stage').hidden=true;$('action-stage').hidden=true;$('action-video').hidden=true;updateCharacterButton();message('图片已在本机预览；请确认授权后再选择生产方式。');});
function selectCharacter(image,label){selectedCharacter=image;generatedVideo=null;$('action-stage').hidden=false;$('apply-character').hidden=false;$('show-action-on-desktop').hidden=true;$('action-video').hidden=true;message(`已选定${label}，它将作为唯一动作母版。`);}
function candidateCard(image,index){const button=document.createElement('button');button.dataset.index=index;button.setAttribute('aria-pressed','false');const img=document.createElement('img');img.src=image;img.alt=`形象候选 ${index+1}`;const label=document.createElement('b');label.textContent=String(index+1);button.append(img,label);button.onclick=()=>{document.querySelectorAll('#candidate-grid button').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));selectCharacter(image,`候选 ${index+1}`);};return button;}
$('use-upload-as-character').onclick=()=>{if(portraitDraft&&authorized()){selectCharacter(portraitDraft,'这张角色图');$('candidate-stage').hidden=true;}};
$('generate-candidates').onclick=()=>run(async()=>{if(!portraitDraft||!authorized())return;$('generate-candidates').disabled=true;$('candidate-stage').hidden=false;$('action-stage').hidden=true;$('candidate-grid').replaceChildren();candidates=[];for(let i=0;i<6;i++){const pending=document.createElement('div');pending.className='pending';pending.textContent=`正在生成 ${i+1} / 6…`;$('candidate-grid').append(pending);message(`正在生成角色候选 ${i+1} / 6…`);const result=await api.call('character-candidate',{portrait:portraitDraft,style:portraitStyle,index:i,authorizationConfirmed:true});candidates.push(result.image);pending.replaceWith(candidateCard(result.image,i));}updateCharacterButton();message('六个角色候选已生成，请选定一个母版。');});
api.on('character-progress',progress=>{$('pipeline-progress').hidden=false;$('pipeline-step').textContent=progress.text;message(progress.text);});
$('generate-action-video').onclick=()=>run(async()=>{if(!selectedCharacter||!authorized())return;$('generate-action-video').disabled=true;$('pipeline-progress').hidden=false;$('pipeline-step').textContent='正在准备生产任务…';$('action-video').hidden=true;$('show-action-on-desktop').hidden=true;try{const result=await api.call('character-video',{character:selectedCharacter,style:portraitStyle,label:'喝水',authorizationConfirmed:true});generatedVideo=result.webm;$('action-video').src=result.webm;$('action-video').hidden=false;await $('action-video').play().catch(()=>{});$('show-action-on-desktop').hidden=false;$('pipeline-step').textContent='透明动作已完成并送到桌面';message('动作视频已完成：这里可以预览，桌面也已自动开始播放。');}finally{$('generate-action-video').disabled=false;}});
$('show-action-on-desktop').onclick=()=>run(async()=>{await api.call('transparent-preview-enable',true);message('已在桌面播放透明动作。');});
$('apply-character').onclick=()=>run(async()=>{if(!selectedCharacter)return;await api.call('image-apply',selectedCharacter);await refresh();message('角色母版已作为静态桌面形象保存；动作视频单独保留。');});
async function refresh(){state=await api.call('get');rows=await api.call('content-list');$('version').textContent=state.appVersion+' · 桌搭团子';const art=state.image||await api.call('art',{illustration:'window',appearance:state.appearance,night:false});if($('home-image'))$('home-image').src=art;if(lookDraft===null&&$('look-image'))$('look-image').src=art;list();const v=await api.call('voice-summary');$('sound-summary').textContent=`声音${v.enabled?'已开启':'已关闭'} · 已保存 ${v.clips.length} 句配音。`;}
const artCache=new Map();
function rowArt(r){
  if(r.image)return Promise.resolve(r.image);
  const illustration=r.action?.illustration||'window',motionId=r.action?.motionId;
  const key=JSON.stringify([state.appearance,illustration,motionId]);
  if(!artCache.has(key))artCache.set(key,api.call('art',{illustration,appearance:state.appearance,night:false,...(motionId?{motionId,animate:false}:{})}).catch(()=>`../assets/scenes/${illustration}.svg`));
  return artCache.get(key);
}
let replaceTarget=null,replaceImage=null;
function list(){
  const q=$('search').value.trim(),filter=$('filter').value;
  const visible=rows.filter(r=>(r.text+' '+(r.action?.title||'')).includes(q)&&(filter==='all'||filter==='custom'&&!r.builtin||filter==='edited'&&r.edited||filter==='disabled'&&!r.enabled));
  $('count').textContent=`${visible.length} 条小动作 · ${rows.filter(r=>!r.builtin).length} 条自己的创作 · ${rows.filter(r=>!r.enabled).length} 条停用`;
  const fragment=document.createDocumentFragment();
  for(const r of visible){
    const card=document.createElement('article');card.className='action-card'+(!r.enabled?' off':'');card.dataset.id=r.id;
    const open=document.createElement('button');open.className='card-open';open.setAttribute('aria-label','编辑：'+(r.action?.title||r.text));
    const image=document.createElement('img');image.alt=r.action?.title||'陪伴画面';image.loading='lazy';image.src=r.image||`../assets/scenes/${r.action?.illustration||'window'}.svg`;rowArt(r).then(src=>image.src=src);
    const title=document.createElement('b');title.textContent=r.action?.title||r.text.slice(0,14);
    open.append(image,title);open.onclick=()=>{select(r);$('action-details').open=false;$('edit-dialog').showModal();};
    const meta=document.createElement('small');meta.textContent=(r.image?'自己的配图':r.builtin?'内置画面':'我的创作')+(!r.enabled?' · 已停用':'');
    const controls=document.createElement('div');controls.className='card-controls';
    const replace=document.createElement('button');replace.textContent='换图';replace.onclick=()=>run(async()=>{const picked=await api.call('image-pick');if(!picked)return;replaceTarget=r.id;replaceImage=picked;$('replace-name').textContent=r.action?.title||r.text;$('replace-preview').src=picked;$('replace-dialog').showModal();});
    const preview=document.createElement('button');preview.textContent='试一下';preview.onclick=()=>run(async()=>{await api.call('content-preview',r.id);message('已在桌面预览，不占提醒次数。');});
    const toggle=document.createElement('button');toggle.textContent=r.enabled?'已启用':'已停用';toggle.setAttribute('aria-pressed',String(r.enabled));toggle.onclick=()=>run(async()=>{await api.call('content-toggle',{id:r.id,enabled:!r.enabled});await refresh();message(r.enabled?'已停用，可随时重新启用。':'已重新启用。');});
    controls.append(replace,preview,toggle);card.append(open,meta,controls);fragment.append(card);
  }
  $('content-list').replaceChildren(fragment);
  if(!visible.length){const p=document.createElement('p');p.className='hint';p.textContent='没有找到内容，可以换个词，或新建一条。';$('content-list').append(p);}
}
$('confirm-replace').onclick=()=>run(async()=>{const row=rows.find(r=>r.id===replaceTarget);if(!row||!replaceImage)return;await api.call('content-save',{...row,image:replaceImage});$('replace-dialog').close();replaceImage=null;await refresh();message('配图已替换，原来的文字、时段和配音保持不变。');});
$('cancel-replace').onclick=()=>{$('replace-dialog').close();replaceImage=null;};
function closeEditor(){if(dirty&&!confirm('有尚未保存的修改，放弃并返回画廊？'))return;dirty=false;$('edit-dialog').close();}
$('close-editor').onclick=closeEditor;
$('edit-dialog').addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
function motionOptions(value=''){const entries=Object.values(motions).filter(r=>r.illustration===$('illustration').value);$('motion').replaceChildren(new Option('静态配图',''),...entries.map(r=>new Option(r.label,r.id)));$('motion').value=value;}
let previewRevision=0;
function imagePreview(){const revision=++previewRevision;$('motion').disabled=!!draftImage;rowArt({image:draftImage,action:{illustration:$('illustration').value,motionId:$('motion').value}}).then(src=>{if(revision===previewRevision)$('action-image').src=src;});}
function select(r){$('editor-status').textContent='';selectedId=r.id;draftImage=r.image||null;dirty=false;$('row-kind').textContent=r.builtin?'内置内容 · 可自由修改':'自己的小动作';$('row-enabled').checked=r.enabled!==false;$('title').value=r.action?.title||'给自己一句话';$('text').value=r.text;$('duration').value=r.action?.duration||'半分钟';$('closing').value=r.action?.closing||'一点点就好。';$('scene').value=r.scenes?.length===1?r.scenes[0]:r.period==='any'&&!r.scenes?'any':'preserve';$('illustration').value=r.action?.illustration||'window';motionOptions(r.action?.motionId);imagePreview();$('remove-action').textContent=r.builtin?'恢复这条内置内容':'删除这条';$('remove-action').disabled=!rows.some(x=>x.id===r.id);list();}
$('search').oninput=list;$('filter').onchange=list;
$('new-action').onclick=()=>{if(dirty&&!confirm('放弃尚未保存的修改，新建一条？'))return;select({id:'mine-'+crypto.randomUUID(),text:'',period:'any',tags:[],enabled:true});$('title').value='';$('action-details').open=false;$('edit-dialog').showModal();$('title').focus();};
$('editor').oninput=()=>dirty=true;$('illustration').onchange=()=>{motionOptions();imagePreview();dirty=true;};
$('pick-action-image').onclick=()=>run(async()=>{const image=await api.call('image-pick');if(image){draftImage=image;dirty=true;imagePreview();}});
$('motion').onchange=()=>{dirty=true;imagePreview();};
$('clear-action-image').onclick=()=>{draftImage=null;dirty=true;imagePreview();};
async function save(){if(!$('editor').reportValidity())return false;const old=rows.find(r=>r.id===selectedId);const row={id:selectedId,text:$('text').value.trim(),period:'any',tags:old?.tags||[],...(old?.weekdays?{weekdays:old.weekdays}:{}),...(old?.topic?{topic:old.topic}:{}),...(draftImage?{image:draftImage}:{}),action:{title:$('title').value.trim(),duration:$('duration').value.trim(),closing:$('closing').value.trim(),illustration:$('illustration').value,...(!draftImage&&$('motion').value?{motionId:$('motion').value}:{})}};if($('scene').value==='preserve'){row.period=old?.period||'any';if(old?.scenes)row.scenes=old.scenes;}else if($('scene').value!=='any')row.scenes=[$('scene').value];await api.call('content-save',row);await api.call('content-toggle',{id:row.id,enabled:$('row-enabled').checked});dirty=false;await refresh();select(rows.find(r=>r.id===row.id));message('已保存到本机。可以在桌面试一下，或给这句话配音。');return true;}
$('editor').onsubmit=e=>{e.preventDefault();run(async()=>{if(await save())$('edit-dialog').close();});};
$('preview-action').onclick=()=>run(async()=>{if((!dirty&&rows.some(r=>r.id===selectedId))||await save()){await api.call('content-preview',selectedId);message('已在桌面显示这条小动作；这次预览不占提醒次数。');}});
$('voice-action').onclick=()=>run(async()=>{if((!dirty&&rows.some(r=>r.id===selectedId))||await save())await api.call('voice-room',$('text').value.trim());});
$('remove-action').onclick=()=>run(async()=>{if(await api.call('content-remove',selectedId)){dirty=false;await refresh();select(rows.find(r=>r.id===selectedId)||rows[0]);message('已经更新，原配音仍保留在本机。');}});
$('pick-image')?.addEventListener('click',()=>run(async()=>{const image=await api.call('image-pick');if(image){lookDraft=image;$('look-image').src=image;$('look-label').textContent='预览 · 尚未应用';$('apply-image').disabled=false;}}));
$('apply-image')?.addEventListener('click',()=>run(async()=>{if(!lookDraft)return;await api.call('image-apply',lookDraft);lookDraft=null;$('apply-image').disabled=true;$('look-label').textContent='当前形象';await refresh();message('自己的形象已应用，重启仍保留。');}));
$('restore-image').onclick=()=>run(async()=>{await api.call('image-apply',null);lookDraft=null;if($('apply-image'))$('apply-image').disabled=true;$('look-label').textContent='当前团子形象';await refresh();message('已使用默认团子，原来的衣橱搭配保留。');});
for(const [id,call]of [['open-lab','laboratory'],['open-voice','voice-room'],['open-preferences','preferences'],['export-data','export'],['restore-data','restore-data']])$(id).onclick=()=>run(async()=>{const r=await api.call(call);if(typeof r==='string')message(r);});
api.on('state',()=>run(refresh));api.on('voice-changed',()=>run(refresh));
window.onbeforeunload=e=>{if(dirty&&!confirm('有尚未保存的小动作修改，确定关闭？')){e.preventDefault();e.returnValue=false;}};
run(async()=>{const engine=await api.call('character-status');characterReady=engine.ready;$('character-engine').textContent=engine.ready?`后台已准备：${engine.provider} · Seedream + Seedance。每次生成会消耗方舟额度。`:'后台尚未配置 ARK_API_KEY；不会发送图片或产生费用。';updateCharacterButton();motions=Object.fromEntries((await api.call('motion-library')).filter(r=>r.action?.motionId).map(r=>[r.action.motionId,{id:r.action.motionId,label:r.action.title,illustration:r.action.illustration}]));await refresh();select(rows[0]);$('data-path').textContent=await api.call('data-location');});
