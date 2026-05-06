import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../server/.env') });

const testEmail = async () => {
  console.log('🧪 Starting Email Test...');
  console.log('User:', process.env.EMAIL_USER);
  
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔗 Verifying connection...');
    await transporter.verify();
    console.log('✅ Connection verified!');

    console.log('✉️ Sending test email...');
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Send to self
      subject: 'Velto Test Email',
      text: 'If you see this, your email service is working correctly!',
    });

    console.log('🚀 Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
  } catch (error) {
    console.error('❌ EMAIL TEST FAILED');
    console.error(error);
  }
};

testEmail();
