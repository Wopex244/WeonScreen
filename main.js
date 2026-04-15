// --- CONFIGURATION & STATE ---
const CONFIG = {
    bgInterval: 8000,
    baseWidth: 1920,
    baseHeight: 1080,
    apiBase: '/api',
    // Default backgrounds
    defaultBgs: [
        { type: 'video', url: '/Backgrounds/TestVideo.mp4' },
    ]
};

// In-memory JWT (never persisted to localStorage)
let authToken = null;

let state = {
    announcements: [],
    menu: [],       // Array of { name, item } for weekly display
    ticker: [],     // Array of { id, message }
    events: [],     // Background media
    birthday: [],   // Array of { id, title, content }
    isLoggedIn: false
};

// --- DOM ELEMENTS ---
const container = document.getElementById('full-screen-container');
const clockEl = document.getElementById('clock');
const dateEl = document.getElementById('date');
const annContainer = document.getElementById('announcements-container');
const menuContainer = document.getElementById('menu-container');
const mediaContainer = document.getElementById('bg-media-container');
const birthdayContainer = document.getElementById('birthday-container');

const headerAuthBox = document.getElementById('header-auth-box');
const loginTrigger = document.getElementById('login-trigger');
const panelTrigger = document.getElementById('panel-trigger');
const authModal = document.getElementById('auth-modal');
const adminModal = document.getElementById('admin-modal');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const closeAuth = document.getElementById('close-auth');
const closeAdmin = document.getElementById('close-admin');

// Admin Elements
const annTitleInput = document.getElementById('ann-title');
const annContentInput = document.getElementById('ann-content');
const addAnnBtn = document.getElementById('add-ann-btn');
const adminAnnList = document.getElementById('admin-ann-list');
const adminMenuList = document.getElementById('admin-menu-list');
const adminMediaList = document.getElementById('admin-media-list');
const saveMenuBtn = document.getElementById('save-menu-btn');

// Media Inputs
const mediaTitleInput = document.getElementById('media-title');
const mediaUrlInput = document.getElementById('media-url');
const mediaTypeSelect = document.getElementById('media-type');
const addMediaBtn = document.getElementById('add-media-btn');

const tickerMessageInput = document.getElementById('ticker-message');
const addTickerBtn = document.getElementById('add-ticker-btn');
const adminTickerList = document.getElementById('admin-ticker-list');

// Birthday Admin Elements
const birthdayTitleInput = document.getElementById('birthday-title');
const birthdayContentInput = document.getElementById('birthday-content');
const addBirthdayBtn = document.getElementById('add-birthday-btn');
const adminBirthdayList = document.getElementById('admin-birthday-list');

// --- API HELPERS ---

/**
 * Wraps fetch with JSON defaults and optional Bearer token.
 */
async function apiFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    const res = await fetch(`${CONFIG.apiBase}${path}`, { ...options, headers });
    
    if (res.status === 204) return null;

    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) throw Object.assign(new Error(data.error || 'API hatası'), { status: res.status });
        return data;
    } else {
        // Not JSON - probably a server crash or Vercel error page
        const text = await res.text();
        if (!res.ok) {
            console.error('Non-JSON Error Response:', text);
            throw Object.assign(new Error('Sunucu hatası oluştu (JSON olmayan yanıt). Veritabanı bağlantınızı ve ortam değişkenlerinizi kontrol edin.'), { status: res.status });
        }
        return text;
    }
}

/**
 * Load public display data from the API and update state.
 */
async function loadDisplayData() {
    try {
        // Announcements
        const announcements = await apiFetch('/announcements/active');
        state.announcements = announcements.map(a => ({ id: a.id, title: a.title, content: a.content }));
    } catch (e) {
        console.warn('Could not load announcements:', e.message);
    }

    try {
        // Weekly menu (Mon–Fri)
        const weekMenu = await apiFetch('/menu/week');
        const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
        
        // 1. Get this week's Monday (local/display relative)
        const now = new Date();
        const monday = new Date(now);
        monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        monday.setHours(0,0,0,0);

        // 2. Map existing data to a date string key "YYYY-MM-DD"
        const menuMap = {};
        weekMenu.forEach(row => {
            const d = new Date(row.date);
            const iso = d.toISOString().split('T')[0];
            menuMap[iso] = row;
        });

        // 3. Build fixed 5-day structure
        state.menu = days.map((dayName, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const iso = d.toISOString().split('T')[0];
            const row = menuMap[iso];

            return {
                id: row ? row.id : null,
                date: iso,
                name: dayName,
                item: row ? [row.soup, row.main_course, row.side_dish, row.dessert].filter(Boolean).join(', ') : 'Menü Belirtilmedi'
            };
        });
    } catch (e) {
        console.warn('Could not load menu:', e.message);
        // Keep empty state — UI will show nothing rather than stale data
    }

    try {
        // Ticker messages
        const tickers = await apiFetch('/ticker/active');
        state.ticker = tickers.map(t => ({ id: t.id, message: t.message }));
        updateTickerDisplay();
    } catch (e) {
        console.warn('Could not load ticker:', e.message);
    }

    try {
        // Events (Background Media)
        const events = await apiFetch('/events/active');
        const oldEventsStr = JSON.stringify(state.events);
        state.events = events.map(e => ({ id: e.id, title: e.title, url: e.media_url, type: e.media_type }));
        
        // Only re-init if media changed to avoid flickering
        if (JSON.stringify(state.events) !== oldEventsStr) {
            CONFIG.defaultBgs = state.events.map(e => ({ type: e.type, url: e.url }));
            initBackgrounds();
        }
    } catch (e) {
        console.warn('Could not load events:', e.message);
    }

    try {
        // Birthday entries
        const birthdays = await apiFetch('/birthday/active');
        state.birthday = birthdays.map(b => ({ id: b.id, title: b.title, content: b.content }));
    } catch (e) {
        console.warn('Could not load birthdays:', e.message);
    }

    renderAll();
}

