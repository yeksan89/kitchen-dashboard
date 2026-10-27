/* Kitchen Command Center front-end. Written to run on old Safari (iOS 15): no lookbehind, no :has, XHR instead of fetch. */
window.addEventListener('error', function (e) {
    var b = document.createElement('div');
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#c2493d;color:#fff;padding:6px 10px;z-index:9999;font:12px sans-serif';
    b.textContent = 'JS error: ' + e.message + ' (line ' + e.lineno + ')';
    document.body.appendChild(b);
});

// Your Apps Script web app address (ends in /exec). Nothing secret lives in this file: the PIN is typed on each device.
const API_URL = "hhttps://script.google.com/macros/s/AKfycbyAOfM98QFtmQygFFzffBn4p4pSzaz80ykCFbitHeE0hcyYUkXadNpC2zkSUjo7-7us/exec";

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HIJRI_MONTHS = ['Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani", 'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah'];
const AISLE_ORDER = ['Produce', 'Meat & Fish', 'Dairy & Eggs', 'Bakery', 'Pantry', 'Spices', 'Frozen', 'Other'];
const ART = {
    crescent: '<svg viewBox="0 0 40 40"><path d="M26 4a16 16 0 1 0 8 26A13 13 0 1 1 26 4z" fill="#d9b44a" stroke="#a8842c" stroke-width="1"/><path d="M31 8l1.2 3 3 .4-2.3 2 .7 3-2.6-1.7-2.6 1.7.7-3-2.3-2 3-.4z" fill="#f3dc8a"/></svg>',
    lantern: '<svg viewBox="0 0 40 40"><path d="M20 2v5M14 7h12M13 10h14l3 8-3 12H13L10 18z" fill="#e8c25a" stroke="#a8842c" stroke-width="1.2"/><path d="M20 10v20M13 18h14M14 30h12v4H14z" stroke="#a8842c" stroke-width="1" fill="none"/></svg>',
    star: '<svg viewBox="0 0 40 40"><path d="M20 3l4.5 11 11.5.5-9 7.3 3 11.2-10-6.4-10 6.4 3-11.2-9-7.3 11.5-.5z" fill="#d9b44a" stroke="#a8842c"/></svg>'
};
const SPECIAL = [
    { m: 1, d: [1], name: 'Islamic New Year', greet: 'Happy Hijri New Year', kind: 'special' },
    { m: 1, d: [10], name: 'Ashura', greet: 'Day of Ashura', kind: 'special' },
    { m: 3, d: [12], name: 'Mawlid al-Nabi', greet: 'Mawlid Mubarak', kind: 'special' },
    { m: 7, d: [27], name: "Isra and Mi'raj", greet: "Blessed Isra and Mi'raj", kind: 'special' },
    { m: 8, d: [15], name: "Laylat al-Bara'at", greet: "Blessed Mid-Sha'ban", kind: 'special' },
    { m: 9, d: [1], name: 'First day of Ramadan', greet: 'Ramadan Mubarak', kind: 'special' },
    { m: 9, d: [27], name: 'Laylat al-Qadr', greet: 'Blessed Laylat al-Qadr', kind: 'special' },
    { m: 10, d: [1, 2, 3], name: 'Eid al-Fitr', greet: 'Eid Mubarak', kind: 'eid' },
    { m: 12, d: [9], name: 'Day of Arafah', greet: 'Blessed Day of Arafah', kind: 'special' },
    { m: 12, d: [10, 11, 12], name: 'Eid al-Adha', greet: 'Eid Mubarak', kind: 'eid' }
];
const RAGHAIB = { name: 'Laylat al-Raghaib', greet: 'Blessed Raghaib', kind: 'special' };
const PREVIEWS = { '': 'Off (real date)', ramadan: 'Ramadan', fitr: 'Eid al-Fitr', adha: 'Eid al-Adha', isra: "Isra and Mi'raj (a special day)" };
const PREVIEW_SPECIAL = { fitr: SPECIAL[7], adha: SPECIAL[9], isra: SPECIAL[3] };

let PIN = lsGet('kd_pin') || '', D = null, WK = 'cur', GWK = 'cur', PW = 'next', PREVIEW = '', RECIPES = null, STAPLE_OPEN = false;

/* ---------- helpers ---------- */
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
function splitItems(str) {
    var s = String(str || '');
    return (s.indexOf('\n') !== -1 ? s.split('\n') : s.split(/,(?![^(]*\))/)).map(function (x) { return x.trim(); }).filter(Boolean);
}
function addDays(ymd, n) {
    var p = ymd.split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}
function dowOf(ymd) { var p = ymd.split('-').map(Number); return (new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() + 6) % 7; }
function fmtDate(ymd) { var p = ymd.split('-').map(Number); return MONTHS[p[1] - 1] + ' ' + p[2]; }
function canEdit() { return !!D && D.role === 'parent'; }
function W() { return D[WK]; }
function hijriText(h) { return h ? h[0] + ' ' + HIJRI_MONTHS[h[1] - 1] + ' ' + h[2] + ' AH' : ''; }
function hijriOf(ymd) { return ymd === D.today ? D.islamic.today : ((D.hijri && D.hijri[ymd]) || null); }

/* ---------- server calls and PIN ---------- */
function api(body) {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', API_URL);
        xhr.setRequestHeader('Content-Type', 'text/plain;charset=utf-8');
        xhr.onload = function () {
            var j;
            try { j = JSON.parse(xhr.responseText); } catch (e) { reject(new Error('Invalid response')); return; }
            if (j.error === 'unauthorized') { PIN = ''; lsDel('kd_pin'); lsDel('kd_cache'); showGate('That PIN did not work. Try again.'); reject(new Error('unauthorized')); return; }
            if (j.error === 'locked') { showGate('Too many wrong tries. Please wait 10 minutes.'); reject(new Error('locked')); return; }
            resolve(j);
        };
        xhr.onerror = function () { reject(new Error('Network error')); };
        xhr.send(JSON.stringify(Object.assign({ pin: PIN }, body)));
    });
}
function showGate(msg) {
    $('pin-msg').textContent = msg || 'Enter your PIN';
    $('pin-gate').classList.add('active');
    setTimeout(function () { $('pin-input').focus(); }, 150);
}
function submitPin() {
    var v = $('pin-input').value.trim();
    if (!v) return;
    PIN = v; lsSet('kd_pin', v);
    $('pin-input').value = '';
    $('pin-gate').classList.remove('active');
    refresh();
}
function apply(p) {
    if (p.error) {
        if (!D) $('calendar').innerHTML = '<div class="loading-state" style="color:#c2493d">' + esc(p.error) + '</div>';
        return p;
    }
    D = p;
    lsSet('kd_cache', JSON.stringify(p));
    render();
    return p;
}
function refresh() {
    if (!PIN) { showGate(); return Promise.resolve(); }
    return api({ action: 'get' }).then(apply).catch(function (e) {
        if (!D) $('calendar').innerHTML = '<div class="loading-state" style="color:#c2493d">Could not reach the kitchen database: ' + esc(e.message) + '</div>';
    });
}
function act(body) { return api(body).then(function (p) { if (p.error) { alert(p.error); return p; } return apply(p); }); }

