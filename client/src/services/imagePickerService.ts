import { 
    launchImageLibrary, 
    ImageLibraryOptions, 
    ImagePickerResponse 
  } from 'react-native-image-picker';
  import { Platform, PermissionsAndroid, Alert } from 'react-native';
  
  /**
   * Utility service to handle image picking from the gallery on both Android and iOS.
   * Standardizes the output for the Velto upload services.
   */
  export class ImagePickerService {
    /**
     * Launch the device gallery to pick a single image.
     * @param options Custom picker options
     * @returns Selected file metadata or null if cancelled
     */
    static async pickImage(options: ImageLibraryOptions = {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1200,
        maxHeight: 1200,
    }): Promise<any | null> {
      try {
        const hasPermission = await this.requestPermissions();
        if (!hasPermission) {
          Alert.alert('Permission Denied', 'Gallery access is required to upload images.');
          return null;
        }
  
        const result: ImagePickerResponse = await launchImageLibrary(options);
  
        if (result.didCancel) return null;
        if (result.errorCode) {
          console.error('[PICKER] Error Code:', result.errorCode);
          return null;
        }
  
        const asset = result.assets?.[0];
        if (!asset) return null;
  
        // Standardize file object for FormData
        return {
          uri: Platform.OS === 'android' ? asset.uri : asset.uri?.replace('file://', ''),
          type: asset.type || 'image/jpeg',
          name: asset.fileName || `upload_${Date.now()}.jpg`,
        };
      } catch (error) {
        console.error('[PICKER] Fatal Error:', error);
        return null;
      }
    }
  
    private static async requestPermissions(): Promise<boolean> {
      if (Platform.OS === 'ios') return true; // iOS handles internally via launchImageLibrary
      
      if (Platform.OS === 'android') {
        const version = parseInt(Platform.Version.toString(), 10);
        
        if (version >= 33) {
          // Android 13+ (API 33+) uses READ_MEDIA_IMAGES
          const granted = await PermissionsAndroid.request(
            (PermissionsAndroid.PERMISSIONS as any).READ_MEDIA_IMAGES
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        } else {
          // Android 12 and below
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
      }
      return false;
    }
  }
  