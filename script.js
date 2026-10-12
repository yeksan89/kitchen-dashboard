// Paste your Apps Script web app URL (ends in /exec) and the same API_TOKEN you set in Script Properties
const API_URL = "https://script.google.com/macros/s/AKfycby22iQbRixzFcgAMNgiLNHwp8m2isit6wQdpVyhgWsdz_1_eeqBeY5S6yx83TF5XRO0/exec";
const TOKEN = "587c5f3d07d5872b661e077c122fba72";

let S = { days: [], ribbon: '', state: { done: {}, have: {}, extra: {} } };
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const splitItems = str => String(str || '').split(',').map(s => s.trim()).filter(Boolean);
async function load() {
    try {
        const r = await fetch(API_URL + '?token=' + encodeURIComponent(TOKEN));
        apply(await r.json());
    } catch (e) {
        $('calendar').innerHTML = '<div class="loading-state" style="color:#ff4757">Could not reach the kitchen database. Check API_URL and TOKEN.</div>';
    }
}
async function api(body) {
    const r = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ token: TOKEN, ...body }) });
    return r.json();
}
function apply(p) {
    if (p.error) { $('calendar').innerHTML = `<div class="loading-state" style="color:#ff4757">${esc(p.error)}</div>`; return; }
    S = p;
    S.state.done = S.state.done || {}; S.state.have = S.state.have || {}; S.state.extra = S.state.extra || {};
    render();
}

function parseChores(i) {
    const d = S.days[i];
    const seen = new Set(), tasks = [];
    String(d.chore || '').split('|').forEach(raw => {
        const owner = raw.includes('[A]') ? 'A' : raw.includes('[E]') ? 'E' : '';
        const text = raw.replace('[A]', '').replace('[E]', '').trim();
        if (!text || seen.has(text.toLowerCase())) return;       // never list the same task twice
        seen.add(text.toLowerCase());
        tasks.push({ text, owner });
    });
    (S.state.extra[i] || []).forEach(t => tasks.push({ text: t, owner: '' }));
    return tasks;
}

function render() {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    $('current-date').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const ribbon = $('prayer-ribbon-content');
    if (S.ribbon.includes('Fajr')) {
        ribbon.innerHTML = S.ribbon.split('|').map(b => b.trim().split(/\s+/)).filter(p => p.length === 2)
            .map(p => `<div class="prayer-time-node"><span class="p-name">◯ ${esc(p[0])}</span><span class="p-time">${esc(p[1])}</span></div>`).join('');
    }
    $('calendar').innerHTML = S.days.map((d, i) => {
        if (!d.day) return '';
        const cuisine = String(d.cuisine || 'standard').toLowerCase().replace(/[^a-z]/g, '') || 'standard';
        const tasks = parseChores(i).map(t => {
            const k = `c:${i}:${t.text.toLowerCase()}`, done = !!S.state.done[k];
            const cls = t.owner === 'A' ? 'owner-a' : t.owner === 'E' ? 'owner-e' : 'unassigned';
            return `<label class="single-chore-row-item"><input type="checkbox" data-k="${esc(k)}" ${done ? 'checked' : ''}>
                <span class="user-badge-profile ${cls}">${t.owner || '•'}</span>
                <span class="chore-row-text-string" style="${done ? 'text-decoration:line-through;opacity:.4' : ''}">${esc(t.text)}</span></label>`;
        }).join('');
        return `<div class="day-card ${d.day.toLowerCase() === today.toLowerCase() ? 'today' : ''}" data-day="${esc(d.day)}">
            <div class="day-name">${esc(d.day)}${d.day.toLowerCase() === today.toLowerCase() ? ' 📍' : ''}</div>
            <div class="meal-section" onclick="viewRecipeModal(${i})">
                <span class="cuisine-tag ${cuisine}">${esc(cuisine)}</span>
                <p class="meal-title">${esc(d.meal || 'No meal planned')}</p>
                <div class="meta-metrics-row"><span>⏱️ ${esc(d.cook_time)}m</span><span>💰 $${esc(d.cost)}</span><span>🔥 ${esc(d.calories)}c</span></div>
            </div>
            <div class="chore-section"><div class="chore-box"><div class="chores-list-sub-container">${tasks}</div></div>
                <div class="add-task-container">
                    <button class="add-task-inline-btn" onclick="toggleTaskInput(this)">+ Add Task</button>
                    <div class="task-input-hidden-row" style="display:none;"><input type="text" class="task-text-field"><button onclick="addTask(this, ${i})">➕</button></div>
                </div></div></div>`;
    }).join('');
    renderGrocery();
    renderPlans();
}

