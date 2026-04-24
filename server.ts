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
    const { amount, payer } = req.body;
    
    // Configurações extraídas do ambiente Vercel
    const BASE_URL = (process.env.URL_BASE_C7 || 'https://api.carteirado7.com').trim();
    const API_KEY = (process.env.C7_API_KEY || '').trim();
    const SECRET_KEY = (process.env.C7_CHAVE_SECRETA || '').trim();

    try {
      // Diagnóstico de Chaves
      if (!API_KEY || !SECRET_KEY) {
        console.error('[C7] Chaves não configuradas no Ambiente.');
        return res.status(401).json({ 
          error: 'Configuração Incompleta',
          detail: 'As chaves C7 não foram encontradas. Se você já as adicionou na Vercel, faça um NOVO DEPLOY (Redeploy) para que elas entrem em vigor.'
        });
      }

      // 1. URL Final - Construção mais robusta
      let urlBase = BASE_URL.replace(/\/+$/, '');
      // Se a URL base já contém /v2, apenas adicionamos o caminho do endpoint.
      // O padrão da C7 para criação de PIX é /v2/payment/create
      let url = urlBase;
      if (!url.endsWith('/payment/create') && !url.endsWith('/pix')) {
        // Se a base for apenas o domínio, adiciona v2. Se já tiver v2, adiciona o resto.
        url = url.includes('/v2') ? `${urlBase}/payment/create` : `${urlBase}/v2/payment/create`;
      }
      
      console.log(`[C7] Chamando URL: ${url}`);
      
      // 2. Payload Padrão (camelCase)
      const externalId = `PEDIDO_${Date.now()}`;
      const payload = {
        amount: Number(parseFloat(String(amount)).toFixed(2)),
        externalId: externalId,
        callbackUrl: `https://${req.get('host')}/api/webhook/pix`,
        description: `Pedido ${externalId}`,
        payer: {
          name: (payer?.name || 'Cliente').normalize('NFD').replace(/[\u0300-\u036f]/g, "").substring(0, 60),
          document: (payer?.cpf || '00000000000').replace(/\D/g, ''),
          email: (payer?.email || 'contato@cliente.com').substring(0, 60)
        }
      };

      const bodyString = JSON.stringify(payload);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      
      const signature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(timestamp + '.' + bodyString)
        .digest('hex');

      // 3. Requisição
      const response = await axios.post(url, bodyString, {
        headers: {
          'Authorization': `Bearer ${API_KEY.replace('Bearer ', '').trim()}`,
          'Content-Type': 'application/json',
          'X-C7-Timestamp': timestamp,
          'X-C7-Signature': signature
        },
        timeout: 10000
      });

      const data = response.data;
      const payment = data.payment || data;

      // Suporte a formatos de resposta estáveis
      const qrCode = payment.pixCopiaECola || payment.qrcode_text || payment.pix_copia_e_cola;
      const qrImage = payment.qrCodeBase64 || payment.qrcode_url || payment.qrcode_base64;

      if (qrCode || qrImage) {
        return res.json({
          qrcode_text: qrCode,
          qrcode: qrImage,
          txid: payment.id || payment.txid || payment.external_id || externalId,
          is_real: true
        });
      } else {
        throw new Error('QR Code não encontrado na resposta.');
      }

    } catch (error: any) {
      const errorData = error.response?.data;
      const errorStatus = error.response?.status;
      
      let detailMsg = error.message;
      if (errorData) {
        detailMsg = typeof errorData === 'object' 
          ? (errorData.error?.message || errorData.message || JSON.stringify(errorData))
          : String(errorData);
      }
      
      console.error(`[C7 ERROR] Status: ${errorStatus} | Msg: ${detailMsg}`);

      return res.status(errorStatus || 500).json({
        error: errorStatus === 401 ? 'Erro de Autenticação na C7' : 'Erro no Pix',
        detail: detailMsg
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
