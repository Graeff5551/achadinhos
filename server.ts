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
  
  const BASE_URL = process.env.C7_BASE_URL || 'https://api.carteirado7.com';
  const API_KEY = process.env.C7_API_KEY;
  const SECRET_KEY = process.env.C7_SECRET_KEY; // Chave api secreta

  try {
    if (!API_KEY || !SECRET_KEY) {
      console.warn('[WARN] Configurações de pagamento (API_KEY/SECRET_KEY) ausentes.');
      throw new Error('Config Missing');
    }

    const sanitizedBaseUrl = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
    // Força o endpoint da documentação
    const url = sanitizedBaseUrl.endsWith('/v2') 
      ? `${sanitizedBaseUrl}/payment/create` 
      : `${sanitizedBaseUrl}/v2/payment/create`;

    const payload = {
      amount: Number(amount), // Documentação usa float 150.00
      externalId: `ORDER_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      description: description || 'Pedido Achadinhos Baby',
    };

    const { timestamp, signature } = signRequest(SECRET_KEY, payload);

    console.log(`[INFO] Gerando PIX via C7: ${url}`);
    
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'X-C7-Timestamp': timestamp.toString(),
        'X-C7-Signature': signature
      },
      timeout: 10000
    });

    const data = response.data;
    console.log('[DEBUG] Resposta C7:', JSON.stringify(data, null, 2));

    if (data.ok && data.payment) {
      res.json({
        qrcode_text: data.payment.pixCopiaECola,
        qrcode: data.payment.qrCodeBase64,
        txid: data.payment.id
      });
    } else {
      throw new Error(data.message || 'Erro na API C7');
    }

  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
    console.error('[ERROR] Falha na API de Pagamento:', errorMsg);
    
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
