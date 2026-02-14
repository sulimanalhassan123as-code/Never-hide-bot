const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason 
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const fs = require('fs');
const http = require('http');
const config = require('./config');


// ================================
// 🌐 RENDER WEB SERVER
// ================================
const PORT = process.env.PORT || 3000;
let currentPairingCode = "Waiting for code...";

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
        <html style="font-family:sans-serif;text-align:center;padding-top:50px;">
            <h2>WhatsApp Bot Server</h2>
            <div style="font-size:40px;font-weight:bold;background:#eee;padding:20px;display:inline-block;">
                ${currentPairingCode}
            </div>
            <p>Refresh page to see latest status.</p>
        </html>
    `);
});

server.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});


// ================================
// 🤖 BOT START FUNCTION
// ================================
async function startBot() {

    console.log(`🟢 Starting Bot: ${config.botName}`);

    const sessionFolder = './bot_session';

    // Only create if not exists (DO NOT DELETE SESSION)
    if (!fs.existsSync(sessionFolder)) {
        fs.mkdirSync(sessionFolder);
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: true
    });


    // ================================
    // 🔑 PAIRING CODE
    // ================================
    if (!state.creds.registered) {
        setTimeout(async () => {
            try {
                const phoneNumber = config.ownerNumber.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(phoneNumber);

                currentPairingCode = code?.match(/.{1,4}/g)?.join("-") || code;

                console.log("\n==============================");
                console.log("📲 PAIRING CODE:");
                console.log(currentPairingCode);
                console.log("==============================\n");

            } catch (err) {
                console.log("❌ Error generating pairing code:", err.message);
            }
        }, 4000);
    }


    // ================================
    // 🔌 CONNECTION EVENTS
    // ================================
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;

            console.log("⚠️ Connection closed. Reason:", reason);

            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconnecting...");
                startBot();
            } else {
                console.log("❌ Logged out from WhatsApp.");
            }

        } else if (connection === 'open') {
            console.log("✅ BOT CONNECTED SUCCESSFULLY!");
            currentPairingCode = "Connected ✅";
        }
    });

    sock.ev.on('creds.update', saveCreds);


    // ================================
    // 📩 MESSAGE HANDLER
    // ================================
    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');

            const type = Object.keys(msg.message)[0];
            const body =
                type === 'conversation'
                    ? msg.message.conversation
                    : type === 'extendedTextMessage'
                    ? msg.message.extendedTextMessage.text
                    : '';

            const senderName = msg.pushName || "User";

            if (!body.startsWith(config.prefix)) return;

            const args = body.slice(config.prefix.length).trim().split(' ');
            const command = args.shift().toLowerCase();
            const textArg = args.join(" ");

            switch (command) {

                case 'ping':
                    await sock.sendMessage(from, { text: "🏓 Pong! Bot is alive." });
                    break;

                case 'menu':
                    await sock.sendMessage(from, {
                        text: `
🤖 *${config.botName}*

👋 Hello ${senderName}

*Commands*
${config.prefix}ping
${config.prefix}info
${config.prefix}joke
${config.prefix}fact
${config.prefix}flip
${config.prefix}roll
                        `
                    });
                    break;

                case 'info':
                    await sock.sendMessage(from, {
                        text: `
Bot Name: ${config.botName}
Owner: ${config.ownerName}
Status: Online 🟢
                        `
                    });
                    break;

                case 'joke':
                    const jokes = [
                        "Why do programmers prefer dark mode? Because light attracts bugs 😂",
                        "I invented a word! Plagiarism 🤣"
                    ];
                    await sock.sendMessage(from, {
                        text: jokes[Math.floor(Math.random() * jokes.length)]
                    });
                    break;

                case 'fact':
                    const facts = [
                        "Water covers 71% of Earth 🌍",
                        "Venus day is longer than its year 🪐"
                    ];
                    await sock.sendMessage(from, {
                        text: facts[Math.floor(Math.random() * facts.length)]
                    });
                    break;

                case 'flip':
                    await sock.sendMessage(from, {
                        text: Math.random() < 0.5 ? "🪙 Heads!" : "🪙 Tails!"
                    });
                    break;

                case 'roll':
                    await sock.sendMessage(from, {
                        text: `🎲 You rolled: ${Math.floor(Math.random() * 6) + 1}`
                    });
                    break;

                default:
                    await sock.sendMessage(from, { text: "❌ Unknown command." });
            }

        } catch (err) {
            console.log("Message error:", err.message);
        }
    });
}

startBot();
