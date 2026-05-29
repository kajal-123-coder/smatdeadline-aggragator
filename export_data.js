const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Path to the SQLite database
const dbPath = path.resolve(__dirname, 'server', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log("📊 Starting Data Export...");

db.serialize(() => {
    // 1. Fetch all users
    db.all("SELECT id, username, email FROM users", [], (err, users) => {
        if (err) {
            console.error("❌ Error fetching users:", err.message);
            return;
        }
        
        // 2. Fetch all tasks
        db.all("SELECT * FROM tasks", [], (err, tasks) => {
            if (err) {
                console.error("❌ Error fetching tasks:", err.message);
                return;
            }
            
            // 3. Combine data: Nest tasks within each user object
            const fullSnapshot = users.map(user => ({
                id: user.id,
                username: user.username,
                email: user.email,
                tasks: tasks.filter(task => task.user_id === user.id)
            }));

            // 4. Save to JSON file in the main folder
            const outputPath = path.resolve(__dirname, 'user_data_snapshot.json');
            fs.writeFileSync(outputPath, JSON.stringify(fullSnapshot, null, 4));
            
            console.log("\n✅ Data Successfully Exported!");
            console.log(`📂 File Location: ${outputPath}`);
            console.log(`👤 Total Users Found: ${users.length}`);
            console.log(`📝 Total Tasks Found: ${tasks.length}`);
            
            db.close();
        });
    });
});
