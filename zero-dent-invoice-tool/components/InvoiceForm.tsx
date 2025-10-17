import React, { useState, useRef, useEffect } from 'react';
import { InvoiceData, LineItem, PeriodType, InvoiceType, RentalVehicle, AILineItem, BillToPreset } from '../types';
import { Button } from './Button';
import { InformationCircleIcon } from './IconComponents'; 

interface InvoiceFormProps {
  invoiceData: InvoiceData;
  onInputChange: (section: keyof InvoiceData, field: string, value: any) => void;
  onDirectFieldChange: (field: keyof InvoiceData | 'vehicleFromFleetSelection' | 'billToPresetSelection', value: any) => void;
  onLineItemChange: (index: number, field: keyof LineItem, value: any) => void;
  onAddLineItem: (description?: string, rate?: number, days?: number) => void;
  onRemoveLineItem: (index: number) => void;
  onAddAdminFeeItem: () => void;
  onAddStorageFeeItem: () => void;
  isGeneratingPdf: boolean;
  onLogoUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  logoForPreview?: string | null;
  rentalFleet: RentalVehicle[];
  billToPresets: BillToPreset[]; 
  lastAddedItemId?: string | null;
  isDevModeUiUnlocked: boolean;
}

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; containerClassName?: string; helpText?: string; infoTooltip?: string }> =
  React.memo(({ label, id, className, containerClassName, type="text", helpText, infoTooltip, ...props }) => (
  <div className={containerClassName}>
    <div className="flex items-center mb-1">
      <label htmlFor={id} className="block text-sm font-medium text-app-textSecondary">{label}</label>
      {infoTooltip && (
        <span title={infoTooltip} className="ml-1.5 cursor-help">
          <InformationCircleIcon className="w-4 h-4 text-app-textSecondary hover:text-app-textPrimary" />
        </span>
      )}
    </div>
    <input
      type={type}
      id={id}
      name={id}
      className={`w-full p-2 bg-app-background border border-app-border rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary text-app-textPrimary placeholder-app-textSecondary read-only:bg-app-border read-only:cursor-not-allowed ${className || ''}`}
      {...props}
    />
    {helpText && <p className="mt-1 text-xs text-app-textSecondary">{helpText}</p>}
  </div>
));

