import React from 'react';
import { InvoiceData } from '../types'; 
import { PhoneIcon, MapPinIcon } from './IconComponents'; 

interface InvoicePreviewProps {
  invoiceData: InvoiceData;
  uploadedLogoDataUrl?: string | null;
}

const DetailRow: React.FC<{ label: string; value: React.ReactNode; boldValue?: boolean }> = ({ label, value, boldValue }) => (
    value ? (
        <>
            <dt className="text-gray-500">{label}</dt>
            <dd className={`text-gray-800 ${boldValue ? 'font-semibold' : ''}`}>{value}</dd>
        </>
    ) : null
);

const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr + 'T00:00:00'); // Ensure local time
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  } catch (e) {
    return dateStr;
  }
};

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({ invoiceData, uploadedLogoDataUrl }) => {
  const totalAmount = invoiceData.lineItems.reduce((sum, item) => sum + (item.rate * item.days), 0);
  const showClientVehicleInfo = !!invoiceData.clientVehicleVIN || !!invoiceData.clientVehicleYear || !!invoiceData.clientVehicleMake || !!invoiceData.clientVehicleModel;
  
  const formattedPeriod = `${invoiceData.periodStart.replaceAll('-', '/')} - ${invoiceData.periodEnd.replaceAll('-', '/')}`;

  return (
    <div className="bg-white text-gray-800 font-sans min-h-[11in] flex flex-col relative">
        <div className="absolute top-0 left-0 right-0 h-2.5 bg-black"></div>

        <div className="p-12 flex-grow flex flex-col">
            <header className="flex justify-between items-start mb-12 pt-4">
                <div>
                    {uploadedLogoDataUrl ? (
                        <img src={uploadedLogoDataUrl} alt="Company Logo" className="h-12 w-auto" />
                    ) : (
                        <h2 className="text-2xl font-bold text-gray-800">{invoiceData.senderCompanyName}</h2>
                    )}
                </div>
                <div className="text-right">
                    <h1 className="text-4xl font-bold uppercase text-gray-600 tracking-wider">
                        {invoiceData.invoiceType} Invoice
                    </h1>
                    <div className="mt-4 space-y-1 text-gray-600">
                        <p>
                            <span className="font-semibold text-gray-800">Date:</span> {formatDisplayDate(invoiceData.invoiceDate)}
                        </p>
                        <p>
                            <span className="font-semibold text-gray-800">Due By:</span> {formatDisplayDate(invoiceData.dueDate)}
                        </p>
                    </div>
                </div>
            </header>

            <main className="flex-grow">
                <div className="mb-12">
                    <p className="font-bold text-black mb-1">Bill To:</p>
                    <p className="text-black font-semibold text-lg">{invoiceData.billTo.companyName}</p>
                    <p className="text-gray-600">{invoiceData.billTo.policyholderName}</p>
                    <p className="text-gray-600">{invoiceData.billTo.street}</p>
                    <p className="text-gray-600">{invoiceData.billTo.cityStateZip}</p>
                </div>

                <div className="border border-gray-200 rounded-lg p-6 my-8 grid grid-cols-2 gap-x-12 text-sm">
                    {/* Left Column */}
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-bold text-black mb-2">Additional Information:</h3>
                            <dl className="grid grid-cols-[max-content,1fr] gap-x-4 gap-y-1">
                                <DetailRow label="Claim Number:" value={invoiceData.claimNumber} />
                                <DetailRow label="Policy Number:" value={invoiceData.policyNumber} />
                            </dl>
                        </div>
                        {showClientVehicleInfo && (
                            <div>
                                <h3 className="font-bold text-black mb-2">Client's Vehicle Information:</h3>
                                <dl className="grid grid-cols-[max-content,1fr] gap-x-4 gap-y-1">
                                    <DetailRow label="VIN:" value={invoiceData.clientVehicleVIN} />
                                    <DetailRow label="Year:" value={invoiceData.clientVehicleYear} />
                                    <DetailRow label="Make:" value={invoiceData.clientVehicleMake} />
                                    <DetailRow label="Model:" value={invoiceData.clientVehicleModel} />
                                </dl>
                            </div>
                        )}
                    </div>
                    {/* Right Column */}
                    <div>
                        <h3 className="font-bold text-black mb-2">Adjuster & Period:</h3>
                        <dl className="grid grid-cols-[max-content,1fr] gap-x-4 gap-y-1">
                            <DetailRow label="Adjuster:" value={invoiceData.adjuster.name} />
                            <DetailRow label="Phone:" value={invoiceData.adjuster.phone} />
                            <DetailRow label="Email:" value={invoiceData.adjuster.email} />
                            <DetailRow label="Date of Loss:" value={invoiceData.dateOfLoss.replaceAll('-', '/')} />
                            <DetailRow label="General Period:" value={formattedPeriod} />
                            <DetailRow label="Auth Number:" value={invoiceData.authorizationNumber} boldValue />
                        </dl>
                    </div>
                </div>

                {/* Line Items Table */}
                <div className="mt-10">
                    <div className="grid grid-cols-[3fr,1fr,1fr,1.2fr] gap-x-4 text-xs font-bold text-white mb-2">
                        <div className="p-2.5 text-center bg-black rounded-full">DESCRIPTION</div>
                        <div className="p-2.5 text-center bg-black rounded-full">RATE</div>
                        <div className="p-2.5 text-center bg-black rounded-full">DAYS / QTY</div>
                        <div className="p-2.5 text-center bg-red-600 rounded-full">SUBTOTAL</div>
                    </div>
                    <div className="space-y-2">
                    {invoiceData.lineItems.map((item) => {
                        const subtotal = item.rate * item.days;
                        return (
                            <div key={item.id} className="grid grid-cols-[3fr,1fr,1fr,1.2fr] gap-x-4 text-sm items-center py-3 border-b border-gray-100">
                                <div className="text-left text-gray-700">{item.description}</div>
                                <div className="text-right text-gray-500">${item.rate.toFixed(2)}</div>
                                <div className="text-center text-gray-500">{item.days}</div>
                                <div className="text-right font-semibold text-black">${subtotal.toFixed(2)}</div>
                            </div>
                        );
                    })}
                    </div>
                </div>

                <div className="flex justify-end items-center mt-6">
                    <div className="text-right">
                        <span className="text-lg font-bold text-black mr-4">TOTAL</span>
                        <span className="text-xl font-bold text-black">${totalAmount.toFixed(2)}</span>
                    </div>
                </div>
            </main>
            
            <footer className="mt-auto pt-8">
                <hr className="border-t-2 border-dashed border-gray-300 my-6" />

                <div className="flex justify-between items-start text-sm text-gray-600">
                    <div className="w-3/5 pr-4">
                        <p className="font-bold text-black mb-2">PAYMENT METHOD</p>
                        <p>Payment by Check: Please make the check payable to <span className="font-semibold text-black">{invoiceData.paymentPayableToName}</span> and mail it to:</p>
                        <div className="mt-2 text-black">
                            <p className="font-bold">{invoiceData.paymentMailToName}</p>
                            <p>{invoiceData.paymentMailToStreet}</p>
                            <p>{invoiceData.paymentMailToCityStateZip}</p>
                        </div>
                    </div>
                    <div className="w-2/5 text-center mt-6"> 
                        <div className="inline-block"> 
                            <p className="text-base font-semibold text-black mb-2 h-5">{invoiceData.signatureName}</p> 
                            <hr className="border-black" />
                            <p className="text-xs text-gray-500 mt-1">Company signature</p>
                        </div>
                    </div>
                </div>

                <hr className="border-t border-solid border-black mt-10 mb-4" />
                
                <div className="text-center text-sm text-gray-600 space-x-8">
                    {invoiceData.footerContactPhone && (
                        <span className="inline-flex items-center">
                            <PhoneIcon className="w-4 h-4 mr-2 text-black" /> {invoiceData.footerContactPhone}
                        </span>
                    )}
                    {invoiceData.footerCompanyAddress && (
                        <span className="inline-flex items-center">
                            <MapPinIcon className="w-4 h-4 mr-2 text-black" /> {invoiceData.footerCompanyAddress}
                        </span>
                    )}
                </div>
            </footer>
        </div>
    </div>
  );
};