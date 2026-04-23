import React, {useEffect, useState, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
  RefreshControl,
  Dimensions,
  Platform,
  PermissionsAndroid,
  Modal,
  Pressable,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Button} from '../../components/common/Button';
import {LocationSearch} from '../../components/common/LocationSearch';
import {LocationResult} from '../../services/locationService';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {IProduct, Category} from '@shared/types';
import {StackNavigationProp} from '@react-navigation/stack';
import {useToast} from '../../hooks/useToast';
import {useAuth} from '../../hooks/useAuth';
import {useTranslation} from 'react-i18next';
import {useNotifications} from '../../context/NotificationContext';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {HomeStackParamList, MainTabParamList} from '../../navigation/types';

const {width} = Dimensions.get('window');

type HomeScreenNavigationProp = StackNavigationProp<
  HomeStackParamList & MainTabParamList,
  'Home'
>;

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

// Distance calculation helper (Haversine formula)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const ProductCard = ({
  item,
  index: _index,
  navigation,
  handleToggleWishlist,
  customWidth,
  currentCoords,
}: {
  item: IProduct;
  index: number;
  navigation: any;
  handleToggleWishlist: (id: string) => void;
  customWidth?: number;
  currentCoords?: {lat: number; lng: number} | null;
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <Animated.View entering={FadeInDown.duration(250)}>
      <Animated.View
        style={[
          styles.cardWrapper,
          animatedStyle,
          customWidth ? {width: customWidth} : {},
        ]}>
        <Pressable
          style={styles.card}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => navigation.navigate('ProductDetail', {id: item._id})}
          delayLongPress={100}>
          <View style={styles.imageContainer}>
            <Image
              source={{uri: item.images[0]}}
              style={styles.image}
              resizeMode="cover"
            />
            <View style={styles.badgeContainer}>
              {item.isNearby && (
                <View
                  style={[
                    styles.nearbyBadge,
                    {backgroundColor: theme.colors.primary},
                  ]}>
                  <Text style={styles.nearbyBadgeText}>NEARBY</Text>
                </View>
              )}
              {item.stock > 0 && item.stock < 5 && (
                <View style={styles.lowStockBadge}>
                  <Text style={styles.lowStockBadgeText}>LIMITED</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.favoriteButton}
              activeOpacity={0.8}
              onPress={e => {
                e.stopPropagation();
                handleToggleWishlist(item._id);
              }}>
              <Icon
                name={item.isWishlisted ? 'heart' : 'heart-outline'}
                size={16}
                color={
                  item.isWishlisted ? theme.colors.primary : theme.colors.muted
                }
              />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.titleRow}>
              <Text style={styles.categoryLabel}>{item.category}</Text>
              {item.distance !== undefined || (currentCoords && (item.location?.coordinates || (item.shop as any)?.location?.coordinates)) ? (
                <View style={styles.distanceBadgeSmall}>
                  <Icon name="location-sharp" size={10} color={theme.colors.primary} />
                  <Text style={styles.distanceText}>
                    {(item.distance !== undefined 
                      ? item.distance 
                      : calculateDistance(
                          currentCoords!.lat, 
                          currentCoords!.lng, 
                          (item.location?.coordinates?.[1] ?? (item.shop as any)?.location?.coordinates?.[1]), 
                          (item.location?.coordinates?.[0] ?? (item.shop as any)?.location?.coordinates?.[0])
                        )
                    ).toFixed(1)} km
                  </Text>
                </View>
              ) : (
                <View style={styles.distanceBadgeSmall}>
                  <Icon name="navigate-outline" size={10} color={theme.colors.primary} />
                  <Text style={styles.distanceText}>Nearby</Text>
                </View>
              )}
            </View>
            <Text style={styles.productTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>
                ₹{item.price.toLocaleString('en-IN')}
              </Text>
              {(item.numReviews ?? 0) > 0 && (
                <View style={styles.ratingBox}>
                  <Text style={styles.ratingText}>{item.rating}</Text>
                  <Icon name="star" size={10} color="#fff" />
                </View>
              )}
            </View>
            <View style={styles.shopInRow}>
              <Icon
                name="storefront-outline"
                size={12}
                color={theme.colors.muted}
              />
              <Text style={styles.shopInName} numberOfLines={1}>
                {(item.shop as any)?.name || 'City Seller'}
              </Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
};

interface IBanner {
  _id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  category: Category;
  isActive: boolean;
}

