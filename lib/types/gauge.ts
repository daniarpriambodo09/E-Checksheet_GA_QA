// lib/types/gauge.ts

export interface GaugeCheckpoint {
  id: string;
  gauge_type: string;
  checkpoint_name: string;
  checkpoint_order: number;
  is_required: boolean;
  is_active: boolean;
}

export interface CheckpointResult {
  checkpointId: string;
  checkpointName: string;
  status: "-" | "OK" | "NG";
  notes?: string;
}

export interface GaugeWithCheckpoints {
  id: string;
  gauge_code: string;
  gauge_type: string;
  gauge_name: string;
  calibration_due: string;
  is_active: boolean;
  checkpoints: GaugeCheckpoint[];
}