// --- INITIALIZATION ---
function init() {
    handleScaling();
    window.addEventListener('resize', handleScaling);
    document.addEventListener('fullscreenchange', handleFullscreenUI);

    updateClock();
    setInterval(updateClock, 1000);

    initBackgrounds();
    setupEventListeners();

    // Load data from API
    loadDisplayData();

    // Refresh display data every 60 seconds
    setInterval(loadDisplayData, 60_000);
}

// --- CORE LOGIC ---
/**
 * Detects if a URL is a YouTube link and returns the embed URL if it is.
 */
function getYoutubeEmbedUrl(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
        const videoId = match[2];
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&loop=1&playlist=${videoId}&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&enablejsapi=1`;
    }
    return null;
}

function handleScaling() {
    // Layout is now fluid via CSS (100vw/100vh)
    // No JS scaling needed unless we want to maintain a specific internal ratio
}

function handleFullscreenUI() {
    if (document.fullscreenElement) {
        if (headerAuthBox) headerAuthBox.classList.add('hidden');
    } else {
        if (headerAuthBox) headerAuthBox.classList.remove('hidden');
    }
}

function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    dateEl.textContent = now.toLocaleDateString('tr-TR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
}

function initBackgrounds() {
    mediaContainer.innerHTML = '';

    if (!CONFIG.defaultBgs || CONFIG.defaultBgs.length === 0) {
        console.warn("No backgrounds configured.");
        return;
    }

    // Check for video first
    const videoFile = CONFIG.defaultBgs.find(b => b.type === 'video');

    if (videoFile) {
        const ytUrl = getYoutubeEmbedUrl(videoFile.url);

        if (ytUrl) {
            // YouTube Handler
            const iframe = document.createElement('iframe');
            iframe.src = ytUrl;
            iframe.className = 'bg-video active';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.frameBorder = '0';
            iframe.style.pointerEvents = 'none'; // Prevent interaction
            mediaContainer.appendChild(iframe);
        } else {
            // Native Video Handler
            const video = document.createElement('video');
            video.src = videoFile.url;
            video.autoplay = true;
            video.muted = false;
            video.loop = true;
            video.playsInline = true;
            video.className = 'bg-video active';
            mediaContainer.appendChild(video);
        }
    } else {
        CONFIG.defaultBgs.forEach((bg, index) => {
            const img = document.createElement('img');
            img.src = bg.url;
            img.className = `bg-slide ${index === 0 ? 'active' : ''}`;
            img.onerror = () => console.error(`Failed to load background: ${bg.url}`);
            mediaContainer.appendChild(img);
        });

        if (CONFIG.defaultBgs.length > 1) {
            startBgSlider();
        }
    }
}

function startBgSlider() {
    let current = 0;
    const slides = document.querySelectorAll('.bg-slide');
    if (slides.length < 2) return;
    setInterval(() => {
        slides[current].classList.remove('active');
        current = (current + 1) % slides.length;
        slides[current].classList.add('active');
    }, CONFIG.bgInterval);
}

function updateTickerDisplay() {
    const marquee = document.querySelector('.marquee-content');
    if (!marquee || state.ticker.length === 0) return;
    marquee.innerHTML = state.ticker
        .map(t => `<span>${t.message}</span><span>•</span>`)
        .join('');
}

function renderAll() {
    // 1. Announcements
    annContainer.innerHTML = state.announcements.map((ann, index) => `
    <div class="announcement-card" style="animation: slideIn 0.8s ease forwards; animation-delay: ${index * 0.1}s">
      <h3>${ann.title}</h3>
      <p>${ann.content}</p>
    </div>
  `).join('');

    // 2. Menu Items
    menuContainer.innerHTML = state.menu.map(item => `
    <div class="menu-item">
      <span class="day-name">${item.name}</span>
      <span class="item-desc">${item.item}</span>
    </div>
  `).join('');

    // 3. Birthday
    birthdayContainer.innerHTML = state.birthday.map((b, index) => `
    <div class="birthday-card" style="animation: slideIn 0.8s ease forwards; animation-delay: ${index * 0.1}s">
      <h4>${b.title}</h4>
      <p>${b.content}</p>
    </div>
  `).join('');

    // 4. Admin UI Sync
    if (state.isLoggedIn) {
        document.body.classList.add('admin-mode');
        loginTrigger.classList.add('hidden');
        panelTrigger.classList.remove('hidden');
        renderAdminLists();
    } else {
        document.body.classList.remove('admin-mode');
        loginTrigger.classList.remove('hidden');
        panelTrigger.classList.add('hidden');
    }
}

function renderAdminLists() {
    adminAnnList.innerHTML = state.announcements.map(ann => `
    <div class="admin-item">
      <div class="info">
        <h4>${ann.title}</h4>
      </div>
      <button class="btn-danger delete-ann-btn" data-id="${ann.id}">Sil</button>
    </div>
  `).join('');

    adminMenuList.innerHTML = state.menu.map((item, index) => `
    <div style="margin-bottom: 20px; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 10px;">
      <input type="hidden" class="menu-id-input" data-index="${index}" value="${item.id || ''}">
      <input type="text" class="menu-title-input" data-index="${index}" value="${item.name}" placeholder="Başlık (Örn: Pazartesi)" style="margin-bottom:10px; font-weight:700; color: var(--accent);">
      <input type="text" class="menu-item-input" data-index="${index}" value="${item.item}" placeholder="Menü İçeriği" style="margin-bottom:0">
    </div>
  `).join('');

    adminMediaList.innerHTML = state.events.map(ev => `
    <div class="admin-item">
      <div class="info">
        <h4>${ev.title} (${ev.type})</h4>
        <small style="opacity: 0.6; word-break: break-all;">${ev.url}</small>
      </div>
      <button class="btn-danger delete-media-btn" data-id="${ev.id}">Sil</button>
    </div>
  `).join('');

    adminTickerList.innerHTML = state.ticker.map(t => `
    <div class="admin-item">
      <div class="info">
        <p>${t.message}</p>
      </div>
      <button class="btn-danger delete-ticker-btn" data-id="${t.id}">Sil</button>
    </div>
  `).join('');

    adminBirthdayList.innerHTML = state.birthday.map(b => `
    <div class="admin-item">
      <div class="info">
        <h4>${b.title}</h4>
      </div>
      <button class="btn-danger delete-birthday-btn" data-id="${b.id}">Sil</button>
    </div>
  `).join('');

    document.querySelectorAll('.delete-ann-btn').forEach(btn => {
        btn.onclick = async (e) => {
            const id = e.currentTarget.dataset.id;
            try {
                await apiFetch(`/announcements/${id}`, { method: 'DELETE' });
                state.announcements = state.announcements.filter(a => a.id !== id);
                renderAll();
            } catch (err) {
                alert('Duyuru silinemedi: ' + err.message);
            }
        };
    });

    document.querySelectorAll('.delete-media-btn').forEach(btn => {
        btn.onclick = async (e) => {
            const id = e.currentTarget.dataset.id;
            if (!confirm('Bu medyayı silmek istediğinize emin misiniz?')) return;
            try {
                await apiFetch(`/events/${id}`, { method: 'DELETE' });
                await loadDisplayData();
            } catch (err) {
                alert('Medya silinemedi: ' + err.message);
            }
        };
    });

    document.querySelectorAll('.delete-ticker-btn').forEach(btn => {
        btn.onclick = async (e) => {
            const id = e.currentTarget.dataset.id;
            if (!confirm('Bu mesajı silmek istediğinize emin misiniz?')) return;
            try {
                await apiFetch(`/ticker/${id}`, { method: 'DELETE' });
                await loadDisplayData();
            } catch (err) {
                alert('Mesaj silinemedi: ' + err.message);
            }
        };
    });

    document.querySelectorAll('.delete-birthday-btn').forEach(btn => {
        btn.onclick = async (e) => {
            const id = e.currentTarget.dataset.id;
            if (!confirm('Bu girişi silmek istediğinize emin misiniz?')) return;
            try {
                await apiFetch(`/birthday/${id}`, { method: 'DELETE' });
                await loadDisplayData();
            } catch (err) {
                alert('Doğum günü girişi silinemedi: ' + err.message);
            }
        };
    });
}

// --- EVENT LISTENERS ---

function setupEventListeners() {
    if (!loginTrigger) return console.error("CRITICAL: Login trigger not found!");

    loginTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        authModal.classList.remove('hidden');
    });

    panelTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        adminModal.classList.remove('hidden');
    });

    closeAuth.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        authModal.classList.add('hidden');
    });

    closeAdmin.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        adminModal.classList.add('hidden');
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const data = await apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password }),
            });
            authToken = data.token;
            state.isLoggedIn = true;
            authModal.classList.add('hidden');
            renderAll();
            adminModal.classList.remove('hidden');
        } catch (err) {
            alert('Hatalı giriş! ' + (err.message || ''));
        }
    });

    logoutBtn.onclick = () => {
        authToken = null;
        state.isLoggedIn = false;
        adminModal.classList.add('hidden');
        renderAll();
    };

    addAnnBtn.onclick = async () => {
        const title = annTitleInput.value.trim();
        const content = annContentInput.value.trim();
        if (!title || !content) return;

        try {
            const newAnn = await apiFetch('/announcements', {
                method: 'POST',
                body: JSON.stringify({ title, content }),
            });
            state.announcements.unshift({ id: newAnn.id, title: newAnn.title, content: newAnn.content });
            annTitleInput.value = '';
            annContentInput.value = '';
            renderAll();
        } catch (err) {
            alert('Duyuru eklenemedi: ' + err.message);
        }
    };

    saveMenuBtn.onclick = async () => {
        const idInputs = document.querySelectorAll('.menu-id-input');
        const titleInputs = document.querySelectorAll('.menu-title-input');
        const itemInputs = document.querySelectorAll('.menu-item-input');

        const updates = [];
        titleInputs.forEach((input, index) => {
            const id = idInputs[index]?.value;
            const rawItem = itemInputs[index].value;
            // Split comma-separated item back into fields (best-effort for saved data)
            const parts = rawItem.split(',').map(s => s.trim());
            updates.push({
                id,
                soup: parts[0] || null,
                main_course: parts[1] || null,
                side_dish: parts[2] || null,
                dessert: parts[3] || null,
            });
        });

        try {
            await Promise.all(updates.map(u => {
                if (!u.id) return Promise.resolve();
                return apiFetch(`/menu/${u.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        soup: u.soup,
                        main_course: u.main_course,
                        side_dish: u.side_dish,
                        dessert: u.dessert,
                    }),
                });
            }));
            await loadDisplayData();
            alert('Menü Kaydedildi!');
        } catch (err) {
            alert('Menü kaydedilemedi: ' + err.message);
        }
    };

    addMediaBtn.onclick = async () => {
        const title = mediaTitleInput.value.trim();
        const url = mediaUrlInput.value.trim();
        const type = mediaTypeSelect.value;
        if (!title || !url) return;

        try {
            await apiFetch('/events', {
                method: 'POST',
                body: JSON.stringify({ title, media_url: url, media_type: type, is_active: true }),
            });
            mediaTitleInput.value = '';
            mediaUrlInput.value = '';
            await loadDisplayData();
        } catch (err) {
            alert('Medya eklenemedi: ' + err.message);
        }
    };

    addTickerBtn.onclick = async () => {
        const message = tickerMessageInput.value.trim();
        if (!message) return;

        try {
            await apiFetch('/ticker', {
                method: 'POST',
                body: JSON.stringify({ message, is_active: true }),
            });
            tickerMessageInput.value = '';
            await loadDisplayData();
        } catch (err) {
            alert('Mesaj eklenemedi: ' + err.message);
        }
    };

    addBirthdayBtn.onclick = async () => {
        const title = birthdayTitleInput.value.trim();
        const content = birthdayContentInput.value.trim();
        if (!title || !content) return;

        try {
            await apiFetch('/birthday', {
                method: 'POST',
                body: JSON.stringify({ title, content, is_active: true }),
            });
            birthdayTitleInput.value = '';
            birthdayContentInput.value = '';
            await loadDisplayData();
        } catch (err) {
            alert('Doğum günü girişi eklenemedi: ' + err.message);
        }
    };

    // Global click for fullscreen and unmuted video play
    document.addEventListener('click', (e) => {
        // Ignore if logged in or clicking inside a modal or admin panel
        if (state.isLoggedIn) return;
        if (e.target.closest('.modal-overlay') || e.target.closest('.admin-panel-content') || e.target.closest('.auth-box')) return;

        // Try to play any video in the media container (if unmuted autoplay was blocked)
        const activeVideos = mediaContainer.querySelectorAll('video');
        activeVideos.forEach(v => v.play().catch(err => console.warn("Video play failed:", err)));

        // For YouTube frames, send play command
        const activeIframes = mediaContainer.querySelectorAll('iframe');
        activeIframes.forEach(f => {
            f.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
            f.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
        });

        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
        }
    });
}

init();
