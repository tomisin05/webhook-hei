// import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
// import { db } from '../config.js';

// export async function saveMessage(messageData) {
//   try {
//     const docRef = await addDoc(collection(db, 'messages'), {
//       ...messageData,
//       createdAt: serverTimestamp()
//     });
//     return docRef.id;
//   } catch (error) {
//     console.error('Error saving message:', error);
//     throw error;
//   }
// }

import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../config.js';

export async function saveMessage(messageData) {
  try {
    console.log('Attempting to save message:', messageData.messageId);
    
    const docRef = await Promise.race([
      addDoc(collection(db, 'messages'), {
        ...messageData,
        createdAt: serverTimestamp()
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase timeout')), 10000)
      )
    ]);
    
    console.log('Message saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving message:', error);
    throw error;
  }
}


export async function checkMessageExists(messageId) {
  try {
    const messageRef = doc(db, 'messages', messageId);
    const messageSnap = await getDoc(messageRef);
    return messageSnap.exists();
  } catch (error) {
    console.error('Error checking message existence:', error);
    return false; // If check fails, assume it doesn't exist to avoid blocking
  }
}