import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
let serviceAccount: any;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
  if (existsSync(serviceAccountPath)) {
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  }
}

if (!serviceAccount) {
  console.error('❌ Erro: Nenhuma credencial do Firebase encontrada (FIREBASE_SERVICE_ACCOUNT ou serviceAccountKey.json)');
  process.exit(1);
}

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const dbId = process.env.FIREBASE_DATABASE_ID || '(default)';
const db = getFirestore(app, dbId);

async function findOrphanedHouseholds() {
  console.log('🔍 Iniciando busca por households órfãos...');

  // 1. Fetch all users to create a set of valid user IDs
  const usersSnapshot = await db.collection('users').get();
  const validUserIds = new Set(usersSnapshot.docs.map(doc => doc.id));
  console.log(`✅ ${validUserIds.size} usuários encontrados.`);

  // 2. Fetch all households
  const householdsSnapshot = await db.collection('households').get();
  const orphanedHouseholds: any[] = [];

  for (const doc of householdsSnapshot.docs) {
    const data = doc.data();
    const members = data.members || [];
    
    // An orphaned household is one where NO listed members exist in the users collection
    const activeMembers = members.filter((uid: string) => validUserIds.has(uid));

    if (activeMembers.length === 0) {
      orphanedHouseholds.push({
        id: doc.id,
        membersCount: members.length,
        inviteCode: data.inviteCode || 'N/A',
        isPersonal: !!data.isPersonal,
        createdAt: data.createdAt || 'N/A'
      });
    }
  }

  if (orphanedHouseholds.length > 0) {
    console.log(`\n📋 Resultado: Seus ${orphanedHouseholds.length} households possivelmente órfãos foram identificados.`);
    console.log('Exibindo os IDs dos primeiros 10 para exemplo:');
    orphanedHouseholds.slice(0, 10).forEach(h => {
      console.log(`- ID: ${h.id} (Invite: ${h.inviteCode}, Created: ${h.createdAt})`);
    });
    
    if (orphanedHouseholds.length > 10) {
      console.log(`\n...e outros ${orphanedHouseholds.length - 10} resultados.`);
    }

    console.log('\n💡 Nota: Estes households não possuem NENHUM membro ativo na coleção "users".');
    console.log('Sugestão: Verifique se estes IDs possuem dados vinculados antes de qualquer deleção.');
  } else {
    console.log('✨ Nenhum household órfão encontrado.');
  }

  process.exit(0);
}

findOrphanedHouseholds().catch(err => {
  console.error('\n❌ ERRO FATAL:');
  console.error(err);
  process.exit(1);
});

