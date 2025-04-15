const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

function seedChampionData(db) {
    const url = "https://wildrift.leagueoflegends.com/ja-jp/champions/";
    const errors = []; // エラーを収集する配列

    return new Promise((resolve, reject) => {
        axios.get(url)
            .then(response => {
                const $ = cheerio.load(response.data);

                // チャンピオン名を抽出
                const championElements = $('a.sc-985df63-0.cGQgsO.sc-d043b2-0.bZMlAb');
                const championNames = [];
                championElements.each((index, element) => {
                    const name = $(element).find('div.sc-ce9b75fd-0.lmZfRs').text();
                    if (name) {
                        championNames.push(name);
                    }
                });

                // データベースに挿入
                db.serialize(() => {
                    const insertStmt = db.prepare(`INSERT OR IGNORE INTO Champions (champion_name) VALUES (?)`);
                    championNames.forEach(name => {
                        insertStmt.run(name, (err) => {
                            if (err) {
                                console.error("Database Insert Error:", err);
                                errors.push(err); // エラーを収集
                            }
                        });
                    });
                    insertStmt.finalize((err) => {
                        if (err) {
                            console.error("Finalize Error:", err);
                            errors.push(err); // エラーを収集
                        } else {
                            console.log("Champion names have been inserted.");
                        }

                        if (errors.length > 0) {
                            reject(errors); // エラーがあれば reject
                        } else {
                            resolve(); // 成功時に resolve
                        }
                    });
                });
            })
            .catch(error => {
                console.error("Error fetching the website:", error);
                reject(error); // HTTP リクエストのエラーを reject
            });
    });
}

function seedPatchData(db) {
    const patchData = require('./patch_notes.json'); // JSON ファイルを読み込む
    const errors = []; // エラーを収集する配列

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            const insertStmt = db.prepare(`INSERT OR IGNORE INTO Patches (patch_name, patch_link) VALUES (?, ?)`);

            // JSON データをループして挿入
            patchData.forEach(patch => {
                insertStmt.run(patch.patch_name, patch.patch_link, (err) => {
                    if (err) {
                        console.error("Error inserting patch data:", err);
                        errors.push(err); // エラーを収集
                    }
                });
            });

            insertStmt.finalize((err) => {
                if (err) {
                    console.error("Error finalizing statement:", err);
                    errors.push(err); // エラーを収集
                } else {
                    console.log("Patch data inserted successfully from patch_note.json.");
                }

                if (errors.length > 0) {
                    reject(errors); // エラーがあれば reject
                } else {
                    resolve(); // 成功時に resolve
                }
            });
        });
    });
}

async function seedChampionChangesData(db) {
    const patchData = require('./patch_notes.json'); 
    const errors = []; // エラーを収集する配列

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            const insertStmt = db.prepare(`
                INSERT OR IGNORE INTO Champion_Changes 
                (champion_name, patch_name, ability_title, change_details) 
                VALUES (?, ?, ?, ?)
            `);

            db.run("BEGIN TRANSACTION"); // トランザクションの開始

            patchData.forEach(async (patch) => {
                const patchName = patch.patch_name; 
                const patchLink = patch.patch_link; 

                try {
                    const response = await axios.get(patchLink);
                    const $ = cheerio.load(response.data);

                    $(".character-changes-container").each((i, elem) => {
                        const championName = $(elem).find(".character-name").text().trim();
                        let changes = [];

                        $(elem)
                            .find(".character-change")
                            .each((j, change) => {
                                const abilityTitle = $(change).find(".character-ability-title").text().trim();
                                const changeDetails = $(change).find(".character-change-body").text().trim();
                                changes.push({ ability_title: abilityTitle, change_details: changeDetails });
                            });

                        changes.forEach(change => {
                            const abilityTitle = change.ability_title;
                            const changeDetails = change.change_details;

                            insertStmt.run(championName, patchName, abilityTitle, changeDetails, (err) => {
                                if (err) {
                                    console.error("Error inserting data:", err);
                                    errors.push(err); // エラーを収集
                                }
                            });
                        });
                    });
                } catch (error) {
                    console.error(`Error fetching data for patch ${patchName}:`, error);
                    errors.push(error); // エラーを収集
                }
            });

            db.run("COMMIT", (err) => {
                if (err) {
                    console.error("Error committing transaction:", err);
                    errors.push(err); // エラーを収集
                    db.run("ROLLBACK", () => {
                        console.error("Transaction rolled back due to commit error.");
                    });
                } else {
                    console.log("Champion changes data inserted successfully.");
                }

                insertStmt.finalize();

                if (errors.length > 0) {
                    reject(errors); // エラーがあれば reject
                } else {
                    resolve(); // 成功時に resolve
                }
            });
        });
    });
}

module.exports = { seedChampionData, seedPatchData, seedChampionChangesData };



