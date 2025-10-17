import React, { useState, useMemo, useRef, useEffect } from 'react';
import { personalCars, armandosRentals, sandysRentals } from '../data/fleetData';
import { TruckIcon, ChevronDownIcon, DocumentArrowDownIcon } from './IconComponents';
import { TollCharge, VehicleDetail } from '../types';
import { generateVehicleReportPdfBlob } from '../services/pdfService';
import { saveBlobAsFile } from '../utilityFunctions';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartData } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Button } from './Button';
import { Spinner } from './Spinner';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface FleetPageProps {
  rentalRows: any[];
  tollCharges: TollCharge[];
}

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
  let normalized = String(plate).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.startsWith('TX')) {
    normalized = normalized.substring(2);
  }
  return normalized;
};

const StatCard: React.FC<{ label: string; value: string; className?: string; }> = ({ label, value, className = '' }) => (
    <div className={`bg-app-background p-3 rounded-lg border border-app-border ${className}`}>
        <p className="text-xs text-app-textSecondary truncate">{label}</p>
        <p className="text-lg font-bold text-app-textPrimary">{value}</p>
    </div>
);

const OffscreenChartRenderer: React.FC<{
    vehicle: VehicleDetail;
    rentals: any[];
    tolls: TollCharge[];
    onReportGenerated: () => void;
}> = ({ vehicle, rentals, tolls, onReportGenerated }) => {
    const chartRef = useRef<ChartJS<'bar'>>(null);

    const chartData = useMemo(() => {
        const monthlyData: Record<string, { income: number, tolls: number }> = {};

        rentals.forEach(row => {
            const startDate = normalizeToDate(getValue(row, ['Rental Start Date', 'Rental Period Start']));
            if (!startDate) return;
            const monthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
            const rate = parseFloat(String(getValue(row, ['Covered Rental Rate', 'Rental Rate']) || '0').replace(/[^0-9.-]+/g, ""));
            const days = parseInt(String(getValue(row, ['Total Rental Dates', 'Rental Days Total'])), 10) || 1;
            const income = rate * days;
            
            if (!monthlyData[monthKey]) monthlyData[monthKey] = { income: 0, tolls: 0 };
            monthlyData[monthKey].income += income;
        });

        tolls.forEach(toll => {
            if (!toll.date) return;
            const monthKey = `${toll.date.getFullYear()}-${String(toll.date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyData[monthKey]) monthlyData[monthKey] = { income: 0, tolls: 0 };
            monthlyData[monthKey].tolls += toll.amount;
        });

        const sortedMonths = Object.keys(monthlyData).sort();

        return {
            labels: sortedMonths.map(key => {
                const [year, month] = key.split('-');
                return new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
            }),
            datasets: [
                {
                    label: 'Rental Income',
                    data: sortedMonths.map(key => monthlyData[key].income),
                    backgroundColor: '#84CC16',
                },
                {
                    label: 'Toll Costs',
                    data: sortedMonths.map(key => monthlyData[key].tolls),
                    backgroundColor: '#EF4444',
                },
            ],
        };
    }, [rentals, tolls]);

    useEffect(() => {
        const generateReport = async () => {
            setTimeout(async () => {
                const chartImage = chartRef.current?.toBase64Image() || null;
                
                const summary = {
                    totalIncome: rentals.reduce((sum, row) => sum + (parseFloat(String(getValue(row, ['Covered Rental Rate', 'Rental Rate']) || '0').replace(/[^0-9.-]+/g, "")) * (parseInt(String(getValue(row, ['Total Rental Dates', 'Rental Days Total'])), 10) || 1)), 0),
                    totalTolls: tolls.reduce((sum, toll) => sum + toll.amount, 0),
                    rentalCount: rentals.length,
                    tollCount: tolls.length,
                };

                const blob = await generateVehicleReportPdfBlob(vehicle, summary, rentals, tolls, chartImage);
                if (blob) {
                    saveBlobAsFile(blob, `Report-${vehicle.name.replace(/ /g, '_')}.pdf`);
                }
                onReportGenerated();
            }, 500);
        };

        generateReport();
    }, [chartData, vehicle, rentals, tolls, onReportGenerated]);

    return (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '800px', height: '400px', background: '#fff', padding: '1rem' }}>
            <Bar
                ref={chartRef}
                options={{
                    responsive: true,
                    plugins: { legend: { position: 'top' }, title: { display: true, text: 'Monthly Performance' } },
                    animation: { duration: 0 }
                }}
                data={chartData as ChartData<'bar'>}
            />
        </div>
    );
};

const VehicleHistory: React.FC<{ vehicle: VehicleDetail, rentals: any[], tolls: TollCharge[] }> = ({ vehicle, rentals, tolls }) => {
    const totalRentalIncome = useMemo(() => {
        return rentals.reduce((sum, row) => {
            const rate = parseFloat(String(getValue(row, ['Covered Rental Rate', 'Rental Rate', 'Rate']) || '0').replace(/[^0-9.-]+/g, ""));
            const days = parseInt(String(getValue(row, ['Total Rental Dates', 'Rental Days Total', 'Days'])), 10) || 1;
            return sum + (rate * days);
        }, 0);
    }, [rentals]);

    const totalTollAmount = useMemo(() => {
        return tolls.reduce((sum, toll) => sum + toll.amount, 0);
    }, [tolls]);

    return (
        <div className="mt-4 pt-4 border-t border-app-border space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Rentals" value={rentals.length.toLocaleString()} />
                <StatCard label="Total Tolls" value={tolls.length.toLocaleString()} />
                <StatCard label="Total Rental Income" value={`$${totalRentalIncome.toLocaleString('en-US', {minimumFractionDigits: 2})}`} className="text-brand-primary" />
                <StatCard label="Total Toll Charges" value={`$${totalTollAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}`} className="text-danger" />
            </div>

            {/* Rental History Table */}
            <div>
                <h4 className="text-lg font-semibold text-app-textPrimary mb-2">Rental History</h4>
                <div className="overflow-x-auto max-h-96 bg-app-background rounded-md border border-app-border">
                    {rentals.length > 0 ? (
                        <table className="min-w-full text-sm">
                            <thead className="text-xs text-app-textSecondary uppercase bg-app-surface/50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2">Insured / Claim #</th>
                                    <th className="px-4 py-2">Plate</th>
                                    <th className="px-4 py-2">Period</th>
                                    <th className="px-4 py-2 text-right">Days</th>
                                    <th className="px-4 py-2 text-right">Rate</th>
                                    <th className="px-4 py-2 text-right">Income</th>
                                </tr>
                            </thead>
                            <tbody className="text-app-textPrimary">
                                {rentals.map((row, idx) => {
                                    const rate = parseFloat(String(getValue(row, ['Covered Rental Rate', 'Rental Rate', 'Rate']) || '0').replace(/[^0-9.-]+/g, ""));
                                    const days = parseInt(String(getValue(row, ['Total Rental Dates', 'Rental Days Total', 'Days'])), 10) || 1;
                                    const income = rate * days;
                                    const periodStart = normalizeToDate(getValue(row, ['Rental Start Date', 'Rental Period Start', 'Rental Period STart']));
                                    const periodEnd = normalizeToDate(getValue(row, ['Rental End Date', 'Rental Period ENd', 'Rental Period End']));
                                    const plateFromRow = getValue(row, ['License Plate', 'Plate']);
                                    const displayPlate = plateFromRow || vehicle.licensePlate;
                                    return (
                                        <tr key={idx} className="border-b border-app-border last:border-0 hover:bg-app-surface/50">
                                            <td className="px-4 py-2">
                                                <div>{getValue(row, ['Insured Name']) || 'N/A'}</div>
                                                <div className="text-xs text-app-textSecondary">{getValue(row, ['Claim Number']) || 'N/A'}</div>
                                            </td>
                                            <td className="px-4 py-2 font-mono text-xs">{normalizePlate(displayPlate)}</td>
                                            <td className="px-4 py-2">{formatDate(periodStart)} - {formatDate(periodEnd)}</td>
                                            <td className="px-4 py-2 text-right">{days}</td>
                                            <td className="px-4 py-2 text-right">${rate.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right font-medium">${income.toFixed(2)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : <p className="p-4 text-app-textSecondary text-center">No rental history found for this vehicle.</p>}
                </div>
            </div>
            
            {/* Toll History Table */}
            <div>
                <h4 className="text-lg font-semibold text-app-textPrimary mb-2">Toll History</h4>
                <div className="overflow-x-auto max-h-96 bg-app-background rounded-md border border-app-border">
                {tolls.length > 0 ? (
                    <table className="min-w-full text-sm">
                        <thead className="text-xs text-app-textSecondary uppercase bg-app-surface/50 sticky top-0">
                            <tr>
                                <th className="px-4 py-2">Date</th>
                                <th className="px-4 py-2">Location</th>
                                <th className="px-4 py-2 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="text-app-textPrimary">
                            {tolls.map((toll, idx) => (
                                <tr key={idx} className="border-b border-app-border last:border-0 hover:bg-app-surface/50">
                                    <td className="px-4 py-2">{formatDate(toll.date)}</td>
                                    <td className="px-4 py-2 truncate max-w-xs">{toll.location}</td>
                                    <td className="px-4 py-2 text-right text-danger font-medium">${toll.amount.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : <p className="p-4 text-app-textSecondary text-center">No toll history found for this vehicle.</p>}
                </div>
            </div>
        </div>
    );
};

const VehicleCard: React.FC<{ vehicle: VehicleDetail, rentalRows: any[], tollCharges: TollCharge[] }> = ({ vehicle, rentalRows, tollCharges }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    const { vehicleRentals, vehicleTolls } = useMemo(() => {
        const fleetPlates = [normalizePlate(vehicle.licensePlate), normalizePlate(vehicle.paperPlate)].filter(Boolean);
        const uniqueFleetPlates = [...new Set(fleetPlates)];
        const fleetName = vehicle.name.trim().toLowerCase();

        const rentals = rentalRows.filter(row => {
            const rentalPlateRaw = getValue(row, ['License Plate', 'Plate']);
            if (rentalPlateRaw) {
                const rentalPlates = String(rentalPlateRaw).split('/').map(p => normalizePlate(p.trim()));
                if (rentalPlates.some(rp => uniqueFleetPlates.includes(rp))) return true;
            }
            
            const rentalVehicleName = String(getValue(row, ['Rental Car Assigned', 'Rental Vehicle', 'Vehicle']) || '').trim().toLowerCase();
            return !rentalPlateRaw && rentalVehicleName.startsWith(fleetName);
        });

        const tolls = tollCharges.filter(toll => {
            if (!toll.licensePlate) return false;
            const tollPlate = normalizePlate(toll.licensePlate);
            return uniqueFleetPlates.includes(tollPlate);
        });

        return { vehicleRentals: rentals, vehicleTolls: tolls };
    }, [rentalRows, tollCharges, vehicle.licensePlate, vehicle.paperPlate, vehicle.name]);

    return (
      <>
        {isGeneratingReport && (
            <OffscreenChartRenderer 
                vehicle={vehicle} 
                rentals={vehicleRentals} 
                tolls={vehicleTolls} 
                onReportGenerated={() => setIsGeneratingReport(false)} 
            />
        )}
        <div className="bg-app-surface p-4 rounded-lg shadow-lg border border-app-border transition-all">
            <div className="flex justify-between items-start cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex-grow">
                    <h3 className="text-xl font-semibold text-brand-primary">{vehicle.name}</h3>
                    <p className="text-sm text-app-textSecondary">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                    <p className="text-xs text-app-textSecondary font-mono mt-1">
                        VIN: {vehicle.vin} &bull; Plate: {normalizePlate(vehicle.licensePlate)} / {normalizePlate(vehicle.paperPlate)}
                    </p>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="text-right">
                        <p className="text-sm">{vehicleRentals.length} Rentals</p>
                        <p className="text-sm">{vehicleTolls.length} Tolls</p>
                    </div>
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={(e) => { e.stopPropagation(); setIsGeneratingReport(true); }}
                        disabled={isGeneratingReport}
                        leftIcon={isGeneratingReport ? <Spinner size="sm"/> : <DocumentArrowDownIcon className="w-4 h-4" />}
                    >
                        {isGeneratingReport ? 'Generating...' : 'Report'}
                    </Button>
                    <ChevronDownIcon className={`w-6 h-6 text-app-textSecondary transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </div>
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[5000px]' : 'max-h-0'}`}>
                <VehicleHistory vehicle={vehicle} rentals={vehicleRentals} tolls={vehicleTolls} />
            </div>
        </div>
      </>
    );
};

export const FleetPage: React.FC<FleetPageProps> = ({ rentalRows, tollCharges }) => {
  const vehicleGroups = useMemo(() => [
    { title: "Personal Cars", vehicles: personalCars },
    { title: "Armando's Rentals", vehicles: armandosRentals },
    { title: "Sandy's Rentals", vehicles: sandysRentals }
  ], []);
  
  if (rentalRows.length === 0 && tollCharges.length === 0) {
      return (
          <div className="text-center p-8">
              <TruckIcon className="w-16 h-16 text-app-textSecondary mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-app-textPrimary">Fleet Management</h2>
              <p className="mt-2 text-app-textSecondary">
                  Upload data in the 'Rental Data' and 'Toll Data' tabs to see vehicle histories.
              </p>
          </div>
      )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <TruckIcon className="w-8 h-8 text-brand-primary" />
        <h2 className="text-3xl font-bold text-app-textPrimary">Fleet Management</h2>
      </div>
      <div className="space-y-8">
          {vehicleGroups.map(group => (
              <div key={group.title}>
                  <h3 className="text-2xl font-semibold text-app-textSecondary mb-4 pb-2 border-b border-app-border">{group.title}</h3>
                  <div className="space-y-4">
                      {group.vehicles.map(vehicle => (
                          <VehicleCard key={vehicle.vin} vehicle={vehicle} rentalRows={rentalRows} tollCharges={tollCharges} />
                      ))}
                  </div>
              </div>
          ))}
      </div>
    </div>
  );
};