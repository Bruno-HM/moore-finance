import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { Settings, Loader2, Copy, Check, Users, User, LogOut, ArrowRight, CreditCard as CreditCardIcon, Plus, Trash2, Building2, Wallet } from 'lucide-react';
import { useFinance } from '../contexts/FinanceContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { userProfile, updateProfile, joinHousehold, leaveHousehold, householdMembers } = useAuth();
  const [closingDay, setClosingDay] = useState<string>('');
  const [salary, setSalary] = useState<string>('');
  const [inviteCodeInput, setInviteCodeInput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { 
    creditCards, addCreditCard, deleteCreditCard, updateCreditCard,
    bankAccounts, addBankAccount, deleteBankAccount, updateBankAccount 
  } = useFinance();
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardClosing, setNewCardClosing] = useState('');
  const [newCardDue, setNewCardDue] = useState('');
  const [newCardBankId, setNewCardBankId] = useState('');
  const [newCardMemberId, setNewCardMemberId] = useState(userProfile?.uid || '');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [exceptionMonth, setExceptionMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [exceptionDay, setExceptionDay] = useState('');

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [newAccMemberId, setNewAccMemberId] = useState(userProfile?.uid || '');

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

  const handleDeleteAccount = async (id: string) => {
    // Check if account is linked to any card
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
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Configurações do Perfil
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Status do Grupo */}
          <div className="bg-neutral-50 dark:bg-neutral-900 p-4 rounded-lg border border-neutral-100 dark:border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isSharedGroup ? (
                  <Users className="w-4 h-4 text-blue-500" />
                ) : (
                  <User className="w-4 h-4 text-green-500" />
                )}
                <span className="text-sm font-medium">
                  {isSharedGroup ? 'Grupo Compartilhado' : 'Grupo Pessoal (Solo)'}
                </span>
              </div>
              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                isSharedGroup ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              }`}>
                Ativo
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {isSharedGroup 
                ? 'Você está visualizando e editando dados de um grupo compartilhado.' 
                : 'Você está visualizando seus dados financeiros individuais.'}
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2">Dados Financeiros</h3>
            <div className="space-y-2">
              <Label htmlFor="salary">Seu Salário Mensal (R$)</Label>
              <Input
                id="salary"
                type="number"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="Ex: 5000"
              />
              <p className="text-xs text-muted-foreground">
                Este valor é pessoal e não é compartilhado com outros membros.
              </p>
            </div>

            <div className="space-y-4 border rounded-lg p-4 bg-white dark:bg-neutral-900 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2"><Building2 className="w-4 h-4 text-primary"/> Contas Bancárias</h4>
                  <p className="text-xs text-muted-foreground">Onde seu dinheiro real fica guardado.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowAddAccount(!showAddAccount)}>
                  {showAddAccount ? 'Cancelar' : <><Plus className="w-4 h-4 mr-1"/> Novo</>}
                </Button>
              </div>

              {showAddAccount && (
                <div className="space-y-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-md border">
                  <div className="space-y-2">
                    <Label className="text-xs">Nome da Conta</Label>
                    <Input placeholder="Ex: Nubank, Personnalité..." value={newAccName} onChange={e => setNewAccName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Saldo Inicial (R$)</Label>
                    <Input type="number" step="0.01" value={newAccBalance} onChange={e => setNewAccBalance(e.target.value)} placeholder="0,00" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Dono da Conta</Label>
                      <Select value={newAccMemberId} onValueChange={setNewAccMemberId}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione o membro" />
                        </SelectTrigger>
                        <SelectContent>
                          {householdMembers?.map(member => (
                            <SelectItem key={member.uid} value={member.uid}>
                              {member.displayName} {member.uid === userProfile?.uid ? '(Você)' : ''}
                            </SelectItem>
                          )) || (
                            <SelectItem value={userProfile?.uid || ''}>
                              {userProfile?.displayName} (Você)
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                  </div>
                  <Button className="w-full" size="sm" onClick={handleAddAccount} disabled={actionLoading}>Adicionar Conta</Button>
                </div>
              )}

              {bankAccounts.length > 0 ? (
                <div className="space-y-2 mt-2">
                  {bankAccounts.map(acc => (
                    <div key={acc.id} className="flex items-center justify-between border p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                          <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{acc.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{getMemberName(acc.memberId)}</span>
                            <span className="text-muted-foreground/30">•</span>
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-black animate-in fade-in slide-in-from-left-2 duration-500">
                              Saldo: R$ {acc.currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteAccount(acc.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">Nenhuma conta cadastrada.</p>
              )}
            </div>

            <div className="space-y-4 border rounded-lg p-4 bg-white dark:bg-neutral-900 shadow-sm mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold flex items-center gap-2"><CreditCardIcon className="w-4 h-4"/> Cartões de Crédito</h4>
                  <p className="text-xs text-muted-foreground">Gerencie seus cartões para controle de faturas.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowAddCard(!showAddCard)}>
                  {showAddCard ? 'Cancelar' : <><Plus className="w-4 h-4 mr-1"/> Novo</>}
                </Button>
              </div>

              {showAddCard && (
                <div className="space-y-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-md border">
                  <Input placeholder="Nome (Ex: Nubank, Itaú...)" value={newCardName} onChange={e => setNewCardName(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Dia Fechamento</Label>
                      <Input type="number" min="1" max="31" value={newCardClosing} onChange={e => setNewCardClosing(e.target.value)} placeholder="Ex: 5" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Dia Vencimento</Label>
                      <Input type="number" min="1" max="31" value={newCardDue} onChange={e => setNewCardDue(e.target.value)} placeholder="Ex: 12" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Conta p/ Pagamento</Label>
                    <Select value={newCardBankId} onValueChange={setNewCardBankId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione a conta..." />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.name} ({getMemberName(acc.memberId)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dono do Cartão</Label>
                    <Select value={newCardMemberId} onValueChange={setNewCardMemberId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione o dono..." />
                      </SelectTrigger>
                      <SelectContent>
                        {householdMembers?.map(member => (
                          <SelectItem key={member.uid} value={member.uid}>
                            {member.displayName} {member.uid === userProfile?.uid ? '(Você)' : ''}
                          </SelectItem>
                        )) || (
                          <SelectItem value={userProfile?.uid || ''}>
                            {userProfile?.displayName} (Você)
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" size="sm" onClick={handleAddCard} disabled={actionLoading}>Adicionar Cartão</Button>
                </div>
              )}

              {creditCards.length > 0 ? (
                <div className="space-y-2 mt-2">
                  {creditCards.map(cc => (
                    <div key={cc.id} className="space-y-2 border p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <CreditCardIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold">{cc.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-primary uppercase font-black tracking-widest">{getBankName(cc.bankAccountId)}</span>
                              <span className="text-muted-foreground/30">•</span>
                              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{getMemberName(cc.memberId)}</span>
                              <span className="text-muted-foreground/30">•</span>
                              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tight">
                                Fechamento: {cc.closingDay} | Vencimento: {cc.dueDay}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={`h-8 w-8 ${editingCardId === cc.id ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
                            onClick={() => setEditingCardId(editingCardId === cc.id ? null : cc.id)}
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteCard(cc.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {editingCardId === cc.id && (
                        <div className="mt-3 pt-3 border-t space-y-4">
                          <div className="space-y-4 pt-2">
                            <div className="space-y-2">
                              <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Banco Vinculado</Label>
                              <Select 
                                value={cc.bankAccountId} 
                                onValueChange={(val) => handleUpdateCardBank(cc.id, val)}
                                disabled={actionLoading}
                              >
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue placeholder="Selecione um banco" />
                                </SelectTrigger>
                                <SelectContent>
                                  {bankAccounts.map(acc => (
                                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Dono do Cartão</Label>
                              <Select 
                                value={cc.memberId} 
                                onValueChange={(val) => handleUpdateCardMember(cc.id, val)}
                                disabled={actionLoading}
                              >
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue placeholder="Selecione o dono" />
                                </SelectTrigger>
                                <SelectContent>
                                  {householdMembers?.map(member => (
                                    <SelectItem key={member.uid} value={member.uid}>
                                      {member.displayName} {member.uid === userProfile?.uid ? '(Você)' : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                         </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Exceções de Fechamento</Label>
                            <div className="flex gap-2">
                              <Input 
                                type="month" 
                                value={exceptionMonth} 
                                onChange={e => setExceptionMonth(e.target.value)} 
                                className="h-9 text-xs"
                              />
                              <Input 
                                type="number" 
                                placeholder="Dia" 
                                value={exceptionDay} 
                                onChange={e => setExceptionDay(e.target.value)} 
                                className="h-9 w-20 text-xs"
                              />
                                <Button size="sm" className="h-9" onClick={() => handleAddException(cc.id)} disabled={actionLoading}>
                                  <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground italic">
                              * Use isso se o dia de fechamento mudar em um mês específico.
                            </p>
                          </div>

                          {cc.closingDayExceptions && Object.keys(cc.closingDayExceptions).length > 0 && (
                            <div className="space-y-1.5">
                              {Object.entries(cc.closingDayExceptions)
                                .sort((a, b) => b[0].localeCompare(a[0]))
                                .map(([month, day]) => (
                                <div key={month} className="flex items-center justify-between bg-white dark:bg-neutral-900 p-2 rounded border text-xs">
                                  <span className="font-medium">{month}</span>
                                  <div className="flex items-center gap-3">
                                    <span className="text-primary font-bold">Dia {day}</span>
                                    <button onClick={() => handleRemoveException(cc.id, month)} className="text-destructive hover:text-destructive/80">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">Nenhum cartão cadastrado.</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold border-b pb-2">Gestão de Grupo</h3>
            
            {/* Invite Code Display (Always show their personal one or current one?) */}
            {/* User said: "Envie este código para seu parceiro(a) entrar na mesma conta." */}
            <div className="space-y-2">
              <Label>Seu Código de Convite (Pessoal)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded border truncate">
                  {userProfile?.inviteCode || '...'}
                </code>
                <Button variant="outline" size="icon" onClick={copyInviteCode} disabled={!userProfile?.inviteCode}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Compartilhe este código para que alguém entre no seu grupo.
              </p>
            </div>

            {/* Join/Leave Actions */}
            <div className="pt-2 space-y-3">
              {!isSharedGroup ? (
                <div className="space-y-2">
                  <Label htmlFor="joinCode">Entrar em outro grupo</Label>
                  <div className="flex gap-2">
                    <Input
                      id="joinCode"
                      placeholder="Código do parceiro"
                      value={inviteCodeInput}
                      onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                      className="uppercase"
                    />
                    <Button 
                      variant="secondary" 
                      onClick={handleJoinGroup}
                      disabled={actionLoading || !inviteCodeInput}
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button 
                  variant="destructive" 
                  className="w-full" 
                  onClick={handleLeaveGroup}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
                  Sair do Grupo Compartilhado
                </Button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="p-8 border-t bg-neutral-50/50 dark:bg-neutral-900/50 backdrop-blur-md rounded-b-[3rem]">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading} className="rounded-2xl font-bold h-12 px-8">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading} className="rounded-2xl font-black h-12 px-10 shadow-xl shadow-primary/20">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar Tudo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
