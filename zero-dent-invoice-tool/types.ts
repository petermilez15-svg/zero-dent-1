// Global declaration for jsPDF - REMOVED as jspdf is now imported as a module
// Types from types-1.ts (for Invoice Generator)
export interface InvoiceAddress {
  companyName: string;
  policyholderName: string;
  street: string;
  cityStateZip: string; // e.g., "Hubbs, NM 88250"
}

export interface LineItem {
  id: string; // App-generated unique ID
  description: string;
  rate: number;
  days: number;
}

export type PeriodType = "General" | "Rental" | "Storage" | "Service";
export type InvoiceType = "General" | "Rental" | "Administration" | "Storage";

export interface AdjusterInfo {
  name: string;
  phone: string;
  email: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate: string;     // YYYY-MM-DD
  
  billTo: InvoiceAddress;
  selectedBillToPresetId?: string | null; // Added field
  
  lineItems: LineItem[];
  
  claimNumber: string;
  policyNumber: string;
  
  vehicleVIN: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;

  clientVehicleVIN: string;
  clientVehicleYear: string;
  clientVehicleMake: string;
  clientVehicleModel: string;
  
  adjuster: AdjusterInfo;
  
  dateOfLoss: string;    // YYYY-MM-DD
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  periodType: PeriodType;
  invoiceType: InvoiceType;
  authorizationNumber: string;

  senderCompanyName: string; 
  
  paymentPayableToName: string;
  paymentMailToName: string;
  paymentMailToStreet: string;
  paymentMailToCityStateZip: string;
  
  footerContactPhone: string | null;
  footerContactWebsite: string | null;
  footerContactEmail: string | null;
  footerCompanyAddress: string | null;
  
  signatureName: string;
}

const getTodayDateString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const initialInvoiceData: InvoiceData = {
  invoiceNumber: '', 
  invoiceDate: getTodayDateString(),
  dueDate: getTodayDateString(), 
  billTo: {
    companyName: '',
    policyholderName: '',
    street: '',
    cityStateZip: '',
  },
  selectedBillToPresetId: null, // Initialized field
  lineItems: [],
  claimNumber: '',
  policyNumber: '',
  vehicleVIN: '', 
  vehicleYear: '', 
  vehicleMake: '', 
  vehicleModel: '', 
  clientVehicleVIN: '', 
  clientVehicleYear: '', 
  clientVehicleMake: '', 
  clientVehicleModel: '', 
  adjuster: {
    name: '',
    phone: '',
    email: '',
  },
  dateOfLoss: getTodayDateString(),
  periodStart: getTodayDateString(),
  periodEnd: getTodayDateString(),
  periodType: 'General',
  invoiceType: 'General',
  authorizationNumber: '', 

  senderCompanyName: '', 
  paymentPayableToName: '',
  paymentMailToName: '',
  paymentMailToStreet: '',
  paymentMailToCityStateZip: '',
  footerContactPhone: null,
  footerContactWebsite: null,
  footerContactEmail: null,
  footerCompanyAddress: null,
  signatureName: '',
};

export interface RentalVehicle {
  make: string;
  model: string;
  year: string;
  vin: string;
  rate: number; 
}

export interface BillToPreset {
  id: string; // Unique ID for the preset, e.g., 'statefarm_preset'
  name: string; // Display name for the dropdown, e.g., 'State Farm Insurance'
  billTo: { // Data to populate InvoiceData.billTo
    companyName: string; // e.g., 'State Farm Insurance Companies'
  };
  adjusterInfo?: { // Data to populate InvoiceData.adjuster
    name?: string; // e.g., 'State Farm Claims Department'
    email?: string; // e.g., 'claims@statefarm.com'
    phone?: string; // e.g., '(800) SF-CLAIM'
  };
}

export interface CompanySettings {
  companyName: string;
  logoDataUrl: string | null; 
  paymentPayableToName: string;
  paymentMailToName: string;
  paymentMailToStreet: string;
  paymentMailToCityStateZip: string;
  footerContactPhone: string | null;
  footerContactWebsite: string | null;
  footerContactEmail: string | null;
  footerCompanyAddress: string | null;
  signatureName: string;
  rentalFleet: RentalVehicle[];
  billToPresets: BillToPreset[]; // New field for bill to presets
}

export interface NamedCompanySettings extends CompanySettings {
  profileName: string;
}

