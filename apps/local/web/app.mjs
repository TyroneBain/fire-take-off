import {setupZones} from './zone-ui.mjs';
import * as pdfjs from '/vendor/build/pdf.mjs';
import { pagePoint, viewPoint, clientPoint } from './coordinates.mjs';
import { setupDrawingNavigation } from './navigation.mjs';
import { setupTakeoff } from './takeoff-ui.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/build/pdf.worker.mjs';
const $ = id => document.getElementById(id);
let state, token, selectedProject = null, selectedTakeoff = null, createContext;
let pdf, loadingTask, drawing, pageNumber = 1, scale = 1, rotation = 0, renderTask, renderRevision = 0;
let messageTimer;
let resetPan = false;
let activeViewport, noteMode = false, placingNote = false, editingNote = null;
let takeoffUi,zoneUi;
let zoomEpoch=0;
function notice(message, error = false) {
  $('message').textContent = message; $('message').hidden = false; $('message').classList.toggle('error', error);
  clearTimeout(messageTimer); messageTimer = setTimeout(() => { $('message').hidden = true; }, error ? 10000 : 4500);
}
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'X-Fire-Token': token || '', ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Operation failed');
  return data;
}
function node(tag, text, className) { const element = document.createElement(tag); if (text != null) element.textContent = text; if (className) element.className = className; return element; }
function button(text, action, className) { const b = node('button', text, className); b.addEventListener('click', action); return b; }
function children(parent, kind) { return state.entities.filter(e => e.parent_id === parent && e.kind === kind); }
function byId(id) { return state.entities.find(e => e.id === id); }
async function refresh() { state = await api('/api/state'); paint(); takeoffUi?.paint(); zoneUi?.paint(); }
function create(kind, parentId) {
  createContext = { kind, parentId };
  $('dialog-title').textContent = `Create ${kind}`; $('entity-name').value = ''; $('dialog-error').textContent = '';
  $('name-dialog').showModal(); $('entity-name').focus();
}
$('cancel-dialog').onclick = () => $('name-dialog').close();
$('name-form').onsubmit = async event => {
  event.preventDefault(); $('save-name').disabled = true;
  try {
    const item = await api('/api/entities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...createContext, name: $('entity-name').value }) });
    if (item.kind === 'project') { selectedProject = item.id; selectedTakeoff = null; }
    if (item.kind === 'takeoff') selectedTakeoff = item.id;
    closeViewer();
    $('name-dialog').close(); await refresh(); notice(`${item.name} created`);
  } catch (error) { $('dialog-error').textContent = error.message; }
  finally { $('save-name').disabled = false; }
};
$('new-project').onclick = () => create('project', null);
$('project-filter').oninput = () => paintSidebar();
function paintSidebar() {
  const list = $('projects'); list.replaceChildren();
  const filter = $('project-filter').value.toLowerCase();
  for (const p of state.entities.filter(e => e.kind === 'project' && e.name.toLowerCase().includes(filter))) {
    const b = button(p.name, () => { selectedProject = p.id; selectedTakeoff = null; closeViewer(); paint(); }, 'project-link');
    b.classList.toggle('active', p.id === selectedProject); list.append(b);
  }
}
function empty(title, detail, action, label) {
  const div = node('div', null, 'empty'); div.append(node('div', '+', 'empty-icon'), node('h2', title), node('p', detail));
  if (action) div.append(button(label, action, 'primary')); return div;
}
function paint() {
  paintSidebar();
  const project = byId(selectedProject), takeoff = byId(selectedTakeoff);
  $('breadcrumb').textContent = ['Workspace', project?.name, takeoff?.name].filter(Boolean).join('  /  ');
  $('heading').textContent = takeoff?.name || project?.name || 'Your projects';
  $('subtitle').textContent = takeoff ? 'Organise your drawings by discipline. Open a PDF to start reviewing.' : project ? 'Keep each drawing set in its own takeoff.' : 'A clear view of every drawing, from the first page onwards.';
  const actions = $('actions'); actions.replaceChildren();
  const content = $('content'); content.replaceChildren();
  if (takeoff) {
    actions.append(button('← Takeoffs', () => { selectedTakeoff = null; paint(); }), button('Export Excel', async()=>{try{const response=await fetch(`/api/takeoffs/${takeoff.id}/workbook`);if(!response.ok)throw new Error((await response.json()).error);const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download='Fire-Take-Off-quantities.xlsx';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);notice('Quantity workbook downloaded');}catch(error){notice(error.message,true);}}), button('+ New discipline', () => create('discipline', takeoff.id), 'primary'));
    const disciplines = children(takeoff.id, 'discipline');
    if (!disciplines.length) content.append(empty('Make room for your drawings', 'Create a discipline to keep related drawings together.', () => create('discipline', takeoff.id), 'Create discipline'));
    for (const discipline of disciplines) {
      const heading = node('div', null, 'discipline-heading'); heading.append(node('h2', discipline.name), button('+ Import PDF', () => choosePdf(discipline.id)));
      content.append(heading);
      const drawings = state.drawings.filter(d => d.discipline_id === discipline.id);
      if (!drawings.length) content.append(empty('No drawings yet', 'Import an original PDF from your computer. Up to 25 MiB and 200 pages per file.', () => choosePdf(discipline.id), 'Import PDF'));
      const cards = node('div', null, 'cards');
      for (const d of drawings) {
        const card = node('article', null, 'card drawing-card');
        const open = button('', () => openDrawing(d), 'open-card');
        const firstMetadata=state.pageMetadata?.find(p=>p.drawing_id===d.id&&p.number===1);
        const label=d.pages.length===1&&firstMetadata?.name!=='Page 1' ? firstMetadata?.name || d.name : d.name;
        const info = node('div', null, 'drawing-info'); info.append(node('h2', label), node('p', `${label!==d.name ? d.name+' · ' : ''}${d.pages.length} page${d.pages.length === 1 ? '' : 's'} · ${(d.bytes / 1024).toFixed(1)} KB`));
        open.append(node('div', '▤', 'drawing-preview'), info); card.append(open);
        const foot = node('div', null, 'drawing-info card-foot'); foot.append(node('span', 'Ready to review'), button('Remove', () => removeDrawing(d), 'remove')); card.append(foot); cards.append(card);
      }
      content.append(cards);
    }
  } else {
    const kind = project ? 'takeoff' : 'project';
    actions.append(button(`+ New ${kind}`, () => create(kind, project?.id ?? null), 'primary'));
    const items = project ? children(project.id, 'takeoff') : state.entities.filter(e => e.kind === 'project');
    if (!items.length) content.append(empty(project ? 'Start your first takeoff' : 'A fresh start for your next project', project ? 'Create a takeoff, organise disciplines and bring in your drawings.' : 'Create a project to keep your drawing sets organised and ready to review.', () => create(kind, project?.id ?? null), `Create ${kind}`));
    const cards = node('div', null, 'cards');
    for (const item of items) {
      const card = node('article', null, 'card'); const open = button('', () => { if (project) selectedTakeoff = item.id; else { selectedProject = item.id; selectedTakeoff = null; } paint(); }, 'open-card');
      const count = children(item.id, project ? 'discipline' : 'takeoff').length;
      open.append(node('span', project ? '▤' : '□', 'card-icon'), node('h2', item.name), node('p', `${count} ${project ? 'discipline' : 'takeoff'}${count === 1 ? '' : 's'}`), node('div', 'Open workspace →', 'card-foot'));
      card.append(open); cards.append(card);
    }
    content.append(cards);
  }
}
let uploadDiscipline;
function choosePdf(id) { uploadDiscipline = id; $('pdf-input').value = ''; $('pdf-input').click(); }
$('pdf-input').onchange = async () => {
  const file = $('pdf-input').files[0]; if (!file) return;
  if (file.size > 25 * 1024 * 1024) return notice('This PDF exceeds the local 25 MiB limit.', true);
  $('content').classList.add('loading'); notice(`Importing ${file.name}…`);
  try { await api(`/api/disciplines/${uploadDiscipline}/drawings?name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'Content-Type': 'application/pdf' }, body: file }); await refresh(); notice(`${file.name} imported`); }
  catch (error) { notice(error.message, true); }
  finally { $('content').classList.remove('loading'); }
};
async function removeDrawing(d) {
  $('delete-dialog').returnValue = '';
  $('delete-dialog').showModal();
  $('delete-dialog').onclose = async () => {
    if ($('delete-dialog').returnValue !== 'delete') return;
    try { await api(`/api/drawings/${d.id}`, { method: 'DELETE' }); await refresh(); notice('Drawing removed'); }
    catch (error) { notice(error.message, true); }
  };
}
async function openDrawing(d, targetPage=1, tool=null) {
  const generation = ++renderRevision;
  renderTask?.cancel(); await loadingTask?.destroy(); pdf = null;
  if (generation !== renderRevision) return;
  $('hide-source').checked = false; $('page-surface').classList.remove('source-hidden');
  drawing = d; pageNumber = Math.max(1,Math.min(d.pages.length,targetPage)); rotation = 0;
  activeViewport = null; setNoteMode(false);
  resetPan = true;
  $('workspace').hidden = true; $('viewer').hidden = false; $('drawing-title').textContent = d.name;
  $('render-status').textContent = 'Opening drawing…'; $('pdf-canvas').hidden = true;
  try {
    const task = pdfjs.getDocument({ url: `/api/drawings/${d.id}/source`, isEvalSupported: false, cMapUrl: '/vendor/cmaps/', cMapPacked: true, standardFontDataUrl: '/vendor/standard_fonts/', wasmUrl: '/vendor/wasm/' });
    loadingTask = task;
    const loaded = await task.promise;
    if (generation !== renderRevision) { await task.destroy(); return; }
    pdf = loaded; await fitWidth(); if(tool)takeoffUi.activate(tool);
  } catch (error) { if (generation === renderRevision) { $('render-status').textContent = 'Unable to display this PDF'; notice(error.message, true); } }
}
async function render() {
  if (!pdf) return;
  const generation = ++renderRevision;
  renderTask?.cancel();
  activeViewport = null; $('note-overlay')?.remove(); $('takeoff-overlay')?.remove(); $('zone-overlay')?.remove();
  $('render-status').textContent = 'Rendering page…';
  try {
    const page = await pdf.getPage(pageNumber); if (generation !== renderRevision) return;
    const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
    const outputScale = Math.min(window.devicePixelRatio || 1, 2);
    // Bounded canvas allocation: zoom stays available without exceeding this surface budget.
    const factor = Math.min(outputScale, Math.sqrt(16000000 / (viewport.width * viewport.height)));
    const canvas = document.createElement('canvas'); canvas.setAttribute('aria-label', 'PDF drawing page');
    canvas.width = Math.max(1, Math.floor(viewport.width * factor)); canvas.height = Math.max(1, Math.floor(viewport.height * factor));
    canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
    renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport, transform: [factor,0,0,factor,0,0] });
    await renderTask.promise; if (generation !== renderRevision) return;
    canvas.id = 'pdf-canvas'; $('page-surface').replaceChildren(canvas);
    activeViewport = viewport; paintNotes(); paintPage(); takeoffUi?.paint(); zoneUi?.paint();
    if (resetPan) { $('drawing-stage').scrollTo(0,0); resetPan = false; }
    $('page-label').textContent = `${pageNumber} / ${pdf.numPages}`; $('zoom-label').textContent = `${Math.round(scale * 100)}%`;
    $('previous-page').disabled = pageNumber <= 1; $('next-page').disabled = pageNumber >= pdf.numPages;
    $('render-status').textContent = `Page ${pageNumber} · ${drawing.name}`;
    page.cleanup();
  } catch (error) { if (error.name !== 'RenderingCancelledException' && generation === renderRevision) { $('render-status').textContent = 'Rendering failed'; notice(error.message, true); } }
}
async function fitWidth() { if (!pdf) return; const page = await pdf.getPage(pageNumber); const view = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 }); scale = Math.max(.1, Math.min(4, ($('drawing-stage').clientWidth - 60) / view.width)); await render(); }
function closeViewer() { ++renderRevision; renderTask?.cancel(); loadingTask?.destroy(); loadingTask = null; pdf = null; activeViewport = null; takeoffUi?.deactivate(); zoneUi?.deactivate(); $('viewer').hidden = true; $('workspace').hidden = false; }
$('close-viewer').onclick = closeViewer;
$('hide-source').onchange = () => $('page-surface').classList.toggle('source-hidden', $('hide-source').checked);
$('previous-page').onclick = () => { if (pdf && pageNumber > 1) { takeoffUi?.clearDraft(); zoneUi?.clearDraft(); pageNumber--; resetPan = true; render(); } };
$('next-page').onclick = () => { if (pdf && pageNumber < pdf.numPages) { takeoffUi?.clearDraft(); zoneUi?.clearDraft(); pageNumber++; resetPan = true; render(); } };
async function zoomAt(factor,x,y) {
  if(!pdf||!activeViewport||!Number.isFinite(factor)||factor<=0)return;
  const stage=$('drawing-stage'),rect=stage.getBoundingClientRect();
  x??=rect.left+stage.clientWidth/2;y??=rect.top+stage.clientHeight/2;
  const anchor=pagePoint(activeViewport,$('pdf-canvas').getBoundingClientRect(),x,y),next=Math.max(.1,Math.min(4,activeViewport.scale*factor));
  if(next===scale)return;
  const epoch=zoomEpoch,expected=renderRevision+1;scale=next;await render();
  if(epoch!==zoomEpoch||renderRevision!==expected||!activeViewport)return;
  const [newX,newY]=clientPoint(activeViewport,$('pdf-canvas').getBoundingClientRect(),...anchor);
  stage.scrollBy(newX-x,newY-y);
}
$('zoom-in').onclick = () => zoomAt(1.25).catch(e=>notice(e.message,true));
$('zoom-out').onclick = () => zoomAt(1/1.25).catch(e=>notice(e.message,true));
setupDrawingNavigation({stage:$('drawing-stage'),viewer:$('viewer'),navigationMode:()=>$('pan-tool').getAttribute('aria-pressed')==='true',zoom:zoomAt,beforePan:()=>{zoomEpoch++;},onError:e=>notice(e.message,true),shortcuts:{
  '1':()=>$('count-tool').click(),'2':()=>$('measure-tool').click(),'3':()=>$('zone-tool').click(),'4':()=>$('note-tool').click(),d:()=>{$('drawing-select').focus();try{$('drawing-select').showPicker();}catch{}}
}});
$('fit-page').onclick = fitWidth;
$('rotate-page').onclick = () => { rotation = (rotation + 90) % 360; render(); };
$('drawing-select').onchange=()=>{const next=state.drawings.find(d=>d.id===$('drawing-select').value);if(next)openDrawing(next,1,takeoffUi?.mode);};
function setNoteMode(enabled) {
  takeoffUi?.deactivate(); zoneUi?.deactivate();
  noteMode = enabled; placingNote = false;
  $('notes-panel').hidden = !enabled;
  $('page-panel').hidden = true; $('page-tool').classList.remove('tool-active'); $('page-tool').setAttribute('aria-pressed','false');
  $('note-tool').classList.toggle('tool-active',enabled); $('note-tool').setAttribute('aria-pressed',String(enabled));
  $('pan-tool').classList.toggle('tool-active',!enabled); $('pan-tool').setAttribute('aria-pressed',String(!enabled));
  $('tool-help').textContent = enabled ? 'Read a page note, or add one to the drawing' : 'Space + drag to pan · Ctrl/⌘ + wheel to zoom';
  $('page-surface').classList.remove('placing-note');
  paintNotes();
}
function paintNotes() {
  const notes = (state?.notes || []).filter(n=>n.drawing_id === drawing?.id && n.page === pageNumber);
  $('note-count').textContent = notes.length;
  const list = $('notes-list'); list.replaceChildren();
  $('note-overlay')?.remove();
  if (activeViewport) {
    const overlay = node('div',null,'note-overlay'); overlay.id = 'note-overlay';
    notes.forEach((n,index) => {
      const marker = button(String(index+1), event=>{ event.stopPropagation(); openNote(n); },'note-marker');
      marker.setAttribute('aria-label',`Note ${index+1}: ${n.text.slice(0,80)}`);
      marker.dataset.noteId = n.id;
      const [x,y] = viewPoint(activeViewport,n.x,n.y);
      marker.style.left = `${x}px`; marker.style.top = `${y}px`;
      overlay.append(marker);
    });
    $('page-surface').append(overlay);
  }
  if (!notes.length) list.append(node('p','No notes on this page. Add one to keep a detail with the drawing.','hint'));
  notes.forEach((n,index) => {
    const entry = button('',()=>openNote(n),'note-entry');
    entry.append(node('span',String(index+1),'note-number'),node('span',n.text)); list.append(entry);
  });
}
function openNote(note) {
  editingNote = note; placingNote = false; $('page-surface').classList.remove('placing-note');
  $('tool-help').textContent = 'Read a page note, or add one to the drawing';
  $('note-dialog-title').textContent = note.id ? 'Edit note' : 'Add note';
  $('note-text').value = note.text || ''; $('note-error').textContent = '';
  $('remove-note').hidden = !note.id; $('note-dialog').showModal(); $('note-text').focus();
}
$('note-tool').onclick = ()=>setNoteMode(true);
$('pan-tool').onclick = ()=>setNoteMode(false);
$('page-tool').onclick = ()=>{
  setNoteMode(false); $('page-panel').hidden=false;
  $('page-tool').classList.add('tool-active'); $('page-tool').setAttribute('aria-pressed','true');
  $('pan-tool').classList.remove('tool-active'); $('pan-tool').setAttribute('aria-pressed','false');
  $('tool-help').textContent='Review the page name and title'; paintPage();
};
function currentPageMetadata() { return state?.pageMetadata?.find(p=>p.drawing_id===drawing?.id && p.number===pageNumber); }
function paintPage() {
  const metadata=currentPageMetadata();
  const selector=$('drawing-select');selector.replaceChildren();
  for(const d of state?.drawings?.filter(d=>d.discipline_id===drawing?.discipline_id)||[]){const option=node('option',d.name);option.value=d.id;option.selected=d.id===drawing.id;selector.append(option);}
  if(drawing){ $('drawing-title').textContent=metadata&&metadata.name!==`Page ${pageNumber}` ? metadata.name : drawing.name; $('drawing-title').title=[drawing.name,metadata?.title].filter(Boolean).join(' — '); }
  $('page-name').value=metadata?.name || `Page ${pageNumber}`;
  $('page-title').value=metadata?.title || '';
  $('page-error').textContent='';
}
$('reset-page').onclick=paintPage;
$('page-form').onsubmit=async event=>{
  event.preventDefault(); const metadata=currentPageMetadata();if(!metadata)return;
  $('save-page').disabled=true;
  try {
    await api(`/api/drawings/${drawing.id}/pages/${pageNumber}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:$('page-name').value,title:$('page-title').value,version:metadata.version})});
    await refresh();paintPage();notice('Page details saved');
  } catch(error) { $('page-error').textContent=error.message;state=await api('/api/state').catch(()=>state); }
  finally{$('save-page').disabled=false;}
};
$('add-note').onclick = ()=>{
  if (!activeViewport) return;
  placingNote = true; $('page-surface').classList.add('placing-note');
  $('tool-help').textContent = 'Click the drawing to place your note';
};
$('page-surface').onclick = event=>{
  if (!noteMode || !placingNote || !activeViewport || !pdf || renderTask?.cancelled) return;
  const rect = $('pdf-canvas').getBoundingClientRect();
  const [x,y] = pagePoint(activeViewport,rect,event.clientX,event.clientY);
  const [left,bottom,right,top] = drawing.pages[pageNumber-1].view;
  if (x < left || x > right || y < bottom || y > top) return;
  openNote({ drawing_id:drawing.id, page:pageNumber,x,y,text:'' });
};
$('cancel-note').onclick = ()=>$('note-dialog').close();
$('note-form').onsubmit = async event=>{
  event.preventDefault(); $('save-note').disabled = true;
  const note = editingNote;
  try {
    await api(note.id ? `/api/notes/${note.id}` : `/api/drawings/${note.drawing_id}/notes`, {
      method:note.id ? 'PATCH' : 'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...note,text:$('note-text').value}),
    });
    $('note-dialog').close(); await refresh(); paintNotes(); notice('Note saved');
  } catch (error) { $('note-error').textContent = error.message; state = await api('/api/state').catch(()=>state); }
  finally { $('save-note').disabled = false; }
};
$('remove-note').onclick = ()=>{
  const note = editingNote; $('remove-note-dialog').returnValue = ''; $('remove-note-dialog').showModal();
  $('remove-note-dialog').onclose = async ()=>{
    if ($('remove-note-dialog').returnValue !== 'delete') return;
    try {
      await api(`/api/notes/${note.id}?version=${note.version}`,{method:'DELETE'});
      $('note-dialog').close(); await refresh(); paintNotes(); notice('Note removed');
    } catch (error) { $('note-error').textContent = error.message; state = await api('/api/state').catch(()=>state); }
  };
};
takeoffUi=setupTakeoff({context:()=>({state,drawing,pageNumber,viewport:activeViewport,openDrawing}),api,reload:refresh,node,button,notice,pdfjs,setBaseMode:()=>setNoteMode(false)});
zoneUi=setupZones({context:()=>({state,drawing,pageNumber,viewport:activeViewport}),api,reload:refresh,node,button,notice,setBaseMode:()=>setNoteMode(false)});
try { ({ token } = await api('/api/session')); await refresh(); }
catch (error) { notice(`Workspace unavailable: ${error.message}`, true); }
