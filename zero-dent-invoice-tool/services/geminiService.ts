
import { CompanySettings, PartialInvoiceImportData, AILineItem } from '../types';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// --- Prompts (migrated from backend) ---

const EXTRACT_INVOICE_DATA_FROM_DOCUMENT_PROMPT = `You are an AI assistant for a PDR (Paintless Dent Repair) shop's invoicing system.
Your task is to extract all relevant invoice data from the provided document (image or PDF).
The output MUST strictly be a single JSON object, with no surrounding text, explanations, or markdown formatting (like \`\`\`json).

The JSON object should conform to the following structure. Omit any field if the information is not clearly present in the document.
Dates must be in "YYYY-MM-DD" format. Monetary values (like rate) must be numbers. 'days' for line items must be a number.
{
  "invoiceNumber": "string (e.g., 'INV-2024-101')",
  "invoiceDate": "string (format: 'YYYY-MM-DD')",
  "dueDate": "string (format: 'YYYY-MM-DD')",
  "billTo": {
    "companyName": "string (e.g., 'ABC Insurance')",
    "policyholderName": "string (e.g., 'John Doe')",
    "street": "string (e.g., '123 Main St')",
    "cityStateZip": "string (e.g., 'Anytown, ST 12345')"
  },
  "lineItems": [
    {
      "description": "string (e.g., 'PDR - Hood - 5 small dents')",
      "rate": "number (e.g., 150.00)",
      "days": "number (e.g., 1 for flat fee, or quantity/days for others. Default to 1 if not specified.)"
    }
  ],
  "claimNumber": "string (e.g., 'CLAIM-XYZ-001')",
  "policyNumber": "string (e.g., 'POLICY-987654')",
  "vehicleVIN": "string (This is the primary vehicle on the invoice, could be client's or a rental unit if it's a rental invoice)",
  "vehicleYear": "string",
  "vehicleMake": "string",
  "vehicleModel": "string",
  "clientVehicleVIN": "string (Client's own vehicle, if different from primary or if explicitly labeled as such)",
  "clientVehicleYear": "string",
  "clientVehicleMake": "string",
  "clientVehicleModel": "string",
  "adjuster": {
    "name": "string (e.g., 'Jane Adjuster')",
    "phone": "string (e.g., '555-123-4567')",
    "email": "string (e.g., 'j.adjuster@email.com')"
  },
  "suggestedAdjusterName": "string (If adjuster info is sparse, provide a suggested name)",
  "suggestedAdjusterEmail": "string (If adjuster info is sparse, provide a suggested email)",
  "dateOfLoss": "string (format: 'YYYY-MM-DD')",
  "periodStart": "string (format: 'YYYY-MM-DD')",
  "periodEnd": "string (format: 'YYYY-MM-DD')",
  "periodType": "string ('General', 'Rental', 'Storage', or 'Service')",
  "invoiceType": "string ('General', 'Rental', 'Administration', 'Storage' - infer this based on invoice content and title)",
  "senderCompanyName": "string (Your company, the one sending the invoice)",
  "paymentPayableToName": "string",
  "paymentMailToName": "string",
  "paymentMailToStreet": "string",
  "paymentMailToCityStateZip": "string",
  "footerContactPhone": "string | null",
  "footerContactWebsite": "string | null",
  "footerContactEmail": "string | null",
  "footerCompanyAddress": "string | null",
  "signatureName": "string (Printed name for signature line)"
}

Key Instructions:
- Extract all line items from any tabular section. For each line item, ensure 'description', 'rate', and 'days' are present. If 'days' (quantity) isn't specified for an item, assume 1.
- If addresses are present, parse them into 'street' and 'cityStateZip' components for 'billTo'. For 'paymentMailTo' and 'footerCompanyAddress', these will populate top-level fields like 'paymentMailToStreet', 'footerCompanyAddress', etc.
- The 'Client's Vehicle Information' block from OCR maps to 'clientVehicleVIN', 'clientVehicleYear', etc. Top-level 'vehicleVIN', 'vehicleYear', etc., can be for a different primary vehicle (e.g., a rental unit described on a rental invoice) or the same if only one vehicle is mentioned.
- Map 'Adjuster:' text to 'adjuster.name'. Populate 'suggestedAdjusterName'/'suggestedAdjusterEmail' only if distinct adjuster information is found elsewhere or if the main adjuster details are very sparse.
- Infer 'invoiceType' and 'periodType' from the overall content and title of the invoice.
- Map any logo/company name at the top (sender's information) to 'senderCompanyName'.
- Adhere strictly to the JSON structure. Return ONLY the JSON object.`;

