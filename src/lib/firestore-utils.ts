import { setDoc as originalSetDoc, DocumentReference } from 'firebase/firestore';

/**
 * Recursively removes properties with 'undefined' values from an object.
 * Firestore does not support 'undefined' as a field value.
 */
export const sanitizeData = (data: any): any => {
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeData);
  if (data instanceof Date) return data;

  const clean: any = {};
  Object.keys(data).forEach(key => {
    const value = data[key];
    if (value !== undefined) {
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        clean[key] = sanitizeData(value);
      } else {
        clean[key] = value;
      }
    }
  });
  return clean;
};

/**
 * Wraps setDoc with data sanitization and logging.
 */
export const safeSetDoc = async (docRef: DocumentReference, data: any, options?: any) => {
  const sanitized = sanitizeData(data);
  console.log(`[Firestore Write] ${docRef.path}:`, sanitized);
  try {
     return await originalSetDoc(docRef, sanitized, options);
  } catch (error) {
     console.error(`[Firestore Error] Failed to write to ${docRef.path}:`, error);
     throw error;
  }
};
