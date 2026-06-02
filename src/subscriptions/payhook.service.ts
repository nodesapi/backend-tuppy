import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class PayhookService {
  private readonly logger = new Logger(PayhookService.name);
  private readonly baseUrl = process.env.PAYHOOK_URL || 'https://api.cekbayar.com';
  private readonly apiKey = process.env.PAYHOOK_API_KEY;

  async createInvoice(payload: {
    amount: number;
    customer_name: string;
    customer_email?: string;
    external_id: string;
    description: string;
    channel_type?: string;
  }) {
    if (!this.apiKey) {
      this.logger.error('PAYHOOK_API_KEY is not defined in environment variables');
      throw new HttpException('Payment Gateway configuration is missing', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      const response = await axios.post(`${this.baseUrl}/api/v1/invoices`, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (response.data && response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data?.message || 'Failed to create invoice');
      }
    } catch (error: any) {
      this.logger.error(`Error calling Payhook API: ${error.message}`);
      if (error.response) {
        this.logger.error(`Payhook Response: ${JSON.stringify(error.response.data)}`);
      }
      throw new HttpException('Failed to communicate with Payment Gateway', HttpStatus.BAD_GATEWAY);
    }
  }
}
