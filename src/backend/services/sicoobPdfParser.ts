import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import crypto from 'node:crypto';

export interface ParsedTransaction {
  date: string;
  title: string;
  amount: number;
  bankTransactionId: string;
}

/**
 * Parser especializado para faturas Sicoob (formato Cartão de Crédito)
 */
export async function parseSicoobPdf(buffer: Buffer): Promise<ParsedTransaction[]> {
  const data = await pdf(buffer);
  const text = data.text;
  const transactions: ParsedTransaction[] = [];

  // 1. Encontrar o ano base (Vencimento)
  // Exemplo: "Vencimento: 07/04/2026"
  const vencimentoMatch = text.match(/Vencimento:\s+(\d{2})\/(\d{2})\/(\d{4})/i);
  if (!vencimentoMatch) {
    throw new Error('Não foi possível identificar a data de vencimento na fatura Sicoob.');
  }

  const statementMonth = parseInt(vencimentoMatch[2]);
  const statementYear = parseInt(vencimentoMatch[3]);

  // 2. Extrair transações
  // Formato: "29/12","DESC ANUIDADE...","-8,00"
  // Regex: Captura a data, o título entre aspas e o valor final.
  const trxRegex = /"(\d{2}\/\d{2})","([^"]+)","([-?\d\.,]+)"/g;
  let match;

  while ((match = trxRegex.exec(text)) !== null) {
    const trxData = match[1]; // dd/mm
    const title = match[2].trim();
    const valueStr = match[3];

    // Normalização de Valor
    // Remove pontos de milhar, troca vírgula por ponto.
    let amount = parseFloat(valueStr.replace(/\./g, '').replace(',', '.'));
    
    // Regra Sicoob: Valores positivos são DESPESA. Negativos são PAGAMENTO/ESTORNO.
    // Ignoramos negativos conforme solicitado.
    if (amount <= 0) continue;

    // Inferência de Ano
    const [day, month] = trxData.split('/').map(Number);
    let year = statementYear;
    
    // Se o mês da transação (ex: 12) é maior que o mês da fatura (ex: 04), a transação é do ano anterior.
    if (month > statementMonth) {
      year = statementYear - 1;
    }

    const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T12:00:00.000Z`;

    // Idempotência: Gera um ID sintético baseado nos dados da transação
    const hash = crypto.createHash('md5')
      .update(`${isoDate}|${title}|${amount}`)
      .digest('hex');

    transactions.push({
      date: isoDate,
      title,
      amount,
      bankTransactionId: `pdf_sicoob_${hash}`
    });
  }

  return transactions;
}

