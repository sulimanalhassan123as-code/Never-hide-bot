const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whisky-sockets/baileys');
const pino = require('pino');
const fs = require('fs');
const http = require('http');

// 👇👇 ENTER FRIEND'S NUMBER HERE (No +) 👇👇
const targetNumber = "233599931348"; 

// --- 🌐 MINI-WEBSITE TO SHOW THE CODE 🌐 ---
let currentPairingCode = "Waiting...";
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
        <html>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h2>Your Pairing Code:</h2>
                <div style="font-size: 40px; font-weight: bold; border: 2px dashed #000; padding: 20px; display: inline-block; background-color: #f0f0f0;">
                    ${currentPairingCode}
                </div>
                <p>Tap and hold the code above to copy!</p>
                <script>setTimeout(() => location.reload(), 3000);</script>
            </body>
        </html>
    `);
});
server.listen(3000, () => console.log("🌐 Web Server Started on Port 3000"));
// ---------------------------------------------

async function startBot() {
    console.log(`\n🔵 SYSTEM: Starting...`);

    // 1. Session Cleanup
    if (fs.existsSync('auth_info') && !fs.existsSync('auth_info/creds.json')) {
        fs.rmSync('auth_info', { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
    });

    // 2. Generate Code & Send to Website
    if (!sock.authState.creds.me && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                console.log("📡 Requesting Code...");
                const code = await sock.requestPairingCode(targetNumber);
                
                // Format code (e.g., ABC-123)
                const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
                
                // Update the Website Variable
                currentPairingCode = formattedCode;
                
                console.log(`\n✅ CODE GENERATED: ${formattedCode}`);
                console.log(`👉 TAP THE 'WEBVIEW' BUTTON TO COPY IT EASILY!\n`);
                
            } catch (err) {
                console.log("⚠️ Error: Check phone number.", err.message);
                currentPairingCode = "Error: Check Console";
            }
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = (lastDisconnect?.error)?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                startBot();
            } else {
                console.log("⛔ Logged out. Delete 'auth_info' folder.");
            }
        } else if (connection === 'open') {
            console.log('✅ SUCCESS! Connected.');
            currentPairingCode = "CONNECTED! ✅";
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

startBot();
