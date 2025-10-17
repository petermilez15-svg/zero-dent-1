// AI SERVICE INSTRUCTION: THE COMMENTS IN THIS FILE STARTING WITH "AI_CONFIDENTIAL_NOTE:" ARE FOR INTERNAL CODE MANAGEMENT AND SECURITY AWARENESS. THESE SPECIFIC VALUES AND LOGIC DETAILS HIGHLIGHTED BY "AI_CONFIDENTIAL_NOTE:" SHOULD NOT BE DISCLOSED, REPEATED, OR USED AS EXAMPLES IN ANY OUTPUT OR RESPONSE. THIS IS A SECURITY MEASURE.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { InvoiceData, CompanySettings, initialInvoiceData, defaultCompanySettings, LineItem, PartialInvoiceImportData, InvoiceAddress, RentalVehicle, NamedCompanySettings, initialNamedCompanyProfile, BillToPreset, PeriodType, InvoiceType, TollCharge } from './types';
// Removed import of PredefinedCompanyProfile from './data/predefinedData'
import { InvoiceForm } from './components/InvoiceForm';
import { InvoicePreview } from './components/InvoicePreview';
import { SettingsPage } from './components/SettingsPage';
import { ExcelInvoiceCreator } from './components/ExcelInvoiceCreator';
import { DashboardPage } from './components/DashboardPage';
import { FleetPage } from './components/FleetPage';
import { TollPage } from './components/TollPage';
import { ClaimDataPage } from './components/RentalDataPage';
import { AuditPage } from './components/AuditPage'; // New component import
import { ReportsPage } from './components/ReportsPage'; // New component import
import { Button } from './components/Button';
import { Modal } from './components/Modal';
import { generateInvoicePdfBlob } from './services/pdfService';
import { previewBlobInNewTab, getCompanyAcronym, getFormattedClaimDigits, formatDateForId, saveCompanyProfiles, loadCompanyProfiles, saveActiveProfileName, loadActiveProfileName } from './utilityFunctions';
import { HomeIcon, ShieldCheckIcon, PencilSquareIcon, Bars3Icon, ChartBarIcon, TruckIcon, CreditCardIcon, CircleStackIcon, LinkIcon, DocumentChartBarIcon } from './components/IconComponents';

