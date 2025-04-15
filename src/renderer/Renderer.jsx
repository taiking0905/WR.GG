import React, { useState } from "react";

const Renderer = () => {
    const [status, setStatus] = useState("");

    const fetchData = async () => {
        try {
            const result = await window.electron.invoke("fetchPatchData");
            console.log("fetchPatchData の結果:", result);

            if (result.success) {
                setStatus("保存できました！");
            } else {
                setStatus("エラー: " + result.error);
            }
        } catch (error) {
            console.error("エラーが発生しました:", error);
            setStatus("エラー: " + error.message);
        }
    };

    return (
        <div>
            <h1>パッチデータ取得</h1>
            <button onClick={fetchData}>データ取得</button>
            <p>{status}</p>
        </div>
    );
};

export default Renderer;