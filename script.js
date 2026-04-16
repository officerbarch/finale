// 1. KONFIGURASI
const sheetURL = 'https://docs.google.com/spreadsheets/d/1jaO6kwbXqLBFzHAI9KphFX95Pxdsrgxybdg48oLhAmM/export?format=csv';
const webAppURL = 'https://script.google.com/macros/s/AKfycbxODONMqj_nKapS5Qgda0aeYpHKjqJMvOWhU67NnUscE7MdfiswlkNGVLgkVu8jVoP1/exec'; 

let allCommentsData = []; // Menyimpan data asli untuk difilter

// 2. FUNGSI PEMBANTU
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

// 3. FUNGSI INTERAKSI
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
    fetch(`${webAppURL}?action=addReaction&row=${rowIndex}&type=${type}`).catch(err => console.error(err));
}

function toggleExpand(el) {
    el.closest('.comment-box').classList.toggle('expanded');
}

// 4. FUNGSI FILTER (LOGIKA BARU)
function filterByTag(selectedTag) {
    const cleanTag = selectedTag.trim().toLowerCase();
    
    // Filter data dari variabel global
    const filteredData = allCommentsData.filter(item => {
        return item.content.toLowerCase().includes(cleanTag);
    });

    // Render ulang hanya data yang difilter
    renderComments(filteredData, true, selectedTag);
}

// 5. FUNGSI RENDER (DIPISAH AGAR BISA DIPANGGIL ULANG)
function renderComments(dataArray, isFiltering = false, tagLabel = "") {
    const groups = { "Today": [], "Yesterday": [], "Past": [] };
    const container = document.getElementById('comments');
    
    // Hapus tombol reset lama jika ada
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
        const tagMatches = item.content.match(/#\w+/g);
        let tagsHTML = '';
        let contentClean = item.content;

        if (tagMatches) {
            tagsHTML = `<div class="tag-container">` + 
                tagMatches.map(tag => `<span class="tag" onclick="filterByTag('${tag}')">${tag}</span>`).join('') + 
                `</div>`;
            contentClean = item.content.replace(/#\w+/g, '').trim();
        }

        let imgHTML = item.image ? `<img src="${convertDriveLink(item.image)}" onclick="openImage(this.src)">` : '';

        const card = `
            <div class="comment-box">
                ${tagsHTML}
                <div class="comment-text">${contentClean}</div>
                ${imgHTML}
                <div class="read-more" onclick="toggleExpand(this)">Lihat+</div>
                <div class="reaction-bar">
                    <button class="reaction-btn" onclick="addReaction(this, ${item.originalRow}, 'like')">❤️ <span>${item.like}</span></button>
                    <button class="reaction-btn" onclick="addReaction(this, ${item.originalRow}, 'hug')">🫂 <span>${item.hug}</span></button>
                    <button class="reaction-btn" onclick="addReaction(this, ${item.originalRow}, 'idea')">💡 <span>${item.idea}</span></button>
                </div>
            </div>`;

        const group = getDateGroup(item.time);
        if (groups[group]) groups[group].push(card);
    });

    let html = '';
    ["Today", "Yesterday", "Past"].forEach(g => {
        if (groups[g] && groups[g].length > 0) {
            // Sembunyikan judul section jika sedang filter agar rapi
            if (!isFiltering) html += `<div class="section-title">${g}</div>`;
            html += `<div class="grid">${groups[g].join('')}</div>`;
        }
    });

    container.innerHTML = html || '<p style="text-align:center;">Tidak ada komentar dengan tagar tersebut.</p>';
}

// 6. LOAD DATA AWAL
async function loadComments() {
    try {
        const response = await fetch(`${sheetURL}&t=${Date.now()}`);
        const text = await response.text();
        const rows = parseCSV(text).slice(1); // Ambil semua baris tanpa header
        
        // Transformasi data ke format objek agar mudah dikelola
        allCommentsData = rows.map((row, index) => ({
            originalRow: index + 2, // Lokasi baris asli di Sheets
            time: row[0],
            content: row[1] || '',
            image: row[2],
            like: row[3] || 0,
            hug: row[4] || 0,
            idea: row[5] || 0
        })).reverse(); // Terbaru di atas

        renderComments(allCommentsData);
    } catch (e) { 
        console.error("Gagal memuat data:", e); 
    }
}

loadComments();
setInterval(loadComments, 100000);
