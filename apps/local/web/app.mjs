import * as pdfjs from '/vendor/build/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/build/pdf.worker.mjs';
const $ = id => document.getElementById(id);
let state, token, selectedProject = null, selectedTakeoff = null, createContext;
let pdf, loadingTask, drawing, pageNumber = 1, scale = 1, rotation = 0, renderTask, renderRevision = 0;
let messageTimer;
let resetPan = false;
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
async function refresh() { state = await api('/api/state'); paint(); }
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
    actions.append(button('← Takeoffs', () => { selectedTakeoff = null; paint(); }), button('+ New discipline', () => create('discipline', takeoff.id), 'primary'));
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
        const info = node('div', null, 'drawing-info'); info.append(node('h2', d.name), node('p', `${d.pages.length} page${d.pages.length === 1 ? '' : 's'} · ${(d.bytes / 1024).toFixed(1)} KB`));
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
async function openDrawing(d) {
  const generation = ++renderRevision;
  renderTask?.cancel(); await loadingTask?.destroy(); pdf = null;
  if (generation !== renderRevision) return;
  drawing = d; pageNumber = 1; rotation = 0;
  resetPan = true;
  $('workspace').hidden = true; $('viewer').hidden = false; $('drawing-title').textContent = d.name;
  $('render-status').textContent = 'Opening drawing…'; $('pdf-canvas').hidden = true;
  try {
    const task = pdfjs.getDocument({ url: `/api/drawings/${d.id}/source`, isEvalSupported: false, cMapUrl: '/vendor/cmaps/', cMapPacked: true, standardFontDataUrl: '/vendor/standard_fonts/', wasmUrl: '/vendor/wasm/' });
    loadingTask = task;
    const loaded = await task.promise;
    if (generation !== renderRevision) { await task.destroy(); return; }
    pdf = loaded; await fitWidth();
  } catch (error) { if (generation === renderRevision) { $('render-status').textContent = 'Unable to display this PDF'; notice(error.message, true); } }
}
async function render() {
  if (!pdf) return;
  const generation = ++renderRevision;
  renderTask?.cancel();
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
    if (resetPan) { $('drawing-stage').scrollTo(0,0); resetPan = false; }
    $('page-label').textContent = `${pageNumber} / ${pdf.numPages}`; $('zoom-label').textContent = `${Math.round(scale * 100)}%`;
    $('previous-page').disabled = pageNumber <= 1; $('next-page').disabled = pageNumber >= pdf.numPages;
    $('render-status').textContent = `Page ${pageNumber} · ${drawing.name}`;
    page.cleanup();
  } catch (error) { if (error.name !== 'RenderingCancelledException' && generation === renderRevision) { $('render-status').textContent = 'Rendering failed'; notice(error.message, true); } }
}
async function fitWidth() { if (!pdf) return; const page = await pdf.getPage(pageNumber); const view = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 }); scale = Math.max(.1, Math.min(4, ($('drawing-stage').clientWidth - 60) / view.width)); await render(); }
function closeViewer() { ++renderRevision; renderTask?.cancel(); loadingTask?.destroy(); loadingTask = null; pdf = null; $('viewer').hidden = true; $('workspace').hidden = false; }
$('close-viewer').onclick = closeViewer;
$('previous-page').onclick = () => { if (pdf && pageNumber > 1) { pageNumber--; resetPan = true; render(); } };
$('next-page').onclick = () => { if (pdf && pageNumber < pdf.numPages) { pageNumber++; resetPan = true; render(); } };
$('zoom-in').onclick = () => { scale = Math.min(4, scale * 1.25); render(); };
$('zoom-out').onclick = () => { scale = Math.max(.1, scale / 1.25); render(); };
$('fit-page').onclick = fitWidth;
$('rotate-page').onclick = () => { rotation = (rotation + 90) % 360; render(); };
try { ({ token } = await api('/api/session')); await refresh(); }
catch (error) { notice(`Workspace unavailable: ${error.message}`, true); }