const EXTRACT_COMPANY_SETTINGS_FROM_DOCUMENT_PROMPT = `From the provided document (likely an invoice), extract company settings information.
Focus on the sender's details (the company issuing the invoice).
The output MUST strictly be a single JSON object, with no surrounding text, explanations, or markdown formatting (like \`\`\`json).

The JSON object should conform to the following structure. Omit any field if the information is not clearly present.
'rentalFleet' should be an array of objects, each with 'make', 'model', 'year', 'vin' (all strings), and 'rate' (number).
{
  "companyName": "string (e.g., 'Your PDR Solutions LLC')",
  "paymentPayableToName": "string (e.g., 'Your PDR Solutions LLC')",
  "paymentMailToName": "string (e.g., 'Payments Dept, Your PDR Solutions')",
  "paymentMailToStreet": "string (e.g., 'P.O. Box 123')",
  "paymentMailToCityStateZip": "string (e.g., 'Yourtown, ST 54321')",
  "footerContactPhone": "string | null (e.g., '(555) 111-2222')",
  "footerContactWebsite": "string | null (e.g., 'www.yourpdr.com')",
  "footerContactEmail": "string | null (e.g., 'contact@yourpdr.com')",
  "footerCompanyAddress": "string | null (e.g., '1 Shop Street, Yourtown, ST 54321')",
  "signatureName": "string (e.g., 'Michael Owner')",
  "rentalFleet": [
    { "make": "string", "model": "string", "year": "string", "vin": "string", "rate": "number" }
  ],
  "logoDataUrl": "string | null (If a logo is visible and you can describe it, provide a brief text description like 'Logo features a stylized shield and wrench'. If no logo or indescribable, set to null. Do NOT attempt to generate an image data URL.)"
}

Key Instructions:
- Identify the company name, payment details (payable to, mail to address), contact info typically found in a footer (phone, website, email, physical address), and the name for the signature line.
- If the document lists rental vehicles available from the sender, try to extract them into the 'rentalFleet' array. Each vehicle should have make, model, year, VIN, and rate.
- For 'logoDataUrl', if a logo is visible and you can describe it, provide a brief text description (e.g., "Logo shows a blue shield"). If no logo is visible or it's indescribable, set this field to null. Do NOT attempt to generate an image data URL.
- Adhere strictly to the JSON structure. Return ONLY the JSON object.`;

