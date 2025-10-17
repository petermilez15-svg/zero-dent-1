import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { ChartBarIcon, PencilIcon, ChevronDownIcon, InformationCircleIcon } from './IconComponents';
import { personalCars, armandosRentals, sandysRentals } from '../data/fleetData';
import { Modal } from './Modal';
import { TollCharge, VehicleDetail } from '../types';
import { crossReferenceData, AugmentedRentalData } from '../services/analysisService';

// --- Interfaces for our structured analysis data ---

interface VehicleAnalysis {
  totalIncome: number;
  totalPaidIncome: number;
  rentalCount: number;
  freeRentalCount: number;
  minRate: number;
  maxRate: number;
  isEstimated: boolean; // True if any of its income is based on an override
  totalDays: number;
  averageRate: number; // Avg rate for non-zero rentals
  totalTolls: number;
  _nonZeroRateSum?: number; // Internal temp property
  _nonZeroRateCount?: number; // Internal temp property
}

interface MonthlyAnalysis {
  totalRentalIncome: number;
  totalRentals: number;
  totalTolls: number;
  incomeByVehicle: Record<string, VehicleAnalysis>;
}

interface AnalysisData {
  totalRentalIncome: number;
  totalRentals: number;
  totalTolls: number; // This will now be "assigned" tolls
  totalUnassignedTolls: number; // For personal/other tolls
  incomeByMonth: Record<string, MonthlyAnalysis>;
}


interface DashboardPageProps {
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

const calculateMedian = (numbers: number[]): number => {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
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


const getMonthKeyFromDate = (date: Date | null): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return 'Undated';
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
}

const formatMonthKey = (monthKey: string): string => {
    if (monthKey === 'Undated') return 'Undated Rentals';
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 2);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
};


const formatDateFromDate = (date: Date | null): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit'});
}

// --- Component ---

