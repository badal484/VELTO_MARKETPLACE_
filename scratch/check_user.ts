import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../server/.env') });

const UserSchema = new mongoose.Schema({
  email: String,
  isBlocked: Boolean,
});

const User = mongoose.model('User', UserSchema);

async function checkUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    const user = await User.findOne({ email: 'admin@nexbuy.com' });
    console.log('User found:', user);
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkUser();
