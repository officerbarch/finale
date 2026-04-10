const sheetURL = 'https://docs.google.com/spreadsheets/d/1jaO6kwbXqLBFzHAI9KphFX95Pxdsrgxybdg48oLhAmM/export?format=csv';

function parseCSV(text) {
    const rows = [];
    let row = [], cell = '', insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i], next = text[i + 1];
        if (char === '"' && insideQuotes && next === '"') {
            cell += '"'; i++;
        } else if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
            row.push(cell); cell = '';
        } else if (char === '\n' && !insideQuotes) {
            row.push(cell); rows.push(row);
            row = []; cell = '';
        } else {
            cell += char;
        }
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
}

function convertDriveLink(url) {
    const match = url.match(/\/d\/(.*?)\//);
    // Perbaikan pada template literal di bawah ini
    return match ? `https://lh3.googleusercontent.com/u/0/d/${match[1]}` : url;
}

function findImage(row) {
    for (let cell of row) {
        if (cell && cell.includes('http')) return cell;
    }
    return null;
}

function getDateGroup(dateStr) {
    const now = new Date();
    const d = new Date(dateStr);
    if (isNaN(d)) return "Sebelumnya";
    const diff = (now - d) / (1000 * 60 * 60 * 24);
    if (diff < 1) return "Hari ini";
    if (diff < 2) return "Kemarin";
    return "Sebelumnya";
}

function toggleExpand(el) {
    el.closest('.comment-box').classList.toggle('expanded');
}

// Fungsi Reaksi Visual
function addReaction(btn) {
    const span = btn.querySelector('span');
    let count = parseInt(span.innerText);
    span.innerText = count + 1;
    btn.style.transform = "scale(1.2)";
    setTimeout(() => btn.style.transform = "scale(1)", 100);
}

async function loadComments() {
    const response = await fetch(`${sheetURL}&t=${Date.now()}`);
    const text = await response.text();
    const rows = parseCSV(text).slice(1);

    const groups = { "Hari ini": [], "Kemarin": [], "Sebelumnya": [] };

    rows.forEach(row => {
        const time = row[0];
        const content = row[1];
        let image = findImage(row);
        if (!content && !image) return;

        let imgHTML = '';
        if (image && image.startsWith('http')) {
            image = convertDriveLink(image);
            imgHTML = `<img src="${image}" onerror="this.style.display='none'">`;
        }

        const card = `
            <div class="comment-box">
                <div class="comment-text">${content || ''}</div>
                ${imgHTML}
                <div class="read-more" onclick="toggleExpand(this)"> lihat+ </div>
                <div class="reaction-bar">
                    <button class="reaction-btn" onclick="addReaction(this)">❤️ <span>0</span></button>
                    <button class="reaction-btn" onclick="addReaction(this)">🫂 <span>0</span></button>
                    <button class="reaction-btn" onclick="addReaction(this)">💡 <span>0</span></button>
                </div>
            </div>
        `;

        const group = getDateGroup(time);
        if(groups[group]) groups[group].push(card);
    });

    let html = '';
    Object.keys(groups).forEach(group => {
        if (groups[group].length > 0) {
            html += `
                <div class="section-title">${group}</div>
                <div class="grid">${groups[group].join('')}</div>
            `;
        }
    });

    document.getElementById('comments').innerHTML = html;
}

loadComments();
setInterval(loadComments, 30000); // Update setiap 30 detik agar tidak terlalu berat
