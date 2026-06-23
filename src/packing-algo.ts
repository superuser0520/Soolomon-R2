import { PalletConfig, CartonType, PlacedBlock, PackingResult } from "./types";

/**
 * Generates a deterministic, vibrant HSL color from a string key.
 * This assigns each individual box its of-type random visual shade, ensuring
 * they are stable and do not change across re-renders.
 */
export function getDeterministicHSLColor(idStr: string): string {
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) {
    hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Use a well-distributed range of hues
  const hue = Math.abs(hash) % 360;
  
  // Vibrant, industrial packaging shades (75% to 90% saturation, 45% to 60% lightness)
  const saturation = 75 + (Math.abs(hash) % 15);
  const lightness = 45 + (Math.abs(hash >> 3) % 15);
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * 3D Mix-Case Palletizing Heuristic Pack Algorithm
 */
export function simulatePalletizing(
  pallet: PalletConfig,
  cartons: CartonType[]
): PackingResult {
  const placedBoxes: PlacedBlock[] = [];
  const unplacedBoxes: { carton: CartonType; reason: string }[] = [];

  // 1. Prepare carton stack queues.
  // We expand the cartons list into individual boxes so we can place them one by one.
  const boxesToPack: { type: CartonType; indexInType: number }[] = [];
  cartons.forEach((carton) => {
    for (let i = 0; i < carton.quantity; i++) {
      boxesToPack.push({ type: carton, indexInType: i });
    }
  });

  // Heuristics:
  // - "vol-desc" (Wadaboa style): Sort by volume descending so that larger containers anchor the lower base layer.
  // - "weight-desc" (Smart weight hierarchy): Sort by weight descending so gravity stability is preserved.
  // - "fifo" (FIFO Insertion order): Keep initial order, achieving position stability on progressive carton additions.
  if (pallet.packSequence === "weight-desc") {
    boxesToPack.sort((a, b) => {
      if (Math.abs(b.type.weight - a.type.weight) > 0.01) {
        return b.type.weight - a.type.weight; // Heaviest first
      }
      const areaA = a.type.length * a.type.width;
      const areaB = b.type.length * b.type.width;
      return areaB - areaA; // Largest footprint second
    });
  } else if (pallet.packSequence === "vol-desc") {
    boxesToPack.sort((a, b) => {
      const volA = a.type.length * a.type.width * a.type.height;
      const volB = b.type.length * b.type.width * b.type.height;
      if (Math.abs(volB - volA) > 1000) {
        return volB - volA; // Largest volume first
      }
      const areaA = a.type.length * a.type.width;
      const areaB = b.type.length * b.type.width;
      return areaB - areaA; // Largest base area second
    });
  }

  // Pallet Dimensions
  const pL = pallet.length;
  const pW = pallet.width;
  const pH = pallet.height;
  const defaultGap = pallet.defaultGap;

  // Track potential placement positions.
  // An array of potential corner coordinates [x, y, z] to evaluate.
  // Initial position is at the bottom corner of the pallet
  let candidatePoints: { x: number; y: number; z: number }[] = [{ x: 0, y: 0, z: 0 }];

  // Helper helper to check 3D collision between two solid spaces
  const checkOverlap = (
    x1: number, y1: number, z1: number, w1: number, l1: number, h1: number,
    x2: number, y2: number, z2: number, w2: number, l2: number, h2: number
  ): boolean => {
    return (
      x1 < x2 + w2 && x1 + w1 > x2 &&
      y1 < y2 + l2 && y1 + l1 > y2 &&
      z1 < z2 + h2 && z1 + h1 > z2
    );
  };

  // Helper to check if a box sits entirely in the bounds of the pallet, considering physical borders
  const isWithinPallet = (
    x: number, y: number, z: number,
    l: number, w: number, h: number
  ): boolean => {
    return x >= 0 && x + l <= pL &&
           y >= 0 && y + w <= pW &&
           z >= 0 && z + h <= pH;
  };

  // Helper code to calculate how much base area of a box is supported by underlying boxes or the pallet floor
  const calculateSupportRatio = (
    x: number, y: number, z: number,
    l: number, w: number
  ): { ratio: number; underlyingIds: string[] } => {
    if (z === 0) {
      return { ratio: 1.0, underlyingIds: ["pallet_floor"] }; // Ground is 100% supported
    }

    const sampleStep = 10; // mm grid spacing for integration
    let supportedPoints = 0;
    let totalPoints = 0;
    const underlyingIdsSet = new Set<string>();

    for (let dx = 2; dx < l - 2; dx += sampleStep) {
      for (let dy = 2; dy < w - 2; dy += sampleStep) {
        totalPoints++;
        let pointSupported = false;

        // Check if this point at (x+dx, y+dy, z - epsilon) is inside the top surface of any placed box
        const checkX = x + dx;
        const checkY = y + dy;
        const checkZ = z - 1; // 1mm below base plane

        for (const pb of placedBoxes) {
          if (
            checkX >= pb.x && checkX <= pb.x + pb.l &&
            checkY >= pb.y && checkY <= pb.y + pb.w &&
            Math.abs((pb.z + pb.h) - z) <= 2 // Sits directly on top
          ) {
            pointSupported = true;
            underlyingIdsSet.add(pb.id);
            break;
          }
        }

        if (pointSupported) {
          supportedPoints++;
        }
      }
    }

    const ratio = totalPoints > 0 ? supportedPoints / totalPoints : 0.0;
    return { ratio, underlyingIds: Array.from(underlyingIdsSet) };
  };

  // 2. Loop through all boxes and place them using multi-heuristic decision layer-by-layer
  let remainingUnits = boxesToPack.map((box, idx) => ({
    box,
    originalIndex: idx
  }));

  while (remainingUnits.length > 0) {
    const validPlacements: {
      unitIndex: number;
      x: number;
      y: number;
      z: number;
      orient: { l: number; w: number; h: number };
      score: number;
      supportRatio: number;
      priority: number;
    }[] = [];

    const currentWeight = placedBoxes.reduce((sum, pb) => sum + pb.weight, 0);

    for (let u = 0; u < remainingUnits.length; u++) {
      const unit = remainingUnits[u];
      const carton = unit.box.type;

      // Weight capacity restriction: Skip if placing this carton on the current pallet would exceed the pallet's max capacity
      if (currentWeight + carton.weight > pallet.maxWeight) {
        continue;
      }

      const boxGap = carton.gapOverride !== undefined ? carton.gapOverride : defaultGap;

      // Determine candidate orientations based on dimensions and allowed settings
      // RESTRICTION: Orientation must be only flat (height is always carton.height), but 90 degrees yaw rotation is allowed.
      const orientations: { l: number; w: number; h: number }[] = [];

      // Form 1: Standard Flat layout (L x W x H)
      orientations.push({ l: carton.length, w: carton.width, h: carton.height });
      // Rotated 90 degrees on the vertical axis (W x L x H)
      if (carton.length !== carton.width) {
        orientations.push({ l: carton.width, w: carton.length, h: carton.height });
      }

      // To prevent duplicate evaluations if dimensions match
      const uniqueOrientations = orientations.filter((o, index, self) =>
        self.findIndex((t) => t.l === o.l && t.w === o.w && t.h === o.h) === index
      );

      // Filter candidate points: We want to review each candidate point
      for (const pt of candidatePoints) {
        for (const orient of uniqueOrientations) {
          // Dimensions including gaps around adjacent boxes
          const boxFitL = orient.l;
          const boxFitW = orient.w;
          const boxFitH = orient.h;

          // Check limits
          if (!isWithinPallet(pt.x, pt.y, pt.z, boxFitL, boxFitW, boxFitH)) {
            continue;
          }

          // Check overlap with any existing placement, accounting for gap margin as physical separation buffer
          let overlaps = false;
          for (const pb of placedBoxes) {
            const buffer = boxGap;
            if (
              checkOverlap(
                pt.x, pt.y, pt.z, boxFitL, boxFitW, boxFitH,
                pb.x, pb.y, pb.z, pb.l + buffer, pb.w + buffer, pb.h
              )
            ) {
              overlaps = true;
              break;
            }
          }

          if (overlaps) {
            continue;
          }

          // SCARA Top-Down Placement Clearance Guard
          // Ensure that as the SCARA robot lowers this box from above to pt.z,
          // it does not collide with any already placed taller box (either directly above it or on its sides).
          let scaraClearanceViolation = false;
          for (const pb of placedBoxes) {
            // Check if the placed box is taller than the target placement height of our candidate
            if (pb.z + pb.h > pt.z) {
              const xOverlap = (pt.x < pb.x + pb.l) && (pt.x + boxFitL > pb.x);
              const yOverlap = (pt.y < pb.y + pb.w) && (pt.y + boxFitW > pb.y);
              
              if (xOverlap && yOverlap) {
                // Direct vertical obstruction: pb blocks the footprint from above!
                scaraClearanceViolation = true;
                break;
              }

              // Side clearance check:
              // If the placed box is taller than our candidate's landing spot,
              // we must ensure sufficient horizontal separation to avoid colliding with sides.
              let xDist = 0;
              if (pt.x + boxFitL <= pb.x) {
                xDist = pb.x - (pt.x + boxFitL);
              } else if (pb.x + pb.l <= pt.x) {
                xDist = pt.x - (pb.x + pb.l);
              }

              let yDist = 0;
              if (pt.y + boxFitW <= pb.y) {
                yDist = pb.y - (pt.y + boxFitW);
              } else if (pb.y + pb.w <= pt.y) {
                yDist = pt.y - (pb.y + pb.w);
              }

              let horizontalSeparation = 0;
              if (xOverlap) {
                horizontalSeparation = yDist;
              } else if (yOverlap) {
                horizontalSeparation = xDist;
              } else {
                horizontalSeparation = Math.sqrt(xDist * xDist + yDist * yDist);
              }

              // Clearance margin must be at least the gap config or 4mm to ensure gripper/scara arm has space
              const clearanceMargin = Math.max(4, boxGap);
              if (horizontalSeparation < clearanceMargin) {
                scaraClearanceViolation = true;
                break;
              }
            }
          }

          if (scaraClearanceViolation) {
            continue; // Skip placement: violates SCARA top-down clearance
          }

          // Boundary-prefer barcode condition:
          // The barcode is located on BOTH of the long sides of the carton.
          // In the boundary-preferred mode, we prioritize outer boundaries first. 
          // If a carton is placed on the perimeter (touches any of the outer pallet walls), we orient it so one of the long sides (carrying the barcodes) faces outwards to remain fully visible.
          // If a carton is in the middle (does not touch any outer wall), we allow it to be placed (and naturally loaded in sequence) so we can fully utilize the space.
          if (pallet.interlockType === "boundary-prefer") {
            // Find the minimum dimension among all cartons to understand proximity threshold.
            // If the remaining space is smaller than the smallest carton's dimension, no other carton can squeeze in,
            // which guarantees that this face will be visible from the outside.
            const minCartonDim = cartons.length > 0 
              ? Math.min(...cartons.flatMap((c) => [c.length, c.width]))
              : 150;

            const touchesLeft = (pt.x < minCartonDim);
            const touchesRight = (pL - (pt.x + boxFitL) < minCartonDim);
            const touchesFront = (pt.y < minCartonDim);
            const touchesBack = (pW - (pt.y + boxFitW) < minCartonDim);

            // ONLY enforce outward barcode orientation IF the carton touches at least one outer boundary edge.
            if (touchesLeft || touchesRight || touchesFront || touchesBack) {
              if (carton.length !== carton.width) {
                const longDim = Math.max(carton.length, carton.width);
                let isValidBarcodeOrientation = false;
                
                // If touching the Left or Right pallet edge, the carton's outer-facing side is along the Y-axis (boxFitW).
                // Since barcodes are on both long sides, the long side of the box must face Left/Right (meaning boxFitW is the long dimension).
                if ((touchesLeft || touchesRight) && boxFitW === longDim) {
                  isValidBarcodeOrientation = true;
                }
                // If touching the Front or Back pallet edge, the carton's outer-facing side is along the X-axis (boxFitL).
                // The long side of the box must face Front/Back (meaning boxFitL is the long dimension).
                if ((touchesFront || touchesBack) && boxFitL === longDim) {
                  isValidBarcodeOrientation = true;
                }
                
                if (!isValidBarcodeOrientation) {
                  continue; // Skip: the outer-facing side of the carton is not one of the long sides carrying the barcode.
                }
              }
            }
          }

          // Calculate active base support for physical safety
          const supportInfo = calculateSupportRatio(pt.x, pt.y, pt.z, boxFitL, boxFitW);
          const supportRatio = supportInfo.ratio;

          // Minimum support required to be structurally sound: we enforce 60% standard
          if (supportRatio < 0.60) {
            continue;
          }

          // Center-Of-Gravity (CG) Stability Guard check
          if (pallet.checkCGSupport && pt.z > 0) {
            const cgX = pt.x + boxFitL / 2;
            const cgY = pt.y + boxFitW / 2;
            let cgSupported = false;
            for (const pb of placedBoxes) {
              if (
                cgX >= pb.x && cgX <= pb.x + pb.l &&
                cgY >= pb.y && cgY <= pb.y + pb.w &&
                Math.abs((pb.z + pb.h) - pt.z) <= 3 // sitting directly on top with tolerance
              ) {
                cgSupported = true;
                break;
              }
            }
            if (!cgSupported) {
              continue; // Center of gravity floats in the air - unsafe placement
            }
          }

          // Apply stability heuristical evaluation to score this option
          let score = 10000;

          // Height penalty (massive): we want to pack tight layers!
          score -= pt.z * 10.0;

          // Edge nesting priority: we want to start from outer borders and cluster together
          const cornerDist = pt.x + pt.y;
          score -= cornerDist * 1.5;

          // Pinwheel & Layer Interlocking Heuristic
          const underlyingCount = supportInfo.underlyingIds.filter(id => id !== "pallet_floor").length;
          if (pt.z > 0 && underlyingCount >= 2) {
            score += 1500;
          }

          // Dynamic Layer Flatness / Height Matching Heuristic
          // Calculates the most common height of boxes already running in this horizontal plane
          const sameLayerBoxes = placedBoxes.filter((pb) => Math.abs(pb.z - pt.z) < 2);
          if (sameLayerBoxes.length > 0) {
            const heights = sameLayerBoxes.map((pb) => pb.h);
            const heightFreq: Record<number, number> = {};
            heights.forEach((h) => {
              heightFreq[h] = (heightFreq[h] || 0) + 1;
            });
            let dominantHeight = heights[0];
            let maxCount = 0;
            for (const hStr in heightFreq) {
              if (heightFreq[hStr] > maxCount) {
                maxCount = heightFreq[hStr];
                dominantHeight = Number(hStr);
              }
            }

            const isPureLayer = pallet.interlockType === "pure-layer";
            if (Math.abs(boxFitH - dominantHeight) < 2) {
              score += isPureLayer ? 4000 : 1500; // Extra heavy bonus to align heights in pure layer
            } else {
              score -= Math.abs(boxFitH - dominantHeight) * (isPureLayer ? 30.0 : 8.0); // Heavy penalty for mismatch
            }
          }

          // Pinwheel Stacking Method: Concentric spiral layout
          if (pallet.interlockType === "pinwheel") {
            const midX = pL / 2;
            const midY = pW / 2;
            const isLeft = pt.x + boxFitL / 2 < midX;
            const isBottom = pt.y + boxFitW / 2 < midY;

            // Cyclic concentric outer spiral flow mapping to lock adjacent columns:
            // - Bottom-Left: Length horizontal (boxFitL > boxFitW)
            // - Bottom-Right: Length vertical (boxFitW > boxFitL)
            // - Top-Right: Length horizontal (boxFitL > boxFitW)
            // - Top-Left: Length vertical (boxFitW > boxFitL)
            const matchesSpiralCycle = (isLeft && isBottom && boxFitL > boxFitW) ||
                                       (!isLeft && isBottom && boxFitW > boxFitL) ||
                                       (!isLeft && !isBottom && boxFitL > boxFitW) ||
                                       (isLeft && !isBottom && boxFitW > boxFitL);

            if (matchesSpiralCycle) {
              score += 2500; // Strong spiral layout alignment reward
            } else {
              score -= 500; // Discourage breaks in the concentric spiral loop
            }
          }

          // Boundary-Preferred Stacking Method: Edge-locking and corner anchoring
          if (pallet.interlockType === "boundary-prefer") {
            if (pt.z === 0) {
              // Bottom layer: prioritize placing on the four different edges of the pallet,
              // specifically prioritizing to fulfill the 4 corners of the pallet at the first layer:
              // Corner 1 (Priority 1) -> Corner 2 (Priority 2) -> Corner 3 (Priority 3) -> Corner 4 (Priority 4)
              const touchesLeftEdge = (pt.x === 0);
              const touchesRightEdge = (Math.abs(pt.x + boxFitL - pL) < 1);
              const touchesFrontEdge = (pt.y === 0);
              const touchesBackEdge = (Math.abs(pt.y + boxFitW - pW) < 1);

              const isCorner1 = touchesLeftEdge && touchesFrontEdge;
              const isCorner2 = touchesRightEdge && touchesFrontEdge;
              const isCorner3 = touchesLeftEdge && touchesBackEdge;
              const isCorner4 = touchesRightEdge && touchesBackEdge;

              const touchesAnyEdge = touchesLeftEdge || touchesRightEdge || touchesFrontEdge || touchesBackEdge;

              if (touchesAnyEdge) {
                if (isCorner1) {
                  score += 300000; // Priority 1 (Corner 1)
                } else if (isCorner2) {
                  score += 200000; // Priority 2 (Corner 2)
                } else if (isCorner3) {
                  score += 100000; // Priority 3 (Corner 3)
                } else if (isCorner4) {
                  score += 50000;  // Priority 4 (Corner 4)
                } else {
                  score += 10000;  // Regular single-edge touch
                }
              } else {
                score -= 30000; // Heavy penalty for non-edge bottom placements to enforce edge constraint first
              }
            } else {
              // Second layer and above (pt.z > 0): stack to space wastage avoidance.
              // Minimize empty spaces and gaps by rewarding tight adjacency with existing placed boxes on this layer.
              let adjacentToSameLayerBox = false;
              let minDistanceToSameLayerBox = pL + pW;
              for (const pb of placedBoxes) {
                if (Math.abs(pb.z - pt.z) < 2) {
                  const dist = Math.abs(pt.x - pb.x) + Math.abs(pt.y - pb.y);
                  if (dist < minDistanceToSameLayerBox) {
                    minDistanceToSameLayerBox = dist;
                  }
                  const isXAdjacent = Math.abs((pt.x + boxFitL) - pb.x) <= boxGap + 5 || Math.abs((pb.x + pb.l) - pt.x) <= boxGap + 5;
                  const isYAdjacent = Math.abs((pt.y + boxFitW) - pb.y) <= boxGap + 5 || Math.abs((pb.y + pb.w) - pt.y) <= boxGap + 5;
                  if (isXAdjacent || isYAdjacent) {
                    adjacentToSameLayerBox = true;
                  }
                }
              }

              if (adjacentToSameLayerBox) {
                score += 15000; // Extra nest reward for avoiding gaps and avoiding space wastage
              }
              score -= minDistanceToSameLayerBox * 5.0; // Discourage large distances between blocks

              // Also match the dominant height on this layer is critical to prevent horizontal slot wastage
              const sameLayerBoxes = placedBoxes.filter((pb) => Math.abs(pb.z - pt.z) < 2);
              if (sameLayerBoxes.length > 0) {
                const heights = sameLayerBoxes.map((pb) => pb.h);
                const heightFreq: Record<number, number> = {};
                heights.forEach((h) => {
                  heightFreq[h] = (heightFreq[h] || 0) + 1;
                });
                let dominantHeight = heights[0];
                let maxCount = 0;
                for (const hStr in heightFreq) {
                  if (heightFreq[hStr] > maxCount) {
                    maxCount = heightFreq[hStr];
                    dominantHeight = Number(hStr);
                  }
                }
                if (Math.abs(boxFitH - dominantHeight) < 2) {
                  score += 5000; // Align with dominant height to avoid wasting vertical/height airspace
                } else {
                  score -= Math.abs(boxFitH - dominantHeight) * 20.0;
                }
              }
            }
          }

          // Alternating Layers Stacking Method: Cross-stack locking
          if (pallet.interlockType === "alternating") {
            const approxLayer = Math.round(pt.z / 200);
            if (approxLayer % 2 === 1) {
              // Odd layer: we want to reverse standard diagonal preference to mirror joints across levels.
              // Instead of favoring low coordinate corner (pt.x + pt.y), we favor the opposite corner.
              const oppositeCornerDist = (pL - pt.x) + (pW - pt.y);
              score += oppositeCornerDist * 2.0;

              // Also reward rotated orientations compared to how this box type is canonical
              if (boxFitL !== carton.length) {
                score += 800;
              }
            } else {
              // Even layer: standard corner nesting cornerDist bias
              score -= cornerDist * 1.5;
            }
          }

          // Weigh the friction coefficient: higher friction is safer on upper layers, low friction on base.
          score += carton.frictionCoeff * 50;

          validPlacements.push({
            unitIndex: u,
            x: pt.x,
            y: pt.y,
            z: pt.z,
            orient,
            score,
            supportRatio,
            priority: unit.originalIndex
          });
        }
      }
    }

    if (validPlacements.length === 0) {
      // No valid placements at all for any remaining boxes on this pallet.
      // Classify reasons for unplaced boxes
      remainingUnits.forEach((unit) => {
        const carton = unit.box.type;
        const currentWeightVal = placedBoxes.reduce((sum, pb) => sum + pb.weight, 0);
        if (currentWeightVal + carton.weight > pallet.maxWeight) {
          unplacedBoxes.push({
            carton: carton,
            reason: `Pallet max weight limit (${pallet.maxWeight} kg) reached. Moving to next pallet.`,
          });
        } else {
          unplacedBoxes.push({
            carton: carton,
            reason: "No available space with sufficient structural support area.",
          });
        }
      });
      break;
    }

    // LAYER-BY-LAYER SELECTION: find the minimum Z level of any valid placements
    const minZ = Math.min(...validPlacements.map((vp) => vp.z));

    // Filter valid placements to only those sitting at minZ (the lowest active layer being packed)
    const layerPlacements = validPlacements.filter((vp) => Math.abs(vp.z - minZ) < 2);

    // Sort to honor the original sequence priority (defined by packSequence sorting order in priority)
    // and then the quality of placement (heuristic score)
    layerPlacements.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return b.score - a.score;
    });

    const chosen = layerPlacements[0];
    const { x, y, z, orient, supportRatio } = chosen;
    const unit = remainingUnits[chosen.unitIndex];
    const carton = unit.box.type;

    const layerIndex = Math.floor(z / 250);
    const blockId = `${carton.id}_box_${unit.box.indexInType}`;

    const placedBox: PlacedBlock = {
      id: blockId,
      typeId: carton.id,
      name: carton.name,
      x: x,
      y: y,
      z: z,
      l: orient.l,
      w: orient.w,
      h: orient.h,
      weight: carton.weight,
      color: getDeterministicHSLColor(blockId),
      frictionCoeff: carton.frictionCoeff,
      unsupportedAreaPercent: Math.max(0, 100 - Math.round(supportRatio * 100)),
      layerIndex: layerIndex,
    };

    placedBoxes.push(placedBox);

    // Remove the chosen box from the pool of remaining units
    remainingUnits.splice(chosen.unitIndex, 1);

    // Add new candidate packing coordinate expansion points around the newly placed box
    const boxGap = carton.gapOverride !== undefined ? carton.gapOverride : defaultGap;
    const gapOffset = boxGap;
    const nextPts = [
      { x: x + orient.l + gapOffset, y: y, z: z }, // slide right
      { x: x, y: y + orient.w + gapOffset, z: z }, // slide back
      { x: x, y: y, z: z + orient.h }              // stack above
    ];

    nextPts.forEach((pt) => {
      if (pt.x < pL && pt.y < pW && pt.z < pH) {
        const exists = candidatePoints.some((cp) => Math.abs(cp.x - pt.x) < 2 && Math.abs(cp.y - pt.y) < 2 && Math.abs(cp.z - pt.z) < 2);
        if (!exists) {
          candidatePoints.push(pt);
        }
      }
    });

    // Filter evaluated points: clear candidates that are inside the solid area of the newly placed box
    candidatePoints = candidatePoints.filter(cp => {
      return !(
        cp.x >= x && cp.x < x + orient.l &&
        cp.y >= y && cp.y < y + orient.w &&
        cp.z >= z && cp.z < z + orient.h
      );
    });

    // Sort candidate points: prefer lower Z height, then left-front corner for compactness
    candidatePoints.sort((a, b) => {
      if (Math.abs(a.z - b.z) > 1) {
        return a.z - b.z;
      }
      return (a.x + a.y) - (b.x + b.y);
    });
  }

  // Post-processing: Calculate exact bottom contact surface areas and percentages for each placed box
  placedBoxes.forEach((bx) => {
    const totalBottomArea = bx.l * bx.w;
    if (bx.z === 0) {
      bx.supportAreaMm2 = totalBottomArea;
      bx.supportPercentage = 100;
      bx.contactDetails = [
        {
          name: "Pallet Floor",
          id: "pallet_floor",
          areaMm2: totalBottomArea,
          percentage: 100
        }
      ];
    } else {
      const contacts: { name: string; id: string; areaMm2: number; percentage: number }[] = [];
      let totalContactArea = 0;

      // Find any boxes directly underneath
      placedBoxes.forEach((pb) => {
        if (pb.id !== bx.id) {
          // Sits directly on top if (pb.z + pb.h) is very close to bx.z
          if (Math.abs((pb.z + pb.h) - bx.z) <= 3) {
            // Overlapping footprint
            const xOverlap = Math.max(0, Math.min(bx.x + bx.l, pb.x + pb.l) - Math.max(bx.x, pb.x));
            const yOverlap = Math.max(0, Math.min(bx.y + bx.w, pb.y + pb.w) - Math.max(bx.y, pb.y));
            const overlapArea = xOverlap * yOverlap;

            if (overlapArea > 0) {
              const percent = (overlapArea / totalBottomArea) * 100;
              contacts.push({
                name: pb.name,
                id: pb.id,
                areaMm2: Math.round(overlapArea),
                percentage: Math.round(percent * 10) / 10 // 1 decimal place
              });
              totalContactArea += overlapArea;
            }
          }
        }
      });

      bx.supportAreaMm2 = Math.round(totalContactArea);
      bx.supportPercentage = Math.round((totalContactArea / totalBottomArea) * 1000) / 10;
      bx.contactDetails = contacts.sort((a, b) => b.areaMm2 - a.areaMm2); // Sort contacts by area descending
    }
  });

  // 4. Calculate Final Analytics: Volume, Weight, and Center of Gravity (CG)
  const totalPalletVolume = pL * pW * pH;
  let totalBoxesVolume = 0;
  let totalWeight = 0;

  let sumWX = 0;
  let sumWY = 0;
  let sumWZ = 0;

  let utilisedMaxHeight = 0;

  placedBoxes.forEach((bx) => {
    const vol = bx.l * bx.w * bx.h;
    totalBoxesVolume += vol;
    totalWeight += bx.weight;

    // Center of gravity of individual box in 3D
    const bxCGX = bx.x + bx.l / 2;
    const bxCGY = bx.y + bx.w / 2;
    const bxCGZ = bx.z + bx.h / 2;

    sumWX += bx.weight * bxCGX;
    sumWY += bx.weight * bxCGY;
    sumWZ += bx.weight * bxCGZ;

    const topZ = bx.z + bx.h;
    if (topZ > utilisedMaxHeight) {
      utilisedMaxHeight = topZ;
    }
  });

  // Calculation is based on the space of the pallet actually utilized up to the maximum height of the highest placed box
  const actualPalletVolume = pL * pW * Math.max(1, utilisedMaxHeight);
  const volumetricUtilisation = totalWeight > 0 
    ? Math.min(100, Math.round((totalBoxesVolume / actualPalletVolume) * 100))
    : 0;

  // Global Center of Gravity Coordinates
  const cgX = totalWeight > 0 ? Math.round(sumWX / totalWeight) : pL / 2;
  const cgY = totalWeight > 0 ? Math.round(sumWY / totalWeight) : pW / 2;
  const cgZ = totalWeight > 0 ? Math.round(sumWZ / totalWeight) : 0;

  // CG Horizontal distance from pallet center (ideal)
  const idealX = pL / 2;
  const idealY = pW / 2;
  const cgEccentricity = Math.round(
    Math.sqrt(Math.pow(cgX - idealX, 2) + Math.pow(cgY - idealY, 2))
  );

  // 5. STABILITY BREAKDOWN METRICS (Summing up to 100 points)

  // A. CG Alignment Score (max 25): perfect 125mm boundary deviation
  const maxAllowedEccentricity = Math.min(pL, pW) * 0.35; // ~385mm for 1.1m pallet
  const cgAlignment = Math.max(
    0,
    Math.round(25 * (1 - Math.min(1, cgEccentricity / maxAllowedEccentricity)))
  );

  // B. Base Support Score (max 25): 100% support has no warnings
  let totalUnsupportedAreaRatioSum = 0;
  placedBoxes.forEach((bx) => {
    totalUnsupportedAreaRatioSum += bx.unsupportedAreaPercent / 100;
  });
  const avgUnsupportedRatio = placedBoxes.length > 0 
    ? totalUnsupportedAreaRatioSum / placedBoxes.length
    : 0;
  const baseSupport = Math.max(0, Math.round(25 * (1 - avgUnsupportedRatio)));

  // C. Weight Hierarchy Score (max 25): penalize placing heavy on light boxes
  // Analyze supporting columns to see if average weight density on upper layers is heavier.
  let weightHierarchyPenalties = 0;
  placedBoxes.forEach((bxUpper) => {
    if (bxUpper.z > 0) {
      // Find what sits directly under this box
      placedBoxes.forEach((bxLower) => {
        if (Math.abs((bxLower.z + bxLower.h) - bxUpper.z) <= 3) {
          // Check lateral footprint intersection
          const xOverlap = Math.max(0, Math.min(bxUpper.x + bxUpper.l, bxLower.x + bxLower.l) - Math.max(bxUpper.x, bxLower.x));
          const yOverlap = Math.max(0, Math.min(bxUpper.y + bxUpper.w, bxLower.y + bxLower.w) - Math.max(bxUpper.y, bxLower.y));
          if (xOverlap > 20 && yOverlap > 20) {
            // Sits on top significantly. Check absolute weights.
            if (bxUpper.weight > bxLower.weight + 4) {
              // Penalty: upper box is heavier than supporting lower box by more than 4kg.
              weightHierarchyPenalties += (bxUpper.weight - bxLower.weight) * 0.5;
            }
          }
        }
      });
    }
  });
  const weightHierarchy = Math.max(
    5, // Base min
    Math.round(25 - Math.min(20, weightHierarchyPenalties))
  );

  // D. Interlocking / Connection Score (max 15)
  // Check if layers are crossed (joints offset) to form a unified block (binding columns).
  // Bridgin occurs when multiple underlying support structures exist under placed packages.
  // We explicitly award extra stability points for overlay contact on two or more distinct underlying boxes.
  let interlockedBoxCount = 0;
  let multiContactStabilityBonus = 0;
  placedBoxes.forEach((bx) => {
    if (bx.z > 0) {
      // Check count of underlying boxes from its actual contact details calculated in post-processing
      const contactsCount = bx.contactDetails 
        ? bx.contactDetails.filter(c => c.id !== "pallet_floor").length 
        : calculateSupportRatio(bx.x, bx.y, bx.z, bx.l, bx.w).underlyingIds.filter(id => id !== "pallet_floor").length;

      if (contactsCount >= 2) {
        interlockedBoxCount++;
        // If a box is overlay contact with two or more different boxes, it increases the locking stability
        multiContactStabilityBonus += 1.5; // stability boost point per multi-contact bridge box
      }
    }
  });
  const portionInterlocked = placedBoxes.some(bx => bx.z > 0)
    ? interlockedBoxCount / placedBoxes.filter(bx => bx.z > 0).length
    : 1.0;

  let interlocking = Math.round(15 * (0.4 + portionInterlocked * 0.6));
  if (multiContactStabilityBonus > 0) {
    interlocking = Math.min(15, interlocking + Math.round(multiContactStabilityBonus));
  }

  // E. Friction Dynamics Rating (max 10)
  // Low friction boxes easily slide or slip. Friction coefficient ranges: Cardboard (0.45), Waxed Glossy (0.22), Plastic (0.32).
  let frictionFailsSum = 0;
  placedBoxes.forEach((bx) => {
    if (bx.frictionCoeff < 0.35) {
      frictionFailsSum += (0.35 - bx.frictionCoeff) * 2;
    }
  });
  const frictionPhysics = Math.max(
    3,
    Math.round(10 - Math.min(7, frictionFailsSum))
  );

  // Combined Stability Score
  const stabilityScore = cgAlignment + baseSupport + weightHierarchy + interlocking + frictionPhysics;

  // Dynamic accurate physical layer indexing calculation:
  // Gather all unique Z heights of placed boxes, rounded to 5mm tolerance
  const uniqueZLevels = Array.from(new Set(placedBoxes.map((bx) => Math.round(bx.z / 5) * 5)));
  uniqueZLevels.sort((a, b) => a - b);

  placedBoxes.forEach((bx) => {
    const roundedZ = Math.round(bx.z / 5) * 5;
    const dynamicIndex = uniqueZLevels.indexOf(roundedZ);
    bx.layerIndex = dynamicIndex >= 0 ? dynamicIndex : 0;
  });

  // Interlocking verification criteria
  const pinwheelFormed = pallet.interlockType === "pinwheel" && placedBoxes.length >= 4;
  const isInterlocked = interlocking >= 11;
  const layerAlternated = pallet.interlockType === "alternating" && placedBoxes.some(bx => bx.z > 200);

  return {
    placedBoxes,
    unplacedBoxes,
    volumetricUtilisation,
    palletUtilisedHeight: utilisedMaxHeight,
    totalWeight,
    centerOfGravity: { x: cgX, y: cgY, z: cgZ },
    cgEccentricity,
    stabilityScore: Math.min(100, Math.max(0, stabilityScore)),
    metricBreakdowns: {
      cgAlignment,
      baseSupport,
      weightHierarchy,
      interlocking,
      frictionPhysics,
    },
    interlockingCheck: {
      isInterlocked,
      layerAlternated,
      pinwheelFormed,
    },
  };
}

