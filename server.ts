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
    // 1. Configurações da API (Lendo das variáveis de ambiente da Vercel)
    const API_KEY = (process.env.C7_API_KEY || '').trim();
    const SECRET_KEY = (process.env.C7_CHAVE_SECRETA || '').trim();

    if (!API_KEY || !SECRET_KEY) {
      console.error('[C7] Chaves ausentes nas variáveis de ambiente da Vercel.');
      return res.status(401).json({ 
        error: 'Configuração Incompleta',
        detail: 'As chaves C7_API_KEY ou C7_CHAVE_SECRETA não foram encontradas na Vercel.'
      });
    }

    // 2. Construção da URL e Payload
    const url = 'https://api.carteirado7.com/v2/payment/create';
    const externalId = `PEDIDO_${Date.now()}`;
    
    const payload = {
      amount: Number(parseFloat(String(amount)).toFixed(2)),
      externalId: externalId,
      callbackUrl: `https://${req.get('host') || 'achadinhos-baby.vercel.app'}/api/webhook/pix`,
      payer: {
        name: (payer?.name || 'Cliente Achadinhos').normalize('NFD').replace(/[\u0300-\u036f]/g, "").substring(0, 60),
        document: (payer?.cpf || '00000000000').replace(/\D/g, '').substring(0, 11)
      }
    };

    // 3. Geração da Assinatura HMAC-SHA256
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyString = JSON.stringify(payload);
    
    const signature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(`${timestamp}.${bodyString}`)
      .digest('hex');
    
    // 4. Requisição para a API C7
    const response = await axios({
      method: 'POST',
      url: url,
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-C7-Key': API_KEY,
        'X-C7-Timestamp': timestamp,
        'X-C7-Signature': signature,
        'Authorization': `Bearer ${API_KEY.replace('Bearer ', '').trim()}`
      },
      timeout: 15000
    });

    const data = response.data;
    const payment = data.payment || data;
    
    // Mapeamento flexível dos campos de retorno da C7
    const qrCode = payment.pixCopiaECola || payment.qrcode_text || payment.pix_copia_e_cola;
    const qrImage = payment.qrCodeBase64 || payment.qrcode_url || payment.qrcode_base64;

    if (qrCode || qrImage) {
      return res.json({
        qrcode_text: qrCode,
        qrcode: qrImage,
        txid: payment.id || externalId
      });
    } else {
      throw new Error('Resposta da API sem dados de pagamento.');
    }

  } catch (error: any) {
    const errorData = error.response?.data;
    const errorStatus = error.response?.status;
    
    console.error(`[C7 ERROR] Status: ${errorStatus} | Mensagem: ${error.message}`);

    return res.status(errorStatus || 500).json({
      error: 'Erro na API de Pagamento',
      detail: errorData?.message || errorData?.detail || error.message,
      hint: errorStatus === 401 ? 'Verifique suas chaves na Vercel.' : undefined
    });
  }
});

// Exporta o app para que a Vercel o trate como uma Serverless Function
export default app;

// Configuração para desenvolvimento local
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const startServer = async () => {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    
    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
    });
  };
  startServer();
}
