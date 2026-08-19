const nodemailer = require('nodemailer');
const db = require('../db');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async (to, subject, html) => {
  if (!process.env.SMTP_USER) {
    console.log('Email not configured, skipping...');
    return;
  }

  try {
    await transporter.sendMail({
      from: `"Kinerja Berkah - Bank Sumut" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('Email send error:', error.message);
  }
};

const notifyApprovalRequest = async (supervisorEmail, employeeName, unitName) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Kinerja Berkah</h1>
        <p style="color: #e0e7ff; margin: 5px 0 0;">Sistem Informasi KPI Bank Sumut</p>
      </div>
      <div style="padding: 20px; background: #f8fafc;">
        <h2 style="color: #1e293b;">Permintaan Approval KPI</h2>
        <p style="color: #475569;">KPI dari <strong>${employeeName}</strong> (${unitName}) menunggu approval Anda.</p>
        <p style="color: #475569;">Silakan login ke sistem untuk meninjau dan memberikan approval.</p>
        <a href="${process.env.APP_URL || 'https://kinerjaberkah.banksumut.co.id'}" 
           style="display: inline-block; padding: 12px 24px; background: #1e40af; color: white; text-decoration: none; border-radius: 6px; margin-top: 10px;">
          Buka Sistem
        </a>
      </div>
      <div style="padding: 15px; text-align: center; background: #e2e8f0; font-size: 12px; color: #64748b;">
        <p>Email ini dikirim secara otomatis. Mohon tidak membalas email ini.</p>
        <p>&copy; 2026 Bank Sumut - Kinerja Berkah</p>
      </div>
    </div>
  `;

  await sendEmail(supervisorEmail, `[Kinerja Berkah] Approval KPI - ${employeeName}`, html);
};

const notifyApprovalResult = async (employeeEmail, employeeName, action, supervisorName) => {
  const status = action === 'Approve' ? 'Disetujui' : 'Ditolak';
  const color = action === 'Approve' ? '#22c55e' : '#ef4444';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Kinerja Berkah</h1>
      </div>
      <div style="padding: 20px; background: #f8fafc;">
        <h2 style="color: #1e293b;">KPI ${status}</h2>
        <p style="color: #475569;">KPI Anda telah <strong style="color: ${color};">${status}</strong> oleh <strong>${supervisorName}</strong>.</p>
        ${action === 'Reject' ? '<p style="color: #ef4444;">Silakan perbaiki dan submit ulang KPI Anda.</p>' : '<p style="color: #22c55e;">Terima kasih atas kontribusi Anda.</p>'}
      </div>
      <div style="padding: 15px; text-align: center; background: #e2e8f0; font-size: 12px; color: #64748b;">
        <p>&copy; 2026 Bank Sumut - Kinerja Berkah</p>
      </div>
    </div>
  `;

  await sendEmail(employeeEmail, `[Kinerja Berkah] KPI ${status}`, html);
};

const notifyMutation = async (employeeEmail, employeeName, oldUnit, newUnit, effectiveDate) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0;">Kinerja Berkah</h1>
      </div>
      <div style="padding: 20px; background: #f8fafc;">
        <h2 style="color: #1e293b;">Notifikasi Mutasi Pegawai</h2>
        <p style="color: #475569;">Anda telah dimutasi:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Unit Lama</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${oldUnit}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Unit Baru</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${newUnit}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>Tanggal Efektif</strong></td><td style="padding: 8px; border: 1px solid #e2e8f0;">${effectiveDate}</td></tr>
        </table>
        <p style="color: #475569;">KPI Anda telah di-split sesuai periode mutasi.</p>
      </div>
      <div style="padding: 15px; text-align: center; background: #e2e8f0; font-size: 12px; color: #64748b;">
        <p>&copy; 2026 Bank Sumut - Kinerja Berkah</p>
      </div>
    </div>
  `;

  await sendEmail(employeeEmail, `[Kinerja Berkah] Mutasi Pegawai - ${employeeName}`, html);
};

module.exports = { notifyApprovalRequest, notifyApprovalResult, notifyMutation };