const SUGGEST_LINE_ITEMS_FROM_TEXT_PROMPT_TEMPLATE = `You are an AI assistant for a PDR (Paintless Dent Repair) shop's invoicing system.
Your task is to parse a user's natural language request for adding an item or service to an invoice and convert it into a structured JSON array of line items.

The output MUST strictly be a JSON array of objects. Each object in the array MUST have the following keys and value types:
- "description": string (A comprehensive description of the service or item)
- "rate": number (The monetary rate for one unit or instance of the item/service)
- "days": number (The quantity of items, or number of days for a service. Default to 1 if not specified.)

ALWAYS return a JSON array, even if the array contains only one item, or is empty if no suitable items are found.
Do NOT return a single JSON object if only one item is suggested; it MUST be wrapped in an array.
Example: \`[{"description": "...", "rate": ..., "days": ...}]\` or \`[]\`.

Constraints:
1.  Combine all descriptive details from the user's input (like vehicle type, color, specific PDR work details, part names, etc.) into the single "description" string for each line item.
2.  Extract the primary \`rate\` (e.g., price per day for rentals, flat fee for services, per dent rate for PDR) and assign it to the "rate" field.
3.  Extract the quantity or duration (e.g., number of days for rental, number of dents) and assign it to the "days" field. If not explicitly mentioned or not applicable for a flat fee item, assume \`days\` is 1.
4.  Ensure \`rate\` and \`days\` are numerical values (integer or float). If a rate is not directly provided in the input, make a reasonable estimation for common auto repair/PDR services.
5.  The output MUST ONLY be the JSON array. Do not include any surrounding text, explanations, or markdown formatting (like \`\`\`json).
6.  If the user's request clearly distinguishes multiple billable components (e.g., a part and separate labor for its installation), create a separate line item object for each component within the array.

Examples:

User Input: "i need to add a rental car toyota 4runner silver 30 days at a rate of 30 dollars per day"
Expected Output:
[
  {"description": "Rental car - Toyota 4Runner (Silver)", "rate": 30.00, "days": 30}
]

User Input: "i need to add just an administration fee, flat fee, 1500"
Expected Output:
[
  {"description": "Administration fee", "rate": 1500.00, "days": 1}
]

User Input: "add PDR work on hood, 5 small dents, rate 75 per dent"
Expected Output:
[
  {"description": "PDR work on hood - 5 small dents", "rate": 75.00, "days": 5}
]

User Input: "add replacement of rear bumper cover, part cost 450, labor 200"
Expected Output:
[
  {"description": "Replacement of rear bumper cover - part", "rate": 450.00, "days": 1},
  {"description": "Replacement of rear bumper cover - labor", "rate": 200.00, "days": 1}
]

User Input: "add toyota camry red rental, 30 bucks/day for 30 days"
Expected Output:
[
  {"description": "Rental - Toyota Camry (Red)", "rate": 30.00, "days": 30}
]

User Input: "nothing relevant" or "asdflkj" (unclear input)
Expected Output:
[]

Now, process the following user request: "{description_text}"`;

const EXTRACT_INVOICE_FIELDS_FROM_TEXT_PROMPT_TEMPLATE = `You are an AI assistant for a PDR (Paintless Dent Repair) shop's invoicing system.
Your task is to extract all relevant invoice data from the provided text block. The text block is likely OCR data from an invoice.
The output MUST strictly be a single JSON object, with no surrounding text, explanations, or markdown formatting (like \`\`\`json).

The JSON object should conform to the following structure. Omit any field if the information is not clearly present.
Dates must be in "YYYY-MM-DD" format. Monetary values (like rate) must be numbers. 'days' for line items must be a number.
{
  "invoiceNumber": "string (e.g., 'INV-2024-101')",
  "invoiceDate": "string (format: 'YYYY-MM-DD')",
  "dueDate": "string (format: 'YYYY-MM-DD')",
  "billTo": {
    "companyName": "string (e.g., 'ABC Insurance')",
    "policyholderName": "string (e.g., 'John Doe')",
    "street": "string (e.g., '123 Main St')",
    "cityStateZip": "string (e.g., 'Anytown, ST 12345')"
  },
  "lineItems": [
    {
      "description": "string (e.g., 'PDR - Hood - 5 small dents')",
      "rate": "number (e.g., 150.00)",
      "days": "number (e.g., 1 for flat fee, or quantity/days for others. Default to 1 if not specified.)"
    }
  ],
  "claimNumber": "string (e.g., 'CLAIM-XYZ-001')",
  "policyNumber": "string (e.g., 'POLICY-987654')",
  "vehicleVIN": "string (This is the primary vehicle on the invoice, could be client's or a rental unit if it's a rental invoice)",
  "vehicleYear": "string",
  "vehicleMake": "string",
  "vehicleModel": "string",
  "clientVehicleVIN": "string (Client's own vehicle, if different from primary or if explicitly labeled as such)",
  "clientVehicleYear": "string",
  "clientVehicleMake": "string",
  "clientVehicleModel": "string",
  "adjuster": {
    "name": "string (e.g., 'Jane Adjuster')",
    "phone": "string (e.g., '555-123-4567')",
    "email": "string (e.g., 'j.adjuster@email.com')"
  },
  "suggestedAdjusterName": "string (If adjuster info is sparse, provide a suggested name)",
  "suggestedAdjusterEmail": "string (If adjuster info is sparse, provide a suggested email)",
  "dateOfLoss": "string (format: 'YYYY-MM-DD')",
  "periodStart": "string (format: 'YYYY-MM-DD')",
  "periodEnd": "string (format: 'YYYY-MM-DD')",
  "periodType": "string ('General', 'Rental', 'Storage', or 'Service')",
  "invoiceType": "string ('General', 'Rental', 'Administration', 'Storage' - infer this based on invoice content and title)",
  "senderCompanyName": "string (Your company, the one sending the invoice)",
  "paymentPayableToName": "string",
  "paymentMailToName": "string",
  "paymentMailToStreet": "string",
  "paymentMailToCityStateZip": "string",
  "footerContactPhone": "string | null",
  "footerContactWebsite": "string | null",
  "footerContactEmail": "string | null",
  "footerCompanyAddress": "string | null",
  "signatureName": "string (Printed name for signature line)"
}

Key Instructions are the same as for document extraction (see /api/ai/extract-invoice-data).
Adhere strictly to the JSON structure. Return ONLY the JSON object.

Text to process:
---
{text_block}
---`;