/* ---------- Hijri, special days, themes ---------- */
function specialFor(h, effDow) {
    if (!h) return null;
    for (var i = 0; i < SPECIAL.length; i++) if (SPECIAL[i].m === h[1] && SPECIAL[i].d.indexOf(h[0]) !== -1) return SPECIAL[i];
    if (h[1] === 7 && h[0] <= 7 && effDow === 4) return RAGHAIB;     // night before the first Friday of Rajab (begins Thursday at Maghrib)
    return null;
}
function cardSpecial(i, ymd) {
    var isToday = ymd === D.today;
    if (isToday && PREVIEW && PREVIEW_SPECIAL[PREVIEW]) return PREVIEW_SPECIAL[PREVIEW];
    return specialFor(hijriOf(ymd), i + (isToday ? D.islamic.shift : 0));
}
function todaySpecial() { return cardSpecial(dowOf(D.today), D.today); }
function isRamadan() {
    if (PREVIEW) return PREVIEW === 'ramadan';
    return !!(D.islamic.today && D.islamic.today[1] === 9);
}
function applyTheme() {
    var sp = todaySpecial(), ram = isRamadan();
    document.body.className = (ram ? 'ramadan ' : '') + (sp && sp.kind === 'eid' ? 'eid' : '');
    var b = $('special-banner'), html = '';
    if (sp) html = '<div class="banner">' + (sp.kind === 'eid' ? ART.star + ART.crescent : ART.crescent) + '<span>' + esc(sp.greet) + ' <small style="font-size:1rem;font-weight:normal">· ' + esc(sp.name) + (sp.name === RAGHAIB.name ? ' (from Thursday Maghrib)' : '') + '</small></span>' + (sp.kind === 'eid' ? ART.star : ART.lantern) + '</div>';
    else if (ram) html = '<div class="banner">' + ART.crescent + '<span>Ramadan Mubarak</span>' + ART.lantern + '</div>';
    else if (dowOf(D.today) === 4) html = '<div class="banner">' + ART.crescent + "<span>Jumu'ah Mubarak</span>" + ART.lantern + '</div>';
    b.innerHTML = html;
}

/* ---------- rendering ---------- */
function render() {
    if (!D) return;
    applyTheme();
    var now = new Date();
    $('current-date').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    var h = D.islamic.today;
    $('hijri-date').textContent = h ? hijriText(h) : '';
    renderRibbon();
    renderStatus();
    $('tab-cur').className = 'btn' + (WK === 'cur' ? ' on' : '');
    $('tab-next').className = 'btn' + (WK === 'next' ? ' on' : '');
    $('tab-cur').textContent = 'This week';
    $('tab-next').textContent = 'Next week' + (D.next.planned ? ' ✓' : '');
    var w = W();
    $('week-note').textContent = 'Week of ' + fmtDate(w.weekStart) + (w.planned ? (w.generatedAt ? ' · planned ' + fmtDate(w.generatedAt) : '') : ' · not planned yet');
    $('btn-plans').style.display = canEdit() ? '' : 'none';
    $('btn-planweek').style.display = canEdit() ? '' : 'none';
    $('btn-recipes').style.display = canEdit() ? '' : 'none';
    renderCalendar();
    if ($('grocery-modal').classList.contains('active')) renderGrocery();
}
function renderRibbon() {
    var pr = D.prayer, box = $('prayer-ribbon-content');
    if (!pr) { box.innerHTML = '<span style="color:var(--muted)">Prayer times unavailable right now</span>'; return; }
    var ram = isRamadan(), nodes = [];
    if (ram) nodes.push(['Suhoor ends', pr.Fajr, true]);
    ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].forEach(function (n) { nodes.push([n, pr[n], false]); });
    if (ram) nodes.push(['Iftar', pr.Maghrib, true]);
    box.innerHTML = nodes.map(function (n) {
        return '<div class="prayer-time-node' + (n[2] ? ' iftar' : '') + '"><span class="p-name">' + (n[2] ? '✦ ' : '◯ ') + esc(n[0]) + '</span><span class="p-time">' + esc(n[1]) + '</span></div>';
    }).join('');
}
function parseChores(w, i) {
    var d = w.days[i], seen = {}, tasks = [];
    String(d.chore || '').split('|').forEach(function (raw) {
        var owner = raw.indexOf('[A]') !== -1 ? 'A' : raw.indexOf('[E]') !== -1 ? 'E' : '';
        var text = raw.replace('[A]', '').replace('[E]', '').trim();
        if (!text || seen[text.toLowerCase()]) return;
        seen[text.toLowerCase()] = true;
        tasks.push({ text: text, owner: owner });
    });
    ((w.state.extra || {})[i] || []).forEach(function (t) { tasks.push({ text: t, owner: '' }); });
    return tasks;
}
function setWeek(wk) { WK = wk; render(); }
function renderCalendar() {
    var w = W(), cal = $('calendar');
    if (!w.planned) {
        cal.innerHTML = '<div class="loading-state">' + (WK === 'next' ? 'Next week is not planned yet.' : 'There is no plan for this week yet.') + '<br>'
            + (canEdit() ? '<button class="btn" onclick="openPlanWeek()">🗓️ Plan it now</button>' : 'Ask a parent to plan it.') + '</div>';
        return;
    }
    cal.innerHTML = w.days.map(function (d, i) { return cardHtml(d, i, w); }).join('');
}
function cardHtml(d, i, w) {
    var ymd = addDays(w.weekStart, i), isToday = ymd === D.today, h = hijriOf(ymd), sp = cardSpecial(i, ymd), edit = canEdit();
    var cuisine = String(d.cuisine || 'standard').toLowerCase().replace(/[^a-z]/g, '') || 'standard';
    var tasks = parseChores(w, i).map(function (t) {
        if (t.text.indexOf('✨') === 0) return '<div class="chore-row-text-string">' + esc(t.text) + '</div>';
        var k = 'c:' + i + ':' + t.text.toLowerCase(), done = !!w.state.done[k];
        var cls = t.owner === 'A' ? 'owner-a' : t.owner === 'E' ? 'owner-e' : 'unassigned';
        return '<label class="single-chore-row-item"><input type="checkbox" data-k="' + esc(k) + '"' + (done ? ' checked' : '') + (edit ? '' : ' disabled') + '>'
            + '<span class="user-badge-profile ' + cls + '">' + (t.owner || '•') + '</span><span class="chore-row-text-string txt' + (done ? ' done' : '') + '">' + esc(t.text) + '</span></label>';
    }).join('');
    var art = (i === 4 || sp) ? '<div class="card-art">' + (sp && sp.kind === 'eid' ? ART.star + ART.crescent : ART.crescent + (i === 4 ? ART.lantern : '')) + '</div>' : '';
    var tag = sp ? '<div class="special-tag">✦ ' + esc(sp.greet) + ' · ' + esc(sp.name) + '</div>' : (i === 4 ? '<div class="special-tag">✦ Jumu\'ah Mubarak</div>' : '');
    var metrics = (Number(d.calories) || Number(d.cook_time))
        ? '<div class="meta-metrics-row"><span>⏱️ ' + esc(d.cook_time) + 'm</span><span>💰 $' + esc(d.cost) + '</span><span>🔥 ≈' + esc(d.calories) + ' cal/serving</span></div>' : '';
    var isOpen = String(d.meal).indexOf('📌') === 0;
    var warnTag = d.warn ? '<div class="warn-tag">⚠️ Contains ' + esc(d.warn) + '</div>' : '';
    var openBtn = isOpen ? '<div class="open-night">Nothing planned yet.</div>' + (edit ? '<button class="btn open-btn" onclick="event.stopPropagation();openPlans(' + i + ')">Pick a meal</button>' : '') : '';
    var addTask = edit ? '<div class="add-task-container"><button class="add-task-inline-btn" onclick="toggleTaskInput(this)">+ Add Task</button>'
        + '<div class="task-input-hidden-row" style="display:none;"><input type="text" class="task-text-field"><button onclick="addTask(this, ' + i + ')">➕</button></div></div>' : '';
    return '<div class="day-card' + (isToday ? ' today' : '') + (i === 4 ? ' friday' : '') + (sp ? ' special ' + sp.kind : '') + '" data-day="' + esc(d.day) + '">' + art
        + '<div class="day-name">' + esc(d.day) + (isToday ? ' 📍' : '') + '<small>' + fmtDate(ymd) + (h ? ' · ' + h[0] + ' ' + HIJRI_MONTHS[h[1] - 1] : '') + '</small></div>' + tag
        + '<div class="meal-section" data-i="' + i + '" style="cursor:pointer;" onclick="cardTap(' + i + ')">'
        + '<span class="cuisine-tag ' + cuisine + '">' + esc(cuisine) + '</span><p class="meal-title">' + esc(isOpen ? 'Open night' : (d.meal || 'No meal planned')) + '</p>' + metrics + warnTag + openBtn + '</div>'
        + '<div class="chore-section"><div class="chore-box"><div class="chores-list-sub-container">' + (tasks || '<span class="hint">No chores</span>') + '</div></div>' + addTask + '</div></div>';
}
function toggleTaskInput(btn) { var r = btn.nextElementSibling; r.style.display = r.style.display === 'none' ? 'flex' : 'none'; }
function addTask(btn, i) {
    var t = btn.previousElementSibling.value.trim();
    if (!t) return;
    var w = W(), wk = WK;
    (w.state.extra[i] = w.state.extra[i] || []).push(t);
    render();
    act({ action: 'addTask', week: wk, day: i, text: t });
}

