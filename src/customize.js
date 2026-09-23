const $=id=>document.getElementById(id),api=window.cike;
let state,rows=[],selectedId=null,draftImage=null,lookDraft=null,dirty=false,motions={};
function message(text){$('status').textContent=text;$('editor-status').textContent=text;}
async function run(fn){try{return await fn();}catch(e){message(e.message);return null;}}
function tab(name){document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!==name);document.querySelectorAll('[data-tab]').forEach(b=>{if(b.dataset.tab===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});window.scrollTo(0,0);}
document.querySelectorAll('[data-tab],[data-go]').forEach(b=>b.onclick=()=>tab(b.dataset.tab||b.dataset.go));
async function refresh(){state=await api.call('get');rows=await api.call('content-list');$('version').textContent=state.appVersion+' · 小动作画廊';const art=state.image||await api.call('art',{illustration:'window',appearance:state.appearance,night:false});$('home-image').src=art;if(lookDraft===null)$('look-image').src=art;list();const v=await api.call('voice-summary');$('sound-summary').textContent=`声音${v.enabled?'已开启':'已关闭'} · 已保存 ${v.clips.length} 句配音。`;}
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
$('generate-action-image').onclick=()=>run(async()=>{const reference=state.image;if(!reference)throw Error('请先在“形象与衣橱”中应用一个 AI 形象。');const image=await api.call('image-generate',{referenceImage:reference,purpose:'action',style:$('ai-style')?.value||'彩绘风',action:$('title').value||$('text').value});draftImage=image;dirty=true;imagePreview();message('小动作配图已生成，保存小动作后才会保留。');});
$('motion').onchange=()=>{dirty=true;imagePreview();};
$('clear-action-image').onclick=()=>{draftImage=null;dirty=true;imagePreview();};
async function save(){if(!$('editor').reportValidity())return false;const old=rows.find(r=>r.id===selectedId);const row={id:selectedId,text:$('text').value.trim(),period:'any',tags:old?.tags||[],...(old?.weekdays?{weekdays:old.weekdays}:{}),...(old?.topic?{topic:old.topic}:{}),...(draftImage?{image:draftImage}:{}),action:{title:$('title').value.trim(),duration:$('duration').value.trim(),closing:$('closing').value.trim(),illustration:$('illustration').value,...(!draftImage&&$('motion').value?{motionId:$('motion').value}:{})}};if($('scene').value==='preserve'){row.period=old?.period||'any';if(old?.scenes)row.scenes=old.scenes;}else if($('scene').value!=='any')row.scenes=[$('scene').value];await api.call('content-save',row);await api.call('content-toggle',{id:row.id,enabled:$('row-enabled').checked});dirty=false;await refresh();select(rows.find(r=>r.id===row.id));message('已保存到本机。可以在桌面试一下，或给这句话配音。');return true;}
$('editor').onsubmit=e=>{e.preventDefault();run(async()=>{if(await save())$('edit-dialog').close();});};
$('preview-action').onclick=()=>run(async()=>{if((!dirty&&rows.some(r=>r.id===selectedId))||await save()){await api.call('content-preview',selectedId);message('已在桌面显示这条小动作；这次预览不占提醒次数。');}});
$('voice-action').onclick=()=>run(async()=>{if((!dirty&&rows.some(r=>r.id===selectedId))||await save())await api.call('voice-room',$('text').value.trim());});
$('remove-action').onclick=()=>run(async()=>{if(await api.call('content-remove',selectedId)){dirty=false;await refresh();select(rows.find(r=>r.id===selectedId)||rows[0]);message('已经更新，原配音仍保留在本机。');}});
$('pick-image').onclick=()=>run(async()=>{const image=await api.call('image-pick');if(image){lookDraft=image;$('look-image').src=image;$('look-label').textContent='预览 · 尚未应用';$('apply-image').disabled=false;}});
$('apply-image').onclick=()=>run(async()=>{if(!lookDraft)return;await api.call('image-apply',lookDraft);lookDraft=null;$('apply-image').disabled=true;$('look-label').textContent='当前形象';await refresh();message('自己的形象已应用，重启仍保留。');});
$('restore-image').onclick=()=>run(async()=>{await api.call('image-apply',null);lookDraft=null;$('apply-image').disabled=true;$('look-label').textContent='当前形象';await refresh();message('已使用小纸团，原来的衣橱搭配保留。');});
async function refreshImageService(){const s=await api.call('image-service-status');$('ai-status').value=s.configured?`${s.provider} · ${s.model}`:'未配置';$('ai-generate').disabled=!s.configured;}
$('ai-generate').onclick=()=>run(async()=>{const reference=lookDraft||state.image;if(!reference)throw Error('请先选择一张照片。');const button=$('ai-generate'),results=$('ai-results');button.disabled=true;results.replaceChildren();for(let i=0;i<6;i++){message(`正在生成第 ${i+1}/6 个形象候选…`);const image=await api.call('image-generate',{referenceImage:reference,purpose:'character',style:$('ai-style').value});const card=document.createElement('button');card.className='ai-result';card.type='button';const preview=document.createElement('img');preview.src=image;preview.alt=`形象候选 ${i+1}`;card.append(preview,document.createTextNode(`使用候选 ${i+1}`));card.onclick=()=>{lookDraft=image;$('look-image').src=image;$('look-label').textContent=`预览 · 形象候选 ${i+1}`;$('apply-image').disabled=false;message('已选中候选，点击“应用到桌面”确认。');};results.append(card);}button.disabled=false;message('6 个形象候选已生成，请先选择并确认一个。');});
for(const [id,call]of [['open-lab','laboratory'],['open-voice','voice-room'],['open-preferences','preferences'],['export-data','export'],['restore-data','restore-data']])$(id).onclick=()=>run(async()=>{const r=await api.call(call);if(typeof r==='string')message(r);});
api.on('state',()=>run(refresh));api.on('voice-changed',()=>run(refresh));
window.onbeforeunload=e=>{if(dirty&&!confirm('有尚未保存的小动作修改，确定关闭？')){e.preventDefault();e.returnValue=false;}};
run(async()=>{motions=Object.fromEntries((await api.call('motion-library')).filter(r=>r.action?.motionId).map(r=>[r.action.motionId,{id:r.action.motionId,label:r.action.title,illustration:r.action.illustration}]));await refresh();await refreshImageService();select(rows[0]);$('data-path').textContent=await api.call('data-location');});
