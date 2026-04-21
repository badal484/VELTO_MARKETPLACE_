import {Linking, Platform} from 'react-native';

/**
 * Universal utility to open the native map application (Google Maps or Apple Maps).
 * @param lat Latitude coordinate
 * @param lng Longitude coordinate
 * @param label Optional label for the location
 * @param address Optional address string to fallback to or use as destination
 */
export const openMap = (
  lat?: number,
  lng?: number,
  label?: string,
  address?: string,
) => {
  const scheme = Platform.select({
    ios: 'maps:0,0?q=',
    android: 'geo:0,0?q=',
  });
  
  if (lat && lng) {
    const latLng = `${lat},${lng}`;
    const url = Platform.select({
      ios: `maps://app?daddr=${latLng}&label=${label || 'Location'}`,
      android: `google.navigation:q=${latLng}(${label || 'Location'})`,
    });

    if (url) {
        Linking.canOpenURL(url).then(supported => {
        if (supported) {
            Linking.openURL(url);
        } else {
            // Fallback to coordinates universal link
            Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latLng}`);
        }
        });
    }
  } else if (address) {
    // Fallback to address string if coordinates are missing
    const encodedAddress = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps://app?daddr=${encodedAddress}`,
      android: `google.navigation:q=${encodedAddress}`,
    });

    if (url) {
        Linking.openURL(url).catch(() => {
            Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`);
        });
    }
  }
};
