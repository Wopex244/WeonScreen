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
    ticker: [],     // Array of { message }
    isLoggedIn: false
};

// --- DOM ELEMENTS ---
const container = document.getElementById('full-screen-container');
const clockEl = document.getElementById('clock');
const dateEl = document.getElementById('date');
const annContainer = document.getElementById('announcements-container');
const menuContainer = document.getElementById('menu-container');
const mediaContainer = document.getElementById('bg-media-container');

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
const saveMenuBtn = document.getElementById('save-menu-btn');

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
        const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
        state.menu = weekMenu.map(row => {
            const dayIndex = new Date(row.date).getDay(); // 0=Sun
            const adjustedIndex = (dayIndex + 6) % 7;    // 0=Mon
            return {
                id: row.id,
                date: row.date,
                name: days[adjustedIndex] || row.date,
                item: [row.soup, row.main_course, row.side_dish, row.dessert].filter(Boolean).join(', ')
            };
        });
    } catch (e) {
        console.warn('Could not load menu:', e.message);
        // Keep empty state — UI will show nothing rather than stale data
    }

    try {
        // Ticker messages
        const tickers = await apiFetch('/ticker/active');
        state.ticker = tickers.map(t => t.message);
        updateTickerDisplay();
    } catch (e) {
        console.warn('Could not load ticker:', e.message);
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

function handleScaling() {
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    const targetRatio = CONFIG.baseWidth / CONFIG.baseHeight;
    const windowRatio = ww / wh;

    let scale = 1;

    if (windowRatio > targetRatio) {
        scale = wh / CONFIG.baseHeight;
    } else {
        scale = ww / CONFIG.baseWidth;
    }

    container.style.transform = `scale(${scale})`;
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
        const video = document.createElement('video');
        video.src = videoFile.url;
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.className = 'bg-video active';
        mediaContainer.appendChild(video);
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
        .map(msg => `<span>${msg}</span><span>•</span>`)
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

    // 3. Admin UI Sync
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

    // Global click for fullscreen
    document.addEventListener('click', (e) => {
        // Ignore if logged in or clicking inside a modal or admin panel
        if (state.isLoggedIn) return;
        if (e.target.closest('.modal-overlay') || e.target.closest('.admin-panel-content') || e.target.closest('.auth-box')) return;

        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
        }
    });
}

init();
