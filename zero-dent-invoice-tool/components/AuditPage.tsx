import React, { useState, useMemo } from 'react';
import { TollCharge, VehicleDetail, UnmatchedTollGroup } from '../types';
import { crossReferenceData, AugmentedRentalData} from '../services/analysisService';
import { personalCars, armandosRentals, sandysRentals } from '../data/fleetData';
import { ChevronDownIcon, LinkIcon } from './IconComponents';

interface AuditPageProps {
    rentalRows: any[];
    tollCharges: TollCharge[];
}

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
    if (value instanceof Date && !isNaN(value.getTime())) return value;
    if (typeof value === 'string') {
        const parsedDate = new Date(value);
        if (!isNaN(parsedDate.getTime())) return parsedDate;
    }
    if (typeof value === 'number') {
        const date = new Date((value - 25569) * 86400 * 1000);
        if (!isNaN(date.getTime())) return date;
    }
    return null;
};

const formatDate = (date: Date | null): string => {
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

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

// --- Sub-Components ---

const StatCard: React.FC<{ label: string; value: string; className?: string; }> = ({ label, value, className = '' }) => (
    <div className={`bg-app-background p-3 rounded-lg border border-app-border ${className}`}>
        <p className="text-xs text-app-textSecondary truncate">{label}</p>
        <p className="text-lg font-bold text-app-textPrimary">{value}</p>
    </div>
);

const MatchedRentalItem: React.FC<{ rental: AugmentedRentalData; vehicleDataMap: Map<string, { plates: string[], primaryPlate: string }> }> = ({ rental, vehicleDataMap }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    const vehicle = getValue(rental, ['Rental Car Assigned', 'Rental Vehicle', 'Vehicle']);
    const insured = getValue(rental, ['Insured Name']);
    const claim = getValue(rental, ['Claim Number']);
    const periodStart = normalizeToDate(getValue(rental, ['Rental Start Date', 'Rental Period Start', 'Rental Period STart']));
    const periodEnd = normalizeToDate(getValue(rental, ['Rental End Date', 'Rental Period ENd', 'Rental Period End']));
    
    const displayPlate = useMemo(() => {
        let plate = getValue(rental, ['License Plate', 'Plate']);
        if (plate) return normalizePlate(plate);

        const vehicleNameLower = String(vehicle || '').trim().toLowerCase();
        if (vehicleNameLower && vehicleDataMap.has(vehicleNameLower)) {
            return normalizePlate(vehicleDataMap.get(vehicleNameLower)!.primaryPlate);
        }
        return 'N/A';
    }, [rental, vehicle, vehicleDataMap]);

    return (
        <div className="bg-app-surface/50 p-3 rounded-lg border border-app-border">
            <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex-grow">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-app-textPrimary">{vehicle}</p>
                      <span className="text-xs font-mono bg-app-background px-2 py-0.5 rounded-md border border-app-border">{displayPlate}</span>
                    </div>
                    <p className="text-sm text-app-textSecondary">{insured} - Claim: {claim}</p>
                    <p className="text-xs text-app-textSecondary">{formatDate(periodStart)} to {formatDate(periodEnd)}</p>
                </div>
                <div className="text-right mx-4">
                    <p className={`font-bold ${rental._totalTollAmount > 0 ? 'text-danger' : 'text-app-textPrimary'}`}>${rental._totalTollAmount.toFixed(2)}</p>
                    <p className="text-xs text-app-textSecondary">{rental._tolls.length} Tolls</p>
                </div>
                <ChevronDownIcon className={`w-5 h-5 text-app-textSecondary transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </div>

            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[1000px] mt-3 pt-3 border-t border-app-border' : 'max-h-0'}`}>
                {rental._tolls.length > 0 ? (
                    <table className="w-full text-sm">
                        <thead className="text-xs text-app-textSecondary uppercase">
                            <tr>
                                <th className="px-2 py-1">Date</th>
                                <th className="px-2 py-1">Location</th>
                                <th className="px-2 py-1 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="text-app-textPrimary">
                            {rental._tolls.map((toll, idx) => (
                                <tr key={toll.transactionId || idx} className="border-b border-app-border/50 last:border-0">
                                    <td className="px-2 py-1">{formatDate(toll.date)}</td>
                                    <td className="px-2 py-1 truncate max-w-xs">{toll.location}</td>
                                    <td className="px-2 py-1 text-right">${toll.amount.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : <p className="text-sm text-app-textSecondary text-center py-2">No tolls found in this rental period.</p>}
            </div>
        </div>
    );
};

const VehicleUnmatchedTollsCard: React.FC<{ group: UnmatchedTollGroup }> = ({ group }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-app-surface/50 p-3 rounded-lg border border-app-border">
            <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex-grow">
                    <p className="font-semibold text-app-textPrimary">{group.vehicle.name}</p>
                    <p className="text-sm text-app-textSecondary">{group.vehicle.year} {group.vehicle.make} {group.vehicle.model}</p>
                </div>
                <div className="text-right mx-4">
                    <p className="font-bold text-amber-400">${group.totalAmount.toFixed(2)}</p>
                    <p className="text-xs text-app-textSecondary">{group.tolls.length} Tolls</p>
                </div>
                <ChevronDownIcon className={`w-5 h-5 text-app-textSecondary transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </div>
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[1000px] mt-3 pt-3 border-t border-app-border' : 'max-h-0'}`}>
                <table className="w-full text-sm">
                    <thead className="text-xs text-app-textSecondary uppercase">
                        <tr>
                            <th className="px-2 py-1">Plate</th>
                            <th className="px-2 py-1">Date</th>
                            <th className="px-2 py-1 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="text-app-textPrimary">
                        {group.tolls.map((toll, idx) => (
                            <tr key={toll.transactionId || idx} className="border-b border-app-border/50 last:border-0">
                                <td className="px-2 py-1 font-mono">{normalizePlate(toll.licensePlate)}</td>
                                <td className="px-2 py-1">{formatDate(toll.date)}</td>
                                <td className="px-2 py-1 text-right">${toll.amount.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Main Page Component ---

export const AuditPage: React.FC<AuditPageProps> = ({ rentalRows, tollCharges }) => {
    const vehicleDataMap = useMemo(() => {
        const allVehicles: VehicleDetail[] = [...personalCars, ...armandosRentals, ...sandysRentals];
        const map = new Map<string, { plates: string[], primaryPlate: string }>();
        allVehicles.forEach(vehicle => {
            if (vehicle.name) {
                const plates = [normalizePlate(vehicle.licensePlate)];
                if (vehicle.paperPlate) {
                    plates.push(normalizePlate(vehicle.paperPlate));
                }
                map.set(vehicle.name.trim().toLowerCase(), {
                    plates: [...new Set(plates.filter(p => p))],
                    primaryPlate: vehicle.licensePlate
                });
            }
        });
        return map;
    }, []);

    const { augmentedRentals, unmatchedTollGroups, unassignedTolls } = useMemo(() => {
        const allVehicles = [...personalCars, ...armandosRentals, ...sandysRentals];
        return crossReferenceData(rentalRows, tollCharges, allVehicles);
    }, [rentalRows, tollCharges]);

    const totalMatchedTollAmount = useMemo(() => {
        return augmentedRentals.reduce((sum, rental) => sum + rental._totalTollAmount, 0);
    }, [augmentedRentals]);

    const totalUnmatchedTollAmount = useMemo(() => {
        return unmatchedTollGroups.reduce((sum, group) => sum + group.totalAmount, 0) + unassignedTolls.reduce((sum, toll) => sum + toll.amount, 0);
    }, [unmatchedTollGroups, unassignedTolls]);

    const matchedTollCount = useMemo(() => {
        return augmentedRentals.reduce((sum, rental) => sum + rental._tolls.length, 0);
    }, [augmentedRentals]);

    if (rentalRows.length === 0 || tollCharges.length === 0) {
        return (
            <div className="text-center p-8 bg-app-surface rounded-lg border border-app-border">
                <LinkIcon className="w-16 h-16 text-app-textSecondary mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-app-textPrimary">Audit & Cross-Reference</h2>
                <p className="mt-2 text-app-textSecondary">
                    Please upload data in both the 'Rental Data' and 'Toll Data' tabs to use this feature.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-app-surface p-4 md:p-6 rounded-lg shadow-xl border border-app-border w-full">
            <div className="flex items-center gap-3 mb-4">
                <LinkIcon className="w-8 h-8 text-brand-primary" />
                <h2 className="text-3xl font-bold text-app-textPrimary">Audit & Cross-Reference</h2>
            </div>
            <p className="text-app-textSecondary mb-6">This page matches toll charges to rental periods based on vehicle plate and date.</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard label="Matched Tolls (Count)" value={matchedTollCount.toLocaleString()} />
                <StatCard label="Matched Tolls (Value)" value={`$${totalMatchedTollAmount.toFixed(2)}`} className="text-emerald-400" />
                <StatCard label="Unmatched Tolls (Count)" value={(unmatchedTollGroups.reduce((sum, g) => sum + g.tolls.length, 0) + unassignedTolls.length).toLocaleString()} />
                <StatCard label="Unmatched Tolls (Value)" value={`$${totalUnmatchedTollAmount.toFixed(2)}`} className="text-amber-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Matched Tolls Panel */}
                <div className="bg-app-background p-4 rounded-lg border border-app-border">
                    <h3 className="text-xl font-semibold text-app-textPrimary mb-4">Rentals &amp; Matched Tolls</h3>
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        {augmentedRentals.length > 0 ? (
                            augmentedRentals
                                .map((rental, idx) => <MatchedRentalItem key={idx} rental={rental} vehicleDataMap={vehicleDataMap} />)
                        ) : (
                            <p className="text-app-textSecondary text-center py-4">No rental records have been loaded to audit.</p>
                        )}
                    </div>
                </div>

                {/* Unmatched Tolls Panel */}
                <div className="bg-app-background p-4 rounded-lg border border-app-border">
                    <h3 className="text-xl font-semibold text-app-textPrimary mb-4">Unmatched Tolls</h3>
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        {unmatchedTollGroups.length === 0 && unassignedTolls.length === 0 && (
                            <p className="text-app-textSecondary text-center py-4">All tolls were successfully matched to rental periods.</p>
                        )}
                        
                        {unmatchedTollGroups.sort((a,b) => b.totalAmount - a.totalAmount).map(group => (
                            <VehicleUnmatchedTollsCard key={group.vehicle.vin} group={group} />
                        ))}

                        {unassignedTolls.length > 0 && (
                            <div className="bg-app-surface/50 p-3 rounded-lg border border-app-border">
                                <h4 className="font-semibold text-app-textPrimary">Tolls with No Matching Vehicle</h4>
                                <table className="w-full text-sm mt-2">
                                    <thead className="text-xs text-app-textSecondary uppercase">
                                        <tr>
                                            <th className="px-2 py-1">Plate</th>
                                            <th className="px-2 py-1">Date</th>
                                            <th className="px-2 py-1 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-app-textPrimary">
                                        {unassignedTolls.map((toll, idx) => (
                                            <tr key={toll.transactionId || idx} className="border-b border-app-border/50 last:border-0">
                                                <td className="px-2 py-1 font-mono">{normalizePlate(toll.licensePlate)}</td>
                                                <td className="px-2 py-1">{formatDate(toll.date)}</td>
                                                <td className="px-2 py-1 text-right">${toll.amount.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};