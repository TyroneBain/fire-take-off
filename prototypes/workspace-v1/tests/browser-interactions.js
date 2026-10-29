async () => {
 const $=id=>document.getElementById(id),q=s=>document.querySelector(s),checks=[];
 const pause=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))),wait=()=>new Promise(r=>setTimeout(r,1200));
 function check(name,ok){checks.push({name,passed:!!ok});if(!ok)throw Error(name);}
 function click(s){q(s).dispatchEvent(new MouseEvent('click',{bubbles:true}));}
 function input(id,value){$(id).value=value;$(id).dispatchEvent(new Event('input',{bubbles:true}));}
 function mode(value){$('arrangement').value=value;$('arrangement').dispatchEvent(new Event('change',{bubbles:true}));}
 function point(x,y){const r=$('canvas').getBoundingClientRect(),v=prototypeSnapshot().view;$('canvas').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+v.ox+x*v.scale,clientY:r.top+v.oy+y*v.scale}));}
 click('#reset-demo');click('#reset-confirm');mode('b');await pause();
 click('[data-action="example"]');click('[data-mark="01-2"]');check('example opens explicit seeded scan preview',!!q('[data-action="run-scan"]'));
 click('[data-action="run-scan"]');click('[data-action="cancel-scan"]');await wait();check('cancelled demo scan preserves state',prototypeSnapshot().events===0&&prototypeSnapshot().tab==='items');
 click('[data-action="example"]');click('[data-mark="01-2"]');click('[data-action="run-scan"]');for(let i=0;i<40&&prototypeSnapshot().tab!=='review';i++)await new Promise(r=>setTimeout(r,100));check('completed demo scan opens seeded review without edits',prototypeSnapshot().tab==='review'&&prototypeSnapshot().events===0);
 click('[data-action="tool"][data-tool="count"]');click('[data-action="example"]');click('[data-mark="01-2"]');click('[data-action="run-scan"]');click('[data-action="tab"][data-tab="items"]');await wait();check('explicit tab navigation cancels pending scan transition',prototypeSnapshot().tab==='items');
 click('[data-action="add"]');point(1080,620);check('canvas coordinate creates manual correction',prototypeSnapshot().totals.raw===13&&prototypeSnapshot().selected==='01-manual-13');click('#undo');check('undo removes manual correction',prototypeSnapshot().totals.raw===12);
 click('[data-action="tool"][data-tool="note"]');point(1000,620);input('note-text','Check this fictional valve');q('[data-form="note"]').requestSubmit();check('note applied at drawing location',q('#marks').textContent.includes('Check this fictional valve'));click('#undo');check('note undo restores drawing',!q('#marks').textContent.includes('Check this fictional valve'));
 click('[data-action="tool"][data-tool="select"]');click('#zoom-in');await pause();
 const before=prototypeSnapshot(),centre=(before.dimensions.canvas[0]/2-before.view.ox)/before.view.scale;
 click('#collapse-inspector');await pause();check('B collapse expands canvas',prototypeSnapshot().dimensions.canvas[0]===1280);click('#toggle-inspector');await pause();const after=prototypeSnapshot();check('B restore preserves drawing centre',Math.abs((after.dimensions.canvas[0]/2-after.view.ox)/after.view.scale-centre)<.001);
 mode('a');await pause();click('#collapse-sheets');click('#collapse-inspector');await pause();check('A both panels collapse',prototypeSnapshot().dimensions.canvas[0]===1280);click('#restore-layout');await pause();check('A restore returns both panels',prototypeSnapshot().dimensions.canvas[0]===718);
 mode('auto');await pause();click('[data-mark="01-2"]');input('factor','3');$('frame').style.width='1440px';await pause();check('auto layout defers panel relocation during edit',prototypeSnapshot().layout==='b'&&$('factor').value==='3');q('[data-form="factor"]').requestSubmit();await pause();check('auto layout applies after edit committed',prototypeSnapshot().layout==='a'&&prototypeSnapshot().totals.allocatedItems===51);$('frame').style.width='';await pause();click('#undo');
 click('#reset-demo');click('#reset-confirm');click('#restore-layout');await pause();
 return {checks,passed:checks.length,method:'DOM interaction scenario in Chrome at 1280x800; not a human usability test',final:prototypeSnapshot()};
}
