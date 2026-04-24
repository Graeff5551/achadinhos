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
    
    try {
      // 1. Configurações extraídas do ambiente
      const BASE_URL = (process.env.URL_BASE_C7 || 'https://api.carteirado7.com').trim();
      const API_KEY = (process.env.C7_API_KEY || '').trim();
      const SECRET_KEY = (process.env.C7_CHAVE_SECRETA || '').trim();

      // Diagnóstico detalhado para logs da Vercel
      if (!API_KEY || !SECRET_KEY) {
        console.error(`[C7 DEBUG] Erro de Ambiente: API_KEY(${API_KEY.length} carac.) ou SECRET_KEY(${SECRET_KEY.length} carac.) ausentes.`);
        return res.status(401).json({ 
          error: 'Configuração Incompleta',
          detail: `As chaves C7 não foram encontradas no ambiente. Verifique C7_API_KEY e C7_CHAVE_SECRETA na Vercel e faça um NOVO DEPLOY (Redeploy).`
        });
      }

      // 2. Construção da URL (Conforme documentação da imagem)
      const host = BASE_URL.replace('https://', '').replace('http://', '').split('/')[0];
      const url = `https://${host}/v2/payment/create`;
      
      console.log(`[C7] Solicitando PIX em: ${url}`);
      
      // 3. Payload - Seguindo os campos da imagem (WhatsApp)
      const externalId = `PEDIDO_${Date.now()}`;
      const payload: any = {
        amount: Number(parseFloat(String(amount)).toFixed(2)),
        externalId: externalId,
        callbackUrl: `https://${req.get('host') || 'achadinhos-baby.vercel.app'}/api/webhook/pix`,
        description: `Pedido ${externalId}`
      };

      // Adicionamos o payer se os dados básicos existirem
      if (payer && (payer.cpf || payer.document)) {
        payload.payer = {
          name: (payer.name || 'Cliente').normalize('NFD').replace(/[\u0300-\u036f]/g, "").substring(0, 60),
          document: (payer.cpf || payer.document).replace(/\D/g, '').substring(0, 14)
        };
      }

      const bodyString = JSON.stringify(payload);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      
      const signature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(timestamp + '.' + bodyString)
        .digest('hex');

      // 4. Requisição com Headers de Autenticação HMAC
      const response = await axios.post(url, bodyString, {
        headers: {
          'Authorization': `Bearer ${API_KEY.replace('Bearer ', '').trim()}`,
          'Content-Type': 'application/json',
          'X-C7-Timestamp': timestamp,
          'X-C7-Signature': signature
        },
        timeout: 12000
      });

      const data = response.data;
      const payment = data.payment || data;

      // Mapeamento de resposta (Suporte a múltiplos formatos C7)
      const qrCode = payment.pixCopiaECola || payment.qrcode_text || payment.pix_copia_e_cola;
      const qrImage = payment.qrCodeBase64 || payment.qrcode_url || payment.qrcode_base64;

      if (qrCode || qrImage) {
        console.log(`[C7 SUCESSO] Pix gerado: ${externalId}`);
        return res.json({
          qrcode_text: qrCode,
          qrcode: qrImage,
          txid: payment.id || payment.txid || payment.external_id || externalId,
          is_real: true
        });
      } else {
        throw new Error('QR Code não encontrado na resposta da API.');
      }

    } catch (error: any) {
      const errorData = error.response?.data;
      const errorStatus = error.response?.status;
      
      let detailMsg = error.message;
      if (errorData) {
        detailMsg = typeof errorData === 'object' 
          ? (errorData.detail || errorData.message || errorData.error?.message || JSON.stringify(errorData))
          : String(errorData);
      }
      
      console.error(`[C7 ERRO API] Status: ${errorStatus} | Msg: ${detailMsg}`);

      return res.status(errorStatus || 500).json({
        error: errorStatus === 401 ? 'Erro de Autenticação na C7' : 'Erro ao processar PIX',
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
