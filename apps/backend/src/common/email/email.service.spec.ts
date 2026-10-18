import { Logger } from '@nestjs/common';
import { EmailService } from './email.service';

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
