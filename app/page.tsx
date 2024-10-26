"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import * as dfd from "danfojs";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import Groupby from "danfojs/dist/danfojs-base/aggregators/groupby";
import { DataFrame } from "danfojs/dist/danfojs-base";

interface FileData {
  name: string;
  size: number;
}

export default function Home() {
  const [files, setFiles] = useState<FileData[]>([]);

  // Drop event handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const mappedFiles = mapFiles(acceptedFiles);
    setFiles(prevFiles => [...prevFiles, ...mappedFiles]);

    let df: dfd.DataFrame = await loadAndCleanData(acceptedFiles[0]);
    const workbook: XLSX.WorkBook = XLSX.utils.book_new();

    // Create sheets
    createGroupedSheets(workbook, df);
    createEarningsReportSheet(workbook, df);

    // Write the workbook to file
    XLSX.writeFile(workbook, "grouped_data.xlsx");
  }, []);

  // Map files for display
  const mapFiles = (acceptedFiles: File[]): FileData[] =>
    acceptedFiles.map(file => ({
      name: file.name,
      size: file.size,
    }));

  // Load and clean data from file
  const loadAndCleanData = async (file: File): Promise<dfd.DataFrame> => {
    let df: dfd.DataFrame = await dfd.readExcel(file) as dfd.DataFrame;
    df = new dfd.DataFrame(df.values.slice(3, -2), { columns: df.values[2] as any });
    df = df.drop({ columns: columnsToDrop });
    df.rename(renameMapping, { inplace: true });
    df = df.loc({ columns: columnsToKeep });
    df = mapProductNames(df);
    df = addEmptyColumns(df); // Ensure df is modified with empty columns
    return df;
  };

  const columnsToDrop: string[] = [
    "Agency",
    "Payee ID",
    "Payee Name",
    "Income Class",
    "Writing Agt #",
    "Writing Agent Level",
    "Premium Transaction",
    "Process Date",
    "Premium Eff Date",
    "Writing Agent Agency",
    "Agency Name",
  ];

  const renameMapping: { [key: string]: string } = {
    "Product": "Product Name",
    "Payment Date": "Date",
    "Writing Agt": "Agent",
    "Product Co": "Insurance Company",
  };

  const columnsToKeep: string[] = [
    "Date",
    "Insurance Company",
    "Product Type",
    "Policy #",
    "Product Name",
    "Policy Issue Date",
    "Insured Name",
    "Billing Frequency",
    "Premium Amt",
    "Comm Rate %",
    "Gross Comm Earned",
    "% of particip",
    "Compensation Type",
    "Agent",
    "Transaction Type",
  ];

  // TODO: Ask about mapping here AND ask about foundation
  const productNameMapping: { [key: string]: string } = {
    "LSW Level Term 30-G": "30 Year Term",
    "LSW Level Term 20-G": "20 Year Term",
    "LSW Level Term 15-G": "15 Year Term",
    "LSW Level Term 10-G": "10 Year Term",
    "FlexLife II": "FlexLife",
    "FlexLife": "FlexLife",
    "SummitLife": "SummitLife",
    "SEC GROWTH": "SEC GROWTH",
  };

  const mapProductNames = (df: dfd.DataFrame): dfd.DataFrame => {
    df["Product Name"] = df["Product Name"].map((value: string) => productNameMapping[value] || value);
    return df;
  };

  // Add empty columns to DataFrame
  const addEmptyColumns = (df: dfd.DataFrame): dfd.DataFrame => {
    const newColumns: string[] = [
      "--",
      "Commission %",
      "Commission Amount",
      "Commission Paid",
      "Payment Method",
      "Payment Date",
    ];

    newColumns.forEach(column => {
      const emptyArray: string[] = new Array(df.shape[0]).fill(""); // Create an array of empty strings
      df = df.addColumn(column, emptyArray); // Update df with new column
    });

    return df; // Return the modified DataFrame
  };

  // Create individual sheets grouped by Agent
  const createGroupedSheets = (workbook: XLSX.WorkBook, df: dfd.DataFrame): void => {
    const grouped: Groupby = df.groupby(["Agent"]) as Groupby;
    const uniqueAgents: string[] = df["Agent"].unique().values;

    uniqueAgents.forEach(agent => {
      const agentGroup: dfd.DataFrame = grouped.getGroup([agent]).loc({ columns: df.columns });
      const agentGroupJson = dfd.toJSON(agentGroup);
      if (Array.isArray(agentGroupJson)) {
        const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(agentGroupJson);
        XLSX.utils.book_append_sheet(workbook, worksheet, agent.toString());

        // Resize columns to fit content
        resizeColumns(worksheet, agentGroupJson, Object.keys(agentGroupJson[0]));
      }
    });
  };

  // Create Earnings Report Sheet
  const createEarningsReportSheet = (workbook: XLSX.WorkBook, df: dfd.DataFrame): void => {
    const emptyRowsDf: dfd.DataFrame = createEmptyRows(df);
    const grouped: Groupby = df.groupby(["Agent"]) as Groupby;
    const uniqueAgents: string[] = df["Agent"].unique().values;

    uniqueAgents.forEach(agent => {
      const agentGroup: dfd.DataFrame = grouped.getGroup([agent]).loc({ columns: df.columns });
      df = dfd.concat({ dfList: [df, emptyRowsDf, agentGroup], axis: 0 }) as DataFrame;
    });

    const earningsReportJson = dfd.toJSON(df);
    if (Array.isArray(earningsReportJson)) {
      const earningsReportSheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(earningsReportJson);
      const formattedDate: string = dayjs().format("MMDDYYYY");
      XLSX.utils.book_append_sheet(workbook, earningsReportSheet, `EarningsReport_${formattedDate}`);

      // Resize columns to fit content for the earnings report sheet
      resizeColumns(earningsReportSheet, earningsReportJson, Object.keys(earningsReportJson[0]));

      // Move Earnings Report to the front
      workbook.SheetNames = [workbook.SheetNames.pop() as string, ...workbook.SheetNames];
    }
  };

  const createEmptyRows = (df: dfd.DataFrame): dfd.DataFrame => {
    const emptyRow: { [key: string]: string } = Object.fromEntries(df.columns.map(column => [column, ""]));
    const headerRow: { [key: string]: string } = Object.fromEntries(df.columns.map(column => [column, column]));
    return new dfd.DataFrame([emptyRow, emptyRow, headerRow]);
  };

  // Function to resize columns based on the content
  const resizeColumns = (worksheet: XLSX.WorkSheet, jsonData: any[], headers: string[]) => {
    const columnWidths: number[] = [];

    // Check header lengths first
    headers.forEach((header, index) => {
      const headerLength = header.length;
      if (!columnWidths[index] || headerLength > columnWidths[index]) {
        columnWidths[index] = headerLength;
      }
    });

    // Then check each row
    jsonData.forEach(row => {
      Object.keys(row).forEach((key, index) => {
        const cellValue = row[key]?.toString() || "";
        const cellLength = cellValue.length;

        if (!columnWidths[index] || cellLength > columnWidths[index]) {
          columnWidths[index] = cellLength;
        }
      });
    });

    // Set the column widths
    columnWidths.forEach((width, index) => {
      worksheet["!cols"] = worksheet["!cols"] || [];
      worksheet["!cols"][index] = { wpx: (width + 2) * 7 }; // Adjust multiplier for better fitting
    });
  };

  // Dropzone for drag-and-drop functionality
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <h1 className="text-3xl font-semibold text-gray-800 mb-6">Drag and Drop File Upload</h1>

      {/* Drag and Drop Zone */}
      <div
        {...getRootProps()}
        className={`w-full max-w-lg p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          isDragActive ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-white"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-center text-gray-600">
          {isDragActive ? "Drop the files here ..." : "Drag & drop some files here, or click to select files"}
        </p>
      </div>

      {/* File List */}
      <div className="mt-6 w-full max-w-lg">
        <h2 className="text-xl font-semibold text-gray-800 mb-3">Uploaded Files</h2>
        <ul className="space-y-3">
          {files.map((file, index) => (
            <li key={index} className="flex justify-between items-center p-3 bg-gray-100 rounded-md border">
              <span className="text-gray-700">{file.name}</span>
              <span className="text-gray-500 text-sm">{Math.round(file.size / 1024)} KB</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}