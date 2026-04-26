import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Rota de saúde
  if (req.method === 'GET') {
    return res.json({ status: 'ok', time: new Date().toISOString() });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { amount, payer } = req.body;

  const API_KEY = (process.env.C7_API_KEY || '').trim();
  const SECRET_KEY = (process.env.C7_CHAVE_SECRETA || '').trim();

  if (!API_KEY || !SECRET_KEY) {
    return res.status(401).json({ error: 'Chaves C7 não configuradas na Vercel.' });
  }

  const externalId = `PEDIDO_${Date.now()}`;
  const payload = {
    amount: Number(parseFloat(String(amount)).toFixed(2)),
    externalId,
    callbackUrl: 'https://achadinhos-gamma.vercel.app/api/webhook/pix',
    payer: {
      name: (payer?.name || 'Cliente').normalize('NFD').replace(/[\u0300-\u036f]/g, '').substring(0, 60),
      document: (payer?.cpf || '00000000000').replace(/\D/g, '').substring(0, 11)
    }
  };

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyString = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(`${timestamp}.${bodyString}`).digest('hex');

  console.log('[C7] API_KEY presente:', !!API_KEY);
  console.log('[C7] SECRET_KEY presente:', !!SECRET_KEY);
  console.log('[C7] Payload:', bodyString);
  console.log('[C7] Timestamp:', timestamp);
  console.log('[C7] Signature:', signature);

  try {
    const response = await axios.post('https://api.carteirado7.com/v2/payment/create', payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-C7-Key': API_KEY,
        'X-C7-Timestamp': timestamp,
        'X-C7-Signature': signature
      },
      timeout: 15000
    });

    const payment = response.data.payment || response.data;
    const qrCode = payment.pixCopiaECola || payment.qrcode_text || payment.pix_copia_e_cola;
    const qrImage = payment.qrCodeBase64 || payment.qrcode_url || payment.qrcode_base64;

    return res.json({ qrcode_text: qrCode, qrcode: qrImage, txid: payment.id || externalId });

  } catch (error: any) {
    const errorData = error.response?.data;
    console.error('[C7 ERROR] Status:', error.response?.status);
    console.error('[C7 ERROR] Resposta completa:', JSON.stringify(errorData));
    return res.status(error.response?.status || 500).json({
      error: 'Erro na API de Pagamento',
      detail: errorData?.message || errorData?.detail || error.message,
      raw: errorData
    });
  }
}