/* ---------- Grocery: tick what you already have; only the rest goes to the phone ---------- */
function renderGrocery() {
    let html = '';
    S.days.forEach((d, i) => {
        const items = splitItems(d.grocery);
        if (!items.length) return;
        html += `<div class="grocery-itemized-block" style="margin-bottom:20px"><h4 style="margin:0 0 8px">${esc(String(d.day).toUpperCase())} | ${esc(d.meal)}</h4>` +
            items.map((it, j) => {
                const k = `g:${i}:${j}`, have = !!S.state.have[k];
                return `<label class="grocery-row" style="display:flex;gap:10px;align-items:center;margin:4px 0;cursor:pointer;${have ? 'text-decoration:line-through;opacity:.4' : ''}">
                    <input type="checkbox" data-k="${esc(k)}" data-item="${esc(it)}" ${have ? 'checked' : ''}> <span>${esc(it)}</span></label>`;
            }).join('') + '</div>';
    });
    $('grocery-master-content').innerHTML = (html ? '<p style="color:var(--text-muted);font-size:.85rem">Tick what you already have at home.</p>' : '') + (html || '<p>No active shopping list data synced.</p>');
    refreshQR();
}
function missingItems() {
    const seen = new Set(), out = [];
    document.querySelectorAll('#grocery-master-content input[data-item]').forEach(c => {
        const it = c.dataset.item, key = it.toLowerCase();
        if (!c.checked && !seen.has(key)) { seen.add(key); out.push(it); }
    });
    return out;
}
function refreshQR() {
    const items = missingItems();
    const text = 'Grocery list:\n' + items.map(i => '- ' + i).join('\n');
    $('qr-box').innerHTML = items.length
        ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${encodeURIComponent(text)}" alt="QR"><p style="margin:8px 0 0">${items.length} items to buy</p>
           <button class="btn" style="margin-top:8px" onclick="shareList()">📤 Share / Copy</button>`
        : '<p>You have everything! 🎉</p>';
}
async function shareList() {
    const text = 'Grocery list:\n' + missingItems().map(i => '- ' + i).join('\n');
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { /* cancelled */ } }
    await navigator.clipboard.writeText(text);
    alert('Copied the missing items to your clipboard.');
}

/* ---------- One handler for every task / grocery checkbox ---------- */
document.addEventListener('change', e => {
    const k = e.target.dataset && e.target.dataset.k;
    if (!k) return;
    const on = e.target.checked, grocery = k.startsWith('g:');
    (grocery ? S.state.have : S.state.done)[k] = on;
    const el = grocery ? e.target.closest('label') : e.target.closest('label').querySelector('.chore-row-text-string');
    el.style.textDecoration = on ? 'line-through' : 'none';
    el.style.opacity = on ? '.4' : '1';
    if (grocery) refreshQR();
    api({ action: grocery ? 'have' : 'toggle', key: k, value: on });
});

function addTask(btn, i) {
    const inp = btn.previousElementSibling, t = inp.value.trim();
    if (!t) return;
    (S.state.extra[i] = S.state.extra[i] || []).push(t);
    render();
    api({ action: 'addTask', day: i, text: t });
}

/* ---------- Recipe modal ---------- */
function viewRecipeModal(i) {
    const d = S.days[i];
    if (!d) return;
    $('modal-recipe-title').innerText = d.meal;
    $('modal-recipe-meta').innerText = `${String(d.day).toUpperCase()} | ⏱️ ${d.cook_time}m | 💰 $${d.cost} | 🔥 ${d.calories} cal (${d.macros})`;
    const raw = String(d.details || '');
    const [ingPart, stepPart = ''] = raw.replace('INGREDIENTS:', '').split('STEPS:');
    let steps = stepPart.split('\n').map(cleanStep).filter(Boolean);
    if (steps.length === 1) steps = steps[0].split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map(cleanStep).filter(Boolean);
    $('modal-recipe-ingredients').innerHTML = (splitItems(ingPart).length ? splitItems(ingPart) : ['Check grocery list.']).map(x => `<li>• ${esc(x)}</li>`).join('');
    $('modal-recipe-steps').innerHTML = (steps.length ? steps : ['No directions logged.']).map(x => `<li>${esc(x)}</li>`).join('');
    openModal('recipe-modal');
}
// strips "1." / "Step 2:" prefixes and drops lines that are only a number (the cause of the empty-looking lines)
function cleanStep(s) { s = s.replace(/^\s*(?:Step\s*)?\d+[.):]?\s*/i, '').trim(); return /^\d*[.)]?$/.test(s) ? '' : s; }

/* ---------- Change of Plans ---------- */
function renderPlans() {
    const box = document.querySelector('#plans-modal .modal-content');
    if (box.dataset.built) return;
    box.dataset.built = '1';
    const opts = S.days.map((d, i) => `<option value="${i}">${esc(d.day)}</option>`).join('');
    const todayIdx = Math.max(0, S.days.findIndex(d => String(d.day).toLowerCase() === new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()));
    box.innerHTML = `<button class="modal-close" onclick="closeModal('plans-modal')">❌ Close</button>
        <h2 class="modal-header-text">🔄 Change of Plans</h2>
        <p style="color:var(--text-muted)">Which day?</p>
        <select id="plan-day" class="task-text-field" style="margin-bottom:15px">${opts}</select>
        <button class="btn-block mode-btn" onclick="plan('takeout')">🥡 Order Takeout</button>
        <button class="btn-block mode-btn" onclick="plan('push')">❄️ Push to Next Week</button>
        <div style="display:flex;gap:8px;margin-bottom:12px"><select id="plan-swap" class="task-text-field">${opts}</select>
            <button class="btn" style="white-space:nowrap" onclick="plan('swap')">🔀 Swap with this day</button></div>
        <button class="btn-block mode-btn highlight" onclick="plan('newDish')">✨ Try Something New</button>
        <p id="plan-status" style="color:var(--text-muted)"></p>`;
    $('plan-day').value = todayIdx;
    $('plan-swap').value = Math.min(todayIdx + 1, S.days.length - 1);
}
async function plan(action) {
    const day = +$('plan-day').value, b = +$('plan-swap').value, st = $('plan-status');
    if (action === 'swap' && day === b) { st.innerText = 'Pick two different days.'; return; }
    st.innerText = action === 'newDish' ? '✨ Asking Gemini for a fresh idea…' : 'Updating…';
    try {
        const p = await api({ action, day, a: day, b });
        apply(p);
        st.innerText = '';
        closeModal('plans-modal');
    } catch (e) { st.innerText = 'Something went wrong. Try again.'; }
}

/* ---------- Nanny Nook ---------- */
async function saveNanny() {
    const text = $('nanny-text-input').value.trim();
    const meal = (document.querySelector('input[name="nanny-meal"]:checked') || {}).value || 'Snack';
    const btn = document.querySelector('#nanny-modal .btn-block');
    if (!text) return;
    btn.innerText = 'Saving…';
    try {
        const p = await api({ action: 'nanny', meal, text });
        if (p.error) throw new Error(p.error);
        $('nanny-text-input').value = '';
        btn.innerText = '✅ Saved to the NannyLog tab';
    } catch (e) { btn.innerText = '⚠️ Not saved, try again'; }
    setTimeout(() => { btn.innerText = "💾 Save to Parents' Phones"; }, 2500);
}

function toggleTaskInput(btn) { const r = btn.nextElementSibling; r.style.display = r.style.display === "none" ? "flex" : "none"; }
function openModal(id) { $(id).classList.add('active'); }
function closeModal(id) { $(id).classList.remove('active'); }

document.querySelector('#nanny-modal .btn-block').onclick = saveNanny;
load();
