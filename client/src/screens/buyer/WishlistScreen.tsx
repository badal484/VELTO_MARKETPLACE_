import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Button} from '../../components/common/Button';
import Icon from 'react-native-vector-icons/Ionicons';
import {IProduct} from '@shared/types';
import Animated, {FadeInUp} from 'react-native-reanimated';

const {width} = Dimensions.get('window');
const columnWidth = (width - 48) / 2;

import { StackNavigationProp } from '@react-navigation/stack';
import { ProfileStackParamList } from '../../navigation/types';

type WishlistScreenNavigationProp = StackNavigationProp<ProfileStackParamList, 'Wishlist'>;

interface WishlistProps {
  navigation: WishlistScreenNavigationProp;
}

export default function WishlistScreen({navigation}: WishlistProps) {
  const [products, setProducts] = useState<IProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchWishlist();
    }, [])
  );

  const fetchWishlist = async () => {
    try {
      const res = await axiosInstance.get('/api/wishlist');
      // Safety filter for null products (if a seller deleted a product)
      const validProducts = (res.data.data.products || []).filter(Boolean);
      setProducts(validProducts);
    } catch (err) {
      console.error('Error fetching wishlist:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleWishlist = async (productId: string) => {
    try {
      await axiosInstance.post('/api/wishlist/toggle', {productId});
      setProducts(prev => prev.filter(p => p._id !== productId));
    } catch (err) {
      console.error('Error toggling wishlist:', err);
    }
  };

  const renderProduct = ({item, index}: {item: IProduct; index: number}) => (
    <Animated.View
      entering={FadeInUp.delay(index * 100)}
      style={styles.cardContainer}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ProductDetail', {id: item._id})}
        activeOpacity={0.9}>
        <Image source={{uri: item.images[0]}} style={styles.image} />
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={() => toggleWishlist(item._id)}>
          <Icon name="heart" size={18} color={theme.colors.primary} />
        </TouchableOpacity>

        <View style={styles.cardContent}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.price}>₹{item.price.toLocaleString()}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  if (loading) return <Loader />;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wishlist</Text>
        {products.length > 0 && (
          <Text style={styles.itemCount}>{products.length} Items</Text>
        )}
      </View>

      <FlatList
        data={products}
        keyExtractor={item => item._id}
        renderItem={renderProduct}
        numColumns={2}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.columnWrapper}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Icon name="heart-outline" size={60} color={theme.colors.muted} />
            </View>
            <Text style={styles.emptyTitle}>Your Wishlist is empty</Text>
            <Text style={styles.emptyText}>
              Add items you love to your wishlist to find them easily later.
            </Text>
            <Button
              title="Browse Shop"
              onPress={() => (navigation as any).navigate('HomeTab')}
              style={styles.startBtn}
            />
          </View>
        }
      />
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
    alignItems: 'baseline',
  },
  headerTitle: {fontSize: 28, fontWeight: '900', color: theme.colors.text},
  itemCount: {fontSize: 14, color: theme.colors.muted, fontWeight: '600'},
  list: {padding: 16, paddingBottom: 40},
  columnWrapper: {justifyContent: 'space-between'},
  cardContainer: {width: columnWidth, marginBottom: 16},
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    ...theme.shadow.sm,
  },
  image: {width: '100%', height: 180, backgroundColor: '#F8FAFC'},
  heartBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
  },
  cardContent: {padding: 12},
  title: {fontSize: 15, fontWeight: '700', color: theme.colors.text},
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
    marginTop: 4,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    marginTop: 60,
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
