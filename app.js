'use strict';

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

/* ---------- constants ---------- */
const STAGES = [
  { id: 'wishlist', label: 'Wishlist', color: 'var(--yellow)' },
  { id: 'applied',  label: 'Applied',  color: 'var(--cyan)' },
  { id: 'interview',label: 'Interview',color: 'var(--violet)' },
  { id: 'offer',    label: 'Offer',    color: 'var(--green)' },
  { id: 'rejected', label: 'Rejected', color: 'var(--red)' },
];
const SOURCES = ['LinkedIn', 'Company site', 'Referral', 'Recruiter', 'Indeed', 'Other'];
const ACCENTS = ['var(--yellow)', 'var(--cyan)', 'var(--violet)', 'var(--green)', 'var(--red)'];

/* ---------- state ---------- */
/* seed rows for the demo account; inserted whenever the demo board is empty */
const seed = () => ([
  { company: 'OpenAI', role: 'Forward Deployed Engineer', location: 'San Francisco', stage: 'wishlist', source: 'Company site', salary: '$140,000', url: 'https://openai.com/careers', contactName: '', contactRole: '', applied: '', deadline: '', notes: 'Tailor CV toward the ML tooling + customer engineering angle before applying.' },
  { company: 'Anthropic', role: 'Solutions Engineer', location: 'San Francisco', stage: 'wishlist', source: 'Referral', salary: '$145,000', url: 'https://www.anthropic.com/jobs', contactName: '', contactRole: '', applied: '', deadline: '', notes: 'Research the SE team loop first; prep infrastructure debugging stories.' },
  { company: 'Stripe', role: 'Solutions Engineer', location: 'Seattle', stage: 'applied', source: 'LinkedIn', salary: '$128,000', url: 'https://stripe.com/jobs', contactName: '', contactRole: '', applied: '2026-08-24', deadline: '2026-09-12', notes: 'Recruiter mentioned a two-week review window. Follow up if silent.' },
  { company: 'Vercel', role: 'Solutions Engineer', location: 'Remote', stage: 'applied', source: 'Company site', salary: '$135,000', url: 'https://vercel.com/careers', contactName: '', contactRole: '', applied: '2026-08-27', deadline: '', notes: 'Included the take-home skeleton link in the application.' },
  { company: 'Linear', role: 'Product Engineer', location: 'Remote', stage: 'applied', source: 'Referral', salary: '$130,000', url: 'https://linear.app/careers', contactName: 'Jasmine Chen', contactRole: 'Engineering Manager', applied: '2026-08-30', deadline: '', notes: 'Jasmine said the team reviews batch applications end of week.' },
  { company: 'Notion', role: 'Solutions Engineer', location: 'New York', stage: 'applied', source: 'Recruiter', salary: '$120,000', url: 'https://www.notion.com/careers', contactName: 'Priya Nair', contactRole: 'Recruiter', applied: '2026-09-02', deadline: '', notes: 'Priya floated a first call for the week of Sep 14.' },
  { company: 'Figma', role: 'Solutions Engineer', location: 'San Francisco', stage: 'interview', source: 'LinkedIn', salary: '$132,000', url: 'https://www.figma.com/careers', contactName: 'Marcus Lee', contactRole: 'Recruiter', applied: '2026-08-18', deadline: '2026-09-15', notes: 'Onsite loop: four rounds including a deployment demo. Rehearse the customer case.' },
  { company: 'Datadog', role: 'Solutions Engineer', location: 'New York', stage: 'interview', source: 'LinkedIn', salary: '$125,000', url: 'https://www.datadoghq.com/careers', contactName: '', contactRole: '', applied: '2026-08-21', deadline: '2026-09-11', notes: 'Tech screen: Linux troubleshooting + HTTP APIs. Practice in a lab environment.' },
  { company: 'Cloudflare', role: 'Solutions Engineer', location: 'Austin', stage: 'offer', source: 'Recruiter', salary: '$138,000', url: 'https://www.cloudflare.com/careers', contactName: 'Dana White', contactRole: 'Hiring Manager', applied: '2026-08-05', deadline: '2026-09-14', notes: 'Offer received Sep 8, four business days to respond. Base $138k plus RSUs.' },
  { company: 'Meta', role: 'Production Engineer', location: 'Menlo Park', stage: 'rejected', source: 'LinkedIn', salary: '$150,000', url: 'https://www.meta.com/careers', contactName: '', contactRole: '', applied: '2026-07-28', deadline: '', notes: 'Rejected after screening. Recruiter said reapply in 12 months.' },
]);

