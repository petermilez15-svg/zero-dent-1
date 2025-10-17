import { InvoiceData, VehicleDetail, TollCharge, CompanySettings, InvoiceType } from '../types'; 
import { jsPDF } from 'jspdf'; 
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { CrossReferenceResult } from './analysisService';

// --- Report Styling Theme ---
const reportTheme = {
  primaryText: '#262626', // Black
  secondaryText: '#525252', // Grey
  accent: '#84CC16', // Lime Green
  headerAccentBg: '#84CC16', // Lime Green for headers
  headerAccentText: '#171717', // Black text for on-lime-green
  borderColor: '#D4D4D4',
  danger: '#EF4444',
  success: '#16a34a', // A high-contrast green (e.g., Tailwind's green-600) for text
  white: '#FFFFFF',
  pageBackground: '#FFFFFF',
};


// --- Local Helper Functions for this service ---
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

const normalizeToDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date && !isNaN(value.getTime())) return value;
    if (typeof value === 'string') {
        const parsedDate = new Date(value);
        if (!isNaN(parsedDate.getTime())) return parsedDate;
    }
    if (typeof value === 'number') {
        const date = new Date((value - 25569) * 86400 * 1000);
        if (!isNaN(date.getTime())) return date;
    }
    return null;
};

const normalizePlate = (plate: string): string => {
  if (!plate) return '';
  // Remove spaces, dashes, and other non-alphanumeric chars, then uppercase
  let normalized = String(plate).toUpperCase().replace(/[^A-Z0-9]/g, '');
  // If the result starts with "TX", remove it
  if (normalized.startsWith('TX')) {
    normalized = normalized.substring(2);
  }
  return normalized;
};
// End of local helpers

// Helper to format date string (YYYY-MM-DD) to MM/DD/YYYY or similar for display
const formatDate = (dateStr: string | Date | null, style: 'short' | 'long' = 'long'): string => {
  if (!dateStr) return 'N/A';
  try {
    const date = dateStr instanceof Date ? dateStr : new Date(dateStr + 'T00:00:00'); // Ensure date is parsed as local
    if (isNaN(date.getTime())) return 'N/A';
    if (style === 'long') {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
  } catch (e) {
    return String(dateStr); // fallback
  }
};

export const generateInvoicePdfBlob = async (element: HTMLElement, invoiceType: InvoiceType): Promise<Blob | null> => {
  if (!element) {
    console.error("PDF generation failed: No element provided to capture.");
    return null;
  }
  
  const canvas = await html2canvas(element, {
    scale: 2, // Use a higher scale for better resolution
    useCORS: true, // Important for external images like logos
    logging: false,
    backgroundColor: '#ffffff', // Ensure a white background for the capture
  });
  
  const imgData = canvas.toDataURL('image/png');
  
  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'pt',
    format: 'letter'
  });
  
  const imgProps = pdf.getImageProperties(imgData);
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  
  const widthRatio = pdfWidth / imgProps.width;
  const finalImgWidth = pdfWidth;
  const finalImgHeight = imgProps.height * widthRatio;
  
  // For 'Administration' invoices, force it to a single page by scaling height if necessary.
  if (invoiceType === 'Administration') {
    let imgHeight = finalImgHeight;
    let imgWidth = finalImgWidth;
    
    // If the image is too tall for the page, scale it down to fit.
    if (imgHeight > pdfHeight) {
      imgHeight = pdfHeight;
      // Scale the width proportionally to maintain aspect ratio
      imgWidth = (imgProps.width * imgHeight) / imgProps.height;
    }
    
    // Center the (potentially narrower) image horizontally
    const xOffset = (pdfWidth - imgWidth) / 2;

    pdf.addImage(imgData, 'PNG', xOffset, 0, imgWidth, imgHeight);

  } else {
    // Original multi-page logic for other invoice types
    let heightLeft = finalImgHeight;
    let position = 0;
    
    pdf.addImage(imgData, 'PNG', 0, position, finalImgWidth, finalImgHeight);
    heightLeft -= pdfHeight;
    
    while (heightLeft > 0) {
      position = heightLeft - finalImgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, finalImgWidth, finalImgHeight);
      heightLeft -= pdfHeight;
    }
  }
  
  return pdf.output('blob');
};


