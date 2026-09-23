const test = require('node:test'), assert = require('node:assert/strict');
const design = require('../src/appearance.js'), core = require('../src/core.cjs'), art = require('../src/art.cjs');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
test('旧版四字段外观可迁移；皮肤颜色和衣服拒绝注入及非法值', () => {
  assert(design.isOriginal({shape:'paper',face:0,eyes:0,expression:'smile'}));
  for (const extra of [{skinColor:'red"/>'},{outfit:'unknown'},{pattern:'script'},{patternSize:3},{patternDensity:-1},{patternColor:null},{outfitColor:'url(x)'}]) assert.throws(()=>design.validate({...design.defaults(),...extra}));
});
test('皮肤和衣服随档案保存，旧记忆不改变', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cike-outfit-'));
  try { const file=path.join(dir,'state.json'), state=core.defaults();
    state.appearance={...design.defaults(),outfit:'overalls',skinColor:'#f5dfc1',pattern:'flowers',patternSize:2,patternDensity:0,outfitColor:'#aabbcc'};
    core.save(file,state); const restored=core.read(file);
    assert.deepEqual(restored.appearance,state.appearance); assert.deepEqual(restored.memory,state.memory);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('所有衣服进入昼夜场景、一次动作和击掌，保留角色皮肤', () => {
  const motions=require('../src/motions.js').definitions;
  for(const outfit of ['none','overalls','sweater','apron','pajamas']) {
    const appearance={...design.defaults(),outfit,pattern:'dots',skinColor:'#f5dfc1'};
    const cases=core.ILLUSTRATIONS.flatMap(illustration=>[false,true].map(night=>({illustration,night})));
    for(const def of Object.values(motions)) cases.push({illustration:def.illustration,night:false,motionId:def.id,animate:true});
    for(const gesture of ['ready','done']) cases.push({illustration:'water',night:false,gesture});
    for(const input of cases) {const svg=Buffer.from(art({...input,appearance}).split(',')[1],'base64').toString(); assert(svg.includes(`data-outfit="${outfit}"`)); assert(svg.includes('#f5dfc1'));}
  }
});

test('上移五官兼容旧位置，穿衣上移且衣领不遮嘴', () => {
  for (const face of [-2,-1,0,1,2]) {
    for (const outfit of ['none','overalls','sweater','apron','pajamas']) {
      const a={...design.defaults(),face,outfit}; assert.equal(design.validate(a).face,face);
      const svg=design.svg(a); const expected=(outfit==='none'?111:89)+face*5;
      assert(svg.includes(`cx="86" cy="${expected}"`));
    }
  }
  assert.throws(()=>design.validate({...design.defaults(),face:-3}));
});
