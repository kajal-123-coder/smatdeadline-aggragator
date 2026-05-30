const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'smartdeadline_secret_key_change_this';

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── SQLite Database Setup ─────────────────────────────────────────────────────
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('❌ DB Error:', err.message);
    else console.log('✅ SQLite Connected');
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        category TEXT DEFAULT 'Other',
        date TEXT NOT NULL,
        priority TEXT DEFAULT 'Low',
        completed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
});

// ─── Auth Middleware ───────────────────────────────────────────────────────────
function authenticate(req, res, next) {
    const header = req.headers['authorization'];
    const token = header && header.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access Denied' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(403).json({ error: 'Invalid Token' });
    }
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
    const { username, password, email } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    db.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
        if (row) return res.status(409).json({ error: 'Username already exists' });
        const hashed = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email || null, hashed],
            function (err) {
                if (err) return res.status(500).json({ error: 'Registration failed' });
                res.status(201).json({ message: 'User registered successfully' });
            });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, username: user.username });
    });
});

// ─── Task Routes ──────────────────────────────────────────────────────────────
app.get('/api/tasks', authenticate, (req, res) => {
    db.all('SELECT * FROM tasks WHERE user_id = ? ORDER BY date ASC', [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch tasks' });
        res.json(rows);
    });
});

app.post('/api/tasks', authenticate, (req, res) => {
    const { title, category, date, priority } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'Title and date required' });
    db.run('INSERT INTO tasks (user_id, title, category, date, priority) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, title, category || 'Other', date, priority || 'Low'],
        function (err) {
            if (err) return res.status(500).json({ error: 'Failed to add task' });
            res.status(201).json({ id: this.lastID, title, category, date, priority });
        });
});

app.delete('/api/tasks/:id', authenticate, (req, res) => {
    db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function (err) {
        if (err) return res.status(500).json({ error: 'Failed to delete task' });
        res.json({ message: 'Task deleted' });
    });
});

// ─── Admin Route ──────────────────────────────────────────────────────────────
app.get('/api/admin/all-data', (req, res) => {
    db.all('SELECT id, username, email FROM users', [], (err, users) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch users' });
        if (!users.length) return res.json([]);
        db.all('SELECT * FROM tasks', [], (err, tasks) => {
            if (err) return res.status(500).json({ error: 'Failed to fetch tasks' });
            const result = users.map(u => ({
                ...u,
                tasks: tasks.filter(t => t.user_id === u.id)
            }));
            res.json(result);
        });
    });
});

// ─── Brevo API Email Function ──────────────────────────────────────────────────
async function sendBrevoEmail(toEmail, subject, htmlBody) {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': process.env.BREVO_API_KEY
        },
        body: JSON.stringify({
            sender: { email: process.env.SMTP_USER, name: 'SmartDeadline' },
            to: [{ email: toEmail }],
            subject: subject,
            htmlContent: htmlBody
        })
    });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
    }
    return response.json();
}

