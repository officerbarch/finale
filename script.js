// 1. KONFIGURASI
const sheetURL = 'https://docs.google.com/spreadsheets/d/1jaO6kwbXqLBFzHAI9KphFX95Pxdsrgxybdg48oLhAmM/export?format=csv';
const webAppURL = 'https://script.google.com/macros/s/AKfycbxODONMqj_nKapS5Qgda0aeYpHKjqJMvOWhU67NnUscE7MdfiswlkNGVLgkVu8jVoP1/exec'; 

let allCommentsData = []; // Menyimpan data asli untuk keperluan filter

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

// 3. FUNGSI INTERAKSI & FILTER
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

// FUNGSI FILTER UTAMA (Membandingkan teks tanpa peduli Case Sensitive)
function filterByTag(selectedTag) {
    const cleanTag = selectedTag.trim().toLowerCase();
    
    // Filter dari data global yang sudah disimpan
    const filteredData = allCommentsData.filter(item => {
        return item.content.toLowerCase().includes(cleanTag);
    });

    renderComments(filteredData, true, selectedTag);
}

// 4. FUNGSI RENDER (Menampilkan data ke layar)
function renderComments(dataArray, isFiltering = false, tagLabel = "") {
    const container = document.getElementById('comments');
    const groups = { "Today": [], "Yesterday": [], "Past": [] };
    
    // Hapus tombol reset lama
    const oldBtn = document.getElementById('reset-filter');
    if (oldBtn) oldBtn.remove();

    // Jika sedang memfilter, tampilkan tombol reset di atas
    if (isFiltering) {
        const resetBtn = document.createElement('button');
        resetBtn.id = 'reset-filter';
        resetBtn.innerHTML = `Tampilkan Semua (✕) | Filter: ${tagLabel}`;
        resetBtn.className = 'reset-btn'; 
        resetBtn.onclick = () => renderComments(allCommentsData);
        container.parentNode.insertBefore(resetBtn, container);
    }

    dataArray.forEach((item) => {
        // Deteksi Tagar
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
            // Sembunyikan tagar di dalam isi teks utama
            contentClean = item.content.replace(/#\w+/g, '').trim();
        }

        let imgHTML = item.image && item.image.includes('http') ? 
            `<img src="${convertDriveLink(item.image)}" onclick="openImage(this.src)">` : '';

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

    // Susun tampilan HTML
    let html = '';
    ["Today", "Yesterday", "Past"].forEach(g => {
        if (groups[g] && groups[g].length > 0) {
            if (!isFiltering) html += `<div class="section-title">${g}</div>`;
            html += `<div class="grid">${groups[g].join('')}</div>`;
        }
    });

    container.innerHTML = html || '<p style="text-align:center; padding:20px;">Tidak ditemukan pengakuan dengan tagar tersebut.</p>';
}

// 5. LOAD DATA AWAL
async function loadComments() {
    try {
        const response = await fetch(`${sheetURL}&t=${Date.now()}`);
        const text = await response.text();
        const rows = parseCSV(text).slice(1);
        
        // Simpan ke variabel global
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
        console.error("Gagal memuat data:", e); 
    }
}

loadComments();
setInterval(loadComments, 100000);
