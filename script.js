// 1. KONFIGURASI
const sheetURL = 'https://docs.google.com/spreadsheets/d/1jaO6kwbXqLBFzHAI9KphFX95Pxdsrgxybdg48oLhAmM/export?format=csv';
const webAppURL = 'https://script.google.com/macros/s/AKfycbxODONMqj_nKapS5Qgda0aeYpHKjqJMvOWhU67NnUscE7MdfiswlkNGVLgkVu8jVoP1/exec'; 

// 2. FUNGSI PARSING CSV (Mengubah teks mentah menjadi array)
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

// 3. FUNGSI KONVERSI LINK DRIVE (Penting agar gambar Kolom C muncul)
function convertDriveLink(url) {
    if (!url || !url.includes('drive.google.com')) return url;
    let fileId = '';
    const matchD = url.match(/\/d\/(.*?)\//);
    const matchId = url.match(/[?&]id=([^&]+)/);
    if (matchD) fileId = matchD[1];
    else if (matchId) fileId = matchId[1];

    if (fileId) {
        // Menggunakan endpoint thumbnail Google (sz=w1000 untuk kualitas tinggi)
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
    return url;
}

// 4. FUNGSI PENGELOMPOKAN TANGGAL
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

// 5. FUNGSI INTERAKSI (Modal & Reaksi)
function openImage(src) {
    const modal = document.getElementById('imageModal');
    const fullImg = document.getElementById('fullImage');
    if (modal && fullImg) {
        modal.style.display = 'flex';
        fullImg.src = src;
    }
}

function toggleExpand(el) {
    el.closest('.comment-box').classList.toggle('expanded');
}

function addReaction(btn, rowIndex, type) {
    const span = btn.querySelector('span');
    let count = parseInt(span.innerText);
    span.innerText = count + 1;

    btn.style.transform = "scale(1.2)";
    setTimeout(() => btn.style.transform = "scale(1)", 100);

    // Kirim data ke Google Apps Script
    const actualRow = rowIndex + 2;
    if (webAppURL !== 'ISI_DENGAN_URL_DEPLOYMENT_APPS_SCRIPT_ANDA') {
        fetch(`${webAppURL}?action=addReaction&row=${actualRow}&type=${type}`)
            .catch(err => console.error("Gagal kirim reaksi:", err));
    }
}

// 6. FUNGSI UTAMA LOAD DATA
async function loadComments() {
    try {
        const response = await fetch(`${sheetURL}&t=${Date.now()}`);
        const text = await response.text();
        // slice(1) buang header, reverse() agar yang terbaru di atas
        const rows = parseCSV(text).slice(1).reverse();
        const groups = { "Today": [], "Yesterday": [], "Past": [] };

        rows.forEach((row, index) => {
            if (row.length < 2) return;
            
            // --- PEMETAAN KOLOM (Sesuaikan jika urutan di Sheets berubah) ---
            const time = row[0];        // Kolom A
            const content = row[1];     // Kolom B
            const imageLink = row[2];   // Kolom C (Gambar Anda)
            const countLike = row[3] || 0; // Kolom D
            const countHug = row[4] || 0;  // Kolom E
            const countIdea = row[5] || 0; // Kolom F
            
            let imgHTML = '';
            if (imageLink && imageLink.includes('http')) {
                const imageUrl = convertDriveLink(imageLink);
                imgHTML = `<img src="${imageUrl}" onclick="openImage('${imageUrl}')" style="cursor:zoom-in" onerror="this.style.display='none'">`;
            }

            // Menghitung baris asli di Sheets karena urutan dibalik (reverse)
            const originalIndex = rows.length - 1 - index;

            const card = `
                <div class="comment-box">
                    <div class="comment-text">${content || ''}</div>
                    ${imgHTML}
                    <div class="read-more" onclick="toggleExpand(this)"> Lihat+ </div>
                    <div class="reaction-bar">
                        <button class="reaction-btn" onclick="addReaction(this, ${originalIndex}, 'like')">❤️ <span>${countLike}</span></button>
                        <button class="reaction-btn" onclick="addReaction(this, ${originalIndex}, 'hug')">🫂 <span>${countHug}</span></button>
                        <button class="reaction-btn" onclick="addReaction(this, ${originalIndex}, 'idea')">💡 <span>${countIdea}</span></button>
                    </div>
                </div>
            `;

            const group = getDateGroup(time);
            if (groups[group]) groups[group].push(card);
        });

        let html = '';
        const order = ["Today", "Yesterday", "Past"];
        order.forEach(group => {
            if (groups[group] && groups[group].length > 0) {
                html += `
                    <div class="section-title">${group}</div>
                    <div class="grid">${groups[group].join('')}</div>
                `;
            }
        });

        document.getElementById('comments').innerHTML = html || '<p style="text-align:center; padding:20px;">Belum ada data.</p>';
    } catch (error) {
        console.error("Gagal memuat data:", error);
    }
}

// Jalankan fungsi
loadComments();
setInterval(loadComments, 100000);
