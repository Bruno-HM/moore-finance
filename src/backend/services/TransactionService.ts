import { transactionRepository, TransactionData } from '../repositories/TransactionRepository';
import { v4 as uuidv4 } from 'uuid';
import { addMonths, parseISO, isSameMonth, startOfMonth, endOfMonth, format } from 'date-fns';

export function calculateBillingDate(dateStr: string, paymentMethod: string, closingDay?: number): string {
  const date = parseISO(dateStr);
  if (paymentMethod !== 'credito' || !closingDay) {
    return dateStr;
  }
  const day = date.getDate();
  if (day < closingDay) {
    return dateStr;
  } else {
    return addMonths(date, 1).toISOString();
  }
}

export function getEffectiveDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const effectiveDay = Math.min(day, lastDay);
  return new Date(year, month, effectiveDay, 12, 0, 0);
}

export class TransactionService {
  async addTransaction(data: Omit<TransactionData, 'id' | 'billingDate'> & { billingDay?: number, closingDay?: number }): Promise<TransactionData[]> {
    const createdTransactions: TransactionData[] = [];
    const closingDay = data.closingDay;

    if (data.recurrenceType === 'fixa' || data.recurrenceType === 'assinatura') {
      // Cria a RecurringTransaction Template e a Primeira Instância (a simplificação aqui é por ser a lógica base)
      const billingDate = calculateBillingDate(data.date, data.paymentMethod, closingDay);
      const recurringId = uuidv4();
      
      const nova: TransactionData = {
        ...data,
        recurringId,
        billingDate
      };
      
      const created = await transactionRepository.create(nova);
      createdTransactions.push(created);
      
    } else if (data.recurrenceType === 'parcelada' && data.totalInstallments) {
      const baseDate = new Date(data.date);
      const recurringId = uuidv4();
      
      for (let i = 0; i < data.totalInstallments; i++) {
        const installmentDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate());
        const billingDate = calculateBillingDate(installmentDate.toISOString(), data.paymentMethod, closingDay);
        
        const inst: TransactionData = {
          ...data,
          date: installmentDate.toISOString(),
          billingDate,
          recurringId,
          installmentNumber: i + 1,
          status: i === 0 ? data.status : 'pendente'
        };
        const created = await transactionRepository.create(inst);
        createdTransactions.push(created);
      }
    } else {
      const billingDate = calculateBillingDate(data.date, data.paymentMethod, closingDay);
      const created = await transactionRepository.create({
        ...data,
        billingDate
      });
      createdTransactions.push(created);
    }

    return createdTransactions;
  }
}

export const transactionService = new TransactionService();

