async()=>{
 const $=id=>document.getElementById(id),checks=[],engines=[],check=(v,label)=>{if(!v)throw Error(label);checks.push(label);};
 const NativeWorker=window.Worker;window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.addEventListener('message',e=>{if(e.data.engine)engines.push({engine:e.data.engine,fallback:e.data.fallbackReason});});}};
 const state=async()=>await(await fetch('/api/state')).json(),wait=async(fn,label)=>{for(let i=0;i<400;i++){if(await fn())return;await new Promise(r=>setTimeout(r,50));}throw Error('Timeout: '+label+' '+$('count-progress')?.textContent);};
 const open=async name=>{await wait(()=>[...document.querySelectorAll('button')].some(e=>e.checkVisibility()&&e.textContent.includes(name)),name);[...document.querySelectorAll('button')].find(e=>e.checkVisibility()&&e.textContent.includes(name)).click();};
 await open('Vector acceptance');await open('Original revisions');await open('vector.pdf');await wait(()=>$('render-status').textContent==='Page 1 · vector.pdf','PDF');
 $('count-options').open=true;$('count-vector').checked=true;
 const r=$('pdf-canvas').getBoundingClientRect();for(const[type,x,y]of [['pointerdown',88,88],['pointermove',112,112],['pointerup',112,112]])$('page-surface').dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:8,button:0,buttons:type==='pointerup'?0:1,clientX:r.left+x*r.width/595,clientY:r.top+(842-y)*r.height/842}));
 await wait(async()=>(await state()).countExamples.length===1&&$('cancel-match').hidden,'initial count');let s=await state();
 check(s.countMarks.length===6,'All six declared symbols found on a page with distant text');
 check(engines.length===1&&engines[0].engine==='vector','Actual browser worker uses vector recognition with rendered text bounds: '+JSON.stringify(engines));
 check(!engines[0].fallback,'No hidden raster fallback for distant labels');
 check(s.countExamples[0].example.algorithm==='vector-elements-1','Vector policy saved');
 const corrected=s.countMarks.find(m=>Math.abs(m.x-100)<1&&Math.abs(m.y-100)<1);document.querySelector(`[data-mark-id="${corrected.id}"]`).click();$('match-included').checked=false;$('match-form').requestSubmit();await wait(async()=>!(await state()).countMarks.find(m=>m.id===corrected.id).included&&!$('match-dialog').open,'exclude');
 const before=await state();window.confirm=()=>true;$('recount-drawing').click();await wait(()=>engines.length===2&&$('cancel-match').hidden,'drawing recount');s=await state();
 check(engines[1].engine==='vector','Saved drawing recount also resolves distant text before vector matching');
 check(s.countMarks.length===6,'Drawing recount adds no duplicate marks');
 check(JSON.stringify(s.countMarks.find(m=>m.id===corrected.id))===JSON.stringify(before.countMarks.find(m=>m.id===corrected.id)),'Drawing recount preserves reviewed exclusion exactly');
 check(s.countMarks.filter(m=>m.included).length===5,'Included quantity retains manual correction');
 return {passed:checks.length,checks,engines,scope:'Owned six-symbol fixture; no real-drawing or competitor accuracy claim'};
}
