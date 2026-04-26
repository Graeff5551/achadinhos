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

// Rota de saúde para verificar se o servidor está respondendo
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Endpoint para criação de PIX via Carteira do 7
app.post('/api/payment/pix', async (req, res) => {
  const { amount, payer } = req.body;
  
  try {
    // 1. Configurações da API (Conforme print da Vercel)
    const BASE_URL = (process.env.URL_BASE_C7 || 'https://api.carteirado7.com/v2').trim();
    const API_KEY = (process.env.C7_API_KEY || '').trim();
    const SECRET_KEY = (process.env.C7_CHAVE_SECRETA || '').trim();

    if (!API_KEY || !SECRET_KEY) {
      console.error('[C7] Chaves ausentes nas variáveis de ambiente da Vercel.');
      return res.status(401).json({ 
        error: 'Chaves não configuradas',
        detail: 'C7_API_KEY ou C7_CHAVE_SECRETA não encontradas.'
      });
    }

    // 2. Construção da URL
    const apiPath = '/v2/payment/create';
    const cleanBase = BASE_URL.replace(/\/+$/, '').replace(/\/v2$/, '');
    const url = `${cleanBase}${apiPath}`;
    
    // 3. Payload (Conforme exemplo da imagem, garantindo ordem das chaves)
    // Nota: O C7 pode ser sensível à ordem das chaves na assinatura.
    const externalId = `PEDIDO_${Date.now()}`;
    const payload = {
      amount: Number(parseFloat(String(amount)).toFixed(2)),
      externalId: externalId,
      callbackUrl: `https://${req.get('host') || 'achadinhos-baby.vercel.app'}/api/webhook/pix`
    };

    // 4. Geração da Assinatura HMAC-SHA256
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyString = JSON.stringify(payload);
    
    // IMPORTANTE: A assinatura deve ser timestamp + "." + body stringificado sem espaços
    const signature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(`${timestamp}.${bodyString}`)
      .digest('hex');
    
    console.log(`[C7 DEBUG] URL: ${url}`);
    console.log(`[C7 DEBUG] Payload: ${bodyString}`);
    console.log(`[C7 DEBUG] Timestamp: ${timestamp}`);
    console.log(`[C7 DEBUG] Signature: ${signature}`);

    // 5. Requisição para a API C7
    const response = await axios({
      method: 'POST',
      url: url,
      data: payload, // Axios enviará como JSON automaticamente
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY.replace('Bearer ', '').trim()}`,
        'X-C7-Timestamp': timestamp,
        'X-C7-Signature': signature
      },
      timeout: 10000
    });

    const data = response.data;
    const payment = data.payment || data;
    const qrCode = payment.pixCopiaECola || payment.qrcode_text || payment.pix_copia_e_cola;
    const qrImage = payment.qrCodeBase64 || payment.qrcode_url || payment.qrcode_base64;

    if (qrCode || qrImage) {
      console.log(`[C7 SUCCESS] PIX gerado: ${externalId}`);
      return res.json({
        qrcode_text: qrCode,
        qrcode: qrImage,
        txid: payment.id || externalId,
        is_real: true
      });
    } else {
      throw new Error('Resposta da API sem dados de pagamento.');
    }

  } catch (error: any) {
    const errorData = error.response?.data;
    const errorStatus = error.response?.status;
    
    let detailMsg = error.message;
    if (errorData) {
      detailMsg = typeof errorData === 'object' 
        ? (errorData.detail || errorData.message || JSON.stringify(errorData))
        : String(errorData);
    }
    
    console.error(`[C7 ERROR] Status: ${errorStatus} | Mensagem: ${detailMsg}`);

    return res.status(errorStatus || 500).json({
      error: errorStatus === 401 ? 'Não autorizado na C7' : 'Erro na API de Pix',
      detail: detailMsg,
      hint: errorStatus === 401 ? 'Verifique se a SECRET_KEY e API_KEY estão corretas na Vercel e faça um novo deploy.' : undefined
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
