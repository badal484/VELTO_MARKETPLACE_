import React from 'react';
import {View, Text, StyleSheet, Dimensions} from 'react-native';
import {theme} from '../../theme';
import {Card} from '../common/Card';
import Animated, {FadeInDown} from 'react-native-reanimated';

const {width} = Dimensions.get('window');

interface AnalyticsData {
  _id: string;
  amount: number;
  count: number;
}

interface AdminAnalyticsCardProps {
  title: string;
  data: AnalyticsData[];
  type: 'daily' | 'monthly';
}

export const AdminAnalyticsCard: React.FC<AdminAnalyticsCardProps> = ({
  title,
  data,
}) => {
  const maxAmount = Math.max(...data.map(d => d.amount), 1);
  
  // Take last 7 items for display
  const displayData = data.slice(-7);

  return (
    <Card style={styles.container} variant="elevated">
      <Text style={styles.title}>{title}</Text>
      
      <View style={styles.chartContainer}>
        {displayData.map((item, index) => {
          const barHeight = (item.amount / maxAmount) * 100;
          const label = item._id.split('-').pop(); // Show last part of date

          return (
            <View key={item._id} style={styles.barWrapper}>
              <View style={styles.barTrack}>
                <Animated.View
                  entering={FadeInDown.delay(index * 100).duration(800)}
                  style={[
                    styles.barFill,
                    {height: `${Math.max(barHeight, 5)}%`},
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{label}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Text style={styles.footerValue}>
            ₹{data.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
          </Text>
          <Text style={styles.footerLabel}>Total Revenue</Text>
        </View>
        <View style={[styles.footerItem, {alignItems: 'flex-end'}]}>
          <Text style={styles.footerValue}>
            {data.reduce((acc, curr) => acc + curr.count, 0)}
          </Text>
          <Text style={styles.footerLabel}>Total Orders</Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 24,
    backgroundColor: theme.colors.white,
    marginTop: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 24,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    marginBottom: 20,
  },
  barWrapper: {
    alignItems: 'center',
    width: (width - 120) / 7,
  },
  barTrack: {
    width: 8,
    height: '100%',
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  barLabel: {
    fontSize: 10,
    color: theme.colors.muted,
    marginTop: 8,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
  },
  footerItem: {},
  footerValue: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.text,
  },
  footerLabel: {
    fontSize: 10,
    color: theme.colors.muted,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
});
