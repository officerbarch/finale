// 1. KONFIGURASI (Ganti URL di bawah dengan milik Anda)
const sheetURL = 'https://docs.google.com/spreadsheets/d/1jaO6kwbXqLBFzHAI9KphFX95Pxdsrgxybdg48oLhAmM/export?format=csv';
const webAppURL = 'https://script.google.com/macros/s/AKfycbxODONMqj_nKapS5Qgda0aeYpHKjqJMvOWhU67NnUscE7MdfiswlkNGVLgkVu8jVoP1/exec';

// 2. FUNGSI PARSING CSV
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

// 3. FUNGSI KONVERSI LINK DRIVE (Perbaikan Sintaks $)
function convertDriveLink(url) {
    const match = url.match(/\/d\/(.*?)\//);
    return match ? `https://drive.google.com/uc?export=view&id=${match[1]}` : url;
}

// 4. FUNGSI MENCARI GAMBAR DALAM ROW
function findImage(row) {
    for (let cell of row) {
        if (cell && (cell.includes('http') || cell.includes('drive.google'))) return cell;
    }
    return null;
}

// 5. FUNGSI PENGELOMPOKAN TANGGAL
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

// 6. FUNGSI INTERAKSI (Buka Gambar & Reaksi)
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

    // Efek Visual
    btn.style.transform = "scale(1.2)";
    setTimeout(() => btn.style.transform = "scale(1)", 100);

    // Kirim ke Google Sheets (Row index + 2 karena CSV mulai dari nol dan ada header)
    const actualRow = rowIndex + 2;
    fetch(`${webAppURL}?action=addReaction&row=${actualRow}&type=${type}`)
        .catch(err => console.error("Gagal mengirim reaksi:", err));
}

// 7. FUNGSI UTAMA LOAD DATA
async function loadComments() {
    try {
        const response = await fetch(`${sheetURL}&t=${Date.now()}`);
        const text = await response.text();
        // slice(1) untuk buang header, reverse() agar yang terbaru di atas
        const rows = parseCSV(text).slice(1).reverse();

        const groups = { "Today": [], "Yesterday": [], "Past": [] };

        rows.forEach((row, index) => {
            if (row.length < 2) return;
            
            // Penentuan urutan kolom: A=Time, B=Content, C=Image, D=Like, E=Hug, F=Idea
            const time = row[0];
            const content = row[1];
            const image = findImage(row);
            const countLike = row[3] || 0;
            const countHug = row[4] || 0;
            const countIdea = row[5] || 0;
            
            if (!content && !image) return;

            let imgHTML = '';
            if (image && image.startsWith('http')) {
                const imageUrl = convertDriveLink(image);
                // Ditambahkan fungsi klik untuk memperbesar gambar
                imgHTML = `<img src="${imageUrl}" onclick="openImage('${imageUrl}')" style="cursor:zoom-in" onerror="this.style.display='none'">`;
            }

            // Note: index di sini perlu disesuaikan karena kita menggunakan .reverse()
            // Baris asli di Sheet = (TotalRows - current index) + 1
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

        document.getElementById('comments').innerHTML = html || '<p style="text-align:center; padding:20px;">Belum ada pengakuan saat ini.</p>';
    } catch (error) {
        console.error("Gagal memuat data:", error);
    }
}

// Jalankan Load Data
loadComments();
setInterval(loadComments, 100000);
