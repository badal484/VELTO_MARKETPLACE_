import jwt from 'jsonwebtoken';

export const generateToken = (id: string, role: string) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'super_secret_velto_key_123', {
    expiresIn: '30d',
  });
};