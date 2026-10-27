import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendMailParams {
  to: string;
  subject: string;
  html: string;
}

// Single real email-sending point for the whole app (forgot-password,
// account-creation "set your password" email — see auth.service.ts and
// user-management.service.ts). Replaces the console.warn mocks that used
// to stand in for this (search history: "[PASSWORD RESET MOCK]",
// "[INVITE MOCK]") — TODO.md tracked this as a known gap before real SMTP
// credentials were available.
//
// Nodemailer + Gmail SMTP (free tier, App Password required — a normal
// Gmail account password will NOT work since Google blocks plain SMTP
// auth on the real password). Kept swappable: nothing outside this file
// knows it's Gmail specifically, only SMTP_HOST/PORT/USER/PASS/FROM.
// With BREVO_API_KEY set, mail goes through Brevo's HTTPS API instead: Render's
// free plan blocks outbound SMTP ports (25/465/587), HTTPS is not blocked.
// Logs carry a shortened address (a***@domain), never the full one.
export function maskEmail(address: string): string {
  const [local, domain] = address.split('@');
  return domain ? `${local.slice(0, 1)}***@${domain}` : '***';
}

// Every value interpolated into an email body goes through this, even ones we
// generate ourselves: a name typed by STAFF (or read from their CSV) must
// arrive as text, never as markup or a link in a mail sent from our address.
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replaceAll(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}

