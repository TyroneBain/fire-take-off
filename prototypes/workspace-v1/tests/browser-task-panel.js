async () => {
 const $=id=>document.getElementById(id),q=s=>document.querySelector(s),checks=[];
 const pause=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 const click=s=>{const e=q(s);if(!e)throw Error('Missing '+s);e.dispatchEvent(new MouseEvent('click',{bubbles:true}));};
 const check=(name,ok)=>{checks.push({name,passed:!!ok});if(!ok)throw Error(name);};
 const input=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new Event('input',{bubbles:true}));};
 function local(selector){const a=q(selector).getBoundingClientRect(),b=$('inspector').getBoundingClientRect();return a.width>0&&a.x>=b.x&&a.right<=b.right&&a.y>=b.y&&a.bottom<=b.bottom;}
 click('#reset-demo');click('#reset-confirm');await pause();
 check('four task families, no distant strip',$('tools').querySelectorAll('button').length===4&&!q('.toolbar')&&$('tools').closest('#inspector'));
 check('Count action and selector share visible work area',local('[data-tool="count"]')&&local('[data-action="example"]'));
 click('[data-action="example"]');check('selection state has one local cancel action',!!q('#tool-context [data-action="cancel-scan"]')&&!q('#tool-context .primary'));click('[data-action="cancel-scan"]');
 click('[data-mark="01-2"]');check('direct selection remains visibly within Count',q('[data-tool="count"]').getAttribute('aria-pressed')==='true'&&prototypeSnapshot().tab==='properties');
 input('factor','3');q('[data-form="factor"]').requestSubmit();check('correction is applied in same work area',prototypeSnapshot().totals.allocatedItems===51&&local('#factor'));click('#undo');
 click('[data-tool="measure"]');check('Measure removes unrelated count controls',$('inspector-tabs').hidden&&$('item-filter').hidden&&!q('[data-action="example"]')&&local('#known-distance'));
 input('known-distance','12');q('[data-form="calibrate"]').requestSubmit();check('measurement calibration gives feedback',Math.abs(prototypeSnapshot().totals.metres-86.4)<1e-8);click('#undo');
 click('[data-tool="zone"]');check('Zone shows local allocation controls',$('inspector-tabs').hidden&&local('#zone-west')&&local('#zone-east'));
 input('zone-east','2');q('[data-form="zone-factor"][data-zone="east"]').requestSubmit();click('[data-action="zone-order"]');check('zone correction and priority reconcile',prototypeSnapshot().totals.allocatedItems===40);click('#undo');click('#undo');
 click('[data-tool="count"]');q('[data-tool="count"]').focus();q('[data-tool="count"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));check('keyboard moves tool and focus together',prototypeSnapshot().tool==='measure'&&document.activeElement.dataset.tool==='measure');
 input('known-distance','15');q('[data-tool="measure"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));check('dirty edit prevents tool change',prototypeSnapshot().tool==='measure'&&$('known-distance').value==='15');click('[data-action="cancel-draft"]');
 click('#toggle-inspector');await pause();check('collapsed work panel has visible global restore',getComputedStyle($('inspector')).visibility==='hidden'&&$('toggle-inspector').getBoundingClientRect().width>0);click('#toggle-inspector');await pause();check('restored panel keeps active tool',prototypeSnapshot().tool==='measure'&&getComputedStyle($('inspector')).visibility==='visible');
 click('#reset-demo');click('#reset-confirm');await pause();return {passed:checks.length,checks,viewport:[innerWidth,innerHeight],canvas:prototypeSnapshot().dimensions.canvas};
}
