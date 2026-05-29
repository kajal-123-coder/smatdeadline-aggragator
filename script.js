/** 
 * SMART DEADLINE - DIRECT APP ENGINE
 */

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'http://localhost:5000/api';
    
    let currentUser = JSON.parse(localStorage.getItem('smartDeadline_currentUser')) || null;
    let authToken = localStorage.getItem('smartDeadline_token') || null;
    let tasks = [];
    let priorityChart = null;
    let categoryChart = null;

    const introScreen = document.getElementById('intro-screen');
    const authScreen = document.getElementById('auth-screen');
    const mainScreen = document.getElementById('main-screen');
    const displayUsername = document.getElementById('display-username');
    const taskList = document.getElementById('task-list');
    const taskForm = document.getElementById('task-form');
    const taskModal = document.getElementById('task-modal');
    const toastContainer = document.getElementById('toast-container');
    const notificationSound = document.getElementById('notification-sound');

    // Initialize Professional Calendar
    flatpickr("#task-date", {
        theme: "dark",
        dateFormat: "Y-m-d",
        minDate: "today"
    });

    lucide.createIcons();
    initApp();

    document.getElementById('enter-portal-btn').onclick = showAuth;

    async function initApp() {
        if (currentUser && authToken) {
            showDashboard();
            await syncData();
            startAutomation();
        } else {
            showIntro();
        }
    }

    function showIntro() {
        introScreen.classList.remove('hidden');
        authScreen.classList.add('hidden');
        mainScreen.classList.add('hidden');
        document.body.classList.remove('dashboard-bg');
    }

    function showAuth() {
        introScreen.classList.add('hidden');
        authScreen.classList.remove('hidden');
        mainScreen.classList.add('hidden');
        document.body.classList.remove('dashboard-bg');
    }

    function showDashboard() {
        introScreen.classList.add('hidden');
        authScreen.classList.add('hidden');
        mainScreen.classList.remove('hidden');
        displayUsername.innerText = currentUser.username;
        document.body.classList.add('dashboard-bg');
    }

    // --- Authentication ---
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');
    const authSubmit = document.getElementById('auth-submit');
    const emailGroup = document.getElementById('email-group');
    let isLogin = true;

    loginTab.onclick = () => {
        isLogin = true;
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        authSubmit.innerText = 'Initialize Access';
        emailGroup.classList.add('hidden');
    };

    signupTab.onclick = () => {
        isLogin = false;
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        authSubmit.innerText = 'Initialize Registry';
        emailGroup.classList.remove('hidden');
    };

    document.getElementById('auth-form').onsubmit = async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const body = isLogin ? { username, password } : { username, password, email: document.getElementById('email').value };

        try {
            const resp = await fetch(`${API_BASE_URL}${isLogin ? '/login' : '/register'}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await resp.json();
            if (!resp.ok) {
                if (!isLogin && data.error && data.error.toLowerCase().includes('already exists')) {
                    notify('This identity is already registered in our system. Please use a different username, or switch to the Login portal to access your account.', 'warning');
                } else {
                    notify(data.error || 'Identity Access Denied', 'warning');
                }
                return;
            }

            if (isLogin) {
                currentUser = { username: data.username };
                authToken = data.token;
                localStorage.setItem('smartDeadline_currentUser', JSON.stringify(currentUser));
                localStorage.setItem('smartDeadline_token', authToken);
                showDashboard();
                await syncData();
                startAutomation();
            } else {
                notify('Registry Created. Please Login.', 'success');
                loginTab.click();
            }
        } catch (err) {
            notify('Server Uplink Failed', 'warning');
        }
    };

    document.getElementById('logout-btn').onclick = () => {
        localStorage.clear();
        currentUser = null;
        authToken = null;
        showAuth();
    };

    // --- Task Manager ---
    async function syncData() {
        try {
            const resp = await fetch(`${API_BASE_URL}/tasks`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (resp.ok) {
                tasks = await resp.json();
                renderMatrix();
                refreshAnalysis();
            }
        } catch (err) { }
    }

    document.getElementById('add-task-btn').onclick = () => taskModal.classList.remove('hidden');
    document.getElementById('cancel-task').onclick = () => taskModal.classList.add('hidden');

    taskForm.onsubmit = async (e) => {
        e.preventDefault();
        const title = document.getElementById('task-title').value;
        const category = document.getElementById('task-category').value;
        const date = document.getElementById('task-date').value;
        const priority = calculatePriority(date);
        
        try {
            const resp = await fetch(`${API_BASE_URL}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                body: JSON.stringify({ title, category, date, priority })
            });

            if (resp.ok) {
                await syncData();
                taskModal.classList.add('hidden');
                taskForm.reset();
                notify('Objective Logged', 'success');
            }
        } catch (err) { }
    };

    function calculatePriority(dueDate) {
        const diff = new Date(dueDate).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        if (days <= 2) return 'High';
        if (days <= 5) return 'Medium';
        return 'Low';
    }

    function renderMatrix() {
        const query = document.getElementById('search-tasks').value.toLowerCase();
        const results = tasks.filter(t => t.title.toLowerCase().includes(query));

        if (results.length === 0) {
            taskList.innerHTML = '<li class="empty-state glass" style="padding: 2rem; text-align: center;">No Active Objectives.</li>';
            return;
        }

        taskList.innerHTML = results.map(task => {
            const diff = new Date(task.date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
            const ttl = Math.ceil(diff / (1000 * 60 * 60 * 24));
            
            return `
                <li class="task-item glass">
                    <span class="priority-badge priority-${task.priority}">${task.priority}</span>
                    <span style="font-weight: 600;">${task.title}</span>
                    <span style="color: var(--text-dim);">${task.category}</span>
                    <span style="font-family: 'Outfit';">${task.date}</span>
                    <span style="font-weight: 700; color: ${ttl < 0 ? '#ff4d4d' : 'inherit'}">${ttl < 0 ? Math.abs(ttl)+'d overdue' : ttl+'d'}</span>
                    <button class="icon-btn" onclick="window.purgeTask(${task.id})"><i data-lucide="trash-2" style="width: 18px;"></i></button>
                </li>
            `;
        }).join('');
        lucide.createIcons();
    }

    window.purgeTask = async (id) => {
        try {
            await fetch(`${API_BASE_URL}/tasks/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}` } });
            await syncData();
            notify('Objective Purged', 'info');
        } catch (err) { }
    };

    // --- Analytics ---
    function refreshAnalysis() {
        const stats = { High: 0, Medium: 0, Low: 0 };
        const sectors = {};
        tasks.forEach(t => {
            stats[t.priority]++;
            sectors[t.category] = (sectors[t.category] || 0) + 1;
        });

        document.getElementById('count-high').innerText = stats.High;
        document.getElementById('count-medium').innerText = stats.Medium;
        document.getElementById('count-low').innerText = stats.Low;

        const cfg = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };

        if (priorityChart) priorityChart.destroy();
        priorityChart = new Chart(document.getElementById('priorityChart').getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['High', 'Medium', 'Low'],
                datasets: [{ data: [stats.High, stats.Medium, stats.Low], backgroundColor: ['#ef4444', '#ffa500', '#00ff7f'], borderWidth: 0, cutout: '75%' }]
            },
            options: cfg
        });

        if (categoryChart) categoryChart.destroy();
        categoryChart = new Chart(document.getElementById('categoryChart').getContext('2d'), {
            type: 'bar',
            data: {
                labels: Object.keys(sectors),
                datasets: [{ data: Object.values(sectors), backgroundColor: '#8a2be2', borderRadius: 8 }]
            },
            options: { ...cfg, scales: { y: { beginAtZero: true }, x: { grid: { display: false } } } }
        });
    }

    function startAutomation() {
        setInterval(checkAlerts, 60000);
        checkAlerts();
    }

    function checkAlerts() {
        const now = new Date().toISOString().split('T')[0];
        tasks.forEach(t => {
            if (t.date === now) {
                notify(`ALERT: ${t.title} Due Today`, 'warning');
                notificationSound.play().catch(() => {});
            }
        });
    }

    function notify(msg, type = 'info') {
        const modal = document.getElementById('notification-modal');
        const content = document.getElementById('notification-content');
        const icon = document.getElementById('notification-icon');
        const title = document.getElementById('notification-title');
        const message = document.getElementById('notification-message');

        message.innerText = msg;
        
        if (type === 'warning' || type === 'error') {
            content.style.borderTopColor = '#ef4444';
            icon.style.color = '#ef4444';
            icon.setAttribute('data-lucide', 'alert-triangle');
            title.style.color = '#f87171';
            title.innerText = 'System Alert';
        } else if (type === 'success') {
            content.style.borderTopColor = '#10b981';
            icon.style.color = '#10b981';
            icon.setAttribute('data-lucide', 'check-circle');
            title.style.color = '#6ee7b7';
            title.innerText = 'Success';
        } else {
            content.style.borderTopColor = '#a855f7';
            icon.style.color = '#a855f7';
            icon.setAttribute('data-lucide', 'info');
            title.style.color = '#c084fc';
            title.innerText = 'System Notice';
        }

        if (window.lucide) {
            lucide.createIcons();
        }
        modal.classList.remove('hidden');
    }
});