/* ---------- recipe popup ---------- */
function cleanStep(s) { s = String(s).replace(/^\s*(?:Step\s*)?\d+[.):]?\s*/i, '').trim(); return /^\d*[.)]?$/.test(s) ? '' : s; }
function cardTap(i) {
    var d = W().days[i];
    if (!d) return;
    if (String(d.meal).indexOf('📌') === 0) { if (canEdit()) openPlans(i); return; }
    viewRecipeModal(i);
}
function section(t, name) {
    var names = ['SERVINGS', 'SCALE', 'SOURCE', 'INGREDIENTS', 'ORIGINAL', 'STEPS'];
    var m = new RegExp('(?:^|\\n)' + name + ':\\n?([\\s\\S]*?)(?=\\n(?:' + names.join('|') + '):|$)').exec(t);
    return m ? m[1].trim() : '';
}
var RV = null;
function viewRecipeModal(i) {
    var d = W().days[i];
    if (!d || !d.meal) return;
    var t = String(d.details || '');
    var scale = parseFloat(section(t, 'SCALE')) || 1, servings = section(t, 'SERVINGS'), source = section(t, 'SOURCE');
    var scaled = splitItems(section(t, 'INGREDIENTS')), orig = splitItems(section(t, 'ORIGINAL'));
    var steps = section(t, 'STEPS').split('\n').map(cleanStep).filter(Boolean);
    if (steps.length === 1) steps = (steps[0].match(/[^.!?]+[.!?]+(\s|$)/g) || [steps[0]]).map(cleanStep).filter(Boolean);
    if (!section(t, 'INGREDIENTS') && t.indexOf('INGREDIENTS:') !== -1) scaled = splitItems(t.replace('INGREDIENTS:', '').split('STEPS:')[0]);   // older plans
    var isLeft = /^leftover/i.test(d.meal);
    RV = { scaled: scaled, orig: orig, view: 'scaled' };
    $('modal-recipe-title').textContent = d.meal;
    $('modal-recipe-meta').textContent = d.day.toUpperCase() + (Number(d.calories) ? ' | ⏱️ ' + d.cook_time + 'm | 💰 ≈$' + d.cost + ' | 🔥 ≈' + d.calories + ' cal per serving (' + d.macros + ')' : '');
    $('modal-recipe-warn').innerHTML = d.warn ? '<div class="warn-tag">⚠️ Contains ' + esc(d.warn) + ' (the original ingredient was kept). Please check before cooking.</div>' : '';
    var a = $('modal-recipe-link');
    if (d.url && /^https?:\/\//i.test(d.url)) { a.href = d.url; a.style.display = 'inline-block'; } else { a.style.display = 'none'; a.removeAttribute('href'); }
    var note = '';
    if (scaled.length && scale > 1.01) note = '<div class="scale-note">Original recipe serves <b>' + esc(servings) + '</b>. Scaled <b>×' + scale + '</b> to serve <b>6</b> (two dinners). Quantities written inside the steps are from the original recipe.</div>';
    else if (scaled.length && servings) note = '<div class="scale-note">Made as written. Serves <b>' + esc(servings) + '</b>.</div>';
    if (scaled.length && source) note += '<div class="hint">Source: ' + esc(source) + '</div>';
    $('modal-recipe-note').innerHTML = note;
    drawIngredients(scale > 1.01 && orig.length);
    var noSteps = isLeft ? ['Reheat and enjoy. The recipe is on the cook day.'] : ['No directions logged.'];
    $('modal-recipe-steps').innerHTML = (steps.length ? steps : noSteps).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
    openModal('recipe-modal');
}
function drawIngredients(canToggle) {
    var list = RV.view === 'orig' ? RV.orig : RV.scaled;
    if (!list.length) list = [/leftover/i.test($('modal-recipe-title').textContent) ? 'Leftovers: see the cook day for the ingredient list.' : 'No ingredients logged.'];
    $('modal-recipe-toggle').innerHTML = canToggle
        ? '<button class="btn' + (RV.view === 'scaled' ? ' on' : '') + '" onclick="setIngView(\'scaled\')">Scaled</button><button class="btn' + (RV.view === 'orig' ? ' on' : '') + '" onclick="setIngView(\'orig\')">Original</button>' : '';
    $('modal-recipe-ingredients').innerHTML = list.map(function (x) { return '<li' + (RV.view === 'orig' ? ' class="ing-orig"' : '') + '>• ' + esc(x) + '</li>'; }).join('');
}
function setIngView(v) { RV.view = v; drawIngredients(true); }

/* ---------- grocery planner ---------- */
function defaultGW() {
    var n = new Date(), dow = (n.getDay() + 6) % 7, hr = n.getHours();
    return (D.next.planned && ((dow === 4 && hr >= 18) || dow >= 5)) ? 'next' : 'cur';
}
function setGW(g) { GWK = g; renderGrocery(); }
function renderGrocery() {
    if (!D) return;
    var w = D[GWK], edit = canEdit(), dis = edit ? '' : ' disabled';
    var h = '<div class="gtabs"><button class="btn' + (GWK === 'cur' ? ' on' : '') + '" onclick="setGW(\'cur\')">This week</button><button class="btn' + (GWK === 'next' ? ' on' : '') + '" onclick="setGW(\'next\')">Next week</button></div>';
    h += '<h4>✍️ My items</h4>';
    if (!D.my.items.length) h += '<p class="hint">Add anything you need. Items stay until you delete them.</p>';
    D.my.items.forEach(function (it) {
        h += '<label class="grocery-row"><input type="checkbox" data-k="m:' + esc(it.id) + '"' + (it.done ? ' checked' : '') + dis + '> <span class="txt' + (it.done ? ' done' : '') + '">' + esc(it.text) + '</span>'
            + (edit ? '<button type="button" class="x" data-id="' + esc(it.id) + '" onclick="myDel(this)">✕</button>' : '') + '</label>';
    });
    if (edit) h += '<div class="addrow"><input id="my-input" class="task-text-field" placeholder="e.g. paper towels"><button type="button" onclick="myAdd()">➕</button></div>';

    var out = D.my.staples.filter(function (s) { return s.out; }).length;
    h += '<details class="staples"' + (STAPLE_OPEN ? ' open' : '') + ' ontoggle="STAPLE_OPEN=this.open"><summary>🧂 Staples (' + out + ' out)</summary>'
        + '<p class="hint">Things you normally keep at home. They stay off the shopping list; tick one when it runs out.</p>';
    D.my.staples.forEach(function (s) {
        h += '<label class="grocery-row"><input type="checkbox" data-k="o:' + esc(s.name) + '"' + (s.out ? ' checked' : '') + dis + '> <span class="txt">' + esc(s.name)
            + ((w.stapleUse || []).indexOf(s.name) !== -1 ? ' <small>(used this week)</small>' : '') + '</span>'
            + (edit ? '<button type="button" class="x" data-name="' + esc(s.name) + '" onclick="stapleDel(this)">✕</button>' : '') + '</label>';
    });
    if (edit) h += '<div class="addrow"><input id="staple-input" class="task-text-field" placeholder="Add a staple, e.g. olive oil"><button type="button" onclick="stapleAdd()">➕</button></div>';
    h += '</details>';

    h += '<h4>🛒 From the meal plan</h4>';
    if (!w.planned) h += '<p class="hint">This week has no plan yet.</p>';
    else h += '<p class="hint">Tick what you already have or have bought.</p>';
    var aisle = '';
    (w.shopping || []).forEach(function (it) {
        if (it.aisle !== aisle) { h += '<h4>' + esc(it.aisle) + '</h4>'; aisle = it.aisle; }
        var have = !it.staple && !!w.state.have[it.key], k = it.staple ? 'b:' + it.staple : 'h:' + it.key;
        h += '<label class="grocery-row"><input type="checkbox" data-k="' + esc(k) + '"' + (have ? ' checked' : '') + dis + '> <span class="txt' + (have ? ' done' : '') + '">' + esc(it.name)
            + (it.amount ? ' <small>— ' + esc(it.amount) + '</small>' : '') + (it.staple ? ' 🧂' : '') + '</span></label>';
    });
    $('grocery-master-content').innerHTML = h;
    refreshQR();
}
function listLines() {
    var w = D[GWK], by = {}, lines = [];
    (w.shopping || []).forEach(function (it) {
        if (!it.staple && w.state.have[it.key]) return;
        (by[it.aisle] = by[it.aisle] || []).push(it.name + (it.amount ? ' — ' + it.amount : ''));
    });
    AISLE_ORDER.forEach(function (a) { if (by[a]) { lines.push(a.toUpperCase()); by[a].forEach(function (x) { lines.push('- ' + x); }); } });
    var mine = D.my.items.filter(function (i) { return !i.done; });
    if (mine.length) { lines.push('MY ITEMS'); mine.forEach(function (i) { lines.push('- ' + i.text); }); }
    return lines;
}
function refreshQR() {
    var lines = listLines(), n = lines.filter(function (l) { return l.indexOf('- ') === 0; }).length;
    var text = 'Grocery list:\n' + lines.join('\n');
    if (!n) { $('qr-box').innerHTML = '<p>You have everything! 🎉</p>'; return; }
    $('qr-box').innerHTML = (text.length <= 800
        ? '<img src="https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=' + encodeURIComponent(text) + '" alt="QR">'
        : '<p class="hint">The list is long for a QR code. Use Share / Copy.</p>')
        + '<p style="margin:8px 0 0">' + n + ' items to buy</p><button class="btn" style="margin-top:8px" onclick="shareList()">📤 Share / Copy</button>';
}
function shareList() {
    var text = 'Grocery list:\n' + listLines().join('\n');
    if (navigator.share) { navigator.share({ text: text }).catch(function () { /* cancelled */ }); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { alert('Copied the list.'); }, function () { alert(text); }); return; }
    alert(text);
}
function myAdd() { var v = $('my-input').value.trim(); if (v) act({ action: 'myAdd', text: v }); }
function myDel(b) { act({ action: 'myDel', id: b.dataset.id }); }
function stapleAdd() { var v = $('staple-input').value.trim(); if (v) { STAPLE_OPEN = true; act({ action: 'stapleAdd', name: v }); } }
function stapleDel(b) { if (confirm('Remove ' + b.dataset.name + ' from your staples?')) act({ action: 'stapleDel', name: b.dataset.name }); }

