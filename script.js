// Shows any JavaScript error as a red bar at the top (handy on iPad where there's no console)
window.addEventListener('error', function (e) {
    var b = document.createElement('div');
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#c2493d;color:#fff;padding:6px 10px;z-index:9999;font:12px sans-serif';
    b.textContent = 'JS error: ' + e.message + ' (line ' + e.lineno + ')';
    document.body.appendChild(b);
});

// Paste your Apps Script web app URL (ends in /exec) and the same API_TOKEN you set in Script Properties
const API_URL = "https://script.google.com/macros/s/AKfycbx8_HhY7gUmlzgVprdf9SbOT7OTc4bMq337AecJpzT5GUQxCAdg8NhBKHDnEwhvcCvM/exec";
const TOKEN = "587c5f3d07d5872b661e077c122fba72";

let S = { days: [], ribbon: '', state: { done: {}, have: {}, extra: {} } };
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Lists from the sheet are newline-separated; fall back to commas (outside parentheses) for older data
const splitItems = str => {
    const s = String(str || '');
    return (s.indexOf('\n') !== -1 ? s.split('\n') : s.split(/,(?![^(]*\))/)).map(x => x.trim()).filter(Boolean);
};

// XHR wrapper for iOS 15 compatibility with Google Apps Script redirects
function apiGet(url) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.onload = () => {
            try { resolve(JSON.parse(xhr.responseText)); }
            catch (e) { reject(new Error('Invalid JSON response')); }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send();
    });
}

function apiPost(url, body) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
        xhr.onload = () => {
            try { resolve(JSON.parse(xhr.responseText)); }
            catch (e) { reject(new Error('Invalid JSON response')); }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(JSON.stringify(body));
    });
}

async function load() {
    try {
        const data = await apiGet(API_URL + '?token=' + encodeURIComponent(TOKEN));
        apply(data);
    } catch (e) {
        $('calendar').innerHTML = `<div class="loading-state" style="color:#ff4757">Could not reach the kitchen database: ${esc(e.message)}</div>`;
    }
}

