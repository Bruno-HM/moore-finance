import { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFinance } from '../contexts/FinanceContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, RefreshCw, Info, Edit3, Trash2, User, Users, ChevronRight, Filter, Calendar, Receipt } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { format, isSameMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { MonthSelector } from '../components/MonthSelector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
  };

  return (
    <div className="space-y-8 md:space-y-12 pb-24 md:pb-8">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-primary/10 rounded-xl">
               <TrendingUp className="w-5 h-5 text-primary" />
             </div>
             <div>
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Painel de Controle</h2>
                <p className="text-muted-foreground font-medium">Balanço de {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}</p>
             </div>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap">
            <div className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-2xl text-[11px] font-bold uppercase tracking-wider border shadow-sm ${
              isSharedGroup 
                ? 'bg-primary/5 text-primary border-primary/20' 
                : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50'
            }`}>
              {isSharedGroup ? <Users className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              {isSharedGroup ? 'Ambiente Compartilhado' : 'Ambiente Privado'}
            </div>

            <div className="flex -space-x-3 hover:space-x-1 transition-all duration-300 items-center pl-2">
              {householdMembers.map((member, idx) => (
                <div key={member.uid} className="relative group cursor-pointer" style={{ zIndex: householdMembers.length - idx }}>
                  <Avatar className="w-9 h-9 border-2 border-background ring-2 ring-transparent group-hover:ring-primary/30 transition-all">
                    <AvatarImage src={member.photoURL || ''} />
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">{member.displayName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-background text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-bold">
                    {member.displayName.split(' ')[0]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <Button 
            variant="outline" 
            size="lg"
            onClick={handleRecalculate} 
            disabled={isRecalculating}
            className="rounded-2xl border-border/50 bg-card hover:bg-muted font-bold gap-3 h-12 px-6"
          >
            <RefreshCw className={`w-4 h-4 text-primary ${isRecalculating ? 'animate-spin' : ''}`} />
            {isRecalculating ? 'Sincronizando...' : 'Sincronizar'}
          </Button>

          <MonthSelector />
        </div>
      </div>

      {/* Primary Stats Grid */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={itemVariants}>
          <Card className="bg-emerald-50/30 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/10 shadow-none hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-500 group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Renda Extra</CardTitle>
              <div className="p-2 bg-emerald-500/10 rounded-xl group-hover:rotate-12 transition-transform">
                <ArrowUpCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300 mb-1">{formatCurrency(totalIncome)}</div>
              <p className="text-xs font-semibold text-emerald-600/60 dark:text-emerald-400/60 tracking-tight">Rendas registradas</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="bg-primary/5 border-primary/10 shadow-none hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[13px] font-bold text-primary dark:text-primary uppercase tracking-widest">
                {isSharedGroup ? 'Soma Salários' : 'Meu Salário'}
              </CardTitle>
              <div className="p-2 bg-primary/10 rounded-xl group-hover:scale-110 transition-transform">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-primary mb-1">{formatCurrency(combinedSalary)}</div>
              <p className="text-xs font-semibold text-primary/60 tracking-tight">Total mensal fixo</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card 
            className="bg-rose-50/30 dark:bg-rose-500/5 border-rose-100 dark:border-rose-500/10 shadow-none cursor-pointer hover:shadow-xl hover:shadow-rose-500/5 transition-all duration-500 group"
            onClick={() => setShowBreakdown(true)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[13px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">Despesas</CardTitle>
              <div className="p-2 bg-rose-500/10 rounded-xl group-hover:-rotate-12 transition-transform">
                <ArrowDownCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-rose-700 dark:text-rose-300 mb-1">{formatCurrency(totalExpenses)}</div>
              <div className="flex items-center gap-2">
                <div className="flex bg-rose-500/10 rounded-full p-1 group-hover:px-3 transition-all items-center gap-1">
                   {includePending ? <Filter className="w-3 h-3 text-rose-600"/> : <TrendingUp className="w-3 h-3 text-rose-600"/>}
                   <span className="text-[10px] font-bold uppercase text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity">Ver Detalhes</span>
                </div>
                <p className="text-xs font-semibold text-rose-600/60 dark:text-rose-400/60 truncate">
                  {includePending ? 'Incluindo previstos' : 'Apenas pagas'}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className={`${finalBalance >= 0 ? 'bg-card border-border/50' : 'bg-rose-600 text-white border-none shadow-lg shadow-rose-600/20'} shadow-none transition-all duration-500`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className={`text-[13px] font-bold uppercase tracking-widest ${finalBalance >= 0 ? 'text-muted-foreground' : 'text-white/80'}`}>Saldo Final</CardTitle>
              <div className={`p-2 rounded-xl ${finalBalance >= 0 ? 'bg-primary/10' : 'bg-white/20'}`}>
                <TrendingUp className={`h-5 w-5 ${finalBalance >= 0 ? 'text-primary' : 'text-white'}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-black mb-1 truncate ${finalBalance >= 0 ? 'text-foreground' : 'text-white'}`}>
                {formatCurrency(finalBalance)}
              </div>
              <p className={`text-xs font-semibold tracking-tight ${finalBalance >= 0 ? 'text-muted-foreground/60' : 'text-white/60'}`}>Projeção final do mês</p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Main Analysis Section */}
      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* Categories Analysis */}
        <Card className="lg:col-span-7 bg-card border-border/50 shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-6 px-8 py-8">
            <div>
              <CardTitle className="text-xl font-extrabold tracking-tight">Distribuição de Gastos</CardTitle>
              <CardDescription className="text-xs font-medium">Análise visual por categoria</CardDescription>
            </div>
            <div className="flex bg-muted p-1 rounded-xl">
               <Button 
                variant={includePending ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setIncludePending(true)}
                className="h-8 text-[10px] font-bold uppercase tracking-widest rounded-lg px-3"
              >
                Com Pendentes
              </Button>
              <Button 
                variant={!includePending ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setIncludePending(false)}
                className="h-8 text-[10px] font-bold uppercase tracking-widest rounded-lg px-3"
              >
                Só Pagos
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            {expensesByCategory.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="h-[280px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expensesByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={75}
                        outerRadius={100}
                        paddingAngle={8}
                        dataKey="value"
                        stroke="none"
                        cornerRadius={10}
                      >
                        {expensesByCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total</span>
                     <span className="text-2xl font-black">{formatCurrency(totalExpenses)}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  {expensesByCategory.slice(0, 5).map((entry, index) => (
                    <div key={index} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                        <span className="text-sm font-bold text-muted-foreground group-hover:text-foreground transition-colors">{entry.name}</span>
                      </div>
                      <span className="text-sm font-black">{formatCurrency(entry.value)}</span>
                    </div>
                  ))}
                  {expensesByCategory.length > 5 && (
                    <Button variant="link" className="text-xs p-0 font-bold h-auto pt-2" onClick={() => setShowBreakdown(true)}>
                      + {expensesByCategory.length - 5} outras categorias
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                  <Calendar className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="font-bold text-muted-foreground">Silêncio total por aqui...</p>
                  <p className="text-xs text-muted-foreground/60">Nenhuma despesa registrada neste mês.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="lg:col-span-5 bg-card border-border/50 shadow-sm">
          <CardHeader className="border-b border-border/40 pb-6 px-8 py-8 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-extrabold tracking-tight">Movimentações</CardTitle>
              <CardDescription className="text-xs font-medium">Últimos registros</CardDescription>
            </div>
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate('/transactions')}>
              <ChevronRight className="w-5 h-5 text-primary" />
            </Button>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-6">
              {filteredTransactions.slice(0, 5).map((transaction, idx) => {
                const category = categories.find(c => c.id === transaction.categoryId);
                const creator = householdMembers.find(m => m.uid === transaction.createdBy);
                return (
                  <motion.div 
                    key={transaction.id} 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center justify-between group cursor-pointer"
                    onClick={() => navigate('/transactions', { state: { editId: transaction.id } })}
                  >
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-black/5"
                        style={{ backgroundColor: category?.color || '#cbd5e1' }}
                      >
                        {transaction.type === 'receita' ? <ArrowUpCircle className="w-6 h-6" /> : <ArrowDownCircle className="w-6 h-6" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{transaction.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase">
                            {format(parseISO(transaction.billingDate || transaction.date), "dd 'de' MMM", { locale: ptBR })}
                          </p>
                          <span className="text-muted-foreground/30 text-[10px]">•</span>
                          <div className="flex items-center gap-1">
                            {creator?.photoURL ? (
                              <img src={creator.photoURL} alt="" className="w-4 h-4 rounded-full" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-4 h-4 bg-muted rounded-full flex items-center justify-center">
                                <User className="w-2.5 h-2.5 text-muted-foreground" />
                              </div>
                            )}
                            <span className="text-[10px] text-muted-foreground/60 font-bold">
                              {creator?.uid === userProfile?.uid ? 'Eu' : creator?.displayName.split(' ')[0]}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className={`font-black tracking-tight text-right ${transaction.type === 'receita' ? 'text-emerald-500' : 'text-foreground'}`}>
                      {transaction.type === 'receita' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </div>
                  </motion.div>
                );
              })}
              {filteredTransactions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-3">
                  <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center">
                    <Receipt className="w-6 h-6 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-bold">Sem entradas ou saídas</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showBreakdown} onOpenChange={setShowBreakdown}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col p-0 rounded-[2.5rem] border-none shadow-2xl">
          <DialogHeader className="p-8 pb-4">
            <DialogTitle className="flex items-center justify-between text-2xl font-black">
              Detalhamento de Despesas
            </DialogTitle>
             <CardDescription className="font-bold">Lista completa de gastos para {format(selectedMonth, 'MMMM', { locale: ptBR })}</CardDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-8">
            <div className="min-w-[500px] mb-8">
              <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest">Descrição</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest">Categoria</TableHead>
                  <TableHead className="text-right font-bold uppercase text-[10px] tracking-widest">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyExpensesList.map((t) => {
                  const category = categories.find(c => c.id === t.categoryId);
                  const creator = householdMembers.find(m => m.uid === t.createdBy);
                  const isPending = t.status === 'pendente';
                  return (
                    <TableRow key={t.id} className={`${isPending ? "opacity-50" : ""} border-border/40 hover:bg-muted/50 transition-colors`}>
                      <TableCell className="py-4">
                        <div className="font-bold text-foreground">{t.description}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-1">
                            {creator?.photoURL ? (
                              <img src={creator.photoURL} alt="" className="w-3.5 h-3.5 rounded-full" referrerPolicy="no-referrer" />
                            ) : (
                              <User className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                            <span className="text-[10px] text-muted-foreground/70 font-bold uppercase">
                              {creator?.uid === userProfile?.uid ? 'Eu' : creator?.displayName.split(' ')[0]}
                            </span>
                          </div>
                          <span className="text-muted-foreground/30 text-[10px]">•</span>
                          <div className="text-[10px] text-muted-foreground/70 font-bold">
                            {format(parseISO(t.billingDate || t.date), "dd/MM/yyyy")}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: category?.color || '#cbd5e1' }} />
                          <span className="text-xs font-bold text-muted-foreground">{category?.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className={`text-sm font-black ${isPending ? "text-muted-foreground" : "text-foreground"}`}>
                          {formatCurrency(t.amount)}
                        </div>
                        <div className="flex justify-end gap-1 mt-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('/transactions', { state: { editId: t.id } });
                            }}
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-destructive" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTransaction(t);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          </div>
          <DialogFooter className="p-8 bg-muted/30 border-t border-border/50 flex flex-row items-center justify-between sm:justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">Total Calculado</span>
              <span className="font-black text-2xl text-primary">{formatCurrency(totalExpenses)}</span>
            </div>
            <Button size="lg" className="rounded-2xl font-bold px-8 shadow-lg shadow-primary/20" onClick={() => setShowBreakdown(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
