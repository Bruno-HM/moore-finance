import admin from 'firebase-admin';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const serviceAccount = JSON.parse(
    readFileSync(path.join(__dirname, '../serviceAccountKey.json'), 'utf8')
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const db = admin.firestore();
  console.log('⏳ Testando conexão...');
  const snap = await db.collection('users').limit(1).get();
  console.log(`✅ Conexão OK. Encontrados ${snap.size} usuários.`);
  process.exit(0);
} catch (err) {
  console.error('❌ Erro no teste:');
  console.error(err);
  process.exit(1);
}

