export type UserRole = 'admin' | 'organizer' | 'participant' | 'viewer' | 'developer';

export type Currency = 'USD' | 'BRL';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'family' | 'pro' | 'enterprise';
  created_at: string;
}

export interface Trip {
  id: string;
  tenant_id: string;
  title: string;
  destination_main: string;
  start_date: string;
  end_date: string;
  cover_image?: string;
  currency_base: Currency;
  status: 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface Participant {
  id: string;
  trip_id: string;
  full_name: string;
  nickname?: string;
  birth_date: string;
  age: number;
  is_minor: boolean;
  relationship: string;
  responsible_participant_id?: string;
  passport_number?: string;
  passport_expiry?: string;
  visa_status?: 'valid' | 'pending' | 'exempt' | 'expired';
  dietary_restrictions?: string[];
  height_cm?: number;
  notes?: string;
  budget_limit_usd: number;
  avatar_color: string;
}

export interface Flight {
  id: string;
  trip_id: string;
  airline: string;
  flight_number: string;
  loyalty_program?: string;
  origin_airport: string;
  destination_airport: string;
  departure_time: string;
  arrival_time: string;
  terminal?: string;
  booking_code: string;
  class_type: 'economy' | 'premium_economy' | 'business' | 'first';
  passenger_ids: string[];
  seats?: Record<string, string>;
  price_cash?: number;
  price_points?: number;
  taxes_amount?: number;
  currency: Currency;
  status: 'booked' | 'confirmed' | 'changed' | 'cancelled';
  file_url?: string;
  notes?: string;
}

export interface Accommodation {
  id: string;
  trip_id: string;
  name: string;
  chain?: string;
  address: string;
  city: string;
  check_in: string;
  check_out: string;
  check_in_time?: string;
  check_out_time?: string;
  confirmation_code?: string;
  guest_ids: string[];
  room_type?: string;
  price_total: number;
  resort_fee_per_night?: number;
  parking_fee_per_night?: number;
  is_breakfast_included: boolean;
  currency: Currency;
  status: 'confirmed' | 'planning' | 'replaced' | 'cancelled';
  replacement_reason?: string;
  linked_decision_id?: string;
  file_url?: string;
  distance_to_airport_km?: number;
  notes?: string;
}

export interface TransportReservation {
  id: string;
  trip_id: string;
  type: 'rental_car' | 'uber' | 'transfer' | 'hotel_shuttle' | 'train' | 'flight' | 'other';
  provider_company: string;
  category_or_model?: string;
  primary_driver_id?: string;
  additional_driver_ids?: string[];
  pickup_location: string;
  pickup_time: string;
  dropoff_location: string;
  dropoff_time: string;
  confirmation_code?: string;
  price_total: number;
  currency: Currency;
  status: 'reserved' | 'active' | 'completed' | 'cancelled';
  requires_followup_transport: boolean;
  notes?: string;
}

export interface ItineraryItem {
  id: string;
  trip_id: string;
  date: string;
  time_start: string;
  time_end?: string;
  city: string;
  title: string;
  category: 'flight' | 'hotel' | 'park' | 'restaurant' | 'shopping' | 'tour' | 'rest' | 'transit' | 'event';
  description?: string;
  location?: string;
  participant_ids: string[];
  estimated_cost?: number;
  currency?: Currency;
  payment_method_id?: string;
  status: 'planned' | 'confirmed' | 'optional' | 'completed' | 'cancelled';
  min_height_cm?: number;
  min_age_years?: number;
  child_friendly: boolean;
  notes?: string;
}

export interface GiftCard {
  id: string;
  trip_id: string;
  store_brand: string;
  nominal_value: number;
  paid_amount: number;
  cashback_pct: number;
  cashback_amount: number;
  net_cost: number;
  effective_savings: number;
  effective_savings_pct: number;
  currency: Currency;
  purchased_by_id: string;
  beneficiary_id?: string;
  card_code_masked: string;
  current_balance: number;
  expiry_date?: string;
  status: 'active' | 'used' | 'expired';
  purchase_date: string;
  notes?: string;
}

export interface PurchaseItem {
  id: string;
  trip_id: string;
  product_name: string;
  category: 'electronics' | 'clothing' | 'footwear' | 'kids' | 'cosmetics' | 'gifts' | 'collectibles' | 'personal' | 'resale';
  brand?: string;
  store_name?: string;
  target_participant_id: string;
  beneficiary_id?: string;
  priority: 'high' | 'medium' | 'low';
  quantity: number;
  target_price_usd: number;
  price_found_usd?: number;
  brl_equivalent_price?: number;
  estimated_savings_pct?: number;
  gift_card_eligible: boolean;
  status: 'planned' | 'bought' | 'online_ordered' | 'delivered_hotel' | 'cancelled';
  delivery_location?: string;
  link_url?: string;
  notes?: string;
}

export interface Luggage {
  id: string;
  trip_id: string;
  participant_id: string;
  type: 'checked' | 'carry_on' | 'personal_item';
  bag_identifier: string;
  max_weight_kg: number;
  current_weight_kg?: number;
  description?: string;
  shopping_space_reserved_pct?: number;
}

export interface Expense {
  id: string;
  trip_id: string;
  description: string;
  amount: number;
  currency: Currency;
  amount_usd: number;
  amount_brl: number;
  exchange_rate: number;
  category: 'accommodation' | 'flight' | 'transport' | 'food' | 'shopping' | 'tickets' | 'services' | 'other';
  paid_by_id: string;
  beneficiary_ids: string[];
  gift_card_id?: string;
  payment_method_id?: string;
  date: string;
  status: 'paid' | 'pending' | 'reimbursed';
}

export interface Task {
  id: string;
  trip_id: string;
  title: string;
  description?: string;
  assigned_to_id?: string;
  due_date?: string;
  priority: 'high' | 'medium' | 'low';
  category: 'logistics' | 'finance' | 'tickets' | 'documents' | 'shopping' | 'general';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
}

export interface Decision {
  id: string;
  trip_id: string;
  topic: string;
  alternatives_considered: string[];
  chosen_decision: string;
  reason: string;
  decided_by_id: string;
  date: string;
  financial_impact_usd?: number;
  is_active: boolean;
}

export interface AuditFinding {
  id: string;
  code: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'logistics' | 'financial' | 'child_safety' | 'documents' | 'luggage';
  title: string;
  description: string;
  affected_entities: string[];
  recommendation: string;
  resolved: boolean;
}

export interface AiProviderConfig {
  id: string;
  provider: 'openai' | 'gemini' | 'anthropic' | 'deepseek' | 'groq' | 'ollama' | 'openrouter';
  model_name: string;
  is_active: boolean;
  is_default: boolean;
  daily_token_limit: number;
  monthly_budget_usd: number;
  temperature: number;
}

export interface AiUsageLog {
  id: string;
  timestamp: string;
  user_name: string;
  function_name: string;
  provider: string;
  model: string;
  tokens_input: number;
  tokens_output: number;
  estimated_cost_usd: number;
}

export interface LoyaltyAccount {
  id: string;
  trip_id: string;
  program_name: string;
  holder_id: string;
  balance_points: number;
  cpm_usd: number;
  cash_equivalent_usd: number;
  notes?: string;
}

export interface DocumentFile {
  id: string;
  trip_id: string;
  title: string;
  category: 'flight' | 'hotel' | 'car' | 'ticket' | 'insurance' | 'personal';
  file_url: string;
  linked_entity_type?: 'participant' | 'flight' | 'accommodation' | 'transport';
  linked_entity_id?: string;
  uploaded_at: string;
  file_size?: string;
  notes?: string;
}

