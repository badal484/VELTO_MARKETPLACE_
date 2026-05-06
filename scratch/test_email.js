const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Basic env parser
const envContent = fs.readFileSync(path.join(__dirname, '../server/.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim().replace(/"/g, '');
});

const testEmail = async () => {
  console.log('🧪 Starting Email Test (JS)...');
  console.log('User:', env.EMAIL_USER);
  
  const transporter = nodemailer.createTransport({
    host: env.EMAIL_HOST || 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: env.EMAIL_USER,
      pass: env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔗 Verifying connection...');
    await transporter.verify();
    console.log('✅ Connection verified!');

    console.log('✉️ Sending test email to ' + env.EMAIL_USER + '...');
    const info = await transporter.sendMail({
      from: env.EMAIL_FROM || env.EMAIL_USER,
      to: env.EMAIL_USER,
      subject: 'Velto Test Email',
      text: 'If you see this, your email service is working correctly!',
    });

    console.log('🚀 Email sent successfully!');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('❌ EMAIL TEST FAILED');
    console.error(error);
  }
};

testEmail();