export const generateVehicleReportPdfBlob = async (vehicle: VehicleDetail, summary: any, rentals: any[], tolls: TollCharge[], chartImage: string | null, companySettings?: CompanySettings): Promise<Blob | null> => {
    const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    let yPos = margin;

    const logoImg = new Image();
    const logoSrcToUse = companySettings?.logoDataUrl;
    let finalCanvasLogoDataUrl: string | null = null;
    const PDF_LOGO_HEIGHT = 40;
    let pdfLogoWidth = 0;

    if (logoSrcToUse) {
        try {
          await new Promise<void>((resolve) => {
            logoImg.onload = () => {
              if (logoImg.width > 0 && logoImg.height > 0) {
                  const aspectRatio = logoImg.width / logoImg.height;
                  pdfLogoWidth = PDF_LOGO_HEIGHT * aspectRatio;
                  const canvas = document.createElement('canvas');
                  canvas.width = logoImg.width;
                  canvas.height = logoImg.height;
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    ctx.drawImage(logoImg, 0, 0);
                    finalCanvasLogoDataUrl = canvas.toDataURL('image/png');
                  }
              }
              resolve();
            };
            logoImg.onerror = (e) => {
              console.error(`Logo image failed to load for report: ${vehicle.name}. Source: ${logoSrcToUse.substring(0,100)}...`, e);
              resolve(); // Resolve anyway to not fail the whole report
            };
            logoImg.crossOrigin = "Anonymous";
            logoImg.src = logoSrcToUse;
          });
        } catch (error) {
            console.error("Error processing logo for vehicle report:", error);
        }
    }

    const drawPageHeader = (title: string) => {
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(reportTheme.primaryText);
        doc.text(title, margin, margin + 10);
        if (finalCanvasLogoDataUrl && pdfLogoWidth > 0) {
            doc.addImage(finalCanvasLogoDataUrl, 'PNG', pageWidth - margin - pdfLogoWidth, margin, pdfLogoWidth, PDF_LOGO_HEIGHT);
        }
    };
    
    const drawPageFooter = (pageNum: number, totalPages: number) => {
        doc.setFontSize(8);
        doc.setTextColor(reportTheme.secondaryText);
        const footerText = `Report Generated: ${new Date().toLocaleDateString()}`;
        doc.text(footerText, margin, pageHeight - 20);
        doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 20, { align: 'right' });
    };

    // --- PAGE 1 ---
    drawPageHeader('Vehicle Performance Report');
    yPos = margin + 50;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(reportTheme.accent);
    doc.text(vehicle.name, margin, yPos);
    yPos += 25;

    const vehicleDetailsBody = [
        ['VIN', vehicle.vin],
        ['Make/Model', `${vehicle.make} ${vehicle.model}`],
        ['Year', String(vehicle.year)],
        ['License Plate', normalizePlate(vehicle.licensePlate)],
    ];
    autoTable(doc, {
        body: vehicleDetailsBody,
        startY: yPos,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2, textColor: reportTheme.secondaryText },
        columnStyles: { 0: { fontStyle: 'bold', textColor: reportTheme.primaryText } }
    });
    yPos = (doc as any).lastAutoTable.finalY + 30;

    // Summary Stats
    const summaryBody = [
        ['Total Rental Income', `$${summary.totalIncome.toFixed(2)}`],
        ['Total Toll Charges', `-$${summary.totalTolls.toFixed(2)}`],
        ['Net Income', `$${(summary.totalIncome - summary.totalTolls).toFixed(2)}`],
    ];
    autoTable(doc, {
        head: [['Overall Summary', '']],
        body: summaryBody,
        startY: yPos,
        theme: 'grid',
        headStyles: { fillColor: reportTheme.headerAccentBg, textColor: reportTheme.headerAccentText, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 5, lineColor: reportTheme.borderColor, lineWidth: 0.5 },
        columnStyles: { 0: { fontStyle: 'bold' } },
        didParseCell: (data) => {
             if(data.section === 'body' && data.column.index === 1) {
               if(data.row.index === 0) data.cell.styles.textColor = reportTheme.success;
               if(data.row.index === 1) data.cell.styles.textColor = reportTheme.danger;
               if(data.row.index === 2) data.cell.styles.textColor = ((summary.totalIncome - summary.totalTolls) >= 0) ? reportTheme.success : reportTheme.danger;
            }
        }
    });
    yPos = (doc as any).lastAutoTable.finalY + 30;

    // Chart
    if (chartImage) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(reportTheme.primaryText);
        doc.text('Monthly Performance Chart', margin, yPos);
        yPos += 20;
        const chartWidth = pageWidth - margin * 2;
        const chartHeight = chartWidth / 2.2;
        doc.addImage(chartImage, 'PNG', margin, yPos, chartWidth, chartHeight);
        yPos += chartHeight + 30;
    }

    // Rental History
    if (rentals.length > 0) {
        if (yPos > pageHeight - 200) {
            drawPageFooter(1, 2); // Assuming 2 pages max for simplicity here, might need adjustment
            doc.addPage();
            yPos = margin;
            drawPageHeader('Vehicle Performance Report (Continued)');
        }
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(reportTheme.primaryText);
        doc.text('Rental History', margin, yPos);
        yPos += 20;

        const rentalHistoryBody = rentals.map(row => {
            const insuredName = getValue(row, ['Insured Name']) || 'N/A';
            const plate = normalizePlate(getValue(row, ['License Plate', 'Plate']) || vehicle.licensePlate);
            const periodStart = normalizeToDate(getValue(row, ['Rental Start Date', 'Rental Period Start', 'Rental Period STart']));
            const periodEnd = normalizeToDate(getValue(row, ['Rental End Date', 'Rental Period End', 'Rental Period ENd']));
            const days = parseInt(String(getValue(row, ['Total Rental Dates', 'Rental Days Total'])), 10) || 1;
            const rate = parseFloat(String(getValue(row, ['Covered Rental Rate', 'Rental Rate']) || '0').replace(/[^0-9.-]+/g, ""));
            const income = rate * days;

            return [
                insuredName,
                plate,
                `${formatDate(periodStart, 'short')} to ${formatDate(periodEnd, 'short')}`,
                days.toString(),
                `$${rate.toFixed(2)}`,
                `$${income.toFixed(2)}`
            ];
        });

        autoTable(doc, {
            head: [['Insured / Claim #', 'Plate', 'Rental Period', 'Days', 'Rate', 'Income']],
            body: rentalHistoryBody,
            startY: yPos,
            theme: 'striped',
            headStyles: { fillColor: reportTheme.headerAccentBg, textColor: reportTheme.headerAccentText, fontStyle: 'bold', fontSize: 9 },
            styles: { fontSize: 8, cellPadding: 4, lineColor: reportTheme.borderColor },
        });
        yPos = (doc as any).lastAutoTable.finalY + 25;
    }
    
    // Toll History
    if (tolls.length > 0) {
       // Similar logic for new page check if needed
    }

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawPageFooter(i, totalPages);
    }

    return doc.output('blob');
};