/* ---------- checkboxes (chores, groceries, staples) ---------- */
document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'nanny-meal') { syncNannyRadios(); return; }
    var k = t.dataset && t.dataset.k;
    if (!k || !D || !canEdit()) return;
    var on = t.checked, p = k.slice(0, 2), key = k.slice(2), txt = t.closest('label') ? t.closest('label').querySelector('.txt') : null;
    if (txt) txt.className = txt.className.replace(/\s*done/g, '') + (on ? ' done' : '');
    if (p === 'c:') { W().state.done[k] = on; api({ action: 'toggle', week: WK, key: k, value: on }); }
    else if (p === 'h:') { D[GWK].state.have[key] = on; refreshQR(); api({ action: 'have', week: GWK, key: key, value: on }); }
    else if (p === 'm:') { D.my.items.forEach(function (i) { if (i.id === key) i.done = on; }); refreshQR(); api({ action: 'myToggle', id: key, value: on }); }
    else if (p === 'o:') { act({ action: 'stapleOut', name: key, value: on }); }
    else if (p === 'b:') { act({ action: 'stapleOut', name: key, value: false }); }
});
// backup so recipe cards open on every iPad (opening twice is harmless)
document.addEventListener('click', function (e) {
    var m = e.target.closest ? e.target.closest('.meal-section') : null;
    if (m && m.dataset.i !== undefined && D) cardTap(Number(m.dataset.i));
});