export const defaultCompanySettings: CompanySettings = {
  companyName: 'Zero Dent Inc',
  logoDataUrl: null, 
  paymentPayableToName: 'Zero Dent Inc.',
  paymentMailToName: 'Zero Dent Inc.',
  paymentMailToStreet: '3604 Mansfield Hwy',
  paymentMailToCityStateZip: 'Fort Worth, TX 76119',
  footerContactPhone: '1+214-470-1132',
  footerContactWebsite: null, 
  footerContactEmail: null,   
  footerCompanyAddress: '3604 Mansfield Hwy, Fort Worth, TX 76119',
  signatureName: 'Veronica Martinez', 
  rentalFleet: [
    { make: "Toyota", model: "Camry SD", year: "2023", vin: "4T1G11AK2PU162311", rate: 50 },
    { make: "Toyota", model: "RAV4", year: "2021", vin: "2T3H1RFV8MC113740", rate: 25 },
    { make: "Toyota", model: "Camry", year: "2021", vin: "4T1G11AK2MU442936", rate: 33 },
    { make: "Ford", model: "F150", year: "2022", vin: "1FTEW1C53NFA51546", rate: 35 },
    { make: "Toyota", model: "Tundra", year: "2021", vin: "5TFEY5F17MX287023", rate: 40 },
    { make: "Toyota", model: "Camry", year: "2024", vin: "4T1C11AK5RU869100", rate: 30 },
    { make: "Ford", model: "Maverick", year: "2024", vin: "3FTTW8J98RRA42713", rate: 50 },
    { make: "Hyundai", model: "Elantra", year: "2022", vin: "5NPLM4AG2NH053815", rate: 50 },
    { make: "Kia", model: "KS", year: "2024", vin: "5XXG64J24RG230866", rate: 50 },
    { make: "Toyota", model: "4Runner", year: "", vin: "placeholdervin", rate: 35 }
  ],
  billToPresets: [ // Initializing with current predefinedCompanies data
    {
      id: 'statefarm',
      name: 'State Farm Insurance',
      billTo: {
        companyName: 'State Farm Insurance Companies',
      },
      adjusterInfo: { name: 'State Farm Claims Department', email: 'claims@statefarm.com', phone: '1-800-SF-CLAIM' }
    },
    {
      id: 'allstate',
      name: 'Allstate Insurance',
      billTo: {
        companyName: 'Allstate Insurance Company',
      },
      adjusterInfo: { name: 'Allstate Claims Department', email: 'claims@allstate.com', phone: '1-800-ALLSTATE' }
    },
    {
      id: 'geico',
      name: 'GEICO',
      billTo: {
        companyName: 'Government Employees Insurance Company',
      },
      adjusterInfo: { name: 'GEICO Claims', email: 'claims@geico.com', phone: '1-800-841-3000' }
    },
    {
      id: 'progressive',
      name: 'Progressive Insurance',
      billTo: {
        companyName: 'Progressive Corporation',
      },
      adjusterInfo: { name: 'Progressive Claims', email: 'claims@progressive.com', phone: '1-800-776-4737' }
    },
  ]
};

export const initialNamedCompanyProfile: NamedCompanySettings = {
  ...defaultCompanySettings,
  profileName: 'Default Company',
};


// Types for AI Invoice Data Extraction (now more general for data import)
export interface AILineItem {
  description: string;
  rate: number;
  days: number;
}

export interface PartialInvoiceImportData extends Omit<Partial<InvoiceData>, 'lineItems' | 'billTo' | 'adjuster' | 'selectedBillToPresetId'> {
  billTo?: Partial<InvoiceAddress>;
  lineItems?: AILineItem[];
  adjuster?: Partial<AdjusterInfo>;
  suggestedAdjusterName?: string;
  suggestedAdjusterEmail?: string;
}

export interface InvoiceDetailImportData {
  billTo?: InvoiceAddress;
  lineItems?: AILineItem[];
  suggestedAdjusterName?: string;
  suggestedAdjusterEmail?: string;
}

export interface TollCharge {
  licensePlate: string;
  date: Date | null;
  amount: number;
  location?: string;
  transactionId?: string;
  transactionType?: string;
}

export interface UnmatchedTollGroup {
  vehicle: VehicleDetail;
  tolls: TollCharge[];
  totalAmount: number;
}

export interface VehicleDetail {
  name: string;
  year: number | string;
  make: string;
  model: string;
  color: string;
  loanerBank: string;
  monthlyPay: number | string;
  dueDateMonthly: string;
  autoPayDate: string;
  accountNumber: number | string;
  loanAmount: number | string;
  vin: string;
  licensePlate: string;
  paperPlate: string;
  odometer: string | number;
  creationLog: string;
  tolls: string;
  status: string;
}