// 1. KONFIGURASI DATA
const sheetURL = 'https://docs.google.com/spreadsheets/d/1jaO6kwbXqLBFzHAI9KphFX95Pxdsrgxybdg48oLhAmM/export?format=csv';
const webAppURL = 'https://script.google.com/macros/s/AKfycbxODONMqj_nKapS5Qgda0aeYpHKjqJMvOWhU67NnUscE7MdfiswlkNGVLgkVu8jVoP1/exec'; 

let allCommentsData = [];

// 2. PARSER CSV
function parseCSV(text) {
    const rows = [];
    let row = [], cell = '', insideQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i], next = text[i+1];
        if (char === '"' && insideQuotes && next === '"') { cell += '"'; i++; }
        else if (char === '"') { insideQuotes = !insideQuotes; }
        else if (char === ',' && !insideQuotes) { row.push(cell); cell = ''; }
        else if (char === '\n' && !insideQuotes) { row.push(cell); rows.push(row); row = []; cell = ''; }
        else if (char !== '\r') { cell += char; }
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
}

// 3. FUNGSI MEDIA (GAMBAR & VIDEO)
function convertDriveLink(url) {
    if (!url) return '';
    let fileId = url.match(/\/d\/(.*?)\//)?.[1] || url.match(/[?&]id=([^&]+)/)?.[1];
    if (url.includes('drive.google.com')) {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
    return url;
}

function renderComments(dataArray, isFiltering = false, tagLabel = "") {
    const container = document.getElementById('comments');
    const groups = { "Today": [], "Yesterday": [], "Past": [] };
    
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
        const contentLower = item.content.toLowerCase();
        let categoryClass = '';
        if (contentLower.includes('#reply')) categoryClass = 'tag-reply';
        else if (contentLower.includes('#justlisten')) categoryClass = 'tag-listen';
        else if (contentLower.includes('#qna')) categoryClass = 'tag-qna';

        let rawContent = item.content;
        let extractedMediaHTML = '';
        
        const urlPattern = /(https?:\/\/[^\s]+)/gi;
        const foundUrls = rawContent.match(urlPattern);

        if (foundUrls) {
            foundUrls.forEach(link => {
                // LOGIKA GAMBAR
                if (link.match(/\.(jpeg|jpg|gif|png)$/i) || (link.includes('drive.google.com') && !link.includes('file/d/'))) {
                    extractedMediaHTML += `<img src="${convertDriveLink(link)}" onclick="openImage(this.src)" style="margin-top:15px; width:100%; border-radius:8px; border:1px solid #000; cursor:zoom-in;">`;
                    rawContent = rawContent.replace(link, '');
                } 
                // LOGIKA VIDEO YOUTUBE
                else if (link.includes('youtube.com') || link.includes('youtu.be')) {
                    let videoId = link.includes('youtu.be') ? link.split('/').pop() : link.split('v=')[1]?.split('&')[0];
                    extractedMediaHTML += `<div style="margin-top:15px; position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:8px; border:1px solid #000;"><iframe style="position:absolute; top:0; left:0; width:100%; height:100%;" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe></div>`;
                    rawContent = rawContent.replace(link, '');
                }
                // LOGIKA VIDEO DRIVE
                else if (link.includes('drive.google.com') && (link.includes('/file/d/') || link.includes('?id='))) {
                    let fileId = link.match(/\/d\/(.*?)\//)?.[1] || link.match(/[?&]id=([^&]+)/)?.[1];
                    extractedMediaHTML += `<div style="margin-top:15px; position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:8px; border:1px solid #000;"><iframe style="position:absolute; top:0; left:0; width:100%; height:100%;" src="https://drive.google.com/file/d/${fileId}/preview" frameborder="0" allowfullscreen></iframe></div>`;
                    rawContent = rawContent.replace(link, '');
                }
            });
        }

        const tagMatches = rawContent.match(/#\w+/g);
        let tagsHTML = tagMatches ? `<div class="tag-container">${tagMatches.map(t => `<span class="tag" onclick="filterByTag('${t}')">${t}</span>`).join('')}</div>` : '';
        let contentClean = rawContent.replace(/#\w+/g, '').trim();

        const needsReadMore = contentClean.length > 180;

        const card = `
            <div class="comment-box ${categoryClass}">
                ${tagsHTML}
                <div class="comment-text">${contentClean}</div>
                ${needsReadMore ? `<div class="read-more" onclick="toggleExpand(this)">Lihat Selengkapnya+</div>` : ''}
                ${extractedMediaHTML}
                <div class="reaction-bar">
                    <button class="reaction-btn" onclick="addReaction(this, ${item.originalRow}, 'like')">🥺 <span>${item.like}</span></button>
                    <button class="reaction-btn" onclick="addReaction(this, ${item.originalRow}, 'hug')">😭 <span>${item.hug}</span></button>
                    <button class="reaction-btn" onclick="addReaction(this, ${item.originalRow}, 'idea')">🫠 <span>${item.idea}</span></button>
                </div>
            </div>`;

        const group = getDateGroup(item.time);
        if (groups[group]) groups[group].push(card);
    });

    let html = '';
    ["Today", "Yesterday", "Past"].forEach(g => {
        if (groups[g]?.length > 0) {
            if (!isFiltering) html += `<div class="section-title">${g}</div>`;
            html += `<div class="grid">${groups[g].join('')}</div>`;
        }
    });
    container.innerHTML = html || '<p style="text-align:center; padding:20px;">Belum ada data.</p>';
}

// 4. INTERAKSI & UTILS
function toggleExpand(btn) {
    const box = btn.parentElement;
    const isExpanded = box.classList.toggle('expanded');
    btn.innerText = isExpanded ? "Sembunyikan-" : "Lihat Selengkapnya+";
}

function getDateGroup(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return "Past";
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays < 1 && now.getDate() === d.getDate()) return "Today";
    if (diffDays <= 1) return "Yesterday";
    return "Past";
}

function filterByTag(tag) { renderComments(allCommentsData.filter(i => i.content.toLowerCase().includes(tag.toLowerCase())), true, tag); }

function openImage(src) { 
    document.getElementById('imageModal').style.display = 'flex'; 
    document.getElementById('fullImage').src = src; 
}

function addReaction(btn, rowIndex, type) {
    const span = btn.querySelector('span');
    span.innerText = parseInt(span.innerText) + 1;
    fetch(`${webAppURL}?action=addReaction&row=${rowIndex}&type=${type}`).catch(e => console.error(e));
}

async function loadComments() {
    try {
        const response = await fetch(`${sheetURL}&t=${Date.now()}`);
        const text = await response.text();
        const rows = parseCSV(text).slice(1);
        allCommentsData = rows.map((row, index) => ({
            originalRow: index + 2, 
            time: row[0], content: row[1] || '', 
            like: row[3] || 0, hug: row[4] || 0, idea: row[5] || 0
        })).reverse(); 
        renderComments(allCommentsData);
    } catch (e) { console.error(e); }
}

loadComments();
setInterval(loadComments, 60000);
