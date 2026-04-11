# MooreFinance 🏦

Plataforma de gestão financeira pessoal de alta performance, projetada para controle rigoroso de fluxo de caixa, automação de despesas recorrentes e projeções de saldo futuro. 

---

## 🛠 Tech Stack

- **Frontend**: [Vite 6](https://vitejs.dev/) + [React 18](https://react.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) + [Shadcn UI](https://ui.shadcn.com/)
- **Backend/Bridge**: Express.js (Runtime: [tsx](https://github.com/privatenumber/tsx))
- **Database/Auth**: Firebase (Admin & Client SDK)
- **Data Viz**: Recharts
- **Parsers**: Custom OFX Engine & PDF Parse (Sicoob support)

## 🚀 Funcionalidades Core

### 1. Engine de Importação
Suporte robusto para importação de dados bancários via arquivos **OFX** e extratos **PDF** (Sicoob), garantindo conciliação bancária rápida sem dependência de APIs externas de agregação.

### 2. Projeção Cumulativa (Cumulative Forecast)
Algoritmo de previsão que calcula o saldo estimado para meses futuros com base no patrimônio líquido atual, salários configurados e despesas recorrentes projetadas.

### 3. Gestão Multi-usuário
Arquitetura baseada em *Households*, permitindo que membros da mesma família compartilhem o fluxo de caixa, salários e contas bancárias em tempo real.

### 4. Recorrências Inteligentes
Controle refinado de assinaturas, contas fixas e parcelamentos, com sistema de "sincronização" para garantir que valores pagos sejam baixados corretamente do saldo projetado.

---

## 💻 Desenvolvimento

### Pré-requisitos
- Node.js (v18+)
- Firebase Project

### Setup Inicial

1. **Instalação**:
   ```bash
   npm install
   ```

2. **Variáveis de Ambiente**:
   Crie um arquivo `.env` baseado no `.env.example`:
   ```env
   # Firebase Client Config (JSON String ou campos individuais)
   VITE_FIREBASE_CONFIG={...}

   # Admin SDK (Necessário para scripts de backend)
   FIREBASE_SERVICE_ACCOUNT={...}
   ```

3. **Execução**:
   ```bash
   npm run dev
   ```
   *O comando executa o servidor Express (`server.ts`) via `tsx`, servindo o frontend através do middleware do Vite.*

## 📂 Estrutura do Projeto

- `/src/backend`: Controladores e serviços para parse de arquivos e lógica de admin.
- `/src/components`: Componentes UI baseados em Shadcn e Framer Motion.
- `/src/contexts`: Gerenciamento de estado global (Auth e Finance).
- `/scripts`: Utilitários para manutenção e auditoria do banco de dados.

## 🔒 Segurança & Auditoria
O projeto utiliza **Firebase Security Rules** rigorosas para garantir isolamento de dados entre diferentes *Households*. Credenciais sensíveis são gerenciadas via variáveis de ambiente e nunca são expostas no controle de versão.

---
*Developed with focus on performance and data integrity.*

