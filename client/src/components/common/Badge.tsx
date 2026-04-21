import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {theme} from '../../theme';

interface BadgeProps {
  label: string;
  type?: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'accent';
}

export const Badge: React.FC<BadgeProps> = ({label, type = 'info'}) => {
  const getStyles = () => {
    switch (type) {
      case 'success':
        return {bg: '#ECFDF5', text: '#059669'};
      case 'warning':
        return {bg: '#FFFBEB', text: '#D97706'};
      case 'danger':
        return {bg: '#FEF2F2', text: '#DC2626'};
      case 'primary':
        return {bg: theme.colors.primary + '15', text: theme.colors.primary};
      case 'accent':
        return {bg: theme.colors.accent + '15', text: theme.colors.accent};
      default:
        return {bg: '#F3F4F6', text: '#4B5563'};
    }
  };

  const colors = getStyles();

  return (
    <View style={[styles.container, {backgroundColor: colors.bg}]}>
      <Text style={[styles.text, {color: colors.text}]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
