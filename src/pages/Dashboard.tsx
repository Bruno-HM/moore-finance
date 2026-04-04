import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFinance } from '../contexts/FinanceContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, RefreshCw, Info, Edit3, Trash2, User, Users } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { format, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { MonthSelector } from '../components/MonthSelector';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const { userProfile, householdMembers } = useAuth();
  const { includePending, setIncludePending, transactions, categories, selectedMonth, recalculateRecurring, deleteTransaction } = useFinance();
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const isSharedGroup = userProfile?.householdId !== userProfile?.personalHouseholdId;

  const combinedSalary = useMemo(() => {
    return householdMembers.reduce((sum, member) => sum + (member.salary || 0), 0);
  }, [householdMembers]);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      await recalculateRecurring();
      toast.success('Valores recalculados e sincronizados!');
    } catch (error) {
      toast.error('Erro ao recalcular valores.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleDeleteTransaction = async (t: any) => {
    if (confirm('Tem certeza que deseja excluir esta transação?')) {
      try {
        await deleteTransaction(t.id);
        toast.success('Transação excluída!');
      } catch (error) {
        toast.error('Erro ao excluir transação.');
      }
    }
  };

  const { totalIncome, totalExpenses, expensesByCategory, monthlyExpensesList } = useMemo(() => {
    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryTotals: Record<string, number> = {};
    const monthlyExpensesList: any[] = [];

    transactions.forEach(t => {
      if (isSameMonth(parseISO(t.billingDate || t.date), selectedMonth)) {
        if (t.type === 'receita') {
          if (t.status === 'pago' || includePending) {
            totalIncome += t.amount;
          }
        } else {
          monthlyExpensesList.push(t);
          if (t.status === 'pago' || includePending) {
            totalExpenses += t.amount;
            categoryTotals[t.categoryId] = (categoryTotals[t.categoryId] || 0) + t.amount;
          }
        }
      }
    });

    const expensesByCategory = Object.entries(categoryTotals).map(([categoryId, value]) => {
      const category = categories.find(c => c.id === categoryId);
      return {
        name: category?.name || 'Outros',
        value,
        color: category?.color || '#cbd5e1'
      };
    }).sort((a, b) => b.value - a.value);

    return { totalIncome, totalExpenses, expensesByCategory, monthlyExpensesList: monthlyExpensesList.sort((a, b) => new Date(b.billingDate || b.date).getTime() - new Date(a.billingDate || a.date).getTime()) };
  }, [transactions, categories, selectedMonth, includePending]);

  const finalBalance = (totalIncome + combinedSalary) - totalExpenses;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        const matchesMonth = isSameMonth(parseISO(t.billingDate || t.date), selectedMonth);
        const isRecurring = t.recurrenceType === 'fixa' || t.recurrenceType === 'assinatura';
        return matchesMonth && !isRecurring;
      })
      .sort((a, b) => new Date(b.billingDate || b.date).getTime() - new Date(a.billingDate || a.date).getTime());
  }, [transactions, selectedMonth]);

  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="w-full md:w-auto space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Visão Geral</h2>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
              isSharedGroup 
                ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' 
                : 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
            }`}>
              {isSharedGroup ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
              {isSharedGroup ? 'Compartilhado' : 'Pessoal'}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Acompanhe sua vida financeira com MooreFinance em {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}.
          </p>
          <div className="p-2 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Membros</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {householdMembers.map(member => (
                <div key={member.uid} className="flex items-center gap-1 bg-white dark:bg-neutral-800 px-1.5 py-0.5 rounded-md border border-neutral-200 dark:border-neutral-700 shadow-sm">
                  {member.photoURL ? (
                    <img src={member.photoURL} alt={member.displayName} className="w-3.5 h-3.5 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-2 h-2 text-primary" />
                    </div>
                  )}
                  <span className="text-[10px] font-medium truncate max-w-[60px]">{member.uid === userProfile?.uid ? 'Você' : member.displayName.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRecalculate} 
            disabled={isRecalculating}
            className="h-10 sm:h-9 gap-2 justify-center"
          >
            <RefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`} />
            {isRecalculating ? 'Recalculando...' : 'Recalcular'}
          </Button>

          <div className="flex items-center justify-between sm:justify-start gap-2 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
            <Button 
              variant={includePending ? "default" : "ghost"} 
              size="sm" 
              onClick={() => setIncludePending(true)}
              className="h-8 text-xs"
            >
              Com Pendentes
            </Button>
            <Button 
              variant={!includePending ? "default" : "ghost"} 
              size="sm" 
              onClick={() => setIncludePending(false)}
              className="h-8 text-xs"
            >
              Apenas Pagos
            </Button>
          </div>

          <MonthSelector />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-emerald-50/50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Receitas Extras</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(totalIncome)}</div>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">Este mês</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50/50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {isSharedGroup ? 'Salário Conjunto' : 'Seu Salário'}
            </CardTitle>
            <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(combinedSalary)}</div>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">
              {isSharedGroup ? 'Soma dos membros' : 'Configurado no perfil'}
            </p>
          </CardContent>
        </Card>

        <Card 
          className="bg-rose-50/50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 cursor-pointer hover:bg-rose-100/50 dark:hover:bg-rose-500/20 transition-colors group"
          onClick={() => setShowBreakdown(true)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-rose-600 dark:text-rose-400">Despesas</CardTitle>
            <div className="flex items-center gap-2">
              <Edit3 className="h-3 w-3 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              <ArrowDownCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-1 flex items-center gap-1">
              {includePending ? 'Total (incl. pendentes)' : 'Apenas pagas'}
              <Info className="h-3 w-3 inline" />
            </p>
          </CardContent>
        </Card>

        <Card className={`${finalBalance >= 0 ? 'bg-neutral-50/50 dark:bg-neutral-500/10' : 'bg-rose-50/50 dark:bg-rose-500/10'} border-neutral-200 dark:border-neutral-500/20`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Final</CardTitle>
            <TrendingUp className={`h-4 w-4 ${finalBalance >= 0 ? 'text-primary' : 'text-rose-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${finalBalance >= 0 ? '' : 'text-rose-600'}`}>
              {formatCurrency(finalBalance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Salário + Receitas - Despesas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {expensesByCategory.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensesByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {expensesByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value: number) => formatCurrency(value)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {expensesByCategory.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span>{entry.name || 'Categoria desconhecida'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhuma despesa este mês.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Transações do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredTransactions.slice(0, 6).map(transaction => {
                const category = categories.find(c => c.id === transaction.categoryId);
                const creator = householdMembers.find(m => m.uid === transaction.createdBy);
                return (
                  <div key={transaction.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: category?.color || '#cbd5e1' }}
                      >
                        {transaction.type === 'receita' ? <ArrowUpCircle className="w-5 h-5" /> : <ArrowDownCircle className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-none truncate">{transaction.description}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(transaction.billingDate || transaction.date), "dd 'de' MMM", { locale: ptBR })}
                          </p>
                          <span className="text-muted-foreground text-[10px]">•</span>
                          <div className="flex items-center gap-1">
                            {creator?.photoURL ? (
                              <img src={creator.photoURL} alt="" className="w-3 h-3 rounded-full" referrerPolicy="no-referrer" />
                            ) : (
                              <User className="w-3 h-3 text-muted-foreground" />
                            )}
                            <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[60px]">
                              {creator?.uid === userProfile?.uid ? 'Você' : creator?.displayName.split(' ')[0] || 'Usuário'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className={`font-medium shrink-0 ${transaction.type === 'receita' ? 'text-emerald-500' : ''}`}>
                      {transaction.type === 'receita' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </div>
                  </div>
                );
              })}
              {filteredTransactions.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  Nenhuma transação este mês.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={showBreakdown} onOpenChange={setShowBreakdown}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Detalhamento de Despesas
              <Button variant="ghost" size="sm" onClick={() => navigate('/transactions')} className="text-xs gap-1">
                <Edit3 className="w-3 h-3" /> Editar Todas
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-4 -mx-6 px-6">
            <div className="min-w-[500px]">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyExpensesList.map((t) => {
                  const category = categories.find(c => c.id === t.categoryId);
                  const creator = householdMembers.find(m => m.uid === t.createdBy);
                  const isPending = t.status === 'pendente';
                  return (
                    <TableRow key={t.id} className={isPending ? "opacity-60" : ""}>
                      <TableCell>
                        <div className="font-medium">{t.description}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="flex items-center gap-1">
                            {creator?.photoURL ? (
                              <img src={creator.photoURL} alt="" className="w-3 h-3 rounded-full" referrerPolicy="no-referrer" />
                            ) : (
                              <User className="w-3 h-3 text-muted-foreground" />
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {creator?.uid === userProfile?.uid ? 'Você' : creator?.displayName.split(' ')[0] || 'Usuário'}
                            </span>
                          </div>
                          <span className="text-muted-foreground text-[10px]">•</span>
                          <div className="text-[10px] text-muted-foreground">
                            {format(parseISO(t.billingDate || t.date), "dd/MM/yyyy")}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category?.color || '#cbd5e1' }} />
                          <span className="text-xs">{category?.name || 'Categoria desconhecida'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={`font-medium ${isPending ? "text-neutral-400" : "text-rose-600"}`}>
                          {formatCurrency(t.amount)}
                        </div>
                        <div className="flex justify-end gap-1 mt-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6" 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('/transactions', { state: { editId: t.id } });
                            }}
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-destructive" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTransaction(t);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {monthlyExpensesList.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">
                      Nenhuma despesa encontrada para este mês.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="pt-4 border-t mt-auto flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Total do Mês:</span>
            <span className="font-bold text-lg">{formatCurrency(totalExpenses)}</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
