const venom = require('venom-bot'); // Or baileys if you use that
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// --- WhatsApp Bot Setup ---
venom.create('neverhide-session', {
    useChrome: false, // optional: faster headless mode
    session: 'neverhide-session',
    multidevice: true,
})
.then((client) => {
    console.log('🚀 NeverHide SuperBot started!');

    // Example AI command / simple reply
    client.onMessage((message) => {
        if (message.body.toLowerCase() === 'hi') {
            client.sendText(message.from, 'Hello from NeverHide SuperBot! 🤖');
        }
    });
})
.catch((err) => console.error(err));

// --- Express listener to satisfy Render ---
app.get('/', (req, res) => {
    res.send('NeverHide SuperBot is running ✅');
});

app.listen(PORT, () => console.log(`Web listener active on port ${PORT}`));
