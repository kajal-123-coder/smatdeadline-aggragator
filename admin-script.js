document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    const content = document.getElementById('admin-content');
    const totalUsersVal = document.getElementById('total-users-val');
    const totalTasksVal = document.getElementById('total-tasks-val');

    try {
        const resp = await fetch('https://smatdeadline-aggragator.onrender.com');
        const data = await resp.json();

        if (data.length === 0) {
            content.innerHTML = '<p class="empty-state">No users registered yet.</p>';
            return;
        }

        let totalTasks = 0;
        data.forEach(u => totalTasks += u.tasks.length);
        if(totalUsersVal) totalUsersVal.innerText = `Users: ${data.length}`;
        if(totalTasksVal) totalTasksVal.innerText = `Tasks: ${totalTasks}`;

        content.innerHTML = data.map(user => `
            <div class="glass" style="margin-bottom: 2rem; padding: 1.5rem; border: 1px solid rgba(255,255,255,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;">
                    <h4 style="color: var(--primary-light);">User: ${user.username}</h4>
                    <span style="color: var(--text-dim); font-size: 0.8rem;">Email: ${user.email || 'N/A'}</span>
                </div>
                <div class="task-header">
                    <span>Priority</span>
                    <span>Title</span>
                    <span>Category</span>
                    <span>Due Date</span>
                </div>
                <ul id="task-list">
                    ${user.tasks.length > 0 ? user.tasks.map(task => `
                        <li class="task-item" style="grid-template-columns: 80px 1fr 100px 120px;">
                            <span class="priority-badge priority-${task.priority}">${task.priority}</span>
                            <span class="task-title">${task.title}</span>
                            <span class="task-category">${task.category}</span>
                            <span class="task-date">${task.date}</span>
                        </li>
                    `).join('') : '<li class="empty-state">No tasks created.</li>'}
                </ul>
            </div>
        `).join('');
        lucide.createIcons();
    } catch (err) {
        content.innerHTML = '<p class="empty-state" style="color: #ff4d4d;">Failed to connect to the server. Make sure the backend is running!</p>';
    }
});
