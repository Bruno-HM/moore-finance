import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFinance } from '../contexts/FinanceContext';
import { Button } from '../components/ui/button';
import { RefreshCw, TrendingUp, Receipt, LayoutGrid, Sparkles, ArrowUpRight } from 'lucide-react';
import { format, isSameMonth, parseISO, addMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { MonthSelector } from '../components/MonthSelector';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import TransactionModal from '../components/TransactionModal';
import CategoryDetailModal from '../components/CategoryDetailModal';
import { Transaction } from '../contexts/FinanceContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { householdMembers } = useAuth();
  const {
    includePending, transactions, categories,
    selectedMonth, recalculateRecurring,
    bankAccounts, updateTransaction
  } = useFinance();
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isCategoryDetailOpen, setIsCategoryDetailOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);

  const combinedSalary = useMemo(() => {
    return householdMembers.reduce((sum, member) => sum + (member.salary || 0), 0);
  }, [householdMembers]);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      if (recalculateRecurring) {
        await recalculateRecurring();
        toast.success('Valores sincronizados!');
      }
    } catch (error) {
      toast.error('Erro ao recalcular valores.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const [showWithPending, setShowWithPending] = useState(true);

  const { totalIncome, totalExpenses, totalPending, expensesByCategoryPaid, expensesByCategoryAll, monthlyExpensesList } = useMemo(() => {
    let income = 0;
    let expenses = 0;
    let pending = 0;
    const categoryTotalsPaid: Record<string, number> = {};
    const categoryTotalsAll: Record<string, number> = {};
    const list: any[] = [];

    if (!transactions) return { totalIncome: 0, totalExpenses: 0, totalPending: 0, expensesByCategoryPaid: [], expensesByCategoryAll: [], monthlyExpensesList: [] };

    transactions.forEach(t => {
      try {
        const dateStr = t.billingDate || t.date;
        if (!dateStr) return;
        const billingDate = parseISO(dateStr);
        if (isSameMonth(billingDate, selectedMonth)) {
          // A transaction is recurrent if it has a recurringId OR a recurrent recurrenceType
          const isRecurrent = !!t.recurringId || t.recurrenceType === 'fixa' || t.recurrenceType === 'assinatura';
          const amount = Math.abs(Number(t.amount || 0));

          if (t.type === 'receita') {
            if (t.status === 'pago') {
              income += amount;
            }
          } else {
            // Include in the main list if it's NOT recurrent OR if it's a PAID recurrent item
            // This ensures the list items sum up to the Total Expenses
            if (!isRecurrent || t.status === 'pago') {
              list.push(t);
            }

            // For the CATEGORY total "all" version (which includes pending)
            categoryTotalsAll[t.categoryId] = (categoryTotalsAll[t.categoryId] || 0) + amount;

            if (t.status === 'pago') {
              expenses += amount;
              categoryTotalsPaid[t.categoryId] = (categoryTotalsPaid[t.categoryId] || 0) + amount;
            } else {
              pending += amount;
            }
          }
        }
      } catch (e) {
        console.error("Error processing transaction for dashboard:", t, e);
      }
    });

    const mapCategories = (totals: Record<string, number>) =>
      Object.entries(totals).map(([categoryId, value]) => {
        const category = categories.find(c => c.id === categoryId);
        return { name: category?.name || 'Outros', value, color: category?.color || '#333' };
      }).sort((a, b) => b.value - a.value);

    return {
      totalIncome: income,
      totalExpenses: expenses,
      totalPending: pending,
      expensesByCategoryPaid: mapCategories(categoryTotalsPaid),
      expensesByCategoryAll: mapCategories(categoryTotalsAll),
      monthlyExpensesList: list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    };
  }, [transactions, categories, selectedMonth]);

  const displayedTotal = showWithPending ? totalExpenses + totalPending : totalExpenses;
  const displayedCategories = showWithPending ? expensesByCategoryAll : expensesByCategoryPaid;

  // Real Money = Sum of all bank accounts
  const totalEquity = (bankAccounts || []).reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

  // Monthly Impact = (Income + Salary) - Expenses (shows if current month is surplus or deficit)
  const monthlyImpact = (totalIncome + combinedSalary) - totalExpenses;

  // Potential Monthly Impact for the SELECTED month
  // NOTE: We don't add combinedSalary to the current month's projection if it's already passed/started 
  // because the money is likely already in the bank accounts (totalEquity).
  // But for FUTURE months, the salary is a new expected inflow.
  const isSelectedCurrent = isSameMonth(selectedMonth, new Date());

  const potentialMonthlyImpact = (totalIncome + (isSelectedCurrent ? 0 : combinedSalary)) - (totalExpenses + totalPending);

  // USER'S CUMULATIVE FORECAST LOGIC
  const nextMonthProjectedTotal = useMemo(() => {
    if (!transactions) return totalEquity;

    const today = startOfMonth(new Date());
    const targetMonth = startOfMonth(selectedMonth);

    // If looking at current or past, just show current equity
    if (targetMonth <= today) return totalEquity;

    // 1. Calculate how much will be left at the end of THE CURRENT MONTH
    // We take today's balance and subtract ONLY what is still PENDING for this month
    // because "Paid" items are already gone from totalEquity.
    let todayPendingExpenses = 0;
    transactions.forEach(t => {
      const dateStr = t.billingDate || t.date;
      if (!dateStr) return;
      const tDate = parseISO(dateStr);
      if (isSameMonth(tDate, today) && t.type === 'despesa' && t.status === 'pendente') {
        todayPendingExpenses += Math.abs(Number(t.amount || 0));
      }
    });

    // Starting balance for the next month chain (Projected End of Current Month)
    let rollingBalance = totalEquity - todayPendingExpenses;

    // 2. Iterate from the month AFTER today up to targetMonth
    let currentIterMonth = addMonths(today, 1);

    while (currentIterMonth <= targetMonth) {
      let monthIncome = 0;
      let monthExpenses = 0;

      transactions.forEach(t => {
        const dateStr = t.billingDate || t.date;
        if (!dateStr) return;
        const tDate = parseISO(dateStr);

        if (isSameMonth(tDate, currentIterMonth)) {
          const amount = Math.abs(Number(t.amount || 0));
          if (t.type === 'receita') {
            monthIncome += amount;
          } else {
            // Only subtract expenses if it's NOT the target month
            // User wants the "Start of Month" balance (Income + Salary - Previous Month Expenses)
            if (currentIterMonth < targetMonth) {
              monthExpenses += amount;
            }
          }
        }
      });

      rollingBalance += (monthIncome + combinedSalary) - monthExpenses;
      currentIterMonth = addMonths(currentIterMonth, 1);
    }

    return rollingBalance;
  }, [transactions, selectedMonth, totalEquity, combinedSalary]);

  const nextMonthDate = addMonths(new Date(), 1);
  const isFutureMonth = startOfMonth(selectedMonth) > startOfMonth(new Date());
  const isNextMonth = isSameMonth(selectedMonth, nextMonthDate);
  const nextMonthNameLabel = format(selectedMonth, 'MMMM', { locale: ptBR });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatParts = (value: number) => {
    const formatted = formatCurrency(value);
    const parts = formatted.includes(',') ? formatted.split(',') : [formatted, '00'];
    return parts;
  };

  const pendingRecurrent = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter(t => {
      try {
        const dateStr = t.billingDate || t.date;
        if (!dateStr) return false;
        const matchesMonth = isSameMonth(parseISO(dateStr), selectedMonth);
        const isRecurrent = !!t.recurringId || t.recurrenceType === 'fixa' || t.recurrenceType === 'assinatura';
        return matchesMonth && isRecurrent && t.status === 'pendente';
      } catch (e) { return false; }
    }).sort((a, b) => {
      const dateA = new Date(a.billingDate || a.date).getTime();
      const dateB = new Date(b.billingDate || b.date).getTime();
      return dateA - dateB;
    });
  }, [transactions, selectedMonth]);

  const handlePayTransaction = async (t: any) => {
    try {
      // Find the bank account: either from the transaction itself, or from the linked credit card
      let accountId = t.bankAccountId;
      if (!accountId && t.creditCardId) {
        const cc = (transactions as any[]).find(tx => tx.creditCardId === t.creditCardId);
        // Fallback: look in creditCards if available from context
      }
      if (!accountId) {
        // Fallback: use the first bank account as default for PIX/dinheiro payments
        const { bankAccounts: accounts } = { bankAccounts };
        if (accounts && accounts.length > 0) {
          accountId = accounts[0].id;
        }
      }
      await updateTransaction(t.id, { status: 'pago', bankAccountId: accountId });
      toast.success('Pagamento registrado!');
    } catch (error) {
      toast.error('Erro ao pagar.');
    }
  };

  const handleEditTransaction = (t: Transaction) => {
    setEditingTransaction(t);
    setIsTransactionModalOpen(true);
  };

  const handleCategoryClick = (cat: any) => {
    const categoryData = categories.find(c => c.name === cat.name);
    if (!categoryData) return;

    setSelectedCategory(categoryData);
    setIsCategoryDetailOpen(true);
  };

  const categoryTransactions = useMemo(() => {
    if (!selectedCategory || !transactions) return [];
    return transactions.filter(t => {
      const dateStr = t.billingDate || t.date;
      if (!dateStr) return false;
      const matchesMonth = isSameMonth(parseISO(dateStr), selectedMonth);
      const isRecurrent = !!t.recurringId || t.recurrenceType === 'fixa' || t.recurrenceType === 'assinatura';
      const matchesCategory = t.categoryId === selectedCategory.id;

      // Mirror the filtering logic from the summary
      if (showWithPending) {
        return matchesMonth && matchesCategory;
      }
      return matchesMonth && matchesCategory && t.status === 'pago';
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, selectedCategory, selectedMonth, showWithPending]);

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      {/* Header & Month Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-white mb-1">Fluxo de Caixa</h2>
          <p className="text-white/40 text-sm font-medium">Situação financeira e movimentações do período.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className="h-9 px-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">Sincronizar</span>
          </Button>
          <MonthSelector />
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expenses Summary Card */}
        <div className="pluggy-card p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-rose-500/10 flex items-center justify-center">
                <TrendingUp className="w-3 h-3 text-rose-500 rotate-180" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Total Despesas</span>
            </div>
            <button
              onClick={() => setShowWithPending(!showWithPending)}
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 transition-all border border-white/5"
            >
              <span className={`text-[8px] font-black uppercase tracking-widest transition-colors ${showWithPending ? 'text-amber-400' : 'text-white/20'}`}>Todos</span>
              <span className="text-[8px] font-black text-white/10">/</span>
              <span className={`text-[8px] font-black uppercase tracking-widest transition-colors ${!showWithPending ? 'text-white' : 'text-white/20'}`}>Pagos</span>
            </button>
          </div>

          <div className="mb-10">
            <div className={`text-6xl font-black leading-none mb-3 tracking-tighter transition-colors ${showWithPending ? 'text-amber-400' : 'text-rose-400'}`}>
              {formatParts(displayedTotal)[0]}<span className="text-2xl opacity-40">,{formatParts(displayedTotal)[1]}</span>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">{displayedCategories.length} categorias ativas</p>
              {!showWithPending && totalPending > 0 && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 uppercase tracking-widest">
                  + {formatCurrency(totalPending)} pendente
                </span>
              )}
            </div>
          </div>

          <div className="space-y-5">
            {displayedCategories.length > 0 ? (
              displayedCategories.slice(0, 6).map((cat, i) => (
                <div
                  key={i}
                  className="space-y-2 group cursor-pointer active:scale-[0.98] transition-all"
                  onClick={() => handleCategoryClick(cat)}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-white/50 group-hover:text-primary transition-colors uppercase tracking-wider">{cat.name}</span>
                    <span className="text-white/30">{formatCurrency(cat.value)}</span>
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(cat.value / (displayedTotal || 1)) * 100}%` }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="h-40 flex flex-col items-center justify-center gap-3 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
                <Receipt className="w-5 h-5 text-white/5" />
                <span className="text-[10px] font-black uppercase text-white/10 tracking-widest">Nenhuma despesa</span>
              </div>
            )}
          </div>
        </div>

        {/* Future/Balance Card & Secondary Info */}
        <div className="space-y-6">
          <div className="pluggy-card p-8">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Total em Contas</span>
            </div>
            <div className="text-4xl font-black text-white mb-2 tracking-tight">
              {formatCurrency(totalEquity)}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${monthlyImpact >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                  Impacto do Mês: <span className={monthlyImpact >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {monthlyImpact >= 0 ? '+' : ''}{formatCurrency(monthlyImpact)}
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Dinheiro Acumulado</span>
                <span className="text-[10px] font-medium text-white/40 italic">Inclui saldos anteriores</span>
              </div>
              {totalPending > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Projeção (com pendentes)</span>
                  <span className="text-sm font-black text-amber-400">
                    {formatCurrency(totalEquity - (isSelectedCurrent ? totalPending : (totalExpenses + totalPending - (totalIncome + combinedSalary))))}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Future Forecast Card - Shows when ANY future month is selected */}
          {isFutureMonth && (
            <div className="pluggy-card p-6 bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border-indigo-500/20 shadow-xl shadow-indigo-500/5 group animate-in zoom-in-95 duration-500">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Saldo Inicial Estimado</p>
                    <p className="text-xs font-bold text-white capitalize">{nextMonthNameLabel}</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-indigo-500/20 transition-all">
                  <ArrowUpRight className="w-4 h-4 text-white/30 group-hover:text-indigo-400" />
                </div>
              </div>

              <div className="text-2xl font-black text-white mb-3 flex items-baseline gap-1">
                <span>{formatParts(nextMonthProjectedTotal)[0]}</span>
                <span className="text-sm opacity-40">,{formatParts(nextMonthProjectedTotal)[1]}</span>
              </div>

              <p className="text-[10px] leading-relaxed text-white/40 font-medium italic">
                Previsão de quanto você terá disponível em {nextMonthNameLabel} (Saldo + Salário) antes de pagar as contas do mês.
              </p>
            </div>
          )}

          {/* Pending Recurrent Alerts */}
          {pendingRecurrent.length > 0 && (
            <div className="pluggy-card p-6 border-amber-500/10 bg-amber-500/[0.03]">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Contas Pendentes</span>
                </div>
                <span className="text-[9px] font-black py-0.5 px-2 bg-amber-500/20 text-amber-500 rounded-full">{pendingRecurrent.length}</span>
              </div>
              <div className="space-y-3">
                {pendingRecurrent.slice(0, 3).map(t => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between bg-white/[0.03] p-3 rounded-xl border border-white/5 group hover:bg-white/[0.06] transition-colors cursor-pointer"
                    onClick={() => handleEditTransaction(t)}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white/80 group-hover:text-primary transition-colors truncate mb-0.5">{t.title || t.description}</p>
                      <p className="text-[9px] text-white/20 font-black uppercase tracking-widest">Vence {format(parseISO(t.billingDate || t.date), 'dd/MM')}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[9px] font-black uppercase px-3 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white rounded-lg transition-all"
                      onClick={(e) => { e.stopPropagation(); handlePayTransaction(t); }}
                    >
                      Pagar
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Balances List */}
          <div className="pluggy-card p-6">
            <div className="flex items-center gap-2 mb-6">
              <LayoutGrid className="w-3 h-3 text-white/20" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Contas Bancárias</span>
            </div>
            <div className="space-y-5">
              {(bankAccounts || []).map(acc => {
                const member = householdMembers.find(m => m.uid === acc.memberId);
                return (
                  <div key={acc.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-[10px] font-black text-white/30 uppercase">
                        {acc.name.substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white/70 group-hover:text-white transition-colors">{acc.name}</p>
                        <p className="text-[9px] text-white/20 font-black uppercase tracking-tighter">{member?.displayName?.split(' ')[0] || 'Geral'}</p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-white/80">{formatCurrency(acc.currentBalance)}</span>
                  </div>
                );
              })}
              {(!bankAccounts || bankAccounts.length === 0) && (
                <p className="text-[10px] font-bold text-white/10 uppercase italic text-center">Nenhuma conta vinculada</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Activity / Transaction List */}
      <div className="space-y-5">
        <div className="flex items-center justify-between px-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Atividade Recente</span>
          <Button
            variant="link"
            size="sm"
            onClick={() => navigate('/transactions')}
            className="text-[10px] font-black uppercase text-white/40 hover:text-primary transition-colors"
          >
            Ver fluxo completo
          </Button>
        </div>

        <div className="pluggy-card divide-y divide-white/5 overflow-hidden">
          {monthlyExpensesList.length > 0 ? (
            monthlyExpensesList.slice(0, 10).map((t) => {
              const cat = categories.find(c => c.id === t.categoryId);
              return (
                <div
                  key={t.id}
                  className="group flex items-center justify-between p-5 hover:bg-white/[0.03] transition-all cursor-pointer"
                  onClick={() => handleEditTransaction(t)}
                >
                  <div className="flex items-center gap-5">
                    <div className="w-1 h-8 rounded-full opacity-30 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: cat?.color || '#333' }} />
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-bold text-white/90 group-hover:text-white transition-colors">{t.title || t.description}</p>
                        {(!!t.recurringId || t.recurrenceType === 'fixa' || t.recurrenceType === 'assinatura') && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-white/5 text-white/30 border border-white/5 uppercase tracking-widest">Fixo</span>
                        )}
                      </div>
                      <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                        {format(parseISO(t.billingDate || t.date), "dd 'de' MMM", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black tracking-tight ${t.type === 'receita' ? 'text-emerald-400' : 'text-white'}`}>
                      {t.type === 'receita' ? '+' : '-'}{formatCurrency(t.amount)}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/10">{cat?.name || 'Outros'}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-20 text-center flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-white/10" />
              </div>
              <p className="text-xs font-bold text-white/20 uppercase tracking-widest">Sem movimentações este mês</p>
            </div>
          )}
        </div>
      </div>

      {/* Discrete FAB */}
      <div className="fixed bottom-8 right-8">
        <Button
          onClick={() => { setEditingTransaction(null); setIsTransactionModalOpen(true); }}
          className="h-11 px-6 bg-white text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-xl shadow-2xl hover:scale-105 active:scale-90 transition-all shadow-white/20"
        >
          Novo Lançamento
        </Button>
      </div>

      <TransactionModal
        isOpen={isTransactionModalOpen}
        onOpenChange={setIsTransactionModalOpen}
        editingTransaction={editingTransaction}
      />

      <CategoryDetailModal
        isOpen={isCategoryDetailOpen}
        onOpenChange={setIsCategoryDetailOpen}
        categoryName={selectedCategory?.name || ''}
        categoryColor={selectedCategory?.color || '#333'}
        transactions={categoryTransactions}
      />
    </div>
  );
}
