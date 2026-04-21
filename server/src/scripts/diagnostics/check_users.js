const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../server/.env') });

const UserSchema = new mongoose.Schema({
  email: String,
  isRiderVerified: Boolean,
  riderStatus: String,
  role: String
});

const User = mongoose.model('User', UserSchema);

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const users = await User.find({ role: 'rider' });
    console.log(JSON.stringify(users, null, 2));
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
