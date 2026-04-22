import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Modal,
} from 'react-native';
import MapLibreGL, { MapViewRef, CameraRef } from '@maplibre/maplibre-react-native';
MapLibreGL.setAccessToken(null);
MapLibreGL.addCustomHeader('User-Agent', 'VeltoLocalMarket/1.0 (contact@velto.com)');
import Geolocation from 'react-native-geolocation-service';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Card} from '../../components/common/Card';
import {LocationSearch} from '../../components/common/LocationSearch';
import {LocationResult} from '../../services/locationService';
import {Input} from '../../components/common/Input';
import {Button} from '../../components/common/Button';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {
  FadeInUp,
  FadeInLeft,
  useSharedValue,
  withSpring,
  useAnimatedStyle,
} from 'react-native-reanimated';
import {RangeSlider} from '../../components/common/RangeSlider';
import {IProduct, Category, IShop} from '@shared/types';
import {StackNavigationProp} from '@react-navigation/stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  BrowseStackParamList,
  HomeStackParamList,
  MainTabParamList,
} from '../../navigation/types';

const {width} = Dimensions.get('window');

type BrowseScreenNavigationProp = StackNavigationProp<
  BrowseStackParamList & HomeStackParamList,
  'Browse'
>;

interface BrowseScreenProps {
  navigation: BrowseScreenNavigationProp;
}

