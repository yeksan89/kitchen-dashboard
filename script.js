// 🔗 YOUR MASTER SPREADSHEET URL (sheet must be shared: "Anyone with the link can view"):
const SHEET_URL = "https://docs.google.com/spreadsheets/d/18XothmKmHTmP0Z80ovk3sfIL2BB4Jjfdv47ctW8sW2A/edit?gid=0#gid=0";

// Dashboard tab layout (matches the Apps Script):
// A=Day  B=Meal  C=Cuisine  D=CookTime  E=Cost  F=Calories  G=Macros  H=Chores  I=Done  J=Ingredients+Steps  K=Grocery
// Row 1 = headers, rows 2-8 = Monday-Sunday, B10 = prayer ribbon

function getSheetId(url) {
    const m = url.match(/\/d\/([^/]+)/);
    return m ? m[1] : null;          // FIX: return the captured ID, not the whole match array
}

let loadedDataCache = [];

function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Splits on newlines or commas (ignoring commas inside parentheses)
function splitItems(str) {
    return String(str).split(/\n|,(?![^(]*\))/).map(s => s.trim()).filter(Boolean);
}

// FIX: real CSV parser. Cells contain line breaks and commas (ingredients, steps, groceries),
// so splitting on "\n" and "," breaks rows apart.
function parseCSV(text) {
    const rows = [];
    let row = [], cell = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') { cell += '"'; i++; }
                else inQuotes = false;
            } else cell += ch;
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            row.push(cell); cell = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(cell); rows.push(row); row = []; cell = '';
        } else {
            cell += ch;
        }
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.map(r => r.map(c => c.trim()));
}

async function fetchDashboardData() {
    const calendar = document.getElementById('calendar');
    const sheetId = getSheetId(SHEET_URL);
    if (!sheetId) {
        calendar.innerHTML = '<div class="loading-state" style="color:#ff4757; text-align:center;">Error parsing Sheet URL ID.</div>';
        return;
    }
    // FIX: correct gviz endpoint; headers=1 forces row 1 to be treated as the header row
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Dashboard&headers=1`;
    try {
        const response = await fetch(csvUrl);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        processRows(await response.text());
    } catch (error) {
        console.error("Sheet sync failure:", error);
        calendar.innerHTML = '<div class="loading-state" style="color:#ff4757; text-align:center;">Could not load the sheet. Check that it is shared as "Anyone with the link can view".</div>';
    }
}

function processRows(csvText) {
    const rows = parseCSV(csvText);
    loadedDataCache = rows.slice(1);   // drop header row; index 0 = Monday (sheet row 2)

    // Prayer ribbon (written to B10 by the Apps Script): find it by content, not by fixed position
    const ribbonRow = loadedDataCache.find(r => r.some(c => c.includes('Fajr')));
    if (ribbonRow) parsePrayerRibbon(ribbonRow.find(c => c.includes('Fajr')));

    renderDashboard();
}

function parsePrayerRibbon(ribbonText) {
    const ribbonContainer = document.getElementById('prayer-ribbon-content');
    if (!ribbonText || !ribbonContainer) return;
    ribbonContainer.innerHTML = "";
    ribbonText.split('|').forEach(block => {
        const parts = block.trim().split(/\s+/);
        if (parts.length === 2) {
            ribbonContainer.innerHTML += `
                <div class="prayer-time-node">
                    <span class="p-name">◯ ${esc(parts[0])}</span>
                    <span class="p-time">${esc(parts[1])}</span>
                </div>`;
        }
    });
}

function renderDashboard() {
    const calendarContainer = document.getElementById('calendar');
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    const cards = [];
    let groceryMasterAccumulator = "";

    loadedDataCache.forEach((row, index) => {
        if (index > 6) return; // only the 7 calendar days

        const day = row[0];
        if (!day) return;

        const mealName = row[1] || "No meal planned";
        const cuisine = (row[2] || "standard").toLowerCase().replace(/[^a-z]/g, '') || "standard";
        const cookTime = row[3] || "0";
        const cost = row[4] || "0.00";
        const calories = row[5] || "0";
        const macros = row[6] || "";
        const choreText = row[7] || "No chores allocated";
        const isChoreDone = String(row[8]).toLowerCase() === "true";   // FIX: Sheets CSV returns "true"/"false"
        const groceriesData = row[10] || "";

        if (groceriesData) {
            groceryMasterAccumulator += `
                <div class="grocery-itemized-block" style="margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:15px;">
                    <h4 style="margin:0 0 5px 0;">${esc(day.toUpperCase())} | ${esc(mealName)} <span style="color:var(--turkish-neon);">⏱️ ${esc(cookTime)}m</span></h4>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin:0 0 10px 0;">Est Cost: $${esc(cost)} | ${esc(calories)} cal (${esc(macros)})</p>
                    <ul style="list-style:none; padding:0; margin:0;">${splitItems(groceriesData).map(i => `<li>• ${esc(i)}</li>`).join('')}</ul>
                </div>`;
        }

        const isToday = day.toLowerCase() === todayName.toLowerCase() ? 'today' : '';

        let stylizedChoreHTML = "";
        choreText.split('|').forEach(singleChore => {
            let badgeClass = "unassigned";
            let initials = "";
            if (singleChore.includes("[A]")) { badgeClass = "owner-a"; initials = "A"; }
            else if (singleChore.includes("[E]")) { badgeClass = "owner-e"; initials = "E"; }
            const cleanChore = singleChore.replace("[A]", "").replace("[E]", "").trim();
            if (cleanChore) {
                stylizedChoreHTML += `
                    <div class="single-chore-row-item" style="margin-bottom:6px; display:flex; align-items:center; gap:8px;">
                        <span class="user-badge-profile ${badgeClass}">${initials || "•"}</span>
                        <span class="chore-row-text-string">${esc(cleanChore)}</span>
                    </div>`;
            }
        });

        cards.push(`
            <div class="day-card ${isToday}" data-day="${esc(day)}">
                <div class="day-name">${esc(day)} ${isToday ? '<span>📍</span>' : ''}</div>
                <div class="meal-section" onclick="viewRecipeModal(${index})">
                    <span class="cuisine-tag ${cuisine}">${esc(cuisine)}</span>
                    <p class="meal-title">${esc(mealName)}</p>
                    <div class="meta-metrics-row"><span>⏱️ ${esc(cookTime)}m</span><span>💰 $${esc(cost)}</span><span>🔥 ${esc(calories)}c</span></div>
                </div>
                <div class="chore-section">
                    <div class="chore-box ${isChoreDone ? 'done' : ''}" onclick="toggleChoreVisual(this, ${index})">
                        <input type="checkbox" ${isChoreDone ? 'checked' : ''}>
                        <div class="chores-list-sub-container">${stylizedChoreHTML}</div>
                    </div>
                    <div class="add-task-container">
                        <button class="add-task-inline-btn" onclick="toggleTaskInput(this)">+ Add Task</button>
                        <div class="task-input-hidden-row" style="display:none;">
                            <input type="text" class="task-text-field">
                            <button onclick="saveAdHocTaskToGlass(this, ${index})">➕</button>
                        </div>
                    </div>
                </div>
            </div>`);
    });

    calendarContainer.innerHTML = cards.join('');
    document.getElementById('grocery-master-content').innerHTML = groceryMasterAccumulator || "<p>No active shopping list data synced.</p>";
    // FIX: correct QR endpoint
    document.getElementById('qr-box').innerHTML =
        `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(SHEET_URL)}" alt="QR">`;
}