export const DashboardPage: React.FC<DashboardPageProps> = ({ rentalRows, tollCharges }) => {
  const [augmentedRows, setAugmentedRows] = useState<AugmentedRentalData[]>([]);
  const [unmatchedTolls, setUnmatchedTolls] = useState<TollCharge[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [rateOverrides, setRateOverrides] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedVehicleKey, setExpandedVehicleKey] = useState<string | null>(null);
  const [isTollModalOpen, setIsTollModalOpen] = useState<boolean>(false);
  const [selectedTollsForModal, setSelectedTollsForModal] = useState<TollCharge[]>([]);

  const allVehicles = useMemo(() => [...personalCars, ...armandosRentals, ...sandysRentals], []);

  const vehiclePaymentMap = useMemo(() => {
    const map = new Map<string, number>();
    allVehicles.forEach(vehicle => {
      const paymentValue = vehicle.monthlyPay;
      const payment = typeof paymentValue === 'string' ? parseFloat(String(paymentValue).replace(/,/g, '')) : paymentValue;
      if (vehicle.name && !isNaN(payment) && payment > 0) {
        map.set(vehicle.name.trim(), payment);
      }
    });
    return map;
  }, [allVehicles]);

  const vehicleDataMap = useMemo(() => {
    const map = new Map<string, { plates: string[], primaryPlate: string }>();
    allVehicles.forEach(vehicle => {
        if (vehicle.name) {
            const plates = [normalizePlate(vehicle.licensePlate)];
            if (vehicle.paperPlate) {
                plates.push(normalizePlate(vehicle.paperPlate));
            }
            map.set(vehicle.name.trim().toLowerCase(), {
                plates: [...new Set(plates.filter(p=>p))],
                primaryPlate: vehicle.licensePlate
            });
        }
    });
    return map;
  }, [allVehicles]);

  const handleToggleExpandMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
        const newSet = new Set(prev);
        if (newSet.has(monthKey)) {
            newSet.delete(monthKey);
        } else {
            newSet.add(monthKey);
        }
        return newSet;
    });
  };

  const handleToggleExpandVehicle = (vehicleKey: string) => {
    setExpandedVehicleKey(prev => (prev === vehicleKey ? null : vehicleKey));
  };
  
  useEffect(() => {
    if (rentalRows.length > 0) {
        const { augmentedRentals: newAugmentedRows, unmatchedTollGroups, unassignedTolls } = crossReferenceData(rentalRows, tollCharges, allVehicles);
        setAugmentedRows(newAugmentedRows);
        
        const allUnmatched = [...unmatchedTollGroups.flatMap(g => g.tolls), ...unassignedTolls];
        setUnmatchedTolls(allUnmatched);
        
        const ratesByVehicle: Record<string, number[]> = {};
        const vehiclesWithZeroRate: Set<string> = new Set();
        rentalRows.forEach(row => {
          const vehicle = String(getValue(row, ['Rental Car Assigned', 'Rental Vehicle', 'Vehicle']) || '').trim();
          if (!vehicle) return;
          
          const rateRaw = getValue(row, ['Covered Rental Rate', 'Rental Rate', 'Rate']);
          const rate = parseFloat(String(rateRaw || '0').replace(/[^0-9.-]+/g, ""));
          
          if (!isNaN(rate) && rate > 0) {
            if (!ratesByVehicle[vehicle]) ratesByVehicle[vehicle] = [];
            ratesByVehicle[vehicle].push(rate);
          } else if (isNaN(rate) || rate === 0) {
            vehiclesWithZeroRate.add(vehicle);
          }
        });

        const initialOverrides: Record<string, string> = {};
        vehiclesWithZeroRate.forEach(vehicle => {
          const median = calculateMedian(ratesByVehicle[vehicle] || []);
          initialOverrides[vehicle] = median.toFixed(2);
        });
        setRateOverrides(initialOverrides);
        
    } else {
        setAugmentedRows([]);
        setUnmatchedTolls([]);
        setAnalysis(null);
    }
  }, [rentalRows, tollCharges, allVehicles]);

  const runAnalysis = useCallback(() => {
    setIsLoading(true);
    setError(null);

    setTimeout(() => {
        const newAnalysis: AnalysisData = {
            totalRentalIncome: 0,
            totalRentals: 0,
            totalTolls: 0,
            totalUnassignedTolls: 0,
            incomeByMonth: {},
        };

        let processedItemsCount = 0;
        augmentedRows.forEach(row => {
            const vehicle = String(getValue(row, ['Rental Car Assigned', 'Rental Vehicle', 'Vehicle']) || '').trim();
            if (!vehicle || vehicle.toLowerCase() === 'no rental') return;

            processedItemsCount++;

            const periodStartDate = normalizeToDate(getValue(row, ['Rental Start Date', 'Rental Period Start', 'Rental Period STart', 'Start Date']));
            const monthKey = getMonthKeyFromDate(periodStartDate);

            const actualRateRaw = getValue(row, ['Covered Rental Rate', 'Rental Rate', 'Rate']);
            const actualRate = parseFloat(String(actualRateRaw || '0').replace(/[^0-9.-]+/g, ""));
            
            const daysRaw = getValue(row, ['Total Rental Dates', 'Rental Days Total', 'Days']);
            const daysParsed = parseInt(String(daysRaw), 10);
            const days = isNaN(daysParsed) ? 1 : daysParsed;

            let effectiveRate = 0;
            let isRowEstimated = false;

            if (!isNaN(actualRate) && actualRate > 0) {
                effectiveRate = actualRate;
            } else {
                effectiveRate = parseFloat(rateOverrides[vehicle]) || 0;
                isRowEstimated = true;
            }

            const rowIncome = effectiveRate * days;
            const paidRowIncome = (!isNaN(actualRate) && actualRate > 0) ? actualRate * days : 0;
            const rowTolls = row._totalTollAmount || 0;
            
            newAnalysis.totalRentalIncome += rowIncome;
            newAnalysis.totalTolls += rowTolls;
            newAnalysis.totalRentals += 1;

            if (!newAnalysis.incomeByMonth[monthKey]) {
                newAnalysis.incomeByMonth[monthKey] = {
                    totalRentalIncome: 0,
                    totalRentals: 0,
                    totalTolls: 0,
                    incomeByVehicle: {},
                };
            }
            const monthAnalysis = newAnalysis.incomeByMonth[monthKey]!;
            monthAnalysis.totalRentalIncome += rowIncome;
            monthAnalysis.totalTolls += rowTolls;
            monthAnalysis.totalRentals += 1;

            if (!monthAnalysis.incomeByVehicle[vehicle]) {
                monthAnalysis.incomeByVehicle[vehicle] = {
                    totalIncome: 0, totalPaidIncome: 0, rentalCount: 0, freeRentalCount: 0, minRate: Infinity, maxRate: -Infinity, isEstimated: false, totalDays: 0, totalTolls: 0, averageRate: 0, _nonZeroRateSum: 0, _nonZeroRateCount: 0
                };
            }
            
            const vehicleStats = monthAnalysis.incomeByVehicle[vehicle]!;
            vehicleStats.totalIncome += rowIncome;
            vehicleStats.totalPaidIncome += paidRowIncome;
            vehicleStats.totalTolls += rowTolls;
            vehicleStats.rentalCount += 1;
            vehicleStats.totalDays += days;

            if (isRowEstimated) {
                vehicleStats.isEstimated = true;
                vehicleStats.freeRentalCount += 1;
            }
            if (!isNaN(actualRate) && actualRate > 0) {
                vehicleStats.minRate = Math.min(vehicleStats.minRate, actualRate);
                vehicleStats.maxRate = Math.max(vehicleStats.maxRate, actualRate);
                vehicleStats._nonZeroRateSum! += actualRate;
                vehicleStats._nonZeroRateCount! += 1;
            }
        });

        if (processedItemsCount === 0 && augmentedRows.length > 0) {
            setError("No valid rental entries found. Check the 'Rental Car Assigned' column in your data.");
            setAnalysis(null);
            setIsLoading(false);
            return;
        }

        newAnalysis.totalUnassignedTolls = unmatchedTolls.reduce((sum, toll) => sum + toll.amount, 0);

        const sortedMonthKeys = Object.keys(newAnalysis.incomeByMonth).sort().reverse();
        const sortedIncomeByMonth: Record<string, MonthlyAnalysis> = {};
        sortedMonthKeys.forEach(monthKey => {
            const monthAnalysis = newAnalysis.incomeByMonth[monthKey]!;
            for (const vehicle in monthAnalysis.incomeByVehicle) {
                const stats = monthAnalysis.incomeByVehicle[vehicle]!;
                if (stats.minRate === Infinity) stats.minRate = 0;
                if (stats.maxRate === -Infinity) stats.maxRate = 0;

                if (stats._nonZeroRateCount && stats._nonZeroRateCount > 0) {
                    stats.averageRate = stats._nonZeroRateSum! / stats._nonZeroRateCount!;
                } else {
                    stats.averageRate = parseFloat(rateOverrides[vehicle]) || 0;
                }
                delete stats._nonZeroRateSum;
                delete stats._nonZeroRateCount;
            }
            const sortedVehicles = Object.entries(monthAnalysis.incomeByVehicle).sort(([, a], [, b]) => b.totalIncome - a.totalIncome);
            monthAnalysis.incomeByVehicle = Object.fromEntries(sortedVehicles);
            sortedIncomeByMonth[monthKey] = monthAnalysis;
        });
        newAnalysis.incomeByMonth = sortedIncomeByMonth;

        setAnalysis(newAnalysis);
        setIsLoading(false);
    }, 50);
  }, [augmentedRows, rateOverrides, unmatchedTolls]);

  const handleOverrideChange = (vehicleName: string, newRate: string) => {
    setRateOverrides(prev => ({...prev, [vehicleName]: newRate}));
  };

  const renderInitialView = () => (
    <div className="text-center">
      <h2 className="text-2xl font-semibold text-app-textPrimary">Claims Dashboard</h2>
      <p className="mt-2 text-sm text-app-textSecondary max-w-lg mx-auto">
        This dashboard analyzes claim data uploaded in the 'Claim Data' and 'Toll Data' tabs.
      </p>
      {rentalRows.length === 0 ? (
        <div className="mt-6 p-4 bg-app-background border border-app-border rounded-lg">
            <p className="text-app-textSecondary">Please go to the <b className="text-app-textPrimary">'Claim Data'</b> tab to load your Excel sheet.</p>
        </div>
      ) : (
        <div className="mt-8">
            <Button
                variant="primary"
                size="lg"
                onClick={runAnalysis}
                disabled={isLoading}
                leftIcon={<ChartBarIcon className="w-5 h-5"/>}
            >
                {isLoading ? "Analyzing..." : `Run Analysis on ${rentalRows.length} Records`}
            </Button>
        </div>
      )}
    </div>
  );

  const StatCard: React.FC<{ label: string; value: string; className?: string; valueClassName?: string }> = ({ label, value, className, valueClassName }) => (
    <div className={`bg-app-background p-3 rounded-lg border border-app-border ${className}`}>
        <p className="text-xs text-app-textSecondary truncate">{label}</p>
        <p className={`text-base font-bold text-app-textPrimary ${valueClassName || ''}`}>{value}</p>
    </div>
  );

  const renderDashboard = (data: AnalysisData) => {
    const totalTolls = data.totalTolls + data.totalUnassignedTolls;
    const netIncome = data.totalRentalIncome - totalTolls;
    return (
      <div className="w-full">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h2 className="text-2xl font-bold text-brand-primary">Claim Data Analysis</h2>
          <div className="text-right">
             <Button variant="outline" onClick={() => setAnalysis(null)}>
                Back to Setup
             </Button>
          </div>
        </div>

        {/* Financial Summary Table */}
        <div className="mb-8">
            <div className="overflow-hidden rounded-lg shadow-lg border border-invoice-borderColor">
              <table className="min-w-full">
                <thead className="bg-invoice-headerBg">
                  <tr>
                    <th scope="col" colSpan="2" className="px-6 py-4 text-left text-lg font-semibold text-white tracking-wider">
                      Overall Financial Summary
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-invoice-background divide-y divide-invoice-borderColor">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-base font-medium text-invoice-textPrimary">Total Rental Income</td>
                    <td className="px-6 py-4 whitespace-nowrap text-lg font-bold text-right text-emerald-500">
                        {data.totalRentalIncome.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-base font-medium text-invoice-textPrimary">Total Toll Charges</td>
                    <td className="px-6 py-4 whitespace-nowrap text-lg font-bold text-right text-danger">
                        -{(totalTolls).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-base font-medium text-invoice-textPrimary">Net Income</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-lg font-bold text-right ${ netIncome >= 0 ? 'text-emerald-500' : 'text-danger'}`}>
                        {netIncome.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
        </div>


        {/* Monthly Data */}
        <div className="bg-app-surface p-6 rounded-lg border border-app-border">
          <h3 className="text-xl font-semibold mb-4 text-app-textPrimary">Analysis by Month</h3>
          <div className="space-y-4">
            {Object.entries(data.incomeByMonth).map(([monthKey, monthlyData]) => {
                const isMonthExpanded = expandedMonths.has(monthKey);
                const maxIncomeInMonth = Math.max(...Object.values(monthlyData.incomeByVehicle).map(v => v.totalIncome), 1);

                return (
                    <div key={monthKey} className="bg-app-background p-4 rounded-lg border border-app-border">
                        <div className="flex justify-between items-center cursor-pointer" onClick={() => handleToggleExpandMonth(monthKey)}>
                            <div className="flex-grow">
                                <p className="font-semibold text-lg text-app-textPrimary">{formatMonthKey(monthKey)}</p>
                                <p className="text-sm text-app-textSecondary">{monthlyData.totalRentals} records</p>
                            </div>
                            <div className="text-right mr-4">
                                <p className="text-lg font-bold text-brand-primary">${monthlyData.totalRentalIncome.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                                <p className="text-sm text-app-textSecondary">Est. Income</p>
                                 {monthlyData.totalTolls > 0 && <p className="text-sm text-danger">(${monthlyData.totalTolls.toFixed(2)} tolls)</p>}
                            </div>
                            <ChevronDownIcon className={`w-6 h-6 text-app-textSecondary flex-shrink-0 transform transition-transform duration-300 ${isMonthExpanded ? 'rotate-180' : ''}`} />
                        </div>

                        <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isMonthExpanded ? 'max-h-[5000px] mt-4 pt-4 border-t border-app-border' : 'max-h-0'}`}>
                            {Object.entries(monthlyData.incomeByVehicle).map(([vehicleName, vehicleData]) => {
                                const vehicleKey = `${monthKey}-${vehicleName}`;
                                const isVehicleExpanded = expandedVehicleKey === vehicleKey;
                                const barWidth = maxIncomeInMonth > 0 ? (vehicleData.totalIncome / maxIncomeInMonth) * 100 : 0;
                                const hasOverride = vehicleName in rateOverrides;

                                return (
                                    <div key={vehicleKey} className="bg-app-surface/50 p-3 rounded-lg border border-app-border mb-3">
                                        <div className="flex justify-between items-center cursor-pointer" onClick={() => handleToggleExpandVehicle(vehicleKey)}>
                                            <div className="flex-grow">
                                                <div className="flex justify-between items-center mb-1 text-sm flex-wrap gap-x-3 gap-y-1">
                                                    <span className="font-semibold text-app-textPrimary mr-2">{vehicleName}</span>
                                                    <div className="font-bold text-brand-primary flex items-center">
                                                        {vehicleData.isEstimated && <span className="text-xs text-amber-400 mr-1.5">(Est.)</span>}
                                                        ${vehicleData.totalIncome.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                    </div>
                                                </div>
                                                <div className="w-full bg-app-background rounded-full h-3 border border-app-border">
                                                    <div className="bg-brand-primary h-full rounded-full transition-all duration-500" style={{ width: `${barWidth}%` }} title={`$${vehicleData.totalIncome.toLocaleString()}`}></div>
                                                </div>
                                            </div>
                                            <ChevronDownIcon className={`w-5 h-5 text-app-textSecondary ml-3 flex-shrink-0 transform transition-transform duration-300 ${isVehicleExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                        
                                        <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isVehicleExpanded ? 'max-h-[2000px] mt-3 pt-3 border-t border-app-border' : 'max-h-0'}`}>
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                                                <StatCard label="Total Records" value={String(vehicleData.rentalCount)} />
                                                <StatCard label="Free Rentals" value={`${vehicleData.freeRentalCount}`} className={vehicleData.freeRentalCount > 0 ? 'bg-amber-500/10 border-amber-500/30' : ''} />
                                                <StatCard label="Total Days Rented" value={String(vehicleData.totalDays)} />
                                                <StatCard label="Avg. Rate (Paid)" value={`$${vehicleData.averageRate.toFixed(2)}`} />
                                                <StatCard label="Toll Costs" value={`$${vehicleData.totalTolls.toFixed(2)}`} className={vehicleData.totalTolls > 0 ? 'bg-danger/10 border-danger/30' : ''} valueClassName={vehicleData.totalTolls > 0 ? 'text-danger' : ''}/>
                                            </div>

                                            {hasOverride && (
                                                <div className="flex items-center space-x-1.5 text-app-textSecondary flex-wrap mb-4" title="This vehicle had $0 rentals. Rate is editable.">
                                                    <PencilIcon className="w-4 h-4 text-amber-400"/>
                                                    <label htmlFor={`rate-override-${vehicleName}`} className="text-xs">Est. Rate:</label>
                                                    <input id={`rate-override-${vehicleName}`} type="number" value={rateOverrides[vehicleName] || ''} onChange={e => handleOverrideChange(vehicleName, e.target.value)}
                                                        className="w-20 p-1 text-sm bg-app-surface border border-app-border rounded-md focus:ring-brand-primary focus:border-brand-primary text-app-textPrimary" />
                                                </div>
                                            )}
                                            
                                            {(() => {
                                                const monthlyPayment = vehiclePaymentMap.get(vehicleName) || 0;
                                                if (monthlyPayment > 0) {
                                                    const totalPaidIncome = vehicleData.totalPaidIncome;
                                                    const netProfitPaidOnly = totalPaidIncome - monthlyPayment - vehicleData.totalTolls;
                                                    const netResultInclFree = vehicleData.totalIncome - monthlyPayment - vehicleData.totalTolls;

                                                    return (
                                                        <>
                                                            <h4 className="font-semibold text-app-textPrimary mb-2 mt-4">Profitability Analysis</h4>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                                                                <StatCard label="Paid Rental Income" value={`$${totalPaidIncome.toFixed(2)}`} />
                                                                 <StatCard
                                                                    label="Net (Paid Only)"
                                                                    value={`${netProfitPaidOnly >= 0 ? '+' : ''}$${netProfitPaidOnly.toFixed(2)}`}
                                                                    valueClassName={netProfitPaidOnly >= 0 ? 'text-emerald-500' : 'text-danger'}
                                                                />
                                                                <StatCard label="Total Est. Income" value={`$${vehicleData.totalIncome.toFixed(2)}`} />
                                                                <StatCard
                                                                    label="Net (Incl. Free)"
                                                                    value={`${netResultInclFree >= 0 ? '+' : ''}$${netResultInclFree.toFixed(2)}`}
                                                                    valueClassName={netResultInclFree >= 0 ? 'text-emerald-500' : 'text-danger'}
                                                                />
                                                            </div>
                                                        </>
                                                    );
                                                }
                                                return null;
                                            })()}

                                            <h4 className="font-semibold text-app-textPrimary mb-2 mt-4">Individual Rental Records this Month</h4>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="text-xs text-app-textSecondary uppercase bg-app-surface/50">
                                                        <tr>
                                                            <th className="px-4 py-2">Insured</th>
                                                            <th className="px-4 py-2">Plate</th>
                                                            <th className="px-4 py-2">Period</th>
                                                            <th className="px-4 py-2 text-right">Days</th>
                                                            <th className="px-4 py-2 text-right">Rate</th>
                                                            <th className="px-4 py-2 text-right">Tolls</th>
                                                            <th className="px-4 py-2 text-right">Income</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="text-app-textPrimary">
                                                        {augmentedRows.filter(r => getMonthKeyFromDate(normalizeToDate(getValue(r, ['Rental Start Date', 'Rental Period Start', 'Rental Period STart', 'Start Date']))) === monthKey && String(getValue(r, ['Rental Car Assigned', 'Rental Vehicle', 'Vehicle']) || '').trim() === vehicleName).map((row, index) => {
                                                            const actualRateRaw = getValue(row, ['Covered Rental Rate', 'Rental Rate', 'Rate']);
                                                            const actualRate = parseFloat(String(actualRateRaw || '0').replace(/[^0-9.-]+/g, ""));
                                                            
                                                            const daysRaw = getValue(row, ['Total Rental Dates', 'Rental Days Total', 'Days']);
                                                            const daysParsed = parseInt(String(daysRaw), 10);
                                                            const days = isNaN(daysParsed) ? 1 : daysParsed;

                                                            const isOverride = isNaN(actualRate) || actualRate === 0;
                                                            const rateUsed = isOverride ? (parseFloat(rateOverrides[vehicleName]) || 0) : actualRate;
                                                            const income = rateUsed * days;
                                                            const tolls = Number(row._totalTollAmount) || 0;
                                                            
                                                            const periodStart = normalizeToDate(getValue(row, ['Rental Start Date', 'Rental Period Start', 'Rental Period STart', 'Start Date']));
                                                            const periodEnd = normalizeToDate(getValue(row, ['Rental End Date', 'Rental Period ENd', 'Rental Period End', 'End Date']));
                                                            
                                                            const rentalVehicleName = String(getValue(row, ['Rental Car Assigned', 'Rental Vehicle', 'Vehicle']) || '').trim().toLowerCase();
                                                            let displayPlate = getValue(row, ['License Plate', 'Plate']);
                                                            if (!displayPlate && rentalVehicleName && vehicleDataMap.has(rentalVehicleName)) {
                                                                displayPlate = vehicleDataMap.get(rentalVehicleName)!.primaryPlate;
                                                            }


                                                            return (
                                                            <tr key={`${vehicleKey}-${index}`} className="border-b border-app-border last:border-b-0 hover:bg-app-surface/50">
                                                                <td className="px-4 py-2">
                                                                    <div className="flex items-center">
                                                                        <span>{getValue(row, ['Insured Name', 'Customer']) || 'N/A'}</span>
                                                                        {isOverride && <span className="ml-2 text-xs font-semibold bg-amber-400/20 text-amber-500 rounded-full px-2 py-0.5">Free</span>}
                                                                    </div>
                                                                    <div className="text-xs text-app-textSecondary">Claim #: {getValue(row, ['Claim Number', 'Claim #']) || 'N/A'}</div>
                                                                </td>
                                                                <td className="px-4 py-2 font-mono text-xs">{normalizePlate(displayPlate) || 'N/A'}</td>
                                                                <td className="px-4 py-2">{formatDateFromDate(periodStart)} - {formatDateFromDate(periodEnd)}</td>
                                                                <td className="px-4 py-2 text-right">{days}</td>
                                                                <td className={`px-4 py-2 text-right ${isOverride ? 'text-amber-400' : ''}`} title={isOverride ? 'Estimated rate' : 'Actual rate'}>${rateUsed.toFixed(2)}</td>
                                                                <td className="px-4 py-2 text-right">
                                                                    {tolls > 0 ? (
                                                                        <button
                                                                            onClick={() => {
                                                                                setSelectedTollsForModal(row._tolls || []);
                                                                                setIsTollModalOpen(true);
                                                                            }}
                                                                            className="text-danger hover:underline hover:font-bold disabled:no-underline disabled:cursor-default"
                                                                            disabled={!row._tolls || row._tolls.length === 0}
                                                                        >
                                                                            ${tolls.toFixed(2)}
                                                                        </button>
                                                                    ) : (
                                                                        <span>$0.00</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-2 text-right font-medium">${income.toFixed(2)}</td>
                                                            </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-app-surface p-4 md:p-6 rounded-lg shadow-xl border border-app-border min-h-[60vh] flex items-center justify-center w-full">
      {isLoading && <Spinner text="Processing..." />}
      {!isLoading && error && <div className="text-center text-danger"><p className="font-bold">An error occurred:</p><p>{error}</p><Button variant="primary" onClick={() => setError(null)} className="mt-4">Try Again</Button></div>}
      {!isLoading && !error && (analysis ? renderDashboard(analysis) : renderInitialView())}
      {isTollModalOpen && (
        <Modal
            isOpen={isTollModalOpen}
            onClose={() => setIsTollModalOpen(false)}
            title="Toll Charge Details"
            size="lg"
        >
            <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-app-textSecondary uppercase bg-app-surface/50 sticky top-0">
                        <tr>
                            <th className="px-4 py-2">Date</th>
                            <th className="px-4 py-2 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="text-app-textPrimary">
                        {selectedTollsForModal.map((toll, index) => (
                            <tr key={index} className="border-b border-app-border last:border-b-0">
                                <td className="px-4 py-2">{formatDateFromDate(toll.date)}</td>
                                <td className="px-4 py-2 text-right">${toll.amount.toFixed(2)}</td>
                            </tr>
                        ))}
                        <tr className="font-bold bg-app-surface">
                        <td className="px-4 py-2 text-right">Total</td>
                        <td className="px-4 py-2 text-right">${selectedTollsForModal.reduce((sum, toll) => sum + toll.amount, 0).toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </Modal>
      )}
    </div>
  );
};