const EXTRACT_COMPANY_SETTINGS_FROM_TEXT_PROMPT_TEMPLATE = `From the provided text block, extract company settings information.
Focus on identifying details that would belong to the company itself (the sender of an invoice or general company info).
The output MUST strictly be a single JSON object, with no surrounding text, explanations, or markdown formatting (like \`\`\`json).

The JSON object should conform to the following structure. Omit any field if the information is not clearly present.
'rentalFleet' should be an array of objects, each with 'make', 'model', 'year', 'vin' (all strings), and 'rate' (number).
{
  "companyName": "string (e.g., 'Your PDR Solutions LLC')",
  "paymentPayableToName": "string (e.g., 'Your PDR Solutions LLC')",
  "paymentMailToName": "string (e.g., 'Payments Dept, Your PDR Solutions')",
  "paymentMailToStreet": "string (e.g., 'P.O. Box 123')",
  "paymentMailToCityStateZip": "string (e.g., 'Yourtown, ST 54321')",
  "footerContactPhone": "string | null (e.g., '(555) 111-2222')",
  "footerContactWebsite": "string | null (e.g., 'www.yourpdr.com')",
  "footerContactEmail": "string | null (e.g., 'contact@yourpdr.com')",
  "footerCompanyAddress": "string | null (e.g., '1 Shop Street, Yourtown, ST 54321')",
  "signatureName": "string (e.g., 'Michael Owner')",
  "rentalFleet": [
    { "make": "string", "model": "string", "year": "string", "vin": "string", "rate": "number" }
  ],
  "logoDataUrl": "string | null (If a logo is visible and you can describe it, provide a brief text description like 'Logo features a stylized shield and wrench'. If no logo or indescribable, set to null. Do NOT attempt to generate an image data URL.)"
}

Key Instructions are the same as for document extraction (see /api/ai/extract-company-settings).
Adhere strictly to the JSON structure. Return ONLY the JSON object.

Text to process:
---
{text_block}
---`;

// --- Gemini Client Initialization ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
const model = "gemini-2.5-flash";


// --- Interfaces ---
interface AIResponseWrapper<T> {
  parsedData: T;
  rawResponseText: string;
}

// --- Helper Functions ---
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // remove the prefix `data:image/png;base64,`
      resolve(base64String.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const parseJsonResponse = <T>(responseText: string): T | null => {
    try {
        let jsonStr = responseText.trim();
        // This regex handles the optional 'json' language identifier and potential newlines
        const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[1]) {
          jsonStr = match[1].trim();
        }
        return JSON.parse(jsonStr) as T;
    } catch (e) {
        console.error("Failed to parse JSON response:", responseText, e);
        throw new Error(`Received non-JSON response from AI: ${responseText.substring(0,100)}...`);
    }
};


