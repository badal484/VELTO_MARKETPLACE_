import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Card} from '../../components/common/Card';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {
  FadeInUp,
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import {IShop, IProduct} from '@shared/types';
import {openMap} from '../../utils/mapUtils';
import {StackNavigationProp} from '@react-navigation/stack';
import {CompositeNavigationProp} from '@react-navigation/native';
import {RouteProp} from '@react-navigation/native';

const {width} = Dimensions.get('window');

type ShopProfileNavigationProp = StackNavigationProp<any, 'ShopProfile'>;
type ShopProfileRouteProp = RouteProp<any, 'ShopProfile'>;

interface ShopProfileProps {
  route: ShopProfileRouteProp;
  navigation: ShopProfileNavigationProp;
}

export default function ShopProfileScreen({
  route,
  navigation,
}: ShopProfileProps) {
  const {id} = (route.params || {}) as any;
  const [shop, setShop] = useState<IShop | null>(null);
  const [products, setProducts] = useState<IProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const scrollY = useSharedValue(0);

  const fetchShopData = React.useCallback(async () => {
    try {
      const [shopRes, productsRes] = await Promise.all([
        axiosInstance.get(`/api/shops/${id}`),
        axiosInstance.get(`/api/products?shopId=${id}`),
      ]);
      setShop(shopRes.data.data);
      const shopProducts: IProduct[] = productsRes.data.data.filter(
        (p: IProduct) =>
          (p.shop as any)?._id || p.shop === id,
      );
      setProducts(shopProducts);
    } catch (e: unknown) {
      console.log('Error fetching shop data:', e);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [id, navigation]);

  useEffect(() => {
    fetchShopData();
  }, [fetchShopData]);

  const scrollHandler = useAnimatedScrollHandler(event => {
    scrollY.value = event.contentOffset.y;
  });

  const headerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [100, 180],
      [0, 1],
      Extrapolate.CLAMP,
    );
    return {
      opacity,
      backgroundColor: theme.colors.white,
    };
  });

  const backBtnStyle = useAnimatedStyle(() => {
    const color = interpolate(
      scrollY.value,
      [100, 180],
      [1, 0],
      Extrapolate.CLAMP,
    );
    return {
      backgroundColor: color === 1 ? 'rgba(255,255,255,0.2)' : '#F1F5F9',
    };
  });

  const renderProduct = ({item, index}: {item: IProduct; index: number}) => (
    <Animated.View
      entering={FadeInUp.delay(index * 100).duration(600)}
      style={styles.productWrapper}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate('ProductDetail', {id: item._id})}>
        <Card style={styles.productCard} variant="elevated">
          <View style={styles.productImageWrapper}>
            <Image
              source={{uri: item.images[0]}}
              style={styles.productImage}
              resizeMode="cover"
            />
            <View style={styles.productPriceTag}>
              <Text style={styles.productPriceTagText}>
                ₹{item.price.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
          <View style={styles.productContent}>
            <Text style={styles.productTitle} numberOfLines={2}>
              {item.title}
            </Text>
          </View>
        </Card>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading || !shop) {
    return <Loader />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent />

      <Animated.View style={[styles.stickyHeader, headerStyle]}>
        <SafeAreaView>
          <View style={styles.stickyHeaderContent}>
            <Text style={styles.stickyTitle}>{shop.name}</Text>
          </View>
        </SafeAreaView>
      </Animated.View>

      <TouchableOpacity
        style={styles.floatingBack}
        onPress={() => navigation.goBack()}>
        <Animated.View style={[styles.backBtnInner, backBtnStyle]}>
          <Icon name="chevron-back" size={24} color={theme.colors.text} />
        </Animated.View>
      </TouchableOpacity>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <Image
            source={{
              uri: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1000',
            }}
            style={styles.heroCover}
          />
          <View style={styles.heroOverlay} />
        </View>

        <Animated.View
          entering={FadeInUp.duration(800)}
          style={styles.mainInfoCard}>
          <View style={styles.brandBox}>
            <View style={styles.logoRing}>
              {shop.logo ? (
                <Image source={{uri: shop.logo}} style={styles.brandLogo} />
              ) : (shop as any).owner?.avatar ? (
                <Image source={{uri: (shop as any).owner.avatar}} style={styles.brandLogo} />
              ) : (
                <View style={styles.brandPlaceholder}>
                  <Icon name="business" size={32} color={theme.colors.muted} />
                </View>
              )}
            </View>
          </View>

          <View style={styles.brandIdentity}>
            <View style={styles.nameLockup}>
              <Text style={styles.displayName}>{shop.name}</Text>
              {shop.isVerified && (
                <Icon
                  name="shield-checkmark"
                  size={20}
                  color={theme.colors.text}
                />
              )}

            </View>
            <Text style={styles.businessCategory} selectable={false}>{shop.category}</Text>

            <View style={styles.badgeLine}>
              <View style={styles.ratingPill}>
                <Icon name="star" size={14} color={theme.colors.muted} />
                <Text style={styles.ratingValue}>{shop.stats?.avgRating || 0}</Text>
              </View>

              <View style={styles.verifiedPill}>
                <Text style={styles.verifiedText}>TOP RATED MERCHANT</Text>
              </View>
            </View>
          </View>

          <View style={styles.statsDashboard}>
            <View style={styles.statMetric}>
              <Text style={styles.metricVal}>{shop.stats?.productCount || products.length}</Text>
              <Text style={styles.metricKey}>Catalog</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statMetric}>
              <Text style={styles.metricVal}>{shop.stats?.completedOrders || 0}</Text>
              <Text style={styles.metricKey}>Sales</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statMetric}>
              <Text style={styles.metricVal}>{shop.stats?.reliabilityScore || 100}%</Text>
              <Text style={styles.metricKey}>Reliability</Text>
            </View>
          </View>
        </Animated.View>

        <View style={styles.contentSections}>
          <View style={styles.contentSection}>
            <View style={styles.sectionHeading}>
              <Icon
                name="information-circle-outline"
                size={20}
                color={theme.colors.primary}
              />
              <Text style={styles.sectionTitle}>Business Bio</Text>
            </View>
            <Text style={styles.bioText}>{shop.description}</Text>
            <View style={styles.locationDetail}>
              <View style={{flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10}}>
                <Icon name="location" size={18} color={theme.colors.primary} />
                <Text style={styles.locationAddress} selectable={false}>{shop.address}</Text>
              </View>
              <TouchableOpacity 
                style={styles.navigateBtn}
                onPress={() => {
                  const coords = shop.location?.coordinates;
                  if (coords) {
                    openMap(coords[1], coords[0], shop.name, shop.address);
                  } else {
                    openMap(undefined, undefined, shop.name, shop.address);
                  }
                }}>
                <Icon name="navigate-circle" size={28} color={theme.colors.primary} />
                <Text style={styles.navigateBtnText}>GET DIRECTIONS</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.contentSection}>
            <View style={styles.sectionHeading}>
              <Icon
                name="grid-outline"
                size={20}
                color={theme.colors.primary}
              />
              <Text style={styles.sectionTitle}>Product Catalog</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{products.length}</Text>
              </View>
            </View>
            <FlatList
              data={products}
              keyExtractor={item => item._id}
              renderItem={renderProduct}
              numColumns={2}
              scrollEnabled={false}
              contentContainerStyle={styles.catalogGrid}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Icon
                    name="cube-outline"
                    size={48}
                    color={theme.colors.muted}
                  />
                  <Text style={styles.emptyMessage}>
                    No active listings found for this shop.
                  </Text>
                </View>
              }
            />
          </View>
        </View>
        <View style={{height: 100}} />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.colors.background},
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    ...theme.shadow.sm,
    height: 100,
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },
  stickyHeaderContent: {alignItems: 'center'},
  stickyTitle: {fontSize: 16, fontWeight: '800', color: theme.colors.text},
  floatingBack: {position: 'absolute', top: 50, left: 20, zIndex: 110},
  backBtnInner: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.sm,
  },
  heroSection: {height: 260, width: '100%', position: 'relative'},
  heroCover: {width: '100%', height: '100%'},
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  mainInfoCard: {
    marginHorizontal: 20,
    marginTop: -80,
    backgroundColor: theme.colors.white,
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    ...theme.shadow.lg,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  brandBox: {
    marginTop: -70,
    padding: 6,
    backgroundColor: theme.colors.white,
    borderRadius: 36,
    ...theme.shadow.md,
  },
  logoRing: {
    width: 100,
    height: 100,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
  },
  brandLogo: {width: '100%', height: '100%'},
  brandPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandIdentity: {alignItems: 'center', marginTop: 16},
  nameLockup: {flexDirection: 'row', alignItems: 'center', gap: 8},
  displayName: {fontSize: 24, fontWeight: '900', color: theme.colors.text},
  businessCategory: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '800',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  badgeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  ratingValue: {fontSize: 14, fontWeight: '800', color: theme.colors.muted},

  verifiedPill: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: 0.5,
  },

  statsDashboard: {
    flexDirection: 'row',
    marginTop: 24,
    width: '100%',
    padding: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statMetric: {flex: 1, alignItems: 'center'},
  metricVal: {fontSize: 20, fontWeight: '900', color: theme.colors.text},
  metricKey: {
    fontSize: 10,
    color: theme.colors.muted,
    textTransform: 'uppercase',
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
  },
  contentSections: {padding: 20, gap: 20},
  contentSection: {
    backgroundColor: theme.colors.white,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...theme.shadow.sm,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    flex: 1,
  },
  countBadge: {
    backgroundColor: theme.colors.primary + '10',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countText: {fontSize: 12, fontWeight: '900', color: theme.colors.primary},
  bioText: {fontSize: 15, color: theme.colors.textSecondary, lineHeight: 24},
  locationDetail: {
    flexDirection: 'row',
    marginTop: 20,
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 16,
  },
  locationAddress: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    flex: 1,
  },
  navigateBtn: {
    backgroundColor: theme.colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...theme.shadow.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  navigateBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  catalogGrid: {paddingVertical: 4},
  productWrapper: {width: (width - 88) / 2, marginBottom: 16, marginRight: 16},
  productCard: {
    padding: 0,
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...theme.shadow.sm,
  },
  productImageWrapper: {height: 140, position: 'relative'},
  productImage: {width: '100%', height: '100%'},
  productPriceTag: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  productPriceTagText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: '900',
  },
  productContent: {padding: 12},
  productTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 20,
    height: 40,
  },
  emptyState: {alignItems: 'center', paddingVertical: 48},
  emptyMessage: {
    textAlign: 'center',
    color: theme.colors.muted,
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
  },
});