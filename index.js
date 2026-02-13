const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const http = require('http');
const config = require('./config');

// 🌐 1. RENDER REQUIRED WEB SERVER 🌐
// Render will shut down the bot if it doesn't detect a server on this port.
const PORT = process.env.PORT || 3000;
let currentPairingCode = "Waiting for code...";
let botStatus = "Booting up...";

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
        <html style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h2>Status: ${botStatus}</h2>
            <h3>Your Pairing Code:</h3>
            <div style="font-size: 40px; font-weight: bold; background: #eee; padding: 20px; display: inline-block;">
                ${currentPairingCode}
            </div>
            <p>Refresh this page to update the code.</p>
        </html>
    `);
});
server.listen(PORT, () => console.log(`🌐 Render Health Server running on port ${PORT}`));

// 🤖 2. THE BOT ENGINE 🤖
async function startBot() {
    botStatus = "Starting Bot Engine...";
    console.log(`🟢 STARTING: ${config.botName}...`);

    // Clean broken sessions
    if (fs.existsSync('auth_info') && !fs.existsSync('auth_info/creds.json')) {
        fs.rmSync('auth_info', { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: true
    });

    // Generate Pairing Code
    if (!sock.authState.creds.me && !sock.authState.creds.registered) {
        botStatus = "Generating Pairing Code...";
        setTimeout(async () => {
            try {
                const num = config.ownerNumber.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(num);
                const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
                
                currentPairingCode = formattedCode;
                botStatus = "Waiting for you to enter code in WhatsApp...";
                
                console.log(`\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`);
                console.log(`💬 YOUR PAIRING CODE: ${formattedCode}`);
                console.log(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n`);
            } catch (err) {
                console.log("⚠️ Error generating code. Check config.js number!");
            }
        }, 3000);
    }

    // Connection Monitor
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = (lastDisconnect?.error)?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconnecting...");
                botStatus = "Reconnecting...";
                startBot();
            } else {
                console.log("⛔ Logged out. Delete 'auth_info' to restart.");
                botStatus = "Logged Out.";
            }
        } else if (connection === 'open') {
            console.log(`✅ BOT IS ONLINE!`);
            currentPairingCode = "Connected! ✅";
            botStatus = "Online and Ready!";
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Simple Command Listener
    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const type = Object.keys(msg.message)[0];
            const body = (type === 'conversation') ? msg.message.conversation :
                         (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : '';

            if (body.toLowerCase() === `${config.prefix}ping`) {
                await sock.sendMessage(from, { text: 'Pong! 🏓 Bot is alive on Render.' });
            }
        } catch (err) {
            console.log(err);
        }
    });
}

startBot();
