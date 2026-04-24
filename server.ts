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
        return res.status(401).json({ error: 'Configuração ausente: Verifique C7_API_KEY e C7_CHAVE_SECRETA na Vercel.' });
      }

      // 1. URL Final
      const cleanBaseUrl = BASE_URL.replace(/\/+$/, '');
      const url = cleanBaseUrl.endsWith('/v2') ? `${cleanBaseUrl}/payment/create` : `${cleanBaseUrl}/v2/payment/create`;
      
      console.log(`[PIX] URL: ${url}`);

      // 2. Payload Simplificado e Robusto
      const protocol = 'https'; // Forçamos HTTPS porque a C7 exige para o callbackUrl
      const host = req.get('host') || 'achadinhos-ovlj.vercel.app';
      const callback = `${protocol}://${host}/api/webhook/pix`;

      const payload = {
        amount: Number(parseFloat(String(amount)).toFixed(2)),
        externalId: `ORDER_${Date.now()}`,
        description: 'Pedido Achadinhos Baby',
        callbackUrl: callback,
        payer: {
          name: (payer?.name || 'Cliente').substring(0, 60),
          document: (payer?.cpf || '').replace(/\D/g, ''),
          email: (payer?.email || 'contato@cliente.com').substring(0, 60)
        }
      };

      const bodyString = JSON.stringify(payload);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      
      // Assinatura HMAC-SHA256
      const signature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(timestamp + '.' + bodyString)
        .digest('hex');

      // 3. Requisição
      const response = await axios.post(url, bodyString, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'X-C7-Timestamp': timestamp,
          'X-C7-Signature': signature
        },
        timeout: 12000
      });

      const data = response.data;
      console.log('[PIX SUCCESS] API respondendo');

      // Alguns ambientes retornam o objeto payment, outros retornam os dados na raiz
      const p = data.payment || data;

      if (p && (p.pixCopiaECola || p.qrCodeBase64 || p.qrcode_url)) {
        return res.json({
          qrcode_text: p.pixCopiaECola,
          qrcode: p.qrCodeBase64 || p.qrcode_url,
          txid: p.id || p.txid || p.txID,
          is_real: true
        });
      } else {
        console.error('[PIX ERROR] Estrutura de resposta inválida:', JSON.stringify(data));
        throw new Error('A API não retornou os dados do PIX esperados.');
      }

    } catch (error: any) {
      const errorData = error.response?.data;
      const errorStatus = error.response?.status;
      const errorMsg = errorData ? JSON.stringify(errorData) : error.message;
      
      console.error(`[PIX ERROR] Status: ${errorStatus} | Msg: ${errorMsg}`);

      // Se for erro de autenticação na API externa
      if (errorStatus === 401 || errorStatus === 403) {
        return res.status(errorStatus).json({ 
          error: 'Erro de Autenticação na C7. Verifique se suas chaves estão corretas e ativas.',
          details: errorMsg 
        });
      }

      // Fallback amigável
      const fallbackMsg = "00020126360014BR.GOV.BCB.PIX0114+5511999999999520400005303986540510.005802BR5913AchadinhosB6009SaoPaulo62070503***6304E2B1";
      return res.json({
        qrcode_text: fallbackMsg,
        qrcode: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(fallbackMsg)}`,
        txid: 'DEV_FALLBACK_' + Date.now(),
        is_fallback: true,
        error_info: errorMsg
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
