import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {locationService, LocationResult} from '../../services/locationService';
import {theme} from '../../theme';
import Icon from 'react-native-vector-icons/Ionicons';

interface LocationSearchProps {
  onSelect: (location: LocationResult) => void;
  placeholder?: string;
  initialValue?: string;
}

export const LocationSearch: React.FC<LocationSearchProps> = ({
  onSelect,
  placeholder = 'Search for address in Karnataka...',
  initialValue = '',
}) => {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (initialValue) {
      setQuery(initialValue);
    }
  }, [initialValue]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 3) {
        setLoading(true);
        const data = await locationService.searchLocations(query);
        setResults(data);
        setShowDropdown(data.length > 0);
        setLoading(false);
      } else {
        setResults([]);
        setShowDropdown(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (item: LocationResult) => {
    setQuery(item.formatted);
    setShowDropdown(false);
    onSelect(item);
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <Icon
          name="location-outline"
          size={20}
          color={theme.colors.secondary}
          style={styles.icon}
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={query}
          onChangeText={setQuery}
          placeholderTextColor={theme.colors.textSecondary}
        />
        {loading && (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        )}
      </View>

      {showDropdown && (
        <View style={styles.dropdown}>
          {results.map((item) => (
            <TouchableOpacity
              key={item.place_id}
              style={styles.resultItem}
              onPress={() => handleSelect(item)}>
              <Icon
                name="pin-outline"
                size={16}
                color={theme.colors.primary}
              />
              <Text style={styles.resultText} numberOfLines={2}>
                {item.formatted}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    zIndex: 1000,
    marginBottom: theme.spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    height: 50,
  },
  icon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
  },
  dropdown: {
    position: 'absolute',
    top: 55,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius.md,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background,
  },
  resultText: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
  },
});