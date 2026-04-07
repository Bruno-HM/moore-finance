import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc, orderBy, getDocFromServer, writeBatch, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { safeSetDoc } from '../lib/firestore-utils';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { isSameMonth, parseISO, startOfMonth, endOfMonth, format, addMonths } from 'date-fns';

export interface Transaction {
  id: string;
  householdId: string;
  amount: number;
  categoryId: string;
  date: string;
  billingDate?: string; // When it hits the balance/invoice
  title: string;
  description?: string;
  type: 'receita' | 'despesa';
  createdBy: string;
  paidBy?: string; // Member ID who paid
  bankAccountId?: string; // Bank account ID used
  status: 'pendente' | 'pago';
  paymentMethod: 'pix' | 'credito' | 'debito' | 'dinheiro';
  recurrenceType: 'unica' | 'parcelada' | 'fixa' | 'assinatura';
  installmentNumber?: number;
  totalInstallments?: number;
  recurringId?: string;
  parentTransactionId?: string;
  creditCardId?: string;
  bankTransactionId?: string; // Unique ID from bank statement
}

export interface CreditCard {
  id: string;
  householdId: string;
  name: string;
  closingDay: number;
  dueDay: number;
  bankAccountId: string; // Linked bank account for payment
  memberId: string; // The user ID this card belongs to
  closingDayExceptions?: Record<string, number>; // Format: "YYYY-MM": day
}

export interface RecurringTransaction {
  id: string;
  householdId: string;
  amount: number;
  categoryId: string;
  title: string;
  description?: string;
  type: 'receita' | 'despesa';
  paymentMethod: 'pix' | 'credito' | 'debito' | 'dinheiro';
  recurrenceType: 'fixa' | 'assinatura';
  startDate: string;
  billingDay?: number; // Specific day of the month for billing
  createdBy: string;
  bankAccountId?: string; // Default bank account
  creditCardId?: string; // Default credit card (for subscriptions)
  paidBy?: string; // Default member
  skippedDates?: string[]; // ISO strings of the months (YYYY-MM) that were skipped
}

export interface BankAccount {
  id: string;
  householdId: string;
  name: string;
  initialBalance: number;
  currentBalance: number;
  memberId: string; // The user ID this account belongs to
}

export interface Category {
  id: string;
  householdId: string;
  name: string;
  color: string;
  type: 'receita' | 'despesa' | 'ambos';
  isDefault: boolean;
}

