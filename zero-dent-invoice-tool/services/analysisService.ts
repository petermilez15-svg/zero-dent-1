import { TollCharge, VehicleDetail, UnmatchedTollGroup } from '../types';

// --- Helper Functions ---

const getValue = (row: any, keys: string[]): any => {
    if (!row) return undefined;
    for (const key of keys) {
        const matchingKey = Object.keys(row).find(rowKey => rowKey.trim().toLowerCase() === key.toLowerCase());
        if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null) {
            return row[matchingKey];
        }
    }
    return undefined;
};

const normalizeToDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date && !isNaN(value.getTime())) {
        return value;
    }
    if (typeof value === 'string') {
        const parsedDate = new Date(value);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }
    }
    if (typeof value === 'number') {
        // Excel date serial number
        const date = new Date((value - 25569) * 86400 * 1000);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    return null;
};

const normalizePlate = (plate: string): string => {
  if (!plate) return '';
  // Remove spaces, dashes, and other non-alphanumeric chars, then uppercase
  let normalized = String(plate).toUpperCase().replace(/[^A-Z0-9]/g, '');
  // If the result starts with "TX", remove it
  if (normalized.startsWith('TX')) {
    normalized = normalized.substring(2);
  }
  return normalized;
};

// --- Interfaces ---

export interface AugmentedRentalData extends Record<string, any> {
    _tolls: TollCharge[];
    _totalTollAmount: number;
}

export interface CrossReferenceResult {
    augmentedRentals: AugmentedRentalData[];
    unmatchedTollGroups: UnmatchedTollGroup[];
    unassignedTolls: TollCharge[];
}

// --- Main Service Function ---

