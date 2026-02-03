export type RangePreset = 'MTD' | 'QTD' | 'YTD' | 'CUSTOM';

export type SalesRow = {
  monthApproved?: string;
  policyNumber?: string;
  advisor?: string;
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
  unitManager?: string;
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
  advisorDetail?: {
    advisor: string;
    approved: MoneyKpis;
    submitted: MoneyKpis;
    paid: MoneyKpis;
    productMix: Array<{ product: string; fyc: number; cases: number }>;
    approvedByDay: Array<{ date: string; fyc: number; fyp: number; cases: number }>;
  };
};
