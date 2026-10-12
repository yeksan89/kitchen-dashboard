// 🔗 PASTE YOUR COPIED GOOGLE SHEET ADDRESS LINK HERE:
const SHEET_URL = "https://google.com";

function getSheetId(url) {
    const matches = url.match(/\/d\/([^/]+)/);
    return matches ? matches[1] : null;
}

let loadedDataCache = [];

async function fetchDashboardData() {
    const sheetId = getSheetId(SHEET_URL);
    if (!sheetId || SHEET_URL.includes("PASTE_YOUR_ACTUAL")) {
        document.getElementById('calendar').innerHTML = '<div class="loading-state" style="color: #ff4757; text-align:center;">Error: Please open script.js line 2 and paste your published Google Sheet link!</div>';
        return;
    }
    const csvUrl = `https://google.com{sheetId}/gviz/tq?tqx=out:csv&sheet=Dashboard`;
    try {
        const response = await fetch(csvUrl);
        const csvText = await response.text();
        processRows(csvText);
    } catch (error) {
        console.error("Cloud database synchronization sync failure:", error);
    }
}

function processRows(csvText) {
    const rows = csvText.split('\n').map(row => 
        row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*\()/).map(cell => cell.replace(/^"|"\$/g, '').trim())
    );
    loadedDataCache = rows.slice(1);
    if (loadedDataCache[9] && loadedDataCache[9][1]) {
        parsePrayerRibbon(loadedDataCache[9][1]);
    }
    renderDashboard();
}

function parsePrayerRibbon(ribbonText) {
    const ribbonContainer = document.getElementById('prayer-ribbon-content');
    if (!ribbonText) return;
    ribbonContainer.innerHTML = "";
    const blocks = ribbonText.split('|');
    blocks.forEach(block => {
        const parts = block.trim().split(' ');
        if (parts.length === 2) {
            ribbonContainer.innerHTML += `
                <div class="prayer-time-node">
                    <span class="p-name">◯ ${parts[0]}</span> 
                    <span class="p-time">${parts[1]}</span>
                </div>`;
        }
    });
}

function renderDashboard() {
    const calendarContainer = document.getElementById('calendar');
    calendarContainer.innerHTML = '';
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    let groceryMasterAccumulator = "";

    loadedDataCache.forEach((row, index) => {
        if (index > 6) return; 
        const day = row[0];
        const mealName = row[1] || "No meal planned";
        const cuisine = (row[2] || "standard").toLowerCase();
        const cookTime = row[3] || "0";
        const cost = row[4] || "0.00";
        const calories = row[5] || "0";
        const macros = row[6] || "";
        const choreText = row[7] || "No chores allocated";
        const isChoreDone = row[8] === "TRUE";
        const stepsData = row[9] || "No cooking directions logged.";
        const groceriesData = row[10] || "";

        if (!day) return;
        if (groceriesData) {
            groceryMasterAccumulator += `
                <div class="grocery-itemized-block" style="margin-bottom:20px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:15px;">
                    <h4 style="margin:0 0 5px 0;">${day.toUpperCase()} | ${mealName} <span style="color:var(--turkish-neon);">⏱️ ${cookTime}m</span></h4>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin:0 0 10px 0;">Est Cost: $${cost} | ${calories} cal (${macros})</p>
                    <ul style="list-style:none; padding:0; margin:0;">` + groceriesData.split(',').map(i => i.trim() ? `<li>• ${i}</li>` : '').join('') + `</ul>
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
                        <span class="chore-row-text-string">${cleanChore}</span>
                    </div>`;
            }
        });

        const cardHtml = `
            <div class="day-card ${isToday}" data-day="${day}">
                <div class="day-name">${day} ${isToday ? '<span>📍</span>' : ''}</div>
                <div class="meal-section" onclick="viewRecipeModal(${index})">
                    <span class="cuisine-tag ${cuisine}">${cuisine}</span>
                    <p class="meal-title">${mealName}</p>
                    <div class="meta-metrics-row"><span>⏱️ ${cookTime}m</span><span>💰 $${cost}</span><span>🔥 ${calories}c</span></div>
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
            </div>`;
        calendarContainer.innerHTML += cardHtml;
    });
    document.getElementById('grocery-master-content').innerHTML = groceryMasterAccumulator || "<p>No active shopping list data synced.</p>";
    document.getElementById('qr-box').innerHTML = `<img src="https://qrserver.com{encodeURIComponent(SHEET_URL)}" alt="QR">`;
}

function viewRecipeModal(index) {
    const row = loadedDataCache[index];
    document.getElementById('modal-recipe-title').innerText = row[1];
    document.getElementById('modal-recipe-meta').innerText = `${row[2].toUpperCase()} | ⏱️ ${row[3]}m | 💰 $${row[4]} | 🔥 ${row[5]} cal (${row[6]})`;
    const rawData = row[9] || "";
    let ing = "Check grocery list.";
    let steps = "Cook standard form.";
    if (rawData.includes("STEPS:")) {
        const parts = rawData.replace("INGREDIENTS:", "").split("STEPS:");
        ing = parts[0];
        steps = parts[1];
    }
    document.getElementById('modal-recipe-ingredients').innerHTML = ing.split(',').map(i => i.trim() ? `<li>• ${i}</li>` : '').join('');
    document.getElementById('modal-recipe-steps').innerHTML = steps.split('.').map(s => s.trim() ? `<li>${s}</li>` : '').join('');
    openModal('recipe-modal');
}

function saveAdHocTaskToGlass(btn, rowIndex) {
    const input = btn.previousElementSibling;
    if (!input.value.trim()) return;
    const list = btn.closest('.chore-section').querySelector('.chores-list-sub-container');
    const row = document.createElement('div');
    row.className = "single-chore-row-item";
    row.style.cssText = "margin-bottom:6px; display:flex; align-items:center; gap:8px;";
    row.innerHTML = `<span class="user-badge-profile unassigned">•</span><span class="chore-row-text-string">${input.value.trim()}</span>`;
    list.appendChild(row);
    input.value = "";
    input.closest('.task-input-hidden-row').style.display = "none";
}

function toggleTaskInput(btn) { const r = btn.nextElementSibling; r.style.display = r.style.display === "none" ? "flex" : "none"; }
function toggleChoreVisual(el, idx) { el.classList.toggle('done'); const c = el.querySelector('input[type="checkbox"]'); c.checked = !c.checked; }
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

fetchDashboardData();
