const API = 'https://smatdeadline-aggragator.onrender.com';
let allData = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    loadData();
    document.getElementById('search-input').addEventListener('input', renderTable);
});

async function loadData() {
    const content = document.getElementById('admin-content');
    content.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--text-dim);">Loading data...</p>';
    
    try {
        const resp = await fetch(`${API}/api/admin/all-data`);
        allData = await resp.json();
        
        // Stats
        let totalTasks = 0, high = 0, medium = 0, low = 0;
        allData.forEach(u => {
            totalTasks += u.tasks.length;
            u.tasks.forEach(t => {
                if (t.priority === 'High') high++;
                else if (t.priority === 'Medium') medium++;
                else low++;
            });
        });

        document.getElementById('stat-users').innerText = allData.length;
        document.getElementById('stat-tasks').innerText = totalTasks;
        document.getElementById('stat-high').innerText = high;
        document.getElementById('stat-medium').innerText = medium;
        document.getElementById('stat-low').innerText = low;
        document.getElementById('last-updated').innerText = `Last updated: ${new Date().toLocaleTimeString()}`;

        renderTable();
        lucide.createIcons();
    } catch (err) {
        content.innerHTML = '<p style="text-align:center; padding: 2rem; color: #ef4444;">❌ Server se connect nahi ho pa raha!</p>';
    }
}

function filterPriority(priority, btn) {
    currentFilter = priority;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderTable();
}

function renderTable() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const content = document.getElementById('admin-content');

    let filtered = allData.filter(user => {
        const matchUser = user.username.toLowerCase().includes(search) || 
                         (user.email && user.email.toLowerCase().includes(search));
        const matchTask = user.tasks.some(t => t.title.toLowerCase().includes(search));
        return matchUser || matchTask;
    });

    if (filtered.length === 0) {
        content.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--text-dim);">No users found.</p>';
        return;
    }

    content.innerHTML = `
        <table class="admin-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Username</th>
                    <th>Email ID</th>
                    <th>Login Time</th>
                    <th>Tasks</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map((user, i) => {
                    const filteredTasks = currentFilter === 'all' 
                        ? user.tasks 
                        : user.tasks.filter(t => t.priority === currentFilter);
                    
                    const taskSearch = search ? filteredTasks.filter(t => t.title.toLowerCase().includes(search)) : filteredTasks;
                    const tasksToShow = taskSearch.length > 0 ? taskSearch : filteredTasks;

                    return `
                    <tr>
                        <td style="color: var(--text-dim); font-weight: 700;">${i + 1}</td>
                        <td>
                            <div style="font-weight: 700; color: #a855f7;">${user.username}</div>
                        </td>
                        <td>
                            <div style="color: var(--text-dim);">${user.email || 'N/A'}</div>
                        </td>
                        <td>
                            <div class="time-info">
                                <div style="color: #22c55e;">🟢 Registered</div>
                                <div style="margin-top: 4px;">ID: #${user.id}</div>
                            </div>
                        </td>
                        <td>
                            ${tasksToShow.length > 0 ? tasksToShow.map(task => `
                                <div class="task-pill">
                                    <span class="priority-badge priority-${task.priority}">${task.priority}</span>
                                    <span style="flex:1; font-weight:600;">${task.title}</span>
                                    <span style="color: var(--text-dim); font-size:0.8rem;">${task.category}</span>
                                    <span style="color: #a78bfa; font-size:0.8rem;">${task.date}</span>
                                    <span style="font-size:0.75rem;">${task.completed ? '✅' : '⏳'}</span>
                                </div>
                            `).join('') : '<span style="color: var(--text-dim); font-size: 0.85rem;">No tasks</span>'}
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    `;
    lucide.createIcons();
}
