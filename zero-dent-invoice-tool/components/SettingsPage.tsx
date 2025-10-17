import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { CompanySettings, RentalVehicle, defaultCompanySettings, NamedCompanySettings, initialNamedCompanyProfile, BillToPreset } from '../types';
import { saveBlobAsFile, getCompanyAcronym } from '../utilityFunctions';
import { DocumentArrowDownIcon, SunIcon, MoonIcon, ArrowUpTrayIcon, PlusIcon, MinusIcon, PencilIcon, TrashIcon, DocumentDuplicateIcon, ArrowPathIcon, InformationCircleIcon, RectangleStackIcon } from './IconComponents';
import { Modal } from './Modal';


type Theme = 'light' | 'dark';

interface SettingsPageProps {
  companyProfiles: NamedCompanySettings[];
  activeProfileName: string | null;
  currentSettings: CompanySettings;
  onSaveProfile: (profile: NamedCompanySettings) => void;
  onAddProfile: (profile: NamedCompanySettings) => boolean;
  onDeleteProfile: (profileName: string) => void;
  onSetActiveProfileName: (profileName: string) => void;
  currentTheme: Theme;
  onSetTheme: (theme: Theme) => void;
  isDevModeUiUnlocked: boolean;
  setGlobalSuccess: (message: string | null) => void;
  setGlobalError: (message: string | null) => void;
  profileNameUnderDevModification: string | null;
  onUpdateDefaultProfileFleet: (newFleet: RentalVehicle[]) => void;
  onUpdateDefaultProfileBillToPresets: (newPresets: BillToPreset[]) => void; 
  onOpenExcelInvoiceCreator: () => void;
}

type ActiveSettingsSection =
  | 'profileAndBranding'
  | 'paymentSetup'
  | 'footerDetails'
  | 'rentalFleet'
  | 'billToPresets'
  | 'excelImport'
  | 'appearance'
  | 'jsonDataManagement';

const baseSettingsSections: { id: ActiveSettingsSection; title: string }[] = [
  { id: 'profileAndBranding', title: 'Company Profile & Branding' },
  { id: 'paymentSetup', title: 'Payment Details' },
  { id: 'excelImport', title: 'Excel Invoice Import' },
  { id: 'footerDetails', title: 'Invoice Footer Configuration' },
  { id: 'rentalFleet', title: 'Rental Fleet Management' },
  { id: 'billToPresets', title: 'Bill To Presets Management' },
  { id: 'appearance', title: 'Application Appearance' },
  { id: 'jsonDataManagement', title: 'Settings Data (Import/Export JSON)' },
];

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; helpText?: string; infoTooltip?: string }> =
  ({ label, id, className, type="text", helpText, infoTooltip, ...props }) => (
  <div className="mb-4">
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
      className={`w-full p-2 bg-app-background border border-app-border rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary text-app-textPrimary placeholder-app-textSecondary ${className || ''}`}
      {...props}
    />
    {helpText && <p className="mt-1 text-xs text-gray-400">{helpText}</p>}
  </div>
);

