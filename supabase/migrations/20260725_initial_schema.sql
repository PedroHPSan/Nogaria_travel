-- Database Schema for Intelligent Travel Management Platform (SaaS Multi-tenant)
-- Initial Version: 2026-07-25

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants (Organizations / Families)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  plan VARCHAR(50) DEFAULT 'family',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant Memberships & Roles
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role VARCHAR(50) CHECK (role IN ('admin', 'organizer', 'participant', 'viewer', 'developer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- Trips
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  destination_main VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  cover_image TEXT,
  currency_base VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'planning' CHECK (status IN ('planning', 'confirmed', 'in_progress', 'completed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Participants
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  nickname VARCHAR(100),
  birth_date DATE NOT NULL,
  is_minor BOOLEAN DEFAULT FALSE,
  relationship VARCHAR(100),
  responsible_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  passport_number VARCHAR(100),
  passport_expiry DATE,
  visa_status VARCHAR(50) DEFAULT 'valid',
  dietary_restrictions TEXT[],
  height_cm INT,
  notes TEXT,
  budget_limit_usd NUMERIC(12,2) DEFAULT 0.00,
  avatar_color VARCHAR(50) DEFAULT 'bg-blue-500',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gift Cards (Financial Module)
CREATE TABLE IF NOT EXISTS gift_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  store_brand VARCHAR(100) NOT NULL,
  nominal_value NUMERIC(12,2) NOT NULL,
  paid_amount NUMERIC(12,2) NOT NULL,
  cashback_pct NUMERIC(5,2) DEFAULT 0.00,
  cashback_amount NUMERIC(12,2) GENERATED ALWAYS AS (paid_amount * (cashback_pct / 100)) STORED,
  net_cost NUMERIC(12,2) GENERATED ALWAYS AS (paid_amount - (paid_amount * (cashback_pct / 100))) STORED,
  currency VARCHAR(3) DEFAULT 'USD',
  purchased_by_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  beneficiary_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  card_code_masked VARCHAR(100) NOT NULL,
  current_balance NUMERIC(12,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
  purchase_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Security Policies
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_trips ON trips
  FOR ALL USING (tenant_id IN (
    SELECT tenant_id FROM memberships WHERE user_id = auth.uid()
  ));

CREATE POLICY tenant_isolation_participants ON participants
  FOR ALL USING (trip_id IN (
    SELECT id FROM trips WHERE tenant_id IN (
      SELECT tenant_id FROM memberships WHERE user_id = auth.uid()
    )
  ));
