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
      // 1. Configurações e Limpeza de Chaves
      const BASE_URL = (process.env.URL_BASE_C7 || 'https://api.carteirado7.com').trim();
      const API_KEY = (process.env.C7_API_KEY || '').trim();
      const SECRET_KEY = (process.env.C7_CHAVE_SECRETA || '').trim();

      // Diagnóstico seguro nos logs da Vercel
      if (!API_KEY || !SECRET_KEY) {
        console.error('[C7] ERRO: Chaves API_KEY ou SECRET_KEY ausentes.');
        return res.status(401).json({ 
          error: 'Configuração Incompleta',
          detail: 'As chaves C7 não foram encontradas no ambiente.'
        });
      }

      // 2. Construção da URL - Evitando o 404
      // Removemos qualquer path da base e fixamos o endpoint da Documentação
      const host = BASE_URL.replace('https://', '').replace('http://', '').split('/')[0];
      const url = `https://${host}/v2/payment/create`;
      
      console.log(`[C7] Chamando Endpoint: ${url}`);
      
      // 3. Payload - Seguindo EXATAMENTE a imagem da documentação (WhatsApp)
      const externalId = `PEDIDO_${Date.now()}`;
      const payload: any = {
        amount: Number(parseFloat(String(amount)).toFixed(2)),
        externalId: externalId,
        callbackUrl: `https://${req.get('host')}/api/webhook/pix`
      };

      // Adicionamos o payer apenas se existir, pois não está no exemplo básico da imagem
      if (payer) {
        payload.payer = {
          name: (payer.name || 'Cliente').normalize('NFD').replace(/[\u0300-\u036f]/g, "").substring(0, 60),
          document: (payer.cpf || payer.document || '00000000000').replace(/\D/g, '').substring(0, 14)
        };
      }

      const bodyString = JSON.stringify(payload);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      
      const signature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(timestamp + '.' + bodyString)
        .digest('hex');

      // 4. Requisição com Headers exatos da imagem
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
