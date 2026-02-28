const WhatsAppWeb = require('venom-bot');

// Create the WhatsApp bot
WhatsAppWeb.create('sessionName')
    .then((client) => start(client))
    .catch((error) => console.log(error));

function start(client) {
    client.onMessage((message) => {
        if (message.body === 'Hi') {
            client.sendText(message.from, 'Hello from the WhatsApp bot!');
        }
    });
}