interface FinanceContextType {
  transactions: Transaction[];
  categories: Category[];
  creditCards: CreditCard[];
  bankAccounts: BankAccount[];
  recurringTransactions: RecurringTransaction[];
  loading: boolean;
  currentDate: Date;
  selectedMonth: Date;
  setSelectedMonth: (date: Date) => void;
  includePending: boolean;
  setIncludePending: (value: boolean) => void;
  addCreditCard: (card: Omit<CreditCard, 'id' | 'householdId'>) => Promise<void>;
  updateCreditCard: (id: string, card: Partial<CreditCard>) => Promise<void>;
  deleteCreditCard: (id: string) => Promise<void>;
  addBankAccount: (account: Omit<BankAccount, 'id' | 'householdId' | 'currentBalance'>) => Promise<void>;
  updateBankAccount: (id: string, account: Partial<BankAccount>) => Promise<void>;
  deleteBankAccount: (id: string) => Promise<void>;
  recalculateTransactionsForCard: (cardId: string, updatedCardData?: Partial<CreditCard>, monthKey?: string) => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'householdId' | 'createdBy'> & { billingDay?: number }) => Promise<void>;
  updateTransaction: (id: string, transaction: Partial<Transaction>, mode?: 'unica' | 'futuras' | 'todos') => Promise<void>;
  deleteTransaction: (id: string, mode?: 'unica' | 'futuras' | 'todos') => Promise<void>;
  updateRecurringTransaction: (id: string, transaction: Partial<RecurringTransaction>, mode?: 'este_mes' | 'futuras') => Promise<void>;
  deleteRecurringTransaction: (id: string) => Promise<void>;
  recalculateRecurring: () => Promise<void>;
  restoreRecurringInstance: (rtId: string, monthKey: string) => Promise<void>;
  addCategory: (category: Omit<Category, 'id' | 'householdId' | 'isDefault'>) => Promise<void>;
  updateCategory: (id: string, category: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  importTransactions: (bankAccountId: string, file: File) => Promise<{ added: number, skipped: number }>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const DEFAULT_CATEGORIES = [
  { name: 'Alimentação', color: '#EF4444', type: 'despesa' },
  { name: 'Transporte', color: '#F59E0B', type: 'despesa' },
  { name: 'Lazer', color: '#8B5CF6', type: 'despesa' },
  { name: 'Moradia', color: '#3B82F6', type: 'despesa' },
  { name: 'Salário', color: '#10B981', type: 'receita' },
];



export function calculateBillingDate(dateStr: string, paymentMethod: string, creditCard?: CreditCard): string {
  const date = parseISO(dateStr);
  
  if (paymentMethod !== 'credito' || !creditCard) {
    return dateStr;
  }

  const { dueDay, closingDayExceptions } = creditCard;
  const transactionDay = date.getDate();
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-based
  
  const monthKey = format(date, 'yyyy-MM');
  const closingDay = closingDayExceptions?.[monthKey] ?? creditCard.closingDay;

  // Nova Lógica de Faturamento Baseada em Exemplos A, B e C:
  // O mês de referência (que aparece no Dashboard) é o mês da fatura.
  // 1. Se o vencimento cai no mês seguinte ao fechamento (dueDay < closingDay), iniciamos com offset +1.
  // 2. Se a compra for feita no dia do fechamento ou DEPOIS (day >= closingDay), pulamos mais um mês (+1).
  const billingMonthOffset = (transactionDay >= closingDay ? 1 : 0) + (dueDay < closingDay ? 1 : 0);
  
  let billingMonth = month + billingMonthOffset;
  let billingYear = year;

  while (billingMonth > 11) {
    billingMonth -= 12;
    billingYear += 1;
  }

  // Ajuste do limit do mês (ex: dia 31 em mês q só tem 30)
  const lastDayOfTargetMonth = new Date(billingYear, billingMonth + 1, 0).getDate();
  const safeDueDay = Math.min(dueDay, lastDayOfTargetMonth);

  return new Date(billingYear, billingMonth, safeDueDay, 12, 0, 0).toISOString();
}

export function getEffectiveDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const effectiveDay = Math.min(day, lastDay);
  return new Date(year, month, effectiveDay, 12, 0, 0);
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { userProfile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate] = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));
  const [includePending, setIncludePending] = useState(true);

  const adjustBalance = async (accountId: string | undefined, amount: number, type: 'receita' | 'despesa', undo: boolean = false) => {
    if (!accountId) return;
    const factor = (type === 'receita' ? 1 : -1) * (undo ? -1 : 1);
    const adjustment = amount * factor;
    
    try {
      await updateDoc(doc(db, 'bank_accounts', accountId), {
        currentBalance: increment(adjustment)
      });
    } catch (error) {
      console.error('Error adjusting balance:', error);
    }
  };

  useEffect(() => {
    console.log("✅ FinanceContext: V2 - Sanitization Active");
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    if (!userProfile?.householdId) {
      setTransactions([]);
      setCategories([]);
      setLoading(false);
      return;
    }

    const householdId = userProfile.householdId;

    // Listen to transactions
    const qTransactions = query(
      collection(db, 'transactions'),
      where('householdId', '==', householdId),
      orderBy('date', 'desc')
    );

    const unsubscribeTransactions = onSnapshot(qTransactions, (snapshot) => {
      const transData = snapshot.docs.map(doc => doc.data() as Transaction);
      setTransactions(transData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
    });

    // Listen to credit_cards
    const qCreditCards = query(
      collection(db, 'credit_cards'),
      where('householdId', '==', householdId)
    );
    const unsubscribeCreditCards = onSnapshot(qCreditCards, (snapshot) => {
      const ccData = snapshot.docs.map(doc => doc.data() as CreditCard);
      setCreditCards(ccData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'credit_cards');
    });

    // Listen to recurring transactions
    const qRecurring = query(
      collection(db, 'recurring_transactions'),
      where('householdId', '==', householdId)
    );

    const unsubscribeRecurring = onSnapshot(qRecurring, (snapshot) => {
      const recurringData = snapshot.docs.map(doc => doc.data() as RecurringTransaction);
      setRecurringTransactions(recurringData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'recurring_transactions');
    });

    // Listen to categories
    const qCategories = query(
      collection(db, 'categories'),
      where('householdId', '==', householdId)
    );

    const unsubscribeCategories = onSnapshot(qCategories, async (snapshot) => {
      if (snapshot.empty) {
        // Initialize default categories
        for (const cat of DEFAULT_CATEGORIES) {
          const id = uuidv4();
          try {
            await safeSetDoc(doc(db, 'categories', id), {
              id,
              householdId,
              name: cat.name,
              color: cat.color,
              type: cat.type,
              isDefault: true
            });
          } catch (error) {
            console.error('Error initializing category:', error);
          }
        }
      } else {
        const catData = snapshot.docs.map(doc => doc.data() as Category);
        setCategories(catData);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'categories');
      setLoading(false);
    });

    // Listen to bank_accounts
    const qBankAccounts = query(
      collection(db, 'bank_accounts'),
      where('householdId', '==', householdId)
    );
    const unsubscribeBankAccounts = onSnapshot(qBankAccounts, (snapshot) => {
      const baData = snapshot.docs.map(doc => doc.data() as BankAccount);
      setBankAccounts(baData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bank_accounts');
    });

    return () => {
      unsubscribeTransactions();
      unsubscribeCategories();
      unsubscribeRecurring();
      unsubscribeCreditCards();
      unsubscribeBankAccounts();
    };
  }, [userProfile?.householdId]);

  // Handle Auto-Pay for Credit Card transactions on billingDate
  useEffect(() => {
    if (loading || !transactions.length || !creditCards.length || !bankAccounts.length) return;

    const processAutoPayments = async () => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const todayISO = today.toISOString();

      const toPay = transactions.filter(t => 
        t.status === 'pendente' && 
        t.paymentMethod === 'credito' && 
        t.type === 'despesa' &&
        t.recurrenceType !== 'assinatura' && // Subscriptions are manual
        t.recurrenceType !== 'fixa' &&        // Fixed costs are manual
        t.billingDate && t.billingDate <= todayISO
      );

      if (toPay.length === 0) return;

      const batch = writeBatch(db);
      const accountUpdates: Record<string, number> = {};

      for (const t of toPay) {
        const cc = creditCards.find(c => c.id === t.creditCardId);
        const accountId = cc?.bankAccountId;

        if (accountId) {
          batch.update(doc(db, 'transactions', t.id), { status: 'pago' });
          accountUpdates[accountId] = (accountUpdates[accountId] || 0) + t.amount;
        }
      }

      // Apply balance changes
      for (const [accId, total] of Object.entries(accountUpdates)) {
        batch.update(doc(db, 'bank_accounts', accId), {
          currentBalance: increment(-total)
        });
      }

      try {
        await batch.commit();
        console.log(`Auto-paid ${toPay.length} transactions`);
      } catch (error) {
        console.error('Error in Auto-Pay:', error);
      }
    };

    processAutoPayments();
  }, [loading, transactions.length, creditCards.length, bankAccounts.length]);

  // Auto-generate transactions for recurring ones in the selected month
  useEffect(() => {
    if (!userProfile?.householdId || loading) return;

    const generateRecurring = async () => {
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);
      const monthKey = format(selectedMonth, 'yyyy-MM');

      // Only generate for current or future months
      if (monthStart < startOfMonth(currentDate)) return;

      for (const rt of recurringTransactions) {
        const startDate = new Date(rt.startDate);
        if (startDate > monthEnd) continue;
        
        // Skip if this month is marked as skipped
        if (rt.skippedDates?.includes(monthKey)) continue;

        const alreadyExists = transactions.some(t => 
          t.recurringId === rt.id && 
          isSameMonth(parseISO(t.date), selectedMonth)
        );

        if (!alreadyExists) {
          const id = uuidv4();
          // Set date to the same day of the month as startDate or billingDay
          let transactionDate: Date;
          if (rt.billingDay) {
            transactionDate = getEffectiveDate(selectedMonth.getFullYear(), selectedMonth.getMonth(), rt.billingDay);
          } else {
            const startDate = new Date(rt.startDate);
            transactionDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), startDate.getDate());
          }
          // Find matching credit card if provided by recurrent entity (future support) or just undefined (graceful failover)
          const cc = creditCards.find(c => c.id === rt.creditCardId);
          const billingDate = calculateBillingDate(transactionDate.toISOString(), rt.paymentMethod, cc);

          try {
            await safeSetDoc(doc(db, 'transactions', id), {
              id,
              householdId: userProfile.householdId,
              amount: rt.amount,
              categoryId: rt.categoryId,
              date: transactionDate.toISOString(),
              billingDate: billingDate,
              description: rt.description,
              title: rt.title,
              type: rt.type,
              createdBy: rt.createdBy,
              status: 'pendente',
              paymentMethod: rt.paymentMethod,
              recurrenceType: rt.recurrenceType,
              recurringId: rt.id,
              bankAccountId: rt.bankAccountId || '',
              creditCardId: rt.creditCardId || '',
              paidBy: rt.paidBy
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `transactions/${id}`);
          }
        }
      }
    };

    generateRecurring();
  }, [selectedMonth, recurringTransactions, transactions.length, loading]);

  const addTransaction = async (transaction: Omit<Transaction, 'id' | 'householdId' | 'createdBy'> & { billingDay?: number }) => {
    if (!userProfile?.householdId || !userProfile.uid) return;
    
    const householdId = userProfile.householdId;
    const uid = userProfile.uid;
    const closingDay = userProfile.creditCardClosingDay;

    try {
      if (transaction.recurrenceType === 'fixa' || transaction.recurrenceType === 'assinatura') {
        const recurringId = uuidv4();
        const startDate = new Date(transaction.date);
        const billingDay = transaction.billingDay || startDate.getDate();

        // Resolve paidBy based on account/card ownership
        let resolvedMemberId = transaction.paidBy;
        const cc = creditCards.find(c => c.id === transaction.creditCardId);
        if (transaction.paymentMethod === 'credito' && cc) {
          resolvedMemberId = cc.memberId;
        } else if (transaction.bankAccountId) {
          const acc = bankAccounts.find(a => a.id === transaction.bankAccountId);
          if (acc) resolvedMemberId = acc.memberId;
        }

        await safeSetDoc(doc(db, 'recurring_transactions', recurringId), {
          id: recurringId,
          householdId,
          amount: transaction.amount,
          categoryId: transaction.categoryId,
          title: transaction.title,
          description: transaction.description,
          type: transaction.type,
          paymentMethod: transaction.paymentMethod,
          recurrenceType: transaction.recurrenceType,
          startDate: transaction.date,
          billingDay: billingDay,
          createdBy: uid,
          paidBy: resolvedMemberId,
          bankAccountId: transaction.bankAccountId || '',
          creditCardId: transaction.creditCardId || '',
        });

        // Also create the first instance
        const id = uuidv4();
        const billingDate = calculateBillingDate(transaction.date, transaction.paymentMethod, cc);
        await safeSetDoc(doc(db, 'transactions', id), {
          ...transaction,
          id,
          householdId,
          createdBy: uid,
          paidBy: resolvedMemberId,
          recurringId,
          billingDate,
          status: 'pendente', // Subscriptions always start as pending
        });
      } else if (transaction.recurrenceType === 'parcelada' && transaction.totalInstallments) {
        const recurringId = uuidv4();
        const baseDate = new Date(transaction.date);
        
        for (let i = 0; i < transaction.totalInstallments; i++) {
          const id = uuidv4();
          const installmentDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate());
          
          const cc = creditCards.find(c => c.id === transaction.creditCardId);
          const billingDate = calculateBillingDate(installmentDate.toISOString(), transaction.paymentMethod, cc);
          
          // Resolve paidBy based on account/card ownership
          let resolvedMemberId = transaction.paidBy;
          if (transaction.paymentMethod === 'credito' && cc) {
            resolvedMemberId = cc.memberId;
          } else if (transaction.bankAccountId) {
            const acc = bankAccounts.find(a => a.id === transaction.bankAccountId);
            if (acc) resolvedMemberId = acc.memberId;
          }

          await safeSetDoc(doc(db, 'transactions', id), {
            ...transaction,
            amount: transaction.amount / transaction.totalInstallments,
            id,
            householdId,
            createdBy: uid,
            paidBy: resolvedMemberId,
            date: installmentDate.toISOString(),
            billingDate,
            installmentNumber: i + 1,
            recurringId,
            status: 'pendente', // Installments (future) are pending
          });
        }
      } else {
        const id = uuidv4();
        const cc = creditCards.find(c => c.id === transaction.creditCardId);
        
        // Resolve paidBy based on account/card ownership
        let resolvedMemberId = transaction.paidBy;
        if (transaction.paymentMethod === 'credito' && cc) {
          resolvedMemberId = cc.memberId;
        } else if (transaction.bankAccountId) {
          const acc = bankAccounts.find(a => a.id === transaction.bankAccountId);
          if (acc) resolvedMemberId = acc.memberId;
        }

        const billingDate = calculateBillingDate(transaction.date, transaction.paymentMethod, cc);
        
        // Rules for status enforcement (only 'unica' reaches here)
        let finalStatus = transaction.status;
        if (transaction.paymentMethod === 'pix' || transaction.paymentMethod === 'dinheiro' || transaction.paymentMethod === 'debito') {
          finalStatus = 'pago';
        }

        await safeSetDoc(doc(db, 'transactions', id), {
          ...transaction,
          id,
          householdId,
          createdBy: uid,
          paidBy: resolvedMemberId,
          billingDate,
          status: finalStatus
        });

        if (finalStatus === 'pago') {
          const accountId = transaction.bankAccountId || (transaction.paymentMethod === 'credito' ? cc?.bankAccountId : undefined);
          if (accountId) {
            await adjustBalance(accountId, transaction.amount, transaction.type);
          }
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions');
    }
  };

  const updateTransaction = async (id: string, transaction: Partial<Transaction>, mode: 'unica' | 'futuras' | 'todos' = 'unica') => {
    if (!userProfile?.householdId) return;
    
    const original = transactions.find(t => t.id === id);
    if (!original) return;

    try {
      if (mode !== 'unica' && original.recurringId) {
        // Update template if it's fixed/subscription
        if (original.recurrenceType === 'fixa' || original.recurrenceType === 'assinatura') {
          await safeSetDoc(doc(db, 'recurring_transactions', original.recurringId), {
            amount: transaction.amount ?? original.amount,
            categoryId: transaction.categoryId ?? original.categoryId,
            title: transaction.title ?? original.title,
            description: transaction.description ?? original.description,
            paymentMethod: transaction.paymentMethod ?? original.paymentMethod,
            bankAccountId: transaction.bankAccountId ?? original.bankAccountId,
            paidBy: transaction.paidBy ?? original.paidBy,
          }, { merge: true });
        }

        // Update instances
        const targetTransactions = transactions.filter(t => {
          if (t.recurringId !== original.recurringId) return false;
          if (mode === 'futuras') return new Date(t.date) >= new Date(original.date);
          return true; // 'todos'
        });

        for (const t of targetTransactions) {
          const newDate = transaction.date ?? t.date;
          const newPaymentMethod = transaction.paymentMethod ?? t.paymentMethod;
          const newCreditCardId = transaction.creditCardId ?? t.creditCardId;
          const cc = creditCards.find(c => c.id === newCreditCardId);
          const billingDate = calculateBillingDate(newDate, newPaymentMethod, cc);

          // Handle balance for each instance if status or amount or account changed
          const isPaid = (transaction.status ?? t.status) === 'pago';
          const wasPaid = t.status === 'pago';
          const newAmount = transaction.amount ?? t.amount;
          const oldAmount = t.amount;
          const newAccountId = transaction.bankAccountId ?? (t.bankAccountId || (newPaymentMethod === 'credito' ? cc?.bankAccountId : undefined));
          const oldAccountId = t.bankAccountId || (t.paymentMethod === 'credito' ? creditCards.find(c => c.id === t.creditCardId)?.bankAccountId : undefined);

          if (wasPaid && (!isPaid || newAccountId !== oldAccountId)) {
            await adjustBalance(oldAccountId, oldAmount, t.type, true);
          }
          if (isPaid && (!wasPaid || newAccountId !== oldAccountId || newAmount !== oldAmount)) {
             const applyUndo = wasPaid && newAccountId === oldAccountId;
             await adjustBalance(newAccountId, applyUndo ? (newAmount - oldAmount) : newAmount, t.type);
          }

          // Resolve paidBy based on account/card ownership
          let resolvedMemberId = transaction.paidBy ?? t.paidBy;
          if (newPaymentMethod === 'credito' && cc) {
            resolvedMemberId = cc.memberId;
          } else if (newAccountId) {
            const acc = bankAccounts.find(a => a.id === newAccountId);
            if (acc) resolvedMemberId = acc.memberId;
          }

          await safeSetDoc(doc(db, 'transactions', t.id), {
            ...transaction,
            paidBy: resolvedMemberId,
            billingDate
          }, { merge: true });
        }
      } else {
        const newDate = transaction.date ?? original.date;
        const newPaymentMethod = transaction.paymentMethod ?? original.paymentMethod;
        const newCreditCardId = transaction.creditCardId ?? original.creditCardId;
        const cc = creditCards.find(c => c.id === newCreditCardId);
        const billingDate = calculateBillingDate(newDate, newPaymentMethod, cc);

        // Balance Logic for single update
        const isPaid = (transaction.status ?? original.status) === 'pago';
        const wasPaid = original.status === 'pago';
        const newAmount = transaction.amount ?? original.amount;
        const oldAmount = original.amount;
        const newAccountId = transaction.bankAccountId ?? (original.bankAccountId || (newPaymentMethod === 'credito' ? cc?.bankAccountId : undefined));
        const oldAccountId = original.bankAccountId || (original.paymentMethod === 'credito' ? creditCards.find(c => c.id === original.creditCardId)?.bankAccountId : undefined);

        if (wasPaid) {
          if (!isPaid || newAccountId !== oldAccountId) {
            // Revert old balance
            await adjustBalance(oldAccountId, oldAmount, original.type, true);
          }
        }
        
        if (isPaid) {
          if (!wasPaid || newAccountId !== oldAccountId) {
            // Apply new balance
            await adjustBalance(newAccountId, newAmount, original.type);
          } else if (newAmount !== oldAmount) {
            // Adjust difference
            await adjustBalance(newAccountId, newAmount - oldAmount, original.type);
          }
        }

        // Resolve paidBy based on account/card ownership
        let resolvedMemberId = transaction.paidBy ?? original.paidBy;
        if (newPaymentMethod === 'credito' && cc) {
          resolvedMemberId = cc.memberId;
        } else if (newAccountId) {
          const acc = bankAccounts.find(a => a.id === newAccountId);
          if (acc) resolvedMemberId = acc.memberId;
        }

        await safeSetDoc(doc(db, 'transactions', id), {
          ...transaction,
          paidBy: resolvedMemberId,
          billingDate
        }, { merge: true });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${id}`);
    }
  };

  const deleteTransaction = async (id: string, mode: 'unica' | 'futuras' | 'todos' = 'unica') => {
    if (!userProfile?.householdId) return;
    
    const transactionToDelete = transactions.find(t => t.id === id);
    if (!transactionToDelete) return;

    try {
      if (transactionToDelete.recurringId) {
        const rt = recurringTransactions.find(r => r.id === transactionToDelete.recurringId);
        
        if (mode === 'unica') {
          // If it's a fixed/subscription, mark this month as skipped in the template
          if (rt && (rt.recurrenceType === 'fixa' || rt.recurrenceType === 'assinatura')) {
            const monthKey = format(new Date(transactionToDelete.date), 'yyyy-MM');
            const newSkipped = [...(rt.skippedDates || []), monthKey];
          await safeSetDoc(doc(db, 'recurring_transactions', rt.id), { skippedDates: newSkipped }, { merge: true });
          }
          if (transactionToDelete.status === 'pago') {
            const cc = creditCards.find(c => c.id === transactionToDelete.creditCardId);
            const accountId = transactionToDelete.bankAccountId || (transactionToDelete.paymentMethod === 'credito' ? cc?.bankAccountId : undefined);
            await adjustBalance(accountId, transactionToDelete.amount, transactionToDelete.type, true);
          }
          await deleteDoc(doc(db, 'transactions', id));
        } else {
          // Delete template if it's 'todos' or if we are deleting all future and it's fixed/subscription
          if (mode === 'todos' || (mode === 'futuras' && (transactionToDelete.recurrenceType === 'fixa' || transactionToDelete.recurrenceType === 'assinatura'))) {
            await deleteDoc(doc(db, 'recurring_transactions', transactionToDelete.recurringId)).catch(() => {});
          }

          const targetTransactions = transactions.filter(t => {
            if (t.recurringId !== transactionToDelete.recurringId) return false;
            if (mode === 'futuras') return new Date(t.date) >= new Date(transactionToDelete.date);
            return true; // 'todos'
          });

          for (const t of targetTransactions) {
            if (t.status === 'pago') {
              const cc = creditCards.find(c => c.id === t.creditCardId);
              const accountId = t.bankAccountId || (t.paymentMethod === 'credito' ? cc?.bankAccountId : undefined);
              await adjustBalance(accountId, t.amount, t.type, true);
            }
            await deleteDoc(doc(db, 'transactions', t.id));
          }
        }
      } else {
        if (transactionToDelete.status === 'pago') {
          const cc = creditCards.find(c => c.id === transactionToDelete.creditCardId);
          const accountId = transactionToDelete.bankAccountId || (transactionToDelete.paymentMethod === 'credito' ? cc?.bankAccountId : undefined);
          await adjustBalance(accountId, transactionToDelete.amount, transactionToDelete.type, true);
        }
        await deleteDoc(doc(db, 'transactions', id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
    }
  };

  const updateRecurringTransaction = async (id: string, transaction: Partial<RecurringTransaction>, mode: 'este_mes' | 'futuras' = 'futuras') => {
    if (!userProfile?.householdId) return;
    try {
      const rt = recurringTransactions.find(r => r.id === id);
      if (!rt) return;

      if (mode === 'futuras') {
        await safeSetDoc(doc(db, 'recurring_transactions', id), transaction, { merge: true });
      }
      
      const closingDay = userProfile.creditCardClosingDay;

      // Update instances based on mode
      const targetTransactions = transactions.filter(t => {
        if (t.recurringId !== id) return false;
        const tDate = parseISO(t.date);
        
        if (mode === 'este_mes') {
          return isSameMonth(tDate, currentDate);
        } else {
          // Future mode: update current month if pending, and all future months
          const isCurrentMonth = isSameMonth(tDate, currentDate);
          const isFutureMonth = tDate > currentDate;
          
          if (isCurrentMonth) {
            return t.status === 'pendente';
          }
          return isFutureMonth;
        }
      });

      for (const t of targetTransactions) {
        let newDate = t.date;
        if (transaction.billingDay) {
          const tDateObj = parseISO(t.date);
          const effectiveDate = getEffectiveDate(tDateObj.getFullYear(), tDateObj.getMonth(), transaction.billingDay);
          newDate = effectiveDate.toISOString();
        }

        const newPaymentMethod = transaction.paymentMethod ?? t.paymentMethod;
        
        // Em atualizações recorrentes para multiplos cartões o t suportará creditCardId
        const creditCardId = (transaction as any).creditCardId ?? (t as any).creditCardId;
        const cc = creditCards.find(c => c.id === creditCardId);
        
        const billingDate = calculateBillingDate(newDate, newPaymentMethod, cc);

        await safeSetDoc(doc(db, 'transactions', t.id), {
          amount: transaction.amount,
          categoryId: transaction.categoryId,
          description: transaction.description,
          paymentMethod: transaction.paymentMethod,
          date: newDate,
          billingDate: billingDate
        }, { merge: true });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `recurring_transactions/${id}`);
    }
  };

  const deleteRecurringTransaction = async (id: string) => {
    if (!userProfile?.householdId) return;
    try {
      // First, find all instances to delete before deleting the template
      const targetTransactions = transactions.filter(t => {
        if (t.recurringId !== id) return false;
        const tDate = parseISO(t.date);
        const isCurrentMonth = isSameMonth(tDate, currentDate);
        const isFutureMonth = tDate > currentDate;
        
        if (isCurrentMonth) {
          return t.status === 'pendente';
        }
        return isFutureMonth;
      });

      // Delete the template
      await deleteDoc(doc(db, 'recurring_transactions', id));
      
      // Delete the instances
      for (const t of targetTransactions) {
        await deleteDoc(doc(db, 'transactions', t.id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `recurring_transactions/${id}`);
    }
  };

  const recalculateRecurring = async () => {
    if (!userProfile?.householdId || !userProfile.uid) return;
    
    try {
      const closingDay = userProfile.creditCardClosingDay;

      // 1. Find and remove orphans (transactions with recurringId but no RT)
      const orphans = transactions.filter(t => 
        t.recurringId && !recurringTransactions.some(rt => rt.id === t.recurringId)
      );
      
      for (const t of orphans) {
        const tDate = parseISO(t.date);
        // Only remove if it's current or future month and pending
        if ((isSameMonth(tDate, currentDate) || tDate > currentDate) && t.status === 'pendente') {
          await deleteDoc(doc(db, 'transactions', t.id));
        }
      }

      // 2. Sync existing RTs with their transactions for current and future months
      // We check the current month and the next 12 months
      for (let i = 0; i <= 12; i++) {
        const targetMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
        const monthKey = format(targetMonth, 'yyyy-MM');
        const monthStart = startOfMonth(targetMonth);
        const monthEnd = endOfMonth(targetMonth);

        for (const rt of recurringTransactions) {
          const startDate = new Date(rt.startDate);
          if (startDate > monthEnd) continue;
          if (rt.skippedDates?.includes(monthKey)) continue;

          const instance = transactions.find(t => 
            t.recurringId === rt.id && 
            isSameMonth(parseISO(t.date), targetMonth)
          );

          if (instance) {
            // Update if pending and values don't match
            if (instance.status === 'pendente') {
              let newDate = instance.date;
              if (rt.billingDay) {
                const effectiveDate = getEffectiveDate(targetMonth.getFullYear(), targetMonth.getMonth(), rt.billingDay);
                newDate = effectiveDate.toISOString();
              }

              // Fetch creditCard (in recurrence template fallback to dynamic approach)
              const ccId = (instance as any).creditCardId || (rt as any).creditCardId;
              const cc = creditCards.find(c => c.id === ccId);
              const billingDate = calculateBillingDate(newDate, rt.paymentMethod, cc);

              if (instance.amount !== rt.amount || 
                  instance.description !== rt.description ||
                  instance.categoryId !== rt.categoryId ||
                  instance.paymentMethod !== rt.paymentMethod ||
                  instance.date !== newDate ||
                  instance.billingDate !== billingDate) {
                await safeSetDoc(doc(db, 'transactions', instance.id), {
                  amount: rt.amount,
                  description: rt.description,
                  categoryId: rt.categoryId,
                  paymentMethod: rt.paymentMethod,
                  date: newDate,
                  billingDate: billingDate
                }, { merge: true });
              }
            }
            // Create missing instance
            const id = uuidv4();
            let transactionDate: Date;
            if (rt.billingDay) {
              transactionDate = getEffectiveDate(targetMonth.getFullYear(), targetMonth.getMonth(), rt.billingDay);
            } else {
              transactionDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), startDate.getDate());
            }
            
            const ccId = (rt as any).creditCardId;
            const cc = creditCards.find(c => c.id === ccId);
            const billingDate = calculateBillingDate(transactionDate.toISOString(), rt.paymentMethod, cc);

            await safeSetDoc(doc(db, 'transactions', id), {
              id,
              householdId: userProfile.householdId,
              amount: rt.amount,
              categoryId: rt.categoryId,
              date: transactionDate.toISOString(),
              billingDate: billingDate,
              description: rt.description,
              type: rt.type,
              createdBy: rt.createdBy,
              status: 'pendente',
              paymentMethod: rt.paymentMethod,
              recurrenceType: rt.recurrenceType,
              recurringId: rt.id
            });
          }

          // [CLEANUP] Remove existing duplicates for this month if found
          const monthInstances = transactions.filter(t => 
            t.recurringId === rt.id && 
            isSameMonth(parseISO(t.date), targetMonth)
          );
          
          if (monthInstances.length > 1) {
            const paidOne = monthInstances.find(t => t.status === 'pago');
            if (paidOne) {
              for (const t of monthInstances) {
                if (t.id !== paidOne.id && t.status === 'pendente') {
                  await deleteDoc(doc(db, 'transactions', t.id)).catch(() => {});
                }
              }
            } else {
              // Keep only the first one
              for (let d = 1; d < monthInstances.length; d++) {
                await deleteDoc(doc(db, 'transactions', monthInstances[d].id)).catch(() => {});
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error recalculating recurring transactions:', error);
      throw error;
    }
  };

  const addCategory = async (category: Omit<Category, 'id' | 'householdId' | 'isDefault'>) => {
    if (!userProfile?.householdId) return;
    const id = uuidv4();
    try {
      await safeSetDoc(doc(db, 'categories', id), {
        ...category,
        id,
        householdId: userProfile.householdId,
        isDefault: false,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `categories/${id}`);
    }
  };

  const updateCategory = async (id: string, category: Partial<Category>) => {
    if (!userProfile?.householdId) return;
    try {
      await safeSetDoc(doc(db, 'categories', id), category, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `categories/${id}`);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!userProfile?.householdId) return;
    
    // Check if category is in use
    const inUse = transactions.some(t => t.categoryId === id);
    if (inUse) {
      throw new Error('Esta categoria está sendo usada em transações e não pode ser excluída.');
    }

    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
    }
  };

  const addCreditCard = async (card: Omit<CreditCard, 'id' | 'householdId'>) => {
    if (!userProfile?.householdId) return;
    const id = uuidv4();
    try {
      await safeSetDoc(doc(db, 'credit_cards', id), {
        ...card,
        id,
        householdId: userProfile.householdId,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `credit_cards/${id}`);
    }
  };

  const updateCreditCard = async (id: string, card: Partial<CreditCard>) => {
    if (!userProfile?.householdId) return;
    try {
      const docRef = doc(db, 'credit_cards', id);
      await updateDoc(docRef, card);
      
      // If closingDay or exceptions changed, recalculate all transactions for this card
      if (card.closingDay !== undefined || card.closingDayExceptions !== undefined) {
        await recalculateTransactionsForCard(id, card);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `credit_cards/${id}`);
    }
  };

  const recalculateTransactionsForCard = async (cardId: string, updatedCardData?: Partial<CreditCard>, monthKey?: string) => {
    if (!userProfile?.householdId) return;
    
    try {
      const cardInState = creditCards.find(c => c.id === cardId);
      if (!cardInState) return;

      // Usamos os dados atualizados para evitar problemas de "stale state"
      const card = { ...cardInState, ...updatedCardData };

      const targetTransactions = transactions.filter(t => {
        if (t.creditCardId !== cardId) return false;
        if (monthKey) {
          return format(parseISO(t.date), 'yyyy-MM') === monthKey;
        }
        return true;
      });

      if (targetTransactions.length === 0) return;

      const batch = writeBatch(db);
      let hasChanges = false;

      for (const t of targetTransactions) {
        const newBillingDate = calculateBillingDate(t.date, t.paymentMethod, card);
        if (newBillingDate !== t.billingDate) {
          batch.update(doc(db, 'transactions', t.id), {
            billingDate: newBillingDate
          });
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await batch.commit();
        console.log(`✅ Recalculated ${targetTransactions.length} transactions for card ${card.name}`);
      }
    } catch (error) {
      console.error('Error recalculating card transactions:', error);
    }
  };

  const deleteCreditCard = async (id: string) => {
    if (!userProfile?.householdId) return;
    try {
      await deleteDoc(doc(db, 'credit_cards', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `credit_cards/${id}`);
    }
  };

  const addBankAccount = async (account: Omit<BankAccount, 'id' | 'householdId' | 'currentBalance'>) => {
    if (!userProfile?.householdId) return;
    const id = uuidv4();
    try {
      await safeSetDoc(doc(db, 'bank_accounts', id), {
        ...account,
        id,
        householdId: userProfile.householdId,
        currentBalance: account.initialBalance
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bank_accounts/${id}`);
    }
  };

  const updateBankAccount = async (id: string, account: Partial<BankAccount>) => {
    if (!userProfile?.householdId) return;
    try {
      const original = bankAccounts.find(a => a.id === id);
      if (account.initialBalance !== undefined && original) {
        const diff = account.initialBalance - original.initialBalance;
        account.currentBalance = (original.currentBalance || original.initialBalance) + diff;
      }
      await safeSetDoc(doc(db, 'bank_accounts', id), account, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bank_accounts/${id}`);
    }
  };

  const deleteBankAccount = async (id: string) => {
    if (!userProfile?.householdId) return;
    try {
      await deleteDoc(doc(db, 'bank_accounts', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `bank_accounts/${id}`);
    }
  };

  const restoreRecurringInstance = async (rtId: string, monthKey: string) => {
    if (!userProfile?.householdId) return;
    try {
      const rt = recurringTransactions.find(r => r.id === rtId);
      if (!rt) return;

      const newSkipped = (rt.skippedDates || []).filter(date => date !== monthKey);
      await safeSetDoc(doc(db, 'recurring_transactions', rtId), { skippedDates: newSkipped }, { merge: true });
      
      // Recalculate to trigger immediate creation
      await recalculateRecurring();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `recurring_transactions/${rtId}`);
    }
  };

  const importTransactions = async (bankAccountId: string, file: File): Promise<{ added: number, skipped: number }> => {
    if (!userProfile?.householdId) throw new Error('Família não identificada.');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('bankAccountId', bankAccountId);
    formData.append('householdId', userProfile.householdId);
    formData.append('uid', userProfile.uid);

    const response = await fetch('/api/transactions/import', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao importar transações.');
    }

    return await response.json();
  };

  return (
    <FinanceContext.Provider value={{ 
      transactions, 
      categories, 
      creditCards, 
      bankAccounts,
      recurringTransactions, 
      loading, 
      currentDate, 
      selectedMonth, 
      setSelectedMonth,
      includePending,
      setIncludePending,
      addCreditCard,
      updateCreditCard,
      deleteCreditCard,
      addBankAccount,
      updateBankAccount,
      deleteBankAccount,
      recalculateTransactionsForCard,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      updateRecurringTransaction,
      deleteRecurringTransaction,
      recalculateRecurring,
      restoreRecurringInstance,
      addCategory,
      updateCategory,
      deleteCategory,
      importTransactions
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (context === undefined) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