export default function HomeScreen({navigation}: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const {t} = useTranslation();
  const {user} = useAuth();
  const {showToast} = useToast();
  const [products, setProducts] = useState<IProduct[]>([]);
  const [banners, setBanners] = useState<IBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [addressName, setAddressName] = useState('Locating...');
  const [showLocationModal, setShowLocationModal] = useState(false);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'VeltoMarketplace/1.0',
          },
        }
      );
      const data = await response.json();
      if (data && data.address) {
        const area = data.address.suburb || data.address.neighbourhood || data.address.road || data.address.city || 'Unknown Area';
        setAddressName(area);
      }
    } catch (error) {
      setAddressName('Current Location');
    }
  };
  const [currentCoords, setCurrentCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const {unreadCount} = useNotifications();
  const [isGlobalMode, setIsGlobalMode] = useState(false);

  // Auto-scrolling carousel logic
  const carouselRef = useRef<FlatList>(null);
  const scrollIndex = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (carouselRef.current && banners.length > 0) {
        // If we are at the cloned item (end of list), snap back to REAL first item silently
        if (scrollIndex.current >= banners.length) {
          carouselRef.current.scrollToIndex({
            index: 0,
            animated: false,
          });
          scrollIndex.current = 0;
        }

        let nextIndex = scrollIndex.current + 1;
        carouselRef.current.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
        scrollIndex.current = nextIndex;
      }
    }, 4000); // 4 seconds delay
    return () => clearInterval(timer);
  }, [banners]);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const res = await axiosInstance.get('/api/banners');
      setBanners(res.data.data);
    } catch (error) {
      // Failed to fetch banners
    }
  };

  // Animation values for Express Delivery Banner
  const scale = useSharedValue(1);
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.2, {duration: 800}),
        withTiming(1, {duration: 800}),
      ),
      -1,
      true,
    );
  }, []);

  const animatedBannerStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
  }));

  const handleBannerPressIn = () => {
    scale.value = withSpring(0.96);
  };

  const handleBannerPressOut = () => {
    scale.value = withSpring(1);
  };

  // Initial load + global mode toggle: full GPS re-fetch
  useEffect(() => {
    getUserLocationAndFetch();
  }, [isGlobalMode]);

  // Category change: reuse stored coords, no GPS re-fetch needed
  useEffect(() => {
    if (currentCoords) {
      fetchProducts(currentCoords);
    }
  }, [selectedCategory]);

  const getUserLocationAndFetch = async () => {
    setLoading(true);
    try {
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        const hasPermission = await requestLocationPermission();
        if (hasPermission) {
          Geolocation.getCurrentPosition(
            pos => {
              const coords = {lat: pos.coords.latitude, lng: pos.coords.longitude};
              setCurrentCoords(coords);
              fetchProducts(coords);
              reverseGeocode(coords.lat, coords.lng);
            },
            error => {
              const fallback = {lat: 12.9716, lng: 77.5946};
              setCurrentCoords(fallback);
              fetchProducts(fallback);
              setAddressName('Bangalore');
            },
            {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
          );
        } else {
          setAddressName('Global Marketplace');
          fetchProducts(null);
        }
      } else {
        fetchProducts(null);
      }
    } catch (error) {
      setAddressName('Global Marketplace');
      fetchProducts(null);
    }
  };

  const handleAreaSelect = (location: LocationResult) => {
    const coords = {lat: location.lat, lng: location.lon};
    setCurrentCoords(coords);
    setAddressName(location.formatted.split(',')[0]); // Use first part of address
    setShowLocationModal(false);
    fetchProducts(coords);
  };

  const requestLocationPermission = async () => {
    if (Platform.OS === 'ios') {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      return auth === 'granted';
    }

    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Permission error:', err);
        return false;
      }
    }
    return true;
  };

  const fetchProducts = async (coords?: {lat: number; lng: number} | null) => {
    try {
      let url = '/api/products';
      const params = [];

      if (selectedCategory) {
        params.push(`category=${selectedCategory}`);
      }

      if (coords && coords.lat && coords.lng) {
        params.push(`lat=${coords.lat}`);
        params.push(`lng=${coords.lng}`);
        
        // If "For You" (null category) or a local category is selected, limit to 5km
        if (!isGlobalMode) {
          params.push('radius=5');
        }
      }

      if (params.length > 0) {
        url += '?' + params.join('&');
      }

      if (isGlobalMode) {
        url += (url.includes('?') ? '&' : '?') + 'global=true';
      }

      const res = await axiosInstance.get(url);
      setProducts(res.data.data);
    } catch (e: unknown) {
      showToast({message: 'Could not fetch products', type: 'error'});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    getUserLocationAndFetch();
  };

  const handleToggleWishlist = async (productId: string) => {
    try {
      // Optimistic Update
      setProducts(current =>
        current.map(p =>
          p._id === productId ? {...p, isWishlisted: !p.isWishlisted} : p,
        ),
      );

      await axiosInstance.post('/api/wishlist/toggle', {productId});
    } catch (err) {
      // Revert on error
      fetchProducts(currentCoords);
    }
  };

  const renderProduct = ({item, index}: {item: IProduct; index: number}) => (
    <ProductCard
      item={item}
      index={index}
      navigation={navigation}
      handleToggleWishlist={handleToggleToggleWishlist}
      currentCoords={currentCoords}
    />
  );

  const handleToggleToggleWishlist = (productId: string) => {
    handleToggleWishlist(productId);
  };

  const categoriesList: {id: Category | 'GLOBAL' | null; icon: string; label: string}[] = [
    {id: null, icon: 'sparkles', label: 'For You'},
    {id: 'GLOBAL', icon: 'globe-outline', label: 'Global'},
    {id: Category.ELECTRONICS, icon: 'hardware-chip', label: 'Electronics'},
    {id: Category.FOOD, icon: 'fast-food', label: 'Food'},
    {id: Category.CLOTHING, icon: 'shirt', label: 'Clothing'},
    {id: Category.HOME, icon: 'home', label: 'Home'},
    {id: Category.CONSTRUCTION, icon: 'construct', label: 'Construction'},
    {id: Category.OTHER, icon: 'apps', label: 'Other'},
  ];

  const renderCategory = ({item}: {item: (typeof categoriesList)[0]}) => {
    const isActive = selectedCategory === item.id;
    return (
      <TouchableOpacity
        style={[styles.categoryBtn, isActive && styles.categoryBtnActive]}
        activeOpacity={0.8}
        onPress={() => setSelectedCategory(isActive ? null : item.id)}>
        <View
          style={[
            styles.categoryIconCircle,
            isActive && {backgroundColor: 'rgba(255,255,255,0.2)'},
          ]}>
          <Icon
            name={item.icon}
            size={18}
            color={isActive ? theme.colors.white : theme.colors.primary}
          />
        </View>
        <Text
          style={[
            styles.categoryBtnText,
            isActive && styles.categoryBtnTextActive,
          ]}>
          {item.id}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.topRow}>
        <View style={styles.topRowLeft}>
          <TouchableOpacity
            style={styles.locationSelector}
            onPress={() => setShowLocationModal(true)}>
            <Icon name="location" size={12} color={theme.colors.primary} />
            <Text style={styles.areaText} numberOfLines={1}>
              {addressName}
            </Text>
            <Icon name="chevron-down" size={14} color={theme.colors.muted} />
          </TouchableOpacity>
          {user && (
            <Text style={styles.greetingText}>
              {t('home.welcome')}, {user.name.split(' ')[0]}
            </Text>
          )}

          <Text style={styles.mainHeader}>
            {isGlobalMode ? t('home.global_marketplace') : t('home.find_nearby')}
          </Text>
        </View>
        <View style={styles.topRowRight}>
          <TouchableOpacity
            style={styles.notificationBtn}
            onPress={() => navigation.navigate('Notifications')}>
            <Icon
              name="notifications-outline"
              size={26}
              color={theme.colors.text}
            />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.logoText}>VELTO</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.searchBar}
        onPress={() => navigation.navigate('BrowseTab', {screen: 'Browse'})}
        activeOpacity={0.9}>
        <Icon name="search-outline" size={20} color={theme.colors.muted} />
        <Text style={styles.searchText}>{t('common.search')}</Text>
      </TouchableOpacity>

      <View style={styles.quickNavSection}>
        <View style={styles.quickNavHeader}>
          <View style={styles.categoryTitleRow}>
            <Text style={styles.sectionTitle}>Explore Categories</Text>
            <Text style={styles.categoryDivider}> | </Text>
            <Text style={styles.categoryActiveName}>
              {selectedCategory ?? 'For You'}
            </Text>
          </View>
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categoriesList}
          keyExtractor={item => item.label}
          contentContainerStyle={styles.quickNavContent}
          renderItem={({item}) => {
            const isActive = item.id === 'GLOBAL' ? isGlobalMode : (selectedCategory === item.id && !isGlobalMode);
            return (
              <TouchableOpacity
                style={styles.quickNavBtn}
                activeOpacity={0.8}
                onPress={() => {
                  if (item.id === 'GLOBAL') {
                    setIsGlobalMode(true);
                    setSelectedCategory(null);
                  } else {
                    setIsGlobalMode(false);
                    setSelectedCategory(item.id as Category | null);
                  }
                }}>
                <View
                  style={[
                    styles.quickNavIconBox,
                    isActive && styles.quickNavIconBoxActive,
                  ]}>
                  {isActive && <View style={styles.quickNavActiveDot} />}
                  <Icon
                    name={item.icon}
                    size={22}
                    color={isActive ? theme.colors.white : theme.colors.primary}
                  />
                </View>
                <Text
                  style={[
                    styles.quickNavText,
                    isActive && styles.quickNavTextActive,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <View style={styles.carouselSection}>
        <FlatList
          ref={carouselRef}
          horizontal
          pagingEnabled={false}
          showsHorizontalScrollIndicator={false}
          snapToInterval={width}
          decelerationRate="fast"
          onMomentumScrollEnd={e => {
            const contentOffsetX = e.nativeEvent.contentOffset.x;
            const newIndex = Math.round(contentOffsetX / width);

            if (newIndex === banners.length) {
              carouselRef.current?.scrollToIndex({index: 0, animated: false});
              scrollIndex.current = 0;
            } else {
              scrollIndex.current = newIndex;
            }
          }}
          onScrollToIndexFailed={info => {
            const wait = new Promise(resolve => setTimeout(resolve, 500));
            wait.then(() => {
              carouselRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
              });
            });
          }}
          data={banners.length > 0 ? [...banners, banners[0]] : []}
          keyExtractor={(item, index) => item._id + '_' + index}
          renderItem={({item}) => (
            <Pressable
              onPressIn={handleBannerPressIn}
              onPressOut={handleBannerPressOut}
              onPress={() => setSelectedCategory(selectedCategory === item.category ? null : item.category)}
              style={styles.bannerItemContainer}>
              <Animated.View style={[styles.heroBanner, animatedBannerStyle]}>
                <Image
                  source={{uri: item.imageUrl}}
                  style={styles.heroImage}
                  resizeMode="cover"
                />

                <View style={styles.heroOverlayContent}>
                  <View style={styles.heroTextContent}>
                    <View style={styles.expressHeader}>
                      <Text style={styles.heroTitle}>{item.title}</Text>
                    </View>
                    <Text style={styles.heroSubtitle}>{item.subtitle}</Text>
                  </View>
                  <View style={styles.heroBadge}>
                    <Text style={styles.heroBadgeText}>
                      Shop {item.category}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            </Pressable>
          )}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {isGlobalMode ? 'Global Marketplace' : t('home.near_you')}
        </Text>
      </View>
    </View>
  );

  if (loading && !refreshing && !currentCoords) {
    return <Loader />;
  }

  const displayedProducts = isGlobalMode 
    ? products 
    : products.filter(p => {
        if (!currentCoords || !p.shop?.location?.coordinates) return true;
        const d = calculateDistance(
          currentCoords.lat,
          currentCoords.lng,
          p.shop.location.coordinates[1],
          p.shop.location.coordinates[0]
        );
        return d <= 5;
      });

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" />
      <FlatList
        data={displayedProducts}
        keyExtractor={item => item._id}
        renderItem={renderProduct}
        numColumns={2}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.columnWrapper}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <Animated.View
            entering={FadeInUp.duration(800)}
            style={styles.emptyContainer}>
            <View style={styles.emptyImageCircle}>
              <Icon name="search" size={48} color={theme.colors.muted} />
            </View>
            <Text style={styles.emptyTitle}>
              {isGlobalMode ? t('home.no_products_global') : t('common.nothing_nearby')}
            </Text>
            <Text style={styles.emptyText}>
              {isGlobalMode
                ? t('home.empty_global_text')
                : t('home.empty_nearby_text')}
            </Text>
            <View style={styles.emptyActions}>
              <Button
                title={t('common.clear_filters')}
                type="outline"
                size="sm"
                onPress={() => setSelectedCategory(null)}
                style={{marginTop: 10}}
              />
            </View>
          </Animated.View>
        }
      />

      <Modal
        visible={showLocationModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLocationModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Location</Text>
              <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Search any area (e.g. Koramangala)
            </Text>
            <LocationSearch
              onSelect={handleAreaSelect}
              placeholder="Start typing an area..."
            />
            <TouchableOpacity
              style={styles.currentLocationBtn}
              onPress={() => {
                setShowLocationModal(false);
                getUserLocationAndFetch();
              }}>
              <Icon
                name="navigate-outline"
                size={20}
                color={theme.colors.primary}
              />
              <Text style={styles.currentLocationText}>
                Use My Current Location
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.colors.background},
  list: {paddingBottom: 40},
  columnWrapper: {justifyContent: 'space-between', paddingHorizontal: 16},
  headerContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  topRowRight: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.primary,
    letterSpacing: 6,
    includeFontPadding: false,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  topRowLeft: {
    flex: 1,
    marginRight: 12,
  },
  greeting: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  locationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  areaText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    marginHorizontal: 4,
    maxWidth: 150,
  },
  greetingText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    marginTop: 8,
  },
  mainHeader: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.text,
    marginTop: 4,
    letterSpacing: -0.5,
  },
  heroBanner: {
    width: width - 32,
    height: 180,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    ...theme.shadow.md,
  },
  bannerItemContainer: {
    width: width,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  carouselSection: {
    marginBottom: 4,
    marginHorizontal: -16,
  },
  quickNavSection: {
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    marginVertical: 8,
  },
  quickNavHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickNavContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  quickNavBtn: {
    alignItems: 'center',
    width: 64,
  },
  quickNavIconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    ...theme.shadow.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  quickNavText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    opacity: 0.8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.danger + '10',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  timerText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.danger,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  horizontalList: {
    paddingLeft: 16,
    paddingBottom: 20,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    opacity: 0.9,
  },
  heroOverlayContent: {
    ...StyleSheet.absoluteFillObject,
    padding: 24,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.4)', // Gradient simulation
  },
  heroTextContent: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  heroBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  heroBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '900',
  },
  heroTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  switchText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  greetingText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 2,
    marginTop: 4,
    opacity: 0.9,
  },
  locationSelector: {
    ...theme.shadow.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    maxWidth: '100%',
  },

  areaText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text,
    marginHorizontal: 6,
    flexShrink: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 16,
    ...theme.shadow.sm,
    borderWidth: 1,
    borderColor: '#F8FAFC',
  },

  searchText: {
    marginLeft: 12,
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyActions: {
    alignItems: 'center',
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  seeAllText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  categoryList: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 12,
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...theme.shadow.sm,
  },
  categoryIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: theme.colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  categoryBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  categoryBtnTextActive: {
    color: theme.colors.white,
  },
  cardWrapper: {
    width: (width - 48) / 2,
    marginBottom: 20,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 24,
    overflow: 'hidden',
    ...theme.shadow.md,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  imageContainer: {
    width: '100%',
    height: 180,
    backgroundColor: '#F8FAFC',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badgeContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  conditionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    marginTop: 4,
  },
  nearbyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  nearbyBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.colors.white,
  },
  conditionText: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.colors.white,
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
  },
  content: {
    padding: 16,
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  productTitle: {
    fontSize: 15,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 18,
    height: 36,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  price: {
    fontSize: 17,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
  },
  shopInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  shopInName: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.muted,
    flex: 1,
  },
  emptyContainer: {
    marginTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyImageCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.text,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: theme.colors.muted,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.muted,
    marginBottom: 20,
    fontWeight: '500',
  },
  cardRightColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  currentLocationText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: theme.colors.danger,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  badgeText: {
    color: theme.colors.white,
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryDivider: {
    fontSize: 18,
    fontWeight: '400',
    color: theme.colors.muted,
  },
  categoryActiveName: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  lowStockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#D97706',
    borderRadius: 6,
    marginTop: 4,
  },
  lowStockBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: theme.colors.white,
    letterSpacing: 0.5,
  },
  expressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  currentLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.primary + '10',
    borderRadius: 14,
  },
  quickNavIconBoxActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    borderWidth: 0,
  },
  quickNavActiveDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.white,
    opacity: 0.85,
  },
  quickNavTextActive: {
    color: theme.colors.primary,
    fontWeight: '900',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  distanceBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.colors.primary,
  },
});
