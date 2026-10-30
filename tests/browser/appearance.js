async()=>{
 const $=id=>document.getElementById(id),checks=[],check=(v,label)=>{if(!v)throw Error(label);checks.push(label);};
 const state=async()=>await(await fetch('/api/state')).json(),wait=async(fn,label)=>{for(let i=0;i<900;i++){if(await fn())return;await new Promise(r=>setTimeout(r,50));}throw Error('Timeout: '+label+' '+$('count-progress')?.textContent);};
 const idle=()=>!$('select-example').disabled&&$('cancel-match').hidden;
 const open=async name=>{await wait(()=>[...document.querySelectorAll('button')].some(e=>e.checkVisibility()&&e.textContent.includes(name)),name);[...document.querySelectorAll('button')].find(e=>e.checkVisibility()&&e.textContent.includes(name)).click();};
 await open('Rotation acceptance');await open('Original revisions');await open('base.pdf');await wait(()=>$('render-status').textContent==='Page 1 · base.pdf','PDF');
 check(!$('count-appearance').checked,'Appearance matching is off by default');
 $('count-options').open=true;$('count-appearance').checked=true;$('count-appearance').dispatchEvent(new Event('change',{bubbles:true}));$('count-scope').value='drawing';
 check(!$('count-vector').checked&&!$('count-scales').checked,'Appearance does not silently combine vector or scale policies');
 const pointer=(type,x,y)=>{const r=$('pdf-canvas').getBoundingClientRect();$('page-surface').dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:8,button:0,buttons:type==='pointerup'?0:1,clientX:r.left+x*r.width/500,clientY:r.top+(560-y)*r.height/560}));};
 const drag=()=>{pointer('pointerdown',58,86);pointer('pointermove',82,114);pointer('pointerup',82,114);};
 const start=performance.now();drag();await wait(async()=>(await state()).countExamples.length===1&&idle(),'appearance initial count');let s=await state();const initialMs=performance.now()-start;
 check(s.countMarks.length===12,'Appearance finds all 12 declared quarter-turn symbols without distractors');
 check(s.countExamples[0].example.algorithm==='appearance-rgb-1','Appearance policy is saved explicitly');
 const drawing=s.drawings.find(d=>d.name==='base.pdf');check(s.countMarks.every(m=>m.drawing_id===drawing.id),'Drawing scope leaves the other drawing untouched');
 for(let row=0;row<3;row++)for(let col=0;col<4;col++){const x=70+col*100+(row===1?.5:0),y=100+row*90+(row===1?.5:0);check(s.countMarks.filter(m=>Math.abs(m.x-x)<.1&&Math.abs(m.y-y)<.1).length===1,`Appearance native anchor ${row},${col} is exact`);}
 const corrected=s.countMarks.find(m=>m.x===170&&m.y===100);document.querySelector(`[data-mark-id="${corrected.id}"]`).click();$('match-included').checked=false;$('match-form').requestSubmit();await wait(async()=>!(await state()).countMarks.find(m=>m.id===corrected.id).included&&!$('match-dialog').open,'exclude');const saved=(await state()).countMarks.find(m=>m.id===corrected.id);
 window.confirm=()=>true;$('recount-drawing').click();await wait(idle,'appearance recount');s=await state();check(s.countMarks.length===12&&s.countMarks.filter(m=>m.included).length===11,'Appearance recount preserves reconciled quantity');check(JSON.stringify(s.countMarks.find(m=>m.id===corrected.id))===JSON.stringify(saved),'Reviewed exclusion retains exact identity and decision');
 $('item-actions').open=true;$('add-manual-match').click();pointer('click',70.25,490.25);await wait(async()=>(await state()).countMarks.some(m=>m.origin==='manual'),'manual miss');const manual=(await state()).countMarks.find(m=>m.origin==='manual');$('recount-drawing').click();await wait(idle,'manual-preserving recount');s=await state();check(s.countMarks.length===13&&s.countMarks.filter(m=>m.included).length===12,'Manual correction survives appearance recount');check(JSON.stringify(s.countMarks.find(m=>m.id===manual.id))===JSON.stringify(manual),'Manual mark is unchanged');
 const marks=JSON.stringify(s.countMarks),picker=document.querySelector(`[data-item-id="${s.countItems[0].id}"] .count-colour`);picker.open=true;picker.querySelector('[aria-label="Red"]').click();await wait(async()=>(await state()).countItems[0].color==='#df3046','colour');check(JSON.stringify((await state()).countMarks)===marks,'Changing colour preserves appearance quantities and review decisions');
 const before=JSON.stringify(await state());$('select-example').click();drag();$('cancel-match').click();await wait(idle,'appearance cancellation');check(JSON.stringify(await state())===before,'Cancelling appearance count saves no partial results');
 return {passed:checks.length,checks,initialMs,totalMarks:13,scope:'Original generated PDF; no real-drawing accuracy claim'};
}