let apps = [];
let drawerFor = null;   // app id shown in the drawer, or null
let editingId = null;   // app id being edited in the form, or null

/* auth session mirror + per-browser preferences */
let session = null;     // { name, email } for the signed-in user, or null
const PREFS_KEY = 'pipeline.prefs';
let prefs = { showSalary: true, warnDays: 3 };
try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { /* keep defaults */ }
const savePrefs = () => localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));

const DEMO_EMAIL = 'demo@pipeline.app';
const DEMO_PASS = 'demo1234';
const isDemo = () => session?.email === DEMO_EMAIL;
let currentUserId = null;  // sign-in/out detection; token refreshes keep the same id
let justSignedUp = false;

/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const stageOf = (id) => STAGES.find((s) => s.id === id);
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtShort = (s) => parseDate(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const daysUntil = (s) => Math.round((parseDate(s) - new Date(new Date().toDateString())) / 864e5);
const accentFor = (app) => {
  /* ids are uuids now, so derive the accent from the company name */
  let h = 0;
  for (const ch of app.company) h += ch.charCodeAt(0);
  return ACCENTS[h % ACCENTS.length];
};
const byDeadline = (a, b) => {
  const da = a.deadline ? parseDate(a.deadline).getTime() : Infinity;
  const db = b.deadline ? parseDate(b.deadline).getTime() : Infinity;
  return (da - db) || String(b.applied || '').localeCompare(String(a.applied || '')) || a.company.localeCompare(b.company);
};

const ICONS = {
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
};
const icon = (name, size = 14) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

/* ---------- database mapping ---------- */
const toApp = (r) => ({
  id: r.id, company: r.company, role: r.role, location: r.location ?? '',
  stage: r.stage, source: r.source ?? '', salary: r.salary ?? '', url: r.url ?? '',
  contactName: r.contact_name ?? '', contactRole: r.contact_role ?? '',
  applied: r.applied ?? '', deadline: r.deadline ?? '', notes: r.notes ?? '',
});
const toRow = (a) => ({
  user_id: currentUserId,   /* set by applySession; RLS requires it to match auth.uid() */
  company: a.company, role: a.role, location: a.location, stage: a.stage,
  source: a.source, salary: a.salary, url: a.url,
  contact_name: a.contactName, contact_role: a.contactRole,
  applied: a.applied || null, deadline: a.deadline || null, notes: a.notes,
});

/* ---------- board render ---------- */
const board = $('#board');
const boardNote = $('#boardNote');

function cardHTML(app) {
  const meta = app.applied
    ? `Applied ${fmtShort(app.applied)}`
    : `via ${esc(app.source || 'direct')}`;
  let due = '';
  if (app.deadline) {
    const d = daysUntil(app.deadline);
    const urgent = d <= prefs.warnDays;
    const label = d < 0 ? `Overdue (${fmtShort(app.deadline)})` : d === 0 ? 'Due today' : `Due ${fmtShort(app.deadline)}`;
    due = `<p class="due ${urgent ? 'due-urgent' : ''}">${icon('bell', 12)}<span>${esc(label)}</span></p>`;
  }
  return `
    <article class="card" draggable="true" data-id="${app.id}">
      <button type="button" class="card-open" data-open="${app.id}" aria-label="Open ${esc(app.company)} details">
        <span class="avatar" style="--av:${accentFor(app)}" aria-hidden="true">${esc(app.company.charAt(0).toUpperCase())}</span>
        <span class="card-titles od-stack">
          <span class="co od-truncate">${esc(app.company)}</span>
          <span class="role od-truncate">${esc(app.role)}</span>
        </span>
      </button>
      <div class="card-meta od-row">
        <span class="od-truncate">${esc(meta)}</span>
        ${prefs.showSalary && app.salary ? `<span class="right od-nowrap">${esc(app.salary)}</span>` : ''}
      </div>
      ${due}
    </article>`;
}

function render() {
  board.innerHTML = '';
  for (const stage of STAGES) {
    const list = apps.filter((a) => a.stage === stage.id).sort(byDeadline);
    const col = document.createElement('section');
    col.className = 'col';
    col.dataset.stage = stage.id;
    col.style.setProperty('--accent', stage.color);
    col.innerHTML = `
      <header class="col-head od-row">
        <span class="col-dot" aria-hidden="true"></span>
        <h2 class="col-name od-fill od-truncate">${stage.label}</h2>
        <span class="col-count">${list.length}</span>
      </header>
      <div class="col-cards od-stack">
        ${list.length ? list.map(cardHTML).join('') : `<p class="col-empty">Nothing here yet.<br>Drag a card over, or add one below.</p>`}
      </div>
      <button type="button" class="col-add" data-addstage="${stage.id}">+ Add application</button>`;

    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.classList.add('over');
    });
    col.addEventListener('dragleave', (e) => {
      if (!col.contains(e.relatedTarget)) col.classList.remove('over');
    });
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('over');
      const id = e.dataTransfer.getData('text/plain');
      const app = apps.find((a) => a.id === id);
      if (app && app.stage !== col.dataset.stage) setStage(id, col.dataset.stage);
    });
    board.appendChild(col);
  }
  renderStats();
}

