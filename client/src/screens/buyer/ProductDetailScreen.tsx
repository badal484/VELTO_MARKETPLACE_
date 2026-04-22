import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
  Animated as RNAnimated,
} from 'react-native';
import {GestureDetector, Gesture} from 'react-native-gesture-handler';
import {withSpring} from 'react-native-reanimated';
import {BlurView} from '@react-native-community/blur';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Button} from '../../components/common/Button';
import {useAuth} from '../../hooks/useAuth';
import Icon from 'react-native-vector-icons/Ionicons';
import {useToast} from '../../hooks/useToast';
import {IProduct, IUser, IShop, IReview, Role} from '@shared/types';
import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp, CommonActions} from '@react-navigation/native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import {CompositeNavigationProp} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HomeStackParamList,
  BrowseStackParamList,
  MainTabParamList,
} from '../../navigation/types';

const {width} = Dimensions.get('window');

type ProductDetailNavigationProp = CompositeNavigationProp<
  StackNavigationProp<HomeStackParamList & BrowseStackParamList>,
  BottomTabNavigationProp<MainTabParamList>
>;

type ProductDetailRouteProp = RouteProp<HomeStackParamList, 'ProductDetail'>;

interface ProductDetailProps {
  route: ProductDetailRouteProp;
  navigation: ProductDetailNavigationProp;
}

