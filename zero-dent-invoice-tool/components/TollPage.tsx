
import React, { useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { TollCharge, VehicleDetail } from '../types';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { ArrowUpTrayIcon, CreditCardIcon } from './IconComponents';
import { personalCars, armandosRentals, sandysRentals } from '../data/fleetData';

interface TollPageProps {
  onTollsParsed: (tolls: TollCharge[]) => void;
  initialTolls: TollCharge[];
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

export const TollPage: React.FC<TollPageProps> = ({ onTollsParsed, initialTolls }) => {
  const [tollFile, setTollFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const handleTollParse = useCallback((file: File) => {
    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            if (!firstSheetName) throw new Error("Toll Excel file has no sheets.");

            const sheet = workbook.Sheets[firstSheetName];
            const rows = XLSX.utils.sheet_to_json<any>(sheet);
            
            const parsedTolls: TollCharge[] = rows.map((row): TollCharge | null => {
                const plate = String(getValue(row, ['Plate', 'License Plate']) || '').trim();
                // Prioritize the transaction entry date and ignore the posted date.
                const date = normalizeToDate(getValue(row, ['Transaction Entry Date/Time', 'Transaction Date/Time', 'Transaction Date']));
                
                const amountRaw = getValue(row, ['Transaction Amount', 'Amount', 'Charge']);
                const amountStr = String(amountRaw || '0').replace(/[^0-9.-]+/g, "");
                const amount = Math.abs(parseFloat(amountStr));

                if (plate && date && !isNaN(amount) && amount > 0) {
                    return {
                        licensePlate: plate,
                        date,
                        amount,
                        location: String(getValue(row, ['Location']) || ''),
                        transactionId: String(getValue(row, ['Transaction ID']) || ''),
                        transactionType: String(getValue(row, ['Transaction Type']) || ''),
                    };
                }
                return null;
            }).filter((t): t is TollCharge => t !== null);

            onTollsParsed(parsedTolls);
        } catch (readErr) {
            setError(readErr instanceof Error ? `Toll Parsing Error: ${readErr.message}` : 'Could not parse the toll Excel file.');
        } finally {
            setIsLoading(false);
        }
    };
    reader.onerror = () => { setIsLoading(false); setError("Failed to read toll file."); };
    reader.readAsArrayBuffer(file);
  }, [onTollsParsed]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
      if (!validTypes.includes(file.type)) {
        setError('Invalid file type. Please upload an Excel (.xlsx, .xls) file.');
        return;
      }
      setTollFile(file);
      handleTollParse(file);
    }
  };

  const plateToVehicleNameMap = useMemo(() => {
    const allVehicles: VehicleDetail[] = [...personalCars, ...armandosRentals, ...sandysRentals];
    const map = new Map<string, string>();
    allVehicles.forEach(vehicle => {
        if (vehicle.licensePlate) {
            map.set(normalizePlate(vehicle.licensePlate), vehicle.name);
        }
        if (vehicle.paperPlate) {
            map.set(normalizePlate(vehicle.paperPlate), vehicle.name);
        }
    });
    return map;
  }, []);


  const groupedTolls = useMemo(() => {
    const grouped: Record<string, { vehicleName: string | null; tolls: TollCharge[]; displayPlate: string }> = {};
    if (!initialTolls) return grouped;
    
    initialTolls.forEach(toll => {
        const normalized = normalizePlate(toll.licensePlate);
        if (!normalized) return;

        if (!grouped[normalized]) {
            grouped[normalized] = {
                vehicleName: plateToVehicleNameMap.get(normalized) || 'Unassigned Vehicle',
                tolls: [],
                displayPlate: normalized
            };
        }
        grouped[normalized].tolls.push(toll);
    });

    for (const plate in grouped) {
        grouped[plate].tolls.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
    }
    
    const sortedPlates = Object.keys(grouped).sort((a, b) => {
        const nameA = grouped[a].vehicleName || '';
        const nameB = grouped[b].vehicleName || '';
        return nameA.localeCompare(nameB);
    });

    const sortedGrouped: Record<string, { vehicleName: string | null; tolls: TollCharge[]; displayPlate: string }> = {};
    sortedPlates.forEach(plate => {
        sortedGrouped[plate] = grouped[plate];
    });

    return sortedGrouped;
  }, [initialTolls, plateToVehicleNameMap]);

  const totalTollAmount = initialTolls.reduce((sum, toll) => sum + toll.amount, 0);

  return (
    <div className="bg-app-surface p-4 md:p-6 rounded-lg shadow-xl border border-app-border w-full">
      <div className="flex items-center gap-3 mb-6">
        <CreditCardIcon className="w-8 h-8 text-brand-primary" />
        <h2 className="text-3xl font-bold text-app-textPrimary">Toll Management</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Panel: Upload */}
        <div className="md:col-span-1 bg-app-background p-4 rounded-lg border border-app-border">
          <h3 className="text-lg font-semibold mb-3">Upload Toll Sheet</h3>
          <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-app-border border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-app-textSecondary" />
              <label htmlFor="toll-page-upload" className="relative cursor-pointer bg-app-background rounded-md font-medium text-brand-primary hover:text-brand-primaryDarker focus-within:outline-none">
                <span>{isLoading ? 'Processing...' : 'Choose Tolls File'}</span>
                <input id="toll-page-upload" name="toll-page-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".xlsx, .xls" disabled={isLoading} />
              </label>
            </div>
          </div>
          {fileName && !isLoading && <p className="text-sm text-green-500 mt-2">Loaded: {fileName}</p>}
          {isLoading && <Spinner text="Parsing..." />}
          {error && <p className="text-sm text-danger mt-2">{error}</p>}
        </div>

        {/* Right Panel: Data Display */}
        <div className="md:col-span-2 bg-app-background p-4 rounded-lg border border-app-border">
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-app-surface p-4 rounded-lg border border-app-border">
                    <p className="text-sm text-app-textSecondary">Total Transactions</p>
                    <p className="text-2xl font-bold text-app-textPrimary">{initialTolls.length.toLocaleString()}</p>
                </div>
                <div className="bg-app-surface p-4 rounded-lg border border-app-border">
                    <p className="text-sm text-app-textSecondary">Total Amount</p>
                    <p className="text-2xl font-bold text-danger">${totalTollAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            </div>

            <h3 className="text-lg font-semibold mb-3">Loaded Tolls by Vehicle</h3>
            <div className="max-h-[60vh] overflow-y-auto">
                {initialTolls.length > 0 ? (
                    <div className="space-y-4">
                        {/* FIX: Replaced Object.entries with Object.keys to ensure proper type inference on the `data` object. */}
                        {Object.keys(groupedTolls).map((normalizedPlate) => {
                            const data = groupedTolls[normalizedPlate];
                            return (
                            <div key={normalizedPlate} className="bg-app-surface/50 p-3 rounded-lg border border-app-border">
                                <h4 className="font-semibold text-lg text-brand-primary mb-1">{data.vehicleName}</h4>
                                <p className="text-sm text-app-textSecondary mb-2 font-mono">{data.displayPlate}</p>
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-app-textSecondary uppercase">
                                        <tr>
                                            <th className="px-4 py-2">Date</th>
                                            <th className="px-4 py-2">Location</th>
                                            <th className="px-4 py-2 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-app-textPrimary">
                                        {data.tolls.map((toll, index) => (
                                            <tr key={index} className="border-b border-app-border last:border-b-0">
                                                <td className="px-4 py-2">{toll.date ? toll.date.toLocaleDateString() : 'N/A'}</td>
                                                <td className="px-4 py-2 truncate max-w-xs">{toll.location || 'N/A'}</td>
                                                <td className="px-4 py-2 text-right font-medium text-danger">${toll.amount.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        <tr className="font-bold bg-app-surface/70">
                                            <td colSpan={2} className="px-4 py-2 text-right">Total for {data.displayPlate}</td>
                                            <td className="px-4 py-2 text-right text-danger">${data.tolls.reduce((sum, t) => sum + t.amount, 0).toFixed(2)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )})}
                    </div>
                ) : (
                    <p className="text-app-textSecondary text-center py-8">No toll data loaded. Please upload a file.</p>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