function renderStats() {
  const count = (stage) => apps.filter((a) => a.stage === stage).length;
  $('#statTotal').textContent = String(apps.length);
  $('#statInterview').textContent = String(count('interview'));
  $('#statOffer').textContent = String(count('offer'));
  $('#statWishlist').textContent = String(count('wishlist'));
}

/* delegated clicks: open card / add-in-column */
board.addEventListener('click', (e) => {
  const openBtn = e.target.closest('[data-open]');
  if (openBtn) { openDrawer(openBtn.dataset.open); return; }
  const addBtn = e.target.closest('[data-addstage]');
  if (addBtn) openForm(addBtn.dataset.addstage);
});

/* drag handlers live on cards (fresh nodes each render, delegated via capture on board) */
board.addEventListener('dragstart', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  e.dataTransfer.setData('text/plain', card.dataset.id);
  e.dataTransfer.effectAllowed = 'move';
  card.classList.add('dragging');
});
board.addEventListener('dragend', (e) => {
  const card = e.target.closest('.card');
  if (card) card.classList.remove('dragging');
  document.querySelectorAll('.col.over').forEach((c) => c.classList.remove('over'));
});

/* ---------- data loading ---------- */
async function loadApps() {
  boardNote.hidden = false;
  boardNote.textContent = 'loading your board...';
  render();
  const { data, error } = await supabase.from('applications').select('*');
  if (error) {
    boardNote.textContent = `could not load your board - ${error.message}`;
    return;
  }
  apps = data.map(toApp);
  if (isDemo() && apps.length === 0) {
    const { data: rows, error: insErr } = await supabase.from('applications').insert(seed().map(toRow)).select();
    if (insErr) toast(`Could not seed demo data - ${insErr.message}`);
    else apps = rows.map(toApp);
  }
  boardNote.hidden = true;
  render();
}

/* ---------- drawer ---------- */
const drawer = $('#drawer');
const drawerIn = $('#drawerIn');

function openDrawer(id) {
  drawerFor = id;
  renderDrawer();
  drawer.showModal();
}

