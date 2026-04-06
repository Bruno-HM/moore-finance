export interface OFXTransaction {
  fitid: string;
  amount: number;
  date: string;
  memo: string;
  type: 'receita' | 'despesa';
}

/**
 * Parser de arquivos OFX (Extrato Bancário) portado para o backend
 */
export function parseOFX(data: string): OFXTransaction[] {
  const transactions: OFXTransaction[] = [];
  
  // Encontrar blocos <STMTTRN>
  const transactionBlocks = data.split(/<STMTTRN>/i).slice(1);

  for (const block of transactionBlocks) {
    const fitid = getTagValue(block, 'FITID');
    const trnamt = getTagValue(block, 'TRNAMT');
    const dtposted = getTagValue(block, 'DTPOSTED');
    const memo = getTagValue(block, 'MEMO') || getTagValue(block, 'NAME') || 'Transação Importada';
    
    if (fitid && trnamt && dtposted) {
      const amount = parseFloat(trnamt.replace(',', '.'));
      const type = amount >= 0 ? 'receita' : 'despesa';
      
      // Data no OFX: YYYYMMDDHHMMSS
      const year = dtposted.substring(0, 4);
      const month = dtposted.substring(4, 6);
      const day = dtposted.substring(6, 8);
      const isoDate = `${year}-${month}-${day}T12:00:00.000Z`;

      transactions.push({
        fitid,
        amount: Math.abs(amount),
        date: isoDate,
        memo: memo.trim(),
        type
      });
    }
  }

  return transactions;
}

function getTagValue(block: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
  const match = block.match(regex);
  return match ? match[1].trim() : null;
}
