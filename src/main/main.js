const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { initializeDatabase } = require("./database");
const fetchPatchData = require("./fetchPatchData");
const updateDatabase = require("./updateDatabase");
let mainWindow;
let db;

app.whenReady().then(async () => {
    try {
        db = await initializeDatabase(); // データベースの初期化が完了するまで待機
        console.log("Database initialized successfully.");

        await updateDatabase(db); // データベースの更新
        console.log("Database updated successfully.");

        mainWindow = new BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: {
                preload: path.join(__dirname, "../preload/preload.js"),
                contextIsolation: true,
                enableRemoteModule: false,
            },
        });

        mainWindow.loadURL("http://localhost:3000");
    } catch (error) {
        console.error("Error during app initialization:", error);
    }
});

// fetchPatchData を処理する IPC ハンドラーを設定
ipcMain.handle("fetchPatchData", async () => {
    try {
        const result = await fetchPatchData(db); // データベース接続を渡す
        console.log("fetchPatchData result:", result);
        return result;
    } catch (error) {
        console.error("fetchPatchData のエラー:", error);
        return { success: false, error: error.message };
    }
});

// アプリケーション終了時にデータベース接続を閉じる
app.on("window-all-closed", () => {
    if (db) {
        db.close((err) => {
            if (err) {
                console.error("Error closing database:", err);
            } else {
                console.log("Database connection closed.");
            }
        });
    }

    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("web-contents-created", (event, contents) => {
    contents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                "Content-Security-Policy": [
                    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
                ],
            },
        });
    });
});
