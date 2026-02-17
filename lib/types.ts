export type RangePreset = 'MTD' | 'QTD' | 'YTD' | 'PREV_MONTH' | 'CUSTOM';

export type RosterEntry = {
  advisor: string;
  unit?: string;
  spaLeg?: string;
  program?: string;
  paDate?: Date | null;
  tenure?: string;
  monthsCmp2025?: number;
};

export type SpartanAnimalsItem = {
  advisor: string;
  cases: number;
  isAnimal: boolean;
};

export type ProductSaleItem = {
  advisor: string;
  product: string;
  fyc: number;
  policyNumber?: string;
  monthApproved?: string;
};

export type SalesRoundupItem = {
  advisor: string;
  product: string;
  afyc: number;
  // Classification from roster (used for Sales Round-up filtering)
  spaLeg?: string;
  policyNumber?: string;
  monthApproved?: string;
};

export type PpbTrackerRow = {
  advisor: string;
  // Classification from the roster (used for PPB-only filtering)
  spaLeg?: string;
  fyc: number;
  cases: number;
  m1Cases: number;
  m2Cases: number;
  m3Cases: number;
  // Rates
  ppbRate: number; // FYC Bonus Rate
  ccbRate: number | null; // Case Count Bonus Rate (null if not applicable)
  totalBonusRate: number; // ppbRate + (ccbRate ?? 0)

  projectedBonus: number | null;

  // Next tier guidance
  fycToNextBonusTier: number | null;
  nextPpbRate: number | null;
  casesToNextCcbTier: number | null;
  nextCcbRate: number | null;
};

export type PpbTracker = {
  quarter: string; // e.g. "Q1 2026"
  months: [string, string, string]; // e.g. ["Jan","Feb","Mar"]
  rows: PpbTrackerRow[];
};

// DPR Log (monthly performance totals)
export type DprRow = {
  monthKey: string; // YYYY-MM
  advisor: string;
  fyc: number;
  anp: number;
  fyp: number;
  pers: number | null;
};

export type SalesRow = {
  monthApproved?: string;
  policyNumber?: string;
  advisor?: string;
  // Legacy column: will be removed from the sheet soon.
  // We keep it optional for backward compatibility but the dashboard no longer uses it.
  unitManager?: string;
  policyOwner?: string;
  product?: string;
  anp?: number;
  fyp?: number;
  fyc?: number;
  mode?: string;
  mdrtFyp?: number;
  afyc?: number;
  caseCount?: number;
  faceAmount?: number;
  dateSubmitted?: Date | null;
  datePaid?: Date | null;
  dateApproved?: Date | null;
  remarks?: string;
};

export type MoneyKpis = {
  anp: number;
  fyp: number;
  fyc: number;
  afyc: number;
  mdrtFyp: number;
  caseCount: number;
  faceAmount: number;
};

export type AdvisorStatus = {
  advisor: string;
  unit?: string;
  approved: MoneyKpis;
  submitted: MoneyKpis;
  paid: MoneyKpis;
  // "Open" = Submitted/Paid activity that has no approval proof yet
  // (Month Approved and Date Approved are both blank). Used to drive the Pending list.
  open: MoneyKpis;
  // classification will be derived server-side
};

export type ApiResponse = {
  generatedAt: string;
  filters: {
    preset: RangePreset;
    start: string;
    end: string;
    unit: string;
    advisor: string;
  };
  options: {
    units: string[];
    advisors: string[];
  };
  team: {
    approved: MoneyKpis;
    submitted: MoneyKpis;
    paid: MoneyKpis;
  };
  producingAdvisors: {
    producing: AdvisorStatus[];
    pending: AdvisorStatus[];
    nonProducing: AdvisorStatus[];
  };
  leaderboards: {
    advisorsByFYC: Array<{ advisor: string; value: number }>;
    advisorsByFYP: Array<{ advisor: string; value: number }>;
    unitsByFYC: Array<{ unit: string; value: number }>;
    unitsByFYP: Array<{ unit: string; value: number }>;
  };
  trends: {
    approvedByDay: Array<{ date: string; fyc: number; fyp: number; cases: number }>;
  };

  // Spartan monitoring panels (range-aware)
  spartanMonitoring?: {
    totalSpartans: number;
    producingSpartans: number;
    activityRatio: number; // producing/total
    animals: SpartanAnimalsItem[]; // 2+ cases, desc
    totals: {
      approvedFyc: number;
      approvedCases: number;
      avgFycPerCase: number;
    };
  };

  // Special lookouts
  specialLookouts?: {
    productSellers: {
      aPlusSignature: ProductSaleItem[];
      ascend: ProductSaleItem[];
      futureSafeUsd5Pay: ProductSaleItem[];
    };
    consistentMonthlyProducers: {
      asOfMonth: string; // YYYY-MM ending at the selected range end
      threePlus: Array<{ advisor: string; streakMonths: number }>;
      watch2: Array<{ advisor: string; streakMonths: number }>;
      watch1: Array<{ advisor: string; streakMonths: number }>;
    };
    salesRoundup?: SalesRoundupItem[];
  };

  // PPB tracker (quarter snapshot based on selected range end)
  ppbTracker?: PpbTracker;

  // Monthly Excellence Awards Badges (current month only; resets monthly)
  monthlyExcellenceBadges?: {
    asOfMonth: string; // e.g. "Feb 2026" (month that contains selected range end)
    premiums: {
      achieved: Array<{ advisor: string; spaLeg?: string; tier: 'Silver' | 'Gold' | 'Diamond' | 'Master'; value: number }>;
      close: Array<{ advisor: string; spaLeg?: string; targetTier: 'Silver' | 'Gold' | 'Diamond' | 'Master'; remaining: number; value: number }>;
    };
    savedLives: {
      achieved: Array<{ advisor: string; spaLeg?: string; tier: 'Silver' | 'Gold' | 'Diamond' | 'Master'; value: number }>;
      close: Array<{ advisor: string; spaLeg?: string; targetTier: 'Silver' | 'Gold' | 'Diamond' | 'Master'; remaining: number; value: number }>;
    };
    income: {
      achieved: Array<{ advisor: string; spaLeg?: string; tier: 'Silver' | 'Gold' | 'Diamond' | 'Master'; value: number }>;
      close: Array<{ advisor: string; spaLeg?: string; targetTier: 'Silver' | 'Gold' | 'Diamond' | 'Master'; remaining: number; value: number }>;
    };
  };
  advisorDetail?: {
    advisor: string;
    approved: MoneyKpis;
    submitted: MoneyKpis;
    paid: MoneyKpis;
    productMix: Array<{ product: string; fyc: number; cases: number }>;
    approvedByDay: Array<{ date: string; fyc: number; fyp: number; cases: number }>;
  };
};
