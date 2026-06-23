export interface PalletConfig {
  length: number; // in mm
  width: number;  // in mm
  height: number; // in mm (max height limit)
  maxWeight: number; // in kg
  defaultGap: number; // in mm (gap between cartons)
  interlockType: "pinwheel" | "alternating" | "pure-layer" | "boundary-prefer";
  packSequence?: "weight-desc" | "vol-desc" | "fifo"; // "fifo" keeps positions fixed and sequence stable; "vol-desc" aligns with standard 3d-bpp volume sorting
  checkCGSupport?: boolean; // toggleable physical Center-of-Gravity (CG) support check
  baseType?: "pallet" | "carton"; // "pallet" or "carton" target base option
}

export interface CartonType {
  id: string;
  name: string;
  length: number; // in mm
  width: number;  // in mm
  height: number; // in mm
  weight: number; // in kg
  color: string;
  frictionCoeff: number; // 0.1 to 1.0 (coefficient of friction)
  gapOverride?: number; // custom gap in mm
  allowedOrientations: {
    flat: boolean;     // original face (L x W)
    sideways: boolean; // rotated on side (L x H)
    uprightAvailable: boolean; // can rotate standup (W x H)
  };
  quantity: number;
}

export type PlacedBlock = {
  id: string;
  typeId: string;
  name: string;
  x: number; // position on pallet
  y: number;
  z: number;
  l: number; // actual dimensional sizing in packed orientation
  w: number;
  h: number;
  weight: number;
  color: string;
  frictionCoeff: number;
  unsupportedAreaPercent: number; // overhang rating
  layerIndex: number;
  supportAreaMm2?: number;          // actual supported surface area in mm2
  supportPercentage?: number;       // supported percentage (0-100)
  contactDetails?: { name: string; id: string; areaMm2: number; percentage: number }[]; // list of bottom contacts
};

export interface PackingResult {
  placedBoxes: PlacedBlock[];
  unplacedBoxes: { carton: CartonType; reason: string }[];
  volumetricUtilisation: number; // 0 to 100%
  palletUtilisedHeight: number; // in mm
  totalWeight: number; // in kg
  centerOfGravity: {
    x: number;
    y: number;
    z: number;
  };
  cgEccentricity: number; // mm distance from pallet horizontal center
  stabilityScore: number; // 0 to 100 overall
  metricBreakdowns: {
    cgAlignment: number;   // 0 - 25
    baseSupport: number;   // 0 - 25
    weightHierarchy: number; // 0 - 25
    interlocking: number;   // 0 - 15
    frictionPhysics: number; // 0 - 10
  };
  interlockingCheck: {
    isInterlocked: boolean;
    layerAlternated: boolean;
    pinwheelFormed: boolean;
  };
}

export interface TCPStreamLog {
  id: string;
  timestamp: string;
  direction: "IN" | "OUT" | "SYS";
  protocol: "TCP/IP" | "REST" | "GATEWAY";
  rawPayload: string;
  parsedSummary: string;
  status: "success" | "warning" | "error" | "info";
}
