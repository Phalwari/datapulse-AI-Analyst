import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { Dataset } from '../types';

export const exportElementToPDF = async (elementId: string, filename: string = 'DataPulse_AI_Report.pdf') => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found.`);
    alert(`Report container element #${elementId} not found.`);
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 1.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.85);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    const imgWidth = pdfWidth - 20; // 10mm margins
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(imgData, 'JPEG', 10, 10, imgWidth, Math.min(imgHeight, pdfHeight - 20));

    // Direct Blob download fallback to bypass strict browser pop-up blocks
    const blob = pdf.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = blobUrl;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);

    // Free memory
    canvas.width = 0;
    canvas.height = 0;
  } catch (err: any) {
    console.error('Failed to export PDF:', err);
    alert('Could not render PDF canvas: ' + (err?.message || err));
  }
};



export const exportDatasetToExcel = (dataset: Dataset, filename?: string) => {
  try {
    const worksheet = XLSX.utils.json_to_sheet(dataset.rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Raw Data');

    const outFilename = filename || `${dataset.name.replace(/\.[^/.]+$/, '')}_export.xlsx`;
    XLSX.writeFile(workbook, outFilename);
  } catch (err) {
    console.error('Failed to export Excel:', err);
  }
};
