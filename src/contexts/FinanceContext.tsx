import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc, orderBy, getDocFromServer } from 'firebase/firestore';
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
  description: string;
  type: 'receita' | 'despesa';
  createdBy: string;
  status: 'pendente' | 'pago';
  paymentMethod: 'pix' | 'credito' | 'debito' | 'dinheiro';
  recurrenceType: 'unica' | 'parcelada' | 'fixa' | 'assinatura';
  installmentNumber?: number;
  totalInstallments?: number;
  recurringId?: string;
  parentTransactionId?: string;
  creditCardId?: string;
}

export interface CreditCard {
  id: string;
  householdId: string;
  name: string;
  closingDay: number;
  dueDay: number;
}

export interface RecurringTransaction {
  id: string;
  householdId: string;
  amount: number;
  categoryId: string;
  description: string;
  type: 'receita' | 'despesa';
  paymentMethod: 'pix' | 'credito' | 'debito' | 'dinheiro';
  recurrenceType: 'fixa' | 'assinatura';
  startDate: string;
  billingDay?: number; // Specific day of the month for billing
  createdBy: string;
  skippedDates?: string[]; // ISO strings of the months (YYYY-MM) that were skipped
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
  addTransaction: (transaction: Omit<Transaction, 'id' | 'householdId' | 'createdBy'> & { billingDay?: number }) => Promise<void>;
  updateTransaction: (id: string, transaction: Partial<Transaction>, mode?: 'unica' | 'futuras' | 'todos') => Promise<void>;
  deleteTransaction: (id: string, mode?: 'unica' | 'futuras' | 'todos') => Promise<void>;
  updateRecurringTransaction: (id: string, transaction: Partial<RecurringTransaction>, mode?: 'este_mes' | 'futuras') => Promise<void>;
  deleteRecurringTransaction: (id: string) => Promise<void>;
  recalculateRecurring: () => Promise<void>;
  addCategory: (category: Omit<Category, 'id' | 'householdId' | 'isDefault'>) => Promise<void>;
  updateCategory: (id: string, category: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
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

  const { closingDay, dueDay } = creditCard;
  const transactionDay = date.getDate();
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-based

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
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate] = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));
  const [includePending, setIncludePending] = useState(true);

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

    return () => {
      unsubscribeTransactions();
      unsubscribeCategories();
      unsubscribeRecurring();
      unsubscribeCreditCards();
    };
  }, [userProfile?.householdId]);

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
          isSameMonth(parseISO(t.billingDate || t.date), selectedMonth)
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
          const cc = creditCards.find(c => c.id === (rt as any).creditCardId);
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
              type: rt.type,
              createdBy: rt.createdBy,
              status: 'pendente',
              paymentMethod: rt.paymentMethod,
              recurrenceType: rt.recurrenceType,
              recurringId: rt.id
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

        await safeSetDoc(doc(db, 'recurring_transactions', recurringId), {
          id: recurringId,
          householdId,
          amount: transaction.amount,
          categoryId: transaction.categoryId,
          description: transaction.description,
          type: transaction.type,
          paymentMethod: transaction.paymentMethod,
          recurrenceType: transaction.recurrenceType,
          startDate: transaction.date,
          billingDay: billingDay,
          createdBy: uid,
        });
        
        // Also create the first instance
        const id = uuidv4();
        const cc = creditCards.find(c => c.id === transaction.creditCardId);
        const billingDate = calculateBillingDate(transaction.date, transaction.paymentMethod, cc);
        await safeSetDoc(doc(db, 'transactions', id), {
          ...transaction,
          id,
          householdId,
          createdBy: uid,
          recurringId,
          billingDate,
        });
      } else if (transaction.recurrenceType === 'parcelada' && transaction.totalInstallments) {
        const recurringId = uuidv4();
        const baseDate = new Date(transaction.date);
        
        for (let i = 0; i < transaction.totalInstallments; i++) {
          const id = uuidv4();
          const installmentDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, baseDate.getDate());
          
          const cc = creditCards.find(c => c.id === transaction.creditCardId);
          const billingDate = calculateBillingDate(installmentDate.toISOString(), transaction.paymentMethod, cc);
          
          await safeSetDoc(doc(db, 'transactions', id), {
            ...transaction,
            id,
            householdId,
            createdBy: uid,
            date: installmentDate.toISOString(),
            billingDate,
            installmentNumber: i + 1,
            recurringId,
            status: i === 0 ? transaction.status : 'pendente',
          });
        }
      } else {
        const id = uuidv4();
        const cc = creditCards.find(c => c.id === transaction.creditCardId);
        const billingDate = calculateBillingDate(transaction.date, transaction.paymentMethod, cc);
        await safeSetDoc(doc(db, 'transactions', id), {
          ...transaction,
          id,
          householdId,
          createdBy: uid,
          billingDate,
        });
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
            description: transaction.description ?? original.description,
            paymentMethod: transaction.paymentMethod ?? original.paymentMethod,
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

          await safeSetDoc(doc(db, 'transactions', t.id), {
            ...transaction,
            billingDate
          }, { merge: true });
        }
      } else {
        const newDate = transaction.date ?? original.date;
        const newPaymentMethod = transaction.paymentMethod ?? original.paymentMethod;
        const newCreditCardId = transaction.creditCardId ?? original.creditCardId;
        const cc = creditCards.find(c => c.id === newCreditCardId);
        const billingDate = calculateBillingDate(newDate, newPaymentMethod, cc);

        await safeSetDoc(doc(db, 'transactions', id), {
          ...transaction,
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
            await deleteDoc(doc(db, 'transactions', t.id));
          }
        }
      } else {
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
            isSameMonth(parseISO(t.billingDate || t.date), targetMonth)
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
          } else {
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
      await safeSetDoc(doc(db, 'credit_cards', id), { ...card }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `credit_cards/${id}`);
    }
  };

  const deleteCreditCard = async (id: string) => {
    if (!userProfile?.householdId) return;
    try {
      // Opcional: checar se está atrelado a faturas antes de deletar
      await deleteDoc(doc(db, 'credit_cards', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `credit_cards/${id}`);
    }
  };

  return (
    <FinanceContext.Provider value={{ 
      transactions, 
      categories, 
      creditCards,
      recurringTransactions,
      loading, 
      currentDate,
      selectedMonth, 
      setSelectedMonth, 
      includePending,
      setIncludePending,
      addTransaction, 
      updateTransaction, 
      deleteTransaction, 
      updateRecurringTransaction,
      deleteRecurringTransaction,
      recalculateRecurring,
      addCategory,
      updateCategory,
      deleteCategory,
      addCreditCard,
      updateCreditCard,
      deleteCreditCard
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
