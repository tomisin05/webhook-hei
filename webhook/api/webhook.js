import { Timestamp } from 'firebase/firestore';
import { saveMessage, checkMessageExists } from '../../firebase/lib/messages.js';
import { saveChatMessage } from '../../firebase/lib/chatHistory.js';
import { generateResponseWithHistory } from '../../gemini/lib/utils.js';

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// export default async function handler(req, res) {
//   const logs = [];


  
//   try {
//     console.log('Webhook called:', req.method, req.url);

//     if (req.method === 'GET') {
//       const mode = req.query['hub.mode'];
//       const token = req.query['hub.verify_token'];
//       const challenge = req.query['hub.challenge'];

//       if (mode === 'subscribe' && token === VERIFY_TOKEN) {
//         res.status(200).send(challenge);
//       } else {
//         res.status(403).send('Forbidden');
//       }
//     // } else if (req.method === 'POST') {
//     //   const body = req.body;
//     //   console.log('POST body:', JSON.stringify(body, null, 2));


//     //   if (body.object === 'whatsapp_business_account') {
//     //     console.log('Processing WhatsApp message');
        
        
        
//     //     try {
//     //     await processMessagesAsync(body); // ✅ this is the fix
//     //     } catch (error) {
//     //     console.error('Async processing error:', error);
//     //     }

//     //   }
//     // }

//     } else if (req.method === 'POST') {
//   const body = req.body;
//   console.log('POST body:', JSON.stringify(body, null, 2));

//   if (body.object === 'whatsapp_business_account') {
//     console.log('Processing WhatsApp message');

//     try {
//       await processMessagesAsync(body); // ✅ this is the fix
//     } catch (error) {
//       console.error('Async processing error:', error);
//     }

//     res.status(200).json({ status: 'EVENT_RECEIVED' }); // ✅ only after processing
//   } else {
//     res.status(404).json({ error: 'Not Found', logs });
//   }
// }

    
//     res.status(200).json({ status: 'EVENT_RECEIVED' });

//   } catch (error) {
//     console.error('Handler error:', error);
//     res.status(500).json({ error: error.message, logs });
//   }
// }


//         console.log('Sending response');
//         res.status(200).json({ status: 'EVENT_RECEIVED', logs });
//       } else {
//         res.status(404).json({ error: 'Not Found', logs });
//       }
//     }
//   } catch (error) {
//     console.error('Handler error:', error);
//     res.status(500).json({ error: error.message, logs });
//   }
// }


export default async function handler(req, res) {
  const logs = [];

  try {
    console.log('Webhook called:', req.method, req.url);

    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        return res.status(200).send(challenge);
      } else {
        return res.status(403).send('Forbidden');
      }
    }

    if (req.method === 'POST') {
      const body = req.body;
      console.log('POST body:', JSON.stringify(body, null, 2));

      if (body.object === 'whatsapp_business_account') {
        console.log('Processing WhatsApp message');

        try {
          await processMessagesAsync(body); // ✅ wait before responding
        } catch (error) {
          console.error('Async processing error:', error);
          // We won't re-throw to avoid double response
        }

        return res.status(200).json({ status: 'EVENT_RECEIVED', logs });
      } else {
        return res.status(404).json({ error: 'Not a WhatsApp event' });
      }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error) {
    console.error('Handler error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message });
    }
  }
}



