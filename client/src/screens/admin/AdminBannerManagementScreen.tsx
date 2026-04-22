import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  TextInput,
  Dimensions,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ScrollView,
} from 'react-native';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Button} from '../../components/common/Button';
import {Input} from '../../components/common/Input';
import Icon from 'react-native-vector-icons/Ionicons';
import {launchImageLibrary} from 'react-native-image-picker';
import {Category} from '@shared/types';
import {useToast} from '../../hooks/useToast';
import Animated, {FadeInUp, FadeInRight} from 'react-native-reanimated';

const {width} = Dimensions.get('window');

interface IBanner {
  _id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  category: Category;
  isActive: boolean;
}

export default function AdminBannerManagementScreen() {
  const {showToast} = useToast();
  const [banners, setBanners] = useState<IBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>(Category.OTHER);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const res = await axiosInstance.get('/api/banners/admin');
      setBanners(res.data.data);
    } catch (error) {
      showToast({message: 'Failed to fetch banners', type: 'error'});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
      });
      if (result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri!);
      }
    } catch (err) {
      console.log('Image Picker Error:', err);
    }
  };

  const handleCreateBanner = async () => {
    if (!title || !subtitle || !selectedImage) {
      showToast({message: 'Please fill all fields and select an image', type: 'info'});
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('subtitle', subtitle);
      formData.append('category', selectedCategory);
      
      const fileName = `banner_${Date.now()}.jpg`;
      formData.append('image', {
        uri: selectedImage,
        name: fileName,
        type: 'image/jpeg',
      } as any);

      await axiosInstance.post('/api/banners', formData);

      showToast({message: 'Banner created successfully!', type: 'success'});
      setIsAddModalVisible(false);
      resetForm();
      fetchBanners();
    } catch (error) {
      showToast({message: 'Failed to create banner', type: 'error'});
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setSubtitle('');
    setSelectedCategory(Category.OTHER);
    setSelectedImage(null);
  };

  const handleToggleStatus = async (id: string) => {
    try {
      await axiosInstance.patch(`/api/banners/${id}/toggle`);
      setBanners(prev => prev.map(b => b._id === id ? {...b, isActive: !b.isActive} : b));
    } catch (error) {
      showToast({message: 'Failed to update status', type: 'error'});
    }
  };

  const handleDeleteBanner = async (id: string) => {
    Alert.alert('Delete Banner', 'Are you sure you want to remove this banner?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await axiosInstance.delete(`/api/banners/${id}`);
            setBanners(prev => prev.filter(b => b._id !== id));
            showToast({message: 'Banner deleted', type: 'success'});
          } catch (error) {
            showToast({message: 'Failed to delete banner', type: 'error'});
          }
        },
      },
    ]);
  };

  const categories = Object.values(Category);

  const renderBannerItem = ({item, index}: {item: IBanner; index: number}) => (
    <Animated.View entering={FadeInUp.delay(index * 100)}>
      <View style={[styles.bannerCard, !item.isActive && styles.inactiveCard]}>
        <Image source={{uri: item.imageUrl}} style={styles.bannerPreview} />
        <View style={styles.bannerInfo}>
          <Text style={styles.bannerTitle}>{item.title}</Text>
          <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={[styles.actionIcon, item.isActive ? styles.activeBg : styles.inactiveBg]} 
            onPress={() => handleToggleStatus(item._id)}>
            <Icon 
              name={item.isActive ? "eye" : "eye-off"} 
              size={20} 
              color={item.isActive ? theme.colors.success : theme.colors.muted} 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionIcon, styles.deleteBg]} 
            onPress={() => handleDeleteBanner(item._id)}>
            <Icon name="trash-outline" size={20} color={theme.colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.title}>Banner Management</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setIsAddModalVisible(true)}>
          <Icon name="add" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={banners}
        keyExtractor={item => item._id}
        renderItem={renderBannerItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchBanners} tintColor={theme.colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="images-outline" size={64} color={theme.colors.border} />
            <Text style={styles.emptyText}>No banners configured.</Text>
            <Text style={styles.emptySub}>Add some to populate the Home carousel.</Text>
          </View>
        }
      />

      <Modal visible={isAddModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Banner</Text>
              <TouchableOpacity onPress={() => setIsAddModalVisible(false)}>
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
                {selectedImage ? (
                  <Image source={{uri: selectedImage}} style={styles.selectedImage} />
                ) : (
                  <View style={styles.pickerPlaceholder}>
                    <Icon name="camera" size={40} color={theme.colors.muted} />
                    <Text style={styles.pickerText}>Select Banner Image</Text>
                    <Text style={styles.pickerSub}>Suggested: 1200 x 600px</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Input label="Main Title" placeholder="e.g. Summer Sale" value={title} onChangeText={setTitle} />
              <Input label="Subtitle" placeholder="e.g. Up to 50% OFF" value={subtitle} onChangeText={setSubtitle} />

              <Text style={styles.label}>Navigation Category</Text>
              <View style={styles.categoryList}>
                {categories.map((cat, idx) => (
                  <TouchableOpacity 
                    key={cat} 
                    style={[styles.catBtn, selectedCategory === cat && styles.catBtnActive]} 
                    onPress={() => setSelectedCategory(cat)}>
                    <Text style={[styles.catBtnText, selectedCategory === cat && styles.catBtnTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Button 
                title={isSubmitting ? "Uploading..." : "Save Banner"} 
                onPress={handleCreateBanner} 
                disabled={isSubmitting}
                style={styles.saveBtn}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: theme.colors.white},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: theme.colors.white,
    ...theme.shadow.sm,
  },
  title: {fontSize: 24, fontWeight: '900', color: theme.colors.text},
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {padding: 16, paddingBottom: 40},
  bannerCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...theme.shadow.sm,
    alignItems: 'center',
  },
  inactiveCard: {opacity: 0.6},
  bannerPreview: {width: 80, height: 60, borderRadius: 12, backgroundColor: '#F1F5F9'},
  bannerInfo: {flex: 1, marginLeft: 16},
  bannerTitle: {fontSize: 16, fontWeight: '800', color: theme.colors.text},
  bannerSubtitle: {fontSize: 12, color: theme.colors.muted, marginTop: 2},
  categoryBadge: {
    backgroundColor: theme.colors.primary + '08',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  categoryText: {fontSize: 10, fontWeight: '900', color: theme.colors.primary},
  cardActions: {flexDirection: 'row', gap: 8},
  actionIcon: {width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center'},
  activeBg: {backgroundColor: '#DCFCE7'},
  inactiveBg: {backgroundColor: '#F1F5F9'},
  deleteBg: {backgroundColor: '#FEE2E2'},
  empty: {alignItems: 'center', marginTop: 100, padding: 40},
  emptyText: {fontSize: 18, fontWeight: '800', color: theme.colors.text, marginTop: 16},
  emptySub: {fontSize: 14, color: theme.colors.muted, textAlign: 'center', marginTop: 8},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'},
  modalContent: {
    backgroundColor: theme.colors.white, 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 24, 
    maxHeight: '90%'
  },
  modalHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24},
  modalTitle: {fontSize: 20, fontWeight: '900', color: theme.colors.text},
  imagePicker: {
    width: '100%',
    height: 180,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginBottom: 20,
    overflow: 'hidden',
  },
  selectedImage: {width: '100%', height: '100%'},
  pickerPlaceholder: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  pickerText: {fontSize: 14, fontWeight: '800', color: theme.colors.text, marginTop: 10},
  pickerSub: {fontSize: 11, color: theme.colors.muted, marginTop: 4},
  label: {fontSize: 14, fontWeight: '800', color: theme.colors.text, marginBottom: 12, marginTop: 8},
  categoryList: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24},
  catBtn: {paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F1F5F9'},
  catBtnActive: {backgroundColor: theme.colors.primary},
  catBtnText: {fontSize: 12, fontWeight: '700', color: theme.colors.text},
  catBtnTextActive: {color: theme.colors.white},
  saveBtn: {marginTop: 12, marginBottom: 20},
});