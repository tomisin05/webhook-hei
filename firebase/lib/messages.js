import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config.js';

export async function saveMessage(messageData) {
  try {
    const docRef = await addDoc(collection(db, 'messages'), {
      ...messageData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving message:', error);
    throw error;
  }
}