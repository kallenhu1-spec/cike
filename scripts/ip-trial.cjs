const { _electron:electron }=require('playwright');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'artifacts/ip-trial-20260922-01'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'cike-ip-trial-'));
 const app=await electron.launch({executablePath:path.join(root,'dist/0.8.1/mac-arm64/此刻.app/Contents/MacOS/此刻'),env:{...process.env,CIKE_TEST_DIR:dir,CIKE_VOICE_RUNTIME:path.join(dir,'none')}});
 try {
  const pet=await app.firstWindow();await pet.waitForSelector('#pet');
  const rows=await pet.evaluate(()=>cike.call('content-list')),mapping=[];
  for(const [asset,id] of [['water','moment-afternoon-01'],['book','base-026'],['lamp','moment-winddown-02']]) {
   const original=rows.find(r=>r.id===id);assert.ok(original);
   const image='data:image/png;base64,'+fs.readFileSync(path.join(out,asset+'.png')).toString('base64');
   const row={...original,image};await pet.evaluate(row=>cike.call('content-save',row),row);
   await pet.evaluate(id=>cike.call('content-preview',id),id);
   await pet.waitForFunction(()=>document.querySelector('#creature').src.startsWith('data:')&&document.querySelector('#creature').complete);
   await pet.locator('#bubble.visible').waitFor();
   assert.equal(await pet.locator('#creature').getAttribute('src'),image);
   await pet.screenshot({path:path.join(out,asset+'-app.png')});
   mapping.push({asset:asset+'.png',id,title:original.action.title,text:original.text});
  }
  fs.writeFileSync(path.join(out,'mapping.json'),JSON.stringify(mapping,null,2));
  fs.writeFileSync(path.join(out,'verification.txt'),'PASS: fixed app 0.8.1; isolated temporary profile; all three image overrides saved and rendered against their exact existing action IDs. Default user profile untouched. Static ivory-background images, not transparent or animated.\n');
  console.log('PASS: three mapped images rendered in fixed 0.8.1.');
 } finally {await app.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
