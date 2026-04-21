import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Card} from '../../components/common/Card';
import Icon from 'react-native-vector-icons/Ionicons';
import {IProduct, IShop} from '@shared/types';
import Animated, {FadeInUp} from 'react-native-reanimated';

export default function AdminProductsScreen() {
  const [products, setProducts] = useState<IProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await axiosInstance.get('/api/admin/products');
      setProducts(res.data.data);
    } catch (error: unknown) {
      console.error('Error fetching admin products:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDeleteProduct = (id: string, title: string) => {
    Alert.alert(
      'Moderate Listing',
      `Are you sure you want to permanently remove "${title}"? This action is taken for violation of marketplace policies.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove Listing',
          style: 'destructive',
          onPress: async () => {
            try {
              await axiosInstance.delete(`/api/admin/products/${id}`);
              Alert.alert(
                'Listing Removed',
                'The product has been successfully moderated and taken down.',
              );
              fetchProducts();
            } catch (error: unknown) {
              if (error && typeof error === 'object' && 'response' in error) {
                const axiosErr = error as {response: {data: {message: string}}};
                Alert.alert(
                  'Error',
                  axiosErr.response?.data?.message ||
                    'Failed to moderate product.',
                );
              }
            }
          },
        },
      ],
    );
  };

  const renderProduct = ({item, index}: {item: IProduct; index: number}) => (
    <Animated.View entering={FadeInUp.delay(index * 40).duration(500)}>
      <Card style={styles.card} variant="elevated">
        <View style={styles.contentRow}>
          <View style={styles.imageContainer}>
            {item.images && item.images.length > 0 ? (
              <Image source={{uri: item.images[0]}} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.imagePlaceholder]}>
                <Icon name="image-outline" size={24} color={theme.colors.muted} />
              </View>
            )}
            <View style={[
              styles.stockBadge,
              {backgroundColor: item.stock > 0 ? theme.colors.success : theme.colors.danger}
            ]}>
              <Text style={styles.stockText}>{item.stock > 0 ? 'LIVE' : 'SOLD OUT'}</Text>
            </View>
          </View>

          <View style={styles.textContainer}>
            <View style={styles.titleLine}>
              <Text style={styles.productTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.price}>₹{item.price}</Text>
            </View>

            <View style={styles.shopRow}>
              <Icon
                name="storefront-outline"
                size={12}
                color={theme.colors.muted}
              />
              <Text style={styles.shopName} numberOfLines={1}>
                {(item.shop as unknown as IShop)?.name || 'Merchant'}
              </Text>
            </View>

            <View style={styles.metaLine}>
              <View style={styles.catBox}>
                <Text style={styles.catText}>{item.category}</Text>
              </View>
              <View style={styles.statLine}>
                <Icon name="eye-outline" size={12} color={theme.colors.muted} />
                <Text style={styles.statText}>{item.views || 0} views</Text>
              </View>
              <View style={styles.statLine}>
                <Icon name="cube-outline" size={12} color={theme.colors.muted} />
                <Text style={styles.statText}>{item.stock} qty</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => handleDeleteProduct(item._id, item.title)}
            style={styles.modAction}
            activeOpacity={0.7}>
            <Icon name="ban" size={20} color={theme.colors.danger} />
          </TouchableOpacity>
        </View>
      </Card>
    </Animated.View>
  );

  if (loading && !refreshing) {
    return <Loader />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>Product Moderation</Text>
          <Text style={styles.subtitle}>
            {products.length} active listings on the platform
          </Text>
        </View>
        <FlatList
          data={products}
          keyExtractor={item => item._id}
          renderItem={renderProduct}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchProducts();
              }}
              tintColor={theme.colors.primary}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: theme.colors.white},
  container: {flex: 1, backgroundColor: theme.colors.background},
  headerTitleContainer: {
    padding: 24,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {fontSize: 24, fontWeight: '900', color: theme.colors.text},
  subtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 4,
    fontWeight: '600',
  },
  list: {padding: 16, paddingBottom: 40},
  card: {marginBottom: 12, padding: 12, borderRadius: 16},
  contentRow: {flexDirection: 'row', alignItems: 'center'},
  imageContainer: {position: 'relative'},
  thumb: {width: 80, height: 80, borderRadius: 12, backgroundColor: '#F1F5F9'},
  imagePlaceholder: {alignItems: 'center', justifyContent: 'center'},
  stockBadge: {
    position: 'absolute',
    bottom: -4,
    left: -4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  stockText: {
    fontSize: 8,
    fontWeight: '900',
    color: theme.colors.white,
  },
  textContainer: {flex: 1, marginLeft: 16, marginRight: 8},
  titleLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    flex: 1,
    marginRight: 8,
  },
  price: {fontSize: 14, fontWeight: '900', color: theme.colors.primary},
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  shopName: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  metaLine: {flexDirection: 'row', alignItems: 'center', gap: 12},
  catBox: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.muted,
    textTransform: 'uppercase',
  },
  statLine: {flexDirection: 'row', alignItems: 'center', gap: 4},
  statText: {fontSize: 10, color: theme.colors.muted, fontWeight: '600'},
  modAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.danger + '08',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