const SelectField: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; id: string; containerClassName?: string; options: {value: string; label: string}[]; 'aria-label'?: string; helpText?: string; infoTooltip?: string; }> =
  React.memo(({ label, id, className, containerClassName, options, helpText, infoTooltip, ...props }) => (
  <div className={containerClassName}>
    {label && (
        <div className="flex items-center mb-1">
            <label htmlFor={id} className="block text-sm font-medium text-app-textSecondary">{label}</label>
            {infoTooltip && (
                <span title={infoTooltip} className="ml-1.5 cursor-help">
                <InformationCircleIcon className="w-4 h-4 text-app-textSecondary hover:text-app-textPrimary" />
                </span>
            )}
        </div>
    )}
    <select
      id={id}
      name={id}
      aria-label={props['aria-label'] || label}
      className={`w-full p-2 bg-app-background border border-app-border rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary text-app-textPrimary placeholder-app-textSecondary ${className || ''}`}
      {...props}
    >
      {options.map(option => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
    {helpText && <p className="mt-1 text-xs text-app-textSecondary">{helpText}</p>}
  </div>
));


const TextAreaField: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; id: string; containerClassName?: string; rows?: number; }> =
  React.memo(({ label, id, className, containerClassName, rows = 2, ...props }) => (
  <div className={containerClassName}>
    <label htmlFor={id} className="block text-sm font-medium text-app-textSecondary mb-1">{label}</label>
    <textarea
      id={id}
      name={id}
      rows={rows}
      className={`w-full p-2 bg-app-background border border-app-border rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary text-app-textPrimary placeholder-app-textSecondary ${className || ''}`}
      {...props}
    />
  </div>
));

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
  invoiceData, onInputChange, onDirectFieldChange, onLineItemChange,
  onAddLineItem,
  onRemoveLineItem,
  onAddAdminFeeItem,
  onAddStorageFeeItem,
  isGeneratingPdf, onLogoUpload, 
  logoForPreview,
  rentalFleet,
  billToPresets, 
  lastAddedItemId,
  isDevModeUiUnlocked
}) => {
  const [manualVehicleEntryForRental, setManualVehicleEntryForRental] = useState(true);
  const lineItemsContainerRef = useRef<HTMLDivElement>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  const fleetToUseForDropdown = rentalFleet || [];

  useEffect(() => {
    if (lastAddedItemId) {
      setHighlightedItemId(lastAddedItemId);
    }
  }, [lastAddedItemId]);

  useEffect(() => {
    if (highlightedItemId) {
      const itemElement = document.getElementById(`line-item-${highlightedItemId}`);
      if (itemElement) {
        itemElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const timer = setTimeout(() => setHighlightedItemId(null), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [highlightedItemId]);

  const handleAddFeeAndHighlight = (feeAdderFn: () => void) => {
    feeAdderFn();
  };

  const periodTypeOptions: {value: PeriodType, label: string}[] = [
    { value: "General", label: "General" }, { value: "Rental", label: "Rental" },
    { value: "Storage", label: "Storage" }, { value: "Service", label: "Service" },
  ];

  const invoiceTypeOptions: {value: InvoiceType, label: string}[] = [
    { value: "General", label: "General / Other" }, { value: "Rental", label: "Rental Invoice" },
    { value: "Administration", label: "Administration Fee Invoice" }, { value: "Storage", label: "Storage Fee Invoice" },
  ];

  const vehicleOptionsFromFleet = [
    { value: "", label: "-- Select Vehicle --" },
    ...fleetToUseForDropdown.map((vehicle) => ({
      value: vehicle.vin,
      label: `${vehicle.make} ${vehicle.model} (${vehicle.year || 'N/A'}) - VIN: ...${vehicle.vin.slice(-4)} | Rate: $${vehicle.rate.toFixed(2)}/day`
    })),
  ];

  const mainFormFleetOptions = isDevModeUiUnlocked
    ? [...vehicleOptionsFromFleet, { value: "MANUAL_ENTRY", label: "Enter Manually / Add New" }]
    : vehicleOptionsFromFleet;

  const billToPresetOptions = [
    { value: "", label: "-- Select Insurance Company --" },
    ...(billToPresets || []).map(preset => ({ value: preset.id, label: preset.name }))
  ];

  const handleBillToPresetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const presetId = event.target.value;
    const selectedPreset = (billToPresets || []).find(p => p.id === presetId);
    if (selectedPreset) {
        onDirectFieldChange('billToPresetSelection', selectedPreset);
    } else {
        onDirectFieldChange('billToPresetSelection', null); 
    }
  };

  const handleMainFormFleetSelection = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = event.target.value;
    if (selectedValue === "MANUAL_ENTRY" && isDevModeUiUnlocked) {
      setManualVehicleEntryForRental(true);
      onDirectFieldChange('vehicleFromFleetSelection', null);
    } else if (selectedValue) {
      const selectedVehicle = fleetToUseForDropdown.find(v => v.vin === selectedValue);
      if (selectedVehicle) {
        onDirectFieldChange('vehicleFromFleetSelection', selectedVehicle);
        setManualVehicleEntryForRental(false);
      }
    } else {
        onDirectFieldChange('vehicleFromFleetSelection', null);
        setManualVehicleEntryForRental(isDevModeUiUnlocked ? true : false);
    }
  };

  let fleetDropdownValue = "";
  if (isDevModeUiUnlocked && manualVehicleEntryForRental) {
    fleetDropdownValue = "MANUAL_ENTRY";
  } else if (invoiceData.vehicleVIN && fleetToUseForDropdown.some(v => v.vin === invoiceData.vehicleVIN)) {
    fleetDropdownValue = invoiceData.vehicleVIN;
  }

  const showFleetToggleButtons = isDevModeUiUnlocked && fleetToUseForDropdown.length > 0;

  const renderFormSection = (title: string, content: React.ReactNode, key?: string) => (
    <div key={key || title} className="mb-6 p-4 border border-app-border rounded-lg bg-app-surface shadow-md">
      <h3 className="text-lg font-semibold text-app-textPrimary mb-3 border-b border-app-border pb-2">
        {title}
      </h3>
      <div className="space-y-4">
        {content}
      </div>
    </div>
  );

  return (
    <>
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
      <div className="flex justify-between items-center border-b border-app-border pb-2">
        <h2 className="text-xl font-semibold text-app-textPrimary invoice-details-heading-dark-theme">Invoice Details</h2>
      </div>

      {renderFormSection("Company & Invoice Header", (
        <>
          <InputField
              label="Your Company Name"
              id="senderCompanyName"
              value={invoiceData.senderCompanyName}
              onChange={(e) => onDirectFieldChange('senderCompanyName', e.target.value)}
              containerClassName="mb-3"
              placeholder="Your Company LLC"
              infoTooltip="Your official company name. This updates the active company profile."
          />
          <div>
            <label htmlFor="logoUpload" className="block text-sm font-medium text-app-textSecondary mb-1">Custom Logo</label>
            <input type="file" id="logoUpload" accept="image/*" onChange={onLogoUpload} className="w-full text-sm text-app-textSecondary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-textOnBrandPrimary hover:file:bg-brand-primaryDarker disabled:opacity-50 file:cursor-pointer file:transition-colors" disabled={isGeneratingPdf} aria-describedby="logo-help" />
            <p id="logo-help" className="mt-1 text-xs text-app-textSecondary">Upload your company logo. This updates the active company profile.</p>
            {logoForPreview && <div className="mt-3"><p className="text-xs text-app-textSecondary mb-1">Logo Preview (from current profile):</p><img key={logoForPreview} src={logoForPreview.startsWith('data:image') ? logoForPreview : (logoForPreview || "/assets/hail_guard_logo.png")} alt="Logo Preview" className="h-10 w-auto border border-app-border rounded bg-white p-1" /></div>}
          </div>
           <SelectField label="Invoice Type" id="invoiceType" value={invoiceData.invoiceType} options={invoiceTypeOptions} onChange={(e) => { onDirectFieldChange('invoiceType', e.target.value as InvoiceType); if (e.target.value !== 'Rental' && !isDevModeUiUnlocked) setManualVehicleEntryForRental(false); }} disabled={isGeneratingPdf} containerClassName="mb-3" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <InputField label="Invoice Number" id="invoiceNumber" value={invoiceData.invoiceNumber} onChange={(e) => onDirectFieldChange('invoiceNumber', e.target.value)} disabled={isGeneratingPdf} readOnly placeholder="Auto-generated" infoTooltip="This number is generated automatically based on your company name, date, and claim." />
              <InputField label="Invoice Date" id="invoiceDate" type="date" value={invoiceData.invoiceDate} onChange={(e) => onDirectFieldChange('invoiceDate', e.target.value)} disabled={isGeneratingPdf} />
              <InputField label="Due Date" id="dueDate" type="date" value={invoiceData.dueDate} onChange={(e) => onDirectFieldChange('dueDate', e.target.value)} disabled={isGeneratingPdf} />
          </div>
        </>
      ))}

      {renderFormSection("Bill To", (
        <>
          <SelectField
              label="Quick Fill Bill To (Insurance Co.)"
              id="billToPresetSelect"
              value={invoiceData.selectedBillToPresetId || ""}
              options={billToPresetOptions}
              onChange={handleBillToPresetChange}
              disabled={isGeneratingPdf}
              containerClassName="mb-3"
              infoTooltip="Select an insurance company to auto-fill their details."
          />
           <InputField label="Company Name" id="billToCompanyName" value={invoiceData.billTo.companyName} onChange={(e) => onInputChange('billTo', 'companyName', e.target.value)} disabled={isGeneratingPdf} placeholder="e.g., ABC Insurance Co."/>
           <InputField label="Policyholder Name" id="billToPolicyholder" value={invoiceData.billTo.policyholderName} onChange={(e) => onInputChange('billTo', 'policyholderName', e.target.value)} disabled={isGeneratingPdf} placeholder="e.g., John Doe" />
           <InputField label="Street Address" id="billToStreet" value={invoiceData.billTo.street} onChange={(e) => onInputChange('billTo', 'street', e.target.value)} disabled={isGeneratingPdf} placeholder="e.g., 123 Main St" />
           <InputField label="City, State, Zip" id="billToCityStateZip" value={invoiceData.billTo.cityStateZip} onChange={(e) => onInputChange('billTo', 'cityStateZip', e.target.value)} disabled={isGeneratingPdf} placeholder="e.g., Anytown, ST 12345" />
        </>
      ))}

      {renderFormSection("Additional Client Details", (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="Claim Number" id="claimNumber" value={invoiceData.claimNumber} onChange={(e) => onDirectFieldChange('claimNumber', e.target.value)} disabled={isGeneratingPdf} placeholder="e.g., AB-12345-XYZ" />
            <InputField label="Policy Number" id="policyNumber" value={invoiceData.policyNumber} onChange={(e) => onDirectFieldChange('policyNumber', e.target.value)} disabled={isGeneratingPdf} placeholder="e.g., 98765POL" />
        </div>
      ))}
      
      {renderFormSection("Client's Vehicle Information", (
        <>
           <p className="text-xs text-app-textSecondary -mt-2 mb-2">Client's vehicle involved in the claim.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <InputField label="Client Vehicle VIN" id="clientVehicleVIN" value={invoiceData.clientVehicleVIN} onChange={(e) => onDirectFieldChange('clientVehicleVIN', e.target.value)} disabled={isGeneratingPdf} placeholder="17-digit VIN" />
              <InputField label="Client Vehicle Year" id="clientVehicleYear" value={invoiceData.clientVehicleYear} onChange={(e) => onDirectFieldChange('clientVehicleYear', e.target.value)} disabled={isGeneratingPdf} placeholder="e.g., 2020" />
              <InputField label="Client Vehicle Make" id="clientVehicleMake" value={invoiceData.clientVehicleMake} onChange={(e) => onDirectFieldChange('clientVehicleMake', e.target.value)} disabled={isGeneratingPdf} placeholder="e.g., Honda" />
              <InputField label="Client Vehicle Model" id="clientVehicleModel" value={invoiceData.clientVehicleModel} onChange={(e) => onDirectFieldChange('clientVehicleModel', e.target.value)} disabled={isGeneratingPdf} placeholder="e.g., CRV" />
          </div>
        </>
      ))}

      {invoiceData.invoiceType === 'Rental' && renderFormSection("Vehicle Information (Rental Unit)", (
        <>
          <p className="text-xs text-app-textSecondary -mt-2 mb-2">
            Specific vehicle being rented out. Selecting from fleet automatically adds a line item.
          </p>
          {(fleetToUseForDropdown.length > 0 || isDevModeUiUnlocked) ? (
            <SelectField
              label="Select Rental Vehicle"
              id="mainFormFleetVehicleSelect"
              options={mainFormFleetOptions}
              onChange={handleMainFormFleetSelection}
              value={fleetDropdownValue}
              disabled={isGeneratingPdf}
              containerClassName="mb-2"
              infoTooltip={isDevModeUiUnlocked ? "Choosing from fleet adds a line item. 'Enter Manually' requires dev mode." : "Select a vehicle from the company's rental fleet."}
            />
          ) : (
             <p className="text-sm text-app-textSecondary">No rental fleet configured for the current profile.</p>
          )}
          {isDevModeUiUnlocked && manualVehicleEntryForRental && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <InputField label="Rental VIN" id="vehicleVIN" value={invoiceData.vehicleVIN} onChange={(e) => onDirectFieldChange('vehicleVIN', e.target.value)} disabled={isGeneratingPdf} placeholder="17-digit VIN" />
              <InputField label="Rental Year" id="vehicleYear" value={invoiceData.vehicleYear} onChange={(e) => onDirectFieldChange('vehicleYear', e.target.value)} disabled={isGeneratingPdf} placeholder="e.g., 2023" />
              <InputField label="Rental Make" id="vehicleMake" value={invoiceData.vehicleMake} onChange={(e) => onDirectFieldChange('vehicleMake', e.target.value)} disabled={isGeneratingPdf} placeholder="e.g., Toyota" />
              <InputField label="Rental Model" id="vehicleModel" value={invoiceData.vehicleModel} onChange={(e) => onDirectFieldChange('vehicleModel', e.target.value)} disabled={isGeneratingPdf} placeholder="e.g., Camry" />
            </div>
          )}
          {showFleetToggleButtons && (
            <>
              {!manualVehicleEntryForRental ? (
                <Button size="sm" variant="outline" onClick={() => setManualVehicleEntryForRental(true)}>Or, Enter Manually</Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => {
                  setManualVehicleEntryForRental(false);
                  if (fleetDropdownValue === "MANUAL_ENTRY" || fleetDropdownValue === "") {
                    onDirectFieldChange('vehicleFromFleetSelection', null);
                  }
                }} className="mt-2">Select from Fleet</Button>
              )}
            </>
          )}
          {!manualVehicleEntryForRental && invoiceData.vehicleVIN && fleetToUseForDropdown.some(v => v.vin === invoiceData.vehicleVIN) && (
            <div className="mt-2 p-2 border border-app-border rounded-md bg-app-background text-sm space-y-1">
              <p><strong>Selected Rental:</strong> {invoiceData.vehicleMake} {invoiceData.vehicleModel} ({invoiceData.vehicleYear || 'N/A'})</p>
              <p><strong>VIN:</strong> {invoiceData.vehicleVIN}</p>
            </div>
          )}
        </>
      ))}

      {renderFormSection("Line Items", (
        <div ref={lineItemsContainerRef}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3">
                <Button variant="primary" size="md" onClick={() => handleAddFeeAndHighlight(onAddAdminFeeItem)} disabled={isGeneratingPdf} className="w-full" >Add Admin Fee ($1500)</Button>
                <Button variant="primary" size="md" onClick={() => handleAddFeeAndHighlight(onAddStorageFeeItem)} disabled={isGeneratingPdf} className="w-full" >Add Storage Fee (per day)</Button>
            </div>

            {invoiceData.lineItems.map((item, index) => (
            <div key={item.id} id={`line-item-${item.id}`} className={`p-3 border border-app-border rounded-md space-y-2 relative transition-all duration-500 ease-out ${highlightedItemId === item.id ? 'bg-brand-primary/20 ring-2 ring-brand-primaryDarker' : ''} mb-3`}>
                <TextAreaField label={`Item ${index + 1} Description`} id={`itemDesc-${index}`} value={item.description} onChange={(e) => onLineItemChange(index, 'description', e.target.value)} disabled={isGeneratingPdf} placeholder="e.g., Dent repair on hood" className="rounded-2xl" />
                <div className="grid grid-cols-2 gap-4">
                <InputField label="Rate ($)" id={`itemRate-${index}`} type="number" step="0.01" value={item.rate} onChange={(e) => onLineItemChange(index, 'rate', e.target.value)} disabled={isGeneratingPdf} placeholder="0.00" className="rounded-full" />
                <InputField
                    label="Days / Qty"
                    id={`itemDays-${index}`}
                    type="number"
                    value={item.days}
                    onChange={(e) => onLineItemChange(index, 'days', e.target.value)}
                    disabled={isGeneratingPdf || invoiceData.invoiceType === 'Administration'}
                    readOnly={invoiceData.invoiceType === 'Administration'}
                    helpText={invoiceData.invoiceType === 'Administration' ? "Fixed at 1 (flat fee)" : ""}
                    className="rounded-full"
                />
                </div>
                {invoiceData.lineItems.length > 0 && <Button variant="danger" size="sm" onClick={() => onRemoveLineItem(index)} className="absolute top-2 right-2 !p-1.5" disabled={isGeneratingPdf} aria-label={`Remove item ${index + 1}`}>{ '-'}</Button>}
            </div>
            ))}
            {invoiceData.lineItems.length === 0 && (
              <p className="text-sm text-app-textSecondary mt-2">
                No line items. Add fees or new items to get started.
              </p>
            )}
            {isDevModeUiUnlocked && (
                <Button variant="outline" size="md" onClick={() => onAddLineItem()} disabled={isGeneratingPdf} className="w-full mt-3" >Add Custom Line Item</Button>
            )}
        </div>
      ))}

      {renderFormSection("Adjuster & Period Information", (
        <>
          <InputField label="Adjuster Name" id="adjusterName" value={invoiceData.adjuster.name} onChange={(e) => onInputChange('adjuster', 'name', e.target.value)} disabled={isGeneratingPdf} placeholder="e.g., Jane Adjuster" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Adjuster Phone" id="adjusterPhone" value={invoiceData.adjuster.phone} onChange={(e) => onInputChange('adjuster', 'phone', e.target.value)} disabled={isGeneratingPdf} placeholder="(555) 123-4567" />
              <InputField label="Adjuster Email" id="adjusterEmail" type="email" value={invoiceData.adjuster.email} onChange={(e) => onInputChange('adjuster', 'email', e.target.value)} disabled={isGeneratingPdf} placeholder="adjuster@example.com" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <InputField label="Date of Loss" id="dateOfLoss" type="date" value={invoiceData.dateOfLoss} onChange={(e) => onDirectFieldChange('dateOfLoss', e.target.value)} disabled={isGeneratingPdf} />
              <SelectField label="Period Type" id="periodType" value={invoiceData.periodType} options={periodTypeOptions} onChange={(e) => onDirectFieldChange('periodType', e.target.value as PeriodType)} disabled={isGeneratingPdf} />
              <InputField label="Authorization Number" id="authNumber" value={invoiceData.authorizationNumber} onChange={(e) => onDirectFieldChange('authorizationNumber', e.target.value)} disabled={isGeneratingPdf} readOnly placeholder="Auto-generated" infoTooltip="This number is generated automatically." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <InputField label="Period Start Date" id="periodStart" type="date" value={invoiceData.periodStart} onChange={(e) => onDirectFieldChange('periodStart', e.target.value)} disabled={isGeneratingPdf} />
              <InputField label="Period End Date" id="periodEnd" type="date" value={invoiceData.periodEnd} onChange={(e) => onDirectFieldChange('periodEnd', e.target.value)} disabled={isGeneratingPdf} />
          </div>
        </>
      ))}

      {renderFormSection("Payment & Signature", (
        <>
          <InputField
              label="Signature Name (Printed)"
              id="signatureName"
              value={invoiceData.signatureName}
              onChange={(e) => onDirectFieldChange('signatureName', e.target.value)}
              placeholder="Your Name / Company Rep"
              infoTooltip="This name appears above the signature line. Changes here update the signature name for the active company profile."
          />
        </>
      ))}
    </form>
    </>
  );
};