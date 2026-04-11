import { adminDb } from '../config/firebaseAdmin';

export interface TransactionData {
  id?: string;
  householdId: string;
  amount: number;
  categoryId: string;
  date: string;
  billingDate?: string;
  title: string;
  description?: string;
  type: 'receita' | 'despesa';
  createdBy: string;
  status: 'pendente' | 'pago';
  paymentMethod: 'pix' | 'credito' | 'debito' | 'dinheiro';
  recurrenceType: 'unica' | 'parcelada' | 'fixa' | 'assinatura';
  recurringId?: string;
  totalInstallments?: number;
  installmentNumber?: number;
  bankTransactionId?: string;
}

export class TransactionRepository {
  private get collection() {
    return adminDb.collection('transactions');
  }

  async create(data: TransactionData): Promise<TransactionData> {
    if(!data.id) {
       const ref = this.collection.doc();
       data.id = ref.id;
    }
    await this.collection.doc(data.id!).set(data);
    return data;
  }

  async getByHousehold(householdId: string): Promise<TransactionData[]> {
    const snapshot = await this.collection.where('householdId', '==', householdId).get();
    return snapshot.docs.map(doc => doc.data() as TransactionData);
  }

  // Mais métodos podem ser adicionados aqui sob o padrão Repository
}

export const transactionRepository = new TransactionRepository();

