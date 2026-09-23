'use strict';
const $=id=>document.getElementById(id), cards=[...document.querySelectorAll('.compare article')];
const phases=['开始','做这件事','完成'];
const items=[['喝水','杯子在手边的话，喝一口再继续。'],['合本子','告一段落了，把本子合上，给桌面留一点空。'],['擦叶子','离开屏幕半分钟，给手边的一片叶子擦擦灰。']];
// Source images remain intact. CSS selects each observed keyframe region.
const regions={paper:[[0,444],[444,376],[820,434]],felt:[[0,418],[418,392],[810,444]]};
const playing=new Map(); let scheduled;
const media=matchMedia('(prefers-reduced-motion: reduce)');
function frame(card,n){const row=Number($('action').value),[y,height]=regions[card.dataset.style][row];card.querySelector('.scene').style.aspectRatio=`418 / ${height}`;const img=card.querySelector('img');img.style.transform=`translate(${-n*100/3}%, ${-y/1254*100}%)`;img.alt=`${card.dataset.style==='paper'?'纸感':'羊毛毡'}叶芽角色${items[row][0]}，${phases[n]}姿态`;card.querySelector('.phase').textContent=phases[n];card.dataset.frame=String(n);}
function stop(card){(playing.get(card)||[]).forEach(clearTimeout);playing.delete(card);card.dataset.playing='false';}
function cancelScheduled(){clearTimeout(scheduled);scheduled=undefined;$('later').textContent='10 秒后提醒一次';}
function selectFrame(n){cancelScheduled();cards.forEach(c=>{stop(c);frame(c,n)});document.querySelectorAll('[data-frame]').forEach(b=>{if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',String(Number(b.dataset.frame)===n))});$('status').textContent='静静待着，不循环。';}
function play(targets){cancelScheduled();$('message').textContent=items[Number($('action').value)][1];document.querySelectorAll('.frames button').forEach(b=>b.setAttribute('aria-pressed','false'));targets.forEach(c=>{stop(c);if(media.matches||$('reduce').checked){frame(c,2);$('status').textContent='减少动画已开启，直接看完成姿态。';return;}frame(c,0);c.dataset.playing='true';playing.set(c,[setTimeout(()=>frame(c,1),700),setTimeout(()=>frame(c,2),2100),setTimeout(()=>{stop(c);$('status').textContent='动作完成，就停在这里。';},3000)]);$('status').textContent='关键帧试播中 · 仅此一次';});}
$('play').onclick=()=>play(cards);cards.forEach(c=>c.querySelector('.single').onclick=()=>play([c]));
$('action').onchange=()=>{selectFrame(0);$('message').textContent=items[Number($('action').value)][1];};
document.querySelectorAll('.frames button').forEach(b=>b.onclick=()=>selectFrame(Number(b.dataset.frame)));
$('later').onclick=()=>{if(scheduled){cancelScheduled();$('status').textContent='已取消这次提醒。';return;}cards.forEach(stop);$('later').textContent='取消这次提醒';$('status').textContent='10 秒后出现一次，不循环。';scheduled=setTimeout(()=>play(cards),10000);};
function respectMotion(){if(media.matches||$('reduce').checked){cards.forEach(c=>{stop(c);frame(c,2)});$('status').textContent='减少动画已开启，显示静态完成姿态。';}}
$('reduce').onchange=respectMotion;media.addEventListener('change',respectMotion);
addEventListener('pagehide',()=>{cancelScheduled();cards.forEach(stop)});
cards.forEach(c=>frame(c,0));respectMotion();
