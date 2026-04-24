import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Função para assinar a requisição conforme documentação da C7
function signRequest(apiSecret: string, body: any) {
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(timestamp + '.' + bodyString)
    .digest('hex');
  return { timestamp, signature };
}

  // Endpoint para criação de PIX via Carteira do 7
  app.post('/api/payment/pix', async (req, res) => {
    const { amount, description, payer } = req.body;
    
    // Sincronização com os nomes de variáveis que você usou na Vercel
    const BASE_URL = process.env.URL_BASE_C7 || process.env.C7_BASE_URL || 'https://api.carteirado7.com';
    const API_KEY = process.env.C7_API_KEY;
    const SECRET_KEY = process.env.C7_CHAVE_SECRETA || process.env.C7_SECRET_KEY; // Chave api secreta

    try {
      if (!API_KEY || !SECRET_KEY) {
        console.warn('[WARN] Configurações de pagamento (API_KEY/SECRET_KEY) ausentes.');
        throw new Error('Config Missing');
      }

      const sanitizedBaseUrl = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
      
      // Lista de possíveis endpoints baseados na documentação e curl compartilhado
      const endpoints = [
        sanitizedBaseUrl.includes('/payment/create') ? sanitizedBaseUrl : `${sanitizedBaseUrl}/payment/create`,
        sanitizedBaseUrl.endsWith('/v2') ? sanitizedBaseUrl : `${sanitizedBaseUrl}/v2`,
        `${sanitizedBaseUrl}/v2/payment/create`,
        sanitizedBaseUrl // Último recurso
      ];

      // Remove duplicatas e garante que são URLs únicas
      const uniqueEndpoints = [...new Set(endpoints)];

      let responseDetail = null;
      let lastErrorDetail = null;

      const payload = {
        amount: Number(amount),
        externalId: `ORD_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        description: description || 'Pedido Achadinhos Baby',
      };

      const bodyString = JSON.stringify(payload);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(timestamp + '.' + bodyString)
        .digest('hex');

      for (const url of uniqueEndpoints) {
        try {
          console.log(`[INFO] Tentando C7 no endpoint: ${url}`);
          const response = await axios.post(url, bodyString, {
            headers: {
              'Authorization': `Bearer ${API_KEY}`,
              'Content-Type': 'application/json',
              'X-C7-Timestamp': timestamp,
              'X-C7-Signature': signature
            },
            timeout: 10000
          });
          
          if (response.data && (response.data.ok || response.data.payment)) {
            responseDetail = response.data;
            break; 
          }
        } catch (e: any) {
          lastErrorDetail = e.response?.data || e.message;
          console.warn(`[WARN] Endpoint ${url} falhou:`, lastErrorDetail);
          // Continua para o próximo endpoint
        }
      }

      if (responseDetail) {
        const data = responseDetail;
        // Normalização flexível da resposta
        const payment = data.payment || data;
        const qrcode_text = payment.pixCopiaECola || payment.qrcode_text || payment.pix_code;
        const qrcode = payment.qrCodeBase64 || payment.qrcode || payment.url;
        const txid = payment.id || payment.txid || payment.transaction_id;

        if (!qrcode_text) {
          console.error('[ERROR] Dados de Pix ausentes na resposta:', JSON.stringify(data));
          throw new Error('PIX_DATA_MISSING');
        }

        return res.json({
          qrcode_text,
          qrcode,
          txid
        });
      } else {
        throw new Error(typeof lastErrorDetail === 'string' ? lastErrorDetail : JSON.stringify(lastErrorDetail));
      }

    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      console.error('[ERROR] Falha crítica na integração C7:', errorMsg);
      
      // Fallback seguro se tudo falhar, mas avisando o frontend
      const fakePixText = "00020126360014BR.GOV.BCB.PIX0114+5511999999999520400005303986540510.005802BR5913AchadinhosB6009SaoPaulo62070503***6304E2B1";
      const fakeQrCode = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(fakePixText)}`;
      
      res.json({
        qrcode: fakeQrCode,
        qrcode_text: fakePixText,
        txid: 'SIMULATED_' + Date.now(),
        is_fallback: true,
        error_detail: errorMsg
      });
    }
  });

// Webhook para receber confirmação de pagamento (placeholder)
app.post('/api/webhook/pix', (req, res) => {
  console.log('Webhook PIX recebido:', req.body);
  res.sendStatus(200);
});

// Integração com Vite para Desenvolvimento Local
// No Vercel, o Vercel cuida dos arquivos estáticos e das rotas
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  async function setupDevServer() {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
    });
  }
  setupDevServer();
}

export default app;