function renderDrawer() {
  const app = apps.find((a) => a.id === drawerFor);
  if (!app) return;
  const linkText = (() => {
    if (!app.url) return '';
    try { const u = new URL(app.url); return u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, ''); }
    catch { return app.url; }
  })();

  const segButtons = STAGES.map((s) => `
    <button type="button" class="seg-btn" style="--seg-c:${s.color}" data-stage="${s.id}" aria-pressed="${app.stage === s.id}">
      <span class="sq" aria-hidden="true"></span>${s.label}
    </button>`).join('');

  const field = (label, value) => value
    ? `<div class="field od-field"><dt>${esc(label)}</dt><dd>${value}</dd></div>` : '';

  drawerIn.innerHTML = `
    <div class="drawer-head">
      <span class="avatar" style="--av:${accentFor(app)}" aria-hidden="true">${esc(app.company.charAt(0).toUpperCase())}</span>
      <div class="od-stack od-fill" style="--od-gap:2px">
        <h2 class="drawer-co" id="drawerCo">${esc(app.company)}</h2>
        <p class="drawer-role od-truncate">${esc(app.role)}</p>
      </div>
      <button type="button" class="icon-btn" data-drawerclose aria-label="Close details">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
    <div class="drawer-body">
      <div class="drawer-sec">
        <p class="drawer-label">Stage <span class="hint">- tap to move</span></p>
        <div class="seg od-cluster" role="group" aria-label="Stage">${segButtons}</div>
      </div>
      <div class="drawer-sec">
        <p class="drawer-label">Details</p>
        <dl class="fields od-stack">
          ${field('Location', esc(app.location))}
          ${field('Applied', app.applied ? esc(fmtShort(app.applied) + ', ' + parseDate(app.applied).getFullYear()) : '')}
          ${field('Deadline', app.deadline ? esc(fmtShort(app.deadline) + ', ' + parseDate(app.deadline).getFullYear()) : '')}
          ${field('Salary', `<span class="od-nowrap">${esc(app.salary)}</span>`)}
          ${field('Source', esc(app.source))}
          ${field('Job link', app.url ? `<a class="joblink" href="${esc(app.url)}" target="_blank" rel="noopener noreferrer">${esc(linkText)} ${icon('external', 12)}</a>` : '')}
          ${field('Contact', app.contactName ? esc(app.contactName + (app.contactRole ? ` (${app.contactRole})` : '')) : '')}
        </dl>
      </div>
      ${app.notes ? `
      <div class="drawer-sec">
        <p class="drawer-label">Notes</p>
        <div class="notes-box">${esc(app.notes)}</div>
      </div>` : ''}
    </div>
    <div class="drawer-foot">
      <button type="button" class="btn" data-draweredit="${app.id}">${icon('pencil', 14)} Edit</button>
      <span class="od-fill"></span>
      <button type="button" class="btn btn-danger" data-drawerdelete="${app.id}">${icon('trash', 14)} <span>Delete</span></button>
    </div>`;
}

drawerIn.addEventListener('click', async (e) => {
  const closeBtn = e.target.closest('[data-drawerclose]');
  if (closeBtn) { drawer.close(); return; }

  const stageBtn = e.target.closest('[data-stage]');
  if (stageBtn) { setStage(drawerFor, stageBtn.dataset.stage); return; }

  const editBtn = e.target.closest('[data-draweredit]');
  if (editBtn) { drawer.close(); openForm(null, editBtn.dataset.draweredit); return; }

  const delBtn = e.target.closest('[data-drawerdelete]');
  if (delBtn) {
    if (delBtn.classList.contains('armed')) {
      const app = apps.find((a) => a.id === drawerFor);
      delBtn.disabled = true;
      const { error } = await supabase.from('applications').delete().eq('id', drawerFor);
      delBtn.disabled = false;
      if (error) { toast(`Could not delete - ${error.message}`); return; }
      apps = apps.filter((a) => a.id !== drawerFor);
      drawerFor = null;
      drawer.close();
      render();
      toast(`Deleted ${app.company}`);
    } else {
      delBtn.classList.add('armed');
      delBtn.querySelector('span').textContent = 'Confirm delete?';
      setTimeout(() => {
        delBtn.classList.remove('armed');
        const span = delBtn.querySelector('span');
        if (span) span.textContent = 'Delete';
      }, 3000);
    }
  }
});

/* ---------- form ---------- */
const appDialog = $('#appDialog');
const appForm = $('#appForm');
const formTitle = $('#formTitle');
const formSummary = $('#formSummary');

/* populate selects once */
$('#f-stage').innerHTML = STAGES.map((s) => `<option value="${s.id}">${s.label}</option>`).join('');
$('#f-source').innerHTML = SOURCES.map((s) => `<option>${s}</option>`).join('');

function openForm(stagePreset, editId = null) {
  editingId = editId;
  formSummary.hidden = true;
  clearError('company'); clearError('role'); clearError('url');

  if (editId) {
    const a = apps.find((x) => x.id === editId);
    formTitle.textContent = 'Edit application';
    $('#f-company').value = a.company;   $('#f-role').value = a.role;
    $('#f-location').value = a.location; $('#f-stage').value = a.stage;
    $('#f-applied').value = a.applied;   $('#f-deadline').value = a.deadline;
    $('#f-salary').value = a.salary;     $('#f-source').value = a.source;
    $('#f-url').value = a.url;           $('#f-contactName').value = a.contactName;
    $('#f-contactRole').value = a.contactRole; $('#f-notes').value = a.notes;
  } else {
    appForm.reset();
    formTitle.textContent = 'New application';
    $('#f-stage').value = stagePreset || 'wishlist';
    $('#f-source').value = SOURCES[0];
  }
  appDialog.showModal();
}