// ─── Email Reminder Function ───────────────────────────────────────────────────
async function sendEmailReminders() {
    console.log('📧 Running email reminder job...');

    db.all('SELECT id, username, email FROM users WHERE email IS NOT NULL AND email != ""', [], (err, users) => {
        if (err || !users.length) {
            console.log('No users with email found');
            return;
        }

        users.forEach(user => {
            db.all('SELECT * FROM tasks WHERE user_id = ? AND completed = 0 ORDER BY date ASC', [user.id], async (err, tasks) => {
                if (err || !tasks.length) return;

                const today = new Date().toISOString().split('T')[0];
                const todayTasks = tasks.filter(t => t.date === today);
                const overdueTasks = tasks.filter(t => t.date < today);
                const upcomingTasks = tasks.filter(t => t.date > today);

                const priorityColor = { High: '#ef4444', Medium: '#f97316', Low: '#22c55e' };

                const taskRows = (list) => list.map(t => `
                    <tr>
                        <td style="padding:8px 12px; border-bottom:1px solid #1f2937;">
                            <span style="background:${priorityColor[t.priority] || '#6b7280'}; color:white; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:700;">${t.priority}</span>
                        </td>
                        <td style="padding:8px 12px; border-bottom:1px solid #1f2937; color:#f3f4f6;">${t.title}</td>
                        <td style="padding:8px 12px; border-bottom:1px solid #1f2937; color:#9ca3af;">${t.category}</td>
                        <td style="padding:8px 12px; border-bottom:1px solid #1f2937; color:#a78bfa;">${t.date}</td>
                    </tr>
                `).join('');

                const htmlBody = `
                <!DOCTYPE html>
                <html>
                <head><meta charset="UTF-8"></head>
                <body style="margin:0; padding:0; background:#07090f; font-family:'Inter',sans-serif;">
                    <div style="max-width:620px; margin:30px auto; background:#0d1117; border-radius:20px; overflow:hidden; border:1px solid #1f2937;">
                        <div style="background:linear-gradient(135deg,#8a2be2,#a855f7); padding:32px; text-align:center;">
                            <h1 style="margin:0; color:white; font-size:24px; font-weight:800;">⚡ SmartDeadline</h1>
                            <p style="margin:8px 0 0; color:rgba(255,255,255,0.8); font-size:14px;">Daily Task Intelligence Report</p>
                        </div>
                        <div style="padding:28px 32px 0;">
                            <p style="color:#f3f4f6; font-size:16px; margin:0;">Hey <strong style="color:#a855f7;">${user.username}</strong> 👋</p>
                            <p style="color:#9ca3af; font-size:14px; margin:8px 0 0;">Here's your operational status for today.</p>
                        </div>
                        <div style="display:flex; gap:12px; padding:20px 32px; flex-wrap:wrap;">
                            <div style="flex:1; min-width:100px; background:#1a1a2e; border-radius:12px; padding:14px; text-align:center; border:1px solid #2d2d44;">
                                <div style="font-size:28px; font-weight:800; color:#ef4444;">${todayTasks.length}</div>
                                <div style="font-size:11px; color:#9ca3af; margin-top:4px;">DUE TODAY</div>
                            </div>
                            <div style="flex:1; min-width:100px; background:#1a1a2e; border-radius:12px; padding:14px; text-align:center; border:1px solid #2d2d44;">
                                <div style="font-size:28px; font-weight:800; color:#f97316;">${overdueTasks.length}</div>
                                <div style="font-size:11px; color:#9ca3af; margin-top:4px;">OVERDUE</div>
                            </div>
                            <div style="flex:1; min-width:100px; background:#1a1a2e; border-radius:12px; padding:14px; text-align:center; border:1px solid #2d2d44;">
                                <div style="font-size:28px; font-weight:800; color:#a855f7;">${upcomingTasks.length}</div>
                                <div style="font-size:11px; color:#9ca3af; margin-top:4px;">UPCOMING</div>
                            </div>
                        </div>
                        ${todayTasks.length > 0 ? `
                        <div style="margin:0 32px; background:#1c0a0a; border:1px solid #ef4444; border-radius:12px; padding:16px 20px;">
                            <p style="margin:0 0 10px; color:#ef4444; font-weight:700; font-size:13px;">🚨 DUE TODAY</p>
                            <table style="width:100%; border-collapse:collapse;">${taskRows(todayTasks)}</table>
                        </div>` : ''}
                        ${overdueTasks.length > 0 ? `
                        <div style="margin:16px 32px 0; background:#1a0e00; border:1px solid #f97316; border-radius:12px; padding:16px 20px;">
                            <p style="margin:0 0 10px; color:#f97316; font-weight:700; font-size:13px;">⚠️ OVERDUE</p>
                            <table style="width:100%; border-collapse:collapse;">${taskRows(overdueTasks)}</table>
                        </div>` : ''}
                        ${upcomingTasks.length > 0 ? `
                        <div style="margin:16px 32px 0; padding:16px 20px;">
                            <p style="margin:0 0 10px; color:#9ca3af; font-weight:700; font-size:13px;">📋 UPCOMING TASKS</p>
                            <table style="width:100%; border-collapse:collapse; background:#111827; border-radius:12px; overflow:hidden;">
                                <tr style="background:#1f2937;">
                                    <th style="padding:10px 12px; text-align:left; color:#6b7280; font-size:11px;">Priority</th>
                                    <th style="padding:10px 12px; text-align:left; color:#6b7280; font-size:11px;">Task</th>
                                    <th style="padding:10px 12px; text-align:left; color:#6b7280; font-size:11px;">Sector</th>
                                    <th style="padding:10px 12px; text-align:left; color:#6b7280; font-size:11px;">Deadline</th>
                                </tr>
                                ${taskRows(upcomingTasks)}
                            </table>
                        </div>` : ''}
                        <div style="margin:24px 32px 32px; text-align:center; padding-top:20px; border-top:1px solid #1f2937;">
                            <p style="color:#4b5563; font-size:12px; margin:0;">SmartDeadline — Task Intelligence Platform</p>
                        </div>
                    </div>
                </body>
                </html>`;

                try {
                    await sendBrevoEmail(
                        user.email,
                        `⚡ SmartDeadline: ${todayTasks.length > 0 ? `🚨 ${todayTasks.length} task(s) due TODAY` : `${tasks.length} active objective(s)`}`,
                        htmlBody
                    );
                    console.log(`✅ Email sent to ${user.email}`);
                } catch (e) {
                    console.error(`❌ Email failed for ${user.email}:`, e.message);
                }
            });
        });
    });
}

// ─── Cron Schedule ─────────────────────────────────────────────────────────────
cron.schedule('30 2 * * *', sendEmailReminders, { timezone: 'Asia/Kolkata' });
cron.schedule('30 8 * * *', sendEmailReminders, { timezone: 'Asia/Kolkata' });
cron.schedule('30 14 * * *', sendEmailReminders, { timezone: 'Asia/Kolkata' });

// ─── Manual Trigger ────────────────────────────────────────────────────────────
app.post('/api/admin/send-reminders-now', async (req, res) => {
    sendEmailReminders();
    res.json({ message: '📧 Email reminders triggered manually!' });
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({ message: '✅ SmartDeadline Server Running!' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📧 Email reminders scheduled: 8:00 AM | 2:00 PM | 8:00 PM (IST)`);
});
