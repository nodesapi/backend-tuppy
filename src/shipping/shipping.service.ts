import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class ShippingService {
  // Simple in-memory cache mechanism
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  // 24 hours TTL for Cost calculations (Prices don't change often)
  private COST_CACHE_TTL = 24 * 60 * 60 * 1000;
  // 1 hour TTL for Tracking (To prevent spamming the API when users hit refresh)
  private TRACK_CACHE_TTL = 60 * 60 * 1000;
  // 30 days TTL for regions
  private REGION_CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  private async getBinderByteConfig() {
    const apiKeyConfig = await this.prisma.systemConfig.findUnique({
      where: { key: 'BINDERBYTE_API_KEY' },
    });

    if (!apiKeyConfig || !apiKeyConfig.value) {
      throw new HttpException(
        'BinderByte API Key is not configured by Admin.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      apiKey: apiKeyConfig.value,
      baseUrl: 'https://api.binderbyte.com/v1',
      wilayahUrl: 'https://api.binderbyte.com/wilayah',
    };
  }

  private getFromCache(key: string) {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private setToCache(key: string, data: any, ttl: number) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
    });
  }

  async getProvinces() {
    const cacheKey = 'provinces';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const config = await this.getBinderByteConfig();
    try {
      const response = await axios.get(`${config.wilayahUrl}/provinsi`, {
        params: { api_key: config.apiKey },
      });
      // Map to frontend expectation (Handle both 'value' or 'data' array formats from BinderByte)
      const list = response.data.value || response.data.data || [];
      const data = list.map((p: any) => ({
        province_id: p.id,
        province: p.name,
      }));
      this.setToCache(cacheKey, data, this.REGION_CACHE_TTL);
      return data;
    } catch (error) {
      const errMsg =
        error.response?.data?.message ||
        error.response?.data?.messages ||
        'Failed to fetch provinces from BinderByte';
      throw new HttpException(errMsg, HttpStatus.BAD_REQUEST);
    }
  }

  async getCities(provinceId?: string) {
    if (!provinceId) {
      return [];
    }
    const cacheKey = `cities_${provinceId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const config = await this.getBinderByteConfig();
    try {
      const response = await axios.get(`${config.wilayahUrl}/kabupaten`, {
        params: { api_key: config.apiKey, id_provinsi: provinceId },
      });
      // Map to frontend expectation
      const list = response.data.value || response.data.data || [];
      const data = list.map((c: any) => ({
        city_id: c.id,
        province_id: provinceId,
        city_name: c.name,
        type: 'Kota/Kabupaten',
        postal_code: '',
      }));
      this.setToCache(cacheKey, data, this.REGION_CACHE_TTL);
      return data;
    } catch (error) {
      const errMsg =
        error.response?.data?.message ||
        error.response?.data?.messages ||
        'Failed to fetch cities from BinderByte';
      throw new HttpException(errMsg, HttpStatus.BAD_REQUEST);
    }
  }

  async getCost(
    origin: string,
    destination: string,
    weight: number,
    courier: string,
  ) {
    const cacheKey = `cost_${origin}_${destination}_${weight}_${courier}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const config = await this.getBinderByteConfig();
    try {
      const response = await axios.get(`${config.baseUrl}/cost`, {
        params: {
          api_key: config.apiKey,
          courier,
          origin,
          destination,
          weight,
        },
      });

      // The frontend expects:
      // [ { code: "jne", name: "JNE", costs: [ { service: "REG", description: "Layanan Reguler", cost: [ { value: 10000, etd: "1-2", note: "" } ] } ] } ]
      // Binderbyte Cost API response structure maps nicely to this
      const data = response.data.data;

      this.setToCache(cacheKey, data, this.COST_CACHE_TTL);
      return data;
    } catch (error) {
      const errMsg =
        error.response?.data?.message ||
        error.response?.data?.messages ||
        'Failed to calculate shipping cost via BinderByte';
      throw new HttpException(errMsg, HttpStatus.BAD_REQUEST);
    }
  }

  async trackWaybill(waybill: string, courier: string) {
    const cacheKey = `track_${waybill}_${courier}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const config = await this.getBinderByteConfig();
    try {
      const response = await axios.get(`${config.baseUrl}/track`, {
        params: {
          api_key: config.apiKey,
          courier,
          awb: waybill,
        },
      });
      const data = response.data.data;

      this.setToCache(cacheKey, data, this.TRACK_CACHE_TTL);
      return data;
    } catch (error) {
      const errMsg =
        error.response?.data?.message ||
        error.response?.data?.messages ||
        'Failed to track waybill via BinderByte';
      throw new HttpException(errMsg, HttpStatus.BAD_REQUEST);
    }
  }
}