function showError(key, msg, inputSel) {
  $(`#e-${key}`).textContent = msg;
  $(`#e-${key}`).hidden = false;
  (inputSel ? $(inputSel) : $(`#f-${key}`)).setAttribute('aria-invalid', 'true');
}
function clearError(key, inputSel) {
  $(`#e-${key}`).hidden = true;
  (inputSel ? $(inputSel) : $(`#f-${key}`)).removeAttribute('aria-invalid');
}

function validateField(key, value) {
  if (key === 'company' && !value.trim()) { showError('company', 'Company is required - who did you apply to?'); return false; }
  if (key === 'role' && !value.trim()) { showError('role', 'Role is required - what position is this?'); return false; }
  if (key === 'url' && value && !/^https?:\/\/.+/.test(value.trim())) { showError('url', 'Link must start with http:// or https://'); return false; }
  clearError(key);
  return true;
}

/* validate on blur for the three validated fields */
['company', 'role', 'url'].forEach((key) => {
  $(`#f-${key}`).addEventListener('blur', () => validateField(key, $(`#f-${key}`).value));
});

appForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const values = {
    company: $('#f-company').value,
    role: $('#f-role').value,
    url: $('#f-url').value,
  };
  const results = [
    validateField('company', values.company),
    validateField('role', values.role),
    validateField('url', values.url),
  ];
  const bad = results.filter((r) => !r).length;
  if (bad) {
    formSummary.textContent = bad === 1
      ? '1 field needs attention - see below.'
      : `${bad} fields need attention - see below.`;
    formSummary.hidden = false;
    const first = ['company', 'role', 'url'].find((k) => !$(`#e-${k}`).hidden);
    if (first) $(`#f-${first}`).focus();
    return;
  }
  formSummary.hidden = true;

  const record = {
    company: values.company.trim(),
    role: values.role.trim(),
    location: $('#f-location').value.trim(),
    stage: $('#f-stage').value,
    applied: $('#f-applied').value,
    deadline: $('#f-deadline').value,
    salary: $('#f-salary').value.trim(),
    source: $('#f-source').value,
    url: values.url.trim(),
    contactName: $('#f-contactName').value.trim(),
    contactRole: $('#f-contactRole').value.trim(),
    notes: $('#f-notes').value.trim(),
  };

  const saveBtn = appForm.querySelector('button[type="submit"]');
  saveBtn.disabled = true;
  try {
    if (editingId) {
      const { error } = await supabase.from('applications').update(toRow(record)).eq('id', editingId);
      if (error) throw error;
      Object.assign(apps.find((a) => a.id === editingId), record);
      toast(`Updated ${record.company}`);
    } else {
      const { data, error } = await supabase.from('applications').insert(toRow(record)).select().single();
      if (error) throw error;
      apps = [...apps, toApp(data)];
      toast(`Added ${record.company} to ${stageOf(record.stage).label}`);
    }
    appDialog.close();
    render();
  } catch (err) {
    toast(`Could not save - ${err.message}`);
  } finally {
    saveBtn.disabled = false;
  }
});

/* close buttons for the form dialog */
document.querySelectorAll('[data-close="appDialog"]').forEach((b) =>
  b.addEventListener('click', () => appDialog.close())
);

/* ---------- actions ---------- */
async function setStage(id, stage) {
  const app = apps.find((a) => a.id === id);
  if (!app || app.stage === stage) return;
  const prev = app.stage;
  app.stage = stage;   // optimistic; rolled back if the write fails
  render();
  if (drawer.open && drawerFor === id) renderDrawer();
  toast(`Moved ${app.company} to ${stageOf(stage).label}`);
  const { error } = await supabase.from('applications').update({ stage }).eq('id', id);
  if (error) {
    app.stage = prev;
    render();
    if (drawer.open && drawerFor === id) renderDrawer();
    toast(`Could not save - ${error.message}`);
  }
}

