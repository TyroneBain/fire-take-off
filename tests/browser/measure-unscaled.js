// Run after measure-zone.js. Checks naming, unscaled truth and switching drawings during a pending save.
async()=>{
 const $=id=>document.getElementById(id),checks=[],check=(v,s)=>{if(!v)throw Error(s);checks.push(s);};
 const wait=async f=>{for(let i=0;i<150;i++){if(await f())return;await new Promise(r=>setTimeout(r,60));}throw Error('Timed out');};
 const state=async()=>await(await fetch('/api/state')).json();
 const p=([x,y])=>{const r=$('pdf-canvas').getBoundingClientRect();$('page-surface').dispatchEvent(new PointerEvent('click',{bubbles:true,clientX:r.left+x*r.width/595,clientY:r.top+(842-y)*r.height/842}));};
 let s=await state();const next=s.drawings.find(d=>d.name==='Level 1.pdf'),ground=s.drawings.find(d=>d.name==='Ground.pdf');
 if($('drawing-title').textContent!==next.name){$('drawing-select').value=next.id;$('drawing-select').dispatchEvent(new Event('change'));}await wait(()=>$('render-status').textContent==='Page 1 · Level 1.pdf');
 $('measure-tool').click();$('measure-type').value='length';$('create-measure').click();p([50,400]);p([350,400]);$('measure-name').value='';$('finish-measure').click();check($('measure-draft-status').textContent==='Enter an item name.'&&(await state()).measurements.length===s.measurements.length,'Blank name retains draft and never creates an unnamed saved record');$('measure-name').value='Unscaled run';
 const original=window.fetch;let release;
 window.fetch=(url,options)=>String(url).endsWith('/measurements')&&options?.method==='POST'?new Promise(r=>{release=()=>original(url,options).then(r);}):original(url,options);
 try{
 $('finish-measure').click();check($('finish-measure').disabled&&$('cancel-measure').disabled,'Pending save disables repeat completion and cancellation');
 $('drawing-select').value=ground.id;$('drawing-select').dispatchEvent(new Event('change'));await wait(()=>$('render-status').textContent==='Page 1 · Ground.pdf');release();
 await wait(async()=>(await state()).measurements.length===s.measurements.length+1&&!$('create-measure').disabled);
 const result=(await state()).measurements.find(m=>m.name==='Unscaled run');check(result.drawing_id===next.id&&result.quantity.value===null,'Late save belongs to original drawing and unscaled length stays unknown');
 check($('measure-draft').hidden&&!$('measure-list').textContent.includes('Unscaled run'),'Late save cannot restore the old draft on another drawing');
 }finally{window.fetch=original;}
 return {passed:checks.length,checks};
}
