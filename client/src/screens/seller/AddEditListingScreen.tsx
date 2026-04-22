import React, {useState} from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {launchImageLibrary} from 'react-native-image-picker';
import {Input} from '../../components/common/Input';
import {Button} from '../../components/common/Button';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Category} from '@shared/types';
import {LocationSearch} from '../../components/common/LocationSearch';
import {locationService, LocationResult} from '../../services/locationService';
import Icon from 'react-native-vector-icons/Ionicons';
import {useToast} from '../../hooks/useToast';
import Animated, {FadeInUp, FadeInRight} from 'react-native-reanimated';
import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp} from '@react-navigation/native';
import {DashboardStackParamList} from '../../navigation/types';

const {width} = Dimensions.get('window');

type AddEditListingNavigationProp = StackNavigationProp<
  DashboardStackParamList,
  'AddEditListing'
>;
type AddEditListingRouteProp = RouteProp<
  DashboardStackParamList,
  'AddEditListing'
>;

interface AddEditListingProps {
  route: AddEditListingRouteProp;
  navigation: AddEditListingNavigationProp;
}

export default function AddEditListingScreen({
  route,
  navigation,
}: AddEditListingProps) {
  const {showToast} = useToast();
  const product = route.params?.product;
  const isEditing = !!product;

  const [title, setTitle] = useState(product?.title || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product?.price?.toString() || '');
  const [stock, setStock] = useState(product?.stock?.toString() || '1');
  const [category, setCategory] = useState<Category>(
    product?.category || Category.OTHER,
  );
  const [images, setImages] = useState<string[]>(product?.images || []);
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(
    product?.location
      ? {
          lat: product.location.coordinates[1],
          lng: product.location.coordinates[0],
        }
      : null,
  );
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [locationName, setLocationName] = useState(product?.locationName || '');

  const requestLocationPermission = async () => {
    if (Platform.OS === 'ios') {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      return auth === 'granted';
    }

    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return false;
  };

  const handleGetCurrentLocation = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      showToast({message: 'Location permission denied', type: 'error'});
      return;
    }

    setGpsLoading(true);
    Geolocation.getCurrentPosition(
      async position => {
        const {latitude, longitude} = position.coords;
        setCoordinates({lat: latitude, lng: longitude});

        // Reverse geocode to get a readable name
        const result = await locationService.reverseGeocode(latitude, longitude);
        if (result) {
          setLocationName(result.formatted);
        }
        setGpsLoading(false);
        showToast({message: 'Current location linked!', type: 'success'});
      },
      error => {
        console.log('GPS Error:', error);
        showToast({message: 'Could not fetch location', type: 'error'});
        setGpsLoading(false);
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  };

  const handlePickImage = async () => {
    if (images.length >= 5) {
      showToast({message: 'You can only upload up to 5 images', type: 'info'});
      return;
    }
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
      });
      if (result.assets && result.assets.length > 0) {
        setImages([...images, result.assets[0].uri!]);
      }
    } catch (err: unknown) {
      console.log('Image Picker Error:', err);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title || !description || !price || !stock) {
      showToast({message: 'Please fill in all the details', type: 'info'});
      return;
    }

    if (images.length < 3) {
      showToast({message: 'Please upload at least 3 photos', type: 'info'});
      return;
    }

    if (!coordinates) {
      showToast({message: 'Please set the pickup location', type: 'info'});
      return;
    }

    setLoading(true);
    try {
      const cleanPrice = price.replace(/[^0-9.]/g, '');
      const cleanStock = stock.replace(/[^0-9]/g, '');

      if (isNaN(parseFloat(cleanPrice)) || isNaN(parseInt(cleanStock))) {
        showToast({message: 'Please enter valid numeric values for price and stock', type: 'error'});
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('price', cleanPrice);
      formData.append('stock', cleanStock);
      formData.append('category', category);
      formData.append('lat', coordinates.lat.toString());
      formData.append('lng', coordinates.lng.toString());

      images.forEach((uri, index) => {
        const name = `image_${index}.jpg`;
        const type = 'image/jpeg';
        formData.append('images', {
          uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
          name,
          type,
        } as any);
      });

      if (isEditing && product) {
        await axiosInstance.put(`/api/products/${product._id}`, formData, {
          headers: {'Content-Type': 'multipart/form-data'},
        });
        showToast({message: 'Listing updated successfully!', type: 'success'});
      } else {
        await axiosInstance.post('/api/products', formData, {
          headers: {'Content-Type': 'multipart/form-data'},
        });
        showToast({message: 'New listing published successfully!', type: 'success'});
      }
      navigation.goBack();
    } catch (err: unknown) {
      console.log('Submission Error:', err);
      let msg = 'Could not save listing. Please try again.';
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as {response: {data: {message: string}}};
        msg = axiosErr.response?.data?.message || msg;
      }
      showToast({message: msg, type: 'error'});
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = (loc: LocationResult) => {
    setCoordinates({lat: loc.lat, lng: loc.lon});
    setLocationName(loc.formatted);
  };

  const categoriesList = [
    {id: Category.ELECTRONICS, icon: 'hardware-chip'},
    {id: Category.FOOD, icon: 'fast-food'},
    {id: Category.CLOTHING, icon: 'shirt'},
    {id: Category.HOME, icon: 'home'},
    {id: Category.CONSTRUCTION, icon: 'build'},
    {id: Category.OTHER, icon: 'sparkles'},
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}>
          <Icon name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {isEditing ? 'Update Listing' : 'New Listing'}
          </Text>
          <Text style={styles.headerSub}>
            {isEditing
              ? 'Refine your product details'
              : 'Reach thousands of local buyers'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInUp.duration(600)}>
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Icon
                name="information-circle-outline"
                size={18}
                color={theme.colors.primary}
              />
              <Text style={styles.sectionLabel}>Essential Info</Text>
            </View>
            <Input
              label="Product Title"
              placeholder="e.g. Vintage Brass Lamp"
              value={title}
              onChangeText={setTitle}
            />
            <Input
              label="Description"
              placeholder="Tell buyers why they should love this item..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />

            <View style={styles.row}>
              <View style={{flex: 1, marginRight: 8}}>
                <Input
                  label="Price (₹)"
                  placeholder="0.00"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                />
              </View>
              <View style={{flex: 1, marginLeft: 8}}>
                <Input
                  label="Stock Count"
                  placeholder="1"
                  value={stock}
                  onChangeText={setStock}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Icon
                name="grid-outline"
                size={18}
                color={theme.colors.primary}
              />
              <Text style={styles.sectionLabel}>Category</Text>
            </View>
            <View style={styles.categoryGrid}>
              {categoriesList.map((cat, idx) => {
                const isActive = category === cat.id;
                return (
                  <Animated.View
                    key={cat.id}
                    entering={FadeInRight.delay(idx * 50)}>
                    <TouchableOpacity
                      style={[styles.catItem, isActive && styles.catItemActive]}
                      onPress={() => setCategory(cat.id)}
                      activeOpacity={0.8}>
                      <Icon
                        name={cat.icon}
                        size={14}
                        color={
                          isActive ? theme.colors.white : theme.colors.primary
                        }
                      />
                      <Text
                        style={[
                          styles.catText,
                          isActive && styles.catTextActive,
                        ]}>
                        {cat.id}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Icon
                name="location-outline"
                size={18}
                color={theme.colors.primary}
              />
              <Text style={styles.sectionLabel}>Pickup Location</Text>
            </View>
            <View style={styles.locationHeader}>
              <Text style={styles.helpText}>
                Pin the exact pickup point for buyers.
              </Text>
              <TouchableOpacity
                style={styles.gpsBtn}
                onPress={handleGetCurrentLocation}
                disabled={gpsLoading}
                activeOpacity={0.7}>
                <Icon
                  name={gpsLoading ? 'refresh' : 'locate'}
                  size={16}
                  color={theme.colors.primary}
                />
                <Text style={styles.gpsBtnTxt}>
                  {gpsLoading ? 'Locating...' : 'Use GPS'}
                </Text>
              </TouchableOpacity>
            </View>
            <LocationSearch
              onSelect={handleLocationSelect}
              initialValue={locationName}
            />
            {coordinates && (
              <View style={styles.locationSuccess}>
                <Icon
                  name="checkmark-circle"
                  size={16}
                  color={theme.colors.success}
                />
                <Text style={styles.locationTxt} numberOfLines={2}>
                  Linked: {locationName || `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Icon
                name="images-outline"
                size={18}
                color={theme.colors.primary}
              />
              <Text style={styles.sectionLabel}>
                Media Gallary (3-5 Photos)
              </Text>
            </View>
            <View style={styles.imageGrid}>
              {images.map((uri, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image
                    source={{uri}}
                    style={styles.image}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeImage(index)}
                    activeOpacity={0.8}>
                    <Icon name="close" size={14} color={theme.colors.white} />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 5 && (
                <TouchableOpacity
                  style={styles.imagePlaceholder}
                  onPress={handlePickImage}
                  activeOpacity={0.7}>
                  <Icon name="camera" size={24} color={theme.colors.primary} />
                  <Text style={styles.addPhotoTxt}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.actionSection}>
            <Button
              title={isEditing ? 'Update Listing' : 'Publish Now'}
              onPress={handleSubmit}
              isLoading={loading}
              type="primary"
              style={styles.mainBtn}
            />
            <Text style={styles.disclaimer}>
              By publishing, you agree to our Marketplace Seller Policies.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: theme.colors.white},
  container: {flex: 1, backgroundColor: theme.colors.background},
  scrollContent: {padding: 20},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    backgroundColor: theme.colors.white,
    ...theme.shadow.sm,
    zIndex: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerContent: {flex: 1},
  headerTitle: {fontSize: 20, fontWeight: '900', color: theme.colors.text},
  headerSub: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '600',
    marginTop: 2,
  },
  form: {padding: 20},
  card: {
    backgroundColor: theme.colors.white,
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...theme.shadow.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.colors.text,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  row: {flexDirection: 'row'},
  helpText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '500',
    lineHeight: 18,
    flex: 1,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '10',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.primary + '20',
  },
  gpsBtnTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
    marginLeft: 6,
  },
  categoryGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  catItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  catItemActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  catText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginLeft: 8,
  },
  catTextActive: {color: theme.colors.white},
  imageGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  imageWrapper: {
    width: (width - 100) / 3,
    height: (width - 100) / 3,
    borderRadius: 16,
    position: 'relative',
    overflow: 'hidden',
    ...theme.shadow.sm,
  },
  image: {width: '100%', height: '100%'},
  removeBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholder: {
    width: (width - 100) / 3,
    height: (width - 100) / 3,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary + '05',
  },
  addPhotoTxt: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.colors.primary,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  locationSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: 10,
  },
  locationTxt: {fontSize: 11, color: '#166534', fontWeight: '600'},
  actionSection: {marginTop: 10, paddingBottom: 40},
  mainBtn: {height: 56, borderRadius: 16},
  disclaimer: {
    fontSize: 11,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
  },
});