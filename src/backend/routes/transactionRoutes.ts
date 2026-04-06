import { Router } from 'express';
import { transactionController } from '../controllers/TransactionController';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', (req, res) => transactionController.createTransaction(req, res));
router.get('/', (req, res) => transactionController.getTransactions(req, res));
router.post('/import', upload.single('file'), (req, res) => transactionController.importTransactions(req, res));

export default router;