export const crossReferenceData = (
    rentalRows: any[],
    tollCharges: TollCharge[],
    allVehicles: VehicleDetail[]
): CrossReferenceResult => {
    const plateToVehicleMap = new Map<string, VehicleDetail>();

    allVehicles.forEach(vehicle => {
        if (vehicle && vehicle.name) {
            const plates = [
                String(vehicle.licensePlate || ''),
                String(vehicle.paperPlate || '')
            ]
            .map(p => normalizePlate(p))
            .filter(p => p);

            const uniquePlates = [...new Set(plates)];
            uniquePlates.forEach(p => {
                plateToVehicleMap.set(p, vehicle);
            });
        }
    });
    
    const findBestVehicleMatch = (nameFromRow: string): VehicleDetail | null => {
        const lowerNameFromRow = nameFromRow.trim().toLowerCase();
        if (!lowerNameFromRow) return null;

        let bestMatch: VehicleDetail | null = null;
        let longestMatch = 0;

        for (const vehicle of allVehicles) {
            const canonicalName = vehicle.name.trim().toLowerCase();
            if (lowerNameFromRow.startsWith(canonicalName)) {
                if (canonicalName.length > longestMatch) {
                    longestMatch = canonicalName.length;
                    bestMatch = vehicle;
                }
            }
        }
        return bestMatch;
    };


    if (!rentalRows.length) {
        const { unmatchedTollGroups, unassignedTolls } = groupUnmatchedTolls(tollCharges, plateToVehicleMap);
        return {
            augmentedRentals: [],
            unmatchedTollGroups,
            unassignedTolls
        };
    }

    const tollsByPlate = new Map<string, TollCharge[]>();
    tollCharges.forEach(toll => {
        const plate = normalizePlate(toll.licensePlate);
        if (!tollsByPlate.has(plate)) {
            tollsByPlate.set(plate, []);
        }
        tollsByPlate.get(plate)!.push(toll);
    });

    const matchedTollIds = new Set<string>();

    const augmentedRentals = rentalRows.map(row => {
        const newRow = { ...row }; // Create a shallow copy to modify
        const originalVehicleName = getValue(newRow, ['Rental Car Assigned', 'Rental Vehicle', 'Vehicle']) || '';
        const matchedVehicle = findBestVehicleMatch(originalVehicleName);

        // Normalize the vehicle name in the new row object
        if (matchedVehicle) {
            const vehicleKeyToUpdate = Object.keys(newRow).find(k => ['rental car assigned', 'rental vehicle', 'vehicle'].includes(k.trim().toLowerCase())) || 'Rental Car Assigned';
            newRow[vehicleKeyToUpdate] = matchedVehicle.name;
        }

        let rentalPlates: string[] = [];
        const licensePlateFromRow = getValue(newRow, ['License Plate', 'Plate']);

        if (licensePlateFromRow) {
            rentalPlates = String(licensePlateFromRow).split('/').map(p => normalizePlate(p.trim()));
        } else if (matchedVehicle) {
            rentalPlates = [
                normalizePlate(matchedVehicle.licensePlate),
                normalizePlate(matchedVehicle.paperPlate)
            ].filter(Boolean);
        }
        const uniqueRentalPlates = [...new Set(rentalPlates.filter(p => p))];

        const rentalStart = normalizeToDate(getValue(row, ['Rental Start Date', 'Rental Period Start', 'Rental Period STart']));
        const rentalEnd = normalizeToDate(getValue(row, ['Rental End Date', 'Rental Period ENd', 'Rental Period End']));
        
        let tollsForThisRental: TollCharge[] = [];

        if (rentalStart && rentalEnd && uniqueRentalPlates.length > 0) {
            uniqueRentalPlates.forEach(plate => {
                const relevantTolls = tollsByPlate.get(plate) || [];
                const matchingTolls = relevantTolls.filter(toll => 
                    toll.date &&
                    toll.date >= rentalStart && toll.date <= rentalEnd
                );
                
                matchingTolls.forEach(toll => {
                    tollsForThisRental.push(toll);
                    if (toll.transactionId) {
                        matchedTollIds.add(toll.transactionId);
                    }
                });
            });
        }
        
        tollsForThisRental = Array.from(new Map(tollsForThisRental.map(t => [t.transactionId || Math.random(), t])).values());
        
        const totalTollAmount = tollsForThisRental.reduce((sum, toll) => sum + toll.amount, 0);

        newRow._tolls = tollsForThisRental;
        newRow._totalTollAmount = totalTollAmount;
        
        return newRow;
    });

    const rawUnmatchedTolls = tollCharges.filter(toll => !toll.transactionId || !matchedTollIds.has(toll.transactionId));
    
    const { unmatchedTollGroups, unassignedTolls } = groupUnmatchedTolls(rawUnmatchedTolls, plateToVehicleMap);

    return { augmentedRentals, unmatchedTollGroups, unassignedTolls };
};

const groupUnmatchedTolls = (
    tolls: TollCharge[],
    plateToVehicleMap: Map<string, VehicleDetail>
): { unmatchedTollGroups: UnmatchedTollGroup[], unassignedTolls: TollCharge[] } => {
    
    const vehicleVinToGroupMap = new Map<string, UnmatchedTollGroup>();
    const unassignedTolls: TollCharge[] = [];

    tolls.forEach(toll => {
        const tollPlate = normalizePlate(toll.licensePlate);
        const vehicle = plateToVehicleMap.get(tollPlate);

        if (vehicle) {
            if (!vehicleVinToGroupMap.has(vehicle.vin)) {
                vehicleVinToGroupMap.set(vehicle.vin, {
                    vehicle: vehicle,
                    tolls: [],
                    totalAmount: 0,
                });
            }
            const group = vehicleVinToGroupMap.get(vehicle.vin)!;
            group.tolls.push(toll);
            group.totalAmount += toll.amount;
        } else {
            unassignedTolls.push(toll);
        }
    });

    const unmatchedTollGroups = Array.from(vehicleVinToGroupMap.values());
    unmatchedTollGroups.forEach(group => group.tolls.sort((a,b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0)));
    unassignedTolls.sort((a,b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

    return { unmatchedTollGroups, unassignedTolls };
};