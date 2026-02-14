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
                console.log("❌ Error generating pairing code:",