async function processMessagesAsync(body) {
    for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
            if (change.field === 'messages') {
              const messages = change.value.messages;
              for (const message of messages || []) {
                console.log('Received message:', message);

                // Check for duplicate message
                const existing = await checkMessageExists(message.id);
                if (existing) {
                    console.log('Duplicate message detected, skipping:', message.id);
                    continue; // Skip to next message
                }
                
                await saveMessage({
                  messageId: message.id,
                  from: message.from,
                  type: message.type,
                  text: message.text?.body || null,
                  timestamp: Timestamp.fromMillis(parseInt(message.timestamp) * 1000 ),
                  phoneNumberId: change.value.metadata.phone_number_id
                });


                
                // if (message.type === 'text') {
                // const customerId = message.from;
                // const userMessage = message.text.body;
                
                // // Save user message to chat history
                // await saveChatMessage(customerId, userMessage, false);
                
                // // Generate AI response with chat history context
                // const aiResponse = await generateResponseWithHistory(customerId, userMessage);
                
                // // Parse the JSON response
                // let responseData;
                // try {
                //     responseData = JSON.parse(aiResponse);
                // } catch (error) {
                //     responseData = {
                //     status: "error",
                //     message: "Sorry, I encountered an error processing your request."
                //     };
                // }
                
                // // Save bot response to chat history
                // await saveChatMessage(customerId, responseData.message, true);
                
                // // Send response to WhatsApp
                // await sendMessage(customerId, responseData.message, logs);
                // }

                if (message.type === 'text') {
                    const customerId = message.from;
                    const userMessage = message.text.body;

                    await saveChatMessage(customerId, userMessage, false);

                    let aiResponse;
                    let responseData;

                    try {
                        aiResponse = await generateResponseWithHistory(customerId, userMessage);
                        
                        console.log('=== ABOUT TO PARSE JSON ===');
                        console.log('Raw response type:', typeof aiResponse);
                        console.log('Raw response:', aiResponse);
                        
                        // Clean the response
                        let cleanResponse = aiResponse.trim();
                        if (cleanResponse.startsWith('```json')) {
                            cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
                        }
                        if (cleanResponse.startsWith('```')) {
                            cleanResponse = cleanResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
                        }
                        
                        console.log('=== CLEANED RESPONSE ===');
                        console.log(cleanResponse);
                        
                        responseData = JSON.parse(cleanResponse);
                    } catch (error) {
                        console.error('Error generating response:', error);
                        responseData = {
                        status: "error",
                        message: "Sorry, I'm currently overloaded. Please try again shortly."
                        };
                    }

                    await saveChatMessage(customerId, responseData.message, true);
                    await sendMessage(customerId, responseData.message);
                    }

              }
            }
          }
        }
    }


async function sendMessage(to, text) {
  console.log('Attempting to send message to: ' + to);
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
    console.log('API Response Status:', response.status);
    console.log('API Response:', responseText);
    
    if (!response.ok) {
      console.error('API Error:', response.status, responseText);
    }
  } catch (error) {
    console.error('Error sending message:', error.message);
  }
}


 

// import {  collection, addDoc } from 'firebase/firestore';

// import { db } from '../../firebase/config.js';
// import { Timestamp } from 'firebase/firestore';
// import { saveMessage } from '../../firebase/lib/messages.js';
// import { saveChatMessage } from '../../firebase/lib/chatHistory.js';
// import { generateResponseWithHistory } from '../../gemini/lib/utils.js';

// const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
// const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
// const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// export default async function handler(req, res) {  
//   try {
//     console.log('Webhook called:', req.method, req.url);

//     if (req.method === 'GET') {
//       const mode = req.query['hub.mode'];
//       const token = req.query['hub.verify_token'];
//       const challenge = req.query['hub.challenge'];

//       if (mode === 'subscribe' && token === VERIFY_TOKEN) {
//         res.status(200).send(challenge);
//       } else {
//         res.status(403).send('Forbidden');
//       }
//     } else if (req.method === 'POST') {
//       const body = req.body;
//       console.log('POST body:', JSON.stringify(body, null, 2));

//       res.status(200).json({ status: 'EVENT_RECEIVED' });

//       if (body.object === 'whatsapp_business_account') {
//         console.log('Processing WhatsApp message');
    
//         processMessagesAsync(body).catch(error => {
//           console.error('Async processing error:', error);
//         });
//       }
//     }
//   } catch (error) {
//     console.error('Handler error:', error);
//     // Only respond if we haven't already responded
//     if (!res.headersSent) {
//       res.status(200).json({ status: 'ERROR_HANDLED' });
//     }
//   }
// }

// // async function processMessagesAsync(body) {
// //   for (const entry of body.entry || []) {
// //     for (const change of entry.changes || []) {
// //       if (change.field === 'messages') {
// //         const messages = change.value.messages;
// //         for (const message of messages || []) {
// //           await saveMessage({
// //             messageId: message.id,
// //             from: message.from,
// //             type: message.type,
// //             text: message.text?.body || null,
// //             timestamp: Timestamp.fromMillis(parseInt(message.timestamp) * 1000),
// //             phoneNumberId: change.value.metadata.phone_number_id
// //           });

// //           if (message.type === 'text') {
// //             const customerId = message.from;
// //             const userMessage = message.text.body;
            
// //             await saveChatMessage(customerId, userMessage, false);
            
// //             try {
// //               const aiResponse = await generateResponseWithHistory(customerId, userMessage);
// //               const responseData = JSON.parse(aiResponse);
// //               await saveChatMessage(customerId, responseData.message, true);
// //               await sendMessage(customerId, responseData.message);
// //             } catch (error) {
// //               const fallbackMessage = "Sorry, I encountered an error processing your request.";
// //               await saveChatMessage(customerId, fallbackMessage, true);
// //               await sendMessage(customerId, fallbackMessage);
// //             }
// //           }
// //         }
// //       }
// //     }
// //   }
// // }



