import React, {useEffect, useState, useCallback} from 'react';
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
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {useToast} from '../../hooks/useToast';
import {Loader} from '../../components/common/Loader';
import {Button} from '../../components/common/Button';
import Icon from 'react-native-vector-icons/Ionicons';
import {ICart, ICartItem, IProduct} from '@shared/types';
import Animated, {FadeInRight, FadeOutLeft} from 'react-native-reanimated';
import {useTranslation} from 'react-i18next';

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

const CartItem = ({item, index, updateQuantity, removeItem, updatingId}: {
  item: ICartItem; 
  index: number; 
  updateQuantity: (id: string, q: number) => void;
  removeItem: (id: string) => void;
  updatingId: string | null;
}) => {
  const product = item.product as IProduct;
  // Use the snapshotted price if provided, otherwise fallback to current
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
              style={styles.quantityBtn}
              disabled={updatingId === product._id}>
              <Icon name="remove" size={16} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <TouchableOpacity
              onPress={() => updateQuantity(product._id, item.quantity + 1)}
              style={styles.quantityBtn}
              disabled={updatingId === product._id}>
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
};


export default function CartScreen({navigation}: CartProps) {
  const {t} = useTranslation();
  const {showToast} = useToast();
  const [cart, setCart] = useState<ICart | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCart();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCart();
    }, [])
  );

  const fetchCart = async () => {
    try {
      const res = await axiosInstance.get('/api/cart');
      setCart(res.data.data);
    } catch (err) {
      console.error('Error fetching cart:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (productId: string, newQuantity: number) => {
    setUpdatingId(productId);
    const cartItem = cart?.items.find(i => (i.product as IProduct)._id === productId);
    const product = cartItem?.product as IProduct;
    
    if (cartItem && newQuantity > cartItem.quantity && product && newQuantity > product.stock) {
      showToast({message: `Only ${product.stock} units available`, type: 'info'});
      setUpdatingId(null);
      return;
    }

    try {
      const res = await axiosInstance.put('/api/cart/update', {
        productId,
        quantity: newQuantity,
      });
      setCart(res.data.data);
    } catch (err) {
      showToast({message: 'Could not update quantity', type: 'error'});
    } finally {
      setUpdatingId(null);
    }
  };

  const removeItem = async (productId: string) => {
    try {
      await axiosInstance.delete(`/api/cart/${productId}`);
      fetchCart();
      showToast({message: 'Item removed from bag', type: 'info'});
    } catch (err) {
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
      updatingId={updatingId} 
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

  if (loading) return <Loader />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
            <Image 
            source={require('../../../assets/velto_logo.png')} 
            style={styles.headerLogo} 
          />
          <Text style={styles.headerTitle}>{t('cart.title')}</Text>
        </View>
        {cart && cart.items.length > 0 && (
          <Text style={styles.itemCount}>{cart.items.length} {t('cart.items')}</Text>
        )}
      </View>


      <FlatList
        data={cart?.items || []}
        keyExtractor={item => (item.product as IProduct)._id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyCircle}>
              <Icon name="bag-handle-outline" size={60} color={theme.colors.muted} />
            </View>
            <Text style={styles.emptyTitle}>{t('cart.empty_title')}</Text>
            <Text style={styles.emptyText}>
              {t('cart.empty_text')}
            </Text>
            <Button
              title={t('cart.start_shopping')}
              onPress={() => (navigation as any).navigate('HomeTab')}
              style={styles.startBtn}
            />
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
    padding: 24,
    backgroundColor: theme.colors.white,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...theme.shadow.sm,
  },

  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 50,
    height: 50,
    borderRadius: 14,
  },
  headerTitle: {fontSize: 28, fontWeight: '900', color: theme.colors.text},
  itemCount: {fontSize: 14, color: theme.colors.muted, fontWeight: '600', alignSelf: 'flex-end', marginBottom: 4},
  list: {padding: 16, paddingBottom: 100},
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
    padding: 40,
    alignItems: 'center',
    marginTop: 60,
  },
  emptyCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
    marginBottom: 24,
  },
  emptyIconBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
    marginBottom: 24,
  },
  emptyTitle: {fontSize: 22, fontWeight: '900', color: theme.colors.text},
  emptyText: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  startBtn: {marginTop: 32, width: '100%', borderRadius: 14},
});
