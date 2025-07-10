import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config.js';

export async function saveChatMessage(customerId, message, isBot = false) {
  try {
    await addDoc(collection(db, 'chatHistory'), {
      customerId,
      message,
      isBot,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Error saving chat message:', error);
    throw error;
  }
}

export async function getChatHistory(customerId, messageLimit = 10) {
  try {
    const q = query(
      collection(db, 'chatHistory'),
      where('customerId', '==', customerId),
      orderBy('timestamp', 'desc'),
      limit(messageLimit)
    );
    
    const querySnapshot = await getDocs(q);
    const history = [];
    
    querySnapshot.forEach((doc) => {
      history.push(doc.data());
    });
    
    return history.reverse(); // Return in chronological order
  } catch (error) {
    console.error('Error getting chat history:', error);
    return [];
  }
}

export function formatChatHistoryForPrompt(chatHistory) {
  if (!chatHistory || chatHistory.length === 0) {
    return "No previous conversation history.";
  } 
  
  return chatHistory.map(msg => 
    `${msg.isBot ? 'Bot' : 'Customer'}: ${msg.message}`
  ).join('\n');
}
