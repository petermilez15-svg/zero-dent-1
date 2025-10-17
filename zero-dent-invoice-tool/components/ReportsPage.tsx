import React, { useState, useMemo } from 'react';
import { Button } from './Button';
import { Spinner } from './Spinner';
import { DocumentChartBarIcon, DocumentArrowDownIcon } from './IconComponents';
import { crossReferenceData } from '../services/analysisService';
import { generateAllDataReportPdfBlob } from '../services/pdfService';
import { personalCars, armandosRentals, sandysRentals } from '../data/fleetData';
import { TollCharge, CompanySettings } from '../types';
import { saveBlobAsFile } from '../utilityFunctions';

interface ReportsPageProps {
    rentalRows: any[];
    tollCharges: TollCharge[];
    companySettings: CompanySettings;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ rentalRows, tollCharges, companySettings }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    
    const allVehicles = useMemo(() => [...personalCars, ...armandosRentals, ...sandysRentals], []);

    const analysisResult = useMemo(() => {
        return crossReferenceData(rentalRows, tollCharges, allVehicles);
    }, [rentalRows, tollCharges, allVehicles]);


    const handleGenerateReport = async () => {
        setIsGenerating(true);
        
        try {
            const blob = await generateAllDataReportPdfBlob({
                analysisResult,
                allVehicles,
                companySettings,
            });

            if (blob) {
                saveBlobAsFile(blob, 'HailGuard_Full_Report.pdf');
            } else {
                // Handle error case, maybe show a global error message
                console.error("PDF generation failed.");
            }
        } catch (error) {
            console.error("Error during PDF report generation:", error);
        } finally {
            setIsGenerating(false);
        }
    };


    if (rentalRows.length === 0) {
        return (
            <div className="text-center p-8 bg-app-surface rounded-lg border border-app-border">
                <DocumentChartBarIcon className="w-16 h-16 text-app-textSecondary mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-app-textPrimary">Full Reports</h2>
                <p className="mt-2 text-app-textSecondary">
                    Upload data in the 'Rental Data' and 'Toll Data' tabs to generate a full report.
                </p>
            </div>
        );
    }
    
    return (
        <div className="bg-app-surface p-4 md:p-6 rounded-lg shadow-xl border border-app-border w-full text-center">
            <div className="flex flex-col items-center">
                <DocumentChartBarIcon className="w-16 h-16 text-brand-primary mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-app-textPrimary">Generate Full Report</h2>
                <p className="mt-2 text-app-textSecondary max-w-xl mx-auto">
                    This will generate a comprehensive PDF document containing an overall summary, monthly charts, and detailed breakdowns for every vehicle in your fleet based on the currently loaded data.
                </p>
                <Button
                    variant="primary"
                    size="lg"
                    onClick={handleGenerateReport}
                    disabled={isGenerating}
                    className="mt-8"
                    leftIcon={isGenerating ? <Spinner size="sm" /> : <DocumentArrowDownIcon className="w-5 h-5" />}
                >
                    {isGenerating ? 'Generating Report...' : 'Download Full PDF Report'}
                </Button>
            </div>
        </div>
    );
};