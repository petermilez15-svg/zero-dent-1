

import React, { useState, useCallback, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { PartialInvoiceImportData, AILineItem, InvoiceData, initialInvoiceData, CompanySettings, LineItem, InvoiceAddress, AdjusterInfo } from '../types';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { ArrowUpTrayIcon, InformationCircleIcon, CheckCircleIcon } from './IconComponents';
import { generateInvoicePdfBlob } from '../services/pdfService';
import { previewBlobInNewTab } from '../utilityFunctions';
import { InvoicePreview } from './InvoicePreview';


interface ParsedInvoiceEntry {
  key: string;
  sourceData: PartialInvoiceImportData;
  displayName: string;
}

interface BatchInvoice extends ParsedInvoiceEntry {
    status: 'pending' | 'completed';
    stagedData: Partial<InvoiceData>;
    isEstimated: boolean;
}

interface ExcelInvoiceCreatorProps {
  onClose?: () => void;
  activeCompanySettings: CompanySettings;
  generateInvoiceNumber: (data: InvoiceData) => string;
  generateAuthNumber: (data: InvoiceData) => string;
}

const formatDateToYYYYMMDD = (date: Date | undefined): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return '';
    }
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - timezoneOffset);
    return localDate.toISOString().split('T')[0];
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

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; containerClassName?: string }> =
  ({ label, id, className, containerClassName, ...props }) => (
  <div className={containerClassName}>
    <label htmlFor={id} className="block text-sm font-medium text-app-textSecondary mb-1">{label}</label>
    <input
      id={id}
      name={id}
      className={`w-full p-2 bg-app-background border border-app-border rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary text-app-textPrimary placeholder-app-textSecondary read-only:bg-app-border read-only:cursor-not-allowed disabled:opacity-70 ${className || ''}`}
      {...props}
    />
  </div>
);


