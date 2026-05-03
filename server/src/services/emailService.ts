import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
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
  try {
    const tpl = (templates as any)[type](data);
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject: tpl.subject,
      html: tpl.html,
    });
    console.log(`✅ Email [${type}] sent to ${to}`);
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw new Error('Failed to send email');
  }
};
