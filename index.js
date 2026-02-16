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
// 🌐 SERVER & ANTI-SLEEP
// =============================
const PORT = process.env.PORT || 8100;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end("NeverHide V3 is Live!");
}).listen(PORT, "0.0.0.0");

// Keeps Render awake
setInterval(() => { http.get(`http://localhost:${PORT}`); }, 600000);

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./bot_session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        auth: state,
        printQRInTerminal: false,
        browser: ["NeverHide", "Chrome", "1.0.0"],
        shouldSyncHistoryMessage: () => false, // Faster connection
        syncFullHistory: false
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") console.log("✅ NEVERHIDE V3 CONNECTED!");
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            const prefix = config.prefix;

            if (!body.startsWith(prefix)) return;
            const args = body.slice(prefix.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const sender = msg.key.participant || msg.key.remoteJid;
            const pushName = msg.pushName || "User";

            // =============================
            // 📝 COMMAND LOGIC
            // =============================

            if (command === "menu") {
                const menu = `
╔══════════════════════════╗
║      🤖 NEVERHIDE V3      ║
╠══════════════════════════╣
║ 👋 Hello, *${pushName}*!
║ 👑 Developer: *NEVER HIDE*
╠══════════════════════════╣
║ 🛠️  MAIN TOOLS
║ ▸ *${prefix}ping* - Check speed
║ ▸ *${prefix}info* - Bot info
╠══════════════════════════╣
║ 👥 GROUP MANAGEMENT
║ ▸ *${prefix}tagall* - Mention all
║ ▸ *${prefix}hidetag [text]* - Notify all silently
║ ▸ *${prefix}kick @user* - Remove someone
║ ▸ *${prefix}promote @user* - Make admin
╠══════════════════════════╣
║ 🎮 FUN & GAMES
║ ▸ *${prefix}joke* - Random joke
║ ▸ *${prefix}fact* - Random fact
║ ▸ *${prefix}iqtest* - Check your IQ
║ ▸ *${prefix}flip* - Flip a coin
╠══════════════════════════╣
║ 🎵 MUSIC & SEARCH
║ ▸ *${prefix}song [title]* - YouTube Search
║ ▸ *${prefix}google [query]* - Search web
╠══════════════════════════╣
║ 🌐 UTILITIES
║ ▸ *${prefix}weather [city]* - Weather info
╚══════════════════════════╝`;
                await sock.sendMessage(from, { text: menu });
            }

            // --- GENERAL COMMANDS ---
            if (command === "ping") {
                const start = Date.now();
                await sock.sendMessage(from, { text: "Testing speed..." });
                const end = Date.now();
                await sock.sendMessage(from, { text: `🚀 Speed: *${end - start}ms*` });
            }

            // --- FUN COMMANDS ---
            if (command === "joke") {
                const jokes = ["Why don't scientists trust atoms? Because they make up everything!", "Parallel lines have so much in common. It’s a shame they’ll never meet."];
                await sock.sendMessage(from, { text: jokes[Math.floor(Math.random() * jokes.length)] });
            }

            if (command === "flip") {
                const result = Math.random() > 0.5 ? "HEADS" : "TAILS";
                await sock.sendMessage(from, { text: `🪙 The coin landed on: *${result}*` });
            }

            // --- GROUP COMMANDS ---
            if (command === "hidetag" && isGroup) {
                const metadata = await sock.groupMetadata(from);
                await sock.sendMessage(from, { text: args.join(" ") || "Hey everyone!", mentions: metadata.participants.map(a => a.id) });
            }

            // --- UTILITIES ---
            if (command === "song") {
                if (!args[0]) return sock.sendMessage(from, { text: "Example: !song Blinding Lights" });
                await sock.sendMessage(from, { text: `🔍 Searching for "${args.join(" ")}" on YouTube...` });
                // Note: Full download logic requires additional libraries like 'ytdl-core'
                await sock.sendMessage(from, { text: `🔗 Link: https://www.youtube.com/results?search_query=${args.join("+")}` });
            }

        } catch (err) { console.log(err); }
    });
}
startBot();