/* two-step confirm shared by both clear buttons: first press arms, second within 3s runs */
function armButton(btn, confirmText, action) {
  const label = btn.querySelector('.label');
  if (btn.dataset.armed === '1') {
    btn.dataset.armed = '';
    label.textContent = btn.dataset.label;
    action();
    return;
  }
  btn.dataset.armed = '1';
  btn.dataset.label = label.textContent;
  label.textContent = confirmText;
  setTimeout(() => {
    if (btn.dataset.armed === '1') {
      btn.dataset.armed = '';
      label.textContent = btn.dataset.label;
    }
  }, 3000);
}

async function clearAll() {
  /* RLS scopes the delete to the signed-in user; the filter just satisfies
     postgrest-js's guarded full-table delete */
  const { error } = await supabase.from('applications').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
  if (error) { toast(`Could not clear - ${error.message}`); return; }
  if (isDemo()) {
    const { data, error: insErr } = await supabase.from('applications').insert(seed().map(toRow)).select();
    apps = insErr ? [] : data.map(toApp);
    toast(insErr ? 'Board cleared' : 'Demo data restored');
  } else {
    apps = [];
    toast('Board cleared');
  }
  render();
}

$('#newBtn').addEventListener('click', () => openForm(null));
$('#resetBtn').addEventListener('click', (e) => armButton(e.currentTarget, 'Confirm clear?', clearAll));
$('#resetBtn2').addEventListener('click', (e) => armButton(e.currentTarget, 'Confirm clear?', clearAll));
$('#signOutBtn').addEventListener('click', () => supabase.auth.signOut());
$('#userChip').addEventListener('click', () => {
  navigate('settings');
  renderView();
});
$('#prefSalary').addEventListener('change', (e) => {
  prefs.showSalary = e.target.checked;
  savePrefs();
  render();
  toast(prefs.showSalary ? 'Salary shown on cards' : 'Salary hidden on cards');
});
document.querySelectorAll('[data-warndays]').forEach((b) => b.addEventListener('click', () => {
  prefs.warnDays = Number(b.dataset.warndays);
  savePrefs();
  document.querySelectorAll('[data-warndays]').forEach((x) =>
    x.setAttribute('aria-pressed', String(x === b))
  );
  render();
  toast(`Deadline warnings: ${prefs.warnDays} days ahead`);
}));

/* restore persisted prefs into the settings UI */
$('#prefSalary').checked = prefs.showSalary;
document.querySelectorAll('[data-warndays]').forEach((b) =>
  b.setAttribute('aria-pressed', String(Number(b.dataset.warndays) === prefs.warnDays))
);

$('#nameForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#n-name');
  const value = input.value.trim();
  if (value.length < 2) {
    showError('n-name', 'Add at least 2 characters - how should the board greet you?', '#n-name');
    input.focus();
    return;
  }
  clearError('n-name', '#n-name');
  const { error } = await supabase.auth.updateUser({ data: { name: value } });
  if (error) { toast(`Could not save name - ${error.message}`); return; }
  session = { ...session, name: value };
  renderTopbar();
  renderSettings();
  toast(`Name updated to ${value.split(' ')[0]}`);
});
$('#n-name').addEventListener('blur', () => {
  const value = $('#n-name').value.trim();
  if (value.length < 2) showError('n-name', 'Add at least 2 characters - how should the board greet you?', '#n-name');
  else clearError('n-name', '#n-name');
});

