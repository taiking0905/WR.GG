const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const { seedChampionData, seedPatchData, seedChampionChangesData } = require('./seedData');

async function initializeDatabase() {
    return new Promise(async (resolve, reject) => {
        const dbPath = './database.sqlite';
        const dbExists = fs.existsSync(dbPath);

// データベース接続
        let db = new sqlite3.Database(dbPath, async (err) => {
            if (err) {
                console.error(err.message);
                reject(err);
            }
            console.log('Connected to the SQLite database.');
        });

        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS Champions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                champion_name TEXT UNIQUE NOT NULL,
                new_flag boolean DEFAULT 1
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS Patches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patch_name TEXT UNIQUE NOT NULL,
                patch_link TEXT NOT NULL,
                new_flag boolean DEFAULT 1
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS Champion_Changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                champion_name TEXT NOT NULL,
                patch_name TEXT NOT NULL,
                ability_title TEXT NOT NULL,
                change_details TEXT NOT NULL,
                FOREIGN KEY (champion_name) REFERENCES Champions(champion_name),
                FOREIGN KEY (patch_name) REFERENCES Patches(patch_name),
                UNIQUE(champion_name, patch_name, ability_title, change_details) 
            )`);
        });

// 初期データの挿入（await によって順序制御）
        try {
            if (!dbExists) {
                console.log("Database does not exist. Inserting initial data...");
                await seedChampionData(db);
                await seedPatchData(db);
                await seedChampionChangesData(db);
                console.log("Initial data inserted successfully.");
            } else {
                console.log("Database already exists. Skipping initial data insertion.");
            }

            resolve(db); // 成功時にデータベースを返す
        } catch (errors) {
            console.error("Error during initial data insertion:", errors);
            reject(errors); // 収集したエラーをまとめて返す
        }
    });
}

module.exports = { initializeDatabase };