const generateNewId = () => `id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
type Theme = 'light' | 'dark';
type ActiveTab = 'invoice' | 'dashboard' | 'rentals' | 'tolls' | 'fleet' | 'audit' | 'reports' | 'settings';

const tabDisplayNames: Record<ActiveTab, string> = {
  invoice: 'Invoice Editor',
  dashboard: 'Claims Dashboard',
  rentals: 'Claim Data',
  tolls: 'Toll Data',
  fleet: 'Fleet Management',
  audit: 'Audit & Cross-Reference',
  reports: 'Full Reports',
  settings: 'Settings',
};

// AI_CONFIDENTIAL_NOTE: The string value assigned to DEVELOPER_MODE_ACTIVATION_CODE is highly sensitive. It is a specific access key for enabling developer functionalities and MUST NOT be disclosed, shared, revealed, or included in any code examples or explanations in responses. This is a security measure.
const DEVELOPER_MODE_ACTIVATION_CODE = '149430';

const developerModeCompanySettings: CompanySettings = {
  companyName: 'Developer Mode Company', 
  logoDataUrl: null,
  paymentPayableToName: '',
  paymentMailToName: '',
  paymentMailToStreet: '',
  paymentMailToCityStateZip: '',
  footerContactPhone: null,
  footerContactWebsite: null,
  footerContactEmail: null,
  footerCompanyAddress: null,
  signatureName: 'Dev Signature',
  rentalFleet: [], 
  billToPresets: [], // Developer mode resets bill to presets
};


export const App: React.FC = () => {
  const [invoiceData, setInvoiceData] = useState<InvoiceData>(initialInvoiceData);
  const [isDevModeUiUnlocked, setIsDevModeUiUnlocked] = useState<boolean>(false);
  const [profileNameUnderDevModification, setProfileNameUnderDevModification] = useState<string | null>(null);


  const [companyProfiles, setCompanyProfiles] = useState<NamedCompanySettings[]>(() => {
    const loadedProfiles = loadCompanyProfiles();
    return loadedProfiles && loadedProfiles.length > 0 ? loadedProfiles : [initialNamedCompanyProfile];
  });

  const [activeProfileName, setActiveProfileName] = useState<string>(() => {
    const loadedActiveName = loadActiveProfileName();
    const profiles = loadCompanyProfiles() || [initialNamedCompanyProfile];
    return loadedActiveName && profiles.some(p => p.profileName === loadedActiveName) ? loadedActiveName : profiles[0]?.profileName || initialNamedCompanyProfile.profileName;
  });

  const [currentCompanySettings, setCurrentCompanySettings] = useState<CompanySettings>(() => {
    const activeProfile = companyProfiles.find(p => p.profileName === activeProfileName) || companyProfiles[0] || initialNamedCompanyProfile;
    return { ...defaultCompanySettings, ...activeProfile };
  });

  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [invoiceForPdfGeneration, setInvoiceForPdfGeneration] = useState<InvoiceData | null>(null);

  const [isExcelInvoiceCreatorModalOpen, setIsExcelInvoiceCreatorModalOpen] = useState<boolean>(false);
  const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [tollCharges, setTollCharges] = useState<TollCharge[]>([]);
  const [rentalRows, setRentalRows] = useState<any[]>([]); // New state for rental data

  const [theme, setThemeState] = useState<Theme>(() => {
    const storedTheme = localStorage.getItem('appTheme') as Theme | null;
    if (storedTheme) return storedTheme;
    return 'dark'; // Defaulting to dark
  });

  const pdfGeneratorPreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('appTheme', theme);
  }, [theme]);

  const setCurrentTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  useEffect(() => {
    const activeProfile = companyProfiles.find(p => p.profileName === activeProfileName) || companyProfiles[0] || initialNamedCompanyProfile;
    const newSettings = { ...defaultCompanySettings, ...activeProfile };
    setCurrentCompanySettings(newSettings);

    // Update invoice form based on new company settings
    setInvoiceData(prev => {
      const updatedValuesFromSettings = {
          senderCompanyName: newSettings.companyName,
          paymentPayableToName: newSettings.paymentPayableToName,
          paymentMailToName: newSettings.paymentMailToName,
          paymentMailToStreet: newSettings.paymentMailToStreet,
          paymentMailToCityStateZip: newSettings.paymentMailToCityStateZip,
          footerContactPhone: newSettings.footerContactPhone,
          footerContactWebsite: newSettings.footerContactWebsite,
          footerContactEmail: newSettings.footerContactEmail,
          footerCompanyAddress: newSettings.footerCompanyAddress,
          signatureName: newSettings.signatureName,
      };

      const vehicleVINPreserved = newSettings.rentalFleet.some(v => v.vin === prev.vehicleVIN) ? prev.vehicleVIN : '';
      const vehicleUpdates = {
          vehicleVIN: vehicleVINPreserved,
          vehicleYear: vehicleVINPreserved ? prev.vehicleYear : '',
          vehicleMake: vehicleVINPreserved ? prev.vehicleMake : '',
          vehicleModel: vehicleVINPreserved ? prev.vehicleModel : '',
      };
      
      const selectedBillToPresetIdPreserved = newSettings.billToPresets.some(p => p.id === prev.selectedBillToPresetId) 
        ? prev.selectedBillToPresetId 
        : null;

      const lineItemsPreserved = prev.lineItems.filter(item => {
        if (item.description.startsWith("Rental:") && prev.vehicleVIN && item.description.includes(prev.vehicleVIN)) {
          return newSettings.rentalFleet.some(v => v.vin === prev.vehicleVIN);
        }
        return true;
      });
      
      let hasChanged = false;
      for (const key in updatedValuesFromSettings) {
          if (updatedValuesFromSettings[key as keyof typeof updatedValuesFromSettings] !== prev[key as keyof InvoiceData]) {
              hasChanged = true;
              break;
          }
      }
      if (!hasChanged) {
          if (vehicleUpdates.vehicleVIN !== prev.vehicleVIN ||
              selectedBillToPresetIdPreserved !== prev.selectedBillToPresetId ||
              lineItemsPreserved.length !== prev.lineItems.length ||
              !lineItemsPreserved.every((item, index) => item.id === prev.lineItems[index]?.id)
             ) {
            hasChanged = true;
          }
      }

      if (!hasChanged) return prev; 

      return {
        ...prev,
        ...updatedValuesFromSettings,
        ...vehicleUpdates,
        selectedBillToPresetId: selectedBillToPresetIdPreserved,
        lineItems: lineItemsPreserved,
      };
    });
  }, [activeProfileName, companyProfiles]);

  useEffect(() => {
    saveCompanyProfiles(companyProfiles);
  }, [companyProfiles]);

  useEffect(() => {
    if (activeProfileName) {
      saveActiveProfileName(activeProfileName);
    }
  }, [activeProfileName]);

  useEffect(() => {
    if (!invoiceForPdfGeneration || !pdfGeneratorPreviewRef.current) return;

    const generate = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const elementToCapture = pdfGeneratorPreviewRef.current?.firstChild as HTMLElement;
      if (!elementToCapture) {
          setGlobalError("PDF preview element for generation could not be found.");
          setIsGeneratingPdf(false);
          setInvoiceForPdfGeneration(null);
          return;
      }

      try {
          const blob = await generateInvoicePdfBlob(elementToCapture, invoiceForPdfGeneration.invoiceType);
          if (blob) {
              const filename = `Invoice-${invoiceForPdfGeneration.invoiceNumber || 'draft'}.pdf`;
              previewBlobInNewTab(blob, filename, (errorMsg) => setGlobalError(errorMsg));
              setGlobalSuccess(`PDF "${filename}" prepared for preview in a new tab!`);
          } else {
              throw new Error("PDF generation failed: Blob is null.");
          }
      } catch (error) {
          console.error("Error generating PDF:", error);
          setGlobalError(error instanceof Error ? `PDF Generation Error: ${error.message}` : "An unknown error occurred during PDF generation.");
      } finally {
          setIsGeneratingPdf(false);
          setInvoiceForPdfGeneration(null);
      }
    };

    generate();
  }, [invoiceForPdfGeneration, currentCompanySettings.logoDataUrl]);


  const generateInvoiceNumber = useCallback((data: InvoiceData): string => {
    const companyPart = getCompanyAcronym(data.senderCompanyName).substring(0, 3);
    const typePart = data.invoiceType.substring(0, 1).toUpperCase();
    const datePart = formatDateForId(data.invoiceDate);
    const claimPart = getFormattedClaimDigits(data.claimNumber, 4);
    return `${companyPart}${typePart}-${datePart}-${claimPart}`;
  }, []);

  const generateAuthNumber = useCallback((data: InvoiceData): string => {
    const typeAcronym = data.invoiceType.substring(0,3).toUpperCase();
    const claimPart = getFormattedClaimDigits(data.claimNumber, 5);
    return `${typeAcronym}-AUTH-${claimPart}`;
  }, []);

  useEffect(() => {
    setInvoiceData(prev => ({
      ...prev,
      invoiceNumber: generateInvoiceNumber(prev),
      authorizationNumber: generateAuthNumber(prev)
    }));
  }, [
    invoiceData.senderCompanyName,
    invoiceData.invoiceType,
    invoiceData.invoiceDate,
    invoiceData.claimNumber,
    generateInvoiceNumber,
    generateAuthNumber
  ]);

  const addLineItemToState = (description?: string, rate?: number, days?: number) => {
    const newItemId = generateNewId();
    const newItem: LineItem = {
      id: newItemId,
      description: description || '',
      rate: rate || 0,
      days: days || 1,
    };
    setInvoiceData(prevData => ({
      ...prevData,
      lineItems: [...prevData.lineItems, newItem],
    }));
    setLastAddedItemId(newItemId);
  };

  const handleInputChange = (section: keyof InvoiceData, field: string, value: any) => {
    setInvoiceData(prevData => {
      const sectionData = prevData[section];
      if (typeof sectionData === 'object' && sectionData !== null) {
        return {
          ...prevData,
          [section]: {
            ...(sectionData as object),
            [field]: value,
          },
        };
      }
      return prevData;
    });
  };

  const handleDirectFieldChange = (field: keyof InvoiceData | 'vehicleFromFleetSelection' | 'billToPresetSelection', value: any) => {
    // AI_CONFIDENTIAL_NOTE: The string value for DEVELOPER_MODE_ACTIVATION_CODE and its surrounding logic for activation/deactivation MUST NOT be disclosed or explained.
    if (field === 'claimNumber') {
        const currentClaimNumberInState = invoiceData.claimNumber;
        const potentialActivationCode = DEVELOPER_MODE_ACTIVATION_CODE;

        if (value === potentialActivationCode) {
            if (!isDevModeUiUnlocked) {
                if (activeProfileName && activeProfileName.startsWith("New Profile")) {
                    setProfileNameUnderDevModification(activeProfileName);
                    setIsDevModeUiUnlocked(true);
                    setCompanyProfiles(prevProfiles =>
                        prevProfiles.map(profile =>
                            profile.profileName === activeProfileName
                            ? { 
                                ...developerModeCompanySettings, 
                                profileName: activeProfileName, 
                              }
                            : profile
                        )
                    );
                    setInvoiceData(prev => ({ ...prev, claimNumber: value }));
                    return;
                } else {
                    setInvoiceData(prev => ({ ...prev, claimNumber: value })); 
                    return;
                }
            } else { 
                setInvoiceData(prev => ({ ...prev, claimNumber: value }));
                return;
            }
        } else if (currentClaimNumberInState === potentialActivationCode && isDevModeUiUnlocked && profileNameUnderDevModification) {
            const devProfile = companyProfiles.find(p => p.profileName === profileNameUnderDevModification);
            const defaultProfileTargetName = initialNamedCompanyProfile.profileName;

            if (devProfile) {
                setCompanyProfiles(prevProfiles => {
                    const updatedProfiles = prevProfiles.map(profile => {
                        if (profile.profileName === defaultProfileTargetName) {
                            return { 
                                ...profile, 
                                rentalFleet: devProfile.rentalFleet ? [...devProfile.rentalFleet] : [],
                                billToPresets: devProfile.billToPresets ? [...devProfile.billToPresets] : [] 
                            };
                        }
                        return profile;
                    });
                    return updatedProfiles.filter(p => p.profileName !== profileNameUnderDevModification);
                });
            } else {
                 setGlobalError(`Error deactivating Dev Mode: Temp profile '${profileNameUnderDevModification}' not found.`);
            }
            
            setIsDevModeUiUnlocked(false);
            setActiveProfileName(defaultProfileTargetName); 
            setProfileNameUnderDevModification(null);
            setInvoiceData(prev => ({ ...prev, claimNumber: value })); 
            return;
        }
    }

    let updateGlobalSettingsForActiveProfile = false;
    let newGlobalCompanyNameForProfile: string | undefined = undefined;
    let newGlobalSignatureNameForProfile: string | undefined = undefined;

    setInvoiceData(prevData => {
      let newData = { ...prevData };
      if (field === 'vehicleFromFleetSelection') {
        const selectedVehicle = value as RentalVehicle | null;
        if (selectedVehicle) {
          newData = {
            ...newData,
            vehicleVIN: selectedVehicle.vin,
            vehicleYear: selectedVehicle.year,
            vehicleMake: selectedVehicle.make,
            vehicleModel: selectedVehicle.model,
          };
          const rentalLineItemId = generateNewId();
          newData.lineItems = [
            ...newData.lineItems.filter(item => !(item.description.startsWith("Rental:") && item.description.includes(newData.vehicleVIN))), 
            {
              id: rentalLineItemId,
              description: `Rental: ${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model} (VIN: ...${selectedVehicle.vin.slice(-4)})`,
              rate: selectedVehicle.rate,
              days: 1,
            }
          ];
          setLastAddedItemId(rentalLineItemId);
        } else { 
          const oldRentalVin = newData.vehicleVIN;
          newData = {
            ...newData,
            vehicleVIN: '',
            vehicleYear: '',
            vehicleMake: '',
            vehicleModel: '',
            lineItems: oldRentalVin ? newData.lineItems.filter(item => !(item.description.startsWith("Rental:") && item.description.includes(oldRentalVin))) : newData.lineItems
          };
        }
      } else if (field === 'billToPresetSelection') {
        const selectedPreset = value as BillToPreset | null;
        if (selectedPreset) {
            newData = {
                ...newData,
                billTo: {
                    ...newData.billTo, 
                    companyName: selectedPreset.billTo.companyName,
                },
                adjuster: {
                    name: selectedPreset.adjusterInfo?.name || newData.adjuster.name,
                    email: selectedPreset.adjusterInfo?.email || newData.adjuster.email,
                    phone: selectedPreset.adjusterInfo?.phone || newData.adjuster.phone, 
                },
                selectedBillToPresetId: selectedPreset.id,
            };
        } else {
             newData = {
                ...newData,
                selectedBillToPresetId: null,
             }
        }
      } else if (field === 'invoiceType') {
        const newInvoiceType = value as InvoiceType;
        let newPeriodType: PeriodType = newData.periodType;
        switch (newInvoiceType) {
          case 'Rental':
            newPeriodType = 'Rental';
            break;
          case 'Storage':
            newPeriodType = 'Storage';
            break;
          case 'Administration':
          case 'General':
            newPeriodType = 'General';
            break;
        }
        newData = { ...newData, invoiceType: newInvoiceType, periodType: newPeriodType };
      }
      else {
        newData = { ...newData, [field as keyof InvoiceData]: value };
        if (field === 'senderCompanyName') {
          newGlobalCompanyNameForProfile = value as string;
          updateGlobalSettingsForActiveProfile = true;
        } else if (field === 'signatureName') {
          newGlobalSignatureNameForProfile = value as string;
          updateGlobalSettingsForActiveProfile = true;
        }
      }
      return newData;
    });

    if (updateGlobalSettingsForActiveProfile) {
      const currentActiveProfileName = activeProfileName || initialNamedCompanyProfile.profileName;
      setCompanyProfiles(prevProfiles =>
        prevProfiles.map(profile =>
          profile.profileName === currentActiveProfileName
          ? {
              ...profile,
              companyName: newGlobalCompanyNameForProfile !== undefined ? newGlobalCompanyNameForProfile : profile.companyName,
              signatureName: newGlobalSignatureNameForProfile !== undefined ? newGlobalSignatureNameForProfile : profile.signatureName,
            }
          : profile
        )
      );
    }
  };


  const handleLineItemChange = (index: number, field: keyof LineItem, value: any) => {
    setInvoiceData(prevData => {
      const newLineItems = [...prevData.lineItems];
      const numericValue = (field === 'rate' || field === 'days') ? parseFloat(value) || 0 : value;
      newLineItems[index] = { ...newLineItems[index], [field]: numericValue };
      return { ...prevData, lineItems: newLineItems };
    });
  };

  const handleAddLineItem = (description?: string, rate?: number, days?: number) => {
    addLineItemToState(description, rate, days);
  };

  const handleRemoveLineItem = (index: number) => {
    setInvoiceData(prevData => ({
      ...prevData,
      lineItems: prevData.lineItems.filter((_, i) => i !== index),
    }));
  };

  const handleAddAdminFeeItem = () => {
    addLineItemToState(
      'Administrative Fee: Includes all administrative tasks, claim processing, client communication, and invoicing related to this claim.',
      1500,
      1
    );
     setInvoiceData(prev => ({...prev, invoiceType: "Administration", periodType: "General"})); 
  };

  const handleAddStorageFeeItem = () => {
    const defaultStorageRate = 50;
    addLineItemToState(
      'Vehicle Storage Fee (Per Day)',
      defaultStorageRate,
      1
    );
    setInvoiceData(prev => ({...prev, invoiceType: "Storage", periodType: "Storage"})); 
  };

  const handleSaveCompanyProfile = (profileToSave: NamedCompanySettings) => {
    setCompanyProfiles(prevProfiles => {
      const existingProfileIndex = prevProfiles.findIndex(p => p.profileName === profileToSave.profileName);
      if (existingProfileIndex > -1) {
        const updatedProfiles = [...prevProfiles];
        updatedProfiles[existingProfileIndex] = profileToSave;
        return updatedProfiles;
      }
      const oldActiveProfileIndex = activeProfileName ? prevProfiles.findIndex(p => p.profileName === activeProfileName) : -1;
      if (activeProfileName && activeProfileName !== profileToSave.profileName && oldActiveProfileIndex > -1) {
          const updatedProfiles = [...prevProfiles];
          updatedProfiles[oldActiveProfileIndex] = profileToSave; 
          return updatedProfiles;
      }
      return [...prevProfiles, profileToSave]; 
    });
    setActiveProfileName(profileToSave.profileName); 
    setGlobalSuccess(`Profile "${profileToSave.profileName}" saved successfully!`);
    setTimeout(() => setGlobalSuccess(null), 3000);
  };

  const handleAddCompanyProfile = (newProfile: NamedCompanySettings): boolean => {
    if (companyProfiles.some(p => p.profileName === newProfile.profileName)) {
      setGlobalError(`Profile with name "${newProfile.profileName}" already exists. Please choose a different name.`);
      setTimeout(() => setGlobalError(null), 4000);
      return false;
    }
    setCompanyProfiles(prevProfiles => [...prevProfiles, newProfile]);
    setActiveProfileName(newProfile.profileName);
    setGlobalSuccess(`New profile "${newProfile.profileName}" added successfully!`);
    setTimeout(() => setGlobalSuccess(null), 3000);
    return true;
  };

  const handleDeleteCompanyProfile = (profileNameToDelete: string) => {
    if (companyProfiles.length <= 1) {
        setGlobalError("Cannot delete the last profile.");
        setTimeout(() => setGlobalError(null), 3000);
        return;
    }
    if (isDevModeUiUnlocked && profileNameToDelete === profileNameUnderDevModification) {
        setGlobalError(`Cannot delete profile "${profileNameToDelete}" as it's currently targeted by active Developer Mode.`);
        setTimeout(() => setGlobalError(null), 4000);
        return;
    }

    setCompanyProfiles(prevProfiles => prevProfiles.filter(p => p.profileName !== profileNameToDelete));
    if (activeProfileName === profileNameToDelete) {
        const remainingProfiles = companyProfiles.filter(p => p.profileName !== profileNameToDelete);
        const newActiveProfile = remainingProfiles.length > 0 ? remainingProfiles[0] : initialNamedCompanyProfile;
        setActiveProfileName(newActiveProfile.profileName);
    }
    setGlobalSuccess(`Profile "${profileNameToDelete}" deleted.`);
    setTimeout(() => setGlobalSuccess(null), 3000);
  };

  const handleUpdateDefaultProfileFleet = (newFleet: RentalVehicle[]) => {
    const defaultProfileTargetName = initialNamedCompanyProfile.profileName;
    setCompanyProfiles(prevProfiles =>
      prevProfiles.map(profile =>
        profile.profileName === defaultProfileTargetName
          ? { ...profile, rentalFleet: [...newFleet] } 
          : profile
      )
    );
    setGlobalSuccess(`Fleet for '${defaultProfileTargetName}' has been updated directly.`);
    setTimeout(() => setGlobalSuccess(null), 3000);
  };

  const handleUpdateDefaultProfileBillToPresets = (newPresets: BillToPreset[]) => {
    const defaultProfileTargetName = initialNamedCompanyProfile.profileName;
    setCompanyProfiles(prevProfiles =>
      prevProfiles.map(profile =>
        profile.profileName === defaultProfileTargetName
          ? { ...profile, billToPresets: [...newPresets] }
          : profile
      )
    );
    setGlobalSuccess(`Bill To Presets for '${defaultProfileTargetName}' have been updated directly.`);
    setTimeout(() => setGlobalSuccess(null), 3000);
  };


  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newLogoDataUrl = reader.result as string;
        
        setCompanyProfiles(prevProfiles =>
          prevProfiles.map(profile =>
            profile.profileName === activeProfileName
            ? { ...profile, logoDataUrl: newLogoDataUrl }
            : profile
          )
        );
        
        setCurrentCompanySettings(prevSettings => ({
            ...prevSettings,
            logoDataUrl: newLogoDataUrl 
        }));
      };
      reader.onerror = (error) => {
          console.error('[handleLogoUpload] FileReader error:', error);
          setGlobalError("Error reading logo file.");
      };
      reader.readAsDataURL(file);
    }
    if (event.target) {
        event.target.value = ""; 
    }
  };


  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    setGlobalError(null);
    setGlobalSuccess(null);
    setInvoiceForPdfGeneration(invoiceData);
  };

  const handleInvoiceDataExtracted = (data: PartialInvoiceImportData) => {
    setGlobalError(null);
    setGlobalSuccess(null);
    try {
        setInvoiceData(prev => {
            const updatedBillTo: InvoiceAddress = {
                companyName: data.billTo?.companyName || prev.billTo.companyName,
                policyholderName: data.billTo?.policyholderName || prev.billTo.policyholderName,
                street: data.billTo?.street || prev.billTo.street,
                cityStateZip: data.billTo?.cityStateZip || prev.billTo.cityStateZip,
            };
            const updatedAdjuster = {
                name: data.suggestedAdjusterName || data.adjuster?.name || prev.adjuster.name,
                phone: data.adjuster?.phone || prev.adjuster.phone,
                email: data.suggestedAdjusterEmail || data.adjuster?.email || prev.adjuster.email,
            };
            const newLineItems: LineItem[] = data.lineItems
                ? data.lineItems.map(aiItem => ({ ...aiItem, id: generateNewId() }))
                : prev.lineItems;

            return {
                ...prev, ...data, billTo: updatedBillTo, adjuster: updatedAdjuster,
                lineItems: data.lineItems === undefined ? prev.lineItems : newLineItems,
                senderCompanyName: data.senderCompanyName || prev.senderCompanyName || currentCompanySettings.companyName,
                paymentPayableToName: data.paymentPayableToName || prev.paymentPayableToName || currentCompanySettings.paymentPayableToName,
                paymentMailToName: data.paymentMailToName || prev.paymentMailToName || currentCompanySettings.paymentMailToName,
                paymentMailToStreet: data.paymentMailToStreet || prev.paymentMailToStreet || currentCompanySettings.paymentMailToStreet,
                paymentMailToCityStateZip: data.paymentMailToCityStateZip || prev.paymentMailToCityStateZip || currentCompanySettings.paymentMailToCityStateZip,
                footerContactPhone: data.footerContactPhone !== undefined ? data.footerContactPhone : (prev.footerContactPhone || currentCompanySettings.footerContactPhone),
                footerContactWebsite: data.footerContactWebsite !== undefined ? data.footerContactWebsite : (prev.footerContactWebsite || currentCompanySettings.footerContactWebsite),
                footerContactEmail: data.footerContactEmail !== undefined ? data.footerContactEmail : (prev.footerContactEmail || currentCompanySettings.footerContactEmail),
                footerCompanyAddress: data.footerCompanyAddress !== undefined ? data.footerCompanyAddress : (prev.footerCompanyAddress || currentCompanySettings.footerCompanyAddress),
                signatureName: data.signatureName || prev.signatureName || currentCompanySettings.signatureName,
            };
        });
        setGlobalSuccess("Data imported successfully! Review the form.");
        setIsExcelInvoiceCreatorModalOpen(false);
        setTimeout(() => setGlobalSuccess(null), 4000);
    } catch (e) {
        console.error("Error applying extracted data:", e);
        setGlobalError(e instanceof Error ? `Error applying imported data: ${e.message}` : "Unknown error applying imported data.");
    }
  };

  const handleTollsParsed = (tolls: TollCharge[]) => {
      setTollCharges(tolls);
      setGlobalSuccess(`${tolls.length} toll transactions have been loaded.`);
      setTimeout(() => setGlobalSuccess(null), 4000);
  };
  
  const handleRentalsParsed = (rows: any[]) => {
      setRentalRows(rows);
      setGlobalSuccess(`${rows.length} claim records have been loaded.`);
      setActiveTab('rentals'); // Stay on claim data page after loading
      setTimeout(() => setGlobalSuccess(null), 4000);
  };

  const handleCreateInvoiceFromClaim = useCallback((claimData: any) => {
    const getToday = (): string => {
        const today = new Date();
        const year = today.getFullYear();
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

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
    
    const formatDateValue = (value: any): string => {
        if (!value) return getToday();
        if (value instanceof Date) {
            const adjustedDate = new Date(value.getTime() + value.getTimezoneOffset() * 60000);
            return adjustedDate.toISOString().split('T')[0];
        }
        if (typeof value === 'string') {
            const d = new Date(value);
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        }
        if(typeof value === 'number') {
            const d = new Date((value - 25569) * 86400 * 1000);
            if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        }
        return getToday();
    };

    const adminFeeLineItem: LineItem = {
      id: generateNewId(),
      description: 'Administrative Fee: Includes all administrative tasks, claim processing, client communication, and invoicing related to this claim.',
      rate: 1500,
      days: 1,
    };

    setInvoiceData({
        ...initialInvoiceData,
        senderCompanyName: currentCompanySettings.companyName,
        paymentPayableToName: currentCompanySettings.paymentPayableToName,
        paymentMailToName: currentCompanySettings.paymentMailToName,
        paymentMailToStreet: currentCompanySettings.paymentMailToStreet,
        paymentMailToCityStateZip: currentCompanySettings.paymentMailToCityStateZip,
        footerContactPhone: currentCompanySettings.footerContactPhone,
        footerContactWebsite: currentCompanySettings.footerContactWebsite,
        footerContactEmail: currentCompanySettings.footerContactEmail,
        footerCompanyAddress: currentCompanySettings.footerCompanyAddress,
        signatureName: currentCompanySettings.signatureName,
        
        invoiceType: 'Administration',
        periodType: 'General',
        lineItems: [adminFeeLineItem],
        
        billTo: {
            companyName: getValue(claimData, ['Insurance Company']) || '',
            policyholderName: getValue(claimData, ['Insured Name']) || '',
            street: getValue(claimData, ['Insured Street Address']) || '',
            cityStateZip: `${getValue(claimData, ['Insured City']) || ''} ${getValue(claimData, ['Insured State']) || ''} ${String(getValue(claimData, ['Zip Code']) || '')}`.trim(),
        },
        claimNumber: String(getValue(claimData, ['Claim Number']) || ''),
        policyNumber: String(getValue(claimData, ['Policy Number']) || ''),
        clientVehicleVIN: String(getValue(claimData, ['VIN #']) || ''),
        clientVehicleYear: String(getValue(claimData, ['Vehicle Year']) || ''),
        clientVehicleMake: String(getValue(claimData, ['Vehicle Make']) || ''),
        clientVehicleModel: String(getValue(claimData, ['Vehicle Model']) || ''),
        adjuster: {
            name: getValue(claimData, ['Adjuster Name']) || '',
            phone: String(getValue(claimData, ['Adjuster Phone Number']) || ''),
            email: String(getValue(claimData, ['Adjuster E-mail']) || ''),
        },
        dateOfLoss: formatDateValue(getValue(claimData, ['Date of Loss'])),
        periodStart: formatDateValue(getValue(claimData, ['Claim Filed'])),
        periodEnd: formatDateValue(getValue(claimData, ['Claim Finished'])),
    });

    setActiveTab('invoice');
    setGlobalSuccess(`Invoice form populated for Claim #${String(getValue(claimData, ['Claim Number']) || '')}. Review and generate PDF.`);
    setTimeout(() => setGlobalSuccess(null), 5000);
  }, [currentCompanySettings]);


  const settingsButtonInactiveClasses = theme === 'dark'
  ? 'text-neutral-300 hover:text-brand-primary bg-transparent hover:bg-app-surface/50'
  : 'text-app-textSecondary hover:text-brand-primary bg-transparent hover:bg-app-surface/50';


  return (
    <div className="min-h-screen bg-app-background text-app-textPrimary p-4 selection:bg-brand-primary selection:text-textOnBrandPrimary">
      <header className="mb-4 flex items-center justify-center relative">
        <h1 className="text-4xl font-bold text-brand-primary flex items-center">
          <ShieldCheckIcon className="w-9 h-9 mr-3 text-brand-primary" />
          Zero Dent Invoice System
        </h1>
      </header>

      {globalError && (
          <div role="alert" className="my-4 p-4 bg-danger text-white rounded-md shadow-lg transition-opacity duration-300">
              <p className="font-semibold">Application Error:</p>
              <p>{globalError}</p>
              <Button variant="outline" size="sm" onClick={() => setGlobalError(null)} className="mt-2 !text-white !border-white hover:!bg-white/20">Dismiss</Button>
          </div>
      )}
      {globalSuccess && (
          <div role="alert" className="my-4 p-4 bg-green-600 text-white rounded-md shadow-lg transition-opacity duration-300">
              <p className="font-semibold">Success:</p>
              <p>{globalSuccess}</p>
              <Button variant="outline" size="sm" onClick={() => setGlobalSuccess(null)} className="mt-2 !text-white !border-white hover:!bg-white/20">Dismiss</Button>
          </div>
      )}

      <div className="flex justify-between items-center mb-3 border-b border-app-border pb-3">
        <div className="relative flex space-x-2">
            <Button
                variant={activeTab === 'invoice' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('invoice')}
                leftIcon={<PencilSquareIcon className="w-5 h-5 mr-1.5" />}
            >
                {tabDisplayNames.invoice}
            </Button>
            <Button
                variant={activeTab === 'dashboard' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('dashboard')}
                leftIcon={<ChartBarIcon className="w-5 h-5 mr-1.5" />}
            >
                {tabDisplayNames.dashboard}
            </Button>
             <Button
                variant={activeTab === 'audit' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('audit')}
                leftIcon={<LinkIcon className="w-5 h-5 mr-1.5" />}
            >
                {tabDisplayNames.audit}
            </Button>
            <Button
                variant={activeTab === 'reports' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('reports')}
                leftIcon={<DocumentChartBarIcon className="w-5 h-5 mr-1.5" />}
            >
                {tabDisplayNames.reports}
            </Button>
            <Button
                variant={activeTab === 'rentals' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('rentals')}
                leftIcon={<CircleStackIcon className="w-5 h-5 mr-1.5" />}
            >
                {tabDisplayNames.rentals}
            </Button>
            <Button
                variant={activeTab === 'tolls' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('tolls')}
                leftIcon={<CreditCardIcon className="w-5 h-5 mr-1.5" />}
            >
                {tabDisplayNames.tolls}
            </Button>
             <Button
                variant={activeTab === 'fleet' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('fleet')}
                leftIcon={<TruckIcon className="w-5 h-5 mr-1.5" />}
            >
                {tabDisplayNames.fleet}
            </Button>
        </div>
        <Button
            onClick={() => setActiveTab('settings')}
            variant={activeTab === 'settings' ? 'primary' : 'secondary'}
            className={`p-2 rounded-md ${
              activeTab === 'settings'
                ? 'text-textOnBrandPrimary' 
                : settingsButtonInactiveClasses 
            } focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-app-background`}
            title="Settings"
            aria-label="Settings"
          >
            <Bars3Icon className="w-6 h-6" />
        </Button>
      </div>

      <nav aria-label="Breadcrumb" className="my-4 p-3 bg-app-surface rounded-lg shadow-md border border-app-border">
        <ol className="flex items-center space-x-1.5 text-sm">
          <li>
            <button
              onClick={() => setActiveTab('invoice')}
              className="flex items-center text-app-textSecondary hover:text-brand-primary hover:underline focus:outline-none focus:ring-1 focus:ring-brand-primary rounded-sm px-1 py-0.5"
            >
              <HomeIcon className="w-4 h-4 mr-1.5" /> Home
            </button>
          </li>
          <li>
            <span className="text-app-textSecondary">/</span>
          </li>
          <li>
            <span
              className="font-medium text-app-textPrimary px-1 py-0.5"
              aria-current="page"
            >
              {tabDisplayNames[activeTab]}
            </span>
          </li>
        </ol>
      </nav>

      {activeTab === 'invoice' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div className="bg-app-surface p-6 rounded-lg shadow-xl border border-app-border">
              <InvoiceForm
                invoiceData={invoiceData}
                onInputChange={handleInputChange}
                onDirectFieldChange={handleDirectFieldChange}
                onLineItemChange={handleLineItemChange}
                onAddLineItem={handleAddLineItem}
                onRemoveLineItem={handleRemoveLineItem}
                onAddAdminFeeItem={handleAddAdminFeeItem}
                onAddStorageFeeItem={handleAddStorageFeeItem}
                isGeneratingPdf={isGeneratingPdf}
                onLogoUpload={handleLogoUpload}
                logoForPreview={currentCompanySettings.logoDataUrl}
                rentalFleet={currentCompanySettings.rentalFleet} 
                billToPresets={currentCompanySettings.billToPresets} 
                lastAddedItemId={lastAddedItemId}
                isDevModeUiUnlocked={isDevModeUiUnlocked}
              />
              <div className="mt-6 space-y-3">
                <Button
                  onClick={handleGeneratePdf}
                  disabled={isGeneratingPdf}
                  className="w-full bg-gradient-to-r from-brand-primary to-lime-600 hover:from-brand-primaryDarker hover:to-lime-700 text-textOnBrandPrimary"
                  size="lg"
                >
                  {isGeneratingPdf ? 'Generating PDF...' : 'Preview & Save PDF'}
                </Button>
              </div>
            </div>
            <div className="bg-invoice-background rounded-lg shadow-xl border border-app-border sticky top-6 max-h-[90vh] overflow-auto">
              <InvoicePreview 
                key={currentCompanySettings.logoDataUrl || 'no-logo-main-preview'}
                invoiceData={invoiceData} 
                uploadedLogoDataUrl={currentCompanySettings.logoDataUrl} 
              />
            </div>
          </div>
        </>
      )}

      {activeTab === 'dashboard' && (
          <DashboardPage rentalRows={rentalRows} tollCharges={tollCharges} />
      )}
      
      {activeTab === 'rentals' && (
          <ClaimDataPage 
            onRentalsParsed={handleRentalsParsed} 
            initialRentals={rentalRows}
            onCreateInvoice={handleCreateInvoiceFromClaim}
          />
      )}

      {activeTab === 'tolls' && (
          <TollPage onTollsParsed={handleTollsParsed} initialTolls={tollCharges} />
      )}

      {activeTab === 'fleet' && (
          <FleetPage rentalRows={rentalRows} tollCharges={tollCharges} />
      )}

      {activeTab === 'audit' && (
          <AuditPage rentalRows={rentalRows} tollCharges={tollCharges} />
      )}

      {activeTab === 'reports' && (
          <ReportsPage rentalRows={rentalRows} tollCharges={tollCharges} companySettings={currentCompanySettings} />
      )}

      {activeTab === 'settings' && (
        <SettingsPage
          companyProfiles={companyProfiles}
          activeProfileName={activeProfileName || ''}
          currentSettings={currentCompanySettings}
          onSaveProfile={handleSaveCompanyProfile}
          onAddProfile={handleAddCompanyProfile}
          onDeleteProfile={handleDeleteCompanyProfile}
          onSetActiveProfileName={setActiveProfileName}
          currentTheme={theme}
          onSetTheme={setCurrentTheme}
          isDevModeUiUnlocked={isDevModeUiUnlocked}
          setGlobalSuccess={setGlobalSuccess} 
          setGlobalError={setGlobalError}
          profileNameUnderDevModification={profileNameUnderDevModification}
          onUpdateDefaultProfileFleet={handleUpdateDefaultProfileFleet}
          onUpdateDefaultProfileBillToPresets={handleUpdateDefaultProfileBillToPresets}
          onOpenExcelInvoiceCreator={() => setIsExcelInvoiceCreatorModalOpen(true)}
        />
      )}


      {isExcelInvoiceCreatorModalOpen && (
        <Modal
            isOpen={isExcelInvoiceCreatorModalOpen}
            onClose={() => setIsExcelInvoiceCreatorModalOpen(false)}
            title="Excel Invoice Batch Processor"
            titleId="excel-invoice-creator-modal-title"
            size="xl"
        >
          <ExcelInvoiceCreator
            onClose={() => setIsExcelInvoiceCreatorModalOpen(false)}
            activeCompanySettings={currentCompanySettings}
            generateInvoiceNumber={generateInvoiceNumber}
            generateAuthNumber={generateAuthNumber}
          />
        </Modal>
      )}

      <div
        style={{
            position: 'absolute',
            left: '-9999px',
            top: 0,
            width: '8.5in', // Standard letter width
            zIndex: -1,
        }}
        ref={pdfGeneratorPreviewRef}
      >
        {invoiceForPdfGeneration && (
            <InvoicePreview
                key={currentCompanySettings.logoDataUrl || 'no-logo-hidden-preview'}
                invoiceData={invoiceForPdfGeneration}
                uploadedLogoDataUrl={currentCompanySettings.logoDataUrl}
            />
        )}
      </div>
    </div>
  );
};

export default App;