// "EduAnalyze <x@gmail.com>" or a bare address -> Brevo's sender object.
export function parseSender(from: string): { name?: string; email: string } {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  if (!match) return { email: from.trim() };
  const name = match[1].trim();
  return name ? { name, email: match[2].trim() } : { email: match[2].trim() };
}

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly frontendUrl: string;
  private readonly brevoApiKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.brevoApiKey = this.configService.get<string>('brevo.apiKey')?.trim() || undefined;
    const host = this.configService.get<string>('smtp.host');
    const port = this.configService.get<number>('smtp.port');
    const user = this.configService.get<string>('smtp.user')?.trim();
    // Gmail displays App Passwords grouped as "xxxx xxxx xxxx xxxx" for
    // readability — those spaces are not part of the actual secret and
    // some SMTP auth paths choke on them if pasted verbatim into .env, so
    // strip all whitespace here rather than relying on every operator to
    // remember to remove it before pasting.
    const pass = this.configService.get<string>('smtp.pass')?.replace(/\s+/g, '');
    this.from = this.configService.get<string>('smtp.from')?.trim() || user || '';
    this.frontendUrl = this.configService.get<string>('frontendUrl') || 'http://localhost:3000';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 587 (default, Gmail) uses STARTTLS, not implicit TLS
      auth: user ? { user, pass } : undefined,
      // nodemailer's defaults (2 min connect, 10 min socket) let one stalled
      // SMTP server hold an awaiting HTTP request open for minutes. A normal
      // Gmail handshake takes 1-2 s, so these leave ample margin.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  // Best-effort by design — every caller must decide for itself whether a
  // failed send should block the surrounding operation (see
  // UserManagementService.createStaffOrAdmin's comment: account creation
  // still succeeds even if this throws, because the same
  // POST /auth/forgot-password path remains a fallback for the user).
  async sendMail(params: SendMailParams): Promise<void> {
    try {
      if (this.brevoApiKey) {
        await this.sendViaBrevo(params, this.brevoApiKey);
      } else {
        await this.transporter.sendMail({
          from: this.from,
          to: params.to,
          subject: params.subject,
          html: params.html,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${maskEmail(params.to)}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private async sendViaBrevo(params: SendMailParams, apiKey: string): Promise<void> {
    const response = await fetch(BREVO_SEND_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: parseSender(this.from),
        to: [{ email: params.to }],
        subject: params.subject,
        htmlContent: params.html,
      }),
      // Same ceiling as the SMTP socket timeout above.
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      // Brevo's error body names the problem (e.g. unverified sender) and
      // never echoes the key or the recipient.
      const detail = (await response.text().catch(() => '')).slice(0, 200);
      throw new Error(`Brevo responded ${response.status}: ${detail}`);
    }
  }

  // Both PasswordResetToken use sites (AuthService.forgotPassword's
  // self-service flow, and UserManagementService.createStaffOrAdmin's
  // auto-sent "set your first password" flow) land on the same
  // /reset-password page — only the subject/copy differs based on which
  // triggered it, so the token/link plumbing lives here once.
  async sendPasswordSetupEmail(
    to: string,
    token: string,
    mode: 'reset' | 'new-account',
  ): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;
    const subject =
      mode === 'new-account' ? 'ตั้งรหัสผ่านบัญชี EduAnalyzeAI ของคุณ' : 'รีเซ็ตรหัสผ่าน EduAnalyzeAI';
    const intro =
      mode === 'new-account'
        ? 'บัญชีของคุณถูกสร้างขึ้นในระบบ EduAnalyzeAI แล้ว กรุณาตั้งรหัสผ่านเพื่อเริ่มใช้งาน'
        : 'มีคำขอรีเซ็ตรหัสผ่านสำหรับบัญชี EduAnalyzeAI ของคุณ';
    const html = `
      <p>${intro}</p>
      <p><a href="${escapeHtml(resetUrl)}">${mode === 'new-account' ? 'ตั้งรหัสผ่าน' : 'รีเซ็ตรหัสผ่าน'}</a></p>
      <p>ลิงก์นี้ใช้ได้ครั้งเดียวและหมดอายุใน 1 ชั่วโมง หากคุณไม่ได้ร้องขอ กรุณาเพิกเฉยต่ออีเมลนี้</p>
    `;
    await this.sendMail({ to, subject, html });
  }

  // Sent when STAFF creates/resends a StudentInvitation — the link lands
  // on /register?invitationToken=..., which pre-fills the academic fields
  // but still runs through the ordinary self-service register() call
  // (see AuthService.register), never a shortcut that creates the account
  // itself.
  async sendStudentInvitationEmail(
    to: string,
    token: string,
    fullName: string,
  ): Promise<void> {
    const registerUrl = `${this.frontendUrl}/register?invitationToken=${token}`;
    const subject = 'คำเชิญเข้าใช้งาน EduAnalyzeAI';
    const html = `
      <p>สวัสดีคุณ ${escapeHtml(fullName)}</p>
      <p>เจ้าหน้าที่เชิญคุณเข้าใช้งานระบบ EduAnalyzeAI กรุณากดลิงก์ด้านล่างเพื่อสมัครสมาชิกด้วยอีเมลนี้</p>
      <p><a href="${escapeHtml(registerUrl)}">สมัครสมาชิก</a></p>
      <p>ลิงก์นี้ใช้ได้ครั้งเดียวและหมดอายุใน 7 วัน หากคุณไม่ได้คาดหวังอีเมลนี้ กรุณาเพิกเฉย</p>
    `;
    await this.sendMail({ to, subject, html });
  }

  // Self-service sign-up: proves the person owns `to` before any account is
  // created (AuthService.verifyEmailSignup). Deliberately carries nothing the
  // requester typed (no name) — anyone can trigger this mail to an allowed
  // address, so it must not become a way to put their own text in someone
  // else's inbox. The link lands on a page that needs a click to POST, so a
  // mail scanner that follows links cannot use the token up.
  async sendSignupVerificationEmail(to: string, token: string, ttlMinutes: number): Promise<void> {
    const verifyUrl = `${this.frontendUrl}/register/verify?token=${token}`;
    const subject = 'ยืนยันอีเมลเพื่อสมัครใช้งาน EduAnalyzeAI';
    const html = `
      <p>มีการสมัครใช้งานระบบ EduAnalyzeAI ด้วยอีเมลนี้ กรุณากดลิงก์ด้านล่างเพื่อยืนยันอีเมลและเปิดใช้บัญชี</p>
      <p><a href="${escapeHtml(verifyUrl)}">ยืนยันอีเมล</a></p>
      <p>ลิงก์นี้ใช้ได้ครั้งเดียวและหมดอายุใน ${ttlMinutes} นาที หากคุณไม่ได้สมัคร กรุณาเพิกเฉยต่ออีเมลนี้ ระบบจะไม่สร้างบัญชีให้</p>
    `;
    await this.sendMail({ to, subject, html });
  }
}
