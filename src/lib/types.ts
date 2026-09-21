// Row shapes for the Pitch Money views / RPCs (supabase/migrations/20260921_pitch_money_v1.sql)

export interface VehicleFinancials {
  vehicle_id: string;
  dealership_id: string;
  registration: string | null;
  make: string | null;
  model: string | null;
  derivative: string | null;
  stock_id: string | null;
  status: string;
  colour: string | null;
  mileage: number | null;
  is_sale_or_return: boolean;
  is_sold: boolean;
  missing_purchase_price: boolean;
  in_stock_date: string | null;
  sold_date: string | null;
  days_in_stock: number;
  purchase_price: number;
  advertised_price: number;
  sale_price: number | null;
  margin_scheme: string;
  vat_active: boolean;
  sor_fee: number;
  sor_fee_net: number;
  total_costs: number;
  cost_count: number;
  last_cost_date: string | null;
  unpaid_costs: number;
  input_vat: number;
  extra_income: number;
  deposit_held: number;
  stand_in_cost: number;
  output_vat: number;
  realised_profit: number | null;
  projected_profit: number | null;
  stock_value: number | null;
  capital_tied_up: number | null;
  deal_id: string | null;
  customer_name: string | null;
}

export interface CostLine {
  cost_id: string;
  vehicle_id: string;
  dealership_id: string;
  registration: string | null;
  make: string | null;
  model: string | null;
  stock_id: string | null;
  cost_date: string;
  cost_type: string;
  cost_type_other: string | null;
  amount: number;
  vat_type: string | null;
  supplier: string | null;
  description: string | null;
  invoice_url: string | null;
  payment_status: string | null;
  due_date: string | null;
  paid_date: string | null;
  created_at: string;
  updated_at: string | null;
  expense_id: string | null;
  created_by_user_id: string | null;
  created_by_name: string | null;
  vat_amount: number;
}

export interface ActivityItem {
  kind: 'cost' | 'sale' | 'overhead' | 'stock_in';
  ref_id: string;
  vehicle_id: string | null;
  registration: string | null;
  make: string | null;
  model: string | null;
  amount: number | null;
  label: string | null;
  detail: string | null;
  actor: string | null;
  at: string;
  dealership_id: string;
}

export interface LabelAmount { label: string; amount: number }

export interface Dashboard {
  dealership_id: string;
  stock: {
    vehicles_in_stock: number; stock_value: number; capital_tied_up: number; unrealised_profit: number;
    unpaid_costs: number; deposits_held: number; avg_days_in_stock: number; aged_over_60: number;
  };
  realised: {
    last_30: number; last_90: number; ytd: number; all_time: number;
    sold_30: number; sold_90: number; sold_ytd: number; output_vat_90: number;
  };
  cash: { balance: number; accounts: { name: string; balance: number; anchored_on: string | null }[] };
  balance_sheet: { debtors: number; other_liabilities: number; corp_tax_provision: number; parts_30: number; mech_30: number };
  net_position: number;
  where_money_went: {
    costs_by_type: LabelAmount[];
    overheads_by_category: LabelAmount[];
    top_capital_vehicles: { vehicle_id: string; registration: string; make: string; model: string; capital_tied_up: number; days_in_stock: number }[];
    purchases_90: number;
  };
  generated_at: string;
}

export interface PeriodSummary {
  start: string; end: string; dealership_id: string;
  sold: {
    vehicles_sold: number; revenue: number; purchase_cost: number; direct_costs: number; extra_income: number;
    output_vat: number; realised_profit: number; missing_purchase_price: number; avg_days_in_stock: number;
    vehicles: { vehicle_id: string; registration: string; make: string; model: string; sold_date: string; sale_price: number;
      purchase_price: number; total_costs: number; output_vat: number; realised_profit: number | null; days_in_stock: number }[];
  };
  overheads: { total: number; by_category: { category: string; amount: number }[] };
  costs_in_period: number;
  costs_by_type: LabelAmount[];
  net_profit: number;
  vat: { output: number; input: number; net_due: number };
  corporation_tax: { rate: number; taxable: number; estimate: number };
}

export interface TaxAssumptions {
  dealership_id: string;
  corp_tax_rate: number;
  vat_rate: number;
  vat_quarter_start: string | null;
  notes: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  at?: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  dealership_id: string;
  title: string | null;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export const COST_TYPES = ['parts', 'mechanic', 'fuel', 'collections', 'advertising', 'MOT', 'warranty', 'auction fee', 'other'] as const;
export const VAT_TYPES = [
  { value: 'included', label: 'VAT included (20%)' },
  { value: 'excluded', label: 'VAT excluded (add 20%)' },
  { value: 'none', label: 'No VAT' },
] as const;
