"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var PayhookService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayhookService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
let PayhookService = PayhookService_1 = class PayhookService {
    logger = new common_1.Logger(PayhookService_1.name);
    baseUrl = process.env.PAYHOOK_URL || 'http://localhost:8000';
    apiKey = process.env.PAYHOOK_API_KEY;
    internalSecret = process.env.TUPPLY_INTERNAL_SECRET || 'tupply-dev-secret-key-12345';
    async createInvoice(payload) {
        if (!this.apiKey) {
            this.logger.error('PAYHOOK_API_KEY is not defined in environment variables');
            throw new common_1.HttpException('Payment Gateway configuration is missing', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/api/v1/invoices`, payload, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
            });
            if (response.data && response.data.success) {
                return response.data.data;
            }
            else {
                throw new Error(response.data?.message || 'Failed to create invoice');
            }
        }
        catch (error) {
            this.logger.error(`Error calling Payhook API: ${error.message}`);
            if (error.response) {
                this.logger.error(`Payhook Response: ${JSON.stringify(error.response.data)}`);
            }
            throw new common_1.HttpException('Failed to communicate with Payment Gateway', common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    async getInvoice(invoiceNumber) {
        if (!this.apiKey) {
            throw new common_1.HttpException('Payment Gateway configuration is missing', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/api/v1/invoices/${invoiceNumber}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Accept': 'application/json',
                },
            });
            if (response.data && response.data.success) {
                return response.data.data;
            }
            return null;
        }
        catch (error) {
            this.logger.error(`Error calling Payhook API getInvoice: ${error.message}`);
            return null;
        }
    }
    async getChannels() {
        if (!this.apiKey) {
            this.logger.error('PAYHOOK_API_KEY is not defined in environment variables');
            throw new common_1.HttpException('Payment Gateway configuration is missing', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/api/v1/channels`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Accept': 'application/json',
                },
            });
            if (response.data && response.data.success) {
                return response.data.data;
            }
            else {
                throw new Error(response.data?.message || 'Failed to fetch payment channels');
            }
        }
        catch (error) {
            this.logger.error(`Error calling Payhook API channels: ${error.message}`);
            throw new common_1.HttpException('Failed to fetch payment channels', common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    async provisionPayhookAccount(payload) {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/api/internal/tupply/merchants`, payload, {
                headers: {
                    'X-Tupply-Secret': this.internalSecret,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
            });
            if (response.data && response.data.success) {
                return response.data.data;
            }
            else {
                throw new Error(response.data?.message || 'Failed to provision Payhook account');
            }
        }
        catch (error) {
            this.logger.error(`Error provisioning Payhook account: ${error.message}`);
            if (error.response) {
                this.logger.error(`Payhook Response: ${JSON.stringify(error.response.data)}`);
            }
            throw new common_1.HttpException('Failed to auto-register Payhook account', common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    async uploadQris(tenantId, file) {
        try {
            const formData = new FormData();
            const blob = new Blob([file.buffer], { type: file.mimetype });
            formData.append('qris_image', blob, file.originalname);
            const response = await axios_1.default.post(`${this.baseUrl}/api/internal/tupply/merchants/${tenantId}/qris`, formData, {
                headers: {
                    'X-Tupply-Secret': this.internalSecret,
                    'Accept': 'application/json',
                },
            });
            if (response.data && response.data.success) {
                return response.data.data;
            }
            else {
                throw new Error(response.data?.message || 'Failed to upload QRIS');
            }
        }
        catch (error) {
            this.logger.error(`Error uploading QRIS to Payhook: ${error.message}`);
            if (error.response) {
                this.logger.error(`Payhook Response: ${JSON.stringify(error.response.data)}`);
            }
            throw new common_1.HttpException('Failed to upload QRIS to Payhook', common_1.HttpStatus.BAD_GATEWAY);
        }
    }
};
exports.PayhookService = PayhookService;
exports.PayhookService = PayhookService = PayhookService_1 = __decorate([
    (0, common_1.Injectable)()
], PayhookService);
//# sourceMappingURL=payhook.service.js.map