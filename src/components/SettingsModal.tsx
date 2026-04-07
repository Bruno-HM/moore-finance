import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { Settings, Loader2, Copy, Check, Users, User, LogOut, ArrowRight, CreditCard as CreditCardIcon, Plus, Trash2, Building2, Wallet, Tag, RefreshCw } from 'lucide-react';
import { useFinance, CreditCard } from '../contexts/FinanceContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { userProfile, updateProfile, joinHousehold, leaveHousehold, householdMembers, repairHousehold } = useAuth();
  const [closingDay, setClosingDay] = useState<string>('');
  const [salary, setSalary] = useState<string>('');
  const [inviteCodeInput, setInviteCodeInput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { 
    creditCards, addCreditCard, deleteCreditCard, updateCreditCard,
    bankAccounts, addBankAccount, deleteBankAccount, updateBankAccount,
    categories, addCategory, deleteCategory 
  } = useFinance();
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardClosing, setNewCardClosing] = useState('');
  const [newCardDue, setNewCardDue] = useState('');
  const [newCardBankId, setNewCardBankId] = useState('');
  const [newCardMemberId, setNewCardMemberId] = useState(userProfile?.uid || '');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [exceptionMonth, setExceptionMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [exceptionDay, setExceptionDay] = useState('');

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [newAccMemberId, setNewAccMemberId] = useState(userProfile?.uid || '');

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#3B82F6');
  const [newCatType, setNewCatType] = useState<'receita' | 'despesa' | 'ambos'>('despesa');

  // Edit account States
  const [editAccName, setEditAccName] = useState('');
  const [editAccBalance, setEditAccBalance] = useState('');
  const [editAccMemberId, setEditAccMemberId] = useState('');

  useEffect(() => {
    if (userProfile?.creditCardClosingDay) {
      setClosingDay(userProfile.creditCardClosingDay.toString());
    }
    if (userProfile?.salary) {
      setSalary(userProfile.salary.toString());
    }
  }, [userProfile]);

  const isSharedGroup = userProfile?.householdId !== userProfile?.personalHouseholdId;

  const getMemberName = (id: string) => {
    const member = householdMembers.find(m => m.uid === id);
    return member ? member.displayName : 'Desconhecido';
  };

  const getBankName = (id: string) => {
    const bank = bankAccounts.find(b => b.id === id);
    return bank ? bank.name : 'Sem Banco';
  };

  const copyInviteCode = () => {
    if (userProfile?.inviteCode) {
      navigator.clipboard.writeText(userProfile.inviteCode);
      setCopied(true);
      toast.success('Código copiado!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleJoinGroup = async () => {
    if (!inviteCodeInput.trim()) {
      toast.error('Por favor, insira um código de convite.');
      return;
    }

    setActionLoading(true);
    try {
      await joinHousehold(inviteCodeInput.trim());
      toast.success('Você entrou no grupo compartilhado!');
      setInviteCodeInput('');
    } catch (error) {
      console.error('Error joining group:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao entrar no grupo.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm('Tem certeza que deseja sair deste grupo? Você voltará para o seu grupo pessoal.')) {
      return;
    }

    setActionLoading(true);
    try {
      await leaveHousehold();
      toast.success('Você voltou para o seu grupo pessoal.');
    } catch (error) {
      console.error('Error leaving group:', error);
      toast.error('Erro ao sair do grupo.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRepairHousehold = async () => {
    setActionLoading(true);
    try {
      if (repairHousehold) {
        await repairHousehold();
        toast.success('Sincronização do grupo reparada!');
      }
    } catch (error) {
      console.error('Error repairing household:', error);
      toast.error('Erro ao reparar grupo.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddCard = async () => {
    if (!newCardName.trim()) {
      toast.error('Informe o nome do cartão.');
      return;
    }
    const closing = parseInt(newCardClosing);
    const due = parseInt(newCardDue);
    
    if (isNaN(closing) || closing < 1 || closing > 31) {
      toast.error('Dia de fechamento inválido.');
      return;
    }
    if (isNaN(due) || due < 1 || due > 31) {
      toast.error('Dia de vencimento inválido.');
      return;
    }

    if (!newCardBankId) {
      toast.error('Vincule uma conta bancária ao cartão.');
      return;
    }

    if (!newCardMemberId) {
      toast.error('Escolha o dono do cartão.');
      return;
    }

    setActionLoading(true);
    try {
      await addCreditCard({
        name: newCardName.trim(),
        closingDay: closing,
        dueDay: due,
        bankAccountId: newCardBankId,
        memberId: newCardMemberId
      });
      toast.success('Cartão adicionado!');
      setNewCardName('');
      setNewCardClosing('');
      setNewCardDue('');
      setNewCardBankId('');
      setShowAddCard(false);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao adicionar cartão.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddAccount = async () => {
    if (!newAccName.trim()) {
      toast.error('Informe o nome da conta.');
      return;
    }
    const balance = parseFloat(newAccBalance);
    if (isNaN(balance)) {
      toast.error('Informe um saldo inicial válido.');
      return;
    }

    setActionLoading(true);
    try {
      await addBankAccount({
        name: newAccName.trim(),
        initialBalance: balance,
        memberId: newAccMemberId || userProfile?.uid || ''
      });
      toast.success('Conta bancária adicionada!');
      setNewAccName('');
      setNewAccBalance('');
      setShowAddAccount(false);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao adicionar conta.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateAccount = async (id: string) => {
    const balance = parseFloat(editAccBalance);
    if (!editAccName.trim()) {
      toast.error('Informe o nome da conta.');
      return;
    }
    if (isNaN(balance)) {
      toast.error('Informe um saldo válido.');
      return;
    }

    setActionLoading(true);
    try {
      await updateBankAccount(id, { 
        name: editAccName.trim(), 
        currentBalance: balance,
        memberId: editAccMemberId 
      });
      toast.success('Conta atualizada com sucesso!');
      setEditingAccId(null);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar conta.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    const isLinked = creditCards.some(cc => cc.bankAccountId === id);
    if (isLinked) {
      toast.error('Esta conta está vinculada a um cartão e não pode ser removida.');
      return;
    }

    if (!confirm('Excluir esta conta bancária?')) return;
    setActionLoading(true);
    try {
      await deleteBankAccount(id);
      toast.success('Conta removida.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao remover conta.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCard = async (id: string) => {
    if (!confirm('Excluir este cartão?')) return;
    setActionLoading(true);
    try {
      await deleteCreditCard(id);
      toast.success('Cartão removido.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao remover cartão.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateCard = async (id: string, data: Partial<CreditCard>) => {
    setActionLoading(true);
    try {
      await updateCreditCard(id, data);
      toast.success('Cartão atualizado!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar cartão.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddException = async (cardId: string) => {
    const card = creditCards.find(c => c.id === cardId);
    if (!card) return;

    const day = parseInt(exceptionDay);
    if (isNaN(day) || day < 1 || day > 31) {
      toast.error('Dia inválido.');
      return;
    }

    const newExceptions = { ...(card.closingDayExceptions || {}), [exceptionMonth]: day };
    
    setActionLoading(true);
    try {
      await updateCreditCard(cardId, { closingDayExceptions: newExceptions });
      toast.success(`Exceção adicionada para ${exceptionMonth}`);
      setExceptionDay('');
    } catch (error) {
      toast.error('Erro ao adicionar exceção.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveException = async (cardId: string, monthKey: string) => {
    const card = creditCards.find(c => c.id === cardId);
    if (!card) return;

    const newExceptions = { ...(card.closingDayExceptions || {}) };
    delete newExceptions[monthKey];

    setActionLoading(true);
    try {
      await updateCreditCard(cardId, { closingDayExceptions: newExceptions });
      toast.success('Exceção removida.');
    } catch (error) {
      toast.error('Erro ao remover exceção.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateCardBank = async (cardId: string, bankId: string) => {
    setActionLoading(true);
    try {
      await updateCreditCard(cardId, { bankAccountId: bankId });
      toast.success('Banco do cartão atualizado!');
    } catch (error) {
      toast.error('Erro ao atualizar banco do cartão.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateCardMember = async (cardId: string, memberId: string) => {
    setActionLoading(true);
    try {
      await updateCreditCard(cardId, { memberId });
      toast.success('Dono do cartão atualizado!');
    } catch (error) {
      toast.error('Erro ao atualizar dono do cartão.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) {
      toast.error('Informe o nome da categoria.');
      return;
    }
    setActionLoading(true);
    try {
      await addCategory({
        name: newCatName.trim(),
        color: newCatColor,
        type: newCatType
      });
      toast.success('Categoria adicionada!');
      setNewCatName('');
      setShowAddCategory(false);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao adicionar categoria.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string, isDefault: boolean) => {
    if (isDefault) {
      toast.error('Categorias padrão não podem ser removidas.');
      return;
    }
    if (!confirm('Excluir esta categoria?')) return;
    setActionLoading(true);
    try {
      await deleteCategory(id);
      toast.success('Categoria removida.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao remover categoria.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSave = async () => {
    const day = parseInt(closingDay);
    if (closingDay && (isNaN(day) || day < 1 || day > 31)) {
      toast.error('O dia de fechamento deve ser entre 1 e 31.');
      return;
    }

    const salaryVal = parseFloat(salary);
    if (salary && isNaN(salaryVal)) {
      toast.error('O salário deve ser um número válido.');
      return;
    }

    setLoading(true);
    try {
      await updateProfile({ 
        creditCardClosingDay: closingDay ? day : undefined,
        salary: salary ? salaryVal : undefined
      });
      toast.success('Configurações salvas com sucesso!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] max-h-[90vh] overflow-y-auto p-0 border-none bg-transparent shadow-none">
        <div className="bg-neutral-950 rounded-[2rem] overflow-hidden flex flex-col h-full border border-neutral-800 shadow-2xl">
          <DialogHeader className="px-6 pt-8 pb-4">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Settings className="w-5 h-5 text-primary" />
              Configurações
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-2 space-y-8 pb-10">
            {/* Status do Grupo */}
            <div className="bg-neutral-900/50 p-4 rounded-2xl border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isSharedGroup ? (
                    <Users className="w-4 h-4 text-blue-500" />
                  ) : (
                    <User className="w-4 h-4 text-primary" />
                  )}
                  <span className="text-sm font-bold">
                    {isSharedGroup ? 'Grupo Compartilhado' : 'Grupo Pessoal'}
                  </span>
                </div>
                <span className={`text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded-full ${
                  isSharedGroup ? 'bg-blue-500/10 text-blue-400' : 'bg-primary/10 text-primary'
                }`}>
                  Ativo
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isSharedGroup 
                  ? 'Você está visualizando e editando dados de um grupo compartilhado.' 
                  : 'Você está visualizando seus dados financeiros individuais.'}
              </p>
            </div>

            {/* Dados Financeiros */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-neutral-800 pb-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Financeiro</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="salary" className="text-xs font-bold text-muted-foreground ml-1">Seu Salário Mensal (R$)</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">R$</span>
                  <Input
                    id="salary"
                    type="number"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    placeholder="0,00"
                    className="pl-12 h-12 rounded-xl bg-neutral-900 border-neutral-800 font-bold"
                  />
                </div>
              </div>

              {/* Contas Bancárias */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary"/> Contas Bancárias
                  </h4>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddAccount(!showAddAccount)} className="h-8 rounded-lg text-xs font-bold hover:bg-primary/10 hover:text-primary">
                    {showAddAccount ? 'Cancelar' : <><Plus className="w-4 h-4 mr-1"/> Adicionar</>}
                  </Button>
                </div>

                {showAddAccount && (
                  <div className="space-y-3 p-4 bg-primary/5 rounded-2xl border border-primary/10 animate-in zoom-in-95 duration-200">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-black text-primary/60">Nome da Conta</Label>
                      <Input placeholder="Ex: Nubank, Itaú..." value={newAccName} onChange={e => setNewAccName(e.target.value)} className="h-10 rounded-xl bg-neutral-900" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black text-primary/60">Saldo Inicial</Label>
                        <Input type="number" step="0.01" value={newAccBalance} onChange={e => setNewAccBalance(e.target.value)} placeholder="0,00" className="h-10 rounded-xl bg-neutral-900 border-neutral-800" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black text-primary/60">Dono</Label>
                        <Select value={newAccMemberId} onValueChange={setNewAccMemberId}>
                          <SelectTrigger className="h-10 rounded-xl bg-neutral-900 border-neutral-800">
                            <SelectValue placeholder="Selecione">{getMemberName(newAccMemberId)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {householdMembers?.map(member => (
                              <SelectItem key={member.uid} value={member.uid}>{member.displayName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button className="w-full h-10 rounded-xl font-bold" size="sm" onClick={handleAddAccount} disabled={actionLoading}>Confirmar Adição</Button>
                  </div>
                )}

                <div className="space-y-3">
                  {bankAccounts.length > 0 ? (
                    bankAccounts.map(acc => (
                      <div key={acc.id} className="group border rounded-2xl overflow-hidden bg-neutral-900/50 border-neutral-800 hover:border-primary/30 transition-all">
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-neutral-800 shadow-sm flex items-center justify-center text-primary">
                              <Wallet className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold">{acc.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{getMemberName(acc.memberId)}</span>
                                <span className="text-muted-foreground/30 text-[8px]">•</span>
                                <p className="text-[10px] text-emerald-500 font-bold">R$ {acc.currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={`h-9 w-9 rounded-xl ${editingAccId === acc.id ? 'bg-primary text-white hover:bg-primary' : 'hover:bg-primary/10 text-muted-foreground'}`}
                              onClick={() => {
                                if (editingAccId === acc.id) {
                                  setEditingAccId(null);
                                } else {
                                  setEditingAccId(acc.id);
                                  setEditAccName(acc.name);
                                  setEditAccBalance(acc.currentBalance.toString());
                                  setEditAccMemberId(acc.memberId || '');
                                  setEditingCardId(null);
                                }
                              }}
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-rose-500 hover:bg-rose-500/10" onClick={() => handleDeleteAccount(acc.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {editingAccId === acc.id && (
                          <div className="px-4 pb-4 pt-1 border-t border-neutral-800 space-y-4 animate-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-2 gap-3 mt-2">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Nome</Label>
                                <Input value={editAccName} onChange={e => setEditAccName(e.target.value)} className="h-10 rounded-xl bg-neutral-800" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Saldo Atual</Label>
                                <Input type="number" step="0.01" value={editAccBalance} onChange={e => setEditAccBalance(e.target.value)} className="h-10 rounded-xl bg-neutral-800 font-bold" />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Dono</Label>
                                <Select value={editAccMemberId} onValueChange={setEditAccMemberId}>
                                  <SelectTrigger className="h-10 rounded-xl bg-neutral-800">
                                    <SelectValue placeholder="Selecione o dono">{getMemberName(editAccMemberId)}</SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {householdMembers?.map(member => (
                                      <SelectItem key={member.uid} value={member.uid}>{member.displayName}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            <Button className="w-full h-10 rounded-xl font-bold" size="sm" onClick={() => handleUpdateAccount(acc.id)} disabled={actionLoading}>
                              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                              Atualizar Dados
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4 bg-neutral-900 rounded-2xl border border-dashed font-medium">Nenhuma conta cadastrada.</p>
                  )}
                </div>
              </div>

              {/* Cartões de Crédito */}
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <CreditCardIcon className="w-4 h-4 text-primary"/> Cartões de Crédito
                  </h4>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddCard(!showAddCard)} className="h-8 rounded-lg text-xs font-bold hover:bg-primary/10 hover:text-primary">
                    {showAddCard ? 'Cancelar' : <><Plus className="w-4 h-4 mr-1"/> Adicionar</>}
                  </Button>
                </div>

                {showAddCard && (
                  <div className="space-y-3 p-4 bg-primary/5 rounded-2xl border border-primary/10 animate-in zoom-in-95 duration-200">
                    <Input placeholder="Nome (Ex: Nubank, Itaú...)" value={newCardName} onChange={e => setNewCardName(e.target.value)} className="h-10 rounded-xl bg-neutral-900 border-neutral-800" />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black text-primary/60 ml-1">Dia Fechamento</Label>
                        <Input type="number" min="1" max="31" value={newCardClosing} onChange={e => setNewCardClosing(e.target.value)} placeholder="Ex: 5" className="h-10 rounded-xl bg-neutral-900 border-neutral-800" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-black text-primary/60 ml-1">Dia Vencimento</Label>
                        <Input type="number" min="1" max="31" value={newCardDue} onChange={e => setNewCardDue(e.target.value)} placeholder="Ex: 12" className="h-10 rounded-xl bg-neutral-900 border-neutral-800" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-black text-primary/60 ml-1">Conta p/ Pagamento</Label>
                      <Select value={newCardBankId} onValueChange={setNewCardBankId}>
                        <SelectTrigger className="h-10 rounded-xl bg-neutral-900 border-neutral-800">
                          <SelectValue placeholder="Selecione a conta..." />
                        </SelectTrigger>
                        <SelectContent>
                          {bankAccounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-black text-primary/60 ml-1">Dono do Cartão</Label>
                      <Select value={newCardMemberId} onValueChange={setNewCardMemberId}>
                        <SelectTrigger className="h-10 rounded-xl bg-neutral-900 border-neutral-800">
                          <SelectValue placeholder="Selecione o dono...">{getMemberName(newCardMemberId)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {householdMembers?.map(member => (
                            <SelectItem key={member.uid} value={member.uid}>{member.displayName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full h-10 rounded-xl font-bold" size="sm" onClick={handleAddCard} disabled={actionLoading}>Adicionar Cartão</Button>
                  </div>
                )}

                <div className="space-y-3">
                  {creditCards.length > 0 ? (
                    creditCards.map(cc => (
                      <div key={cc.id} className="group border rounded-2xl overflow-hidden bg-neutral-900/50 border-neutral-800 hover:border-primary/30 transition-all">
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-neutral-800 shadow-sm flex items-center justify-center text-primary">
                              <CreditCardIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold">{cc.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{getMemberName(cc.memberId)}</span>
                                <span className="text-muted-foreground/30 text-[8px]">•</span>
                                <span className="text-[10px] text-primary font-bold uppercase tracking-widest">{getBankName(cc.bankAccountId)}</span>
                                <span className="text-muted-foreground/30 text-[8px]">•</span>
                                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tight">F: {cc.closingDay} | V: {cc.dueDay}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={`h-9 w-9 rounded-xl ${editingCardId === cc.id ? 'bg-primary text-white hover:bg-primary' : 'hover:bg-primary/10 text-muted-foreground'}`}
                              onClick={() => {
                                if (editingCardId === cc.id) {
                                  setEditingCardId(null);
                                } else {
                                  setEditingCardId(cc.id);
                                  setEditingAccId(null);
                                }
                              }}
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-rose-500 hover:bg-rose-500/10" onClick={() => handleDeleteCard(cc.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {editingCardId === cc.id && (
                          <div className="px-4 pb-6 pt-2 border-t border-neutral-800 space-y-6 animate-in slide-in-from-top-2 duration-300">
                            {/* Form de Edição */}
                            <div className="space-y-4">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Nome do Cartão</Label>
                                <Input 
                                  defaultValue={cc.name} 
                                  onBlur={(e) => {
                                    if (e.target.value !== cc.name && e.target.value.trim()) {
                                      handleUpdateCard(cc.id, { name: e.target.value.trim() });
                                    }
                                  }}
                                  className="h-10 rounded-xl bg-neutral-800 border-neutral-700" 
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Dia Fechamento</Label>
                                  <Input 
                                    type="number" 
                                    defaultValue={cc.closingDay}
                                    onBlur={(e) => {
                                      const val = parseInt(e.target.value);
                                      if (!isNaN(val) && val >= 1 && val <= 31 && val !== cc.closingDay) {
                                        handleUpdateCard(cc.id, { closingDay: val });
                                      }
                                    }}
                                    className="h-10 rounded-xl bg-neutral-800 border-neutral-700" 
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Dia Vencimento</Label>
                                  <Input 
                                    type="number" 
                                    defaultValue={cc.dueDay}
                                    onBlur={(e) => {
                                      const val = parseInt(e.target.value);
                                      if (!isNaN(val) && val >= 1 && val <= 31 && val !== cc.dueDay) {
                                        handleUpdateCard(cc.id, { dueDay: val });
                                      }
                                    }}
                                    className="h-10 rounded-xl bg-neutral-800 border-neutral-700" 
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Banco Vinculado</Label>
                                  <Select value={cc.bankAccountId} onValueChange={(val) => handleUpdateCardBank(cc.id, val)}>
                                    <SelectTrigger className="h-10 rounded-xl bg-neutral-800 border-neutral-700 text-xs">
                                      <SelectValue>{getBankName(cc.bankAccountId)}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {bankAccounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Dono</Label>
                                  <Select value={cc.memberId} onValueChange={(val) => handleUpdateCardMember(cc.id, val)}>
                                    <SelectTrigger className="h-10 rounded-xl bg-neutral-800 border-neutral-700 text-xs">
                                      <SelectValue>{getMemberName(cc.memberId)}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {householdMembers?.map(member => (
                                        <SelectItem key={member.uid} value={member.uid}>{member.displayName}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>

                            {/* Exceptions */}
                            <div className="space-y-3 pt-4 border-t border-neutral-800">
                              <div className="flex items-center justify-between px-1">
                                <Label className="text-[10px] uppercase font-black text-muted-foreground">Exceções de Fechamento</Label>
                                <span className="text-[9px] text-muted-foreground italic tracking-tight">* Altera o mês específico</span>
                              </div>
                              <div className="flex gap-2">
                                <Input type="month" value={exceptionMonth} onChange={e => setExceptionMonth(e.target.value)} className="h-9 text-xs rounded-lg flex-1 bg-neutral-900 border-neutral-800" />
                                <Input type="number" placeholder="Dia" value={exceptionDay} onChange={e => setExceptionDay(e.target.value)} className="h-9 w-14 text-xs rounded-lg text-center bg-neutral-900 border-neutral-800" />
                                <Button size="sm" className="h-9 w-9 p-0 rounded-lg" onClick={() => handleAddException(cc.id)} disabled={actionLoading}>
                                  <Plus className="w-4 h-4" />
                                </Button>
                              </div>
                              
                              {cc.closingDayExceptions && Object.keys(cc.closingDayExceptions).length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                  {Object.entries(cc.closingDayExceptions)
                                    .sort((a, b) => b[0].localeCompare(a[0]))
                                    .map(([month, day]) => (
                                    <div key={month} className="flex items-center justify-between bg-neutral-900/50 p-2.5 rounded-xl border border-neutral-800">
                                      <span className="text-[10px] font-black uppercase text-muted-foreground">{month}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-black text-primary">Dia {day}</span>
                                        <button onClick={() => handleRemoveException(cc.id, month)} className="text-rose-500 hover:scale-110 transition-transform ml-1">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4 bg-neutral-50 dark:bg-neutral-900 rounded-2xl border border-dashed font-medium">Nenhum cartão cadastrado.</p>
                  )}
                </div>
              </div>

              {/* Categorias */}
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <Tag className="w-4 h-4 text-primary"/> Categorias
                  </h4>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddCategory(!showAddCategory)} className="h-8 rounded-lg text-xs font-bold hover:bg-primary/10 hover:text-primary">
                    {showAddCategory ? 'Cancelar' : <><Plus className="w-4 h-4 mr-1"/> Adicionar</>}
                  </Button>
                </div>

                {showAddCategory && (
                  <div className="space-y-3 p-4 bg-primary/5 rounded-2xl border border-primary/10 animate-in zoom-in-95 duration-200">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-black text-primary/60">Nome da Categoria</Label>
                      <Input placeholder="Ex: Educação, Assinaturas..." value={newCatName} onChange={e => setNewCatName(e.target.value)} className="h-10 rounded-xl" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black text-primary/60">Cor</Label>
                        <div className="flex gap-2 items-center">
                          <Input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="h-10 w-12 p-1 rounded-lg bg-background border-none cursor-pointer" />
                          <span className="text-xs font-mono uppercase text-muted-foreground">{newCatColor}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-black text-primary/60">Tipo</Label>
                        <Select value={newCatType} onValueChange={(val: any) => setNewCatType(val)}>
                          <SelectTrigger className="h-10 rounded-xl bg-neutral-900 border-neutral-800">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="despesa">Despesa</SelectItem>
                            <SelectItem value="receita">Receita</SelectItem>
                            <SelectItem value="ambos">Ambos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button className="w-full h-10 rounded-xl font-bold" size="sm" onClick={handleAddCategory} disabled={actionLoading}>Confirmar Categoria</Button>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {categories.map(cat => (
                    <div key={cat.id} className="relative group p-3 rounded-2xl border border-neutral-800 bg-neutral-900/50 hover:border-primary/30 transition-all flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold truncate leading-tight">{cat.name}</p>
                        <p className="text-[9px] uppercase font-black tracking-widest text-muted-foreground/50">{cat.type}</p>
                      </div>
                      {!cat.isDefault && (
                        <button 
                          onClick={() => handleDeleteCategory(cat.id, cat.isDefault)}
                          className="opacity-0 group-hover:opacity-100 text-rose-500 hover:scale-110 transition-all ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Gestão de Grupo */}
            <div className="space-y-6 pt-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Grupo & Compartilhamento</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <Label className="text-xs font-bold text-muted-foreground">Membros Ativos</Label>
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary/40">{householdMembers.length} pessoas</span>
                  </div>
                  <div className="space-y-2">
                    {householdMembers.map(member => (
                      <div key={member.uid} className="flex items-center justify-between p-3 rounded-2xl bg-neutral-900/50 border border-neutral-800">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                            {member.displayName?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <p className="text-xs font-bold flex items-center gap-2">
                              {member.displayName}
                              {member.uid === userProfile?.uid && (
                                <span className="text-[8px] font-black uppercase bg-primary/20 text-primary px-1.5 py-0.5 rounded-md">Você</span>
                              )}
                            </p>
                            <p className="text-[9px] text-muted-foreground font-medium">{member.email}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                  <Label className="text-xs font-bold text-muted-foreground ml-1">Código de Convite do grupo</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono bg-neutral-900/50 px-4 py-3 rounded-xl border border-neutral-800 select-all truncate">
                      {userProfile?.inviteCode || '...'}
                    </code>
                    <Button variant="outline" size="icon" onClick={copyInviteCode} disabled={!userProfile?.inviteCode} className="w-12 h-12 rounded-xl">
                      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground px-1 leading-relaxed italic">
                    Envie este código para seu parceiro(a). Ao entrar com este código, todos os dados de cartões, contas e transações serão sincronizados.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                {!isSharedGroup ? (
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-muted-foreground ml-1">Entrar em outro grupo</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Insira o código do convite..."
                        value={inviteCodeInput}
                        onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                        className="h-12 rounded-xl uppercase font-mono bg-neutral-900 border-neutral-800"
                      />
                      <Button 
                        onClick={handleJoinGroup}
                        disabled={actionLoading || !inviteCodeInput}
                        className="h-12 w-12 rounded-xl p-0"
                      >
                        {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button 
                    variant="destructive" 
                    className="w-full h-12 rounded-xl font-bold gap-2 text-sm shadow-lg shadow-rose-500/10" 
                    onClick={handleLeaveGroup}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                    Sair do Grupo Compartilhado
                  </Button>
                )}
              </div>

              {/* Repair tool - Always accessible for troubleshooting */}
              <div className="pt-2 border-t border-dashed border-neutral-100 dark:border-neutral-800 flex flex-col gap-2">
                <p className="text-[9px] text-muted-foreground italic px-1 pt-2">
                  Problemas ao ver outros membros ou erro de sincronia?
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full h-10 rounded-xl font-bold bg-blue-500/5 hover:bg-blue-500/10 text-blue-500 border-blue-500/20" 
                  onClick={handleRepairHousehold}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
                  Reparar Conexão do Grupo
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-6 border-t bg-neutral-900 border-neutral-800 shadow-inner flex flex-row items-center justify-between gap-3">
            <Button 
              variant="ghost" 
              onClick={() => onOpenChange(false)} 
              disabled={loading} 
              className="flex-1 rounded-2xl font-bold h-12 hover:bg-neutral-800"
            >
              Fechar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={loading} 
              className="flex-[1.5] rounded-2xl font-black h-12 shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 text-white"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
