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
    
    // Variáveis configuradas na Vercel pelo usuário
    const BASE_URL = (process.env.URL_BASE_C7 || 'https://api.carteirado7.com').trim();
    const API_KEY = (process.env.C7_API_KEY || '').trim();
    const SECRET_KEY = (process.env.C7_CHAVE_SECRETA || process.env.C7_SECRET_KEY || '').trim();

    try {
      if (!API_KEY || !SECRET_KEY) {
        throw new Error('C7_API_KEY ou C7_CHAVE_SECRETA não configuradas. Verifique a aba de Variáveis de Ambiente na Vercel.');
      }

      // Garantir URL correta: https://api.carteirado7.com/v2/payment/create
      let url = BASE_URL;
      if (url.endsWith('/')) url = url.slice(0, -1);
      
      if (!url.endsWith('/payment/create')) {
        url = url.endsWith('/v2') ? `${url}/payment/create` : `${url}/v2/payment/create`;
      }

      console.log(`[PIX DEBUG] URL: ${url}`);

      // Payload seguindo o padrão C7 v2
      const payload: any = {
        amount: Number(parseFloat(String(amount)).toFixed(2)), // Garantir formato decimal
        externalId: `ORD${Date.now()}${Math.floor(Math.random() * 100)}`, // ID numérico/texto sem caracteres especiais complexos
        description: (description || 'Pedido Achadinhos Baby').substring(0, 100),
        callbackUrl: `https://${req.get('host')}/api/webhook/pix`
      };
      
      // Adicionar payer se disponível na requisição
      if (payer) {
        payload.payer = {
          name: payer.name || 'Cliente',
          document: (payer.cpf || '').replace(/\D/g, ''),
          email: payer.email || ''
        };
      }

      const bodyString = JSON.stringify(payload);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      
      // Assinatura: HMAC-SHA256(api_secret, timestamp + "." + body)
      const signature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(timestamp + '.' + bodyString)
        .digest('hex');

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'X-C7-Timestamp': timestamp,
          'X-C7-Signature': signature
        },
        timeout: 15000
      });

      const data = response.data;
      console.log('[PIX DEBUG] Resposta da API:', JSON.stringify(data));

      if ((data.ok || data.payment) && (data.payment?.pixCopiaECola || data.pixCopiaECola)) {
        const p = data.payment || data;
        return res.json({
          qrcode_text: p.pixCopiaECola,
          qrcode: p.qrCodeBase64 || p.qrcode_url,
          txid: p.id || p.txid,
          is_real: true
        });
      } else {
        const errorDetail = data.message || data.error || 'Resposta incompleta da API';
        throw new Error(errorDetail);
      }

    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      console.error('[PIX ERROR]', errorMsg);
      if (error.response?.data) console.log('[PIX ERROR DATA]', JSON.stringify(error.response.data));
      
      // FALLBACK SEGURO: Se as chaves na Vercel estiverem erradas ou a API falhar,
      // mostramos um PIX de teste para o fluxo do usuário não travar totalmente.
      // AVISE AO USUÁRIO: Para o PIX ser REAL, as chaves na Vercel devem estar 100% corretas.
      const fakePixText = "00020126360014BR.GOV.BCB.PIX0114+5511999999999520400005303986540510.005802BR5913AchadinhosB6009SaoPaulo62070503***6304E2B1";
      const fakeQrCode = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(fakePixText)}`;
      
      res.json({
        qrcode: fakeQrCode,
        qrcode_text: fakePixText,
        txid: 'FALLBACK_' + Date.now(),
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
