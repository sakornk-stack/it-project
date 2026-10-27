import { Logger } from '@nestjs/common';
import { EmailService, escapeHtml, parseSender } from './email.service';

describe('EmailService send-failure log', () => {
  it('logs a shortened address, never the full one', async () => {
    const config = { get: jest.fn(() => undefined) };
    const service = new EmailService(config as never);
    (service as unknown as { transporter: unknown }).transporter = {
      sendMail: jest.fn().mockRejectedValue(new Error('smtp down')),
    };
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(
      service.sendMail({ to: 'somchai@example.com', subject: 's', html: 'h' }),
    ).rejects.toThrow('smtp down');

    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).toContain('s***@example.com');
    expect(logged).not.toContain('somchai');
    errorSpy.mockRestore();
  });
});

describe('EmailService.sendSignupVerificationEmail', () => {
  function serviceWith(sendMail: jest.Mock) {
    const config = { get: jest.fn(() => undefined) };
    const service = new EmailService(config as never);
    (service as unknown as { transporter: unknown }).transporter = { sendMail };
    return service;
  }

  it('mails a /register/verify link carrying the raw token and no requester-typed text', async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    await serviceWith(sendMail).sendSignupVerificationEmail('new@ku.th', 'tok123', 30);
    const { to, html } = sendMail.mock.calls[0][0] as { to: string; html: string };
    expect(to).toBe('new@ku.th');
    expect(html).toContain('/register/verify?token=tok123');
    expect(html).toContain('30 นาที');
  });

  it('never writes the token or the link to the log when sending fails', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const sendMail = jest.fn().mockRejectedValue(new Error('smtp down'));
    await expect(
      serviceWith(sendMail).sendSignupVerificationEmail('new@ku.th', 'secret-token-xyz', 30),
    ).rejects.toThrow('smtp down');
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain('secret-token-xyz');
    expect(logged).not.toContain('/register/verify');
    errorSpy.mockRestore();
  });
});

describe('EmailService HTML escaping', () => {
  function serviceWith(sendMail: jest.Mock) {
    const config = { get: jest.fn(() => undefined) };
    const service = new EmailService(config as never);
    (service as unknown as { transporter: unknown }).transporter = { sendMail };
    return service;
  }

  it('escapeHtml turns markup characters into entities', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
    expect(escapeHtml('สมชาย ใจดี')).toBe('สมชาย ใจดี');
  });

  it('an invitation name carrying a link or a script arrives as text', async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    const name = 'Somchai <a href="https://evil.example">click</a><script>alert(1)</script>';
    await serviceWith(sendMail).sendStudentInvitationEmail('s@ku.th', 'tok', name);
    const { html } = sendMail.mock.calls[0][0] as { html: string };
    expect(html).not.toContain('<a href="https://evil.example">');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    // The real invitation link is still a working anchor.
    expect(html).toContain('<a href="http://localhost:3000/register?invitationToken=tok">');
  });

  it('the password email link is still a working anchor', async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    await serviceWith(sendMail).sendPasswordSetupEmail('s@ku.th', 'tok', 'reset');
    const { html } = sendMail.mock.calls[0][0] as { html: string };
    expect(html).toContain('<a href="http://localhost:3000/reset-password?token=tok">');
  });
});

describe('EmailService via Brevo (BREVO_API_KEY set)', () => {
  const values: Record<string, string> = {
    'brevo.apiKey': 'xkeysib-test',
    'smtp.from': 'EduAnalyze <sender@example.com>',
  };
  function brevoService() {
    const config = { get: jest.fn((key: string) => values[key]) };
    const service = new EmailService(config as never);
    const smtpSend = jest.fn();
    (service as unknown as { transporter: unknown }).transporter = { sendMail: smtpSend };
    return { service, smtpSend };
  }
  afterEach(() => jest.restoreAllMocks());

  it('posts to the Brevo API instead of SMTP', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{"messageId":"1"}', { status: 201 }));
    const { service, smtpSend } = brevoService();

    await service.sendMail({ to: 'somchai@ku.th', subject: 'hello', html: '<p>hi</p>' });

    expect(smtpSend).not.toHaveBeenCalled();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init.headers as Record<string, string>)['api-key']).toBe('xkeysib-test');
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { name: 'EduAnalyze', email: 'sender@example.com' },
      to: [{ email: 'somchai@ku.th' }],
      subject: 'hello',
      htmlContent: '<p>hi</p>',
    });
  });

  it('throws (and logs a masked address) when Brevo refuses', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{"code":"unauthorized"}', { status: 401 }));
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { service } = brevoService();

    await expect(
      service.sendMail({ to: 'somchai@ku.th', subject: 's', html: 'h' }),
    ).rejects.toThrow('Brevo responded 401');
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('somchai');
  });
});

describe('parseSender', () => {
  it('splits a display name from the address', () => {
    expect(parseSender('EduAnalyze <a@b.com>')).toEqual({ name: 'EduAnalyze', email: 'a@b.com' });
    expect(parseSender('"Edu Analyze" <a@b.com>')).toEqual({ name: 'Edu Analyze', email: 'a@b.com' });
  });
  it('accepts a bare address', () => {
    expect(parseSender(' a@b.com ')).toEqual({ email: 'a@b.com' });
    expect(parseSender('<a@b.com>')).toEqual({ email: 'a@b.com' });
  });
});
