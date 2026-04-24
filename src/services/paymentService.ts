/// <reference types="vite/client" />
import axios from 'axios';

interface PixResponse {
  qrcode: string;
  qrcode_text: string;
  txid: string;
  is_fallback?: boolean;
}

interface PixPayer {
  name: string;
  email: string;
  cpf: string;
}

/**
 * Serviço para integração com o nosso backend (que por sua vez chama a Carteira do 7)
 */
export const createPixPayment = async (amount: number, description: string, payer: PixPayer): Promise<PixResponse> => {
  try {
    const response = await axios.post(`/api/payment/pix`, {
      amount,
      description,
      payer
    });

    return response.data;
  } catch (error) {
    console.error('Erro ao chamar API interna de Pix:', error);
    throw error;
  }
};
