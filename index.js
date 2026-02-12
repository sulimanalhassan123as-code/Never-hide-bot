/**
 * 🤖 NEVER HIDE BOT - MIGRATION VERSION
 * This version is designed to be moved between accounts easily.
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whisky-sockets/baileys');
const pino = require('pino');
const fs = require('fs');

// 👇👇 ENTER THE PHONE NUMBER HERE (No + sign, just numbers) 👇👇
const targetNumber = "233599931348"; 

async function startBot() {
    console.log(`\n🔵 SYSTEM: Initializing Bot for ${targetNumber}...`);
    console.log("⏳ Waiting 10 seconds to let you get your phone ready...");
    await delay(10000); // 10-second delay so you can open WhatsApp Settings

    // 1. Session Cleaning (Prevent "Looping" or "Corrupted" errors)
    if (fs.existsSync('auth_info') && !fs.existsSync('auth_info/creds.json')) {
        console.log("🧹 Cleaning up old session garbage...");
        fs.rmSync('auth_info', { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // QR OFF (We use Pairing Code)
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"], // Tricks WhatsApp into thinking it's a PC
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000, // Give it 1 minute to connect
    });

    // 2. The Pairing Code Generator
    if (!sock.authState.creds.me && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                console.log("📡 Requesting Code from WhatsApp...");
                const code = await sock.requestPairingCode(targetNumber);
                
                // PRINT THE CODE BIG AND CLEAR
                console.log(`\n\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`);
                console.log(`     🟢 YOUR PAIRING CODE IS BELOW 🟢`);
                console.log(`     👉  ${code?.match(/.{1,4}/g)?.join("-") || code}  👈`);
                console.log(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n`);
                console.log("⚠️ You have about 2 minutes to type this into WhatsApp!");
                
            } catch (err) {
                console.log("⚠️ ERROR: Could not get code. Is the number correct?", err.message);
            }
        }, 3000);
    }

    // 3. Connection Handler (Keeps it alive)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const reason = (lastDisconnect?.error)?.output?.statusCode;
            
            if (reason === DisconnectReason.loggedOut) {
                console.log("⛔ Logged out. Delete 'auth_info' folder to restart.");
            } else {
                console.log("🔄 Connection dropped. Restarting automatically...");
                startBot();
            }
        } else if (connection === 'open') {
            console.log('✅ SUCCESS! The bot is connected.');
        }
    });

    sock.ev.on('creds.update', saveCreds);
    
    // 4. Simple Menu Command (To test if it works)
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const type = Object.keys(msg.message)[0];
        const body = (type === 'conversation') ? msg.message.conversation :
                     (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : '';

        if (body.toLowerCase() === '!menu') {
            await sock.sendMessage(msg.key.remoteJid, { text: "✅ The Bot is Working!" });
        }
    });
}

// Start the system
startBot();