/* ---------- views, routing, auth ---------- */
const VIEWS = ['signin', 'signup', 'board', 'settings'];
const topbar = $('#topbar');
const viewBoard = $('#view-board');
const viewSettings = $('#view-settings');
const viewAuth = $('#view-auth');
const authCard = $('#authCard');

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function route() {
  const h = location.hash.replace(/^#\/?/, '');
  return VIEWS.includes(h) ? h : '';
}
function navigate(view) { location.hash = '/' + view; }

function renderView() {
  let r = route();
  if (!session) {
    if (r !== 'signup') r = 'signin';
  } else if (!r || r === 'signin' || r === 'signup') {
    r = 'board';
  }
  const authMode = !session;
  viewAuth.hidden = !authMode;
  topbar.hidden = authMode;
  viewBoard.hidden = authMode || r !== 'board';
  viewSettings.hidden = authMode || r !== 'settings';
  if (r === 'settings') $('#userChip').setAttribute('aria-current', 'page');
  else $('#userChip').removeAttribute('aria-current');
  if (authMode) showAuth(r === 'signup' ? 'signup' : 'signin');
  if (r === 'board') render();
}

function renderTopbar() {
  if (!session) return;
  $('#chipAvatar').textContent = session.name.charAt(0).toUpperCase();
  $('#chipName').textContent = session.name.split(' ')[0];
}

function renderSettings() {
  $('#profAvatar').textContent = session.name.charAt(0).toUpperCase();
  $('#profName').textContent = session.name;
  $('#profEmail').textContent = session.email;
  $('#n-name').value = session.name;
}

/* supabase auth drives the session; token refreshes reuse the same user id */
function applySession(authSession) {
  const user = authSession?.user ?? null;
  const changed = (user?.id ?? null) !== currentUserId;
  currentUserId = user?.id ?? null;
  session = user
    ? { name: user.user_metadata?.name || (user.email || '').split('@')[0], email: user.email }
    : null;

  if (changed && session) {
    if (['', 'signin', 'signup'].includes(route())) navigate('board');
    renderTopbar();
    renderSettings();
    loadApps();
    toast(justSignedUp ? `Welcome, ${session.name.split(' ')[0]}` : `Signed in as ${session.name.split(' ')[0]}`);
    justSignedUp = false;
  }
  if (changed && !session && location.hash !== '#/signin') {
    apps = [];
    drawerFor = null;
    if (drawer.open) drawer.close();
    if (appDialog.open) appDialog.close();
    navigate('signin');
    toast('Signed out');
  }
  renderView();
}

const authCache = {};
function showAuth(mode) {
  const current = authCard.dataset.mode;
  if (current === mode) return;
  if (current) authCache[current] = authCard.querySelector('.auth-inner');
  authCard.dataset.mode = mode;
  viewAuth.setAttribute('aria-label', mode === 'signup' ? 'Sign up' : 'Sign in');
  if (authCache[mode]) authCard.replaceChildren(authCache[mode]);
  else buildAuth(mode);
}

function buildAuth(mode) {
  const isUp = mode === 'signup';
  authCard.innerHTML = `
    <div class="auth-inner">
    <div class="brand od-row auth-brand">
      <span class="logo" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </span>
      <div class="brand-text od-stack">
        <h1>Pipeline</h1>
        <p>job application tracker</p>
      </div>
    </div>
    <h2 class="auth-title">${isUp ? 'Create your account' : 'Welcome back'}</h2>
    <p class="auth-sub">${isUp ? 'Track every application from wishlist to offer.' : 'Sign in to your board.'}</p>
    <div class="form-summary" id="authSummary" role="alert" hidden></div>
    <form class="auth-form" id="authForm" novalidate>
      ${isUp ? `
      <div class="field-wrap">
        <label for="a-name">Name <span class="req" aria-hidden="true">*</span></label>
        <input type="text" id="a-name" autocomplete="name" required aria-describedby="e-a-name">
        <p class="err" id="e-a-name" hidden></p>
      </div>` : ''}
      <div class="field-wrap">
        <label for="a-email">Email <span class="req" aria-hidden="true">*</span></label>
        <input type="text" id="a-email" autocomplete="email" inputmode="email" required aria-describedby="e-a-email">
        <p class="err" id="e-a-email" hidden></p>
      </div>
      <div class="field-wrap">
        <label for="a-pass">Password <span class="req" aria-hidden="true">*</span></label>
        <input type="password" id="a-pass" autocomplete="${isUp ? 'new-password' : 'current-password'}" required aria-describedby="e-a-pass">
        ${isUp ? '<p class="helper">At least 8 characters</p>' : ''}
        <p class="err" id="e-a-pass" hidden></p>
      </div>
      <button type="submit" class="btn btn-primary btn-block">${isUp ? 'Create account' : 'Sign in'}</button>
    </form>
    <div class="or-row" style="margin-top:16px"><span>OR</span></div>
    <button type="button" class="btn btn-demo btn-block" data-demo style="margin-top:16px">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      Use the demo account
    </button>
    <p class="auth-alt">${isUp ? 'Already have an account?' : 'New here?'}
      <button type="button" class="link-btn" data-mode="${isUp ? 'signin' : 'signup'}">${isUp ? 'Sign in' : 'Create an account'}</button>
    </p>
    </div>`;

  if (!isUp) {
    $('#a-email').value = 'demo@pipeline.app';
    $('#a-pass').value = 'demo1234';
  }
  ($('#a-name') || $('#a-email')).focus();
}

function authCheckField(id, value) {
  const mode = authCard.dataset.mode;
  if (id === 'a-name' && !value.trim()) {
    showError('a-name', 'Add your name so the board can greet you.', '#a-name');
    return false;
  }
  if (id === 'a-email') {
    if (!value.trim()) { showError('a-email', 'Email is required - how else do you sign in?', '#a-email'); return false; }
    if (!emailOk(value.trim())) { showError('a-email', 'That does not look like an email - check for typos.', '#a-email'); return false; }
  }
  if (id === 'a-pass') {
    if (mode === 'signup' ? value.length < 8 : !value) {
      showError('a-pass', mode === 'signup' ? 'Use at least 8 characters for the password.' : 'Enter your password.', '#a-pass');
      return false;
    }
  }
  clearError(id, '#' + id);
  return true;
}

authCard.addEventListener('focusout', (e) => {
  const id = e.target.id;
  if (id === 'a-name' || id === 'a-email' || id === 'a-pass') authCheckField(id, e.target.value);
});

async function signInDemo() {
  let { error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASS });
  if (error && /invalid login credentials/i.test(error.message)) {
    /* demo user missing on a fresh project: create it, then the auth event finishes the sign-in */
    ({ error } = await supabase.auth.signUp({ email: DEMO_EMAIL, password: DEMO_PASS, options: { data: { name: 'Demo User' } } }));
  }
  if (error) toast(`Demo account unavailable - ${error.message}`);
}