// --- Generic AI Model Caller ---
async function callGenerativeModel<T>(
    promptParts: (string | {inlineData: {mimeType: string, data: string}})[], 
    expectJson: boolean
): Promise<AIResponseWrapper<T>> {
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: model,
        contents: { parts: promptParts.map(p => typeof p === 'string' ? {text: p} : p) },
        config: {
            temperature: 0.2,
            responseMimeType: expectJson ? "application/json" : "text/plain",
        },
    });

    const responseText = response.text;
    if (expectJson) {
        const parsedData = parseJsonResponse<T>(responseText);
        if (parsedData === null) {
            throw new Error("AI returned invalid or empty JSON.");
        }
        return { parsedData, rawResponseText: responseText };
    }
    // For non-json, we wrap it to fit the type, but the consumer should know it's just text.
    return { parsedData: responseText as T, rawResponseText: responseText };
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API Error: ${error.message}`);
    }
    throw new Error("An unknown error occurred while contacting the Gemini API.");
  }
}

// --- Re-implemented Service Functions ---

export const extractCompanySettingsFromInvoice = async (file: File): Promise<AIResponseWrapper<Partial<CompanySettings>>> => {
    const base64Data = await blobToBase64(file);
    const imagePart = { inlineData: { mimeType: file.type, data: base64Data } };
    
    const response = await callGenerativeModel<Partial<CompanySettings>>(
        [EXTRACT_COMPANY_SETTINGS_FROM_DOCUMENT_PROMPT, imagePart], 
        true
    );

    const parsedSettings = response.parsedData;
    const validatedRentalFleet = Array.isArray(parsedSettings.rentalFleet) ? parsedSettings.rentalFleet : [];
    
    return { 
        parsedData: { ...parsedSettings, rentalFleet: validatedRentalFleet },
        rawResponseText: response.rawResponseText 
    };
};

export const extractInvoiceDataFromDocument = async (file: File): Promise<AIResponseWrapper<PartialInvoiceImportData>> => {
    const base64Data = await blobToBase64(file);
    const imagePart = { inlineData: { mimeType: file.type, data: base64Data } };

    return callGenerativeModel<PartialInvoiceImportData>(
        [EXTRACT_INVOICE_DATA_FROM_DOCUMENT_PROMPT, imagePart], 
        true
    );
};

export const suggestLineItemsFromText = async (descriptionText: string): Promise<AIResponseWrapper<AILineItem[]>> => {
  if (!descriptionText.trim()) {
    return { parsedData: [], rawResponseText: "Input was empty." };
  }
  const prompt = SUGGEST_LINE_ITEMS_FROM_TEXT_PROMPT_TEMPLATE.replace("{description_text}", descriptionText);
  const response = await callGenerativeModel<AILineItem[] | AILineItem>([prompt], true);
  
  // The AI might occasionally return a single object instead of an array, so we normalize it.
  const parsedData = Array.isArray(response.parsedData) ? response.parsedData : [response.parsedData];
  
  if (!parsedData.every(item => item && typeof item.description === 'string' && typeof item.rate === 'number' && typeof item.days === 'number')) {
      console.error("AI suggestion for line items has invalid format:", response.parsedData);
      throw new Error("AI returned line item suggestions in an unexpected format.");
  }

  return { ...response, parsedData };
};

export const extractInvoiceFieldsFromText = async (textBlock: string): Promise<AIResponseWrapper<PartialInvoiceImportData>> => {
  if (!textBlock.trim()) {
    return { parsedData: {}, rawResponseText: "Input was empty." };
  }
  const prompt = EXTRACT_INVOICE_FIELDS_FROM_TEXT_PROMPT_TEMPLATE.replace("{text_block}", textBlock);
  return callGenerativeModel<PartialInvoiceImportData>([prompt], true);
};

export const extractCompanySettingsFromText = async (textBlock: string): Promise<AIResponseWrapper<Partial<CompanySettings>>> => {
  if (!textBlock.trim()) {
    return { parsedData: {}, rawResponseText: "Input was empty." };
  }
  const prompt = EXTRACT_COMPANY_SETTINGS_FROM_TEXT_PROMPT_TEMPLATE.replace("{text_block}", textBlock);
  const response = await callGenerativeModel<Partial<CompanySettings>>([prompt], true);
  
  const parsedSettings = response.parsedData;
  const validatedRentalFleet = Array.isArray(parsedSettings.rentalFleet) ? parsedSettings.rentalFleet : [];

  return { 
      parsedData: { ...parsedSettings, rentalFleet: validatedRentalFleet },
      rawResponseText: response.rawResponseText 
  };
};