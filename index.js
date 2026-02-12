const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whisky-sockets/baileys');
const pino = require('pino');
const fs = require('fs');
const axios = require('axios'); // For fetching data
const config = require('./config'); // Load your settings

async function startBot() {
    console.log(`🟢 BOOTING UP: ${config.botName}...`);

    // 1. Session Cleaner (Fixes the "Looping" error)
    if (fs.existsSync('auth_info') && !fs.existsSync('auth_info/creds.json')) {
        console.log("🧹 Cleaning corrupted session...");
        fs.rmSync('auth_info', { recursive: true, force: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    // 2. Create the Bot Client
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !config.usePairingCode,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"], // Looks like a Linux Server
        markOnlineOnConnect: true
    });

    // 3. Pairing Code Logic
    if (config.usePairingCode && !sock.authState.creds.me && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const num = config.ownerNumber.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(num);
                console.log(`\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`);
                console.log(`💬 PAIRING CODE: ${code?.match(/.{1,4}/g)?.join("-")}`);
                console.log(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n`);
            } catch (err) {
                console.log("⚠️ Error generating code. Check config.js number!");
            }
        }, 3000);
    }

    // 4. Connection Monitoring
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = (lastDisconnect?.error)?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconnecting...");
                startBot();
            } else {
                console.log("⛔ Logged out. Delete 'auth_info' folder to restart.");
            }
        } else if (connection === 'open') {
            console.log(`✅ ${config.botName} IS ONLINE AND READY!`);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // 5. The Brain (Command Handler)
    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const type = Object.keys(msg.message)[0];
            const body = (type === 'conversation') ? msg.message.conversation :
                         (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text : '';

            if (body.startsWith(config.prefix)) {
                const command = body.slice(1).trim().split(' ')[0].toLowerCase();
                
                switch (command) {
                    case 'menu':
                        await sock.sendMessage(from, { text: 
`*🤖 ${config.botName.toUpperCase()}*
👑 Owner: ${config.ownerName}

*📋 Commands:*
${config.prefix}ping - Check bot speed
${config.prefix}joke - Get a random joke
${config.prefix}quote - Get an inspiring quote
${config.prefix}kick - (Reply to user) Kick from group`
                        });
                        break;

                    case 'ping':
                        await sock.sendMessage(from, { text: 'Pong! 🏓 Speed: Fast' });
                        break;
                    
                    case 'joke':
                        // Fetch a joke from the internet
                        try {
                           const res = await axios.get('https://v2.jokeapi.dev/joke/Any?type=single');
                           await sock.sendMessage(from, { text: `😂 *Joke:*\n${res.data.joke}` });
                        } catch (e) { sock.sendMessage(from, { text: 'No jokes right now!' }); }
                        break;
                    
                    case 'quote':
                        // Fetch a quote
                        try {
                           const res = await axios.get('https://api.quotable.io/random');
                           await sock.sendMessage(from, { text: `💡 *Quote:*\n"${res.data.content}"\n- ${res.data.author}` });
                        } catch (e) { sock.sendMessage(from, { text: 'No quotes available.' }); }
                        break;
                }
            }
        } catch (err) {
            console.log(err);
        }
    });
}

startBot();
