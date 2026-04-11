import { Request, Response } from 'express';
import { transactionRepository, TransactionData } from '../repositories/TransactionRepository';
import { transactionService } from '../services/TransactionService';

export class TransactionController {
  
  async createTransaction(req: Request, res: Response): Promise<void> {
    try {
      // Backend Dev Guidelines: Controllers apenas coordenam requisições HTTP e delegam ao Service
      const data = req.body;
      if (!data.householdId || !data.amount) {
        res.status(400).json({ error: 'householdId e amount são obrigatórios.' });
        return;
      }

      // Delegação de regras pesadas (parcelamento, dias úteis, faturamento) para a camada de serviços
      const transactions = await transactionService.addTransaction(data);
      res.status(201).json(transactions);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro interno ao processar a transação.' });
    }
  }

  async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const householdId = req.query.householdId as string;
      if (!householdId) {
        res.status(400).json({ error: 'householdId query param é obrigatório.' });
        return;
      }

      const transactions = await transactionRepository.getByHousehold(householdId);
      res.status(200).json(transactions);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Erro interno ao buscar as transações.' });
    }
  }

  async importTransactions(req: Request, res: Response): Promise<void> {
    try {
      const { bankAccountId, householdId, uid } = req.body;
      const file = req.file;

      if (!file || !bankAccountId || !householdId || !uid) {
        res.status(400).json({ error: 'Dados incompletos para importação.' });
        return;
      }

      let parsed: any[] = [];
      const extension = file.originalname.split('.').pop()?.toLowerCase();

      // Roteador de Parser
      if (extension === 'ofx' || file.mimetype === 'application/x-ofx') {
        const text = file.buffer.toString('utf-8');
        const { parseOFX } = await import('../services/ofxParser');
        parsed = parseOFX(text).map(t => ({
          title: t.memo,
          amount: t.amount,
          date: t.date,
          bankTransactionId: t.fitid,
          type: t.type
        }));
      } else if (file.mimetype === 'application/pdf') {
        const { parseSicoobPdf } = await import('../services/sicoobPdfParser');
        const pdfTransactions = await parseSicoobPdf(file.buffer);
        parsed = pdfTransactions.map(t => ({
          ...t,
          type: 'despesa', // Faturas Sicoob são consideradas despesas por padrão no crédito
          paymentMethod: 'credito',
          status: 'pendente'
        }));
      } else {
        res.status(400).json({ error: 'Formato de arquivo não suportado.' });
        return;
      }

      // Verificação de Idempotência e Persistência
      const existingTransactions = await transactionRepository.getByHousehold(householdId);
      const existingIds = new Set(existingTransactions.map(t => t.bankTransactionId).filter(Boolean));

      let added = 0;
      let skipped = 0;

      for (const t of parsed) {
        if (existingIds.has(t.bankTransactionId)) {
          skipped++;
          continue;
        }

        const data: any = {
          ...t,
          householdId,
          createdBy: uid,
          recurrenceType: 'unica',
          categoryId: 'sem_categoria' // Fallback para categoria
        };

        // Delegar ao Service para calcular billingDate (faturamento de cartão)
        await transactionService.addTransaction(data);
        added++;
      }

      res.status(200).json({ added, skipped, total: parsed.length });

    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Erro ao importar transações.' });
    }
  }
}

export const transactionController = new TransactionController();


