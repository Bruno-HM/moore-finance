import { Router } from 'express';
import { transactionController } from '../controllers/TransactionController';

const router = Router();

router.post('/', (req, res) => transactionController.createTransaction(req, res));
router.get('/', (req, res) => transactionController.getTransactions(req, res));

export default router;
