// ==========================================
// 1. KONFIGURASI
// ==========================================
const sheetURL = 'https://docs.google.com/spreadsheets/d/1jaO6kwbXqLBFzHAI9KphFX95Pxdsrgxybdg48oLhAmM/export?format=csv';
const webAppURL = 'https://script.google.com/macros/s/AKfycbxODONMqj_nKapS5Qgda0aeYpHKjqJMvOWhU67NnUscE7MdfiswlkNGVLgkVu8jVoP1/exec'; 

// ==========================================
// 2. FUNGSI PEMBANTU (Helpers)
// ==========================================

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

function convertDriveLink(url) {
    if (!url || !url.includes('drive.google.com')) return url;
    let fileId = '';
    const matchD = url.match(/\/d\/(.*?)\//);
    const matchId = url.match(/[?&]id=([^&]+)/);
    if (matchD) fileId = matchD[1];
    else if (matchId) fileId = matchId[1];
    return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : url;
}

function getDateGroup(dateStr) {
    if (!dateStr) return "Past";
    const d = new Date(dateStr);
    if (isNaN(d)) return "Past";
    const now = new Date();
    const diffTime = now - d;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 1 && now.getDate() === d.getDate()) return "Today";
    if (diffDays <= 1) return "Yesterday";
    return "Past";
}

// ==========================================
// 3. SISTEM FILTER & INTERAKSI
// ==========================================

function openImage(src) {
    const modal = document.getElementById('imageModal');
    const fullImg = document.getElementById('fullImage');
    if (modal && fullImg) {
        modal.style.display = 'flex';
        fullImg.src = src;
    }
}

function addReaction(btn, rowIndex, type) {
    const span = btn.querySelector('span');
    let count = parseInt(span.innerText);
    span.innerText = count + 1;
    btn.style.transform = "scale(1.2)";
    setTimeout(() => btn.style.transform = "scale(1)", 100);
    const actualRow = rowIndex + 2; 
    fetch(`${webAppURL}?action=addReaction&row=${actualRow}&type=${type}`).catch(err => console.error(err));
}

function toggleExpand(el) {
    el.closest('.comment-box').classList.toggle('expanded');
}

// FUNGSI FILTER TAGAR (DIPERBARUI DENGAN TRIM)
function filterByTag(selectedTag) {
    const allCards = document.querySelectorAll('.comment-box');
    const cleanSelectedTag = selectedTag.trim();

    allCards.forEach(card => {
        const cardTags = card.querySelectorAll('.tag');
        let hasTag = false;
        cardTags.forEach(t => { 
            if (t.innerText.trim() === cleanSelectedTag) hasTag = true; 
        });
        
        // Mengatur tampilan kartu
        if (hasTag) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });

    // Menghapus judul section (Today/Yesterday) saat filter aktif agar tidak membingungkan
    document.querySelectorAll('.section-title').forEach(title => title.style.display = 'none');

    // Tampilkan tombol Reset
    if (!document.getElementById('reset-filter')) {
        const resetBtn = document.createElement('button');
        resetBtn.id = 'reset-filter';
        resetBtn.innerHTML = `Tampilkan Semua (✕) | Filter: ${cleanSelectedTag}`;
        resetBtn.className = 'reset-btn'; 
        resetBtn.onclick = () => location.reload();
        document.querySelector('.container').insertBefore(resetBtn, document.getElementById('comments'));
    }
}

// ==========================================
// 4. LOAD DATA UTAMA
// ==========================================

async function loadComments() {
    try {
        const response = await fetch(`${sheetURL}&t=${Date.now()}`);
        const text = await response.text();
        const rows = parseCSV(text).slice(1).reverse();
        const groups = { "Today": [], "Yesterday": [], "Past": [] };

        rows.forEach((row, index) => {
            if (row.length < 2) return;
            const time = row[0];
            const originalContent = row[1] || '';
            const imageLink = row[2];
            const cL = row[3] || 0;
            const cH = row[4] || 0;
            const cI = row[5] || 0;
            
            // Ekstraksi Tagar
            const tagMatches = originalContent.match(/#\w+/g);
            let tagsHTML = '';
            let contentClean = originalContent;

            if (tagMatches) {
                tagsHTML = `<div class="tag-container">` + 
                    tagMatches.map(tag => {
                        const t = tag.trim();
                        return `<span class="tag" onclick="filterByTag('${t}')">${t}</span>`;
                    }).join('') + 
                    `</div>`;
                // Bersihkan teks dari tagar agar tidak tampil ganda
                contentClean = originalContent.replace(/#\w+/g, '').trim();
            }
            
            let imgHTML = (imageLink && imageLink.includes('http')) ? 
                `<img src="${convertDriveLink(imageLink)}" onclick="openImage(this.src)" style="cursor:zoom-in">` : '';
            
            const originalIndex = rows.length - 1 - index;

            const card = `
                <div class="comment-box">
                    ${tagsHTML}
                    <div class="comment-text">${contentClean}</div>
                    ${imgHTML}
                    <div class="read-more" onclick="toggleExpand(this)">Lihat+</div>
                    <div class="reaction-bar">
                        <button class="reaction-btn" onclick="addReaction(this, ${originalIndex}, 'like')">❤️ <span>${cL}</span></button>
                        <button class="reaction-btn" onclick="addReaction(this, ${originalIndex}, 'hug')">🫂 <span>${cH}</span></button>
                        <button class="reaction-btn" onclick="addReaction(this, ${originalIndex}, 'idea')">💡 <span>${cI}</span></button>
                    </div>
                </div>`;

            const group = getDateGroup(time);
            if (groups[group]) groups[group].push(card);
        });

        let html = '';
        ["Today", "Yesterday", "Past"].forEach(g => {
            if (groups[g] && groups[g].length > 0) {
                html += `<div class="section-title">${g}</div><div class="grid">${groups[g].join('')}</div>`;
            }
        });
        
        document.getElementById('comments').innerHTML = html || '<p style="text-align:center;">Belum ada pengakuan.</p>';
    } catch (e) { 
        console.error("Gagal memuat data:", e); 
    }
}

// Jalankan
loadComments();
setInterval(loadComments, 100000);