authCard.addEventListener('click', (e) => {
  if (e.target.closest('[data-demo]')) { signInDemo(); return; }
  const alt = e.target.closest('[data-mode]');
  if (alt) navigate(alt.dataset.mode);
});

authCard.addEventListener('submit', async (e) => {
  if (e.target.id !== 'authForm') return;
  e.preventDefault();
  const mode = authCard.dataset.mode;
  const summary = $('#authSummary');
  const inputs = [...authCard.querySelectorAll('#authForm input')];
  const bad = inputs.filter((i) => !authCheckField(i.id, i.value)).length;
  if (bad) {
    summary.textContent = bad === 1 ? '1 field needs attention - see below.' : `${bad} fields need attention - see below.`;
    summary.hidden = false;
    const firstKey = authCard.querySelector('#authForm .err:not([hidden])')?.id?.slice(2);
    if (firstKey) $('#' + firstKey).focus();
    return;
  }
  summary.hidden = true;
  const email = $('#a-email').value.trim().toLowerCase();
  const pass = $('#a-pass').value;

  if (mode === 'signup') {
    const name = $('#a-name').value.trim();
    const { data, error } = await supabase.auth.signUp({
      email, password: pass,
      options: { data: { name } },
    });
    if (error) {
      if (/already registered|already exists/i.test(error.message)) {
        summary.textContent = 'That email already has an account - sign in instead.';
        showError('a-email', 'This email is registered - try signing in.', '#a-email');
      } else {
        summary.textContent = error.message;
      }
      summary.hidden = false;
      return;
    }
    if (!data.session) {
      summary.textContent = 'Check your inbox to confirm your email, then sign in.';
      summary.hidden = false;
      return;
    }
    justSignedUp = true;   /* onAuthStateChange finishes the sign-in */
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) {
    if (/invalid login credentials/i.test(error.message)) {
      summary.textContent = 'No account matches that email, or the password is wrong.';
      showError('a-email', 'No account for this email, or wrong password.', '#a-email');
    } else if (/email not confirmed/i.test(error.message)) {
      summary.textContent = 'Check your inbox to confirm your email, then sign in.';
    } else {
      summary.textContent = error.message;
    }
    summary.hidden = false;
  }
});

/* ---------- toasts ---------- */
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => {
    el.classList.add('bye');
    setTimeout(() => el.remove(), 220);
  }, 2400);
}

/* ---------- go ---------- */
window.addEventListener('hashchange', renderView);
supabase.auth.onAuthStateChange((_event, s) => applySession(s));
const { data: { session: initialSession } } = await supabase.auth.getSession();
applySession(initialSession);