function viewRecipeModal(index) {
    const row = loadedDataCache[index];
    if (!row) return;
    document.getElementById('modal-recipe-title').innerText = row[1];
    document.getElementById('modal-recipe-meta').innerText = `${row[0].toUpperCase()} | ⏱️ ${row[3]}m | 💰 $${row[4]} | 🔥 ${row[5]} cal (${row[6]})`;

    const rawData = row[9] || "";
    let ingList = ["Check grocery list."];
    let stepList = ["Cook standard form."];
    if (rawData.includes("STEPS:")) {
        const [ingPart, stepsPart = ""] = rawData.replace("INGREDIENTS:", "").split("STEPS:");
        ingList = splitItems(ingPart);
        // FIX: don't split on every "." (breaks "1.5 cups"); drop "Step N." labels, split on sentence ends
        stepList = stepsPart.replace(/Step\s*\d+[.:]\s*/gi, '').split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
    }
    document.getElementById('modal-recipe-ingredients').innerHTML = ingList.map(i => `<li>• ${esc(i)}</li>`).join('');
    document.getElementById('modal-recipe-steps').innerHTML = stepList.map(s => `<li>${esc(s)}</li>`).join('');
    openModal('recipe-modal');
}

function saveAdHocTaskToGlass(btn, rowIndex) {
    const input = btn.previousElementSibling;
    if (!input.value.trim()) return;
    const list = btn.closest('.chore-section').querySelector('.chores-list-sub-container');
    const row = document.createElement('div');
    row.className = "single-chore-row-item";
    row.style.cssText = "margin-bottom:6px; display:flex; align-items:center; gap:8px;";
    row.innerHTML = `<span class="user-badge-profile unassigned">•</span><span class="chore-row-text-string">${esc(input.value.trim())}</span>`;
    list.appendChild(row);
    input.value = "";
    input.closest('.task-input-hidden-row').style.display = "none";
}

function toggleTaskInput(btn) { const r = btn.nextElementSibling; r.style.display = r.style.display === "none" ? "flex" : "none"; }
function toggleChoreVisual(el, idx) { el.classList.toggle('done'); const c = el.querySelector('input[type="checkbox"]'); c.checked = !c.checked; }
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

fetchDashboardData();
