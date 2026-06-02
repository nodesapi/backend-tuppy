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
    baseUrl = process.env.PAYHOOK_URL || 'https://api.cekbayar.com';
    apiKey = process.env.PAYHOOK_API_KEY;
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
};
exports.PayhookService = PayhookService;
exports.PayhookService = PayhookService = PayhookService_1 = __decorate([
    (0, common_1.Injectable)()
], PayhookService);
//# sourceMappingURL=payhook.service.js.map