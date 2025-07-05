import { saveMessage } from '../../firebase/lib/messages.js';

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

export default async function handler(req, res) {
  console.log('Webhook called:', req.method, req.url);
  
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
  } else if (req.method === 'POST') {
    const body = req.body;
    
    console.log('Message received:', JSON.stringify(body, null, 2));

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            const messages = change.value.messages;
            for (const message of messages || []) {
              // Save message to Firebase
              await saveMessage({
                messageId: message.id,
                from: message.from,
                type: message.type,
                text: message.text?.body,
                timestamp: message.timestamp,
                phoneNumberId: change.value.metadata.phone_number_id
              });
              
              if (message.type === 'text') {
                await sendMessage(message.from, `Echo: ${message.text.body}`);
              }
            }
          }
        }
      }
      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.status(404).send('Not Found');
    }
  }
}

async function sendMessage(to, text) {
  try {
    await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text }
      })
    });
  } catch (error) {
    console.error('WhatsApp API Error:', error.message);
    throw error; 
  }
}