const ZoomableImage = ({uri}: {uri: string}) => {
  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate(event => {
      scale.value = event.scale;
      focalX.value = event.focalX;
      focalY.value = event.focalY;
    })
    .onEnd(() => {
      scale.value = withSpring(1);
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {translateX: focalX.value},
        {translateY: focalY.value},
        {translateX: -width / 2},
        {translateY: -(width * 1.2) / 2},
        {scale: scale.value},
        {translateX: -focalX.value},
        {translateY: -focalY.value},
        {translateX: width / 2},
        {translateY: (width * 1.2) / 2},
      ],
    };
  });

  return (
    <View style={styles.imageSlide}>
      <Image 
         source={{uri}} 
         style={styles.heroImageBg} 
         blurRadius={Platform.OS === 'ios' ? 20 : 10}
      />
      <View style={styles.heroBgOverlay} />
      
      <GestureDetector gesture={pinchGesture}>
        <Animated.View style={[styles.heroImageForegroundWrapper, animatedStyle]}>
          <Image 
             source={{uri}} 
             style={styles.heroImage} 
             resizeMode="contain"
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

export default function ProductDetailScreen({
  route,
  navigation,
}: ProductDetailProps) {
  const insets = useSafeAreaInsets();
  const {showToast} = useToast();
  const {id} = route.params;
  const [product, setProduct] = useState<IProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [isInCart, setIsInCart] = useState(false);
  const [reviews, setReviews] = useState<IReview[]>([]);
  const [stats, setStats] = useState({averageRating: 0, count: 0});
  const {user} = useAuth();

  const scrollY = useSharedValue(0);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [productRes, cartRes] = await Promise.all([
        axiosInstance.get(`/api/products/${id}`),
        axiosInstance.get('/api/cart').catch(() => null),
      ]);
      setProduct(productRes.data.data);
      if (productRes.data.data.isWishlisted !== undefined) {
        setIsInWishlist(!!productRes.data.data.isWishlisted);
      }
      if (cartRes) {
        const cartItems = cartRes.data.data?.items || [];
        setIsInCart(cartItems.some((item: any) => (item.product?._id || item.product) === id));
      }
      fetchReviews();
    } catch (err: unknown) {
      console.log('Error fetching product main details:', err);
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const reviewRes = await axiosInstance.get(`/api/reviews/product/${id}`);
      setReviews(reviewRes.data.data.reviews || []);
      setStats(reviewRes.data.data.stats || {averageRating: 0, count: 0});
    } catch (err) {
      console.log('Review Fetch Error (Isolated):', err);
    }
  };

  const scrollHandler = useAnimatedScrollHandler(event => {
    scrollY.value = event.contentOffset.y;
  });

  const headerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollY.value, [0, 150], [0, 1], Extrapolate.CLAMP);
    return { opacity, backgroundColor: theme.colors.white };
  });

  const imageStyle = useAnimatedStyle(() => {
    const scale = interpolate(scrollY.value, [-100, 0], [1.2, 1], Extrapolate.CLAMP);
    return { transform: [{scale}] };
  });

  const handleAddToCart = async () => {
    if (!product || !user) return;
    if (user.role === Role.RIDER || user.role === Role.SELLER || user.role === Role.SHOP_OWNER) {
      showToast({message: 'Marketplace purchases are disabled for professional profiles.', type: 'info'});
      return;
    }
    if (isInCart) {
      navigation.dispatch(
        CommonActions.navigate({name: 'MainTabs', params: {screen: 'CartTab'}}),
      );
      return;
    }
    try {
      await axiosInstance.post('/api/cart/add', { productId: product._id, quantity: 1 });
      setIsInCart(true);
      showToast({message: 'Added to your cart!', type: 'success'});
    } catch (err: unknown) {
      showToast({message: 'Could not add to cart', type: 'error'});
    }
  };

  const handleToggleWishlist = async () => {
    if (!product || !user) return;
    try {
      setIsInWishlist(!isInWishlist);
      await axiosInstance.post('/api/wishlist/toggle', { productId: product._id });
    } catch (err: unknown) {
      showToast({message: 'Could not update wishlist', type: 'error'});
    }
  };

  const handlePurchase = () => {
    if (!user) { showToast({message: 'Please login to buy products', type: 'info'}); return; }
    if (!product) return;
    if (user.role === Role.RIDER || user.role === Role.SELLER || user.role === Role.SHOP_OWNER) {
      showToast({message: 'Marketplace purchases are disabled for professional profiles.', type: 'info'});
      return;
    }
    navigation.navigate('Checkout', { products: [{ product, quantity: 1 }] });
  };

  if (loading || !product) {
    return <Loader />;
  }

  const seller = product.seller as unknown as IUser;
  const shop = product.shop as unknown as IShop | undefined;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent />

      <Animated.View style={[styles.header, headerStyle]}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.headerBtn}
              activeOpacity={0.7}>
              <Icon name="chevron-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {product.title}
            </Text>
            <View style={styles.galleryRightActions}>
              <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
                <Icon name="share-social-outline" size={22} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}>
        <View style={styles.imageGalleryContainer}>
          <Animated.ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={e => {
              const x = e.nativeEvent.contentOffset.x;
              setActiveImageIndex(Math.round(x / width));
            }}
            scrollEventThrottle={16}
            style={imageStyle}>
            {product.images?.map((img, i) => (
              <ZoomableImage key={i} uri={img} />
            ))}
          </Animated.ScrollView>
          
          <View style={[styles.imageOverlay, { top: Math.max(insets.top, 20) }]}>
            <TouchableOpacity
              style={styles.overlayBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}>
              <Icon name="chevron-back" size={22} color={theme.colors.text} />
            </TouchableOpacity>
            
            <View style={styles.galleryRightActions}>
               <TouchableOpacity style={styles.overlayBtn} activeOpacity={0.8}>
                 <Icon name="share-social-outline" size={20} color={theme.colors.text} />
               </TouchableOpacity>
               <TouchableOpacity 
                style={[styles.overlayBtn, {marginLeft: 12}]}
                onPress={handleToggleWishlist}
                activeOpacity={0.8}>
                <Icon 
                  name={isInWishlist ? "heart" : "heart-outline"} 
                  size={22} 
                  color={isInWishlist ? theme.colors.primary : theme.colors.text} 
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.indicatorRow}>
            {product.images?.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.indicator,
                  activeImageIndex === i && styles.activeIndicator,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.details}>
          <View style={styles.metaRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{product.category}</Text>
            </View>
            <View style={styles.viewBadge}>
              <Icon name="eye-outline" size={14} color={theme.colors.muted} />
              <Text style={styles.viewText}>{product.views || 0} views</Text>
            </View>
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.title}>{product.title}</Text>
            <View style={styles.ratingBadge}>
              <Icon name="star" size={16} color="#EAB308" />
              <Text style={styles.ratingText}>{stats.averageRating.toFixed(1)}</Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.productPriceMain}>₹{product.price.toLocaleString()}</Text>
            {product.stock > 10 ? (
              <View style={styles.inStockBadge}>
                <View style={{width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E'}} />
                <Text style={styles.inStockText}>In Stock</Text>
              </View>
            ) : product.stock > 0 ? (
              <View style={styles.lowStockBadge}>
                <View style={{width: 6, height: 6, borderRadius: 3, backgroundColor: '#EAB308'}} />
                <Text style={styles.lowStockText}>Only {product.stock} left</Text>
              </View>
            ) : (
              <View style={styles.outOfStockBadge}>
                <View style={{width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.danger}} />
                <Text style={styles.outOfStockText}>Out of Stock</Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Product Description</Text>
          <Text style={styles.productDescriptionText}>{product.description}</Text>

          <View style={styles.merchantSection}>
            <Text style={styles.sectionTitle}>Sold By</Text>
            <TouchableOpacity 
              style={styles.merchantCard}
              onPress={() => navigation.navigate('ShopProfile', {id: shop?._id || ''})}
              disabled={!shop}
              activeOpacity={0.7}>
              <View style={styles.merchantIconBox}>
                <Icon name="storefront" size={24} color={theme.colors.primary} />
              </View>
              <View style={styles.merchantInfoText}>
                <Text style={styles.merchantName}>{shop?.name || seller.name}</Text>
                <Text style={styles.merchantSub}>Verified Local Merchant</Text>
                {shop?.location && (
                  <View style={styles.locationBadge}>
                    <Icon name="location" size={10} color={theme.colors.primary} />
                    <Text style={styles.locationBadgeText}>{shop.address || shop.detailedAddress?.city}</Text>
                  </View>
                )}
              </View>
              <Icon name="chevron-forward" size={20} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.safetyBox}>
            <Icon name="shield-checkmark" size={24} color={theme.colors.success} />
            <Text style={styles.safetyText}>
              Velto Safety: Inspect items at delivery and pay only when satisfied.
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Customer Reviews</Text>
            <Text style={styles.reviewCount}>{reviews.length} reviews</Text>
          </View>

          {reviews.length > 0 ? (
            reviews.map((review: IReview) => (
              <View key={review._id} style={styles.reviewCard}>
                <View style={styles.reviewUserRow}>
                  <View style={styles.userIconCircle}>
                    <Text style={styles.userInitial}>
                      {(review.user as any)?.name?.charAt(0) || 'U'}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{(review.user as any)?.name || 'Anonymous'}</Text>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <Icon
                          key={star}
                          name={star <= review.rating ? 'star' : 'star-outline'}
                          size={12}
                          color={star <= review.rating ? '#EAB308' : theme.colors.muted}
                        />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.reviewDate}>
                    {new Date(review.createdAt ?? Date.now()).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.reviewComment}>{review.comment}</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyReviews}>
              <Icon name="chatbubble-outline" size={32} color={theme.colors.muted} />
              <Text style={styles.emptyReviewsText}>No reviews yet. Be the first to buy and let others know what you think!</Text>
            </View>
          )}

          <View style={{height: 100}} />
        </View>
      </Animated.ScrollView>

      {/* Flipkart-Style Sticky Footer */}
      <Animated.View
        entering={FadeInDown.delay(400).duration(600)}
        style={styles.stickyFooter}>
        {(user?.role === Role.RIDER || user?.role === Role.SELLER || user?.role === Role.SHOP_OWNER) ? (
          <View style={styles.limitedAccessRow}>
            <Icon name="information-circle-outline" size={20} color={theme.colors.muted} />
            <Text style={styles.limitedAccessText}>
              Purchases are disabled for professional profiles.
            </Text>
          </View>
        ) : (
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={[styles.cartBtnSticky, isInCart && styles.viewCartBtn]}
              onPress={handleAddToCart}
              activeOpacity={0.8}>
              <Icon
                name={isInCart ? 'bag-check-outline' : 'bag-add-outline'}
                size={18}
                color={isInCart ? theme.colors.primary : theme.colors.white}
              />
              <Text style={[styles.cartBtnTextSticky, isInCart && styles.viewCartBtnText]}>
                {isInCart ? 'VIEW CART' : 'ADD TO CART'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.buyBtnSticky} 
              onPress={handlePurchase}
              activeOpacity={0.8}>
              <Text style={styles.buyBtnTextSticky}>BUY NOW</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.colors.background},
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    ...theme.shadow.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageGalleryContainer: {
    height: width * 1.2,
    backgroundColor: theme.colors.white,
    position: 'relative',
  },
  imageSlide: {
    width: width,
    height: width * 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
  },
  heroImageBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.4,
  },
  heroBgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroImageForegroundWrapper: {
    ...theme.shadow.lg,
    backgroundColor: 'transparent',
  },
  heroImage: {
    width: width,
    height: width * 1.2,
  },
  imageOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  overlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
  },
  galleryRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicatorRow: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  activeIndicator: {
    width: 20,
    backgroundColor: theme.colors.primary,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.white,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
    paddingTop: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    ...theme.shadow.lg,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cartBtnSticky: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: theme.colors.white,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  viewCartBtn: {
    backgroundColor: theme.colors.primary + '12',
    borderColor: theme.colors.primary,
  },
  viewCartBtnText: {
    color: theme.colors.primary,
  },
  buyBtnSticky: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBtnTextSticky: {
    fontSize: 14,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  buyBtnTextSticky: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.white,
    letterSpacing: 1,
  },
  limitedAccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  limitedAccessText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  details: {
    padding: 24,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -30,
    minHeight: 500,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.primary + '10',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  viewBadge: {flexDirection: 'row', alignItems: 'center', gap: 6},
  viewText: {fontSize: 13, color: theme.colors.muted, fontWeight: '600'},
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.text,
    flex: 1,
    marginRight: 10,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.muted,
    marginLeft: 6,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  productPriceMain: {
    fontSize: 30,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  inStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inStockText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text,
  },
  lowStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lowStockText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.muted,
  },
  outOfStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  outOfStockText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.danger,
  },
  divider: {height: 1, backgroundColor: '#E2E8F0', marginVertical: 24},
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 16,
  },
  productDescriptionText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 26,
    marginBottom: 32,
  },
  merchantSection: {marginBottom: 24},
  merchantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.white,
    borderRadius: 24,
    ...theme.shadow.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  merchantIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  merchantInfoText: {flex: 1, marginLeft: 16},
  merchantName: {fontSize: 17, fontWeight: '800', color: theme.colors.text},
  merchantSub: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
    fontWeight: '600',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: theme.colors.primary + '10',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  locationBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  safetyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 20,
    marginBottom: 24,
  },
  safetyText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewCount: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  reviewCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  reviewUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  userIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  userInitial: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  starsRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  reviewDate: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: '500',
  },
  reviewComment: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  emptyReviews: {
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 40,
  },
  emptyReviewsText: {
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
