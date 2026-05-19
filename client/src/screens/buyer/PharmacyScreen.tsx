import React, {useEffect, useState, useCallback, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {useToast} from '../../hooks/useToast';
import {IPharmacyCatalog, MedicineForm} from '@shared/types';
import {StackNavigationProp} from '@react-navigation/stack';
import {HomeStackParamList} from '../../navigation/types';

type PharmacyScreenNav = StackNavigationProp<HomeStackParamList, 'PharmacyHome'>;
interface Props {
  navigation: PharmacyScreenNav;
  route: any;
}

export interface PharmacyCartItem {
  item: IPharmacyCatalog;
  quantity: number;
}

const FORM_ICONS: Record<string, string> = {
  tablet: 'tablet-portrait-outline',
  capsule: 'ellipse-outline',
  syrup: 'flask-outline',
  cream: 'color-fill-outline',
  drops: 'water-outline',
  device: 'hardware-chip-outline',
  powder: 'snow-outline',
  injection: 'medical-outline',
  other: 'medkit-outline',
};

const CATEGORY_TABS = [
  {id: 'all', label: 'All'},
  {id: 'otc', label: 'OTC'},
  {id: 'rx', label: 'Prescription'},
  {id: 'tablet', label: 'Tablets'},
  {id: 'syrup', label: 'Syrups'},
  {id: 'device', label: 'Devices'},
];

export default function PharmacyScreen({navigation, route}: Props) {
  const insets = useSafeAreaInsets();
  const {showToast} = useToast();
  const coords = route.params?.coords as {lat: number; lng: number} | undefined;

  const [items, setItems] = useState<IPharmacyCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [cart, setCart] = useState<Map<string, PharmacyCartItem>>(new Map());
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchCatalog('');
  }, []);

  const fetchCatalog = async (q: string) => {
    try {
      q ? setSearching(true) : setLoading(true);
      const res = await axiosInstance.get(
        `/api/pharmacy/catalog?q=${encodeURIComponent(q)}&limit=50`,
      );
      setItems(res.data.data || []);
    } catch {
      showToast({message: 'Could not load medicines', type: 'error'});
    } finally {
      setLoading(false);
      setSearching(false);
    }
  };

  const handleSearch = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchCatalog(text), 300);
  };

  const filteredItems = items.filter(item => {
    if (activeTab === 'rx') return item.requiresPrescription;
    if (activeTab === 'otc') return !item.requiresPrescription;
    if (activeTab === 'tablet') return item.form === MedicineForm.TABLET;
    if (activeTab === 'syrup') return item.form === MedicineForm.SYRUP;
    if (activeTab === 'device') return item.form === MedicineForm.DEVICE;
    return true;
  });

  const addToCart = useCallback((item: IPharmacyCatalog) => {
    setCart(prev => {
      const next = new Map(prev);
      const existing = next.get(item._id);
      next.set(item._id, {item, quantity: (existing?.quantity ?? 0) + 1});
      return next;
    });
  }, []);

  const removeFromCart = useCallback(
    (itemId: string) => {
      setCart(prev => {
        const next = new Map(prev);
        const existing = next.get(itemId);
        if (!existing) return prev;
        if (existing.quantity <= 1) {
          next.delete(itemId);
        } else {
          next.set(itemId, {...existing, quantity: existing.quantity - 1});
        }
        return next;
      });
    },
    [],
  );

  const cartArray = Array.from(cart.values());
  const cartTotal = cartArray.reduce(
    (sum, c) => sum + c.item.mrp * c.quantity,
    0,
  );
  const cartCount = cartArray.reduce((sum, c) => sum + c.quantity, 0);
  const needsPrescription = cartArray.some(c => c.item.requiresPrescription);

  const goToCheckout = () => {
    if (cartCount === 0) return;
    navigation.navigate('PharmacyCheckout', {cart: cartArray, coords});
  };

  const renderItem = ({item}: {item: IPharmacyCatalog}) => {
    const cartEntry = cart.get(item._id);
    const qty = cartEntry?.quantity ?? 0;

    return (
      <View style={styles.medicineCard}>
        <View style={styles.cardLeft}>
          <View style={styles.formIconBox}>
            <Icon
              name={FORM_ICONS[item.form] ?? 'medkit-outline'}
              size={20}
              color={theme.colors.accent}
            />
          </View>
        </View>
        <View style={styles.cardMid}>
          <View style={styles.nameLine}>
            <Text style={styles.medicineName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.requiresPrescription && (
              <View style={styles.rxBadge}>
                <Text style={styles.rxText}>Rx</Text>
              </View>
            )}
          </View>
          <Text style={styles.brandText} numberOfLines={1}>
            {item.brand} · {item.strength}
          </Text>
          <Text style={styles.mrpText}>₹{item.mrp}</Text>
        </View>
        <View style={styles.cardRight}>
          {qty === 0 ? (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => addToCart(item)}
              activeOpacity={0.8}>
              <Icon name="add" size={18} color={theme.colors.white} />
            </TouchableOpacity>
          ) : (
            <View style={styles.qtyControl}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => removeFromCart(item._id)}>
                <Icon
                  name="remove"
                  size={16}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{qty}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => addToCart(item)}>
                <Icon name="add" size={16} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, {paddingTop: insets.top}]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}>
          <Icon name="arrow-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pharmacy</Text>
        <View style={{width: 36}} />
      </View>

      {/* Upload Prescription CTA */}
      <TouchableOpacity
        style={styles.rxCta}
        activeOpacity={0.88}
        onPress={() =>
          navigation.navigate('PharmacyCheckout', {
            cart: [],
            coords,
            openPrescription: true,
          })
        }>
        <View style={styles.rxCtaLeft}>
          <Icon name="document-text" size={22} color="#fff" />
          <View style={styles.rxCtaText}>
            <Text style={styles.rxCtaTitle}>Upload Prescription</Text>
            <Text style={styles.rxCtaSubtitle}>
              Share your Rx
            </Text>
          </View>
        </View>
        <Icon name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      {/* Search */}
      <View style={styles.searchRow}>
        <Icon
          name="search-outline"
          size={18}
          color={theme.colors.muted}
          style={{marginRight: 8}}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search medicines, symptoms…"
          placeholderTextColor={theme.colors.muted}
          value={query}
          onChangeText={handleSearch}
          autoCorrect={false}
        />
        {searching && (
          <ActivityIndicator size="small" color={theme.colors.accent} />
        )}
        {query.length > 0 && !searching && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Icon name="close-circle" size={18} color={theme.colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category tabs */}
      <View style={{height: 40}}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORY_TABS}
          keyExtractor={t => t.id}
          style={styles.tabList}
          contentContainerStyle={{paddingHorizontal: 16, alignItems: 'center'}}
          renderItem={({item, index}) => (
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === item.id && styles.tabActive,
              index !== CATEGORY_TABS.length - 1 && {marginRight: 8}
            ]}
            onPress={() => setActiveTab(item.id)}
            activeOpacity={0.8}>
            <Text
              style={[
                styles.tabText,
                activeTab === item.id && styles.tabTextActive,
              ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />
      </View>

      {/* Prescription required warning */}
      {needsPrescription && (
        <View style={styles.rxWarning}>
          <Icon name="alert-circle" size={14} color="#D97706" />
          <Text style={styles.rxWarningText}>
            Some items need a valid prescription at checkout
          </Text>
        </View>
      )}

      {/* Section Title */}
      {!loading && (
        <Text style={styles.sectionTitle}>
          {query.length > 0 ? 'Search Results' : 'Pharmacy picks for you'}
        </Text>
      )}

      {/* Medicines list */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.centered}>
          <Icon name="search-outline" size={48} color={theme.colors.muted} />
          <Text style={styles.emptyText}>No medicines found</Text>
          {query.length > 0 && (
            <Text style={styles.emptySubText}>Try a different search term</Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={i => i._id}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: cartCount > 0 ? 100 : 24,
          }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Checkout bar */}
      {cartCount > 0 && (
        <View style={[styles.checkoutBar, {paddingBottom: insets.bottom + 12}]}>
          <View style={styles.checkoutInfo}>
            <Text style={styles.checkoutCount}>
              {cartCount} item{cartCount > 1 ? 's' : ''}
            </Text>
            <Text style={styles.checkoutTotal}>₹{cartTotal.toFixed(0)}</Text>
          </View>
          <TouchableOpacity
            style={styles.checkoutBtn}
            onPress={goToCheckout}
            activeOpacity={0.88}>
            <Text style={styles.checkoutBtnText}>Proceed to Checkout</Text>
            <Icon name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {padding: 4},
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
  },
  rxCta: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#6D28D9',
    borderRadius: theme.radius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rxCtaLeft: {flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1},
  rxCtaText: {flex: 1},
  rxCtaTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: theme.fontSize.md,
  },
  rxCtaSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: theme.fontSize.xs,
    marginTop: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    paddingVertical: 0,
  },
  tabList: {
    flexGrow: 0,
  },
  tab: {
    paddingHorizontal: 16,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  tabTextActive: {color: theme.colors.white},
  rxWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rxWarningText: {
    fontSize: theme.fontSize.xs,
    color: '#92400E',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.text,
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 8,
  },
  centered: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12},
  emptyText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  emptySubText: {fontSize: theme.fontSize.sm, color: theme.colors.muted},
  medicineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
  },
  cardLeft: {},
  formIconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMid: {flex: 1},
  nameLine: {flexDirection: 'row', alignItems: 'center', gap: 6},
  medicineName: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  rxBadge: {
    backgroundColor: '#EDE9FE',
    borderRadius: theme.radius.xs,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  rxText: {fontSize: 10, fontWeight: '800', color: '#6D28D9'},
  brandText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
    marginTop: 2,
  },
  mrpText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 4,
  },
  cardRight: {},
  addBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  qtyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: theme.colors.background,
  },
  qtyText: {
    paddingHorizontal: 10,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.text,
  },
  checkoutBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  checkoutInfo: {},
  checkoutCount: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.muted,
  },
  checkoutTotal: {
    fontSize: theme.fontSize.lg,
    fontWeight: '800',
    color: theme.colors.text,
  },
  checkoutBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  checkoutBtnText: {
    color: theme.colors.white,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
  },
});
