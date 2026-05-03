import { User } from '../models/User';
import { AppError } from '../utils/errors';
import { io } from '../socket/socket';
import { SocketEvent } from '@shared/constants/socketEvents';

export class UserService {
  static async registerAsRider(userId: string, data: {
    licenseNumber: string;
    phoneNumber: string;
    vehicleDetails: { type?: string; model?: string; number?: string };
    bankDetails: { holderName: string; bankName: string; accountNumber: string; ifscCode: string };
  }) {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    if (user.riderStatus === 'verified') throw new AppError('Already a verified rider', 400);

    user.licenseNumber = data.licenseNumber;
    user.phoneNumber = data.phoneNumber;
    user.vehicleDetails = data.vehicleDetails;
    user.bankDetails = data.bankDetails;
    user.riderStatus = 'pending';
    user.riderDocuments = user.riderDocuments || [];

    await user.save();

    // Notify admins about new rider application
    io.emit(SocketEvent.NEW_APPLICATION, { type: 'rider', name: user.name });

    return user.toObject();
  }
}
