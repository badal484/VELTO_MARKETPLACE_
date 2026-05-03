import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Switch,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {theme} from '../../theme';
import {axiosInstance} from '../../api/axiosInstance';
import {Loader} from '../../components/common/Loader';
import {Button} from '../../components/common/Button';
import {useToast} from '../../hooks/useToast';
import {IServiceZone} from '@shared/types';

export default function AdminZonesScreen() {
  const {showToast} = useToast();
  const [zones, setZones] = useState<IServiceZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingZone, setEditingZone] = useState<Partial<IServiceZone> | null>(null);

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      const res = await axiosInstance.get('/api/zones/all');
      if (res.data.success) {
        setZones(res.data.data);
      }
    } catch (error) {
      console.error('Fetch Zones Error:', error);
      showToast({message: 'Failed to load service zones', type: 'error'});
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingZone?.name || !editingZone?.city || !editingZone?.radius) {
      showToast({message: 'Please fill all required fields', type: 'error'});
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...editingZone,
        center: {
          type: 'Point',
          coordinates: [Number(editingZone.center?.coordinates[0]), Number(editingZone.center?.coordinates[1])]
        },
        radius: Number(editingZone.radius)
      };

      if (editingZone._id) {
        await axiosInstance.put(`/api/zones/${editingZone._id}`, payload);
      } else {
        await axiosInstance.post('/api/zones', payload);
      }
      
      showToast({message: `Zone ${editingZone._id ? 'updated' : 'created'} successfully`, type: 'success'});
      setModalVisible(false);
      fetchZones();
    } catch (error: any) {
      showToast({message: error.response?.data?.message || 'Failed to save zone', type: 'error'});
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Zone', 'Are you sure you want to delete this operational zone?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await axiosInstance.delete(`/api/zones/${id}`);
            showToast({message: 'Zone deleted', type: 'success'});
            fetchZones();
          } catch (error) {
            showToast({message: 'Delete failed', type: 'error'});
          }
        },
      },
    ]);
  };

  const renderZone = ({item}: {item: IServiceZone}) => (
    <View style={styles.zoneCard}>
      <View style={styles.zoneHeader}>
        <View>
          <Text style={styles.zoneName}>{item.name}</Text>
          <Text style={styles.zoneCity}>{item.city}</Text>
        </View>
        <Switch
          value={item.isActive}
          onValueChange={async (val) => {
            await axiosInstance.put(`/api/zones/${item._id}`, {isActive: val});
            fetchZones();
          }}
          trackColor={{false: '#D1D5DB', true: theme.colors.primary + '80'}}
          thumbColor={item.isActive ? theme.colors.primary : '#9CA3AF'}
        />
      </View>

      <View style={styles.zoneStats}>
        <View style={styles.statItem}>
          <Icon name="radio-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.statText}>{item.radius} KM Radius</Text>
        </View>
        <View style={styles.statItem}>
          <Icon name="location-outline" size={16} color={theme.colors.muted} />
          <Text style={styles.statText} numberOfLines={1}>
            {item.center.coordinates[1].toFixed(4)}, {item.center.coordinates[0].toFixed(4)}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.actionBtn} 
          onPress={() => {
            setEditingZone(item);
            setModalVisible(true);
          }}>
          <Icon name="create-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item._id.toString())}>
          <Icon name="trash-outline" size={20} color="#EF4444" />
          <Text style={[styles.actionText, {color: '#EF4444'}]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Operational Zones</Text>
          <Text style={styles.subtitle}>Geofencing & Serviceability Control</Text>
        </View>
        <TouchableOpacity 
          style={styles.addBtn}
          onPress={() => {
            setEditingZone({
              name: '',
              city: 'Bengaluru',
              radius: 5,
              isActive: true,
              center: {type: 'Point', coordinates: [77.5946, 12.9716]} // Default Bangalore center
            });
            setModalVisible(true);
          }}>
          <Icon name="add" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={zones}
        keyExtractor={item => item._id.toString()}
        renderItem={renderZone}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="map-outline" size={64} color={theme.colors.muted} />
            <Text style={styles.emptyText}>No service zones defined yet</Text>
          </View>
        }
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingZone?._id ? 'Edit Zone' : 'Add New Zone'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Zone Name (e.g. Koramangala Hub)</Text>
              <TextInput
                style={styles.input}
                value={editingZone?.name}
                onChangeText={text => setEditingZone(prev => ({...prev!, name: text}))}
                placeholder="Enter zone name"
              />

              <Text style={styles.label}>City</Text>
              <TextInput
                style={styles.input}
                value={editingZone?.city}
                onChangeText={text => setEditingZone(prev => ({...prev!, city: text}))}
                placeholder="Bengaluru"
              />

              <Text style={styles.label}>Service Radius (KM)</Text>
              <TextInput
                style={styles.input}
                value={String(editingZone?.radius || '')}
                onChangeText={text => setEditingZone(prev => ({...prev!, radius: Number(text)}))}
                placeholder="5"
                keyboardType="numeric"
              />

              <View style={styles.coordRow}>
                <View style={{flex: 1, marginRight: 8}}>
                  <Text style={styles.label}>Center Latitude</Text>
                  <TextInput
                    style={styles.input}
                    value={String(editingZone?.center?.coordinates[1] || '')}
                    onChangeText={text => setEditingZone(prev => {
                      const coords = [...(prev?.center?.coordinates || [0,0])] as [number, number];
                      coords[1] = Number(text);
                      return {...prev!, center: {type: 'Point', coordinates: coords}};
                    })}
                    placeholder="12.9716"
                    keyboardType="numeric"
                  />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.label}>Center Longitude</Text>
                  <TextInput
                    style={styles.input}
                    value={String(editingZone?.center?.coordinates[0] || '')}
                    onChangeText={text => setEditingZone(prev => {
                      const coords = [...(prev?.center?.coordinates || [0,0])] as [number, number];
                      coords[0] = Number(text);
                      return {...prev!, center: {type: 'Point', coordinates: coords}};
                    })}
                    placeholder="77.5946"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.infoText}>
                Tip: You can get Lat/Lng for any area from free tools like LatLong.net or OpenStreetMap.
              </Text>

              <Button 
                title="Save Operational Zone" 
                onPress={handleSave} 
                loading={loading}
                style={{marginTop: 20}}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {loading && !modalVisible && <Loader fullScreen />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F9FAFB'},
  header: {
    padding: 24,
    backgroundColor: theme.colors.white,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  title: {fontSize: 24, fontWeight: '900', color: theme.colors.text},
  subtitle: {fontSize: 13, color: theme.colors.muted, marginTop: 4, fontWeight: '600'},
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: theme.colors.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  list: {padding: 16},
  zoneCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...theme.shadow.sm,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  zoneHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16},
  zoneName: {fontSize: 18, fontWeight: '800', color: theme.colors.text},
  zoneCity: {fontSize: 12, color: theme.colors.muted, fontWeight: '600', marginTop: 2},
  zoneStats: {flexDirection: 'row', gap: 16, marginBottom: 20},
  statItem: {flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8},
  statText: {fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary},
  actions: {flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 16, gap: 20},
  actionBtn: {flexDirection: 'row', alignItems: 'center', gap: 6},
  actionText: {fontSize: 13, fontWeight: '700', color: theme.colors.primary},
  empty: {flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100},
  emptyText: {fontSize: 15, color: theme.colors.muted, marginTop: 16, fontWeight: '600'},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'},
  modalContent: {backgroundColor: theme.colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '80%'},
  modalHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24},
  modalTitle: {fontSize: 20, fontWeight: '900', color: theme.colors.text},
  modalBody: {marginBottom: 20},
  label: {fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 8, marginTop: 16},
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  coordRow: {flexDirection: 'row', marginTop: 4},
  infoText: {fontSize: 11, color: theme.colors.muted, marginTop: 12, lineHeight: 16, fontWeight: '500'},
});
