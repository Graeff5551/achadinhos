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
    
    // Variáveis configuradas na Vercel pelo usuário (Extraídas da captura de tela enviada)
    const BASE_URL = (process.env.URL_BASE_C7 || 'https://api.carteirado7.com').trim();
    const API_KEY = (process.env.C7_API_KEY || '').trim();
    const SECRET_KEY = (process.env.C7_CHAVE_SECRETA || '').trim();

    try {
      // Diagnóstico de Chaves
      if (!API_KEY || !SECRET_KEY) {
        const missing = [];
        if (!API_KEY) missing.push('C7_API_KEY');
        if (!SECRET_KEY) missing.push('C7_CHAVE_SECRETA');
        
        console.error(`[C7] Missing Keys: ${missing.join(', ')}`);
        return res.status(401).json({ 
          error: 'Configuração Incompleta',
          detail: `As variáveis [ ${missing.join(', ')} ] não foram detectadas. Se você já as colocou na Vercel, certifique-se de ter feito um NOVO DEPLOY (Redeploy).`
        });
      }

      // 1. URL Final - Garantindo HTTPS e v2
      let cleanBaseUrl = BASE_URL.replace(/\/+$/, '');
      if (cleanBaseUrl.endsWith('/v2')) {
        cleanBaseUrl = cleanBaseUrl.replace(/\/v2$/, '');
      }
      const url = `${cleanBaseUrl}/v2/payment/create`;
      
      // 2. Payload Minimalista (Seguindo estritamente a captura de tela da documentação)
      const host = req.get('host') || 'achadinhos-ovlj.vercel.app';
      const callback = `https://${host}/api/webhook/pix`;

      // Sanitização básica
      const sanitizedExternalId = `ID${Date.now()}`;

      const payload = {
        amount: Number(parseFloat(String(amount)).toFixed(2)),
        externalId: sanitizedExternalId,
        callbackUrl: callback,
        description: `Pedido ${sanitizedExternalId}`,
        payer: {
          name: "Cliente Achadinhos",
          document: (payer?.cpf || '').replace(/\D/g, '') || '00000000000',
          email: (payer?.email || 'contato@cliente.com').substring(0, 60)
        }
      };

      const bodyString = JSON.stringify(payload);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      
      const signature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(timestamp + '.' + bodyString)
        .digest('hex');

      console.log(`[C7] Requesting PIX. URL: ${url} | ID: ${sanitizedExternalId}`);

      const response = await axios.post(url, bodyString, {
        headers: {
          'Authorization': `Bearer ${API_KEY.trim().replace('Bearer ', '')}`,
          'Content-Type': 'application/json',
          'X-C7-Timestamp': timestamp,
          'X-C7-Signature': signature
        },
        timeout: 10000
      });

      const data = response.data;
      const p = data.payment || data;
      const qrCode = p.pixCopiaECola || p.qrcode_text || p.qrCode;
      const qrImage = p.qrCodeBase64 || p.qrcode_url || p.qrCodeUrl;

      if (qrCode || qrImage) {
        return res.json({
          qrcode_text: qrCode,
          qrcode: qrImage,
          txid: p.id || p.txid || sanitizedExternalId,
          is_real: true
        });
      } else {
        throw new Error('QR Code não encontrado na resposta da C7.');
      }

    } catch (error: any) {
      const errorData = error.response?.data;
      const errorStatus = error.response?.status;
      
      // Extrai mensagem da C7 ou erro geral
      let detailMsg = error.message;
      if (errorData) {
        detailMsg = typeof errorData === 'object' 
          ? (errorData.error?.message || errorData.message || JSON.stringify(errorData))
          : String(errorData);
      }
      
      console.error(`[PIX ERROR] Status: ${errorStatus} | Msg: ${detailMsg}`);

      // Se for 401/403, as chaves provavelmente estão erradas ou a assinatura falhou
      if (errorStatus === 401 || errorStatus === 403) {
        return res.status(errorStatus).json({ 
          error: 'Erro de Autenticação na C7',
          detail: 'A C7 recusou a chave ou a assinatura. Verifique se copiou as chaves de PRODUÇÃO corretamente e sem espaços.' 
        });
      }

      return res.status(errorStatus || 500).json({
        error: 'Erro no Processamento',
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