export const ExcelInvoiceCreator: React.FC<ExcelInvoiceCreatorProps> = ({ onClose, activeCompanySettings, generateInvoiceNumber, generateAuthNumber }) => {
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [allInvoices, setAllInvoices] = useState<BatchInvoice[]>([]);
  const [stagedInvoiceKey, setStagedInvoiceKey] = useState<string | null>(null);

  // New state for batch processing
  const [batchInvoiceDate, setBatchInvoiceDate] = useState<string>(() => formatDateToYYYYMMDD(new Date()));
  const [batchDueDate, setBatchDueDate] = useState<string>(() => formatDateToYYYYMMDD(new Date()));
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);

  // FIX: Add state and refs for hidden PDF generation
  const [invoiceForPdf, setInvoiceForPdf] = useState<InvoiceData | null>(null);
  const pdfPreviewRef = useRef<HTMLDivElement>(null);
  const generationPromiseRef = useRef<{ resolve: (blob: Blob) => void; reject: (reason?: any) => void; } | null>(null);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError(null);
    setAllInvoices([]);
    setStagedInvoiceKey(null);

    if (file) {
      const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
      if (!validTypes.includes(file.type)) {
        setError('Invalid file type. Please upload an Excel (.xlsx, .xls) file.');
        setExcelFile(null);
        return;
      }
      setExcelFile(file);
      handleParseFile(file);
    } else {
      setExcelFile(null);
    }
  };

  const handleParseFile = useCallback((file: File) => {
    if (!file) return;
    setIsLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });

            const firstSheetName = workbook.SheetNames[0];
            if (!firstSheetName) throw new Error("Excel file is empty or has no sheets.");

            const sheet = workbook.Sheets[firstSheetName];
            const rows = XLSX.utils.sheet_to_json<any>(sheet);
            if (rows.length === 0) throw new Error("The first sheet in the Excel file is empty.");

            const ratesByVehicle: Record<string, number[]> = {};
            rows.forEach(row => {
                const vehicle = String(row['Rental Car Assigned'] || '').trim();
                if (!vehicle) return;
                const rateRaw = row['Covered Rental Rate'];
                const rate = parseFloat(String(rateRaw || '0').replace(/[^0-9.-]+/g, ""));
                if (!isNaN(rate) && rate > 0) {
                    if (!ratesByVehicle[vehicle]) ratesByVehicle[vehicle] = [];
                    ratesByVehicle[vehicle].push(rate);
                }
            });

            const medianRates: Record<string, number> = {};
            for (const vehicle in ratesByVehicle) {
                medianRates[vehicle] = calculateMedian(ratesByVehicle[vehicle]);
            }

            const entries: BatchInvoice[] = rows.map((row, index) => {
                const vehicle = String(row['Rental Car Assigned'] || '').trim();
                const rentalRateRaw = row['Covered Rental Rate'];
                const rentalRate = parseFloat(String(rentalRateRaw || '0').replace(/[^0-9.-]+/g, ""));
                const rentalDays = parseInt(String(row['Total Rental Dates']), 10) || 1;
                
                let isEstimated = false;
                let finalRate = rentalRate;

                if (isNaN(rentalRate) || rentalRate <= 0) {
                    finalRate = medianRates[vehicle] || 35.00;
                    isEstimated = true;
                }
                
                const lineItems: AILineItem[] = [];

                if (finalRate > 0 && rentalDays > 0) {
                     lineItems.push({
                        description: `Rental: ${vehicle || 'Vehicle'} ${isEstimated ? '(Est. Rate)' : ''}`,
                        rate: finalRate,
                        days: rentalDays,
                    });
                }

                const sourceData: PartialInvoiceImportData = {
                    billTo: {
                        companyName: row['Insurance Company'] || '',
                        policyholderName: row['Insured Name'] || '',
                        street: row['Insured Street Address'] || '',
                        cityStateZip: String(row['Zip Code'] || ''),
                    },
                    claimNumber: String(row['Claim Number'] || ''),
                    policyNumber: String(row['Policy Number'] || ''),
                    clientVehicleVIN: String(row['VIN #'] || ''),
                    clientVehicleYear: String(row['Vehicle Year'] || ''),
                    clientVehicleMake: String(row['Vehicle Make'] || ''),
                    clientVehicleModel: String(row['Vehicle Model'] || ''),
                    adjuster: {
                        name: row['Adjuster Name'] || '',
                        phone: String(row['Adjuster Phone Number'] || ''),
                        email: String(row['Adjuster E-mail'] || ''),
                    },
                    dateOfLoss: formatDateToYYYYMMDD(row['Date of Loss']),
                    periodStart: formatDateToYYYYMMDD(row['Rental Start Date']),
                    periodEnd: formatDateToYYYYMMDD(row['Rental End Date']),
                    lineItems: lineItems,
                };
                
                const key = `row-${index}-${sourceData.claimNumber || Math.random()}`;
                
                const batchInvoice: BatchInvoice = {
                    key,
                    sourceData,
                    displayName: `Claim: ${sourceData.claimNumber || 'N/A'}, Insured: ${sourceData.billTo?.policyholderName || 'N/A'}`,
                    status: 'pending',
                    stagedData: {
                        invoiceDate: formatDateToYYYYMMDD(row['Invoice Date']),
                        dueDate: formatDateToYYYYMMDD(row['Invoice Due Date']),
                    },
                    isEstimated,
                };
                return batchInvoice;
            }).filter(e => e.sourceData.claimNumber || e.sourceData.billTo?.policyholderName);
            
            if (entries.length === 0) throw new Error("No valid invoice rows found in the sheet.");
            
            setAllInvoices(entries);

        } catch (readErr) {
            setError(readErr instanceof Error ? `Parsing Error: ${readErr.message}` : 'Could not parse the Excel file.');
        } finally {
            setIsLoading(false);
        }
    };
    reader.onerror = () => { setIsLoading(false); setError("Failed to read the file."); };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleSelectInvoice = (key: string) => {
    setError(null);
    setStagedInvoiceKey(key);
  };

  const handleStagedDataChange = (field: 'invoiceDate' | 'dueDate', value: string) => {
    setAllInvoices(prev => prev.map(inv => {
        if (inv.key === stagedInvoiceKey) {
            return { ...inv, stagedData: { ...inv.stagedData, [field]: value } };
        }
        return inv;
    }));
  };

  // FIX: Added useEffect to handle PDF generation when invoiceForPdf state is updated.
  useEffect(() => {
    if (!invoiceForPdf || !pdfPreviewRef.current || !generationPromiseRef.current) return;
    
    const { resolve, reject } = generationPromiseRef.current;
    
    const timer = setTimeout(async () => {
        const elementToCapture = pdfPreviewRef.current?.firstChild as HTMLElement;
        if (!elementToCapture) {
            reject(new Error("PDF preview element could not be found for generation."));
            return;
        }
        try {
            const blob = await generateInvoicePdfBlob(elementToCapture, invoiceForPdf.invoiceType);
            if(blob) {
                resolve(blob);
            } else {
                reject(new Error("PDF generation returned a null blob."));
            }
        } catch (e) {
            reject(e);
        } finally {
            generationPromiseRef.current = null;
            setInvoiceForPdf(null);
        }
    }, 250);

    return () => clearTimeout(timer);
  }, [invoiceForPdf]);

  // FIX: Added a helper function to abstract the state-based PDF generation.
  const generatePdfFromData = useCallback((invoiceData: InvoiceData): Promise<Blob> => {
      return new Promise((resolve, reject) => {
          generationPromiseRef.current = { resolve, reject };
          setInvoiceForPdf(invoiceData);
      });
  }, []);

  const handleGenerateAndComplete = async () => {
    if (!stagedInvoiceKey) return;
    const invoiceToProcess = allInvoices.find(inv => inv.key === stagedInvoiceKey);
    if (!invoiceToProcess) return;

    if (!invoiceToProcess.stagedData.invoiceDate || !invoiceToProcess.stagedData.dueDate) {
        setError("Invoice Date and Due Date are required before generating the PDF.");
        return;
    }
    setError(null);
    setIsLoading(true);

    const { billTo, adjuster, lineItems, ...restOfSource } = invoiceToProcess.sourceData;

    const finalInvoiceData: InvoiceData = {
        ...initialInvoiceData,
        ...restOfSource,
        billTo: {
            ...initialInvoiceData.billTo,
            ...billTo,
        },
        adjuster: {
            ...initialInvoiceData.adjuster,
            ...adjuster,
        },
        lineItems: (lineItems || []).map((item, idx): LineItem => ({
            ...item,
            id: `excel-item-${invoiceToProcess.key}-${idx}`
        })),
        ...invoiceToProcess.stagedData,
        // Populate sender info from active profile
        senderCompanyName: activeCompanySettings.companyName,
        paymentPayableToName: activeCompanySettings.paymentPayableToName,
        paymentMailToName: activeCompanySettings.paymentMailToName,
        paymentMailToStreet: activeCompanySettings.paymentMailToStreet,
        paymentMailToCityStateZip: activeCompanySettings.paymentMailToCityStateZip,
        footerContactPhone: activeCompanySettings.footerContactPhone,
        footerContactWebsite: activeCompanySettings.footerContactWebsite,
        footerContactEmail: activeCompanySettings.footerContactEmail,
        footerCompanyAddress: activeCompanySettings.footerCompanyAddress,
        signatureName: activeCompanySettings.signatureName,
    };
    
    // Generate invoice/auth numbers
    finalInvoiceData.invoiceNumber = generateInvoiceNumber(finalInvoiceData);
    finalInvoiceData.authorizationNumber = generateAuthNumber(finalInvoiceData);


    try {
        const blob = await generatePdfFromData(finalInvoiceData);
        if (blob) {
            const filename = `Invoice-${finalInvoiceData.invoiceNumber || 'draft'}.pdf`;
            previewBlobInNewTab(blob, filename, (errorMsg) => setError(errorMsg));
            
            // Update status and clear stage
            setAllInvoices(prev => prev.map(inv => inv.key === stagedInvoiceKey ? { ...inv, status: 'completed' } : inv));
            setStagedInvoiceKey(null);
        } else {
            throw new Error("PDF generation failed to return a file.");
        }
    } catch (e) {
        setError(e instanceof Error ? `PDF Error: ${e.message}` : "An unknown error occurred generating the PDF.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleGenerateAll = async () => {
    if (!batchInvoiceDate || !batchDueDate) {
        setError("Please set a default Invoice Date and Due Date for the batch.");
        return;
    }
    setError(null);
    setIsBatchProcessing(true);

    const pendingInvoices = allInvoices.filter(inv => inv.status === 'pending');

    for (const invoiceToProcess of pendingInvoices) {
        const { billTo, adjuster, lineItems, ...restOfSource } = invoiceToProcess.sourceData;

        const finalInvoiceData: InvoiceData = {
            ...initialInvoiceData,
            ...restOfSource,
            billTo: { ...initialInvoiceData.billTo, ...billTo },
            adjuster: { ...initialInvoiceData.adjuster, ...adjuster },
            lineItems: (lineItems || []).map((item, idx): LineItem => ({ ...item, id: `excel-item-${invoiceToProcess.key}-${idx}` })),
            invoiceDate: invoiceToProcess.stagedData.invoiceDate || batchInvoiceDate,
            dueDate: invoiceToProcess.stagedData.dueDate || batchDueDate,
            senderCompanyName: activeCompanySettings.companyName,
            paymentPayableToName: activeCompanySettings.paymentPayableToName,
            paymentMailToName: activeCompanySettings.paymentMailToName,
            paymentMailToStreet: activeCompanySettings.paymentMailToStreet,
            paymentMailToCityStateZip: activeCompanySettings.paymentMailToCityStateZip,
            footerContactPhone: activeCompanySettings.footerContactPhone,
            footerContactWebsite: activeCompanySettings.footerContactWebsite,
            footerContactEmail: activeCompanySettings.footerContactEmail,
            footerCompanyAddress: activeCompanySettings.footerCompanyAddress,
            signatureName: activeCompanySettings.signatureName,
        };

        finalInvoiceData.invoiceNumber = generateInvoiceNumber(finalInvoiceData);
        finalInvoiceData.authorizationNumber = generateAuthNumber(finalInvoiceData);

        try {
            const blob = await generatePdfFromData(finalInvoiceData);
            if (blob) {
                const filename = `Invoice-${finalInvoiceData.invoiceNumber || 'draft'}.pdf`;
                previewBlobInNewTab(blob, filename, (errorMsg) => setError(errorMsg));
                setAllInvoices(prev => prev.map(inv => inv.key === invoiceToProcess.key ? { ...inv, status: 'completed' } : inv));
                if (stagedInvoiceKey === invoiceToProcess.key) {
                    setStagedInvoiceKey(null);
                }
                await new Promise(resolve => setTimeout(resolve, 300)); // Wait a bit
            } else {
                throw new Error(`PDF generation returned null for claim: ${finalInvoiceData.claimNumber}`);
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "Unknown PDF generation error.";
            setError(`Batch failed at claim ${finalInvoiceData.claimNumber}: ${errorMessage}. Remaining invoices not processed.`);
            setIsBatchProcessing(false);
            return; // Stop the batch on error
        }
    }

    setIsBatchProcessing(false);
  };


  const renderUploadView = () => (
     <>
        <div className="mb-6 p-4 border-l-4 border-brand-primary bg-app-background">
            <h3 className="font-semibold text-app-textPrimary flex items-center mb-2">
                <InformationCircleIcon className="w-5 h-5 mr-2 text-brand-primary" />
                Instructions
            </h3>
            <ul className="list-disc list-inside text-sm text-app-textSecondary space-y-1">
                <li>Upload an Excel file where each row represents an invoice. The importer will read the first sheet.</li>
                <li>The system will display a list of all parsed invoices.</li>
                <li>You can process all pending invoices at once using the "Generate All" button, or select one to process individually.</li>
            </ul>
        </div>
        <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-app-border border-dashed rounded-md">
            <div className="space-y-1 text-center">
                <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-app-textSecondary" />
                <div className="flex text-sm text-app-textSecondary">
                    <label
                        htmlFor="excelFile-batch"
                        className="relative cursor-pointer bg-app-background rounded-md font-medium text-brand-primary hover:text-brand-primaryDarker focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-app-surface focus-within:ring-brand-primary px-1"
                    >
                        <span>Click to upload Excel file</span>
                        <input
                            id="excelFile-batch"
                            name="excelFile-batch"
                            type="file"
                            className="sr-only"
                            onChange={handleFileChange}
                            accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                        />
                    </label>
                </div>
                <p className="text-xs text-app-textSecondary">Excel files only.</p>
            </div>
        </div>
     </>
  );

  const renderWorkbenchView = () => {
    const stagedInvoice = allInvoices.find(inv => inv.key === stagedInvoiceKey);
    const pendingCount = allInvoices.filter(i => i.status === 'pending').length;

    return (
        <>
        <div className="mb-6 p-4 border border-app-border rounded-lg bg-app-background">
            <h3 className="text-lg font-semibold mb-3">Batch Processing</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <InputField 
                    label="Default Invoice Date" 
                    id="batchInvoiceDate" 
                    type="date" 
                    value={batchInvoiceDate} 
                    onChange={e => setBatchInvoiceDate(e.target.value)}
                    disabled={isBatchProcessing} 
                />
                <InputField 
                    label="Default Due Date" 
                    id="batchDueDate" 
                    type="date" 
                    value={batchDueDate} 
                    onChange={e => setBatchDueDate(e.target.value)} 
                    disabled={isBatchProcessing}
                />
                <Button 
                    variant="primary" 
                    size="md" 
                    onClick={handleGenerateAll} 
                    disabled={isBatchProcessing || pendingCount === 0 || isLoading} 
                    className="w-full"
                >
                    {isBatchProcessing ? <Spinner size="sm" /> : `Generate All Pending Invoices (${pendingCount})`}
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[65vh]">
            {/* Left Panel: Invoice List */}
            <div className="md:col-span-1 bg-app-background p-4 rounded-lg border border-app-border overflow-y-auto">
                <h3 className="text-lg font-semibold mb-3">Invoices ({pendingCount} remaining)</h3>
                <div className="space-y-2">
                    {allInvoices.map(inv => (
                        <button key={inv.key}
                            onClick={() => inv.status === 'pending' && handleSelectInvoice(inv.key)}
                            disabled={inv.status !== 'pending' || isBatchProcessing}
                            className={`w-full text-left p-3 rounded-md border transition-colors flex items-center justify-between ${
                                stagedInvoiceKey === inv.key ? 'bg-brand-primary/20 border-brand-primary ring-2 ring-brand-primary' : 'border-app-border'
                            } ${inv.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/30 text-app-textSecondary' : 'hover:bg-app-surface'} disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                            <div>
                                <p className={`font-medium ${inv.status === 'pending' ? 'text-app-textPrimary' : ''}`}>{inv.displayName}</p>
                                <p className="text-xs">{inv.sourceData.lineItems?.length || 0} line item(s) detected</p>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                                {inv.isEstimated && <span className="text-xs font-semibold bg-amber-400/20 text-amber-500 rounded-full px-2 py-0.5" title="A daily rate was estimated for this invoice.">Est. Rate</span>}
                                {inv.status === 'completed' && <CheckCircleIcon className="w-6 h-6 text-emerald-500" />}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Panel: Staging Area */}
            <div className="md:col-span-2 bg-app-background p-4 rounded-lg border border-app-border overflow-y-auto">
                <h3 className="text-lg font-semibold mb-3">Staging Area (Individual Processing)</h3>
                {stagedInvoice ? (
                    <div className="space-y-4">
                        <h4 className="font-bold text-brand-primary text-xl">{stagedInvoice.displayName}</h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <InputField label="Invoice Date *" id="stagedInvoiceDate" type="date"
                                value={stagedInvoice.stagedData.invoiceDate || ''}
                                onChange={e => handleStagedDataChange('invoiceDate', e.target.value)}
                                disabled={isBatchProcessing}
                            />
                            <InputField label="Due Date *" id="stagedDueDate" type="date"
                                value={stagedInvoice.stagedData.dueDate || ''}
                                onChange={e => handleStagedDataChange('dueDate', e.target.value)}
                                disabled={isBatchProcessing}
                            />
                        </div>
                        
                        <div className="p-3 border border-app-border rounded-md bg-app-surface/50">
                            <h5 className="text-sm font-semibold mb-2">Line Items (Read-only)</h5>
                            {stagedInvoice.sourceData.lineItems && stagedInvoice.sourceData.lineItems.length > 0 ? (
                                <ul className="text-xs text-app-textSecondary space-y-1">
                                    {stagedInvoice.sourceData.lineItems.map((item, idx) => (
                                        <li key={idx}>- {item.description} (${item.rate} x {item.days})</li>
                                    ))}
                                </ul>
                            ) : <p className="text-xs text-app-textSecondary">No line items were automatically detected.</p>}
                        </div>

                        <Button variant="primary" size="lg" onClick={handleGenerateAndComplete} disabled={isLoading || isBatchProcessing} className="w-full">
                            {isLoading ? <Spinner size="sm"/> : 'Generate This PDF & Complete'}
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-app-textSecondary">
                        <p>{isBatchProcessing ? "Batch processing in progress..." : "Select a pending invoice from the left to process individually."}</p>
                    </div>
                )}
            </div>
        </div>
        </>
    );
  }

  return (
    <div className="text-app-textPrimary">
      {isLoading && allInvoices.length === 0 && <Spinner text="Parsing Excel file..." />}

      {!isLoading && allInvoices.length === 0 && renderUploadView()}
      
      {allInvoices.length > 0 && renderWorkbenchView()}

      {error && (
        <div role="alert" className="mt-4 p-3 bg-danger/80 border border-danger text-white rounded-lg text-sm">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      )}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '8.5in', zIndex: -1 }} ref={pdfPreviewRef}>
          {invoiceForPdf && <InvoicePreview invoiceData={invoiceForPdf} uploadedLogoDataUrl={activeCompanySettings.logoDataUrl} />}
      </div>
    </div>
  );
};