/**
 * Iterative multi-pallet packing engine.
 * Automatically schedules carton lists across N distinct pallets if a single one is insufficient.
 */
export function simulateMultiPalletizing(
  pallet: PalletConfig,
  cartons: CartonType[]
): PackingResult[] {
  let remainingCartons = cartons.map(c => ({ 
    ...c, 
    quantity: typeof c.quantity === "number" ? Math.max(0, c.quantity) : 0 
  }));
  
  const results: PackingResult[] = [];
  let safetyCounter = 0;
  
  while (remainingCartons.some(c => c.quantity > 0) && safetyCounter < 20) {
    safetyCounter++;
    const activeCartons = remainingCartons.filter(c => c.quantity > 0);
    if (activeCartons.length === 0) break;
    
    // Attempt standard single palletizing
    const singleResult = simulatePalletizing(pallet, activeCartons);
    
    // If no boxes could be placed at all on a fresh empty pallet, stop to avoid infinite loops
    if (singleResult.placedBoxes.length === 0) {
      results.push(singleResult);
      break;
    }
    
    results.push(singleResult);
    
    // Deduct placed boxes from remaining quantity
    const placedCounts: Record<string, number> = {};
    singleResult.placedBoxes.forEach(box => {
      placedCounts[box.typeId] = (placedCounts[box.typeId] || 0) + 1;
    });
    
    remainingCartons = remainingCartons.map(c => {
      const placedCount = placedCounts[c.id] || 0;
      return {
        ...c,
        quantity: Math.max(0, c.quantity - placedCount)
      };
    });
  }
  
  if (results.length === 0) {
    results.push(simulatePalletizing(pallet, []));
  }
  
  return results;
}
