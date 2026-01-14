/**
 * Excel utilities using ExcelJS - a secure alternative to xlsx
 * Replaces vulnerable xlsx@0.18.5 (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9)
 */
import ExcelJS from 'exceljs';

/**
 * Create and download an Excel file from JSON data
 */
export async function createAndDownloadExcel(
  data: Record<string, unknown>[],
  sheetName: string,
  fileName: string,
  columnWidths?: number[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  if (data.length === 0) {
    throw new Error('No data to export');
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Add header row
  worksheet.addRow(headers);
  
  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
  });

  // Add data rows
  for (const item of data) {
    const row = headers.map(header => item[header] ?? '');
    worksheet.addRow(row);
  }

  // Set column widths if provided
  if (columnWidths) {
    columnWidths.forEach((width, index) => {
      const col = worksheet.getColumn(index + 1);
      col.width = width;
    });
  } else {
    // Auto-fit columns based on content
    worksheet.columns.forEach((column) => {
      let maxLength = 10;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const cellLength = cell.value ? String(cell.value).length : 0;
        if (cellLength > maxLength) {
          maxLength = Math.min(cellLength, 50);
        }
      });
      column.width = maxLength + 2;
    });
  }

  // Generate buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Read an Excel file and return JSON data
 */
export async function readExcelFile(
  file: File
): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in file');
  }

  const jsonData: Record<string, unknown>[] = [];
  const headers: string[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // First row is headers
      row.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value || `Column${colNumber}`);
      });
    } else {
      // Data rows
      const rowData: Record<string, unknown> = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          // Handle different cell value types
          let value = cell.value;
          if (typeof value === 'object' && value !== null) {
            // Handle rich text, formulas, etc.
            if ('result' in value) {
              value = value.result;
            } else if ('richText' in value) {
              value = (value as { richText: { text: string }[] }).richText
                .map((rt) => rt.text)
                .join('');
            } else if ('text' in value) {
              value = (value as { text: string }).text;
            }
          }
          rowData[header] = value;
        }
      });
      
      // Only add non-empty rows
      if (Object.keys(rowData).length > 0) {
        jsonData.push(rowData);
      }
    }
  });

  return jsonData;
}

/**
 * Create a template Excel file
 */
export async function createTemplate(
  templateData: Record<string, unknown>[],
  sheetName: string,
  fileName: string,
  columnWidths?: number[]
): Promise<void> {
  return createAndDownloadExcel(templateData, sheetName, fileName, columnWidths);
}
