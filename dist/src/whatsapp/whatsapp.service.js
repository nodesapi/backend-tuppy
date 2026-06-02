"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WhatsappService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsappService = void 0;
const common_1 = require("@nestjs/common");
const baileys_1 = require("@whiskeysockets/baileys");
const QRCode = __importStar(require("qrcode"));
const path = __importStar(require("path"));
const prisma_service_1 = require("../prisma/prisma.service");
let WhatsappService = WhatsappService_1 = class WhatsappService {
    prisma;
    logger = new common_1.Logger(WhatsappService_1.name);
    sessions = new Map();
    baseAuthFolder = path.join(process.cwd(), 'baileys_auth_info');
    constructor(prisma) {
        this.prisma = prisma;
    }
    async onModuleInit() {
        const sysConfig = await this.prisma.systemConfig.findUnique({ where: { key: 'WHATSAPP_SYSTEM_ENABLED' } });
        if (sysConfig?.value === 'true') {
            this.logger.log('Auto-starting SYSTEM WhatsApp bot...');
            await this.startBot('SYSTEM');
        }
    }
    onModuleDestroy() {
        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.sock) {
                session.sock.logout();
            }
        }
        this.sessions.clear();
    }
    getSessionStatus(sessionId) {
        const session = this.sessions.get(sessionId);
        return {
            connected: session?.isReady || false,
            qrCodeUrl: session?.qrCodeUrl || null,
            active: !!session
        };
    }
    async stopBot(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            if (session.sock) {
                session.sock.ev.removeAllListeners();
                session.sock.end(new Error('Bot stopped by user'));
            }
            this.sessions.delete(sessionId);
            this.logger.log(`Bot session ${sessionId} stopped and cleared from memory.`);
        }
    }
    async logoutBot(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session && session.sock) {
            await session.sock.logout();
            this.sessions.delete(sessionId);
            this.logger.log(`Bot session ${sessionId} logged out completely.`);
        }
    }
    async startBot(sessionId) {
        if (this.sessions.has(sessionId)) {
            return;
        }
        const authFolder = path.join(this.baseAuthFolder, sessionId);
        const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)(authFolder);
        const sock = (0, baileys_1.makeWASocket)({
            auth: state,
            printQRInTerminal: sessionId === 'SYSTEM',
            browser: ['Tupply Platform', 'Chrome', '1.0.0'],
        });
        const sessionObj = {
            sock,
            qrCodeUrl: null,
            isReady: false,
        };
        this.sessions.set(sessionId, sessionObj);
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            const currentSession = this.sessions.get(sessionId);
            if (!currentSession)
                return;
            if (qr) {
                this.logger.log(`[${sessionId}] QR Code generated. Waiting for scan.`);
                try {
                    currentSession.qrCodeUrl = await QRCode.toDataURL(qr);
                }
                catch (err) {
                    this.logger.error(`[${sessionId}] Failed to generate QR Code Data URL`, err);
                }
            }
            if (connection === 'close') {
                currentSession.isReady = false;
                currentSession.qrCodeUrl = null;
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== baileys_1.DisconnectReason.loggedOut;
                this.logger.log(`[${sessionId}] Connection closed, reconnecting: ${shouldReconnect}`);
                if (shouldReconnect) {
                    this.sessions.delete(sessionId);
                    this.startBot(sessionId);
                }
                else {
                    this.logger.log(`[${sessionId}] Logged out.`);
                    this.sessions.delete(sessionId);
                }
            }
            else if (connection === 'open') {
                currentSession.isReady = true;
                currentSession.qrCodeUrl = null;
                this.logger.log(`[${sessionId}] WhatsApp connection opened successfully!`);
            }
        });
        sock.ev.on('creds.update', saveCreds);
    }
    async sendMessage(sessionId, phone, message, orderId) {
        if (!this.sessions.has(sessionId)) {
            this.logger.log(`[LazyLoad] Starting bot for ${sessionId} to send message...`);
            await this.startBot(sessionId);
            let retries = 5;
            while (retries > 0) {
                await new Promise(r => setTimeout(r, 1000));
                if (this.sessions.get(sessionId)?.isReady)
                    break;
                retries--;
            }
        }
        const session = this.sessions.get(sessionId);
        if (!session || !session.isReady) {
            this.logger.warn(`Failed to send message: Bot ${sessionId} is not connected or ready.`);
            await this.prisma.whatsappLog.create({
                data: {
                    tenantId: sessionId === 'SYSTEM' ? null : sessionId,
                    orderId,
                    phone,
                    message,
                    sentBy: sessionId === 'SYSTEM' ? 'SYSTEM' : 'TENANT',
                    status: 'FAILED',
                }
            });
            return false;
        }
        try {
            const formattedPhone = phone.replace(/\D/g, '').replace(/^0/, '62');
            const jid = `${formattedPhone}@s.whatsapp.net`;
            await session.sock.sendMessage(jid, { text: message });
            this.logger.log(`Message sent to ${phone} via bot ${sessionId}`);
            await this.prisma.whatsappLog.create({
                data: {
                    tenantId: sessionId === 'SYSTEM' ? null : sessionId,
                    orderId,
                    phone,
                    message,
                    sentBy: sessionId === 'SYSTEM' ? 'SYSTEM' : 'TENANT',
                    status: 'SUCCESS',
                }
            });
            return true;
        }
        catch (err) {
            this.logger.error(`Error sending message to ${phone} via bot ${sessionId}`, err);
            await this.prisma.whatsappLog.create({
                data: {
                    tenantId: sessionId === 'SYSTEM' ? null : sessionId,
                    orderId,
                    phone,
                    message,
                    sentBy: sessionId === 'SYSTEM' ? 'SYSTEM' : 'TENANT',
                    status: 'FAILED',
                }
            });
            return false;
        }
    }
};
exports.WhatsappService = WhatsappService;
exports.WhatsappService = WhatsappService = WhatsappService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WhatsappService);
//# sourceMappingURL=whatsapp.service.js.map