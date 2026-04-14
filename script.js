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
        } else if (char === '\r') {
            // Abaikan carriage return
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
    const match = url.match(/\/d\/(.*?)\//);
    // PERBAIKAN: Menggunakan tanda $ untuk variabel dalam template literal
    return match ? `https://lh3.googleusercontent.com/u/0/d/${match[1]}` : url;
}

function findImage(row) {
    for (let cell of row) {
        if (cell && (cell.includes('http') || cell.includes('drive.google'))) return cell;
    }
    return null;
}

function getDateGroup(dateStr) {
    if (!dateStr) return "Past";
    
    // Perbaikan parsing tanggal untuk format Google Sheets (biasanya MM/DD/YYYY atau DD/MM/YYYY)
    const d = new Date(dateStr);
    if (isNaN(d)) return "Past";
    
    const now = new Date();
    const diffTime = now - d;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 1 && now.getDate() === d.getDate()) return "Today";
    if (diffDays <= 1) return "Yesterday";
    return "Past";
}

function toggleExpand(el) {
    el.closest('.comment-box').classList.toggle('expanded');
}

function addReaction(btn) {
    const span = btn.querySelector('span');
    let count = parseInt(span.innerText);
    span.innerText = count + 1;
    btn.style.transform = "scale(1.2)";
    setTimeout(() => btn.style.transform = "scale(1)", 100);
}

async function loadComments() {
    try {
        const response = await fetch(`${sheetURL}&t=${Date.now()}`);
        const text = await response.text();
        const rows = parseCSV(text).slice(1);

        const groups = { "Today": [], "Yesterday": [], "Past": [] };

        rows.forEach(row => {
            if (row.length < 2) return;
            
            const time = row[0];
            const content = row[1];
            let image = findImage(row);
            
            if (!content && !image) return;

            let imgHTML = '';
            if (image && image.startsWith('http')) {
                const imageUrl = convertDriveLink(image);
                imgHTML = `<img src="${imageUrl}" onerror="this.style.display='none'">`;
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

// Jalankan pertama kali
loadComments();

// Update setiap 30 detik
setInterval(loadComments, 100000);
