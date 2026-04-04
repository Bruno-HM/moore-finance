import express from "express";
import { createServer as createViteServer } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";

// Rotas do nosso novo Backend Resolvido
import transactionRoutes from "./src/backend/routes/transactionRoutes.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middlewares essenciais do Backend Guidelines
  app.use(cors());
  app.use(express.json());

  // Injeção da API Isolada antes do SPA
  app.use("/api/transactions", transactionRoutes);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // RESOLVIDO: O erro de MIME type ocorre quando o Express não acha o arquivo no dist.
    // Usar path.resolve(__dirname, "dist") é mais seguro no Linux do Render.
    const distPath = path.resolve(__dirname, "dist");
    
    // Log de diagnóstico na inicialização
    import("node:fs").then((fs) => {
      if (fs.existsSync(distPath)) {
        console.log(`✅ Servindo arquivos estáticos de: ${distPath}`);
        if (fs.existsSync(path.join(distPath, "index.html"))) {
          console.log("✅ index.html encontrado na pasta dist.");
        } else {
          console.error("❌ ERRO: index.html NÃO ENCONTRADO na pasta dist!");
        }
      } else {
        console.error(`❌ ERRO: Pasta dist NÃO ENCONTRADA em: ${distPath}`);
      }
    });

    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
