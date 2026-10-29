// Run as an async function expression in the isolated owned acceptance server.
// Requires a fresh store from scripts/prepare-drawing-first-acceptance.mjs; open Ground.pdf.
async () => {
 const $=id=>document.getElementById(id),checks=[];
 const check=(value,name)=>{if(!value)throw Error(name);checks.push(name);};
 const wait=async(fn,label)=>{for(let i=0;i<150;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+label);};
 const state=async()=>await(await fetch('/api/state')).json();
 const drag=(bounds)=>{const c=$('pdf-canvas').getBoundingClientRect(),surface=$('page-surface');for(const [type,x,y] of [['pointerdown',bounds[0],bounds[1]],['pointermove',bounds[2],bounds[3]],['pointerup',bounds[2],bounds[3]]])surface.dispatchEvent(new PointerEvent(type,{clientX:c.left+x*c.width/595,clientY:c.top+(842-y)*c.height/842,bubbles:true,pointerId:9,button:0,buttons:type==='pointerup'?0:1}));};
 const stable=async()=>{await wait(()=>$('cancel-match').hidden,'matching finishes');};
 let s=await state();if(s.countItems.length===0){drag([90,90,110,110]);await stable();s=await state();}check(s.countItems.length===1&&s.countMarks.length===12,'Direct unnamed selection counted twelve known symbols');
 const first=s.countItems[0],ground=s.drawings.find(d=>d.name==='Ground.pdf'),control=s.drawings.find(d=>d.name==='Control.pdf');
 check(s.countMarks.filter(m=>m.drawing_id===ground.id).length===6&&!s.countMarks.some(m=>m.drawing_id===control.id),'Six per drawing and other discipline untouched');
 for(const d of s.drawings.filter(d=>d.id!==control.id)){
  const expected=d.name==='Ground.pdf'?[[100,100],[200,100],[300,100],[100,200],[200,200],[300,200]]:[[200,100],[300,100],[100,200],[200,200],[300,200],[350,150]];
  check(expected.every(([x,y])=>s.countMarks.some(m=>m.drawing_id===d.id&&Math.hypot(m.x-x,m.y-y)<1)),d.name+' independently declared centres');
 }
 $('edit-count-item').click();$('item-name').value='Sprinkler heads';$('item-form').requestSubmit();
 await wait(async()=>!( $('item-dialog').open)&&(await state()).countItems[0].name==='Sprinkler heads','rename');check(true,'Rename persists without recount');
 const excluded=s.countMarks.find(m=>m.drawing_id===ground.id);
 document.querySelector(`[data-mark-id="${excluded.id}"]`).click();$('match-included').checked=false;$('match-form').requestSubmit();
 await wait(async()=>!(await state()).countMarks.find(m=>m.id===excluded.id).included&&!$('match-dialog').open,'exclude');
 drag([190,90,210,110]);await stable();s=await state();
 check(s.countItems.length===1&&s.countMarks.length===12,'Additional example does not duplicate marks');
 check(!s.countMarks.find(m=>m.id===excluded.id).included&&s.countMarks.find(m=>m.id===excluded.id).reviewed,'Reviewed exclusion survives additional example');
 check(s.countExamples.length===2,'Both examples retained under one heading');
 $('select-example').click();const before=JSON.stringify(await state());drag([390,290,410,310]);await stable();
 check(JSON.stringify(await state())===before,'Empty-symbol failure leaves saved state unchanged');
 $('select-example').click();drag([90,90,110,110]);$('cancel-match').click();await stable();
 check(JSON.stringify(await state())===before,'Cancelled matching creates no heading or partial results');
 $('count-scope').value='drawing';$('select-example').click();drag([90,90,110,110]);await stable();s=await state();
 const second=s.countItems.find(i=>i.id!==first.id);check(second?.name==='Symbol 1'&&s.countMarks.filter(m=>m.item_id===second.id).length===6,'New symbol and drawing-only scope stay separate');
 const beforeView=JSON.stringify(s),rect=$('drawing-stage').getBoundingClientRect();$('toggle-task-panel').click();
 check($('task-panel').hidden&&$('drawing-stage').getBoundingClientRect().width>rect.width,'Panel collapse returns space to the drawing');$('toggle-task-panel').click();
 for(const tool of ['measure','zone','note','layout','page','count']){$(tool+'-tool').click();check($(tool+'-tool').getAttribute('aria-pressed')==='true',tool+' remains available in task panel');}
 check(JSON.stringify(await state())===beforeView,'Switching tools and panels leaves quantities unchanged');
 $('select-example').click();const stage=$('drawing-stage'),canvas=$('pdf-canvas').getBoundingClientRect();
 document.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true}));
 stage.dispatchEvent(new PointerEvent('pointerdown',{clientX:canvas.left+60,clientY:canvas.top+80,pointerId:10,button:0,bubbles:true}));
 stage.dispatchEvent(new PointerEvent('pointermove',{clientX:canvas.left+80,clientY:canvas.top+100,pointerId:10,button:0,bubbles:true}));
 stage.dispatchEvent(new PointerEvent('pointerup',{pointerId:10,button:0,bubbles:true}));
 document.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space',bubbles:true}));
 check($('cancel-match').hidden&&JSON.stringify(await state())===beforeView,'Space pan never starts counting');
 return {passed:checks.length,checks,headingNames:(await state()).countItems.map(i=>i.name),marks:(await state()).countMarks.length};
}