/* ---------- Change of Plans ---------- */
function openPlans(pre) {
    if (!canEdit()) return;
    var w = W();
    if (!w.planned) { alert('There is no plan for that week yet. Use "Plan a Week" first.'); return; }
    var opts = w.days.map(function (d, i) { return '<option value="' + i + '">' + esc(d.day) + '</option>'; }).join('');
    var ti = (pre !== undefined && pre !== null && !isNaN(pre)) ? pre : Math.max(0, dowOf(D.today));
    $('plans-modal').firstElementChild.innerHTML = '<button class="modal-close" onclick="closeModal(\'plans-modal\')">❌ Close</button>'
        + '<h2 class="modal-header-text">🔄 Change of Plans</h2><p class="hint">Changing: <b>' + (WK === 'cur' ? 'This week' : 'Next week') + '</b></p><p style="color:var(--muted)">Which day?</p>'
        + '<select id="plan-day" class="task-text-field" style="margin-bottom:15px">' + opts + '</select>'
        + '<button class="btn-block mode-btn" onclick="plan(\'takeout\')">🥡 Order Takeout</button>'
        + '<button class="btn-block mode-btn" onclick="plan(\'push\')">❄️ Push to Next Week</button>'
        + '<div style="display:flex;gap:8px;margin-bottom:12px"><select id="plan-swap" class="task-text-field">' + opts + '</select><button class="btn" style="white-space:nowrap" onclick="plan(\'swap\')">🔀 Swap with this day</button></div>'
        + '<button class="btn-block mode-btn" onclick="openPicker()">📖 Pick from My Recipes</button>'
        + '<button class="btn-block mode-btn highlight" onclick="plan(\'newDish\')">✨ Try Something New</button><p id="plan-status" class="hint"></p>';
    $('plan-day').value = ti; $('plan-swap').value = Math.min(ti + 1, 6);
    openModal('plans-modal');
}
function plan(action) {
    var day = +$('plan-day').value, b = +$('plan-swap').value, st = $('plan-status');
    if (action === 'swap' && day === b) { st.textContent = 'Pick two different days.'; return; }
    st.textContent = action === 'newDish' ? '✨ Asking Gemini for a fresh idea…' : 'Updating…';
    api({ action: action, week: WK, day: day, a: day, b: b }).then(function (p) {
        if (p.error) { st.textContent = p.error; return; }
        apply(p); closeModal('plans-modal');
    }).catch(function () { st.textContent = 'Something went wrong. Try again.'; });
}
function openPicker() {
    var m = $('picker-modal');
    if (!m) {
        m = document.createElement('div');
        m.id = 'picker-modal'; m.className = 'modal-overlay';
        m.innerHTML = '<div class="modal-content" style="max-width:560px"><button class="modal-close" onclick="closeModal(\'picker-modal\')">❌ Close</button>'
            + '<h2 class="modal-header-text">📖 My Recipes</h2><p style="color:var(--muted)">Cook it on: <select id="pick-day" class="task-text-field" style="width:auto;display:inline-block"></select></p>'
            + '<input id="pick-search" type="text" class="task-text-field" placeholder="Search by name or type…" style="margin-bottom:12px"><div id="pick-list"></div><p id="pick-status" class="hint"></p></div>';
        document.body.appendChild(m);
        $('pick-search').addEventListener('input', renderPickList);
    }
    var pd = $('plan-day') ? $('plan-day').value : 0;
    $('pick-day').innerHTML = W().days.map(function (d, i) { return '<option value="' + i + '">' + esc(d.day) + '</option>'; }).join('');
    $('pick-day').value = pd; $('pick-status').textContent = '';
    closeModal('plans-modal'); openModal('picker-modal');
    if (RECIPES) { renderPickList(); return; }
    $('pick-list').innerHTML = '<p>Loading your recipes…</p>';
    api({ action: 'listRecipes' }).then(function (r) { RECIPES = r.recipes || []; renderPickList(); }).catch(function () { $('pick-list').innerHTML = '<p>Could not load recipes.</p>'; });
}
function renderPickList() {
    var q = $('pick-search').value.trim().toLowerCase();
    var list = (RECIPES || []).filter(function (r) { return !q || (r.name + ' ' + r.type).toLowerCase().indexOf(q) !== -1; });
    $('pick-list').innerHTML = list.length ? list.map(function (r) {
        return '<button class="btn-block mode-btn" data-name="' + esc(r.name) + '" data-type="' + esc(r.type) + '" onclick="pickRecipe(this)" style="text-align:left;font-size:1.25rem">'
            + esc(r.name) + (r.flagged ? ' ⚠️' : '') + ' <span style="color:var(--muted);font-size:.9rem">' + esc(r.type) + (r.servings ? ' · serves ' + r.servings : '') + (r.noDetails ? ' · no details yet' : '') + (r.days < 999 ? ' · cooked ' + r.days + 'd ago' : '') + '</span></button>';
    }).join('') : '<p>No recipes match.</p>';
}
function pickRecipe(btn) {
    var st = $('pick-status');
    st.textContent = '✨ Setting up ' + btn.dataset.name + '…';
    api({ action: 'setRecipe', week: WK, day: +$('pick-day').value, name: btn.dataset.name }).then(function (p) {
        if (p.error) { st.textContent = p.error; return; }
        apply(p); RECIPES = null; closeModal('picker-modal');
        if (p.warning) alert(p.warning);
    }).catch(function () { st.textContent = 'Something went wrong. Try again.'; });
}

