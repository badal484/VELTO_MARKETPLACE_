import { View, Text } from 'react-native'
import React from 'react'

const InventoryScreen = () => {
  return (
    <View>
      <Text>InventoryScreen</Text>
    </View>
  )
}
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {useToast} from '../../hooks/useToast';
import {IProduct} from '@shared/types';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {FadeInUp, Layout} from 'react-native-reanimated';
import {StackNavigationProp} from '@react-navigation/stack';
import {DashboardStackParamList} from '../../navigation/types';

type InventoryNavigationProp = StackNavigationProp<
  DashboardStackParamList,
  'ManageInventory'
>;

interface InventoryScreenProps {
  navigation: InventoryNavigationProp;
}

export default function InventoryScreen({
  navigation,
}: InventoryScreenProps) {
  const {showToast} = useToast();
  const [products, setProducts] = useState<IProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<IProduct[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (search.trim() === '') {
      setFilteredProducts(products);
    } else {
      const lowerSearch = search.toLowerCase();
      const filtered = products.filter(
        p =>
          p.title.toLowerCase().includes(lowerSearch) ||
          p.category.toLowerCase().includes(lowerSearch),
      );
      setFilteredProducts(filtered);
    }
  }, [search, products]);

  const fetchProducts = async () => {
    try {
      const res = await axiosInstance.get('/api/products/my');
      if (res.data.success) {
        setProducts(res.data.data);
      }
    } catch (err) {
      showToast({message: 'Failed to load inventory', type: 'error'});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toggleStatus = async (product: IProduct) => {
    try {
      const res = await axiosInstance.put(`/api/products/${product._id}`, {
        isActive: !product.isActive,
      });
      if (res.data.success) {
        setProducts(prev =>
          prev.map(p =>
            p._id === product._id ? {...p, isActive: !p.isActive} : p,
          ),
        );
        showToast({message: `Listing ${!product.isActive ? 'activated' : 'deactivated'}`, type: 'info'});
      }
    } catch (err) {
      showToast({message: 'Failed to update status', type: 'error'});
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to remove this item from your shop?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await axiosInstance.delete(`/api/products/${id}`);
              if (res.data.success) {
                setProducts(prev => prev.filter(p => p._id !== id));
                showToast({message: 'Product deleted from shop', type: 'info'});
              }
            } catch (err) {
              showToast({message: 'Could not delete product', type: 'error'});
            }
          },
        },
      ],
      {cancelable: true},
    );
  };

  const renderProduct = ({item, index}: {item: IProduct; index: number}) => (
    <Animated.View
      entering={FadeInUp.delay(index * 50)}
      layout={Layout.springify()}
      style={styles.productCard}>
      <View style={styles.productMain}>
        <Image source={{uri: item.images[0]}} style={styles.thumbnail} />
        <View style={styles.productDetails}>
          <View style={styles.titleRow}>
            <Text style={styles.productTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: item.isActive
                    ? theme.colors.success + '20'
                    : '#F1F5F9',
                },
              ]}>
              <Text
                style={[
                  styles.statusText,
                  {color: item.isActive ? theme.colors.success : theme.colors.muted},
                ]}>
                {item.isActive ? 'ACTIVE' : 'INACTIVE'}
              </Text>
            </View>
          </View>
          <Text style={styles.categoryText}>{item.category}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceText}>₹{item.price}</Text>
            <View style={styles.stockBox}>
              <Icon name="cube-outline" size={12} color={theme.colors.muted} />
              <Text
                style={[
                  styles.stockText,
                  item.stock <= 5 && {color: theme.colors.danger},
                ]}>
                {item.stock} in stock
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.actionsBar}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('AddEditListing', {product: item})}>
          <Icon name="create-outline" size={18} color={theme.colors.primary} />
          <Text style={[styles.actionLabel, {color: theme.colors.primary}]}>
            Edit
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => toggleStatus(item)}>
          <Icon
            name={item.isActive ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color={theme.colors.text}
          />
          <Text style={styles.actionLabel}>
            {item.isActive ? 'Hide' : 'Show'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => handleDelete(item._id)}>
          <Icon name="trash-outline" size={18} color={theme.colors.danger} />
          <Text style={[styles.actionLabel, {color: theme.colors.danger}]}>
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}>
          <Icon name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inventory Management</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('AddEditListing', {product: undefined})}
          style={styles.addBtn}>
          <Icon name="add" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Icon name="search" size={20} color={theme.colors.muted} />
          <TextInput
            placeholder="Search products, categories..."
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholderTextColor={theme.colors.muted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="close-circle" size={18} color={theme.colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={item => item._id}
          renderItem={renderProduct}
          contentContainerStyle={styles.listContent}
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
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <Icon name="cube-outline" size={64} color={theme.colors.border} />
              <Text style={styles.emptyTitle}>No Products Found</Text>
              <Text style={styles.emptySub}>
                {search.length > 0
                  ? "Try searching for something else"
                  : "Start adding products to your inventory"}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: theme.colors.white},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {fontSize: 18, fontWeight: '800', color: theme.colors.text},
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: theme.colors.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '500',
  },
  listContent: {padding: 16, paddingBottom: 40},
  productCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    marginBottom: 16,
    ...theme.shadow.sm,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  productMain: {flexDirection: 'row', padding: 12},
  thumbnail: {width: 80, height: 80, borderRadius: 12, backgroundColor: '#F8FAFC'},
  productDetails: {marginLeft: 12, flex: 1, justifyContent: 'space-between'},
  titleRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  productTitle: {fontSize: 15, fontWeight: '700', color: theme.colors.text, flex: 1},
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  statusText: {fontSize: 9, fontWeight: '800'},
  categoryText: {fontSize: 12, color: theme.colors.muted, marginTop: 2},
  priceRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8},
  priceText: {fontSize: 16, fontWeight: '900', color: theme.colors.primary},
  stockBox: {flexDirection: 'row', alignItems: 'center', gap: 4},
  stockText: {fontSize: 12, color: theme.colors.muted, fontWeight: '600'},
  actionsBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    backgroundColor: '#FCFDFF',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderRightWidth: 1,
    borderRightColor: '#F8FAFC',
  },
  actionLabel: {fontSize: 12, fontWeight: '700', color: theme.colors.muted},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  emptyView: {alignItems: 'center', marginTop: 100},
  emptyTitle: {fontSize: 18, fontWeight: '800', color: theme.colors.text, marginTop: 16},
  emptySub: {fontSize: 14, color: theme.colors.muted, marginTop: 8},
});
export default InventoryScreen