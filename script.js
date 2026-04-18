// 1. KONFIGURASI DATA
const sheetURL = 'https://docs.google.com/spreadsheets/d/1jaO6kwbXqLBFzHAI9KphFX95Pxdsrgxybdg48oLhAmM/export?format=csv';
const webAppURL = 'https://script.google.com/macros/s/AKfycbxODONMqj_nKapS5Qgda0aeYpHKjqJMvOWhU67NnUscE7MdfiswlkNGVLgkVu8jVoP1/exec'; 

let allCommentsData = []; // Penyimpan data untuk fitur filter

// 2. PARSER CSV (Menangani kutipan dan koma dalam teks)
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
        } else if (char === '\r') {
            continue;
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

// 3. LOGIKA RENDER & KATEGORISASI VISUAL
function renderComments(dataArray, isFiltering = false, tagLabel = "") {
    const container = document.getElementById('comments');
    const groups = { "Today": [], "Yesterday": [], "Past": [] };
    
    // Reset Filter Button Management
    const oldBtn = document.getElementById('reset-filter');
    if (oldBtn) oldBtn.remove();

    if (isFiltering) {
        const resetBtn = document.createElement('button');
        resetBtn.id = 'reset-filter';
        resetBtn.innerHTML = `Tampilkan Semua (✕) | Filter: ${tagLabel}`;
        resetBtn.className = 'reset-btn'; 
        resetBtn.onclick = () => renderComments(allCommentsData);
        container.parentNode.insertBefore(resetBtn, container);
    }

    dataArray.forEach((item) => {
        // --- DETEKSI KATEGORI UNTUK WARNA ---
        const contentLower = item.content.toLowerCase();
        let categoryClass = '';
        
        if (contentLower.includes('#reply')) {
            categoryClass = 'tag-reply';
        } else if (contentLower.includes('#justlisten')) {
            categoryClass = 'tag-listen';
        } else if (contentLower.includes('#qna')) {
            categoryClass = 'tag-qna';
        }

        // --- DETEKSI & EKSTRAKSI TAGAR ---
        const tagMatches = item.content.match(/#\w+/g);
        let tagsHTML = '';
        let contentClean = item.content;

        if (tagMatches) {
            tagsHTML = `<div class="tag-container">` + 
                tagMatches.map(tag => {
                    const t = tag.trim();
                    return `<span class="tag" onclick="filterByTag('${t}')">${t}</span>`;
                }).join('') + 
                `</div>`;
            // Opsional: hapus tagar dari teks utama agar tidak double visual
            contentClean = item.content.replace(/#\w+/g, '').trim();
        }

        // --- IMAGE HANDLING ---
        let imgHTML = item.image && item.image.includes('http') ? 
            `<img src="${convertDriveLink(item.image)}" onclick="openImage(this.src)">` : '';

        // --- CONSTRUCT CARD HTML ---
        const card = `
            <div class="comment-box ${categoryClass}">
                ${tagsHTML}
                <div class="comment-text">${contentClean}</div>
                ${imgHTML}
                <div class="reaction-bar">
                    <button class="reaction-btn" onclick="addReaction(this, ${item.originalRow}, 'like')">🥺 <span>${item.like}</span></button>
                    <button class="reaction-btn" onclick="addReaction(this, ${item.originalRow}, 'hug')">😭 <span>${item.hug}</span></button>
                    <button class="reaction-btn" onclick="addReaction(this, ${item.originalRow}, 'idea')">🫠 <span>${item.idea}</span></button>
                </div>
            </div>`;

        const group = getDateGroup(item.time);
        if (groups[group]) groups[group].push(card);
    });

    // --- DRAW TO SCREEN ---
    let html = '';
    ["Today", "Yesterday", "Past"].forEach(g => {
        if (groups[g] && groups[g].length > 0) {
            if (!isFiltering) html += `<div class="section-title">${g}</div>`;
            html += `<div class="grid">${groups[g].join('')}</div>`;
        }
    });

    container.innerHTML = html || '<p style="text-align:center; padding:20px;">Belum ada pengakuan untuk kategori ini.</p>';
}

// 4. FUNGSI UTILS & INTERAKSI
function convertDriveLink(url) {
    if (!url || !url.includes('drive.google.com')) return url;
    const match = url.match(/\/d\/(.*?)\//) || url.match(/[?&]id=([^&]+)/);
    return match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000` : url;
}

function getDateGroup(dateStr) {
    if (!dateStr) return "Past";
    const d = new Date(dateStr);
    if (isNaN(d)) return "Past";
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays < 1 && now.getDate() === d.getDate()) return "Today";
    if (diffDays <= 1) return "Yesterday";
    return "Past";
}

function filterByTag(selectedTag) {
    const cleanTag = selectedTag.trim().toLowerCase();
    const filteredData = allCommentsData.filter(item => item.content.toLowerCase().includes(cleanTag));
    renderComments(filteredData, true, selectedTag);
}

function openImage(src) {
    const modal = document.getElementById('imageModal');
    const fullImg = document.getElementById('fullImage');
    modal.style.display = 'flex';
    fullImg.src = src;
}

function addReaction(btn, rowIndex, type) {
    const span = btn.querySelector('span');
    span.innerText = parseInt(span.innerText) + 1;
    btn.style.transform = "scale(1.2)";
    setTimeout(() => btn.style.transform = "scale(1)", 100);
    fetch(`${webAppURL}?action=addReaction&row=${rowIndex}&type=${type}`).catch(e => console.error(e));
}

// 5. INITIAL LOAD
async function loadComments() {
    try {
        const response = await fetch(`${sheetURL}&t=${Date.now()}`);
        const text = await response.text();
        const rows = parseCSV(text).slice(1);
        
        allCommentsData = rows.map((row, index) => ({
            originalRow: index + 2, 
            time: row[0],
            content: row[1] || '',
            image: row[2],
            like: row[3] || 0,
            hug: row[4] || 0,
            idea: row[5] || 0
        })).reverse(); 

        renderComments(allCommentsData);
    } catch (e) { 
        console.error("Fetch Error:", e); 
    }
}

// Auto refresh setiap 1 menit
loadComments();
setInterval(loadComments, 60000);