/* ---------- Plan a Week: fridge, cleaning lady, generate ---------- */
function openPlanWeek() { if (!canEdit()) return; PW = 'next'; drawPlanWeek(); openModal('planweek-modal'); }
function setPW(v) { PW = v; drawPlanWeek(); }
function drawPlanWeek() {
    var c = D[PW].cleaner || { coming: true, day: 4 };
    var dayOpts = DAYS.map(function (d, i) { return '<option value="' + i + '"' + (i === c.day ? ' selected' : '') + '>' + d + '</option>'; }).join('');
    $('planweek-modal').firstElementChild.innerHTML = '<button class="modal-close" onclick="closeModal(\'planweek-modal\')">❌ Close</button>'
        + '<h2 class="modal-header-text">🗓️ Plan a Week</h2>'
        + '<div class="opt-row"><label><input type="radio" name="pw" ' + (PW === 'next' ? 'checked' : '') + ' onchange="setPW(\'next\')"> Next week</label>'
        + '<label><input type="radio" name="pw" ' + (PW === 'cur' ? 'checked' : '') + ' onchange="setPW(\'cur\')"> This week (replaces the current plan)</label></div>'
        + '<h4>🧹 Cleaning lady</h4><div class="opt-row"><label><input type="checkbox" id="cl-on"' + (c.coming ? ' checked' : '') + ' onchange="saveCleaner()"> She is coming</label> on '
        + '<select id="cl-day" class="task-text-field" style="width:auto" onchange="saveCleaner()">' + dayOpts + '</select></div>'
        + '<p class="hint">Applies to the week chosen above and updates its chores right away.</p>'
        + '<h4>🥕 What is in the fridge?</h4><textarea id="fridge" class="fridge-box" rows="3" placeholder="e.g. zucchini, chicken thighs, half a cabbage, yogurt" onchange="saveFridge()">' + esc(D.settings.fridge) + '</textarea>'
        + '<p class="hint">Used once for the next plan you build, then cleared. Leave empty to plan normally.</p>'
        + '<button id="gen-btn" class="btn-block mode-btn highlight" onclick="generateNow()">✨ Generate plan now</button><p id="gen-status" class="hint"></p>'
        + '<p class="hint">Every Friday at 6pm the app also builds next week\'s plan by itself and emails you both.</p>';
}
function saveCleaner() { act({ action: 'cleaner', week: PW, coming: $('cl-on').checked, day: +$('cl-day').value }); }
function saveFridge() { act({ action: 'fridge', text: $('fridge').value }); }
function generateNow() {
    if (PW === 'cur' && !confirm('Replace this week\'s plan with a new one?')) return;
    var btn = $('gen-btn'), st = $('gen-status');
    btn.disabled = true; st.textContent = '✨ Planning… this can take up to a minute.';
    api({ action: 'fridge', text: $('fridge').value }).then(function () { return api({ action: 'generate', target: PW }); }).then(function (p) {
        if (p.error) throw new Error(p.error);
        apply(p); setWeek(PW); closeModal('planweek-modal');
    }).catch(function (e) { st.textContent = 'Could not plan: ' + e.message; btn.disabled = false; });
}

/* ---------- Hijri settings and preview ---------- */
function openSettings() {
    if (!D) return;
    var edit = canEdit(), s = D.settings, h = D.islamic.today;
    var pv = Object.keys(PREVIEWS).map(function (k) { return '<option value="' + k + '"' + (PREVIEW === k ? ' selected' : '') + '>' + PREVIEWS[k] + '</option>'; }).join('');
    var eid = function (v, label) { return '<label><input type="radio" name="eid" value="' + v + '"' + (s.eid === v ? ' checked' : '') + ' onchange="saveEid(\'' + v + '\')"> ' + label + '</label> '; };
    $('settings-modal').firstElementChild.innerHTML = '<button class="modal-close" onclick="closeModal(\'settings-modal\')">❌ Close</button>'
        + '<h2 class="modal-header-text">🌙 Hijri date and special days</h2><p>' + (h ? esc(hijriText(h)) : 'Hijri date unavailable right now') + '</p>'
        + (edit ? '<h4>Date adjustment</h4><div class="opt-row"><select id="hj-adj" class="task-text-field" style="width:auto" onchange="saveAdj()">'
            + '<option value="-1">−1 day</option><option value="0">As calculated</option><option value="1">+1 day</option></select></div>'
            + '<p class="hint">Use this if your community\'s date differs by a day. The Hijri day changes at Maghrib.</p>'
            + '<h4>Today is Eid</h4><div class="opt-row">' + eid('', 'No') + eid('fitr', 'Eid al-Fitr') + eid('adha', 'Eid al-Adha') + '</div>'
            + '<p class="hint">Switch it on once Eid is announced. It turns itself off at midnight.</p>' : '')
        + '<h4>👀 Preview a design</h4><select id="pv" class="task-text-field" onchange="setPreview(this.value)">' + pv + '</select>'
        + '<p class="hint">Only on this device, and it resets when you refresh.</p>'
        + '<h4>📅 Upcoming Islamic dates</h4><div id="upcoming">Loading…</div>'
        + (edit ? '<h4>🩺 Diagnostics</h4><div id="diag">Loading…</div>' : '');
    if (edit) $('hj-adj').value = String(s.hijriAdjust);
    openModal('settings-modal');
    if (edit) loadDiag();
    api({ action: 'upcoming' }).then(function (r) {
        var u = r.upcoming || [];
        $('upcoming').innerHTML = u.length ? u.map(function (x) {
            return '<div style="margin:3px 0"><b>' + esc(x.name) + '</b> — ' + DAYS[dowOf(x.date)].slice(0, 3) + ', ' + fmtDate(x.date) + (x.note ? ' <small>(' + esc(x.note) + ')</small>' : '') + '</div>';
        }).join('') : 'Not available right now.';
    }).catch(function () { $('upcoming').textContent = 'Not available right now.'; });
}
function saveAdj() { act({ action: 'hijriAdjust', value: +$('hj-adj').value }); }
function saveEid(v) { act({ action: 'eid', kind: v }); }
function setPreview(v) { PREVIEW = v; render(); }

/* ---------- Nanny Nook ---------- */
function syncNannyRadios() {
    Array.prototype.forEach.call(document.querySelectorAll('input[name="nanny-meal"]'), function (r) { r.parentNode.className = 'nanny-radio' + (r.checked ? ' on' : ''); });
}
function renderNannyLog(entries) {
    var box = $('nanny-log'), html = '', last = '';
    if (!entries || !entries.length) { box.innerHTML = '<p style="color:var(--muted)">Nothing logged yet this week.</p>'; return; }
    entries.forEach(function (e) {
        if (e.date !== last) { html += '<h4>' + esc(e.day) + '</h4>'; last = e.date; }
        html += '<div style="margin:3px 0"><b>' + esc(e.meal) + '</b> <span style="color:var(--muted)">' + esc(e.time) + '</span> — ' + esc(e.text) + '</div>';
    });
    box.innerHTML = html;
}
function loadNannyLog() {
    $('nanny-log').innerHTML = '<p style="color:var(--muted)">Loading this week…</p>';
    api({ action: 'nannyLog' }).then(function (r) { renderNannyLog(r.entries || []); }).catch(function () { $('nanny-log').innerHTML = '<p>Could not load the log.</p>'; });
}
function saveNanny() {
    var text = $('nanny-text-input').value.trim(), btn = $('nanny-save');
    var meal = (document.querySelector('input[name="nanny-meal"]:checked') || {}).value || 'Snack';
    if (!text) return;
    btn.textContent = 'Saving…';
    api({ action: 'nanny', meal: meal, text: text }).then(function (p) {
        if (p.error) throw new Error(p.error);
        $('nanny-text-input').value = ''; btn.textContent = '✅ Saved'; renderNannyLog(p.entries);
    }).catch(function () { btn.textContent = '⚠️ Not saved, try again'; });
    setTimeout(function () { btn.textContent = '💾 Save to Log'; }, 2500);
}


