import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit,
  where,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

// Operation Types
export interface Operation {
  id?: string;
  name: string;
  maliciousGoal: string;
  targetLLM: string;
  targetDescription?: string;
  aiTargetPersona: string;
  attackVector: string;
  initialPrompt: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  result?: 'success' | 'partial' | 'failure' | 'blocked';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  startTime?: Timestamp;
  endTime?: Timestamp;
  notes?: string;
}

export interface ConversationMessage {
  id?: string;
  operationId: string;
  role: 'operator' | 'target' | 'strategist';
  content: string;
  timestamp: Timestamp;
  messageType?: 'prompt' | 'response' | 'analysis';
}

export interface SuccessfulPayload {
  id?: string;
  prompt: string;
  attackVector: string;
  targetLLM: string;
  successRate: number;
  operationId: string;
  createdAt: Timestamp;
  description?: string;
}

// Operation Management
export async function createOperation(operationData: Omit<Operation, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<string> {
  try {
    const now = Timestamp.now();
    const operation: Omit<Operation, 'id'> = {
      ...operationData,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, 'operations'), operation);
    console.log('Operation created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating operation:', error);
    throw error;
  }
}

export async function getOperation(operationId: string): Promise<Operation | null> {
  try {
    const docRef = doc(db, 'operations', operationId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Operation;
    } else {
      console.log('No such operation found');
      return null;
    }
  } catch (error) {
    console.error('Error getting operation:', error);
    throw error;
  }
}

export async function updateOperationStatus(
  operationId: string, 
  status: Operation['status'], 
  result?: Operation['result'],
  notes?: string
): Promise<void> {
  try {
    const docRef = doc(db, 'operations', operationId);
    const updateData: Partial<Operation> = {
      status,
      updatedAt: Timestamp.now(),
    };

    if (result !== undefined) {
      updateData.result = result;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (status === 'active') {
      const currentOpSnap = await getDoc(docRef);
      const currentOpData = currentOpSnap.exists() ? currentOpSnap.data() as Operation : null;
      if (!currentOpData?.startTime) {
        updateData.startTime = Timestamp.now();
      }
    }

    if (['completed', 'failed'].includes(status)) {
      updateData.endTime = Timestamp.now();
    }

    await updateDoc(docRef, updateData);
    console.log('Operation status updated:', operationId, status);
  } catch (error) {
    console.error('Error updating operation status:', error);
    throw error;
  }
}

export async function listOperations(limitCount: number = 50): Promise<Operation[]> {
  try {
    const q = query(
      collection(db, 'operations'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Operation[];
  } catch (error) {
    console.error('Error listing operations:', error);
    throw error;
  }
}

// Conversation Management
export async function addConversationMessage(message: Omit<ConversationMessage, 'id' | 'timestamp'>): Promise<string> {
  try {
    const messageData: Omit<ConversationMessage, 'id'> = {
      ...message,
      timestamp: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'conversations'), messageData);
    console.log('Conversation message added:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error adding conversation message:', error);
    throw error;
  }
}

export async function getConversationHistory(operationId: string): Promise<ConversationMessage[]> {
  try {
    const q = query(
      collection(db, 'conversations'),
      where('operationId', '==', operationId),
      orderBy('timestamp', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ConversationMessage[];
  } catch (error) {
    console.error('Error getting conversation history:', error);
    throw error;
  }
}

// Successful Payloads Management
export async function saveSuccessfulPayload(payload: Omit<SuccessfulPayload, 'id' | 'createdAt'>): Promise<string> {
  try {
    const payloadData: Omit<SuccessfulPayload, 'id'> = {
      ...payload,
      createdAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(db, 'SuccessfulPayloads'), payloadData);
    console.log('Successful payload saved:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving successful payload:', error);
    throw error;
  }
}

export async function getSuccessfulPayloadsFromFirestore(limitCount: number = 10): Promise<string[]> {
  try {
    const q = query(
      collection(db, 'SuccessfulPayloads'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data().prompt as string);
  } catch (error) {
    console.error('Error getting successful payloads:', error);
    // Return empty array if there's an error
    return [];
  }
}

export async function getSuccessfulPayloadsWithMetadata(limitCount: number = 50): Promise<SuccessfulPayload[]> {
  try {
    const q = query(
      collection(db, 'SuccessfulPayloads'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as SuccessfulPayload[];
  } catch (error) {
    console.error('Error getting successful payloads with metadata:', error);
    return [];
  }
}

// Analytics and Reporting
export async function getOperationStats(): Promise<{
  total: number;
  active: number;
  completed: number;
  successRate: number;
}> {
  try {
    const operations = await listOperations(1000);
    
    const total = operations.length;
    const active = operations.filter(op => op.status === 'active').length;
    const completed = operations.filter(op => ['completed', 'failed'].includes(op.status)).length;
    const successful = operations.filter(op => op.result === 'success').length;
    const successRate = completed > 0 ? successful / completed : 0;

    return {
      total,
      active, 
      completed,
      successRate,
    };
  } catch (error) {
    console.error('Error getting operation stats:', error);
    return { total: 0, active: 0, completed: 0, successRate: 0 };
  }
}