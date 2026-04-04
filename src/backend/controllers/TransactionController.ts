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
}

export const transactionController = new TransactionController();
