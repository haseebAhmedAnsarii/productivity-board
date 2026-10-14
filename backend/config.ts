import dotenv from 'dotenv';

dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_change_me';
export const PORT = process.env.PORT || 4000;
