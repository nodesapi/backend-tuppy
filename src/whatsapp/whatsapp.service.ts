import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import * as QRCode from 'qrcode';
import { Boom } from '@hapi/boom';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

interface BotSession {
  sock: any;
  qrCodeUrl: string | null;
  isReady: boolean;
}

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  
  // Kunci sesi: "SYSTEM" untuk bot platform, atau tenantId untuk bot penjual
  private sessions = new Map<string, BotSession>();
  private readonly baseAuthFolder = path.join(process.cwd(), 'baileys_auth_info');

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Pada saat server start, kita cek apakah System Bot aktif di database
    const sysConfig = await this.prisma.systemConfig.findUnique({ where: { key: 'WHATSAPP_SYSTEM_ENABLED' } });
    if (sysConfig?.value === 'true') {
      this.logger.log('Auto-starting SYSTEM WhatsApp bot...');
      await this.startBot('SYSTEM');
    }

    // Untuk Tenant Bots, kita terapkan Lazy-Loading (tidak di-load saat server start)
    // Sesi mereka hanya akan dimuat ketika ada pesanan masuk, atau mereka membuka halaman Setting.
  }

  onModuleDestroy() {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.sock) {
        session.sock.logout();
      }
    }
    this.sessions.clear();
  }

  /**
   * Mengambil status sesi tertentu
   */
  getSessionStatus(sessionId: string) {
    const session = this.sessions.get(sessionId);
    return {
      connected: session?.isReady || false,
      qrCodeUrl: session?.qrCodeUrl || null,
      active: !!session
    };
  }

  /**
   * Mematikan dan menghapus sesi bot dari RAM
   */
  async stopBot(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.sock) {
        // Jangan logout kalau cuma mematikan sementara dari RAM agar sesi tidak hilang, cukup close()
        session.sock.ev.removeAllListeners();
        session.sock.end(new Error('Bot stopped by user'));
      }
      this.sessions.delete(sessionId);
      this.logger.log(`Bot session ${sessionId} stopped and cleared from memory.`);
    }
  }

  /**
   * Logout dan hapus kredensial (Digunakan saat user membatalkan tautan)
   */
  async logoutBot(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session && session.sock) {
      await session.sock.logout();
      this.sessions.delete(sessionId);
      this.logger.log(`Bot session ${sessionId} logged out completely.`);
    }
  }

  /**
   * Menghidupkan (Load) sesi Bot
   */
  async startBot(sessionId: string) {
    if (this.sessions.has(sessionId)) {
      return; // Sudah berjalan
    }

    const authFolder = path.join(this.baseAuthFolder, sessionId);
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: sessionId === 'SYSTEM', // Print di terminal hanya untuk sistem
      browser: ['Tupply Platform', 'Chrome', '1.0.0'],
    });

    const sessionObj: BotSession = {
      sock,
      qrCodeUrl: null,
      isReady: false,
    };
    this.sessions.set(sessionId, sessionObj);

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      // Ambil kembali object reference terbaru dari Map
      const currentSession = this.sessions.get(sessionId);
      if (!currentSession) return;

      if (qr) {
        this.logger.log(`[${sessionId}] QR Code generated. Waiting for scan.`);
        try {
          currentSession.qrCodeUrl = await QRCode.toDataURL(qr);
        } catch (err) {
          this.logger.error(`[${sessionId}] Failed to generate QR Code Data URL`, err);
        }
      }

      if (connection === 'close') {
        currentSession.isReady = false;
        currentSession.qrCodeUrl = null;
        
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        this.logger.log(`[${sessionId}] Connection closed, reconnecting: ${shouldReconnect}`);
        
        if (shouldReconnect) {
          // Reconnect logic: Hapus sesi lama dari Map, lalu start ulang
          this.sessions.delete(sessionId);
          this.startBot(sessionId);
        } else {
          this.logger.log(`[${sessionId}] Logged out.`);
          this.sessions.delete(sessionId);
        }
      } else if (connection === 'open') {
        currentSession.isReady = true;
        currentSession.qrCodeUrl = null;
        this.logger.log(`[${sessionId}] WhatsApp connection opened successfully!`);
      }
    });

    sock.ev.on('creds.update', saveCreds);
  }

  /**
   * Mengirim pesan ke nomor WhatsApp menggunakan sesi (bot) tertentu
   * @param sessionId ID Sesi ('SYSTEM' atau tenantId)
   * @param phone Nomor tujuan
   * @param message Isi pesan
   * @param orderId ID order jika terkait pesanan
   */
  async sendMessage(sessionId: string, phone: string, message: string, orderId?: string) {
    // Lazy Load: Jika sessionId bukan SYSTEM dan belum ada di memory, coba start
    if (!this.sessions.has(sessionId)) {
      this.logger.log(`[LazyLoad] Starting bot for ${sessionId} to send message...`);
      await this.startBot(sessionId);
      
      // Tunggu maksimal 5 detik agar bot ready
      let retries = 5;
      while (retries > 0) {
        await new Promise(r => setTimeout(r, 1000));
        if (this.sessions.get(sessionId)?.isReady) break;
        retries--;
      }
    }

    const session = this.sessions.get(sessionId);
    if (!session || !session.isReady) {
      this.logger.warn(`Failed to send message: Bot ${sessionId} is not connected or ready.`);
      
      // Log kegagalan ke database
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

      // Log sukses ke database
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
    } catch (err) {
      this.logger.error(`Error sending message to ${phone} via bot ${sessionId}`, err);
      
      // Log kegagalan
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
}
