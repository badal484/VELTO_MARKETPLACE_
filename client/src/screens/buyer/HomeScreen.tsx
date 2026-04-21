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

const ProductCard = ({
  item,
  index,
  navigation,
  handleToggleWishlist,
  customWidth,
}: {
  item: IProduct;
  index: number;
  navigation: any;
  handleToggleWishlist: (id: string) => void;
  customWidth?: number;
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
    <Animated.View entering={FadeInDown.delay(index * 100).duration(600)}>
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
            <Text style={styles.categoryLabel}>{item.category}</Text>
            <Text style={styles.productTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.priceRow}>
              <View>
                <Text style={styles.price}>
                  ₹{item.price.toLocaleString('en-IN')}
                </Text>
              </View>
              <View style={styles.cardRightColumn}>
                {(item.numReviews ?? 0) > 0 && (
                  <View style={styles.ratingRow}>
                    <Icon name="star" size={12} color="#FBBF24" />
                    <Text style={styles.ratingText}>{item.rating}</Text>
                  </View>
                )}
                <View style={styles.shopInRow}>
                  <Icon
                    name="storefront-outline"
                    size={10}
                    color={theme.colors.muted}
                  />
                  <Text style={styles.shopInName} numberOfLines={1}>
                    {(item.shop as any)?.name || 'City Seller'}
                  </Text>
                </View>
              </View>
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
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string>(
    'Detecting location...',
  );
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
      console.log('Error fetching banners:', error);
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
    let coords = null;
    try {
      if (Platform.OS === 'android' || Platform.OS === 'ios') {
        const hasPermission = await requestLocationPermission();
        if (hasPermission) {
          const position = await new Promise<Geolocation.GeoPosition>(
            (resolve, reject) => {
              Geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 10000,
              });
            },
          );
          coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentCoords(coords);
          setSelectedArea('Current Location');
        } else {
          setSelectedArea('Global Marketplace');
        }
      }
    } catch (error) {
      console.log('Location error:', error);
      setSelectedArea('Global Marketplace');
    }
    fetchProducts(coords);
  };

  const handleAreaSelect = (location: LocationResult) => {
    const coords = {lat: location.lat, lng: location.lon};
    setCurrentCoords(coords);
    setSelectedArea(location.formatted.split(',')[0]); // Use first part of address
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
        // Removed hardcoded radius=50 to allow "Verified Infinity" discovery
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
    />
  );

  const handleToggleToggleWishlist = (productId: string) => {
    handleToggleWishlist(productId);
  };

  const categoriesList: {id: Category | null; icon: string; label: string}[] = [
    {id: null, icon: 'sparkles', label: 'For You'},
    {id: Category.ELECTRONICS, icon: 'hardware-chip', label: 'Electronics'},
    {id: Category.FOOD, icon: 'fast-food', label: 'Food'},
    {id: Category.CLOTHING, icon: 'shirt', label: 'Clothing'},
    {id: Category.HOME, icon: 'home', label: 'Home'},
    {id: Category.CONSTRUCTION, icon: 'build', label: 'Construction'},
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
      <Animated.View entering={FadeInUp.duration(600)} style={styles.topRow}>
        <View style={styles.topRowLeft}>
          <TouchableOpacity
            style={styles.locationSelector}
            onPress={() => setShowLocationModal(true)}>
            <Icon name="location" size={12} color={theme.colors.primary} />
            <Text style={styles.areaText} numberOfLines={1}>
              {selectedArea}
            </Text>
            <Icon name="chevron-down" size={14} color={theme.colors.muted} />
          </TouchableOpacity>
          {user && (
            <Text style={styles.greetingText}>
              {t('home.welcome')}, {user.name.split(' ')[0]}
            </Text>
          )}

          <Text style={styles.mainHeader}>
            {isGlobalMode ? 'Global Marketplace' : t('home.find_nearby')}
          </Text>
        </View>
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
      </Animated.View>

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
            const isActive = selectedCategory === item.id;
            return (
              <TouchableOpacity
                style={styles.quickNavBtn}
                activeOpacity={0.8}
                onPress={() => setSelectedCategory(item.id)}>
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
              onPress={() =>
                navigation.navigate('BrowseTab', {
                  screen: 'Browse',
                  params: {category: item.category},
                })
              }
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
        <Text style={styles.sectionTitle}>Trending Now</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('BrowseTab', {screen: 'Browse'})}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {isGlobalMode ? 'All Verified Products' : t('home.near_you')}
        </Text>
        {isGlobalMode && (
          <TouchableOpacity onPress={() => setIsGlobalMode(false)}>
            <Text style={styles.switchText}>Switch to Local</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading && !refreshing && !currentCoords) {
    return <Loader />;
  }

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" />
      <FlatList
        data={products}
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
              {isGlobalMode ? 'No Products at All' : 'Nothing nearby'}
            </Text>
            <Text style={styles.emptyText}>
              {isGlobalMode
                ? 'The marketplace is currently empty. Check back later!'
                : "We couldn't find any products in this area. Try our Global Marketplace?"}
            </Text>
            <View style={styles.emptyActions}>
              {!isGlobalMode && (
                <Button
                  title="Explore Global Mode"
                  size="sm"
                  onPress={() => {
                    setIsGlobalMode(true);
                  }}
                  style={{marginTop: 16}}
                />
              )}
              <Button
                title="Clear Filters"
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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
    marginHorizontal: -24,
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
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
    height: 36,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  price: {
    fontSize: 17,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  shopInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
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
});
