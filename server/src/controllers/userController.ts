import { Request, Response } from 'express';
import { User } from '../models/User';
import { UserService } from '../services/userService';
import { updateProfileSchema, addressSchema, riderRegisterSchema } from '../utils/validation';
import { handleError } from '../utils/errors';
import { imageKitService } from '../services/imageKitService';

export const updateAvatar = async (req: Request, res: Response): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image' });
    }

    const avatarUrl = await imageKitService.uploadImage(req.file, 'avatars');
    
    const user = await User.findById((req as any).user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.avatar = avatarUrl;
    await user.save();

    return res.status(200).json({ 
      success: true, 
      data: { avatar: avatarUrl }, 
      message: 'Avatar updated successfully' 
    });
  } catch (error: any) {
    handleError(error, res);
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<any> => {
  try {
    const validatedData = updateProfileSchema.parse(req.body);
    const user = await User.findById((req as any).user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (validatedData.name) user.name = validatedData.name;
    if (validatedData.phoneNumber) user.phoneNumber = validatedData.phoneNumber;

    await user.save();

    return res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phoneNumber: user.phoneNumber,
        addresses: user.addresses
      },
       message: 'Profile updated successfully'
    });
  } catch (error: any) {
    handleError(error, res);
  }
};

export const registerRider = async (req: Request, res: Response): Promise<any> => {
  try {
    const validatedData = riderRegisterSchema.parse(req.body);
    const user = await UserService.registerAsRider((req as any).user?._id.toString()!, validatedData);
    return res.json({ success: true, data: user, message: 'Rider application submitted' });
  } catch (error) {
    handleError(error, res);
  }
};

export const addAddress = async (req: Request, res: Response): Promise<any> => {
  try {
    const validatedData = addressSchema.parse(req.body);
    const user = await User.findById((req as any).user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.addresses) {
      user.addresses = [];
    }

    const newAddress = {
      label: validatedData.label,
      street: validatedData.street,
      city: validatedData.city,
      state: validatedData.state,
      pincode: validatedData.pincode,
      landmark: validatedData.landmark,
      isDefault: validatedData.isDefault || false
    };

    if (newAddress.isDefault || user.addresses.length === 0) {
      user.addresses.forEach(addr => addr.isDefault = false);
      newAddress.isDefault = true;
    }

    user.addresses.push(newAddress);
    await user.save();

    return res.status(201).json({ success: true, data: user.addresses, message: 'Address added successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAddress = async (req: Request, res: Response): Promise<any> => {
  try {
    const user = await User.findById((req as any).user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.addresses) {
      return res.status(200).json({ success: true, data: [], message: 'No addresses to remove' });
    }

    user.addresses = user.addresses.filter(addr => addr._id?.toString() !== req.params.id);
    await user.save();

    return res.status(200).json({ success: true, data: user.addresses, message: 'Address removed' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleOnlineStatus = async (req: Request, res: Response): Promise<any> => {
  try {
    const user = await User.findById((req as any).user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isOnline = !user.isOnline;
    await user.save();

    return res.status(200).json({ 
      success: true, 
      data: { isOnline: user.isOnline }, 
      message: `You are now ${user.isOnline ? 'Online' : 'Offline'}` 
    });
  } catch (error: any) {
    handleError(error, res);
  }
};
