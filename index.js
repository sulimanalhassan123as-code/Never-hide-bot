const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const fs = require("fs");
const http = require("http");
const config = require("./config");

// =============================
// 🌐 SERVER SETUP (Alwaysdata)
// =============================

const PORT = process.env.PORT || 8100;
const IP = process.env.IP || "0.0.0.0";

let currentPairingCode = "Waiting for pairing...";
let codeRequested = false;

http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
        <html style="font-family:sans-serif;text-align:center;padding-top:50px;">
            <h2>NeverHide Bot Server</h2>
            <div style="font-size:40px;font-weight:bold;background:#eee;padding:20px;display:inline-block;">
                ${currentPairingCode}
            </div>
            <p>Status: Persistent Storage Active ✅</p>
        </html>
    `);
}).listen(PORT, IP, () => {
    console.log(`🌐 Server running on ${IP}:${PORT}`);
});

// =============================
// 🤖 BOT ENGINE
// =============================

let sock;

async function startBot() {
    console.log("🟢 Starting Bot Engine...");

    const sessionFolder = "./bot_session";
    if (!fs.existsSync(sessionFolder)) {
        fs.mkdirSync(sessionFolder);
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: true
    });

    // =============================
    // 🔐 PAIRING CODE (ONLY ONCE)
    // =============================

    if (!state.creds.registered && !codeRequested) {
        codeRequested = true;

        setTimeout(async () => {
            try {
                const num = config.ownerNumber.replace(/\D/g, "");
                const code = await sock.requestPairingCode(num);
                currentPairingCode = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log("✅ Pairing Code:", currentPairingCode);
            } catch (err) {
                console.log("❌ Pairing error:", err.message);
                codeRequested = false;
            }
        }, 3000);
    }

    // =============================
    // 🔄 CONNECTION HANDLER
    // =============================

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "open") {
            console.log("✅ Connected to WhatsApp!");
            currentPairingCode = "Connected ✅";
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;

            console.log("⚠️ Connection closed. Reason:", reason);

            if (reason === DisconnectReason.loggedOut) {
                console.log("⛔ Logged out. Delete bot_session folder to re-pair.");
                return;
            }

            console.log("🔄 Reconnecting in 5 seconds...");
            setTimeout(() => {
                if (sock) sock.end();
                startBot();
            }, 5000);
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // =============================
    // 💬 BASIC COMMAND SYSTEM
    // =============================

    sock.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const body =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                "";

            if (!body.startsWith(config.prefix)) return;

            const command = body.slice(1).trim().toLowerCase();

            if (command === "menu") {
                await sock.sendMessage(from, {
                    text: `
╔═══ 🤖 NEVER HIDE BOT ═══╗
║ Developer: NEVER HIDE
╚══════════════════════╝

✨ Commands:
!menu  - Show menu
!ping  - Test speed
!alive - Check status
                    `
                });
            }

            if (command === "ping") {
                await sock.sendMessage(from, { text: "🏓 Pong!" });
            }

            if (command === "alive") {
                await sock.sendMessage(from, { text: "✅ Bot is alive and stable." });
            }

        } catch (err) {
            console.log("Message Error:", err.message);
        }
    });
}

startBot();
