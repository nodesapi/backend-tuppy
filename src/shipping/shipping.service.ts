import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  private async getRajaOngkirConfig() {
    const apiKeyConfig = await this.prisma.systemConfig.findUnique({ where: { key: 'RAJAONGKIR_API_KEY' } });
    const typeConfig = await this.prisma.systemConfig.findUnique({ where: { key: 'RAJAONGKIR_TYPE' } });

    if (!apiKeyConfig || !apiKeyConfig.value) {
      throw new HttpException('RajaOngkir API Key is not configured by Admin.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const type = (typeConfig?.value || 'starter').toLowerCase();
    let baseUrl = 'https://api.rajaongkir.com/starter';
    if (type === 'basic') baseUrl = 'https://api.rajaongkir.com/basic';
    if (type === 'pro') baseUrl = 'https://pro.rajaongkir.com/api';

    return {
      apiKey: apiKeyConfig.value,
      type,
      baseUrl,
    };
  }

  async getProvinces() {
    const config = await this.getRajaOngkirConfig();
    try {
      const response = await axios.get(`${config.baseUrl}/province`, {
        headers: { key: config.apiKey },
      });
      return response.data.rajaongkir.results;
    } catch (error) {
      throw new HttpException(error.response?.data?.rajaongkir?.status?.description || 'Failed to fetch provinces', HttpStatus.BAD_REQUEST);
    }
  }

  async getCities(provinceId?: string) {
    const config = await this.getRajaOngkirConfig();
    try {
      const url = provinceId ? `${config.baseUrl}/city?province=${provinceId}` : `${config.baseUrl}/city`;
      const response = await axios.get(url, {
        headers: { key: config.apiKey },
      });
      return response.data.rajaongkir.results;
    } catch (error) {
      throw new HttpException(error.response?.data?.rajaongkir?.status?.description || 'Failed to fetch cities', HttpStatus.BAD_REQUEST);
    }
  }

  async getCost(origin: string, destination: string, weight: number, courier: string) {
    const config = await this.getRajaOngkirConfig();
    try {
      // Note: if using 'pro' type, the payload might need originType/destinationType
      // Defaulting to city id for origin and destination based on starter/basic docs
      const payload: any = {
        origin,
        destination,
        weight,
        courier,
      };

      if (config.type === 'pro') {
        payload.originType = 'city'; // Assuming tenant address uses city id
        payload.destinationType = 'subdistrict'; // Assuming buyer address uses subdistrict id
      }

      const response = await axios.post(`${config.baseUrl}/cost`, payload, {
        headers: { key: config.apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return response.data.rajaongkir.results;
    } catch (error) {
      throw new HttpException(error.response?.data?.rajaongkir?.status?.description || 'Failed to calculate shipping cost', HttpStatus.BAD_REQUEST);
    }
  }

  async trackWaybill(waybill: string, courier: string) {
    const config = await this.getRajaOngkirConfig();
    if (config.type === 'starter') {
      throw new HttpException('Tracking is not supported in Starter type. Upgrade to Basic/Pro.', HttpStatus.BAD_REQUEST);
    }
    
    try {
      const response = await axios.post(`${config.baseUrl}/waybill`, {
        waybill,
        courier
      }, {
        headers: { key: config.apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return response.data.rajaongkir.result;
    } catch (error) {
      throw new HttpException(error.response?.data?.rajaongkir?.status?.description || 'Failed to track waybill', HttpStatus.BAD_REQUEST);
    }
  }
}
