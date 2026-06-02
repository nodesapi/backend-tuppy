import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    // Basic nodemailer transport configuration.
    // In production, configure this via process.env for real SMTP server.
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || 'test@example.com',
        pass: process.env.SMTP_PASS || 'password',
      },
    });
  }

  /**
   * Mengirim email struk order ke pembeli
   */
  async sendOrderReceipt(toEmail: string, orderNumber: string, customerName: string, trackingLink: string, tenantName: string) {
    if (!toEmail) {
      this.logger.warn('Cannot send email receipt: No email provided.');
      return false;
    }

    const htmlContent = `
      <div style="font-family: sans-serif; max-w: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #333;">Terima Kasih, ${customerName}!</h2>
        <p>Pesanan Anda di toko <strong>${tenantName}</strong> telah kami terima.</p>
        <p>Nomor Pesanan: <strong style="font-size: 18px; color: #f97316;">${orderNumber}</strong></p>
        <div style="margin: 30px 0;">
          <a href="${trackingLink}" style="background-color: #f97316; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Lacak Pesanan Saya</a>
        </div>
        <p style="color: #777; font-size: 13px;">Jika tombol di atas tidak berfungsi, kunjungi: <a href="${trackingLink}">${trackingLink}</a></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #aaa; text-align: center;">Tupply Order System</p>
      </div>
    `;

    try {
      // Untuk development, ini mungkin akan gagal jika SMTP_USER tidak valid.
      // Anda bisa menggunakan layanan seperti Ethereal Email atau SMTP asli nanti.
      if (process.env.SMTP_USER === 'test@example.com') {
          this.logger.log(`[MOCK EMAIL] Sent to ${toEmail} for Order ${orderNumber}`);
          return true;
      }

      await this.transporter.sendMail({
        from: `"Tupply System" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: `Struk Pesanan ${orderNumber} - ${tenantName}`,
        html: htmlContent,
      });

      this.logger.log(`Receipt email sent to ${toEmail}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send receipt email to ${toEmail}`, error);
      return false;
    }
  }
}
