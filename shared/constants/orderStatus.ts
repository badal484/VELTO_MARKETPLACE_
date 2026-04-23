import { OrderStatus } from '../types';

export const getStatusDisplay = (status: OrderStatus) => {
  switch (status) {
    case OrderStatus.PENDING:
      return { label: 'Pending', color: '#FBBF24' }; // warning
    case OrderStatus.PAYMENT_UNDER_REVIEW:
      return { label: 'Reviewing Payment', color: '#3B82F6' }; // info
    case OrderStatus.CONFIRMED:
      return { label: 'Confirmed', color: '#10B981' }; // success
    case OrderStatus.READY_FOR_PICKUP:
      return { label: 'Ready for Pickup', color: '#F59E0B' }; // accent
    case OrderStatus.SEARCHING_RIDER:
      return { label: 'Searching Rider', color: '#94A3B8' }; // muted
    case OrderStatus.RIDER_ASSIGNED:
      return { label: 'Rider Assigned', color: '#3B82F6' }; // info
    case OrderStatus.AT_SHOP:
      return { label: 'At Shop', color: '#3B82F6' }; // info
    case OrderStatus.PICKED_UP:
      return { label: 'Picked Up', color: '#0F172A' }; // primary
    case OrderStatus.IN_TRANSIT:
      return { label: 'Out for Delivery', color: '#0F172A' }; // primary
    case OrderStatus.DELIVERED:
      return { label: 'Delivered', color: '#10B981' }; // success
    case OrderStatus.COMPLETED_PENDING_RELEASE:
      return { label: 'Funds Pending', color: '#10B981' }; // success
    case OrderStatus.COMPLETED:
      return { label: 'Completed', color: '#10B981' }; // success
    case OrderStatus.CANCELLED:
      return { label: 'Cancelled', color: '#EF4444' }; // danger
    case OrderStatus.PRICE_LOCKED:
      return { label: 'Price Locked', color: '#94A3B8' }; // muted
  }
};

/**
 * Statuses that represent an active delivery in progress
 */
export const ACTIVE_DELIVERY_STATUSES: OrderStatus[] = [
  OrderStatus.RIDER_ASSIGNED,
  OrderStatus.AT_SHOP,
  OrderStatus.PICKED_UP,
  OrderStatus.IN_TRANSIT,
];

/**
 * Statuses that represent a finished or completed delivery
 */
export const FINISHED_DELIVERY_STATUSES: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED_PENDING_RELEASE,
  OrderStatus.COMPLETED,
];
