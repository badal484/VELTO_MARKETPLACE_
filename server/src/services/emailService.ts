import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  pool: true,
  maxConnections: 3,
  socketTimeout: 30000, // Increase timeout for slow cloud connections
  connectionTimeout: 30000,
});

transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP Connection Error:', error);
  } else {
    console.log('✅ SMTP Server is ready to take our messages');
  }
});

const templates = {
  email_verify: (data: { name: string; otp: string }) => ({
    subject: 'Verify your Velto account',
    html: `<h1>Welcome to Velto</h1><p>Hi ${data.name}, use this OTP to verify your email: <strong>${data.otp}</strong>. Valid for 10 minutes.</p>`,
  }),
  forgot_password: (data: { name: string; otp: string }) => ({
    subject: 'Reset your Velto password',
    html: `<p>Hi ${data.name}, use this OTP to reset your password: <strong>${data.otp}</strong>. Valid for 10 minutes.</p>`,
  }),
};

export const sendEmail = async (to: string, type: keyof typeof templates, data: any) => {
  console.log(`✉️ [DEBUG] Attempting to send email [${type}] to: ${to}...`);
  try {
    const tpl = (templates as any)[type](data);
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject: tpl.subject,
      html: tpl.html,
    });
    console.log(`✅ Email [${type}] sent successfully. MessageID: ${info.messageId}`);
    return info;
  } catch (error: any) {
    console.error('❌ [EMAIL ERROR] Detailed failure:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response
    });
    throw error;
  }
};
