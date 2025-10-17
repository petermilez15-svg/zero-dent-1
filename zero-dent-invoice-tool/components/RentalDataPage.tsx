import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { ArrowUpTrayIcon, CircleStackIcon, PencilSquareIcon } from './IconComponents';

interface ClaimDataPageProps {
  onRentalsParsed: (rows: any[]) => void;
  initialRentals: any[];
  onCreateInvoice: (claimData: any) => void;
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

export const ClaimDataPage: React.FC<ClaimDataPageProps> = ({ onRentalsParsed, initialRentals, onCreateInvoice }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const handleRentalParse = useCallback((file: File) => {
    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            if (!firstSheetName) throw new Error("Claim data Excel file has no sheets.");

            const sheet = workbook.Sheets[firstSheetName];
            const rows = XLSX.utils.sheet_to_json<any>(sheet, {defval: ""});
            
            onRentalsParsed(rows);
        } catch (readErr) {
            setError(readErr instanceof Error ? `Claim Data Parsing Error: ${readErr.message}` : 'Could not parse the claim data Excel file.');
        } finally {
            setIsLoading(false);
        }
    };
    reader.onerror = () => { setIsLoading(false); setError("Failed to read claim data file."); };
    reader.readAsArrayBuffer(file);
  }, [onRentalsParsed]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
      if (!validTypes.includes(file.type)) {
        setError('Invalid file type. Please upload an Excel (.xlsx, .xls) file.');
        return;
      }
      handleRentalParse(file);
    }
  };

  return (
    <div className="bg-app-surface p-4 md:p-6 rounded-lg shadow-xl border border-app-border w-full">
      <div className="flex items-center gap-3 mb-6">
        <CircleStackIcon className="w-8 h-8 text-brand-primary" />
        <h2 className="text-3xl font-bold text-app-textPrimary">Claim Data & Invoicing</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Upload */}
        <div className="lg:col-span-1 bg-app-background p-4 rounded-lg border border-app-border self-start">
          <h3 className="text-lg font-semibold mb-3">Upload Claim Sheet</h3>
          <p className="text-sm text-app-textSecondary mb-4">Upload your Excel file to see a list of claims ready for invoicing.</p>
          <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-app-border border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-app-textSecondary" />
              <label htmlFor="rental-page-upload" className="relative cursor-pointer bg-app-background rounded-md font-medium text-brand-primary hover:text-brand-primaryDarker focus-within:outline-none">
                <span>{isLoading ? 'Processing...' : 'Choose Claim Data File'}</span>
                <input id="rental-page-upload" name="rental-page-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".xlsx, .xls" disabled={isLoading} />
              </label>
            </div>
          </div>
          {fileName && !isLoading && <p className="text-sm text-green-500 mt-2">Loaded: {fileName}</p>}
          {isLoading && <Spinner text="Parsing..." />}
          {error && <p className="text-sm text-danger mt-2">{error}</p>}
        </div>

        {/* Right Panel: Claim List */}
        <div className="lg:col-span-2 bg-app-background p-4 rounded-lg border border-app-border">
          <h3 className="text-lg font-semibold mb-3">Claims Ready for Invoicing</h3>
          <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-3">
            {initialRentals.length > 0 ? (
              initialRentals.map((row, index) => {
                const insuredName = getValue(row, ['Insured Name']) || 'N/A';
                const claimNumber = getValue(row, ['Claim Number']) || 'N/A';
                const insuranceCo = getValue(row, ['Insurance Company']) || 'N/A';
                
                // Skip rows that don't have at least a claim number or insured name
                if (claimNumber === 'N/A' && insuredName === 'N/A') {
                    return null;
                }

                return (
                  <div key={index} className="bg-app-surface p-4 rounded-lg border border-app-border flex justify-between items-center gap-4 hover:border-brand-primary transition-all">
                    <div className="flex-grow">
                        <p className="font-bold text-app-textPrimary text-lg">{insuredName}</p>
                        <p className="text-sm text-app-textSecondary">
                            Claim #: <span className="font-mono">{claimNumber}</span>
                        </p>
                         <p className="text-xs text-app-textSecondary">
                            Insurance: {insuranceCo}
                        </p>
                    </div>
                    <Button 
                        variant="primary" 
                        size="sm"
                        onClick={() => onCreateInvoice(row)}
                        leftIcon={<PencilSquareIcon className="w-4 h-4" />}
                        aria-label={`Create administration invoice for ${insuredName}, claim ${claimNumber}`}
                    >
                      Create Admin Invoice
                    </Button>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-48 border-2 border-dashed border-app-border rounded-lg">
                <p className="text-app-textSecondary text-center">
                    No claim data loaded. Please upload a file.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
