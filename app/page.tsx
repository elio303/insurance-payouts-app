"use client"

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import * as dfd from 'danfojs';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import Groupby from 'danfojs/dist/danfojs-base/aggregators/groupby';
import { DataFrame } from 'danfojs/dist/danfojs-base';


interface FileData {
  name: string;
  size: number;
}

export default function Home() {
  const [files, setFiles] = useState<FileData[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const mappedFiles = acceptedFiles.map(file => ({
      name: file.name,
      size: file.size,
    }));

    setFiles(prevFiles => [...prevFiles, ...mappedFiles]);

    // Read the file into a DataFrame object
    let df: dfd.DataFrame = await dfd.readExcel(acceptedFiles[0]) as dfd.DataFrame;

    // Rename columns
    df.rename({
      'Payment Date': 'Date',
      'Writing Agt': 'Agent',
    }, { inplace: true });

    // Add columns
    const columnNames: string[] = [
      '--',
      'Commission %',
      'Commission Amount',
      'Commission Paid',
      'Payment Method',
      'Payment Date',
    ]
    
    columnNames.forEach((columnName: string) => {
      df = df.addColumn(columnName, Array(df.values.length).fill(''));
    });

    const workbook = XLSX.utils.book_new();

    // Group data by agent
    const uniqueValues = df['Agent'].unique().values;
    const grouped: Groupby = df.groupby(['Agent']);

    uniqueValues.forEach((value: any) => {
      const groupDf = grouped.getGroup([value]).loc({ columns: df.columns });
      const groupDfObject: any = dfd.toJSON(groupDf);
      const worksheet = XLSX.utils.json_to_sheet(groupDfObject);
      XLSX.utils.book_append_sheet(workbook, worksheet, value.toString());
    });

    // Add the Earnings Report tab
    const emptyColumnValueMapping: any = {}
    df.columns.forEach((column: string) => {
      emptyColumnValueMapping[column] = '';
    });

    const columnNameMapping: any = {}
    df.columns.forEach((column: string) => {
      columnNameMapping[column] = column;
    });

    const emptyRowsData = [
      emptyColumnValueMapping,
      emptyColumnValueMapping,
      columnNameMapping
    ];
    const emptyRowsDf = new dfd.DataFrame(emptyRowsData);

    uniqueValues.forEach((value: any) => {
      const groupDf = grouped.getGroup([value]).loc({ columns: df.columns });

      df = dfd.concat({
        dfList: [df, emptyRowsDf, groupDf],
        axis: 0,
      }) as DataFrame;
    });

    const earningsReportJson: any = dfd.toJSON(df)
    const earningsReportWorksheet = XLSX.utils.json_to_sheet(earningsReportJson);
    const formattedToday = dayjs().format('MMDDYYYY')
    XLSX.utils.book_append_sheet(workbook, earningsReportWorksheet, `EarningsReport_${formattedToday}`);

    // Bring Earnings Report back to the front
    const sheetNames: string[] = workbook.SheetNames;
    workbook.SheetNames = [sheetNames.pop() as string, ...sheetNames]

    // Write data to file
    XLSX.writeFile(workbook, 'grouped_data.xlsx');
  }, []);

  // UseDropzone hook to manage the drop area
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
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
          isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-white'
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-center text-gray-600">
          {isDragActive ? 'Drop the files here ...' : 'Drag & drop some files here, or click to select files'}
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