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
// 🌐 SERVER SETUP
// =============================
const PORT = process.env.PORT || 8100;
const IP = process.env.IP || "0.0.0.0";

let currentPairingCode = "Waiting for pairing...";
let codeRequested = false;

http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
        <html style="font-family:sans-serif;text-align:center;padding-top:50px;background:#121212;color:white;">
            <h2>NeverHide Bot Server</h2>
            <div style="font-size:40px;font-weight:bold;background:#333;padding:20px;display:inline-block;border-radius:10px;">
                ${currentPairingCode}
            </div>
            <p>Status: Online & Stable ✅</p>
        </html>
    `);
}).listen(PORT, IP, () => {
    console.log(`🌐 Server running on ${IP}:${PORT}`);
});

let sock;

async function startBot() {
    console.log("🟢 Starting Bot Engine...");
    const sessionFolder = "./bot_session";
    if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder);

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        shouldSyncHistoryMessage: () => false, // 🔥 Stops the "515" error
        syncFullHistory: false
    });

    if (!state.creds.registered && !codeRequested) {
        codeRequested = true;
        setTimeout(async () => {
            try {
                const num = config.ownerNumber.replace(/\D/g, "");
                const code = await sock.requestPairingCode(num);
                currentPairingCode = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log("✅ Pairing Code:", currentPairingCode);
            } catch (err) {
                codeRequested = false;
            }
        }, 3000);
    }

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("✅ Connected!");
            currentPairingCode = "Connected ✅";
        }
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        }
    });

    sock.ev.on("creds.update", saveCreds);

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

            // Group Metadata helper
            const groupMetadata = isGroup ? await sock.groupMetadata(from) : null;
            const participants = isGroup ? groupMetadata.participants : [];
            const admins = isGroup ? participants.filter(p => p.admin).map(p => p.id) : [];
            const isAdmin = admins.includes(sender);
            const isOwner = sender.includes(config.ownerNumber.replace(/\D/g, ""));

            // =============================
            // 📝 COMMANDS
            // =============================

            // 1. MAIN MENU
            if (command === "menu" || command === "help") {
                const menu = `
╔════ 🤖 *NEVER HIDE* ════╗
  *Prefix:* ${prefix}
  *Status:* Online
╚══════════════════════╝

✨ *GENERAL*
> ${prefix}ping - Bot Speed
> ${prefix}alive - Bot Status

👥 *GROUP MENU* (Admins Only)
> ${prefix}tagall - Mention everyone
> ${prefix}hidetag - Ghost mention
> ${prefix}kick @user - Remove member
> ${prefix}promote @user - Make admin
> ${prefix}demote @user - Remove admin
> ${prefix}group [open/close] - Lock chat

👑 *OWNER*
> ${prefix}setprefix - Change prefix
                `;
                await sock.sendMessage(from, { text: menu });
            }

            // 2. TAG ALL
            if (command === "tagall") {
                if (!isGroup) return;
                if (!isAdmin && !isOwner) return sock.sendMessage(from, { text: "❌ Admins only!" });
                let msgTag = `📣 *Attention Everyone!*\n\n${args.join(" ") || "No message"}\n\n`;
                for (let mem of participants) {
                    msgTag += `📍 @${mem.id.split('@')[0]}\n`;
                }
                await sock.sendMessage(from, { text: msgTag, mentions: participants.map(a => a.id) });
            }

            // 3. HIDETAG
            if (command === "hidetag") {
                if (!isGroup) return;
                if (!isAdmin && !isOwner) return;
                await sock.sendMessage(from, { text: args.join(" "), mentions: participants.map(a => a.id) });
            }

            // 4. KICK / PROMOTE / DEMOTE
            if (["kick", "promote", "demote"].includes(command)) {
                if (!isGroup || !isAdmin) return;
                const user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0];
                if (!user) return sock.sendMessage(from, { text: "❌ Please mention/tag a user." });
                
                if (command === "kick") await sock.groupParticipantsUpdate(from, [user], "remove");
                if (command === "promote") await sock.groupParticipantsUpdate(from, [user], "promote");
                if (command === "demote") await sock.groupParticipantsUpdate(from, [user], "demote");
                
                await sock.sendMessage(from, { text: `✅ Done with !${command}` });
            }

            // 5. GROUP SETTINGS
            if (command === "group") {
                if (!isGroup || !isAdmin) return;
                if (args[0] === 'open') {
                    await sock.groupSettingUpdate(from, 'not_announcement');
                    await sock.sendMessage(from, { text: "🔓 Group opened for everyone!" });
                } else if (args[0] === 'close') {
                    await sock.groupSettingUpdate(from, 'announcement');
                    await sock.sendMessage(from, { text: "🔒 Group closed. Admins only." });
                }
            }

            if (command === "ping") await sock.sendMessage(from, { text: "🏓 Pong!" });
            if (command === "alive") await sock.sendMessage(from, { text: "✅ Bot is alive and active." });

        } catch (err) {
            console.log("Error:", err.message);
        }
    });
}

startBot();
