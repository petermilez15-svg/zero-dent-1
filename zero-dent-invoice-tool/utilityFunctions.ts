import { NamedCompanySettings, CompanySettings } from './types'; // Added NamedCompanySettings

/**
 * Saves a Blob object to the user's local file system.
 * @param blob The Blob to save.
 * @param filename The desired filename for the downloaded file.
 */
export const saveBlobAsFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Opens a Blob in a new browser tab for previewing.
 * Includes a fallback to download if the new tab fails to open.
 * @param blob The Blob to preview.
 * @param filename The desired filename for the tab title.
 * @param onError Callback for when a popup blocker might be active.
 */
export const previewBlobInNewTab = (blob: Blob, filename: string, onError?: (message: string) => void) => {
  const url = URL.createObjectURL(blob);
  const newWindow = window.open(url, '_blank');
  
  if (newWindow) {
    newWindow.focus();
    // Setting title might not work due to browser security, but it's a nice-to-have
    setTimeout(() => { 
      try {
        newWindow.document.title = filename; 
      } catch(e) {
        console.warn("Could not set new tab title due to browser restrictions.");
      }
    }, 500);
  } else {
    const errorMsg = "Could not open new tab for preview. Your browser's popup blocker might be active. The file will be downloaded instead.";
    console.warn(errorMsg);
    if (onError) {
        onError(errorMsg);
    }
    // Fallback to direct download
    saveBlobAsFile(blob, filename);
  }
  
  // Do not revoke the URL immediately as the new tab needs it.
  // The browser will handle it when the tab is closed.
};


/**
 * Generates an acronym from a company name.
 * E.g., "Hail Guard" -> "HG", "Some Company Name" -> "SCN".
 * If a single word, takes the first two letters, or one if only one letter.
 * Defaults to "XX" if the name is empty or invalid.
 * @param companyName The name of the company.
 * @returns The generated acronym in uppercase.
 */
export const getCompanyAcronym = (companyName: string): string => {
  if (!companyName || typeof companyName !== 'string' || companyName.trim() === '') {
    return 'XX';
  }
  const words = companyName.trim().split(/\s+/);
  if (words.length === 1) {
    if (words[0].length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return words[0].substring(0, 2).toUpperCase();
  }
  return words.map(word => word.charAt(0).toUpperCase()).join('');
};

/**
 * Extracts a specified number of leading digits from a claim number.
 * Pads with leading zeros if fewer digits are found.
 * Returns a string of zeros if no digits are in the claim number.
 * @param claimNumber The claim number string.
 * @param numDigits The desired number of digits.
 * @returns A string of digits.
 */
export const getFormattedClaimDigits = (claimNumber: string, numDigits: number): string => {
  if (typeof claimNumber !== 'string') {
    return '0'.repeat(numDigits);
  }
  const digitsOnly = claimNumber.replace(/\D/g, '');
  if (digitsOnly.length === 0) {
    return '0'.repeat(numDigits);
  }
  const relevantDigits = digitsOnly.substring(0, numDigits);
  return relevantDigits.padStart(numDigits, '0');
};

/**
 * Formats a date string (YYYY-MM-DD) into YYYYMMDD.
 * @param dateString The date string in YYYY-MM-DD format.
 * @returns The date string in YYYYMMDD format, or "00000000" if invalid.
 */
export const formatDateForId = (dateString: string): string => {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return '00000000'; // Return a default or handle error
  }
  try {
    const date = new Date(dateString + 'T00:00:00'); // Ensure local time
    if (isNaN(date.getTime())) {
        return '00000000';
    }
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  } catch (e) {
    return '00000000';
  }
};

/**
 * Formats a date string (YYYY-MM-DD) into a more readable format e.g., "May 24, 2024".
 * @param dateStr The date string in YYYY-MM-DD format.
 * @returns The formatted date string.
 */
export const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr + 'T00:00:00'); // Ensure local time
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  } catch (e) {
    console.error("Error formatting display date:", e);
    return dateStr; // Fallback to original string if formatting fails
  }
};


const COMPANY_PROFILES_KEY = 'invoiceAppCompanyProfiles';
const ACTIVE_PROFILE_NAME_KEY = 'invoiceAppActiveProfileName';

export const saveCompanyProfiles = (profiles: NamedCompanySettings[]): void => {
  try {
    localStorage.setItem(COMPANY_PROFILES_KEY, JSON.stringify(profiles));
  } catch (error) {
    console.error("Error saving company profiles to localStorage:", error);
  }
};

export const loadCompanyProfiles = (): NamedCompanySettings[] | null => {
  try {
    const profilesString = localStorage.getItem(COMPANY_PROFILES_KEY);
    if (profilesString) {
      return JSON.parse(profilesString) as NamedCompanySettings[];
    }
    return null;
  } catch (error) {
    console.error("Error loading company profiles from localStorage:", error);
    return null;
  }
};

export const saveActiveProfileName = (profileName: string): void => {
    try {
        localStorage.setItem(ACTIVE_PROFILE_NAME_KEY, profileName);
    } catch (error) {
        console.error("Error saving active profile name to localStorage:", error);
    }
};

export const loadActiveProfileName = (): string | null => {
    try {
        return localStorage.getItem(ACTIVE_PROFILE_NAME_KEY);
    } catch (error) {
        console.error("Error loading active profile name from localStorage:", error);
        return null;
    }
};

// Legacy function, to be phased out or adapted if single settings are ever needed outside profiles.
export const saveCompanySettings = (settings: CompanySettings): void => {
  try {
    // This could perhaps save to a 'lastUsedSettings_DO_NOT_RELY_ON_THIS' key if needed for some migration
    // For now, it's a no-op or logs a warning as profiles are the primary mechanism.
    console.warn("Legacy saveCompanySettings called. Profile system is now in use.");
  } catch (error) {
    console.error("Error saving company settings to localStorage:", error);
  }
};

export const loadCompanySettings = (): CompanySettings | null => {
   console.warn("Legacy loadCompanySettings called. Profile system is now in use.");
  return null; // Profiles are loaded via loadCompanyProfiles
};