import React, { useState } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { motion, AnimatePresence } from 'motion/react';
import { Wallet, TrendingUp, CreditCard as CardIcon, Sparkles, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface OnboardingWizardProps {
  onComplete: () => void;
}

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { addBankAccount, addTransaction, addCreditCard, categories, bankAccounts } = useFinance();
  const { user, updateProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form States
  const [bankName, setBankName] = useState('');
  const [bankBalance, setBankBalance] = useState('');
  
  const [incomeValue, setIncomeValue] = useState('');

  const [cardName, setCardName] = useState('');
  const [cardLimit, setCardLimit] = useState('');
  const [cardClosingDay, setCardClosingDay] = useState('5');
  const [cardDueDay, setCardDueDay] = useState('10');

  const handleStep1 = async () => {
    if (!bankName || !bankBalance) return toast.error('Preencha os campos da conta.');
    setStep(2);
  };

  const handleStep2 = async () => {
    if (!incomeValue) return toast.error('Preencha o valor do seu salário.');
    setStep(3);
  };

  const handleFinalize = async () => {
    if (!cardName) return toast.error('Preencha o nome do cartão.');
    
    setLoading(true);
    try {
      // 1. Create Bank Account
      await addBankAccount({
        name: bankName,
        initialBalance: Number(bankBalance),
        memberId: user?.uid || ''
      });

      // 2. Update Salary in Profile (as requested)
      if (user && updateProfile) {
        await updateProfile({ 
          salary: Number(incomeValue) 
        });
      }

      // 3. Add Credit Card
      // We'll wait a tiny bit for the bank account to be available in state for the link
      setTimeout(async () => {
        // Link to the first account (the one we just made)
        const latestBankId = bankAccounts[0]?.id;
        
        await addCreditCard({
          name: cardName,
          closingDay: Number(cardClosingDay),
          dueDay: Number(cardDueDay),
          memberId: user?.uid || '',
          bankAccountId: latestBankId || ''
        });

        toast.success('Configuração inicial concluída!');
        onComplete();
      }, 800);

    } catch (error) {
      console.error('Onboarding Error:', error);
      toast.error('Ocorreu um erro ao salvar seus dados.');
    } finally {
      setLoading(false);
    }
  };

  const stepData = [
    {
      id: 1,
      title: "Bem-vindo ao MooreFinance.",
      subtitle: "Qual o nome da sua Conta Bancária principal e o saldo atual?",
      icon: <Wallet className="w-8 h-8 text-primary" />,
      fields: (
        <div className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-white/30 ml-1">Nome do Banco</Label>
            <Input 
              placeholder="Ex: Nubank, Itaú..." 
              value={bankName}
              onChange={e => setBankName(e.target.value)}
              className="h-14 bg-white/5 border-none rounded-2xl px-6 text-lg font-bold"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-white/30 ml-1">Saldo Atual</Label>
            <Input 
              type="number"
              placeholder="0,00" 
              value={bankBalance}
              onChange={e => setBankBalance(e.target.value)}
              className="h-14 bg-white/5 border-none rounded-2xl px-6 text-lg font-bold"
            />
          </div>
        </div>
      ),
      button: (
        <Button 
          onClick={handleStep1}
          className="flex-[2] h-14 bg-primary text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          Próximo Passo <ArrowRight className="w-4 h-4" />
        </Button>
      )
    },
    {
      id: 2,
      title: "Sua base financeira",
      subtitle: "Qual o seu salário mensal? Usaremos isso para calcular suas previsões e saldo futuro automaticamente.",
      icon: <TrendingUp className="w-8 h-8 text-emerald-500" />,
      fields: (
        <div className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-white/30 ml-1">Seu Salário Mensal (Líquido)</Label>
            <Input 
              type="number"
              placeholder="R$ 0,00" 
              value={incomeValue}
              onChange={e => setIncomeValue(e.target.value)}
              className="h-14 bg-white/5 border-none rounded-2xl px-6 text-lg font-bold"
            />
          </div>
        </div>
      ),
      button: (
        <Button 
          onClick={handleStep2}
          className="flex-[2] h-14 bg-primary text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          Quase lá <ArrowRight className="w-4 h-4" />
        </Button>
      )
    },
    {
      id: 3,
      title: "O Motor de Faturas",
      subtitle: "Anotado! Agora cadastre um cartão de crédito para ser selecionado ao realizar transações!",
      icon: <CardIcon className="w-8 h-8 text-blue-500" />,
      fields: (
        <div className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase text-white/30 ml-1">Nome do Cartão</Label>
            <Input 
              placeholder="Ex: Nubank, Azul..." 
              value={cardName}
              onChange={e => setCardName(e.target.value)}
              className="h-14 bg-white/5 border-none rounded-2xl px-6 text-lg font-bold"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-white/30 ml-1">Fechamento</Label>
              <Input 
                type="number"
                placeholder="Dia" 
                value={cardClosingDay}
                onChange={e => setCardClosingDay(e.target.value)}
                className="h-14 bg-white/5 border-none rounded-2xl px-2 text-center text-lg font-bold"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-white/30 ml-1">Vencimento</Label>
              <Input 
                type="number"
                placeholder="Dia" 
                value={cardDueDay}
                onChange={e => setCardDueDay(e.target.value)}
                className="h-14 bg-white/5 border-none rounded-2xl px-2 text-center text-lg font-bold"
              />
            </div>
          </div>
        </div>
      ),
      button: (
        <Button 
          onClick={handleFinalize}
          disabled={loading}
          className="flex-[2] h-14 bg-emerald-500 text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Finalizar e Explorar <Sparkles className="w-4 h-4 ml-1" /></>}
        </Button>
      )
    }
  ];

  const currentStepData = stepData.find(s => s.id === step);

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-3xl flex items-center justify-center p-6 sm:p-0">
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="bg-neutral-900/50 border border-white/5 rounded-[2.5rem] p-8 shadow-2xl space-y-8"
          >
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex gap-1.5">
                  {[1, 2, 3].map(i => (
                    <div 
                      key={i} 
                      className={`h-1 rounded-full transition-all duration-500 ${i === step ? 'w-8 bg-primary' : (i < step ? 'w-4 bg-emerald-500' : 'w-4 bg-white/10')}`} 
                    />
                  ))}
                </div>
                <span className="text-[10px] font-black uppercase text-white/20 tracking-widest">Setup {step}/3</span>
              </div>

              <div className="space-y-4">
                <div className="w-16 h-16 rounded-[1.5rem] bg-white/5 flex items-center justify-center">
                  {currentStepData?.icon}
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white tracking-tighter leading-tight">{currentStepData?.title}</h2>
                  <p className="text-sm text-white/40 font-medium leading-relaxed">{currentStepData?.subtitle}</p>
                </div>
              </div>
            </div>

            {currentStepData?.fields}

            <div className="pt-2 flex gap-3">
              {step > 1 && (
                <Button 
                  onClick={() => setStep(step - 1)}
                  variant="ghost"
                  className="flex-1 h-14 border border-white/5 text-white/40 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-white/5 active:scale-[0.98] transition-all"
                >
                  Voltar
                </Button>
              )}
              {currentStepData?.button}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest text-center">Configuração Segura por MooreFinance</span>
          </div>
        </div>
      </div>
    </div>
  );
}

