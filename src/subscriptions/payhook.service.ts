import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PayhookService {
  private readonly logger = new Logger(PayhookService.name);
  private readonly internalSecret =
    process.env.TUPPLY_INTERNAL_SECRET || 'tupply-dev-secret-key-12345';

  constructor(private readonly prisma: PrismaService) {}

  private async getConfig() {
    const config = await this.prisma.systemConfig.findMany({
      where: { key: { in: ['PAYHOOK_URL', 'PAYHOOK_GLOBAL_API_KEY'] } },
    });

    const dbConfig = config.reduce(
      (acc, curr) => {
        acc[curr.key] = curr.value;
        return acc;
      },
      {} as Record<string, string>,
    );

    return {
      baseUrl:
        dbConfig['PAYHOOK_URL'] ||
        process.env.PAYHOOK_URL ||
        'http://localhost:8000',
      apiKey: dbConfig['PAYHOOK_GLOBAL_API_KEY'] || process.env.PAYHOOK_API_KEY,
    };
  }

  async createInvoice(
    payload: {
      amount: number;
      customer_name: string;
      customer_email?: string;
      external_id: string;
      description: string;
      payment_channel_id?: number;
      duration?: number;
    },
    customApiKey?: string,
  ) {
    const config = await this.getConfig();
    const keyToUse = customApiKey || config.apiKey;
    if (!keyToUse) {
      this.logger.error(
        'PAYHOOK_API_KEY is not defined in database or environment variables',
      );
      throw new HttpException(
        'Payment Gateway configuration is missing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const response = await axios.post(
        `${config.baseUrl}/api/v1/invoices`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${keyToUse}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );

      if (response.data && response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data?.message || 'Failed to create invoice');
      }
    } catch (error: any) {
      this.logger.error(`Error calling Payhook API: ${error.message}`);
      if (error.response) {
        this.logger.error(
          `Payhook Response: ${JSON.stringify(error.response.data)}`,
        );
      }
      throw new HttpException(
        'Failed to communicate with Payment Gateway',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async getInvoice(invoiceNumber: string, customApiKey?: string) {
    const config = await this.getConfig();
    const keyToUse = customApiKey || config.apiKey;
    if (!keyToUse) {
      throw new HttpException(
        'Payment Gateway configuration is missing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const response = await axios.get(
        `${config.baseUrl}/api/v1/invoices/${invoiceNumber}`,
        {
          headers: {
            Authorization: `Bearer ${keyToUse}`,
            Accept: 'application/json',
          },
        },
      );

      if (response.data && response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (error: any) {
      this.logger.error(
        `Error calling Payhook API getInvoice: ${error.message}`,
      );
      return null;
    }
  }

  async getChannels(customApiKey?: string) {
    const config = await this.getConfig();
    const keyToUse = customApiKey || config.apiKey;
    if (!keyToUse) {
      this.logger.error(
        'PAYHOOK_API_KEY is not defined in database or environment variables',
      );
      throw new HttpException(
        'Payment Gateway configuration is missing',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const response = await axios.get(`${config.baseUrl}/api/v1/channels`, {
        headers: {
          Authorization: `Bearer ${keyToUse}`,
          Accept: 'application/json',
        },
      });

      if (response.data && response.data.success) {
        return response.data.data;
      } else {
        throw new Error(
          response.data?.message || 'Failed to fetch payment channels',
        );
      }
    } catch (error: any) {
      this.logger.error(`Error calling Payhook API channels: ${error.message}`);
      throw new HttpException(
        'Failed to fetch payment channels',
        HttpStatus.BAD_GATEWAY,
      );
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
      const config = await this.getConfig();
      const response = await axios.post(
        `${config.baseUrl}/api/internal/tupply/merchants`,
        payload,
        {
          headers: {
            'X-Tupply-Secret': this.internalSecret,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );

      if (response.data && response.data.success) {
        return response.data.data; // contains tenant_id, user_id, api_key_production
      } else {
        throw new Error(
          response.data?.message || 'Failed to provision Payhook account',
        );
      }
    } catch (error: any) {
      this.logger.error(`Error provisioning Payhook account: ${error.message}`);
      if (error.response) {
        this.logger.error(
          `Payhook Response: ${JSON.stringify(error.response.data)}`,
        );
      }
      throw new HttpException(
        'Failed to auto-register Payhook account',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async uploadQris(tenantId: string | number, file: Express.Multer.File) {
    try {
      const formData = new FormData();
      // Bypass TypeScript's strict ArrayBufferLike check using 'any'
      const blob = new Blob([file.buffer as any], { type: file.mimetype });
      formData.append('qris_image', blob, file.originalname);

      const config = await this.getConfig();
      const response = await axios.post(
        `${config.baseUrl}/api/internal/tupply/merchants/${tenantId}/qris`,
        formData,
        {
          headers: {
            'X-Tupply-Secret': this.internalSecret,
            Accept: 'application/json',
            // FormData headers are automatically set
          },
        },
      );

      if (response.data && response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data?.message || 'Failed to upload QRIS');
      }
    } catch (error: any) {
      this.logger.error(`Error uploading QRIS to Payhook: ${error.message}`);
      if (error.response) {
        this.logger.error(
          `Payhook Response: ${JSON.stringify(error.response.data)}`,
        );
      }
      throw new HttpException(
        'Failed to upload QRIS to Payhook',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
