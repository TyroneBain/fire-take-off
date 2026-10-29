async () => {
 const $=id=>document.getElementById(id),q=s=>document.querySelector(s),pause=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))),checks=[];
 function check(name,value){checks.push({name,passed:!!value});if(!value)throw Error(name);}
 function click(s){const e=q(s);if(!e)throw Error('Missing '+s);e.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
 function input(id,value){$(id).value=value;$(id).dispatchEvent(new Event('input',{bubbles:true}));}
 function submit(form){q(form).requestSubmit();}
 function mode(value){$('arrangement').value=value;$('arrangement').dispatchEvent(new Event('change',{bubbles:true}));}
 click('#reset-demo');click('#reset-confirm');await pause();
 for(const arrangement of ['a','b']){
  mode(arrangement);await pause();click('[data-mark="01-2"]');
  check(arrangement+': direct selection opens properties',prototypeSnapshot().selected==='01-2'&&prototypeSnapshot().tab==='properties');
  input('factor','3');click('#sheet-title');check(arrangement+': dirty edit prevents context loss',prototypeSnapshot().sheet==='01'&&prototypeSnapshot().dirty);
  click('#study-guide');click('#fail-next');submit('[data-form="factor"]');
  check(arrangement+': simulated failure retains draft and quantities',prototypeSnapshot().totals.allocatedItems===48&&$('factor').value==='3'&&prototypeSnapshot().error.includes('Simulated'));
  submit('[data-form="factor"]');check(arrangement+': retry commits demo correction',prototypeSnapshot().totals.allocatedItems===51&&!prototypeSnapshot().dirty);
  click('#undo');check(arrangement+': undo restores quantity',prototypeSnapshot().totals.allocatedItems===48);
  click('#redo');check(arrangement+': redo restores correction',prototypeSnapshot().totals.allocatedItems===51);click('#undo');
  click('[data-action="exclude"]');check(arrangement+': exclusion changes allocation and pending',prototypeSnapshot().totals.allocatedItems===42&&prototypeSnapshot().totals.pending===2);
  click('[data-action="restore"]');check(arrangement+': restore requires review',prototypeSnapshot().totals.allocatedItems===48&&prototypeSnapshot().totals.pending===3);click('#undo');click('#undo');
 }
 mode('auto');await pause();
 click('#zoom-in');const previous=prototypeSnapshot().view.scale;click('#sheet-title');click('[data-action="sheet"][data-id="02"]');await pause();click('#sheet-title');click('[data-action="sheet"][data-id="01"]');await pause();check('drawing switch restores zoom',Math.abs(prototypeSnapshot().view.scale-previous)<1e-8);
 click('#focus-mode');await pause();check('maximise expands canvas',prototypeSnapshot().focus&&prototypeSnapshot().dimensions.canvas[0]===prototypeSnapshot().dimensions.frame[0]);click('#focus-mode');await pause();check('restore preserves zoom',Math.abs(prototypeSnapshot().view.scale-previous)<1e-8);
 click('[data-action="tool"][data-tool="zone"]');input('zone-east','2');submit('[data-form="zone-factor"][data-zone="east"]');check('zone factor contribution',prototypeSnapshot().totals.allocatedItems===44);click('[data-action="zone-order"]');check('overlap priority contribution',prototypeSnapshot().totals.allocatedItems===40);click('#undo');click('#undo');
 click('[data-action="tool"][data-tool="select"]');
 for(const id of ['01-2','01-5','01-7']){click(`[data-mark="${id}"]`);click('[data-action="accept"]');}
 check('first drawing reviewed but project still blocked',prototypeSnapshot().totals.pending===0&&!prototypeSnapshot().readiness.eligible);
 click('#export-open');click('[data-action="resolve"]');await pause();check('reconciliation routes to next drawing review',prototypeSnapshot().sheet==='02'&&prototypeSnapshot().tab==='review');click('[data-action="accept"]');click('#export-open');click('[data-action="resolve"]');await pause();check('reconciliation routes to scale blocker',prototypeSnapshot().sheet==='RF'&&prototypeSnapshot().tool==='measure');
 input('known-distance','10');submit('[data-form="calibrate"]');check('all blockers resolved, advisories separate',prototypeSnapshot().readiness.eligible&&prototypeSnapshot().readiness.unchecked===3);
 click('#export-open');let captured=null;const originalURL=URL.createObjectURL,originalClick=HTMLAnchorElement.prototype.click;URL.createObjectURL=b=>{captured=b;return originalURL(b)};HTMLAnchorElement.prototype.click=function(){};
 try{click('[data-action="download"]');}finally{URL.createObjectURL=originalURL;HTMLAnchorElement.prototype.click=originalClick;}
 const csv=await captured.text();check('CSV contains fictional disclaimer and reconciled all-sheet quantities',csv.includes('FICTIONAL DATA ONLY')&&csv.includes('FP-101,C,12,18,48,72,0')&&csv.includes('FP-103,A,12,18,48,72,0'));
 click('[data-action="back"]');click('#reset-demo');click('#reset-confirm');await pause();check('reset restores seed and clears edits',prototypeSnapshot().events===0&&prototypeSnapshot().totals.pending===3);
 return {checks,passed:checks.length,csvDownload:'Blob contents checked; file download suppressed by test',final:prototypeSnapshot()};
}