// // webhook/api/webhook.js (update processMessagesAsync function)
// // async function processMessagesAsync(body) {
// //   console.log('Starting async message processing...');
  
// //   for (const entry of body.entry || []) {
// //     for (const change of entry.changes || []) {
// //       if (change.field === 'messages') {
// //         const messages = change.value.messages;
// //         for (const message of messages || []) {
// //           console.log('Processing message:', message.id);
          
// //           try {
// //             // Save message to database
// //             // console.log('Saving message to database...');
// //             // await saveMessage({
// //             //   messageId: message.id,
// //             //   from: message.from,
// //             //   type: message.type,
// //             //   text: message.text?.body || null,
// //             //   timestamp: Timestamp.fromMillis(parseInt(message.timestamp) * 1000),
// //             //   phoneNumberId: change.value.metadata.phone_number_id
// //             // });
// //             // console.log('Message saved successfully');

// //             // In webhook.js, replace saveMessage call with:
// //             console.log('Testing simple Firebase write...');
// //             await addDoc(collection(db, 'test'), { test: 'data', timestamp: new Date() });
// //             console.log('Simple write successful');


// //             if (message.type === 'text') {
// //               const customerId = message.from;
// //               const userMessage = message.text.body;
              
// //               console.log('Saving chat message...');
// //               await saveChatMessage(customerId, userMessage, false);
// //               console.log('Chat message saved');
              
// //               try {
// //                 console.log('Generating AI response...');
// //                 const aiResponse = await generateResponseWithHistory(customerId, userMessage);
// //                 console.log('AI response generated');
                
// //                 const responseData = JSON.parse(aiResponse);
// //                 await saveChatMessage(customerId, responseData.message, true);
// //                 await sendMessage(customerId, responseData.message);
// //               } catch (error) {
// //                 console.error('Error in AI processing:', error);
// //                 const fallbackMessage = "Sorry, I encountered an error processing your request.";
// //                 await saveChatMessage(customerId, fallbackMessage, true);
// //                 await sendMessage(customerId, fallbackMessage);
// //               }
// //             }
// //           } catch (error) {
// //             console.error('Error processing message:', message.id, error);
// //           }
// //         }
// //       }
// //     }
// //   }
// //   console.log('Async processing completed');
// // }



// // Replace your test Firebase write with this:
// async function processMessagesAsync(body) {
//   console.log('Starting async message processing...');
  
//   for (const entry of body.entry || []) {
//     for (const change of entry.changes || []) {
//       if (change.field === 'messages') {
//         const messages = change.value.messages;
//         for (const message of messages || []) {
//           console.log('Processing message:', message.id);
          
//           try {
//             console.log('Testing simple Firebase write...');
            
//             // Add timeout to Firebase write
//             const writePromise = addDoc(collection(db, 'test'), { 
//               test: 'data', 
//               timestamp: new Date(),
//               messageId: message.id 
//             });
            
//             const timeoutPromise = new Promise((_, reject) => 
//               setTimeout(() => reject(new Error('Firebase write timeout after 15s')), 15000)
//             );
            
//             const docRef = await Promise.race([writePromise, timeoutPromise]);
//             console.log('Simple write successful, doc ID:', docRef.id);

//             if (message.type === 'text') {
//               const customerId = message.from;
//               const userMessage = message.text.body;
//               console.log('Processing text message from:', customerId);
              
//               // For now, just send a simple response without AI
//               await sendMessage(customerId, `Echo: ${userMessage}`);
//             }
//           } catch (error) {
//             console.error('Error processing message:', message.id, error.message);
//           }
//         }
//       }
//     }
//   }
//   console.log('Async processing completed');
// }

// async function sendMessage(to, text) {
//   console.log('Sending message to:', to);
//   try {
//     const response = await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
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
    
//     if (!response.ok) {
//       console.error('WhatsApp API Error:', response.status, await response.text());
//     } else {
//       console.log('Message sent successfully');
//     }
//   } catch (error) {
//     console.error('Error sending message:', error.message);
//   }
// }


// // async function sendMessage(to, text) {
// //   try {
// //     const response = await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
// //       method: 'POST',
// //       headers: {
// //         'Authorization': `Bearer ${ACCESS_TOKEN}`,
// //         'Content-Type': 'application/json'
// //       },
// //       body: JSON.stringify({
// //         messaging_product: 'whatsapp',
// //         to: to,
// //         type: 'text',
// //         text: { body: text }
// //       })
// //     });
    
// //     if (!response.ok) {
// //       console.error('API Error:', response.status, await response.text());
// //     }
// //   } catch (error) {
// //     console.error('Error sending message:', error.message);
// //   }
// // }
