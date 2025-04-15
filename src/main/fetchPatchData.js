const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

async function fetchAndUpdateData(db) {
    try {
        const url = "https://wildrift.leagueoflegends.com/ja-jp/news/tags/patch-notes/";

        // Webページを取得
        const { data } = await axios.get(url);

        // cheerioでHTMLを解析
        const $ = cheerio.load(data);

        // パッチノート情報を格納する配列
        const patchNotes = [];

        // 記事のリンク、タイトルを取得
        $("a[data-testid='articlefeaturedcard-component']").each((index, element) => {
            const patch_name = $(element).find("div[data-testid='card-title']").text().trim();
            const patch_link = "https://wildrift.leagueoflegends.com" + $(element).attr("href");

            patchNotes.push({
                patch_name,
                patch_link,
            });
        });

        const patchData = patchNotes.reverse();

        // チャンピオンデータの差分更新
        await updateChampionData(db);

        // パッチデータの差分更新
        await updatePatchData(db, patchData);

        // パッチ内容の差分更新
        await updatePatchContents(db, patchData);

        console.log("All data successfully fetched and updated.");
        return { success: true };
    } catch (error) {
        console.error("Data acquisition error:", error);
        return { success: false, error: error.message };
    }
}

async function updateChampionData(db) {
    const url = "https://wildrift.leagueoflegends.com/ja-jp/champions/";

    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const championElements = $('a.sc-985df63-0.cGQgsO.sc-d043b2-0.bZMlAb');
        const championNames = [];

        championElements.each((index, element) => {
            const name = $(element).find('div.sc-ce9b75fd-0.lmZfRs').text();
            if (name) {
                championNames.push(name);
            }
        });

        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run("BEGIN TRANSACTION");

                const insertStmt = db.prepare(`INSERT OR IGNORE INTO Champions (champion_name) VALUES (?)`);

                (async () => {
                    try {
                        for (const name of championNames) {
                            await new Promise((res, rej) => {
                                insertStmt.run(name, (err) => {
                                    if (err) rej(err);
                                    else res();
                                });
                            });
                        }

                        insertStmt.finalize((err) => {
                            if (err) throw err;

                            db.run("COMMIT", (err) => {
                                if (err) throw err;
                                console.log("Champion names have been inserted into the database.");
                                resolve();
                            });
                        });
                    } catch (err) {
                        console.error("Champion insert error:", err);
                        db.run("ROLLBACK", () => reject(err));
                    }
                })();
            });
        });
    } catch (error) {
        console.error("Error fetching or updating champion data:", error);
        throw error;
    }
}


async function updatePatchData(db, patchData) {
    try {
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run("BEGIN TRANSACTION");

                const insertStmt = db.prepare(`
                    INSERT OR IGNORE INTO Patches (patch_name, patch_link) VALUES (?, ?)
                `);

                (async () => {
                    try {
                        for (const patch of patchData) {
                            await new Promise((res, rej) => {
                                insertStmt.run(patch.patch_name, patch.patch_link, (err) => {
                                    if (err) rej(err);
                                    else res();
                                });
                            });
                        }

                        insertStmt.finalize((err) => {
                            if (err) throw err;

                            db.run("COMMIT", async (err) => {
                                if (err) throw err;

                                // JSONファイルに書き出し
                                db.all("SELECT * FROM Patches", (err, rows) => {
                                    if (err) return reject(err);

                                    const filePath = path.join(__dirname, "patch_notes.json");
                                    fs.writeFileSync(filePath, JSON.stringify(rows, null, 4), "utf-8");
                                    console.log(`Database content saved to ${filePath}`);

                                    resolve();
                                });
                            });
                        });
                    } catch (err) {
                        console.error("Patch data insert error:", err);
                        db.run("ROLLBACK", () => reject(err));
                    }
                })();
            });
        });
    } catch (error) {
        console.error("Error in updatePatchData:", error);
        throw error;
    }
}


async function updatePatchContents(db, patchData) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");

            const insertStmt = db.prepare(`
                INSERT OR IGNORE INTO Champion_Changes 
                (champion_name, patch_name, ability_title, change_details) 
                VALUES (?, ?, ?, ?)
            `);

            const processPatch = async (patch) => {
                const patchName = patch.patch_name;
                const patchLink = patch.patch_link;

                try {
                    const response = await axios.get(patchLink);
                    const $ = cheerio.load(response.data);

                    const changes = [];
                    $(".character-changes-container").each((i, elem) => {
                        const championName = $(elem).find(".character-name").text().trim();

                        $(elem).find(".character-change").each((j, change) => {
                            const abilityTitle = $(change).find(".character-ability-title").text().trim();
                            const changeDetails = $(change).find(".character-change-body").text().trim();

                            changes.push({ championName, abilityTitle, changeDetails });
                        });
                    });

                    for (const change of changes) {
                        await new Promise((res, rej) => {
                            insertStmt.run(
                                change.championName,
                                patchName,
                                change.abilityTitle,
                                change.changeDetails,
                                (err) => {
                                    if (err) rej(err);
                                    else res();
                                }
                            );
                        });
                    }
                } catch (err) {
                    throw err;
                }
            };

            (async () => {
                try {
                    for (const patch of patchData) {
                        await processPatch(patch);
                    }

                    insertStmt.finalize((err) => {
                        if (err) throw err;

                        db.run("COMMIT", (err) => {
                            if (err) throw err;
                            console.log("Patch content data updated successfully.");
                            resolve();
                        });
                    });
                } catch (err) {
                    console.error("Error during patch content update:", err);
                    db.run("ROLLBACK", () => reject(err)); 
                }
            })();
        });
    });
}


module.exports = fetchAndUpdateData;