function CategoryChip({
  item,
  isActive,
  onPress,
}: {
  item: any;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Animated.View entering={FadeInLeft.delay(100).duration(500)}>
      <TouchableOpacity
        style={[
          styles.catChip,
          isActive && styles.catChipActive,
        ]}
        onPress={onPress}
        activeOpacity={0.9}>
        <Icon
          name={item.icon}
          size={16}
          color={isActive ? '#fff' : theme.colors.primary}
        />
        <Text style={[styles.catChipText, isActive && styles.catChipTextActive]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const RADIUS_OPTIONS = [1, 5, 10, 20, 50];

const categoriesList = [
  {id: null, icon: 'sparkles', label: 'For You'},
  {id: Category.ELECTRONICS, icon: 'hardware-chip', label: 'Electronics'},
  {id: Category.FOOD, icon: 'fast-food', label: 'Food'},
  {id: Category.CLOTHING, icon: 'shirt', label: 'Clothing'},
  {id: Category.HOME, icon: 'home', label: 'Home'},
  {id: Category.CONSTRUCTION, icon: 'construct', label: 'Construction'},
  {id: Category.SPORTS, icon: 'football', label: 'Sports'},
];
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

export default function BrowseScreen({navigation}: BrowseScreenProps) {
  const insets = useSafeAreaInsets();
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list');
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<IProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{lat: number; lng: number} | null>(
    null,
  );
  const [region, setRegion] = useState<any>(null);
  const [radius, setRadius] = useState(5);
  const [canSearchThisArea, setCanSearchThisArea] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(200000);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [addressName, setAddressName] = useState('Current Region');

  const mapRef = useRef<MapViewRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredProducts = products.filter(p => {
    if (!location) return true;
    const pCoords = p.shop?.location?.coordinates || p.location?.coordinates;
    if (!pCoords) return true;
    const d = calculateDistance(
      location.lat,
      location.lng,
      pCoords[1],
      pCoords[0]
    );
    return d <= radius;
  });

  useEffect(() => {
    Geolocation.getCurrentPosition(
      pos => {
        setLocation({lat: pos.coords.latitude, lng: pos.coords.longitude});
      },
      error => {
        console.warn('Location Error:', error);
        setLocation({lat: 12.9716, lng: 77.5946}); // Bengaluru fallback
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  }, []);

  useEffect(() => {
    if (location) {
      fetchProducts();
    }
  }, [location, selectedCategory, radius]);

  const fetchProducts = async (searchLat?: number, searchLng?: number, searchText?: string) => {
    const lat = searchLat || location?.lat;
    const lng = searchLng || location?.lng;

    if (!lat || !lng) {
      return;
    }

    const searchQuery = searchText !== undefined ? searchText : search;

    try {
      setLoading(true);
      setCanSearchThisArea(false);
      let url = `/api/products?lat=${lat}&lng=${lng}&radius=${radius}`;
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }
      if (selectedCategory) {
        url += `&category=${selectedCategory}`;
      }
      if (minPrice) {
        url += `&minPrice=${minPrice}`;
      }
      if (maxPrice) {
        url += `&maxPrice=${maxPrice}`;
      }

      const res = await axiosInstance.get(url);
      setProducts(res.data.data);
    } catch (e: unknown) {
      console.log('Error fetching products:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWishlist = async (productId: string) => {
    try {
      setProducts(current => 
        current.map(p => 
          p._id === productId 
            ? { ...p, isWishlisted: !p.isWishlisted } 
            : p
        )
      );
      await axiosInstance.post('/api/wishlist/toggle', { productId });
    } catch (err) {
      fetchProducts();
    }
  };

  const onRegionDidChange = async () => {
    if (mapRef.current && location) {
      const center = await mapRef.current.getCenter();
      const dist = Math.sqrt(
        Math.pow(center[1] - location.lat, 2) +
          Math.pow(center[0] - location.lng, 2),
      );
      if (dist > 0.01) {
        setCanSearchThisArea(true);
      }
    }
  };

  const searchThisArea = async () => {
    if (mapRef.current) {
      const center = await mapRef.current.getCenter();
      fetchProducts(center[1], center[0]);
    }
  };

  const handleAreaSelect = (locationResult: LocationResult) => {
    setLocation({lat: locationResult.lat, lng: locationResult.lon});
    setAddressName(locationResult.formatted.split(',')[0]);
    setShowLocationModal(false);
    
    // Animate map to new location
    cameraRef.current?.flyTo([locationResult.lon, locationResult.lat], 1000);
  };

  const handleLocate = () => {
    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude} = position.coords;
        setLocation({lat: latitude, lng: longitude});
        cameraRef.current?.flyTo([longitude, latitude], 1000);
      },
      error => {
        console.log('Location Refresh Error:', error);
        // Fallback to zoom out to existing products if any
        fitToProducts();
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  };

  const fitToProducts = () => {
    if (products.length > 0 && cameraRef.current) {
      const lons = products.map(p => p.location.coordinates[0]);
      const lats = products.map(p => p.location.coordinates[1]);
      
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);

      cameraRef.current.fitBounds(
        [minLon, minLat],
        [maxLon, maxLat],
        [100, 100, 100, 100],
        1000
      );
    }
  };

  const renderItem = ({item}: {item: IProduct; index: number}) => {
    const shop = item.shop as unknown as IShop | null;
    return (
      <Animated.View entering={FadeInUp.duration(250)}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate("ProductDetail", {id: String(item._id)})}>
          <Card style={styles.listCard} variant="elevated">
            <View style={styles.imageWrapper}>
              {item.images && item.images.length > 0 ? (
                <Image
                  source={{uri: item.images[0]}}
                  style={styles.listImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.listImage, styles.placeholderImg]}>
                  <Icon
                    name="image-outline"
                    size={24}
                    color={theme.colors.muted}
                  />
                </View>
              )}
              {item.stock > 0 && item.stock < 5 && (
                <View style={styles.lowStockBadgeBox}>
                  <Text style={styles.lowStockBadgeText}>LIMITED STOCK</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.favBtnBrowse}
                onPress={e => {
                  e.stopPropagation();
                  handleToggleWishlist(String(item._id));
                }}>
                <Icon 
                  name={item.isWishlisted ? "heart" : "heart-outline"} 
                  size={14} 
                  color={item.isWishlisted ? "#FF476E" : theme.colors.muted} 
                />
              </TouchableOpacity>
              {item.distance !== undefined || (location && (item.location?.coordinates || (item.shop as any)?.location?.coordinates)) ? (
                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceBadgeText}>
                    {(item.distance !== undefined 
                        ? item.distance 
                        : calculateDistance(
                            location!.lat, 
                            location!.lng, 
                            (item.location?.coordinates?.[1] ?? (item.shop as any)?.location?.coordinates?.[1]), 
                            (item.location?.coordinates?.[0] ?? (item.shop as any)?.location?.coordinates?.[0])
                          )
                    ).toFixed(1)} km
                  </Text>
                </View>
              ) : (
                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceBadgeText}>Nearby</Text>
                </View>
              )}
            </View>
            <View style={styles.listContent}>
              <View style={styles.listHeader}>
                <Text style={styles.categoryLabel}>{item.category}</Text>
              </View>
              <Text style={styles.productTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.priceRatingRow}>
                <Text style={styles.productPrice}>
                  ₹{item.price.toLocaleString('en-IN')}
                </Text>
                {(item.numReviews ?? 0) > 0 && (
                  <View style={styles.ratingRow}>
                    <Icon name="star" size={12} color="#FBBF24" />
                    <Text style={styles.ratingText}>{item.rating}</Text>
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
                  {shop?.name || 'Local Seller'}
                </Text>
              </View>
            </View>
          </Card>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View style={styles.searchRow}>
          <TouchableOpacity 
            style={styles.locationContainer}
            onPress={() => setShowLocationModal(true)}>
            <Text style={styles.addressText} numberOfLines={1}>{addressName}</Text>
          </TouchableOpacity>
          <View style={styles.inputContainer}>
            <Icon name="search-outline" size={18} color={theme.colors.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products, shops, places..."
              value={search}
              onChangeText={text => {
                setSearch(text);
                if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                searchDebounceRef.current = setTimeout(() => {
                  fetchProducts(undefined, undefined, text);
                }, 500);
              }}
              onSubmitEditing={() => fetchProducts()}
              returnKeyType="search"
              placeholderTextColor={theme.colors.muted}
            />
          </View>
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => setShowFilterModal(true)}>
              <Icon
                name="options-outline"
                size={22}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.categoryScroll}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categoriesList}
            keyExtractor={c => c.label}
            contentContainerStyle={styles.catContent}
            renderItem={({item, index}) => (
                <CategoryChip
                  item={item}
                  isActive={selectedCategory === item.id}
                  onPress={() => setSelectedCategory(item.id)}
                />
            )}
          />
        </View>

        <View style={styles.radiusScroll}>
          <Text style={styles.filterLabel}>Distance:</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={RADIUS_OPTIONS}
            keyExtractor={r => r.toString()}
            contentContainerStyle={styles.radiusContent}
            renderItem={({item}) => {
              const isActive = radius === item;
              return (
                <TouchableOpacity
                  style={[
                    styles.radiusChip,
                    isActive && styles.radiusChipActive,
                  ]}
                  onPress={() => setRadius(item)}>
                  <Text
                    style={[
                      styles.radiusChipText,
                      isActive && styles.radiusChipTextActive,
                    ]}>
                    {item} km
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>

      <View style={{flex: 1}}>
        {loading && products.length === 0 ? (
          <Loader />
        ) : viewMode === 'map' && location ? (
          <View style={{flex: 1}}>
            <MapLibreGL.MapView
              ref={mapRef}
              style={styles.map}
              mapStyle={""} // Empty style to use RasterSource
              onRegionDidChange={onRegionDidChange}
              logoEnabled={false}
              attributionEnabled={true}>
              <MapLibreGL.Camera
                ref={cameraRef}
                defaultSettings={{
                  centerCoordinate: [location.lng, location.lat],
                  zoomLevel: 12,
                }}
              />
              <MapLibreGL.RasterSource
                id="osm"
                tileUrlTemplates={["https://tile.openstreetmap.org/{z}/{x}/{y}.png"]}
                tileSize={256}
                minZoomLevel={0}
                maxZoomLevel={19}>
                <MapLibreGL.RasterLayer id="osmLayer" sourceID="osm" />
              </MapLibreGL.RasterSource>

              <MapLibreGL.UserLocation visible={true} />

              {filteredProducts.map(p => {
                const pCoords = p.shop?.location?.coordinates || p.location?.coordinates;
                if (!pCoords) return null;
                return (
                  <MapLibreGL.MarkerView
                    key={String(p._id)}
                    id={String(p._id)}
                    coordinate={[pCoords[0], pCoords[1]]}>
                    <TouchableOpacity 
                       style={styles.markerWrapper}
                       onPress={() => navigation.navigate('ProductDetail', {id: String(p._id)})}
                       activeOpacity={0.9}>
                      <View style={styles.markerShopNameContainer}>
                        <Icon name="storefront" size={12} color={theme.colors.primary} />
                        <Text style={styles.markerShopLabel} numberOfLines={1}>
                          {(p.shop as unknown as IShop)?.name || 'Local Seller'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </MapLibreGL.MarkerView>
                );
              })}
            </MapLibreGL.MapView>

            {canSearchThisArea && (
              <TouchableOpacity
                style={styles.floatingSearchBtn}
                onPress={searchThisArea}
                activeOpacity={0.9}>
                <Icon
                  name="refresh-outline"
                  size={18}
                  color={theme.colors.white}
                />
                <Text style={styles.floatingSearchText}>Search this area</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.locateBtn}
              onPress={handleLocate}
              activeOpacity={0.8}>
              <Icon name="navigate" size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={item => String(item._id)}
            renderItem={renderItem}
            contentContainerStyle={styles.listScroll}
            showsVerticalScrollIndicator={false}
            initialNumToRender={50}
            maxToRenderPerBatch={50}
            windowSize={10}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Icon
                    name="search-outline"
                    size={48}
                    color={theme.colors.muted}
                  />
                </View>
                <Text style={styles.emptyTitle}>No products found</Text>
                <Text style={styles.emptySub}>
                  Try searching a different area or category.
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Floating View Toggle */}
      <TouchableOpacity 
        style={styles.floatingToggle}
        onPress={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}>
        <Icon name={viewMode === 'map' ? 'list' : 'map'} size={24} color={theme.colors.white} />
      </TouchableOpacity>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}>
        <View style={styles.modalOverlay}>
          <GestureHandlerRootView style={{width: '100%', flex: 1, justifyContent: 'flex-end'}}>
            <View style={styles.modalContent}>
            <View style={styles.filterSection}>
              <View style={styles.filterTitleRow}>
                <Text style={styles.filterSectionTitle}>Price Range</Text>
                <Text style={styles.priceRangeLabel}>
                  ₹{minPrice.toLocaleString()} - ₹{maxPrice.toLocaleString()}{maxPrice === 200000 ? '+' : ''}
                </Text>
              </View>
              
              <RangeSlider
                min={0}
                max={200000}
                initialMin={minPrice}
                initialMax={maxPrice}
                step={100}
                onValueChange={(min, max) => {
                  setMinPrice(min);
                  setMaxPrice(max);
                }}
              />
            </View>

            <Button
              title="Apply Filters"
              onPress={() => {
                setShowFilterModal(false);
                fetchProducts();
              }}
              style={{marginTop: 20}}
            />
            <Button
              title="Reset"
              type="outline"
              onPress={() => {
                setMinPrice(0);
                setMaxPrice(200000);
                setSelectedCategory(null);
                setShowFilterModal(false);
                fetchProducts();
              }}
              style={{marginTop: 12}}
            />
          </View>
        </GestureHandlerRootView>
      </View>
    </Modal>

      {/* Location Search Modal */}
      <Modal
        visible={showLocationModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLocationModal(false)}>
        <View style={styles.modalOverlay}>
          <GestureHandlerRootView style={{width: '100%', flex: 1, justifyContent: 'flex-end'}}>
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search Area</Text>
              <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <LocationSearch onSelect={handleAreaSelect} placeholder="Search area in Bangalore..." />
          </View>
        </GestureHandlerRootView>
      </View>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, 
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.white,
    ...theme.shadow.sm,
    zIndex: 100,
    width: '100%',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.primary,
    letterSpacing: 6,
    marginTop: 2,
    includeFontPadding: false,
  },
  actionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: 8,
    alignItems: 'center',
    gap: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    borderRadius: 12,
    height: 48,
    maxWidth: 100,
  },
  addressText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    marginLeft: 4,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '600',
  },
  filterBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryScroll: {borderTopWidth: 1, borderTopColor: '#F1F5F9'},
  catContent: {paddingHorizontal: 16, paddingVertical: 14, gap: 10},
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  catChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  catChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  catChipTextActive: {color: '#fff', fontWeight: '800'},
  lowStockBadgeBox: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#D97706',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    ...theme.shadow.sm,
  },
  lowStockBadgeText: {
    color: theme.colors.white,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  radiusScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.muted,
    marginRight: 10,
    textTransform: 'uppercase',
  },
  radiusContent: {gap: 8},
  radiusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  radiusChipActive: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.primary,
  },
  radiusChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  radiusChipTextActive: {
    color: theme.colors.primary,
  },
  map: {flex: 1},
  markerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerShopNameContainer: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: -4,
    zIndex: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...theme.shadow.sm,
  },
  markerShopLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.text,
    maxWidth: 120,
  },
  calloutWrapper: {alignItems: 'center', width: 180},
  calloutContainer: {
    backgroundColor: theme.colors.white,
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
    ...theme.shadow.lg,
    width: '100%',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  calloutPointer: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: theme.colors.white,
    marginTop: -1,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
  },
  calloutPriceRow: {flexDirection: 'row', alignItems: 'center', marginTop: 6},
  calloutPriceText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '800',
  },
  calloutActionText: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  listScroll: {padding: 16, paddingBottom: 40},
  listCard: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    ...theme.shadow.sm,
  },
  imageWrapper: {
    width: 130,
    height: 130,
    position: 'relative',
    backgroundColor: '#f8fafc',
  },
  listImage: {
    width: '100%',
    height: '100%',
  },
  favBtnBrowse: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(22, 163, 74, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  distanceBadgeText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  listContent: {
    padding: 12,
    flex: 1,
    justifyContent: 'space-between',
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  priceRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 18,
    color: theme.colors.primary,
    fontWeight: '900',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  shopInRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  shopInName: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  emptyTitle: {fontSize: 20, fontWeight: '900', color: theme.colors.text},
  emptySub: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '500',
    lineHeight: 22,
  },
  floatingSearchBtn: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    ...theme.shadow.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  floatingSearchText: {
    color: theme.colors.white,
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 8,
  },
  locateBtn: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.lg,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  floatingToggle: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    ...theme.shadow.lg,
    zIndex: 100,
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
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.text,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.muted,
    marginBottom: 12,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterSection: {
    marginBottom: 24,
  },
  filterTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  priceRangeLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: theme.colors.primary,
  },
});