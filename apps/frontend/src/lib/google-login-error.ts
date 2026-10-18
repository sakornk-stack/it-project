// /login?googleError=<code> from AuthController.googleAuthCallback. Whitelisted:
// an unknown code shows nothing, so a crafted URL cannot put text on the page.
import { signupDomainsText } from './signup-domain';

export function googleLoginErrorMessage(code: string | null): string | null {
  switch (code) {
    case 'email_exists':
      return 'อีเมลนี้เคยสมัครด้วยรหัสผ่านแล้ว กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่านแทน';
    case 'email_unverified':
      return 'บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล จึงใช้เข้าสู่ระบบไม่ได้';
    case 'domain_not_allowed':
      return `สมัครด้วย Google ได้เฉพาะบัญชีอีเมล ${signupDomainsText()} กรุณาเลือกบัญชีของมหาวิทยาลัย`;
    default:
      return null;
  }
}
