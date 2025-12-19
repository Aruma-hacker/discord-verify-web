require("dotenv").config();

const express = require("express");

const app = express();
app.use(express.json());

// ===== 環境変数 =====
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const BOT_API = process.env.BOT_API;

// ================================
// トップ（認証ボタン）
// ================================
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Discord認証</title>

<style>
body {
  margin: 0;
  padding: 0;
  font-family: sans-serif;
  background: linear-gradient(to bottom, #330000, #660000);
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}

.card {
  background: #2b2d31;
  padding: 20px;
  border-radius: 20px;
  text-align: center;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.5);
}

.card img {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 15px;
}

.button {
  background-color: #ff4d4d;
  color: white;
  padding: 15px 25px;
  font-size: 16px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  margin-top: 15px;
  width: 100%;
}
</style>
</head>

<body>
  <div class="card">
    <img src="https://cdn.discordapp.com/embed/avatars/0.png">
    <h2>🔐 Discord認証</h2>

    <a href="https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&scope=identify%20guilds">
      <button class="button">Discordで認証</button>
    </a>
  </div>
</body>
</html>
`);
});

// ================================
// OAuth2 コールバック
// ================================
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("認証失敗");

  try {
    // ---- トークン取得 ----
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI
      })
    });

    const token = await tokenRes.json();

    // ---- ユーザー情報 ----
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    const user = await userRes.json();

    // ---- サーバー一覧 ----
    const guildRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    const guilds = await guildRes.json();
    const guildNames = guilds.map(g => g.name);

    // ================================
    // 判定ロジック
    // ================================
    let result = "success";
    let reason = null;

    if (guilds.length < 3) {
      result = "fail";
      reason = "サブアカウント疑い";
    }

    // ================================
    // BOTへ送信
    // ================================
    await fetch(BOT_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        username: user.username,
        guilds: guildNames,
        result,
        reason
      })
    });

    // ================================
    // ユーザー表示
    // ================================
    if (result === "success") {
      res.send(`
        <h2>✅ 認証成功</h2>
        <p>Discordに戻ってください</p>
      `);
    } else {
      res.send(`
        <h2>❌ 認証失敗</h2>
        <p>${reason}</p>
      `);
    }

  } catch (err) {
    console.error(err);
    res.send("エラーが発生しました");
  }
});

// ================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Web server running on port", PORT);
});
