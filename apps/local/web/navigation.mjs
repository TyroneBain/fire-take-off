export function wheelZoomFactor(delta,mode=0) {
  const pixels=delta*(mode===1?16:mode===2?600:1);
  return Math.exp(-Math.max(-200,Math.min(200,pixels))*.002);
}

export function setupDrawingNavigation({stage,viewer,navigationMode,zoom,beforePan,shortcuts,onError}) {
  let space=false,pan=null,suppressClick=false,pendingZoom=null,zooming=false;
  const editable=target=>target.closest?.('input,textarea,select,[contenteditable]');
  const available=()=>!viewer.hidden&&!document.querySelector('dialog[open]');
  function cursor(){stage.classList.toggle('pan-ready',space);stage.classList.toggle('panning',!!pan);}
  function endPan(){if(pan){try{stage.releasePointerCapture(pan.id);}catch{}pan=null;}cursor();}
  document.addEventListener('keydown',event=>{
    if(!available()||editable(event.target))return;
    if(event.code==='Space'){event.preventDefault();space=true;cursor();}
    else if(space&&shortcuts[event.key]){event.preventDefault();event.stopImmediatePropagation();shortcuts[event.key]();}
  },true);
  document.addEventListener('keyup',event=>{if(event.code==='Space'){space=false;cursor();}},true);
  window.addEventListener('blur',()=>{space=false;pendingZoom=null;endPan();});
  stage.addEventListener('pointerdown',event=>{
    suppressClick=false;
    if(!available()||!(event.button===1||event.button===0&&(space||navigationMode())))return;
    if(event.target.closest('button')&&!space&&event.button!==1)return;
    event.preventDefault();event.stopImmediatePropagation();beforePan();pendingZoom=null;
    pan={id:event.pointerId,x:event.clientX,y:event.clientY,left:stage.scrollLeft,top:stage.scrollTop};suppressClick=true;
    try{stage.setPointerCapture(event.pointerId);}catch{}cursor();
  },true);
  stage.addEventListener('pointermove',event=>{
    if(!pan||event.pointerId!==pan.id)return;event.preventDefault();event.stopImmediatePropagation();
    stage.scrollTo(pan.left+pan.x-event.clientX,pan.top+pan.y-event.clientY);
  },true);
  for(const type of ['pointerup','pointercancel'])stage.addEventListener(type,event=>{
    if(!pan||event.pointerId!==pan.id)return;event.preventDefault();event.stopImmediatePropagation();endPan();
  },true);
  for(const type of ['click','auxclick','dblclick'])stage.addEventListener(type,event=>{
    if(space||pan||suppressClick){event.preventDefault();event.stopImmediatePropagation();if(type!=='dblclick')suppressClick=false;}
  },true);
  async function drainZoom(){
    if(zooming)return;zooming=true;
    try{while(pendingZoom){const next=pendingZoom;pendingZoom=null;await zoom(next.factor,next.x,next.y);}}
    catch(error){pendingZoom=null;onError(error);}
    finally{zooming=false;}
  }
  stage.addEventListener('wheel',event=>{
    if(!available()||!event.ctrlKey&&!event.metaKey)return;
    event.preventDefault();event.stopImmediatePropagation();
    pendingZoom={factor:(pendingZoom?.factor||1)*wheelZoomFactor(event.deltaY,event.deltaMode),x:event.clientX,y:event.clientY};drainZoom();
  },{capture:true,passive:false});
}
