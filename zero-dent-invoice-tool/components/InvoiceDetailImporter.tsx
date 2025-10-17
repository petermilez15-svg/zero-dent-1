
import React, { useState, useCallback } from 'react';
import { InvoiceDetailImportData } from '../types'; 
import { Button } from './Button';
import { Spinner } from './Spinner';
import { ArrowUpTrayIcon } from './IconComponents';

interface InvoiceDetailImporterProps {
  onImport: (data: InvoiceDetailImportData) => void;
  onClose?: () => void;
}

export const InvoiceDetailImporter: React.FC<InvoiceDetailImporterProps> = ({ onImport, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSuccessMessage(null);
    setError(null);

    if (file) {
      if (file.type !== 'application/json') {
        setError(`Invalid file type. Please upload a JSON file. You uploaded: ${file.type}`);
        setSelectedFile(null);
        setFileName('');
        event.target.value = ""; 
        return;
      }
      setSelectedFile(file);
      setFileName(file.name);
    } else {
      setSelectedFile(null);
      setFileName('');
    }
  };

  const handleImportDetailsFromJson = useCallback(async () => {
    if (!selectedFile) {
      setError('Please select a JSON file to import details.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const fileText = await selectedFile.text();
      const parsedJson = JSON.parse(fileText) as InvoiceDetailImportData;

      if (parsedJson.billTo && typeof parsedJson.billTo.companyName !== 'string' && typeof parsedJson.billTo.companyName !== 'undefined') { 
        throw new Error("Invalid JSON format for 'billTo' section if present.");
      }
      if (parsedJson.lineItems && !Array.isArray(parsedJson.lineItems)) {
        throw new Error("Invalid JSON format: 'lineItems' must be an array if present.");
      }
      if (parsedJson.lineItems) {
        for (const item of parsedJson.lineItems) {
          if (typeof item.description !== 'string' || typeof item.rate !== 'number' || typeof item.days !== 'number') {
            throw new Error("Invalid JSON format for one or more line items. Each must have description (string), rate (number), and days (number).");
          }
        }
      }
      
      onImport(parsedJson);
      setSuccessMessage("'Bill To' and/or 'Line Items' imported successfully from JSON! Review the main invoice form.");
      if (onClose) onClose();
      
    } catch (err) {
      if (err instanceof Error) {
        setError(`Error processing JSON file: ${err.message}`);
      } else {
        setError('An unknown error occurred during JSON import.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile, onImport, onClose]);

  return (
    <div className="bg-app-surface p-6 md:p-8 rounded-xl shadow-2xl max-w-2xl mx-auto my-4 text-app-textPrimary">
      <h2 className="text-3xl font-bold mb-6 text-center text-brand-primary">
        Import Details from JSON
      </h2>
      <p className="text-app-textSecondary mb-6 text-center text-sm">
        Upload a JSON file to populate 'Bill To' information and/or 'Line Items' for the current invoice.
        This will not affect your saved Company Settings.
      </p>

      <div className="space-y-6">
        <div>
          <label htmlFor="invoiceDetailJsonFile" className="block text-sm font-medium text-app-textSecondary mb-1">
            Upload Custom Details JSON File
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-app-border border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-app-textSecondary" />
              <div className="flex text-sm text-app-textSecondary">
                <label
                  htmlFor="invoiceDetailJsonFile"
                  className="relative cursor-pointer bg-app-background rounded-md font-medium text-brand-primary hover:text-brand-primaryDarker focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-app-surface focus-within:ring-brand-primary px-1"
                >
                  <span>Upload a JSON file</span>
                  <input 
                    id="invoiceDetailJsonFile" 
                    name="invoiceDetailJsonFile" 
                    type="file" 
                    className="sr-only" 
                    onChange={handleFileChange} 
                    accept="application/json" />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-app-textSecondary">JSON file only. Max 10MB.</p>
              {fileName && <p className="text-sm text-brand-primary mt-2">Selected: {fileName}</p>}
            </div>
          </div>
           <p className="mt-2 text-xs text-app-textSecondary">
            Expected JSON format: <code className="bg-app-border px-1 rounded text-app-textPrimary">{`{ "billTo": { ... }, "lineItems": [ ... ], "suggestedAdjusterName": "...", "suggestedAdjusterEmail": "..." }`}</code> (all keys optional).
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleImportDetailsFromJson}
          disabled={isLoading || !selectedFile}
          className="w-full"
          size="lg"
          aria-live="polite"
        >
          {isLoading ? (
            <>
              <Spinner size="sm" color="text-textOnBrandPrimary" />
              <span className="ml-2">Importing from JSON...</span>
            </>
          ) : (
            'Import from JSON File'
          )}
        </Button>
      </div>

      {error && (
        <div role="alert" className="mt-6 p-4 bg-danger border border-danger/70 text-white rounded-lg shadow">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
        </div>
      )}
      {successMessage && !error && (
         <div role="alert" className="mt-6 p-4 bg-brand-primary/10 border border-brand-primary text-brand-primary rounded-lg shadow">
          <p className="font-semibold">Success!</p>
          <p>{successMessage}</p>
        </div>
      )}
    </div>
  );
};
    