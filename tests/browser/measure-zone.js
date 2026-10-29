// Run against a fresh owned fixture server with Ground.pdf open, at rotation 0.
async () => {
 const $=id=>document.getElementById(id),checks=[];
 const check=(v,label)=>{if(!v)throw Error(label);checks.push(label);};
 const wait=async(fn,label)=>{for(let i=0;i<150;i++){if(await fn())return;await new Promise(r=>setTimeout(r,60));}throw Error('Timeout: '+label);};
 const state=async()=>await(await fetch('/api/state')).json();
 const surface=$('page-surface'),point=(p,type='click')=>{const r=$('pdf-canvas').getBoundingClientRect();surface.dispatchEvent(new PointerEvent(type,{bubbles:true,button:type==='contextmenu'?2:0,clientX:r.left+p[0]*r.width/595,clientY:r.top+(842-p[1])*r.height/842}));};
 const key=k=>document.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
 const start=kind=>{$('measure-type').value=kind;$('measure-type').dispatchEvent(new Event('change'));$('create-measure').click();};
 const saved=async n=>{await wait(async()=>(await state()).measurements.length===n&&!$('cancel-measure').disabled,'measurement save');};
 const originalFetch=window.fetch;
 try{
 $('measure-tool').click();point([50,400]);let s=await state();check(!s.measurements.length,'Independent fixture has no measurements');
 const baseline=JSON.stringify(s);start('length');check($('measure-name').value==='Length 1'&&!$('measure-draft').hidden,'Create starts unnamed length without a prerequisite form');
 point([50,400]);point([350,400]);point([350,600],'pointermove');check($('measurement-draft-overlay').querySelector('polyline').getAttribute('points').split(' ').length===3,'Cursor preview includes the next segment');
 key('Backspace');check($('finish-measure').disabled,'Backspace removes the last draft vertex');key('Escape');check($('measure-draft').hidden&&JSON.stringify(await state())===baseline,'Escape discards draft without saved changes');
 $('calibrate').click();point([50,400]);point([350,400]);check($('calibration-dialog').open,'Two endpoints open known-distance calibration');$('known-distance').value=30;$('known-unit').value='m';$('calibration-form').requestSubmit();await wait(async()=>!$('calibration-dialog').open&&(await state()).calibrations.length===1,'calibration');check(Math.abs((await state()).calibrations[0].metres_per_point-.1)<.001,'300 PDF points independently calibrated to 30 metres');
 start('length');point([50,400]);point([350,400]);point([350,600]);point([350,600]);point([350,600],'contextmenu');await saved(1);s=await state();check(s.measurements.length===1&&Math.abs(s.measurements[0].quantity.value-50)<.3,'Click-last/right-click race saves one 50 metre run');
 key('Escape');start('area');[[50,450],[150,450],[150,550],[50,550]].forEach(p=>point(p));point([50,550],'contextmenu');await saved(2);check(Math.abs((await state()).measurements.find(m=>m.kind==='area').quantity.value-100)<2,'Right-click closes independently verified 100 square metre area');
 key('Escape');start('length');point([50,700]);point([150,700]);let reject=true;
 window.fetch=(url,options)=>String(url).endsWith('/measurements')&&options?.method==='POST'&&reject?(reject=false,Promise.resolve(new Response(JSON.stringify({error:'Injected measurement conflict'}),{status:409,headers:{'Content-Type':'application/json'}}))):originalFetch(url,options);
 key('Enter');await wait(()=>$('measure-draft-status').textContent.includes('Injected'),'failure feedback');check((await state()).measurements.length===2&&$('measurement-draft-overlay').querySelectorAll('circle').length===2,'Failed save retains geometry and leaves quantities unchanged');
 window.fetch=originalFetch;key('Enter');await saved(3);check(Math.abs((await state()).measurements.at(-1).quantity.value-10)<.2,'Retry saves exactly one ten metre run');
 key('Escape');key('1');key('c');check($('measure-draft-title').textContent==='Drawing point','Reference type and create keyboard shortcuts');point([100,100]);await saved(4);check((await state()).measurements.at(-1).quantity.value===1,'Manual point saves one unit');key('Escape');
 $('measure-tool').click();const row=[...$('measure-list').children].find(e=>e.textContent.includes('Length 1'));row.querySelector('.measure-open').click();check(!$('measurement-editor').hidden&&$('measure-create').hidden,'Saved measurement opens adjacent editor without competing create controls');$('cancel-measure-edit').click();
 $('zone-tool').click();$('zone-name').value='West';$('create-zone-heading').click();await wait(async()=>(await state()).zoneHeadings.length===1&&document.querySelector('.zone-options'),'zone heading');check(!document.querySelector('.zone-options').open&&!document.querySelector('.zone-quantities').open,'Infrequent zone options and reconciliation disclose locally');
 $('draw-zone').click();[[20,20],[250,20],[250,820]].forEach(p=>point(p));key('Backspace');check($('finish-zone').disabled,'Zone Backspace removes a corner');point([250,820]);point([20,820]);let zoneReject=true;
 window.fetch=(url,options)=>String(url).endsWith('/zones')&&options?.method==='POST'&&zoneReject?(zoneReject=false,Promise.resolve(new Response(JSON.stringify({error:'Injected zone conflict'}),{status:409,headers:{'Content-Type':'application/json'}}))):originalFetch(url,options);
 key('Enter');await wait(()=>$('message').textContent.includes('Injected zone'),'zone failure');check(!(await state()).zones.length&&!$('finish-zone').disabled,'Zone save failure retains editable outline');window.fetch=originalFetch;
 key('Enter');point([20,820],'contextmenu');await wait(async()=>(await state()).zones.length===1&&$('zone-draft-actions').hidden,'zone saved');s=await state();check(s.zones.length===1,'Rapid zone completion writes one outline');
 const length=s.measurements.find(m=>m.name==='Length 1');const rows=s.quantitySchedule.filter(r=>r.source_id===length.id);check(rows.length===1&&Math.abs(rows[0].value-20)<.2,'Zone allocation clips the known 50 metre run to 20 metres');
 const beforeCancel=JSON.stringify(s);$('draw-zone').click();[[0,0],[50,0],[50,50]].forEach(p=>point(p));key('Escape');check($('zone-draft-actions').hidden&&JSON.stringify(await state())===beforeCancel,'Zone cancellation leaves all saved data intact');
 $('measure-tool').click();start('length');point([50,400]);const beforePan=$('measure-draft-status').textContent;document.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true}));point([150,400]);document.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space',bubbles:true}));check($('measure-draft-status').textContent===beforePan,'Space navigation cannot add measurement points');key('Escape');
 return {passed:checks.length,checks,measurements:(await state()).measurements.map(m=>({kind:m.kind,name:m.name,quantity:m.quantity})),zones:(await state()).zones.length};
 }finally{window.fetch=originalFetch;window.measureZoneChecks=checks;}
}