interface FullReportData {
    analysisResult: CrossReferenceResult;
    allVehicles: VehicleDetail[];
    companySettings: CompanySettings;
}

export const generateAllDataReportPdfBlob = async (data: FullReportData): Promise<Blob | null> => {
    const { analysisResult, allVehicles, companySettings } = data;
    const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    let yPos = margin;

    // --- Logo Loading ---
    const logoImg = new Image();
    const logoSrcToUse = companySettings.logoDataUrl;
    let finalCanvasLogoDataUrl: string | null = null;
    const PDF_LOGO_HEIGHT = 40;
    let pdfLogoWidth = 0;

    if (logoSrcToUse) {
        try {
            await new Promise<void>((resolve) => {
                logoImg.onload = () => {
                    if (logoImg.width > 0 && logoImg.height > 0) {
                        const aspectRatio = logoImg.width / logoImg.height;
                        pdfLogoWidth = PDF_LOGO_HEIGHT * aspectRatio;
                        const canvas = document.createElement('canvas');
                        canvas.width = logoImg.width;
                        canvas.height = logoImg.height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(logoImg, 0, 0);
                            finalCanvasLogoDataUrl = canvas.toDataURL('image/png');
                        }
                    }
                    resolve();
                };
                logoImg.onerror = (e) => {
                    console.error(`Logo image failed to load for full report. Source: ${logoSrcToUse.substring(0,100)}...`, e);
                    resolve();
                };
                logoImg.crossOrigin = "Anonymous";
                logoImg.src = logoSrcToUse;
            });
        } catch (error) {
            console.error("Error processing logo for full report:", error);
        }
    }
    
    const drawHeader = (title: string) => {
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(reportTheme.primaryText);
        doc.text(title, margin, margin + 10);
        if (finalCanvasLogoDataUrl && pdfLogoWidth > 0) {
            doc.addImage(finalCanvasLogoDataUrl, 'PNG', pageWidth - margin - pdfLogoWidth, margin, pdfLogoWidth, PDF_LOGO_HEIGHT);
        }
    };
    
    const drawFooter = () => {
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(reportTheme.secondaryText);
            const footerText = `Report Generated: ${new Date().toLocaleDateString()}`;
            doc.text(footerText, margin, pageHeight - 20);
            doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 20, { align: 'right' });
        }
    };

    // --- Page 1: Title and Overall Summary ---
    drawHeader("Full Performance Report");
    yPos = margin + 60;
    
    const totalIncome = analysisResult.augmentedRentals.reduce((sum, r) => sum + ((getValue(r, ['Covered Rental Rate', 'Rental Rate']) || 0) * (getValue(r, ['Total Rental Dates', 'Rental Days Total']) || 1)), 0);
    const totalTolls = analysisResult.augmentedRentals.reduce((sum, r) => sum + r._totalTollAmount, 0) + analysisResult.unmatchedTollGroups.reduce((sum, g) => sum + g.totalAmount, 0) + analysisResult.unassignedTolls.reduce((sum, t) => sum + t.amount, 0);
    
    const summaryBody = [
        ['Total Rental Income', `$${totalIncome.toFixed(2)}`],
        ['Total Toll Charges', `-$${totalTolls.toFixed(2)}`],
        ['Net Income', `$${(totalIncome - totalTolls).toFixed(2)}`],
    ];
    autoTable(doc, {
        head: [['Overall Financial Summary', '']],
        body: summaryBody,
        startY: yPos,
        theme: 'grid',
        headStyles: { fillColor: reportTheme.headerAccentBg, textColor: reportTheme.headerAccentText, fontStyle: 'bold' },
        styles: { fontSize: 11, cellPadding: 8, valign: 'middle', lineColor: reportTheme.borderColor, lineWidth: 0.5 },
        columnStyles: { 
            0: { fontStyle: 'bold', cellWidth: 200, textColor: reportTheme.primaryText },
            1: { fontStyle: 'bold', fontSize: 14, halign: 'right' },
        },
        didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 1) {
                if (data.row.index === 0) data.cell.styles.textColor = reportTheme.success;
                if (data.row.index === 1) data.cell.styles.textColor = reportTheme.danger;
                if (data.row.index === 2) data.cell.styles.textColor = ((totalIncome - totalTolls) >= 0) ? reportTheme.success : reportTheme.danger;
            }
        }
    });
    yPos = (doc as any).lastAutoTable.finalY + 30;

    // --- Subsequent Pages: Per-Vehicle Details ---
    for (const vehicle of allVehicles) {
        doc.addPage();
        yPos = margin;
        drawHeader("Vehicle Details");
        yPos += 60;

        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(reportTheme.accent);
        doc.text(vehicle.name, margin, yPos);
        yPos += 30;
        
        const vehicleRentals = analysisResult.augmentedRentals.filter(r => (getValue(r, ['Rental Car Assigned', 'Rental Vehicle', 'Vehicle']) || '').trim().toLowerCase().startsWith(vehicle.name.trim().toLowerCase()));
        const vehicleTolls = [...vehicleRentals.flatMap(r => r._tolls), ...(analysisResult.unmatchedTollGroups.find(g => g.vehicle.vin === vehicle.vin)?.tolls || [])];
        const vehicleIncome = vehicleRentals.reduce((sum, r) => sum + ((getValue(r, ['Covered Rental Rate', 'Rental Rate']) || 0) * (getValue(r, ['Total Rental Dates', 'Rental Days Total']) || 1)), 0);
        const vehicleTollSum = vehicleTolls.reduce((sum, t) => sum + t.amount, 0);
        const totalDaysRented = vehicleRentals.reduce((d,r) => d + (getValue(r,['Total Rental Dates', 'Rental Days Total'])||1), 0);
        const dailyRate = totalDaysRented > 0 ? vehicleIncome / totalDaysRented : 0;
        
        // --- Performance Card ---
        const performanceBody = [
            ['Total Income', `$${vehicleIncome.toFixed(2)}`],
            ['Total Tolls', `-$${vehicleTollSum.toFixed(2)}`],
            ['Net Income', `$${(vehicleIncome - vehicleTollSum).toFixed(2)}`],
            ['Total Rentals / Days', `${vehicleRentals.length} / ${totalDaysRented} days`],
            ['Avg. Income per Rental', `$${vehicleRentals.length > 0 ? (vehicleIncome / vehicleRentals.length).toFixed(2) : '0.00'}`],
            ['Avg. Daily Rate', `$${dailyRate.toFixed(2)}`],
        ];
        
        autoTable(doc, {
            head: [['Performance Summary', '']],
            startY: yPos,
            body: performanceBody,
            theme: 'grid',
            headStyles: { fillColor: reportTheme.headerAccentBg, textColor: reportTheme.headerAccentText, fontStyle: 'bold' },
            styles: { fontSize: 10, cellPadding: 6, lineColor: reportTheme.borderColor, lineWidth: 0.5 },
            columnStyles: {
                0: { fontStyle: 'bold', textColor: reportTheme.primaryText },
                1: { halign: 'right' }
            },
            didParseCell: (data) => {
                if(data.section === 'body' && data.column.index === 1) {
                   if(data.row.index === 0) data.cell.styles.textColor = reportTheme.success;
                   if(data.row.index === 1) data.cell.styles.textColor = reportTheme.danger;
                   if(data.row.index === 2) data.cell.styles.textColor = (vehicleIncome-vehicleTollSum >= 0) ? reportTheme.success : reportTheme.danger;
                }
            }
        });
        yPos = (doc as any).lastAutoTable.finalY + 25;
        
        // --- Rental Timeline ---
        if(vehicleRentals.length > 0){
            // (Timeline visualization omitted for complexity, focusing on tabular data)
        }

        // --- Rental History Table ---
        if (vehicleRentals.length > 0) {
            if (yPos > pageHeight - 250) {
                 doc.addPage();
                 yPos = margin;
                 drawHeader("Vehicle Details (Continued)");
                 yPos += 60;
            }

            const rentalHistoryBody = vehicleRentals.map(row => {
                const insuredName = getValue(row, ['Insured Name']) || 'N/A';
                const claim = getValue(row, ['Claim Number']) || 'N/A';
                const periodStart = normalizeToDate(getValue(row, ['Rental Start Date', 'Rental Period Start', 'Rental Period STart']));
                const periodEnd = normalizeToDate(getValue(row, ['Rental End Date', 'Rental Period End', 'Rental Period ENd']));
                const days = parseInt(String(getValue(row, ['Total Rental Dates', 'Rental Days Total'])), 10) || 1;
                const rate = parseFloat(String(getValue(row, ['Covered Rental Rate', 'Rental Rate']) || '0').replace(/[^0-9.-]+/g, ""));
                const income = rate * days;
    
                return [
                    `${insuredName}\nClaim: ${claim}`,
                    `${formatDate(periodStart, 'short')} to ${formatDate(periodEnd, 'short')}`,
                    days.toString(),
                    `$${rate.toFixed(2)}`,
                    `$${income.toFixed(2)}`
                ];
            });
    
            autoTable(doc, {
                head: [['Insured / Claim #', 'Rental Period', 'Days', 'Rate', 'Income']],
                body: rentalHistoryBody,
                startY: yPos,
                theme: 'striped',
                headStyles: { fillColor: reportTheme.headerAccentBg, textColor: reportTheme.headerAccentText, fontStyle: 'bold', fontSize: 9 },
                styles: { fontSize: 8, cellPadding: 4, lineColor: reportTheme.borderColor },
                didDrawPage: (d) => { yPos = d.cursor?.y || margin + 60; },
            });
            yPos = (doc as any).lastAutoTable.finalY;
        }
    }
    
    // Final pass to add footers to all pages
    drawFooter();

    return doc.output('blob');
};