/* ---------- status line (parents) ---------- */
function renderStatus() {
    var el = $('status-line'), st = D && D.status;
    if (!canEdit() || !st) { el.textContent = ''; el.className = ''; return; }
    var bad = false, text;
    if (!st.triggerOn) { bad = true; text = '⚠️ Auto-plan is off. Turn it on from the sheet menu: ⏰ Turn On Friday 6pm Auto-Plan.'; }
    else if (st.lastError && (!st.lastOk || st.lastError.at > st.lastOk)) { bad = true; text = '⚠️ Last auto-plan failed ' + st.lastError.at + ': ' + st.lastError.msg; }
    else if (st.lastOk) text = '✅ Last auto-plan: ' + st.lastOk;
    else text = '⏰ Auto-plan is on. It runs Friday from 6pm.';
    el.textContent = text; el.className = bad ? 'warn' : '';
}

/* ---------- diagnostics (parents) ---------- */
function loadDiag() {
    api({ action: 'diag' }).then(function (r) {
        var d = r.diag, line = function (label, o) {
            return '<div class="diag-line">' + label + ': ' + (!o ? '<span>not used yet</span>' : o.ok ? '<span class="diag-ok">✅ OK ' + esc(o.at) + '</span>' : '<span class="diag-bad">❌ ' + esc(o.at) + ' ' + esc(o.error || '') + '</span>') + '</div>';
        };
        $('diag').innerHTML = '<div class="field"><label>Gemini model</label><div class="field-row"><input id="model-input" value="' + esc(d.model) + '"><button class="btn" onclick="saveModel()">Save</button><button class="btn" onclick="testGemini()">Test</button></div></div>'
            + '<p id="diag-msg" class="hint"></p>' + line('Gemini', d.gemini) + line('Prayer times', d.prayer) + line('Hijri calendar', d.hijri)
            + '<div class="diag-line">Auto-plan trigger: ' + (d.triggerOn ? '<span class="diag-ok">✅ on</span>' : '<span class="diag-bad">❌ off</span>') + '</div>';
    }).catch(function () { $('diag').textContent = 'Not available right now.'; });
}
function saveModel() { act({ action: 'setModel', model: $('model-input').value.trim() }).then(function () { $('diag-msg').textContent = 'Saved. Tap Test to check it.'; }); }
function testGemini() {
    $('diag-msg').textContent = 'Testing…';
    api({ action: 'testGemini' }).then(function (r) { $('diag-msg').textContent = r.ok ? '✅ ' + r.model + ' answered.' : '❌ ' + r.model + ': ' + r.error; loadDiagKeepMsg(); });
}
function loadDiagKeepMsg() { var m = $('diag-msg').textContent; loadDiag(); setTimeout(function () { if ($('diag-msg')) $('diag-msg').textContent = m; }, 600); }

