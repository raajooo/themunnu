export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  description: string;
  images: string[];
  sizes: string[];
  stock: number;
  category: string;
  isLimited?: boolean;
  isTrending?: boolean;
  isFeatured?: boolean;
  averageRating?: number;
  reviewCount?: number;
  createdAt: string;
}

export interface User {
  uid: string;
  phoneNumber: string;
  displayName?: string;
  email?: string;
  addresses: Address[];
  role: 'user' | 'admin';
  createdAt: string;
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  pincode: string;
  address: string;
  city: string;
  state: string;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  discountAmount?: number;
  couponCode?: string;
  paymentMethod: 'razorpay' | 'cod';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  orderStatus: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  address: Address;
  trackingId?: string;
  deliveryEstimate?: string;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  isActive: boolean;
  usageCount: number;
  totalDiscountGenerated: number;
  expiryDate?: string;
  createdAt: string;
}

export interface Settings {
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  fast2smsApiKey?: string;
  delhiveryApiKey?: string;
  isCodEnabled: boolean;
  isCouponSystemEnabled: boolean;
  supportEmail: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  size: string;
  image: string;
}

export interface Banner {
  id: string;
  imageUrl: string;
  link: string;
  title: string;
  subtitle?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  createdAt: string;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}
