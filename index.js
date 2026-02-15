const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const http = require('http');
const config = require('./config');

// --- 🌐 ALWAYSDATA SERVER SETUP ---
// Alwaysdata requires specific IP binding
const PORT = process.env.PORT || 8100;
const IP = process.env.IP || '0.0.0.0'; 

let currentPairingCode = "Waiting for code...";
let codeRequested = false; 

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
        <html style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h2>Alwaysdata Bot Server</h2>
            <div style="font-size: 40px; font-weight: bold; background: #eee; padding: 20px; display: inline-block;">
                ${currentPairingCode}
            </div>
            <p>Status: Running on Persistent Storage ✅</p>
        </html>
    `);
});

// IMPORTANT: Bind to the specific IP Alwaysdata provides
server.listen(PORT, IP, () => console.log(`🌐 Server running on ${IP}:${PORT}`));

let currentBotName = config.botName; 

async function startBot() {
    console.log(`🟢 STARTING ENGINE...`);
    
    const sessionFolder = 'bot_session';
    if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder);

    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true, // Enabled QR just in case we need it later
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        markOnlineOnConnect: true
    });

    if (!sock.authState.creds.registered && !codeRequested) {
        codeRequested = true; 
        setTimeout(async () => {
            try {
                const num = config.ownerNumber.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(num);
                currentPairingCode = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n✅ PAIRING CODE: ${currentPairingCode}\n`);
            } catch (err) {
                console.log("⚠️ Error generating code", err);
                codeRequested = false; 
            }
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = (lastDisconnect?.error)?.output?.statusCode;
            console.log(`⚠️ Connection Closed: ${reason}`);
            
            // On Alwaysdata, we DO NOT wipe memory on 401/515 immediately
            // We want to preserve the session if possible.
            // Only wipe if you are manually resetting.
            if (reason === 401) {
                console.log("Session invalid. Delete bot_session folder to re-pair.");
            }
            setTimeout(startBot, 5000);
        } else if (connection === 'open') {
            console.log(`✅ BOT CONNECTED!`);
            currentPairingCode = "Connected! ✅";
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message) return;
            // ... (Rest of your command logic goes here) ...
            // (I kept the previous logic abbreviated to save space, 
            // but you can paste your full command block here)
            const from = msg.key.remoteJid;
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            
            if (body === ".menu") {
                 await sock.sendMessage(from, { text: "✅ Bot is alive on Alwaysdata!" });
            }
        } catch (err) { }
    });
}
startBot();
