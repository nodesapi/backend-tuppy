import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class PayhookService {
  private readonly logger = new Logger(PayhookService.name);
  private readonly baseUrl = process.env.PAYHOOK_URL || 'http://localhost:8000';
  private readonly apiKey = process.env.PAYHOOK_API_KEY;
  private readonly internalSecret = process.env.TUPPLY_INTERNAL_SECRET || 'tupply-dev-secret-key-12345';

  async createInvoice(payload: {
    amount: number;
    customer_name: string;
    customer_email?: string;
    external_id: string;
    description: string;
    payment_channel_id?: number;
  }, customApiKey?: string) {
    const keyToUse = customApiKey || this.apiKey;
    if (!keyToUse) {
      this.logger.error('PAYHOOK_API_KEY is not defined in environment variables or passed as parameter');
      throw new HttpException('Payment Gateway configuration is missing', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      const response = await axios.post(`${this.baseUrl}/api/v1/invoices`, payload, {
        headers: {
          'Authorization': `Bearer ${keyToUse}`,
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

  async getInvoice(invoiceNumber: string) {
    if (!this.apiKey) {
      throw new HttpException('Payment Gateway configuration is missing', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/invoices/${invoiceNumber}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
      });

      if (response.data && response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (error: any) {
      this.logger.error(`Error calling Payhook API getInvoice: ${error.message}`);
      return null;
    }
  }

  async getChannels() {
    if (!this.apiKey) {
      this.logger.error('PAYHOOK_API_KEY is not defined in environment variables');
      throw new HttpException('Payment Gateway configuration is missing', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/channels`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
      });

      if (response.data && response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data?.message || 'Failed to fetch payment channels');
      }
    } catch (error: any) {
      this.logger.error(`Error calling Payhook API channels: ${error.message}`);
      throw new HttpException('Failed to fetch payment channels', HttpStatus.BAD_GATEWAY);
    }
  }

  // Internal Auto-Provisioning APIs
  async provisionPayhookAccount(payload: {
    name: string;
    email: string;
    phone?: string;
    password_hash: string;
    domain?: string;
    expired_at?: string;
    callback_url?: string;
  }) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/internal/tupply/merchants`, payload, {
        headers: {
          'X-Tupply-Secret': this.internalSecret,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (response.data && response.data.success) {
        return response.data.data; // contains tenant_id, user_id, api_key_production
      } else {
        throw new Error(response.data?.message || 'Failed to provision Payhook account');
      }
    } catch (error: any) {
      this.logger.error(`Error provisioning Payhook account: ${error.message}`);
      if (error.response) {
        this.logger.error(`Payhook Response: ${JSON.stringify(error.response.data)}`);
      }
      throw new HttpException('Failed to auto-register Payhook account', HttpStatus.BAD_GATEWAY);
    }
  }

  async uploadQris(tenantId: string | number, file: Express.Multer.File) {
    try {
      const formData = new FormData();
      // Bypass TypeScript's strict ArrayBufferLike check using 'any'
      const blob = new Blob([file.buffer as any], { type: file.mimetype });
      formData.append('qris_image', blob, file.originalname);

      const response = await axios.post(`${this.baseUrl}/api/internal/tupply/merchants/${tenantId}/qris`, formData, {
        headers: {
          'X-Tupply-Secret': this.internalSecret,
          'Accept': 'application/json',
          // FormData headers are automatically set
        },
      });

      if (response.data && response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data?.message || 'Failed to upload QRIS');
      }
    } catch (error: any) {
      this.logger.error(`Error uploading QRIS to Payhook: ${error.message}`);
      if (error.response) {
        this.logger.error(`Payhook Response: ${JSON.stringify(error.response.data)}`);
      }
      throw new HttpException('Failed to upload QRIS to Payhook', HttpStatus.BAD_GATEWAY);
    }
  }
}
