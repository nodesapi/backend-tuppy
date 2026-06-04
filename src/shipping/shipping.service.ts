import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  private async getRajaOngkirConfig() {
    const apiKeyConfig = await this.prisma.systemConfig.findUnique({ where: { key: 'RAJAONGKIR_API_KEY' } });
    let typeConfig = await this.prisma.systemConfig.findUnique({ where: { key: 'RAJAONGKIR_TYPE' } });

    if (!apiKeyConfig || !apiKeyConfig.value) {
      throw new HttpException('RajaOngkir API Key is not configured by Admin.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    let type = (typeConfig?.value || 'starter').toLowerCase();
    
    // OVERRIDE: Since RajaOngkir V1 (Starter) is dead/blocked and replaced by Komerce V2, 
    // we force 'starter' to act as 'komerce' so the user doesn't need to manually update the dashboard UI.
    if (type === 'starter') {
      type = 'komerce';
    }

    let baseUrl = 'https://api.rajaongkir.com/starter';
    if (type === 'basic') baseUrl = 'https://api.rajaongkir.com/basic';
    if (type === 'pro') baseUrl = 'https://pro.rajaongkir.com/api';
    if (type === 'komerce') baseUrl = 'https://rajaongkir.komerce.id/api/v1';

    return {
      apiKey: apiKeyConfig.value,
      type,
      baseUrl,
    };
  }

  async getProvinces() {
    const config = await this.getRajaOngkirConfig();
    try {
      if (config.type === 'komerce') {
        const response = await axios.get(`${config.baseUrl}/destination/province`, {
          headers: { key: config.apiKey },
        });
        // Map Komerce V2 format to RajaOngkir V1 format
        return response.data.data.map((p: any) => ({
          province_id: p.id.toString(),
          province: p.name,
        }));
      }

      const response = await axios.get(`${config.baseUrl}/province`, {
        headers: { key: config.apiKey },
      });
      return response.data.rajaongkir.results;
    } catch (error) {
      throw new HttpException(error.response?.data?.meta?.message || error.response?.data?.rajaongkir?.status?.description || 'Failed to fetch provinces', HttpStatus.BAD_REQUEST);
    }
  }

  async getCities(provinceId?: string) {
    const config = await this.getRajaOngkirConfig();
    try {
      if (config.type === 'komerce') {
        const url = provinceId ? `${config.baseUrl}/destination/city/${provinceId}` : `${config.baseUrl}/destination/city`;
        const response = await axios.get(url, {
          headers: { key: config.apiKey },
        });
        return response.data.data.map((c: any) => ({
          city_id: c.id.toString(),
          province_id: provinceId || '',
          city_name: c.name,
          type: 'Kota/Kabupaten',
          postal_code: c.zip_code,
        }));
      }

      const url = provinceId ? `${config.baseUrl}/city?province=${provinceId}` : `${config.baseUrl}/city`;
      const response = await axios.get(url, {
        headers: { key: config.apiKey },
      });
      return response.data.rajaongkir.results;
    } catch (error) {
      throw new HttpException(error.response?.data?.meta?.message || error.response?.data?.rajaongkir?.status?.description || 'Failed to fetch cities', HttpStatus.BAD_REQUEST);
    }
  }

  async getCost(origin: string, destination: string, weight: number, courier: string) {
    const config = await this.getRajaOngkirConfig();
    try {
      if (config.type === 'komerce') {
        // Komerce V2 domestic cost endpoint
        // It requires origin and destination. It might expect subdistrict/district IDs
        const payload = new URLSearchParams({
          origin,
          destination,
          weight: weight.toString(),
          courier,
        }).toString();

        const response = await axios.post(`${config.baseUrl}/calculate/domestic-cost`, payload, {
          headers: { key: config.apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        // Map Komerce V2 Cost response to RajaOngkir V1 format if necessary
        // Assuming Komerce returns `{ data: [ { name: "JNE", code: "jne", costs: [ { service: "REG", value: 10000, ... } ] } ] }`
        // RajaOngkir format: `[ { code: "jne", name: "Jalur Nugraha Ekakurir (JNE)", costs: [ { service: "REG", description: "Layanan Reguler", cost: [ { value: 10000, etd: "1-2", note: "" } ] } ] } ]`
        // If Komerce directly matches or we need to transform, we can do a basic transform to be safe:
        const data = response.data.data;
        if (Array.isArray(data)) {
           return data.map((courierItem: any) => ({
             code: courierItem.code,
             name: courierItem.name,
             costs: courierItem.costs ? courierItem.costs.map((c: any) => ({
               service: c.service,
               description: c.description || c.service,
               cost: [
                 {
                   value: c.cost || c.value || (c.cost ? c.cost[0]?.value : 0),
                   etd: c.etd || c.estimated_delivery_time || '',
                   note: c.note || ''
                 }
               ]
             })) : []
           }));
        }
        return data;
      }

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
      throw new HttpException(error.response?.data?.meta?.message || error.response?.data?.rajaongkir?.status?.description || 'Failed to calculate shipping cost', HttpStatus.BAD_REQUEST);
    }
  }

  async trackWaybill(waybill: string, courier: string) {
    const config = await this.getRajaOngkirConfig();
    if (config.type === 'starter') {
      throw new HttpException('Tracking is not supported in Starter type. Upgrade to Basic/Pro.', HttpStatus.BAD_REQUEST);
    }
    
    try {
      if (config.type === 'komerce') {
         const payload = new URLSearchParams({ waybill, courier }).toString();
         const response = await axios.post(`${config.baseUrl}/waybill`, payload, {
           headers: { key: config.apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
         });
         return response.data.data;
      }

      const response = await axios.post(`${config.baseUrl}/waybill`, {
        waybill,
        courier
      }, {
        headers: { key: config.apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      return response.data.rajaongkir.result;
    } catch (error) {
      throw new HttpException(error.response?.data?.meta?.message || error.response?.data?.rajaongkir?.status?.description || 'Failed to track waybill', HttpStatus.BAD_REQUEST);
    }
  }
}