async function api(body) {
    return await apiPost(API_URL, { token: TOKEN, ...body });
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
        if (!text || seen.has(text.toLowerCase())) return;
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
        // onclick attribute makes the card tappable on iOS; the delegated handler below is a backup (opening is idempotent)
        return `<div class="day-card ${d.day.toLowerCase() === today.toLowerCase() ? 'today' : ''}" data-day="${esc(d.day)}">
            <div class="day-name">${esc(d.day)}${d.day.toLowerCase() === today.toLowerCase() ? ' 📍' : ''}</div>
            <div class="meal-section" style="cursor:pointer;" onclick="viewRecipeModal(${i})">
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
    try { await navigator.clipboard.writeText(text); alert('Copied the missing items to your clipboard.'); }
    catch (e) { alert(text); }
}

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

function viewRecipeModal(i) {
    const d = S.days[i];
    if (!d) return;
    $('modal-recipe-title').innerText = d.meal;
    $('modal-recipe-meta').innerText = `${String(d.day).toUpperCase()} | ⏱️ ${d.cook_time}m | 💰 $${d.cost} | 🔥 ${d.calories} cal (${d.macros})`;
    const raw = String(d.details || '');
    const [ingPart, stepPart = ''] = raw.replace('INGREDIENTS:', '').split('STEPS:');
    let steps = stepPart.split('\n').map(cleanStep).filter(Boolean);
    if (steps.length === 1) {
        steps = steps[0].match(/[^.!?]+[.!?]+(\s|$)/g) || [steps[0]];
        steps = steps.map(cleanStep).filter(Boolean);
    }
    $('modal-recipe-ingredients').innerHTML = (splitItems(ingPart).length ? splitItems(ingPart) : ['Check grocery list.']).map(x => `<li>• ${esc(x)}</li>`).join('');
    $('modal-recipe-steps').innerHTML = (steps.length ? steps : ['No directions logged.']).map(x => `<li>${esc(x)}</li>`).join('');
    openModal('recipe-modal');
}
function cleanStep(s) { s = String(s).replace(/^\s*(?:Step\s*)?\d+[.):]?\s*/i, '').trim(); return /^\d*[.)]?$/.test(s) ? '' : s; }

function renderPlans() {
    const box = document.querySelector('#plans-modal .modal-content');
    if (!box || box.dataset.built) return;
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
        <button class="btn-block mode-btn" onclick="openPicker()">📖 Pick from My Recipes</button>
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

// Backup for the recipe cards (opening a recipe twice is harmless).
document.addEventListener('click', e => {
    const mealCard = e.target.closest ? e.target.closest('.meal-section') : null;
    if (!mealCard) return;
    const dayCard = mealCard.closest('.day-card');
    if (!dayCard) return;
    const index = S.days.findIndex(d => String(d.day).toLowerCase() === String(dayCard.dataset.day).toLowerCase());
    if (index !== -1) viewRecipeModal(index);
});

/* ---------- Recipe picker ---------- */
let RECIPES = null;

function openPicker() {
    let m = $('picker-modal');
    if (!m) {
        m = document.createElement('div');
        m.id = 'picker-modal';
        m.className = 'modal-overlay';
        m.innerHTML = `<div class="modal-content" style="max-width:560px">
            <button class="modal-close" onclick="closeModal('picker-modal')">❌ Close</button>
            <h2 class="modal-header-text">📖 My Recipes</h2>
            <p style="color:var(--text-muted)">Cook it on: <select id="pick-day" class="task-text-field" style="width:auto;display:inline-block"></select></p>
            <input id="pick-search" type="text" class="task-text-field" placeholder="Search by name or type…" style="margin-bottom:12px">
            <div id="pick-list"></div>
            <p id="pick-status" style="color:var(--text-muted)"></p></div>`;
        document.body.appendChild(m);
        $('pick-search').addEventListener('input', renderPickList);
    }
    const planDay = $('plan-day') ? $('plan-day').value : 0;
    $('pick-day').innerHTML = S.days.map((d, i) => `<option value="${i}">${esc(d.day)}</option>`).join('');
    $('pick-day').value = planDay;
    $('pick-status').innerText = '';
    closeModal('plans-modal');
    openModal('picker-modal');
    if (RECIPES) { renderPickList(); return; }
    $('pick-list').innerHTML = '<p>Loading your recipes…</p>';
    apiGet(API_URL + '?token=' + encodeURIComponent(TOKEN) + '&recipes=1')
        .then(r => { RECIPES = r.recipes || []; renderPickList(); })
        .catch(() => { $('pick-list').innerHTML = '<p>Could not load recipes.</p>'; });
}

function renderPickList() {
    const q = $('pick-search').value.trim().toLowerCase();
    const list = (RECIPES || []).filter(r => !q || (r.name + ' ' + r.type).toLowerCase().indexOf(q) !== -1);
    $('pick-list').innerHTML = list.length
        ? list.map(r => `<button class="btn-block mode-btn" data-name="${esc(r.name)}" data-type="${esc(r.type)}" onclick="pickRecipe(this)" style="text-align:left;font-size:1.25rem">
              ${esc(r.name)} <span style="color:var(--text-muted);font-size:.9rem">${esc(r.type)}${r.days < 999 ? ' · cooked ' + r.days + 'd ago' : ''}</span></button>`).join('')
        : '<p>No recipes match.</p>';
}

async function pickRecipe(btn) {
    const st = $('pick-status');
    st.innerText = '✨ Setting up ' + btn.dataset.name + '…';
    try {
        const p = await api({ action: 'setRecipe', day: +$('pick-day').value, name: btn.dataset.name, type: btn.dataset.type });
        apply(p);
        RECIPES = null;                       // refresh "cooked X days ago" next time
        closeModal('picker-modal');
        if (p.warning) alert(p.warning);
    } catch (e) { st.innerText = 'Something went wrong. Try again.'; }
}

const nannyBtn = document.querySelector('#nanny-modal .btn-block');
if (nannyBtn) nannyBtn.onclick = saveNanny;
load();
