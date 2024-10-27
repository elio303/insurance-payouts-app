import { NextResponse } from 'next/server';

export async function GET() {
  // Parse environment variables
  const columnsToDrop = JSON.parse(process.env.COLUMNS_TO_DROP || '[]');
  const renameMapping = JSON.parse(process.env.RENAME_MAPPING || '{}');
  const columnsToKeep = JSON.parse(process.env.COLUMNS_TO_KEEP || '[]');
  const productNameMapping = JSON.parse(process.env.PRODUCT_NAME_MAPPING || '{}');
  const productAgentCommissionMapping = JSON.parse(process.env.PRODUCT_AGENT_COMMISSION_MAPPING || '{}');
  const newColumns = JSON.parse(process.env.NEW_COLUMNS || '[]');
  const annuityCommissionPercentage = JSON.parse(process.env.ANNUITY_COMMISSION_PERCENTAGE || '0');
  const excludedAgents = JSON.parse(process.env.EXCLUDED_AGENTS || '[]');

  // Respond with JSON object containing mappings
  return NextResponse.json({
    columnsToDrop,
    renameMapping,
    columnsToKeep,
    productNameMapping,
    productAgentCommissionMapping,
    newColumns,
    annuityCommissionPercentage,
    excludedAgents
  });
}