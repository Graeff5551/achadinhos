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
    const BASE_URL = (process.env.URL_BASE_C7 || 'https://api.carteirado7.com/v2').trim();
    const API_KEY = (process.env.C7_API_KEY || '').trim();
    const SECRET_KEY = (process.env.C7_CHAVE_SECRETA || '').trim();

    try {
      // Diagnóstico de Chaves
      if (!API_KEY || !SECRET_KEY) {
        const missing = [];
        if (!API_KEY) missing.push('C7_API_KEY');
        if (!SECRET_KEY) missing.push('C7_CHAVE_SECRETA');
        
        return res.status(401).json({ 
          error: 'Configuração faltante na Vercel',
          detail: `As variáveis [ ${missing.join(', ')} ] não foram detectadas. Verifique a aba de Environment Variables na Vercel.`
        });
      }

      // 1. URL Final - Garantindo HTTPS e v2
      let cleanBaseUrl = BASE_URL.replace(/\/+$/, '');
      if (cleanBaseUrl.endsWith('/v2')) {
        cleanBaseUrl = cleanBaseUrl.replace(/\/v2$/, '');
      }
      const url = `${cleanBaseUrl}/v2/payment/create`;
      
      // 2. Payload Robusto e Sanitizado
      const host = req.get('host') || 'achadinhos-ovlj.vercel.app';
      const callback = `https://${host}/api/webhook/pix`;

      const sanitizedName = (payer?.name || 'Cliente')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .substring(0, 60);

      const payload = {
        amount: Number(parseFloat(String(amount)).toFixed(2)),
        externalId: `ACH_${Date.now()}`,
        description: 'Pedido Achadinhos Baby',
        callbackUrl: callback,
        payer: {
          name: sanitizedName,
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

      // 3. Requisição (Timeout de 9s)
      const response = await axios.post(url, bodyString, {
        headers: {
          'Authorization': API_KEY.startsWith('Bearer') ? API_KEY : `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'X-C7-Timestamp': timestamp,
          'X-C7-Signature': signature
        },
        timeout: 9000
      });

      const data = response.data;
      const p = data.payment || data;

      if (p && (p.pixCopiaECola || p.qrCodeBase64 || p.qrcode_url)) {
        return res.json({
          qrcode_text: p.pixCopiaECola,
          qrcode: p.qrCodeBase64 || p.qrcode_url,
          txid: p.id || p.txid || p.txID,
          is_real: true
        });
      } else {
        throw new Error('A API C7 não retornou os dados do PIX esperados.');
      }

    } catch (error: any) {
      const errorData = error.response?.data;
      const errorStatus = error.response?.status;
      
      const c7Message = errorData?.error?.message || errorData?.message || JSON.stringify(errorData);
      const errorMsg = errorData ? c7Message : error.message;
      
      console.error(`[PIX ERROR] Status: ${errorStatus} | Msg: ${errorMsg}`);

      if (errorStatus === 401 || errorStatus === 403) {
        return res.status(errorStatus).json({ 
          error: 'Chave de API Inválida (401/403) na C7',
          detail: 'A C7 recusou a autenticação. Revise suas chaves e faça o Redeploy na Vercel.' 
        });
      }

      return res.status(errorStatus || 500).json({
        error: errorStatus === 500 ? 'Erro Interno (500) na C7' : 'Erro ao Gerar PIX',
        detail: errorMsg
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
