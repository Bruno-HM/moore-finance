# MooreFinance 🏦

Plataforma de gestão financeira pessoal de alta performance, projetada para controle rigoroso de fluxo de caixa, automação de despesas recorrentes e projeções de saldo futuro.

---

## 🚀 Como Começar (Setup do Zero)

Este projeto foi desenhado para que qualquer pessoa possa hospedar sua própria instância privada. Para isso, você precisará configurar seu próprio projeto no Firebase.

### 1. Preparação do Banco de Dados (Firebase)

1.  Acesse o [Firebase Console](https://console.firebase.google.com/).
2.  Crie um novo projeto (ex: `MeuMooreFinance`).
3.  **Authentication:** Ative o método de login **Google**.
4.  **Firestore Database:** 
    *   Crie o banco de dados em **Production Mode**.
    *   Escolha a região mais próxima de você.
    *   Copie o conteúdo de `firestore.rules` (na raiz deste projeto) e cole na aba "Rules" do seu console Firestore.
5.  **Project Settings:**
    *   Crie um "Web App" dentro do seu projeto.
    *   Você receberá um objeto de configuração com `apiKey`, `appId`, etc. Você usará esses valores no passo 2.
6.  **Service Account (Opcional - para scripts):**
    *   Vá em `Project Settings` > `Service Accounts`.
    *   Clique em `Generate new private key`. Isso baixará um arquivo `.json`.
    *   Abra esse arquivo e copie o conteúdo completo (você vai colar no `.env`).

### 2. Configuração do Ambiente

1.  Clone o repositório.
2.  Instale as dependências: `npm install`.
3.  Crie um arquivo chamado `.env` na raiz do projeto e preencha seguindo o modelo abaixo (use os dados obtidos no passo 1):

```env
# Configurações do Firebase Client (Vite)
VITE_FIREBASE_API_KEY="AIza..."
VITE_FIREBASE_AUTH_DOMAIN="seu-projeto.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="seu-projeto-id"
VITE_FIREBASE_STORAGE_BUCKET="seu-projeto.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789"
VITE_FIREBASE_APP_ID="1:123456789:web:abcdef"

# Admin SDK (Necessário para rodar o backend local e scripts)
# Cole aqui o conteúdo do JSON da Service Account como uma string única
FIREBASE_SERVICE_ACCOUNT='{"type": "service_account", ...}'
```

---

## 🛠 Tech Stack

- **Frontend**: [Vite 6](https://vitejs.dev/) + [React 18](https://react.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) + [Shadcn UI](https://ui.shadcn.com/)
- **Backend**: Express.js (Runtime: [tsx](https://github.com/privatenumber/tsx))
- **Database/Auth**: Firebase (Admin & Client SDK)
- **Data Viz**: Recharts

---

## 💻 Desenvolvimento

### Execução Local
```bash
npm run dev
```
*O comando executa o servidor Express (`server.ts`) via `tsx`, servindo o frontend através do middleware do Vite.*

### Scripts de Auditoria
O projeto possui utilitários para manutenção do banco:
```bash
# Para encontrar households que ficaram sem membros ativos
npx tsx scripts/find-orphaned-households.ts
```

---

## 🔒 Segurança
O projeto utiliza **Firebase Security Rules** rigorosas para garantir que:
*   Usuários só vejam dados de seus próprios "Households".
*   Nenhuma informação sensível é enviada ao GitHub (estão no `.env`).
*   O acesso administrativo é restrito à sua chave privada local.

---
*Developed with focus on performance and data integrity.*

