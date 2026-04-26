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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.post('/api/payment/pix', async (req, res) => {
  const { amount, payer } = req.body;
  
  try {
    const API_KEY = (process.env.C7_API_KEY || '').trim();
    const SECRET_KEY = (process.env.C7_CHAVE_SECRETA || '').trim();

    if (!API_KEY || !SECRET_KEY) {
      console.error('[C7] Chaves ausentes nas variáveis de ambiente da Vercel.');
      return res.status(401).json({ 
        error: 'Configuração Incompleta',
        detail: 'As chaves C7_API_KEY ou C7_CHAVE_SECRETA não foram encontradas na Vercel.'
      });
    }

    const url = 'https://api.carteirado7.com/v2/payment/create';
    const externalId = `PEDIDO_${Date.now()}`;
    
    const payload = {
      amount: Number(parseFloat(String(amount)).toFixed(2)),
      externalId: externalId,
      callbackUrl: `https://achadinhos-baby.vercel.app/api/webhook/pix`,
      payer: {
        name: (payer?.name || 'Cliente Achadinhos')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, "")
          .substring(0, 60),
        document: (payer?.cpf || '00000000000')
          .replace(/\D/g, '')
          .substring(0, 11)
      }
    };

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyString = JSON.stringify(payload);
    
    const signature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(`${timestamp}.${bodyString}`)
      .digest('hex');
    
    console.log('[C7] Enviando requisição para:', url);
    console.log('[C7] Payload:', bodyString);

    const response = await axios({
      method: 'POST',
      url: url,
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-C7-Key': API_KEY,
        'X-C7-