export const SettingsPage: React.FC<SettingsPageProps> = ({
    companyProfiles,
    activeProfileName,
    currentSettings,
    onSaveProfile,
    onAddProfile,
    onDeleteProfile,
    onSetActiveProfileName,
    currentTheme,
    onSetTheme,
    isDevModeUiUnlocked,
    setGlobalSuccess,
    setGlobalError,
    profileNameUnderDevModification,
    onUpdateDefaultProfileFleet,
    onUpdateDefaultProfileBillToPresets,
    onOpenExcelInvoiceCreator,
}) => {
  const [activeSection, setActiveSection] = useState<ActiveSettingsSection>('profileAndBranding');
  const [formData, setFormData] = useState<NamedCompanySettings>(() => {
    const active = companyProfiles.find(p => p.profileName === activeProfileName) || initialNamedCompanyProfile;
    // Ensure billToPresets is always an array
    const billToPresets = Array.isArray(active.billToPresets) ? active.billToPresets : [];
    return { ...initialNamedCompanyProfile, ...active, billToPresets };
  });
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(formData.logoDataUrl);

  const [isImportProfileNameModalOpen, setIsImportProfileNameModalOpen] = useState(false);
  const [newProfileNameForImport, setNewProfileNameForImport] = useState('');
  const [importedSettingsData, setImportedSettingsData] = useState<Partial<CompanySettings> | null>(null);
  const [localProfileNameEdit, setLocalProfileNameEdit] = useState<string>(activeProfileName || '');

  const [newVehicle, setNewVehicle] = useState<{ make: string, model: string, year: string, vin: string, rate: string }>({ make: '', model: '', year: '', vin: '', rate: '' });
  const [editingVehicleIndex, setEditingVehicleIndex] = useState<number | null>(null);

  const [newBillToPreset, setNewBillToPreset] = useState<{ id: string, name: string, billToCompanyName: string, adjusterName: string, adjusterEmail: string, adjusterPhone: string }>({ id: '', name: '', billToCompanyName: '', adjusterName: '', adjusterEmail: '', adjusterPhone: '' });
  const [editingBillToPresetIndex, setEditingBillToPresetIndex] = useState<number | null>(null);


  const settingsSections = baseSettingsSections.filter(section => {
    const devOnlySections: ActiveSettingsSection[] = ['rentalFleet', 'billToPresets', 'footerDetails', 'jsonDataManagement'];
    if (devOnlySections.includes(section.id)) {
      return isDevModeUiUnlocked;
    }
    return true;
  });

  useEffect(() => {
    const devOnlySections: ActiveSettingsSection[] = ['rentalFleet', 'billToPresets', 'footerDetails', 'jsonDataManagement'];
    if (devOnlySections.includes(activeSection) && !isDevModeUiUnlocked) {
        setActiveSection('profileAndBranding');
    }
  }, [isDevModeUiUnlocked, activeSection]);


  useEffect(() => {
    const active = companyProfiles.find(p => p.profileName === activeProfileName) ||
                   (companyProfiles.length > 0 ? companyProfiles[0] : initialNamedCompanyProfile);
    const billToPresets = Array.isArray(active.billToPresets) ? active.billToPresets : [];
    const completeSettings = { ...initialNamedCompanyProfile, ...active, billToPresets };
    setFormData(completeSettings);
    setLogoPreviewUrl(completeSettings.logoDataUrl);
    setLocalProfileNameEdit(completeSettings.profileName);
    setGlobalError(null);
  }, [activeProfileName, companyProfiles, setGlobalError]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalProfileNameEdit(e.target.value);
    setFormData(prev => ({ ...prev, profileName: e.target.value }));
  };

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newLogoDataUrl = reader.result as string;
        setFormData(prev => ({ ...prev, logoDataUrl: newLogoDataUrl }));
        setLogoPreviewUrl(newLogoDataUrl);
      };
      reader.readAsDataURL(file);
    } else {
      setFormData(prev => ({ ...prev, logoDataUrl: null }));
      setLogoPreviewUrl(null);
    }
  };

  const handleSettingsJsonUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setGlobalError(null);
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (text) {
                try {
                    const parsedSettings = JSON.parse(text) as Partial<CompanySettings>;
                    if (typeof parsedSettings.companyName === 'undefined' && typeof parsedSettings.paymentPayableToName === 'undefined') {
                        throw new Error("JSON file does not appear to be a valid Company Settings structure.");
                    }
                    const billToPresets = Array.isArray(parsedSettings.billToPresets) ? parsedSettings.billToPresets : [];
                    setImportedSettingsData({...parsedSettings, billToPresets});
                    setNewProfileNameForImport(parsedSettings.companyName || `Imported Profile ${Date.now()}`);
                    setIsImportProfileNameModalOpen(true);
                } catch (error) {
                    setGlobalError(error instanceof Error ? error.message : "Failed to parse JSON.");
                }
            }
        };
        reader.readAsText(file);
        event.target.value = "";
    }
  };

  const confirmImportNewProfile = () => {
    setGlobalError(null);
    if (importedSettingsData && newProfileNameForImport.trim()) {
      if (companyProfiles.some(p => p.profileName === newProfileNameForImport.trim())) {
        setGlobalError(`A profile named "${newProfileNameForImport.trim()}" already exists. Please choose a unique name for the import.`);
        return;
      }
      const newProfile: NamedCompanySettings = {
        ...defaultCompanySettings,
        ...importedSettingsData,
        profileName: newProfileNameForImport.trim(),
        rentalFleet: Array.isArray(importedSettingsData.rentalFleet) ? importedSettingsData.rentalFleet : [],
        billToPresets: Array.isArray(importedSettingsData.billToPresets) ? importedSettingsData.billToPresets : [],
      };
      const success = onAddProfile(newProfile);
      if (success) {
        onSetActiveProfileName(newProfile.profileName);
        setIsImportProfileNameModalOpen(false);
        setImportedSettingsData(null);
        setNewProfileNameForImport('');
      }
    } else if (!newProfileNameForImport.trim()) {
        setGlobalError("Profile name for import cannot be empty.");
    }
  };


  const handleDownloadSettingsJson = () => {
    setGlobalError(null);
    try {
      const { profileName, ...settingsToDownload } = formData;
      const jsonString = JSON.stringify(settingsToDownload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      saveBlobAsFile(blob, `${profileName || 'company'}-settings.json`);
      setGlobalSuccess(`Settings for "${profileName || 'current profile'}" downloaded.`);
    } catch (error) {
      setGlobalError("Failed to prepare settings for download.");
    }
  };


  const handleSaveCurrentProfile = () => {
    setGlobalError(null);
    if (!formData.profileName || formData.profileName.trim() === "") {
        setGlobalError("Profile name cannot be empty.");
        return;
    }
    if (activeProfileName !== formData.profileName && companyProfiles.some(p => p.profileName === formData.profileName)) {
        setGlobalError(`A profile named "${formData.profileName}" already exists. Please choose a unique name.`);
        return;
    }
    // Ensure billToPresets is an array before saving
    const profileToSave = {
        ...formData,
        billToPresets: Array.isArray(formData.billToPresets) ? formData.billToPresets : []
    };
    onSaveProfile(profileToSave);
  };

  const handleCreateNewProfile = () => {
    const newBaseName = "New Profile";
    let newName = newBaseName;
    let counter = 1;
    while(companyProfiles.some(p => p.profileName === newName)) {
        newName = `${newBaseName} ${counter++}`;
    }
    const newProfileData: NamedCompanySettings = {
      ...initialNamedCompanyProfile,
      profileName: newName,
      companyName: newName,
      logoDataUrl: null,
      rentalFleet: [],
      billToPresets: [], // New profiles start with empty bill to presets
    };
    const success = onAddProfile(newProfileData);
    if(success) {
        onSetActiveProfileName(newName);
    }
  };

  const handleDeleteCurrentProfile = () => {
    if (activeProfileName) {
        onDeleteProfile(activeProfileName);
    }
  };

  const handleNewVehicleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewVehicle(prev => ({ ...prev, [name]: value }));
    setGlobalError(null);
  };

  const handleAddOrUpdateVehicle = () => {
    setGlobalError(null);
    const rateNumber = parseFloat(newVehicle.rate);
    if (isNaN(rateNumber) || !newVehicle.make.trim() || !newVehicle.model.trim() || !newVehicle.vin.trim()) {
      setGlobalError("Make, Model, VIN, and a valid Rate are required for fleet vehicles.");
      return;
    }

    const vehicleToAddOrUpdate: RentalVehicle = {
      make: newVehicle.make.trim(),
      model: newVehicle.model.trim(),
      year: newVehicle.year.trim(),
      vin: newVehicle.vin.trim(),
      rate: rateNumber,
    };

    setFormData(prevFormData => {
      const newFleet = [...prevFormData.rentalFleet];
      if (editingVehicleIndex !== null) {
        const originalVin = prevFormData.rentalFleet[editingVehicleIndex].vin;
        if (vehicleToAddOrUpdate.vin.toLowerCase() !== originalVin.toLowerCase() &&
            newFleet.some((v, i) => i !== editingVehicleIndex && v.vin.toLowerCase() === vehicleToAddOrUpdate.vin.toLowerCase())) {
          setGlobalError(`Another vehicle with VIN ${vehicleToAddOrUpdate.vin} already exists.`);
          return prevFormData;
        }
        newFleet[editingVehicleIndex] = vehicleToAddOrUpdate;
      } else {
        if (newFleet.some(v => v.vin.toLowerCase() === vehicleToAddOrUpdate.vin.toLowerCase())) {
          setGlobalError(`A vehicle with VIN ${vehicleToAddOrUpdate.vin} already exists in the fleet.`);
          return prevFormData;
        }
        newFleet.push(vehicleToAddOrUpdate);
      }
      return { ...prevFormData, rentalFleet: newFleet };
    });

    setNewVehicle({ make: '', model: '', year: '', vin: '', rate: '' });
    setEditingVehicleIndex(null);
  };

  const handleEditVehicle = (index: number) => {
    const vehicleToEdit = formData.rentalFleet[index];
    setNewVehicle({ ...vehicleToEdit, rate: vehicleToEdit.rate.toString() });
    setEditingVehicleIndex(index);
    setGlobalError(null);
  };

  const handleDeleteVehicle = (index: number) => {
    setFormData(prevFormData => ({
      ...prevFormData,
      rentalFleet: prevFormData.rentalFleet.filter((_, i) => i !== index),
    }));
    if (editingVehicleIndex === index) {
      setNewVehicle({ make: '', model: '', year: '', vin: '', rate: '' });
      setEditingVehicleIndex(null);
    }
    setGlobalError(null);
  };

  const handleCopyDefaultFleet = () => {
    setGlobalError(null);
    const defaultProfile = companyProfiles.find(p => p.profileName === initialNamedCompanyProfile.profileName);
    if (defaultProfile) {
      setFormData(prev => ({
        ...prev,
        rentalFleet: [...defaultProfile.rentalFleet]
      }));
      setGlobalSuccess(`Fleet copied from '${initialNamedCompanyProfile.profileName}' to current form for '${formData.profileName}'. Remember to save the profile.`);
    } else {
      setGlobalError(`Could not find the default profile '${initialNamedCompanyProfile.profileName}' to copy fleet from.`);
    }
  };

  const handleSaveCurrentFleetToDefaultProfile = () => {
    setGlobalError(null);
    if (!formData.rentalFleet) {
        setGlobalError("No fleet data in current form to save to default.");
        return;
    }
    onUpdateDefaultProfileFleet([...formData.rentalFleet]);
  };

  // BillToPreset Management Handlers
  const handleNewBillToPresetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewBillToPreset(prev => ({ ...prev, [name]: value }));
    setGlobalError(null);
  };

  const handleAddOrUpdateBillToPreset = () => {
    setGlobalError(null);
    if (!newBillToPreset.name.trim() || !newBillToPreset.billToCompanyName.trim()) {
      setGlobalError("Preset Name and Bill To Company Name are required for Bill To Presets.");
      return;
    }

    const presetToAddOrUpdate: BillToPreset = {
      id: editingBillToPresetIndex !== null ? formData.billToPresets[editingBillToPresetIndex].id : `preset_${getCompanyAcronym(newBillToPreset.name)}_${Date.now()}`,
      name: newBillToPreset.name.trim(),
      billTo: { companyName: newBillToPreset.billToCompanyName.trim() },
      adjusterInfo: {
        name: newBillToPreset.adjusterName.trim() || undefined,
        email: newBillToPreset.adjusterEmail.trim() || undefined,
        phone: newBillToPreset.adjusterPhone.trim() || undefined,
      },
    };

    setFormData(prevFormData => {
      const newPresets = [...(prevFormData.billToPresets || [])];
      if (editingBillToPresetIndex !== null) {
        // Check for name collision when editing if name is changed
        const originalName = prevFormData.billToPresets[editingBillToPresetIndex].name;
        if (presetToAddOrUpdate.name !== originalName && newPresets.some((p, i) => i !== editingBillToPresetIndex && p.name === presetToAddOrUpdate.name)) {
          setGlobalError(`Another Bill To Preset with name "${presetToAddOrUpdate.name}" already exists.`);
          return prevFormData;
        }
        newPresets[editingBillToPresetIndex] = presetToAddOrUpdate;
      } else {
        // Check for name collision when adding new
        if (newPresets.some(p => p.name === presetToAddOrUpdate.name)) {
          setGlobalError(`A Bill To Preset with name "${presetToAddOrUpdate.name}" already exists.`);
          return prevFormData;
        }
        newPresets.push(presetToAddOrUpdate);
      }
      return { ...prevFormData, billToPresets: newPresets };
    });

    setNewBillToPreset({ id: '', name: '', billToCompanyName: '', adjusterName: '', adjusterEmail: '', adjusterPhone: '' });
    setEditingBillToPresetIndex(null);
  };

  const handleEditBillToPreset = (index: number) => {
    const presetToEdit = formData.billToPresets[index];
    setNewBillToPreset({
      id: presetToEdit.id,
      name: presetToEdit.name,
      billToCompanyName: presetToEdit.billTo.companyName,
      adjusterName: presetToEdit.adjusterInfo?.name || '',
      adjusterEmail: presetToEdit.adjusterInfo?.email || '',
      adjusterPhone: presetToEdit.adjusterInfo?.phone || '',
    });
    setEditingBillToPresetIndex(index);
    setGlobalError(null);
  };

  const handleDeleteBillToPreset = (index: number) => {
    setFormData(prevFormData => ({
      ...prevFormData,
      billToPresets: (prevFormData.billToPresets || []).filter((_, i) => i !== index),
    }));
    if (editingBillToPresetIndex === index) {
      setNewBillToPreset({ id: '', name: '', billToCompanyName: '', adjusterName: '', adjusterEmail: '', adjusterPhone: '' });
      setEditingBillToPresetIndex(null);
    }
    setGlobalError(null);
  };

  const handleCopyDefaultBillToPresets = () => {
    setGlobalError(null);
    const defaultProfile = companyProfiles.find(p => p.profileName === initialNamedCompanyProfile.profileName);
    if (defaultProfile && defaultProfile.billToPresets) {
      setFormData(prev => ({
        ...prev,
        billToPresets: [...defaultProfile.billToPresets]
      }));
      setGlobalSuccess(`Bill To Presets copied from '${initialNamedCompanyProfile.profileName}' to current form. Remember to save profile.`);
    } else {
      setGlobalError(`Could not find default profile or its presets to copy.`);
    }
  };

  const handleSaveCurrentBillToPresetsToDefault = () => {
    setGlobalError(null);
    if (!formData.billToPresets) {
      setGlobalError("No Bill To Presets in current form to save to default.");
      return;
    }
    onUpdateDefaultProfileBillToPresets([...formData.billToPresets]);
  };


  const renderSectionContent = () => {
    switch (activeSection) {
      case 'profileAndBranding':
        return (
          <>
            <div className="mb-6 p-4 border border-app-border rounded-lg bg-app-background">
                <h3 className="text-xl font-semibold text-app-textPrimary mb-3">Profile Management</h3>
                <div className="space-y-3">
                    <div>
                        <label htmlFor="activeProfileSelect" className="block text-sm font-medium text-app-textSecondary">Select Profile:</label>
                        <select
                            id="activeProfileSelect"
                            value={activeProfileName || ''}
                            onChange={(e) => onSetActiveProfileName(e.target.value)}
                            className="mt-1 block w-full p-2 bg-app-background border border-app-border rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary text-app-textPrimary"
                        >
                            {companyProfiles.map(profile => (
                                <option key={profile.profileName} value={profile.profileName}>
                                    {profile.profileName}
                                </option>
                            ))}
                        </select>
                    </div>
                    <InputField
                        label="Current Profile Name (Editable)"
                        id="profileName"
                        name="profileName"
                        value={localProfileNameEdit}
                        onChange={handleProfileNameChange}
                        placeholder="Enter a unique profile name"
                        infoTooltip="Changes here will rename the current profile upon saving. The profile name must be unique."
                    />
                    <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={handleCreateNewProfile} leftIcon={<PlusIcon className="w-4 h-4" />}>Create New Profile</Button>
                        <Button variant="danger" size="sm" onClick={handleDeleteCurrentProfile} disabled={companyProfiles.length <= 1} leftIcon={<MinusIcon className="w-4 h-4" />}>Delete Current Profile</Button>
                    </div>
                </div>
            </div>

            <h3 className="text-xl font-semibold text-app-textPrimary mb-4">Company Details for {formData.profileName || 'Current Profile'}</h3>
            <InputField label="Company Name" id="companyName" name="companyName" value={formData.companyName} onChange={handleChange} placeholder="Your Company LLC" />

            <div className="mb-4">
                <label htmlFor="logoDataUrl" className="block text-sm font-medium text-app-textSecondary mb-1">Company Logo Image</label>
                <input type="file" id="logoDataUrl" name="logoDataUrl" accept="image/*" onChange={handleLogoChange} className="w-full text-sm text-app-textSecondary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-textOnBrandPrimary hover:file:bg-brand-primaryDarker file:cursor-pointer file:transition-colors" />
                {logoPreviewUrl && <div className="mt-3"><p className="text-xs text-app-textSecondary mb-1">Current Logo Preview:</p><img src={logoPreviewUrl} alt="Logo Preview" className="h-20 w-auto border border-app-border rounded bg-white p-1 object-contain" /></div>}
            </div>

            <InputField label="Signature Name (Printed on Invoice)" id="signatureName" name="signatureName" value={formData.signatureName} onChange={handleChange} placeholder="Your Name / Company Rep" />
          </>
        );
      case 'paymentSetup':
        return (
          <>
            <h3 className="text-xl font-semibold text-app-textPrimary mb-4">Payment Details for {formData.profileName || 'Current Profile'}</h3>
            <InputField label="Payable To Name (for Checks)" id="paymentPayableToName" name="paymentPayableToName" value={formData.paymentPayableToName} onChange={handleChange} placeholder="Full Company Name for Payments" />
            <InputField label="Mail To Company Name" id="paymentMailToName" name="paymentMailToName" value={formData.paymentMailToName} onChange={handleChange} placeholder="Company Name for Mailing Address" />
            <InputField label="Mail To Street Address" id="paymentMailToStreet" name="paymentMailToStreet" value={formData.paymentMailToStreet} onChange={handleChange} placeholder="e.g., 123 Payment St." />
            <InputField label="Mail To City, State, Zip" id="paymentMailToCityStateZip" name="paymentMailToCityStateZip" value={formData.paymentMailToCityStateZip} onChange={handleChange} placeholder="e.g., Paymentville, ST 98765" />
          </>
        );
      case 'footerDetails':
        if (!isDevModeUiUnlocked) {
            return <p className="text-app-textSecondary">This section is available in Developer Mode.</p>;
        }
        return (
          <>
            <h3 className="text-xl font-semibold text-app-textPrimary mb-4">Invoice Footer for {formData.profileName || 'Current Profile'}</h3>
            <InputField label="Footer Contact Phone" id="footerContactPhone" name="footerContactPhone" type="tel" value={formData.footerContactPhone || ''} onChange={handleChange} placeholder="(555) 555-5555" />
            <InputField label="Footer Contact Website" id="footerContactWebsite" name="footerContactWebsite" type="url" value={formData.footerContactWebsite || ''} onChange={handleChange} placeholder="https://www.yourcompany.com" />
            <InputField label="Footer Contact Email" id="footerContactEmail" name="footerContactEmail" type="email" value={formData.footerContactEmail || ''} onChange={handleChange} placeholder="contact@yourcompany.com" />
            <InputField label="Footer Company Physical Address" id="footerCompanyAddress" name="footerCompanyAddress" value={formData.footerCompanyAddress || ''} onChange={handleChange} placeholder="e.g., 456 Main Office Rd, Yourtown, ST 12345" />
          </>
        );
      case 'rentalFleet':
        if (!isDevModeUiUnlocked) {
            return <p className="text-app-textSecondary">This section is available in Developer Mode.</p>;
        }
        const showCopyDefaultFleetButton = isDevModeUiUnlocked &&
                                          formData.profileName === profileNameUnderDevModification &&
                                          (!formData.rentalFleet || formData.rentalFleet.length === 0);

        const showSaveFleetToDefaultButton = isDevModeUiUnlocked &&
                                        formData.profileName === profileNameUnderDevModification &&
                                        formData.rentalFleet && formData.rentalFleet.length > 0;

        return (
          <>
            <h3 className="text-xl font-semibold text-app-textPrimary mb-4">Rental Fleet for {formData.profileName || 'Current Profile'}</h3>

            {showCopyDefaultFleetButton && (
                <div className="mb-4 p-3 border border-app-border rounded-lg bg-app-background">
                    <p className="text-sm text-app-textSecondary mb-2">
                        Fleet for this temp profile ("{formData.profileName}") is empty.
                    </p>
                    <Button
                        variant="outline" size="sm" onClick={handleCopyDefaultFleet}
                        leftIcon={<DocumentDuplicateIcon className="w-4 h-4" />}
                    >
                        Copy Fleet from '{initialNamedCompanyProfile.profileName}' to Form
                    </Button>
                </div>
            )}

            <div className="p-4 border border-app-border rounded-lg bg-app-background mb-6">
                <h4 className="text-lg font-medium text-brand-primary mb-3">{editingVehicleIndex !== null ? 'Edit Vehicle' : 'Add New Vehicle'}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField label="Make" id="newVehicleMake" name="make" value={newVehicle.make} onChange={handleNewVehicleChange} placeholder="e.g., Toyota" />
                    <InputField label="Model" id="newVehicleModel" name="model" value={newVehicle.model} onChange={handleNewVehicleChange} placeholder="e.g., Camry" />
                    <InputField label="Year" id="newVehicleYear" name="year" value={newVehicle.year} onChange={handleNewVehicleChange} placeholder="e.g., 2023" />
                    <InputField label="VIN" id="newVehicleVIN" name="vin" value={newVehicle.vin} onChange={handleNewVehicleChange} placeholder="Vehicle Identification Number" />
                    <InputField label="Daily Rate ($)" id="newVehicleRate" name="rate" type="number" step="0.01" value={newVehicle.rate} onChange={handleNewVehicleChange} placeholder="e.g., 50.00" />
                </div>
                <Button
                    variant="primary" size="sm" onClick={handleAddOrUpdateVehicle} className="mt-4"
                    leftIcon={editingVehicleIndex !== null ? <PencilIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
                >
                    {editingVehicleIndex !== null ? 'Update Vehicle in Form' : 'Add Vehicle to Form'}
                </Button>
                {editingVehicleIndex !== null && (
                    <Button variant="outline" size="sm" onClick={() => { setEditingVehicleIndex(null); setNewVehicle({ make: '', model: '', year: '', vin: '', rate: '' }); setGlobalError(null); }} className="mt-4 ml-2">
                        Cancel Edit
                    </Button>
                )}
            </div>

            {showSaveFleetToDefaultButton && (
                 <div className="my-6 p-3 border border-brand-primary rounded-lg bg-brand-primary/10">
                    <p className="text-sm text-brand-primaryDarker mb-2 font-semibold">
                        Dev Action for '{initialNamedCompanyProfile.profileName}' Fleet:
                    </p>
                    <Button
                        variant="primary" size="md" onClick={handleSaveCurrentFleetToDefaultProfile}
                        leftIcon={<ArrowPathIcon className="w-5 h-5" />}
                    >
                        Save Form's Fleet to '{initialNamedCompanyProfile.profileName}' Now
                    </Button>
                    <p className="text-xs text-app-textSecondary mt-1">Updates default profile's fleet. Final changes sync on dev mode exit.</p>
                </div>
            )}


            <div>
                <h4 className="text-lg font-medium text-app-textPrimary mb-3">Current Fleet in Form ({formData.rentalFleet.length} vehicles)</h4>
                {formData.rentalFleet.length === 0 ? (
                    <p className="text-app-textSecondary">No vehicles. Add using form{showCopyDefaultFleetButton ? "" : " or copy from default"} .</p>
                ) : (
                    <ul className="space-y-3">
                        {formData.rentalFleet.map((vehicle, index) => (
                            <li key={vehicle.vin + index} className="p-3 border border-app-border rounded-md bg-app-background flex justify-between items-center hover:bg-app-surface transition-colors">
                                <div>
                                    <p className="font-semibold text-app-textPrimary">{vehicle.make} {vehicle.model} ({vehicle.year})</p>
                                    <p className="text-xs text-app-textSecondary">VIN: {vehicle.vin} | Rate: ${vehicle.rate.toFixed(2)}/day</p>
                                </div>
                                <div className="space-x-2 flex-shrink-0">
                                    <Button variant="outline" size="sm" onClick={() => handleEditVehicle(index)} aria-label={`Edit ${vehicle.make} ${vehicle.model}`}>
                                        <PencilIcon className="w-4 h-4" />
                                    </Button>
                                    <Button variant="danger" size="sm" onClick={() => handleDeleteVehicle(index)} aria-label={`Delete ${vehicle.make} ${vehicle.model}`}>
                                        <TrashIcon className="w-4 h-4" />
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
          </>
        );
      case 'billToPresets':
        if (!isDevModeUiUnlocked) {
            return <p className="text-app-textSecondary">This section is available in Developer Mode.</p>;
        }
        const showCopyDefaultPresetsButton = isDevModeUiUnlocked &&
                                            formData.profileName === profileNameUnderDevModification &&
                                            (!formData.billToPresets || formData.billToPresets.length === 0);

        const showSavePresetsToDefaultButton = isDevModeUiUnlocked &&
                                            formData.profileName === profileNameUnderDevModification &&
                                            formData.billToPresets && formData.billToPresets.length > 0;
        return (
            <>
                <h3 className="text-xl font-semibold text-app-textPrimary mb-4">Bill To Presets for {formData.profileName || 'Current Profile'}</h3>
                <p className="text-sm text-app-textSecondary mb-4">Manage the list of companies for the 'Quick Fill Bill To' dropdown on the invoice form.</p>

                {showCopyDefaultPresetsButton && (
                    <div className="mb-4 p-3 border border-app-border rounded-lg bg-app-background">
                        <p className="text-sm text-app-textSecondary mb-2">
                            Bill To Presets for this temp profile ("{formData.profileName}") are empty.
                        </p>
                        <Button
                            variant="outline" size="sm" onClick={handleCopyDefaultBillToPresets}
                            leftIcon={<DocumentDuplicateIcon className="w-4 h-4" />}
                        >
                            Copy Presets from '{initialNamedCompanyProfile.profileName}' to Form
                        </Button>
                    </div>
                )}

                <div className="p-4 border border-app-border rounded-lg bg-app-background mb-6">
                    <h4 className="text-lg font-medium text-brand-primary mb-3">{editingBillToPresetIndex !== null ? 'Edit Bill To Preset' : 'Add New Bill To Preset'}</h4>
                    <InputField label="Preset Name (for dropdown)" id="newPresetName" name="name" value={newBillToPreset.name} onChange={handleNewBillToPresetChange} placeholder="e.g., State Farm Insurance" />
                    <InputField label="Bill To Company Name (actual)" id="newPresetBillToCompany" name="billToCompanyName" value={newBillToPreset.billToCompanyName} onChange={handleNewBillToPresetChange} placeholder="e.g., State Farm Insurance Companies" />
                    <InputField label="Adjuster Name (optional)" id="newPresetAdjusterName" name="adjusterName" value={newBillToPreset.adjusterName} onChange={handleNewBillToPresetChange} placeholder="e.g., State Farm Claims Dept" />
                    <InputField label="Adjuster Email (optional)" id="newPresetAdjusterEmail" name="adjusterEmail" type="email" value={newBillToPreset.adjusterEmail} onChange={handleNewBillToPresetChange} placeholder="e.g., claims@statefarm.com" />
                    <InputField label="Adjuster Phone (optional)" id="newPresetAdjusterPhone" name="adjusterPhone" type="tel" value={newBillToPreset.adjusterPhone} onChange={handleNewBillToPresetChange} placeholder="e.g., 1-800-SF-CLAIM" />
                    <Button
                        variant="primary" size="sm" onClick={handleAddOrUpdateBillToPreset} className="mt-4"
                        leftIcon={editingBillToPresetIndex !== null ? <PencilIcon className="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
                    >
                        {editingBillToPresetIndex !== null ? 'Update Preset in Form' : 'Add Preset to Form'}
                    </Button>
                    {editingBillToPresetIndex !== null && (
                        <Button variant="outline" size="sm" onClick={() => { setEditingBillToPresetIndex(null); setNewBillToPreset({ id: '', name: '', billToCompanyName: '', adjusterName: '', adjusterEmail: '', adjusterPhone: '' }); setGlobalError(null); }} className="mt-4 ml-2">
                            Cancel Edit
                        </Button>
                    )}
                </div>

                {showSavePresetsToDefaultButton && (
                    <div className="my-6 p-3 border border-brand-primary rounded-lg bg-brand-primary/10">
                        <p className="text-sm text-brand-primaryDarker mb-2 font-semibold">
                            Dev Action for '{initialNamedCompanyProfile.profileName}' Bill To Presets:
                        </p>
                        <Button
                            variant="primary" size="md" onClick={handleSaveCurrentBillToPresetsToDefault}
                            leftIcon={<ArrowPathIcon className="w-5 h-5" />}
                        >
                            Save Form's Presets to '{initialNamedCompanyProfile.profileName}' Now
                        </Button>
                        <p className="text-xs text-app-textSecondary mt-1">Updates default profile's presets. Final changes sync on dev mode exit.</p>
                    </div>
                )}

                <div>
                    <h4 className="text-lg font-medium text-app-textPrimary mb-3">Current Bill To Presets in Form ({(formData.billToPresets || []).length} items)</h4>
                    {(formData.billToPresets || []).length === 0 ? (
                        <p className="text-app-textSecondary">No Bill To Presets. Add using form{showCopyDefaultPresetsButton ? "" : " or copy from default"} .</p>
                    ) : (
                        <ul className="space-y-3">
                            {(formData.billToPresets || []).map((preset, index) => (
                                <li key={preset.id} className="p-3 border border-app-border rounded-md bg-app-background flex justify-between items-center hover:bg-app-surface transition-colors">
                                    <div>
                                        <p className="font-semibold text-app-textPrimary">{preset.name}</p>
                                        <p className="text-xs text-app-textSecondary">Bill To: {preset.billTo.companyName}</p>
                                        {(preset.adjusterInfo?.name || preset.adjusterInfo?.email || preset.adjusterInfo?.phone) &&
                                          <p className="text-xs text-app-textSecondary">
                                            Adjuster: {preset.adjusterInfo.name || 'N/A'}
                                            {preset.adjusterInfo.email && ` (${preset.adjusterInfo.email})`}
                                            {preset.adjusterInfo.phone && ` | Phone: ${preset.adjusterInfo.phone}`}
                                          </p>
                                        }
                                    </div>
                                    <div className="space-x-2 flex-shrink-0">
                                        <Button variant="outline" size="sm" onClick={() => handleEditBillToPreset(index)} aria-label={`Edit ${preset.name}`}>
                                            <PencilIcon className="w-4 h-4" />
                                        </Button>
                                        <Button variant="danger" size="sm" onClick={() => handleDeleteBillToPreset(index)} aria-label={`Delete ${preset.name}`}>
                                            <TrashIcon className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </>
        );
      case 'excelImport':
        return (
            <>
                <h3 className="text-xl font-semibold text-app-textPrimary mb-4">Excel Invoice Import</h3>
                <p className="text-sm text-app-textSecondary mb-4">
                    Use this tool to quickly populate the main invoice form by uploading a formatted Excel file. This action affects the current invoice being edited, not your saved company profiles.
                </p>
                <div className="space-y-4">
                     <Button 
                        variant="secondary" 
                        size="lg" 
                        onClick={onOpenExcelInvoiceCreator} 
                        className="w-full"
                        leftIcon={<RectangleStackIcon className="w-5 h-5" />}
                    >
                        Create Invoice From Excel File
                    </Button>
                    <p className="text-xs text-app-textSecondary ml-2">Opens a modal to upload a custom Excel file. Each row in the first sheet will be parsed as a potential invoice to import.</p>
                </div>
            </>
        );
      case 'appearance':
        return (
          <>
            <h3 className="text-xl font-semibold text-app-textPrimary mb-4">Application Appearance</h3>
            <div className="flex items-center space-x-4 p-3 border border-app-border rounded-lg bg-app-background">
                <label className="flex items-center space-x-2 cursor-pointer text-app-textSecondary">
                    <input type="radio" name="theme" value="dark" checked={currentTheme === 'dark'} onChange={() => onSetTheme('dark')} className="form-radio h-4 w-4 text-brand-primary bg-app-surface border-app-border focus:ring-brand-primary" />
                    <MoonIcon className="w-5 h-5"/> <span>Dark Theme</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer text-app-textSecondary">
                    <input type="radio" name="theme" value="light" checked={currentTheme === 'light'} onChange={() => onSetTheme('light')} className="form-radio h-4 w-4 text-brand-primary bg-app-surface border-app-border focus:ring-brand-primary" />
                    <SunIcon className="w-5 h-5"/> <span>Light Theme</span>
                </label>
            </div>
          </>
        );
      case 'jsonDataManagement':
         if (!isDevModeUiUnlocked) {
            return <p className="text-app-textSecondary">This section is available in Developer Mode.</p>;
        }
        return (
          <>
            <h3 className="text-xl font-semibold text-app-textPrimary mb-4">Import/Export Profile Data</h3>
            <div className="space-y-4">
                <div>
                    <label htmlFor="settingsJsonUpload" className="block text-sm font-medium text-app-textSecondary mb-1">Import Settings as New Profile (JSON)</label>
                    <input type="file" id="settingsJsonUpload" accept=".json" onChange={handleSettingsJsonUpload} className="w-full text-sm text-app-textSecondary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-textOnBrandPrimary hover:file:bg-brand-primaryDarker file:cursor-pointer file:transition-colors" />
                    <p className="mt-1 text-xs text-gray-400">Upload .json to create a new company profile. You'll be asked to name it.</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadSettingsJson} leftIcon={<DocumentArrowDownIcon className="w-4 h-4" />} className="w-full">
                    Download Current Profile ("{formData.profileName || '...'}") as JSON
                </Button>
            </div>
          </>
        );
      default: return null;
    }
  };

  return (
    <>
    <div className="bg-app-surface p-6 rounded-lg shadow-xl border border-app-border">
      <div className="md:flex md:space-x-6">
        <div className="md:w-1/4 mb-6 md:mb-0">
          <h2 className="text-2xl font-semibold text-brand-primary mb-4">Settings Sections</h2>
          <nav className="space-y-1">
            {settingsSections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2
                  ${activeSection === section.id
                    ? 'bg-brand-primary text-textOnBrandPrimary'
                    : 'text-app-textSecondary hover:bg-app-background hover:text-app-textPrimary'
                  }`}
              >
                <span>{section.title}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="md:w-3/4">
          <div className="bg-app-background p-6 rounded-lg border border-app-border min-h-[400px]">
            {renderSectionContent()}
          </div>
          <div className="mt-6 text-right">
            <Button variant="primary" size="lg" onClick={handleSaveCurrentProfile}>
              Save Current Profile ("{formData.profileName || '...'}")
            </Button>
          </div>
        </div>
      </div>
    </div>
    {isImportProfileNameModalOpen && (
        <Modal
            isOpen={isImportProfileNameModalOpen}
            onClose={() => {
                setIsImportProfileNameModalOpen(false);
                setImportedSettingsData(null);
                setNewProfileNameForImport('');
                setGlobalError(null);
            }}
            title="Name Imported Profile"
            confirmText="Add Profile"
            onConfirm={confirmImportNewProfile}
            titleId="import-profile-name-modal"
        >
            <InputField
                label="Enter a name for this imported profile:"
                id="newProfileNameImport"
                value={newProfileNameForImport}
                onChange={(e) => setNewProfileNameForImport(e.target.value)}
                placeholder="e.g., My Awesome Company"
                autoFocus
            />
        </Modal>
    )}
    </>
  );
};