import React, {useEffect, useState, useCallback, useRef, memo} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {useToast} from '../../hooks/useToast';
import {Loader} from '../../components/common/Loader';
import {Button} from '../../components/common/Button';
import Icon from 'react-native-vector-icons/Ionicons';
import {ICart, ICartItem, IProduct} from '@shared/types';
import Animated, {
  FadeInRight,
  FadeOutLeft,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from '../../mocks/reanimated';
import {useTranslation} from 'react-i18next';
import {useNotifications} from '../../context/NotificationContext';

import { StackNavigationProp } from '@react-navigation/stack';
import { CartStackParamList } from '../../navigation/types';

type CartScreenNavigationProp = StackNavigationProp<CartStackParamList, 'Cart'>;

interface CartProps {
  navigation: CartScreenNavigationProp;
}

const PriceLockTimer = ({ lockedAt, priceSnapshotted, currentPrice }: { lockedAt: Date; priceSnapshotted: number; currentPrice: number }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const LOCK_DURATION = 30 * 60 * 1000;

  useEffect(() => {
    const calculateTime = () => {
      const diff = new Date(lockedAt).getTime() + LOCK_DURATION - Date.now();
      setTimeLeft(Math.max(0, diff));
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [lockedAt]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const isExpired = timeLeft === 0;

  if (isExpired) {
    const priceDiff = currentPrice - priceSnapshotted;
    return (
      <View style={styles.expiredBadge}>
        <Icon name="time-outline" size={12} color="#D97706" />
        <Text style={styles.expiredText}>
          Price Updated {priceDiff !== 0 ? `(₹${priceDiff > 0 ? '+' : ''}${priceDiff})` : ''}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.lockedBadge}>
      <Icon name="lock-closed" size={12} color="#10B981" />
      <Text style={styles.lockedText}>
        Price Locked • {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
      </Text>
    </View>
  );
};

const CartItem = memo(({item, index, updateQuantity, removeItem}: {
  item: ICartItem; 
  index: number; 
  updateQuantity: (id: string, q: number) => void;
  removeItem: (id: string) => void;
}) => {
  const product = item.product as IProduct;
  const displayPrice = item.priceSnapshotted || product.price;

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 100)}
      exiting={FadeOutLeft}
      style={styles.cartItem}>
      <Image source={{uri: product.images[0]}} style={styles.itemImage} />
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {product.title}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.itemPrice}>₹{displayPrice.toLocaleString()}</Text>
          {item.lockedAt && (
            <PriceLockTimer 
              lockedAt={item.lockedAt} 
              priceSnapshotted={item.priceSnapshotted || product.price} 
              currentPrice={product.price}
            />
          )}
        </View>
        
        {product.stock === 0 ? (
          <View style={styles.outOfStockContainer}>
            <Icon name="alert-circle" size={14} color={theme.colors.danger} />
            <Text style={styles.outOfStockText}>Sold Out</Text>
          </View>
        ) : product.stock < item.quantity ? (
          <View style={styles.outOfStockContainer}>
            <Icon name="alert-circle" size={14} color="#D97706" />
            <Text style={[styles.outOfStockText, {color: '#D97706'}]}>Only {product.stock} left</Text>
          </View>
        ) : (
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              onPress={() => updateQuantity(product._id, item.quantity - 1)}
              style={styles.quantityBtn}>
              <Icon name="remove" size={16} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <TouchableOpacity
              onPress={() => updateQuantity(product._id, item.quantity + 1)}
              style={styles.quantityBtn}>
              <Icon name="add" size={16} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        )}
      </View>
      <TouchableOpacity
        onPress={() => removeItem(product._id)}
        style={styles.removeBtn}>
        <Icon name="trash-outline" size={20} color={theme.colors.danger} />
      </TouchableOpacity>
    </Animated.View>
  );
});


export default function CartScreen({navigation}: CartProps) {
  const insets = useSafeAreaInsets();
  const {t} = useTranslation();
  const {showToast} = useToast();
  const [cart, setCart] = useState<ICart | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const {setCartCount} = useNotifications();
  const syncTimers = useRef<{[key: string]: NodeJS.Timeout}>({});

  useEffect(() => {
    fetchCart();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCart();
      // Background pulse every 30s to catch price/stock changes
      const interval = setInterval(fetchCart, 30000);
      return () => clearInterval(interval);
    }, [])
  );

  const fetchCart = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await axiosInstance.get('/api/cart');
      setCart(res.data.data);
      const items = res.data.data?.items || [];
      setCartCount(items.reduce((acc: number, item: any) => acc + item.quantity, 0));
    } catch (err) {
      console.error('Error fetching cart:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (!cart) return;

    const cartItem = cart.items.find(i => (i.product as IProduct)._id === productId);
    const product = cartItem?.product as IProduct;
    
    if (cartItem && newQuantity > cartItem.quantity && product && newQuantity > product.stock) {
      showToast({message: `Only ${product.stock} units available`, type: 'info'});
      return;
    }

    if (newQuantity <= 0) {
      removeItem(productId);
      return;
    }

    // 1. Instant UI Update
    const updatedItems = cart.items.map(item => {
      if ((item.product as IProduct)._id === productId) {
        return { ...item, quantity: newQuantity };
      }
      return item;
    });
    const updatedCart = { ...cart, items: updatedItems };
    setCart(updatedCart);
    setCartCount(updatedItems.reduce((acc, item) => acc + item.quantity, 0));

    // 2. Debounced Server Sync
    if (syncTimers.current[productId]) {
      clearTimeout(syncTimers.current[productId]);
    }

    syncTimers.current[productId] = setTimeout(async () => {
      try {
        const res = await axiosInstance.put('/api/cart/update', {
          productId,
          quantity: newQuantity,
        });
        // Sync back with real server data occasionally to ensure consistency
        setCart(res.data.data);
      } catch (err) {
        console.error('Cart sync failed:', err);
        fetchCart(); // Force refresh silently on error to revert to truth
      } finally {
        delete syncTimers.current[productId];
      }
    }, 500); // 500ms debounce
  };

  const removeItem = async (productId: string) => {
    const previousCart = cart;
    if (!cart) return;

    // Optimistic UI Update
    const updatedItems = cart.items.filter(item => (item.product as IProduct)._id !== productId);
    const updatedCart = { ...cart, items: updatedItems };
    setCart(updatedCart);
    setCartCount(updatedItems.reduce((acc, item) => acc + item.quantity, 0));

    try {
      await axiosInstance.delete(`/api/cart/${productId}`);
      showToast({message: 'Item removed from bag', type: 'info'});
    } catch (err) {
      // Revert
      setCart(previousCart);
      if (previousCart) {
        setCartCount(previousCart.items.reduce((acc, item) => acc + item.quantity, 0));
      }
      showToast({message: 'Could not remove item', type: 'error'});
    }
  };

  const calculateTotal = () => {
    if (!cart) return 0;
    return cart.items.reduce((total, item) => {
      const product = item.product as IProduct;
      const effectivePrice = item.priceSnapshotted || product.price;
      return total + effectivePrice * item.quantity;
    }, 0);
  };

  const renderItem = ({item, index}: {item: ICartItem; index: number}) => (
    <CartItem 
      item={item} 
      index={index} 
      updateQuantity={updateQuantity} 
      removeItem={removeItem} 
    />
  );


  const handleCheckout = () => {
    if (!cart || cart.items.length === 0) {
      showToast({message: 'Your bag is empty!', type: 'info'});
      return;
    }

    const oosItem = cart.items.find(item => (item.product as IProduct).stock === 0);
    if (oosItem) {
      showToast({message: 'Please remove out-of-stock items before checkout', type: 'error'});
      return;
    }

    const lowStockItem = cart.items.find(item => (item.product as IProduct).stock < item.quantity);
    if (lowStockItem) {
      showToast({message: 'Inventory updated. Some items now have limited stock.', type: 'error'});
      return;
    }
    
    navigation.navigate('Checkout', {
      products: cart.items.map(item => ({
        product: item.product as IProduct,
        quantity: item.quantity,
        lockedPrice: item.priceSnapshotted || (item.product as IProduct).price
      }))
    });
  };

  if (loading) return <CartSkeleton />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, {paddingTop: Math.max(insets.top, 16)}]}>
        <View style={styles.headerTitleRow}>
          <Image 
            source={require('../../../assets/velto_logo.png')} 
            style={styles.headerLogo} 
          />
          <View>
            <Text style={styles.headerTitle}>{t('cart.title')}</Text>
            {cart && cart.items.length > 0 && (
              <Text style={styles.itemCount}>{cart.items.length} {t('cart.items')}</Text>
            )}
          </View>
        </View>
      </View>


      <FlatList
        data={cart?.items || []}
        keyExtractor={item => (item.product as IProduct)._id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchCart(true)}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.decorativeCircle} />
            <View style={styles.emptyCircle}>
              <Icon name="bag-handle-outline" size={64} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{t('cart.empty_title')}</Text>
            <Text style={styles.emptyText}>
              {t('cart.empty_text')}
            </Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => (navigation as any).navigate('HomeTab')}
              style={styles.startBtn}>
              <Text style={styles.startBtnText}>{t('cart.start_shopping')}</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {cart && cart.items.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('cart.total')}</Text>
            <Text style={styles.totalValue}>
              ₹{calculateTotal().toLocaleString()}
            </Text>
          </View>
          <Button
            title={t('cart.checkout')}
            type="primary"
            style={styles.checkoutBtn}
            onPress={handleCheckout}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.colors.background},
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.colors.white,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 22, 
    fontWeight: '900', 
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemCount: {
    fontSize: 12, 
    color: theme.colors.muted, 
    fontWeight: '700',
    marginTop: -2,
  },
  list: {padding: 16, paddingBottom: 100, flexGrow: 1},
  cartItem: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: 12,
    marginBottom: 16,
    ...theme.shadow.sm,
    alignItems: 'center',
  },
  itemImage: {width: 80, height: 80, borderRadius: 12, backgroundColor: '#F8FAFC'},
  itemInfo: {flex: 1, marginLeft: 16},
  itemTitle: {fontSize: 16, fontWeight: '700', color: theme.colors.text},
  itemPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },

  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lockedText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.text,
  },

  expiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  expiredText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.muted,
  },

  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  quantityBtn: {padding: 8},
  quantityText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    paddingHorizontal: 12,
  },
  outOfStockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  outOfStockText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.danger,
  },
  removeBtn: {
    padding: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: theme.colors.white,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    ...theme.shadow.lg,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    alignItems: 'center',
  },
  totalLabel: {fontSize: 14, color: theme.colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1},
  totalValue: {fontSize: 24, fontWeight: '900', color: theme.colors.text},
  checkoutBtn: {width: '100%', borderRadius: 18, height: 56},

  emptyContainer: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  decorativeCircle: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#F1F5F9',
    opacity: 0.5,
    top: '10%',
  },
  emptyCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.md,
    marginBottom: 32,
  },
  emptyTitle: {
    fontSize: 26, 
    fontWeight: '900', 
    color: theme.colors.text,
    letterSpacing: -0.5,
  },
  emptyText: {
    fontSize: 15,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  startBtn: {
    marginTop: 48, 
    width: '100%', 
    height: 56,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.md,
  },
  startBtnText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
const CartSkeleton = () => {
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 800 }),
        withTiming(0.4, { duration: 800 }),
      ),
      -1,
      true,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, {paddingTop: Math.max(insets.top, 16)}]}>
         <Animated.View style={[animatedStyle, { width: 48, height: 48, borderRadius: 12, backgroundColor: '#F1F5F9' }]} />
         <View style={{ flex: 1, marginLeft: 16 }}>
            <Animated.View style={[animatedStyle, { width: 120, height: 20, borderRadius: 4, backgroundColor: '#F1F5F9' }]} />
         </View>
      </View>
      <View style={{ padding: 16, gap: 16 }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.cartItem, { shadowOpacity: 0 }]}>
             <Animated.View style={[animatedStyle, { width: 80, height: 80, borderRadius: 12, backgroundColor: '#F8FAFC' }]} />
             <View style={{ flex: 1, marginLeft: 16, gap: 10 }}>
                <Animated.View style={[animatedStyle, { width: '80%', height: 16, borderRadius: 4, backgroundColor: '#F1F5F9' }]} />
                <Animated.View style={[animatedStyle, { width: 60, height: 16, borderRadius: 4, backgroundColor: '#F1F5F9' }]} />
                <Animated.View style={[animatedStyle, { width: 100, height: 24, borderRadius: 8, backgroundColor: '#F1F5F9' }]} />
             </View>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
};