/* ---------- Recipes: list, add, edit, import (parents) ---------- */
var DRAFT = null, RL = [];
function openRecipes() {
    if (!canEdit()) return;
    $('recipes-modal').firstElementChild.innerHTML = '<button class="modal-close" onclick="closeModal(\'recipes-modal\')">❌ Close</button><h2 class="modal-header-text">📖 Recipes</h2>'
        + '<div class="field-row"><button class="btn" onclick="newRecipe()">➕ Add recipe</button><button class="btn" id="imp-btn" onclick="importAll()">📥 Import details</button></div>'
        + '<p id="imp-msg" class="hint"></p><input id="rl-search" class="task-text-field" placeholder="Search…" style="margin:8px 0"><div id="rl-list">Loading…</div>';
    $('rl-search').addEventListener('input', drawRecipeList);
    openModal('recipes-modal');
    loadRecipeList();
}
function loadRecipeList() { api({ action: 'recipeList' }).then(function (r) { RL = r.recipes || []; drawRecipeList(); }).catch(function () { $('rl-list').textContent = 'Could not load recipes.'; }); }
function drawRecipeList() {
    var q = ($('rl-search') ? $('rl-search').value : '').trim().toLowerCase(), box = $('rl-list');
    var list = RL.filter(function (r) { return !q || (r.name + ' ' + r.type).toLowerCase().indexOf(q) !== -1; });
    box.innerHTML = list.length ? list.map(function (r) {
        return '<button class="mgr-row" data-name="' + esc(r.name) + '" onclick="editRecipe(this)"><span class="grow">' + esc(r.name) + (r.flagged ? ' ⚠️' : '') + '<br><small>' + esc(r.type || 'no type')
            + (r.servings ? ' · serves ' + r.servings : '') + (r.unreadable ? ' · could not be read: open it and paste the text' : (r.hasDetails ? '' : ' · no details yet')) + '</small></span></button>';
    }).join('') : '<p>No recipes match.</p>';
}
function importAll() {
    var btn = $('imp-btn'), msg = $('imp-msg'), done = 0, failed = [];
    btn.disabled = true; msg.textContent = 'Reading your recipe links… this can take a few minutes.';
    (function step() {
        api({ action: 'importBatch' }).then(function (r) {
            done += r.done || 0; failed = failed.concat(r.failed || []);
            msg.textContent = 'Imported ' + done + ' so far' + (r.remaining ? ', ' + r.remaining + ' to go…' : '.');
            if (r.remaining > 0 && (r.done || (r.failed || []).length)) step();
            else {
                btn.disabled = false; loadRecipeList();
                msg.textContent = 'Imported ' + done + ' recipe(s).' + (failed.length ? ' Could not read: ' + failed.join('; ') + '. Open those and paste the recipe text.' : '') + ' Please review any marked ⚠️.';
            }
        }).catch(function () { btn.disabled = false; msg.textContent = 'Stopped (connection problem). Tap Import again to continue.'; });
    })();
}
function newRecipe() {
    DRAFT = null;
    $('editor-modal').firstElementChild.innerHTML = '<button class="modal-close" onclick="closeModal(\'editor-modal\')">❌ Close</button><h2 class="modal-header-text">➕ Add a recipe</h2>'
        + '<div class="field"><label>Recipe link</label><input id="ed-url" placeholder="https://… (the original recipe site, not the Pinterest pin)"></div>'
        + '<div class="field"><label>Name (optional)</label><input id="ed-name0" placeholder="Leave empty to use the recipe\'s own name"></div>'
        + '<div id="paste-box" style="display:none"><p class="hint">That page could not be read. Open the recipe, copy its text, and paste it here:</p><div class="field"><textarea id="ed-paste" rows="7" placeholder="Paste the recipe text…"></textarea></div></div>'
        + '<button class="btn-block mode-btn highlight" id="ed-read" onclick="readRecipe()">🔎 Read the recipe</button><p id="ed-msg" class="hint"></p>'
        + '<p class="hint">You will review it before anything is saved.</p>';
    openModal('editor-modal');
}
function readRecipe() {
    var url = $('ed-url').value.trim(), text = $('ed-paste') ? $('ed-paste').value.trim() : '', name = $('ed-name0').value.trim(), msg = $('ed-msg');
    if (!url && !text) { msg.textContent = 'Paste a link (or the recipe text).'; return; }
    msg.textContent = '🔎 Reading… this can take up to a minute.'; $('ed-read').disabled = true;
    api({ action: 'recipePreview', url: url, text: text, name: name }).then(function (r) {
        $('ed-read').disabled = false;
        if (r.error) {
            $('paste-box').style.display = 'block';
            msg.textContent = r.error === 'blocked' ? 'That site would not let the app read it.' : r.error === 'noread' ? 'No recipe was found on that page.' : r.error === 'nolink' ? 'That does not look like a web link.' : r.error;
            return;
        }
        DRAFT = r.draft; drawEditor();
    }).catch(function () { $('ed-read').disabled = false; msg.textContent = 'Something went wrong. Try again.'; });
}
function editRecipe(btn) {
    api({ action: 'recipeGet', name: btn.dataset.name }).then(function (r) {
        if (r.error) { alert(r.error); return; }
        DRAFT = r.recipe; DRAFT.original = true;
        if (!DRAFT.ingredients.length) { newRecipe(); $('ed-url').value = DRAFT.url || ''; $('ed-name0').value = DRAFT.name || ''; return; }
        drawEditor(); openModal('editor-modal');
    });
}
function drawEditor() {
    var d = DRAFT, types = {};
    RL.forEach(function (r) { if (r.type) types[r.type] = true; });
    if (d.type) types[d.type] = true;
    var flags = (d.flags || []).map(function (f, i) {
        var done = f.decision === 'sub';
        return '<div class="flag-card' + (done ? ' ok' : '') + '"><b>⚠️ ' + esc(f.note) + '</b><br>Original: <i>' + esc(f.line) + '</i><br>Suggested: <i>' + esc(f.subLine) + '</i><br>'
            + (done ? '✅ Substitute is being used. <button class="btn" onclick="flagDecide(' + i + ',\'keep\')">Use the original instead</button>'
                    : '<button class="btn" onclick="flagDecide(' + i + ',\'sub\')">Use the substitute</button><button class="btn" onclick="flagDecide(' + i + ',\'keep\')">Keep the original</button>' + (f.decision === 'keep' ? ' <small>(original kept: the recipe stays marked ⚠️)</small>' : '')) + '</div>';
    }).join('');
    $('editor-modal').firstElementChild.innerHTML = '<button class="modal-close" onclick="closeModal(\'editor-modal\')">❌ Close</button><h2 class="modal-header-text">📖 Review recipe</h2>'
        + '<p class="hint">Source: ' + esc(d.source || 'saved') + (d.assumedServings ? ' · <b>servings were not found: I assumed 4, please check</b>' : '') + '</p>'
        + (flags ? '<h4>Ingredient check</h4>' + flags : '')
        + '<div class="field"><label>Name</label><input id="ed-name" value="' + esc(d.name) + '"></div>'
        + '<div class="field"><label>Link</label><input id="ed-link" value="' + esc(d.url) + '"></div>'
        + '<div class="field-row"><div class="field"><label>Type</label><input id="ed-type" list="ed-types" value="' + esc(d.type) + '"><datalist id="ed-types">' + Object.keys(types).map(function (t) { return '<option value="' + esc(t) + '">'; }).join('') + '</datalist></div>'
        + '<div class="field"><label>Servings</label><input id="ed-serv" type="number" min="1" value="' + esc(d.servings) + '"></div>'
        + '<div class="field"><label>Minutes</label><input id="ed-min" type="number" min="0" value="' + esc(d.minutes) + '"></div>'
        + '<div class="field"><label>Cal / serving ≈</label><input id="ed-cal" type="number" min="0" value="' + esc(d.calories) + '"></div></div>'
        + '<div class="field"><label>Ingredients (one per line, exactly as in the recipe)</label><textarea id="ed-ing" rows="9">' + esc((d.ingredients || []).join('\n')) + '</textarea></div>'
        + '<div class="field"><label>Steps (one per line)</label><textarea id="ed-steps" rows="9">' + esc((d.steps || []).join('\n')) + '</textarea></div>'
        + '<button class="btn-block mode-btn highlight" onclick="saveRecipeDraft()">💾 Save recipe</button><p id="ed-msg" class="hint"></p>'
        + (d.original ? '<button class="btn-block mode-btn" onclick="deleteRecipeDraft()">🗑️ Delete this recipe</button>' : '');
    openModal('editor-modal');
}
function syncDraft() {
    if (!$('ed-name') || !$('ed-ing')) return;
    DRAFT.name = $('ed-name').value.trim(); DRAFT.url = $('ed-link').value.trim(); DRAFT.type = $('ed-type').value.trim();
    DRAFT.servings = Number($('ed-serv').value) || 0; DRAFT.minutes = Number($('ed-min').value) || 0; DRAFT.calories = Number($('ed-cal').value) || 0;
    var ing = $('ed-ing').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    var stp = $('ed-steps').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    if (ing.length || !DRAFT.ingredients || !DRAFT.ingredients.length) DRAFT.ingredients = ing;
    if (stp.length || !DRAFT.steps || !DRAFT.steps.length) DRAFT.steps = stp;
    if (DRAFT.servings) DRAFT.assumedServings = false;
}
function flagDecide(i, dec) {
    syncDraft();
    var f = DRAFT.flags[i], cur = f.decision === 'sub' ? f.subLine : f.line, next = dec === 'sub' ? f.subLine : f.line, idx = DRAFT.ingredients.indexOf(cur);
    if (idx >= 0) DRAFT.ingredients[idx] = next;
    f.decision = dec;
    drawEditor();
}
function saveRecipeDraft() {
    syncDraft();
    var msg = $('ed-msg');
    if (!DRAFT.name) { msg.textContent = 'Please give the recipe a name.'; return; }
    if (!DRAFT.ingredients.length) { msg.textContent = 'The recipe needs ingredients.'; return; }
    msg.textContent = 'Saving…';
    api({ action: 'recipeSave', draft: DRAFT }).then(function (r) {
        if (r.error) { msg.textContent = r.error; return; }
        RECIPES = null; closeModal('editor-modal'); openRecipes();
    }).catch(function () { msg.textContent = 'Not saved. Try again.'; });
}
function deleteRecipeDraft() {
    if (!confirm('Delete "' + DRAFT.name + '" from your recipes?')) return;
    api({ action: 'recipeDelete', name: DRAFT.name }).then(function () { RECIPES = null; closeModal('editor-modal'); openRecipes(); });
}

/* ---------- modals ---------- */
function openModal(id) {
    if (id === 'grocery-modal' && D) { GWK = defaultGW(); renderGrocery(); }
    if (id === 'nanny-modal') { syncNannyRadios(); loadNannyLog(); }
    $(id).classList.add('active');
}
function closeModal(id) { $(id).classList.remove('active'); }

/* ---------- start ---------- */
document.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target && e.target.id === 'pin-input') submitPin(); });
setInterval(function () {                       // keep phone and iPad in sync
    if (document.hidden || !PIN || !D) return;
    if (document.querySelector('.modal-overlay.active')) return;
    var a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
    refresh();
}, 180000);
document.addEventListener('visibilitychange', function () {
    if (!document.hidden && PIN && D && !document.querySelector('.modal-overlay.active')) refresh();
});
(function boot() {
    if (!PIN) { showGate(); return; }
    var c = lsGet('kd_cache');
    if (c) { try { D = JSON.parse(c); render(); } catch (e) { D = null; } }     // show the last plan instantly while it refreshes
    refresh();
})();
