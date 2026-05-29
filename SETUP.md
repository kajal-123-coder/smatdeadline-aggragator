# SmartDeadline Backend Server
## Setup Guide (Step-by-Step)

---

## ✅ Step 1 — Install Node.js
Download from https://nodejs.org (LTS version)

---

## ✅ Step 2 — Install Dependencies
```bash
cd smart-deadline-server
npm install
```

---

## ✅ Step 3 — Get Free Resend API Key (Email Service)

1. Go to **https://resend.com** → Sign up (free)
2. Free tier gives you **3,000 emails/month** (enough for ~33 users getting 3 daily reminders)
3. Go to **API Keys** → Create new key → Copy it
4. For testing WITHOUT a domain: use `onboarding@resend.dev` as FROM_EMAIL
   - ⚠️ This only sends to your own verified email address
5. For production: verify your domain in Resend dashboard

---

## ✅ Step 4 — Configure Environment
```bash
# Create .env file
cp .env.example .env
```

Edit `.env`:
```
JWT_SECRET=any_random_string_here_make_it_long
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx   ← paste your key here
FROM_EMAIL=SmartDeadline <onboarding@resend.dev>
```

---

## ✅ Step 5 — Start the Server
```bash
npm start
```

You should see:
```
✅ SQLite Connected
🚀 SmartDeadline Server Running on http://localhost:5000
📧 Email reminders: 8:00 AM | 2:00 PM | 8:00 PM (IST)
```

---

## ✅ Step 6 — Open the Frontend
Open `index.html` in your browser (or use Live Server in VS Code)

Register with a real email address → tasks will get reminders!

---

## 📧 Email Schedule (IST Timezone)

| Time | Slot |
|------|------|
| 8:00 AM | Morning Reminder |
| 2:00 PM | Afternoon Reminder |
| 8:00 PM | Evening Reminder |

---

## 🧪 Test Email Immediately (Without Waiting)

```bash
curl -X POST http://localhost:5000/api/admin/send-reminders-now
```

Or open in browser: `http://localhost:5000/api/admin/send-reminders-now` (POST request)

---

## 📁 File Structure
```
smart-deadline-server/
├── server.js          ← Main server (all logic)
├── package.json       
├── .env               ← Your secrets (don't commit this!)
├── .env.example       ← Template
└── database.sqlite    ← Auto-created on first run
```

---

## ❓ How Emails Work

1. User registers with their email on the frontend
2. Server stores it in SQLite database  
3. Cron job fires 3x daily → fetches all users with emails
4. Sends each user their personal task list with:
   - 🚨 Tasks due today (highlighted alert)
   - 📋 Upcoming tasks table
   - ⏰ Overdue tasks warning
   - 📊 Stats summary

---

## ⚠️ Important Notes

- Users who register **without an email** will NOT get reminders (they'll be skipped)
- The email field is optional in registration — encourage users to add it
- Timezone is set to `Asia/Kolkata` (IST) — change in server.js if needed
