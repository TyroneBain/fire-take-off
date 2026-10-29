async () => {
 const $=id=>document.getElementById(id),q=s=>document.querySelector(s),checks=[];
 const pause=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 const click=s=>q(s).click(),check=(name,ok)=>{checks.push({name,passed:!!ok});if(!ok)throw Error(name);};
 const input=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new Event('input',{bubbles:true}));};
 click('#reset-demo');click('#reset-confirm');$('arrangement').value='compact';$('arrangement').dispatchEvent(new Event('change',{bubbles:true}));await pause();
 check('Count is initial tool; primary action available',prototypeSnapshot().tool==='count'&&!!q('#tool-context .primary[data-action="example"]'));
 check('drawing review distinct from project export blockers',$('review-quick').textContent.includes('3 on this drawing')&&$('global-pending').textContent==='4 reviews · 1 scale');
 check('quantity breakdown starts collapsed',!$('quantity-details').open);click('[data-action="quantities"]');check('quantity explanation remains available',$('quantity-details').open&&$('quantity-details').textContent.includes('Included items'));
 input('class-search','valve');check('classification search filters without changing totals',q('[data-category="valve"]')&&!q('[data-category="head"]')&&prototypeSnapshot().totals.allocatedItems===48);input('class-search','');
 click('[data-action="tool"][data-tool="measure"]');$('zoom-level').value='.8';$('zoom-level').value='0.8';$('zoom-level').dispatchEvent(new Event('change',{bubbles:true}));await pause();
 const before=prototypeSnapshot(),right=$('inspector').getBoundingClientRect().x;
 click('#launch-drawings');await pause();check('chooser overlays without moving canvas or right inspector',prototypeSnapshot().chooserOpen&&prototypeSnapshot().dimensions.canvas[0]===before.dimensions.canvas[0]&&$('inspector').getBoundingClientRect().x===right&&prototypeSnapshot().view.scale===before.view.scale);
 input('sheet-search','FP-102');$('sheet-search').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await pause();check('search Enter switches sheet and preserves active tool',prototypeSnapshot().sheet==='02'&&prototypeSnapshot().tool==='measure'&&!prototypeSnapshot().chooserOpen);
 input('sheet-search','');click('#prev-sheet');await pause();check('previous drawing restores exact zoom',prototypeSnapshot().sheet==='01'&&prototypeSnapshot().view.scale===.8);
 click('#launch-drawings');$('sheet-search').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));check('Escape closes chooser and returns focus',!prototypeSnapshot().chooserOpen&&document.activeElement.id==='sheet-title');
 click('#launch-drawings');$('canvas').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));check('outside pointer dismisses chooser',!prototypeSnapshot().chooserOpen);
 click('#toggle-inspector');await pause();check('inspector collapse retains drawing launcher',getComputedStyle($('drawing-launcher')).display!=='none'&&prototypeSnapshot().dimensions.canvas[0]===innerWidth-48);click('#toggle-inspector');await pause();check('inspector restores on right',$('inspector').getBoundingClientRect().right===innerWidth);
 $('right-split').dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));await pause();check('right inspector resizes to upper limit',$('inspector').clientWidth===420);click('#restore-layout');
 click('#reset-demo');click('#reset-confirm');$('arrangement').value='auto';$('arrangement').dispatchEvent(new Event('change',{bubbles:true}));await pause();
 return {passed:checks.length,checks,method:'Automated DOM events; not an estimator usability study'};
}
