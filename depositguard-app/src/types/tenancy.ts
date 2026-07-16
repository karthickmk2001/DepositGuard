export type TenancyStatus =
  | "AwaitingInspection"
  | "AwaitingDeposit"
  | "Active"
  | "MoveOutProposed"
  | "Disputed"
  | "Arbitration"
  | "Completed"
  | "AutoReleased"
  | "Cancelled";

export type InspectionTier = 0 | 1; // 0 = standard (no inspector), 1 = inspector verified

export interface Tenancy {
  id: string;
  landlord: string;       // wallet pubkey
  tenant?: string;
  inspector?: string;
  property_address: string;
  deposit_amount: number; // in SOL
  lease_start: string;    // ISO date
  lease_end: string;
  move_in_hash?: string;
  move_out_hash?: string;
  inspector_move_in_hash?: string;
  inspector_move_out_hash?: string;
  status: TenancyStatus;
  proposed_landlord_amt?: number;
  proposed_tenant_amt?: number;
  landlord_agreed: boolean;
  tenant_agreed: boolean;
  arbitrator?: string;
  inspection_tier: InspectionTier;
  created_at: string;
  // Photo URLs stored in Supabase
  move_in_photos?: string[];
  move_out_photos?: string[];
  // On-chain references
  tx_signature?: string;
  deposit_tx_signature?: string;
  // Inspection data (JSON blob from inspector)
  inspection_data?: string;
  // Arbitration
  arbitration_reasoning?: string;
}

export interface InspectionRoom {
  name: string;
  photos: File[];
  photoHashes: string[];
  condition: string;
  preExistingDamage: string;
  gps?: { lat: number; lng: number };
  timestamp?: string;
}

export interface InspectionReport {
  tenancy_id: string;
  inspector_wallet: string;
  property_address: string;
  gps?: { lat: number; lng: number };
  timestamp: string;
  rooms: InspectionRoom[];
  overall_rating: number;
  combined_hash: string;
  inspector_signature?: string;
}
