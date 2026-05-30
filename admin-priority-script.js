document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    const content = document.getElementById('priority-content');

    try {
        const resp = await fetch('https://smatdeadline-aggragator.onrender.com/api/admin/all-data');
        const data = await resp.json();

        if (data.length === 0) {
            content.innerHTML = '<p class="empty-state">No data found.</p>';
            return;
        }

        // Combine all tasks
        let allTasks = [];
        data.forEach(user => {
            user.tasks.forEach(task => {
                allTasks.push({ ...task, username: user.username });
            });
        });

        const high = allTasks.filter(t => t.priority === 'High');
        const medium = allTasks.filter(t => t.priority === 'Medium');
        const low = allTasks.filter(t => t.priority === 'Low');

        const taskRows = (tasks) => tasks.length > 0 ? tasks.map(task => `
            <li class="task-item glass" style="grid-template-columns: 140px 1fr 100px 120px 120px;">
                <span style="color: var(--primary-light); font-weight: 600;">${task.username}</span>
                <span class="task-title">${task.title}</span>
                <span class="task-category">${task.category}</span>
                <span class="task-date">${task.date}</span>
                <span style="color: var(--text-dim); font-size: 0.8rem;">${task.completed ? '✅ Done' : '⏳ Pending'}</span>
            </li>
        `).join('') : '<li class="empty-state">No tasks.</li>';

        content.innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h4 style="color: #ef4444; margin-bottom: 1rem; padding: 0.5rem 1rem; background: rgba(239,68,68,0.1); border-left: 4px solid #ef4444; border-radius: 8px;">
                    🚨 High Priority — ${high.length} Tasks
                </h4>
                <ul>${taskRows(high)}</ul>
            </div>
            <div style="margin-bottom: 2rem;">
                <h4 style="color: #f97316; margin-bottom: 1rem; padding: 0.5rem 1rem; background: rgba(249,115,22,0.1); border-left: 4px solid #f97316; border-radius: 8px;">
                    ⚠️ Medium Priority — ${medium.length} Tasks
                </h4>
                <ul>${taskRows(medium)}</ul>
            </div>
            <div style="margin-bottom: 2rem;">
                <h4 style="color: #22c55e; margin-bottom: 1rem; padding: 0.5rem 1rem; background: rgba(34,197,94,0.1); border-left: 4px solid #22c55e; border-radius: 8px;">
                    ✅ Low Priority — ${low.length} Tasks
                </h4>
                <ul>${taskRows(low)}</ul>
            </div>
        `;
        lucide.createIcons();
    } catch (err) {
        content.innerHTML = '<p class="empty-state" style="color: #ff4d4d;">Failed to connect to the server!</p>';
    }
});
