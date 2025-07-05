import { saveMessage } from '../../firebase/lib/messages.js';
// import { Timestamp } from 'firebase/firestore';
// const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
// const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
// const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// export default async function handler(req, res) {
//   console.log('Webhook called:', req.method, req.url);
  
//   if (req.method === 'GET') {
//     const mode = req.query['hub.mode'];
//     const token = req.query['hub.verify_token'];
//     const challenge = req.query['hub.challenge'];

//     if (mode === 'subscribe' && token === VERIFY_TOKEN) {
//       res.status(200).send(challenge);
//     } else {
//       res.status(403).send('Forbidden');
//     }
//   } else if (req.method === 'POST') {
//     const body = req.body;
    
//     console.log('Message received:', JSON.stringify(body, null, 2));

//     if (body.object === 'whatsapp_business_account') {
//       for (const entry of body.entry || []) {
//         for (const change of entry.changes || []) {
//           if (change.field === 'messages') {
//             const messages = change.value.messages;
//             for (const message of messages || []) {
//               // Save message to Firebase
//               await saveMessage({
//                 messageId: message.id,
//                 from: message.from,
//                 type: message.type,
//                 text: message.text?.body || null,
//                 timestamp: new Date(parseInt(message.timestamp) * 1000),
//                 phoneNumberId: change.value.metadata.phone_number_id
//                 });

              
//               if (message.type === 'text') {
//                 await sendMessage(message.from, `Echo: ${message.text.body}`);
//               }
//             }
//           }
//         }
//       }
//       res.status(200).send('EVENT_RECEIVED');
//     } else {
//       res.status(404).send('Not Found');
//     }
//   }
// }

// async function sendMessage(to, text) {
//   try {
//     await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
//       method: 'POST',
//       headers: {
//         'Authorization': `Bearer ${ACCESS_TOKEN}`,
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify({
//         messaging_product: 'whatsapp',
//         to: to,
//         type: 'text',
//         text: { body: text }
//       })
//     });
//   } catch (error) {
//     console.error('WhatsApp API Error:', error.message);
//     throw error; 
//   }
// }


const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

module.exports = async function handler(req, res) {
  const logs = [];
  
  try {
    logs.push('Webhook called: ' + req.method + ' ' + req.url);
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
      logs.push('POST body received');
      console.log('POST body:', JSON.stringify(body, null, 2));

      if (body.object === 'whatsapp_business_account') {
        logs.push('Processing WhatsApp message');
        
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === 'messages') {
              const messages = change.value.messages;
              for (const message of messages || []) {
                logs.push('Message received: ' + message.type);
                console.log('Received message:', message);
                await saveMessage({
                messageId: message.id,
                from: message.from,
                type: message.type,
                text: message.text?.body || null,
                // timestamp: Timestamp.fromMillis(parseInt(message.timestamp) * 1000),
                phoneNumberId: change.value.metadata.phone_number_id
                });

                if (message.type === 'text') {
                  logs.push('Sending echo message');
                  await sendMessage(message.from, `Echo: ${message.text.body}`, logs);
                }
              }
            }
          }
        }
        
        logs.push('Sending response');
        res.status(200).json({ status: 'EVENT_RECEIVED', logs });
      } else {
        res.status(404).json({ error: 'Not Found', logs });
      }
    }
  } catch (error) {
    logs.push('Error: ' + error.message);
    console.error('Handler error:', error);
    res.status(500).json({ error: error.message, logs });
  }
}

async function sendMessage(to, text, logs) {
  logs.push('Attempting to send message to: ' + to);
  console.log('Sending message to:', to, 'Text:', text);
  console.log('Using PHONE_NUMBER_ID:', PHONE_NUMBER_ID);
  console.log('Using ACCESS_TOKEN:', ACCESS_TOKEN ? 'Set' : 'Missing');
  
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
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
    
    const responseText = await response.text();
    logs.push('API Response: ' + response.status + ' - ' + responseText);
    console.log('API Response Status:', response.status);
    console.log('API Response:', responseText);
    
    if (!response.ok) {
      logs.push('API Error: ' + response.status);
      console.error('API Error:', response.status, responseText);
    }
  } catch (error) {
    logs.push('Send error: ' + error.message);
    console.error('Error sending message:', error.message);
  }
}