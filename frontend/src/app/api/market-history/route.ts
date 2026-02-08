import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const VIRTUAL_START_UTC_MS = Date.UTC(2025, 2, 3, 1, 0, 0); // 2025-03-03 09:00:00 Asia/Shanghai

interface ParsedSeries {
  closePrices: number[];
  firstOpenTimeUs: number;
  lastCloseTimeUs: number;
}

interface CachedMarketData {
  virtualStartUtcMs: number;
  datasetSeconds: number;
  btcClosePrices: number[];
  goldClosePrices: number[];
  source: {
    btcFile: string;
    goldFile: string;
    btcDataStartUtcMs: number;
    goldDataStartUtcMs: number;
  };
}

let cachedData: CachedMarketData | null = null;

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveDataRoot(): Promise<string> {
  const candidates = [
    path.resolve(process.cwd(), '..', 'data'),
    path.resolve(process.cwd(), 'data'),
    path.resolve(process.cwd(), '..', '..', 'data'),
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to locate data directory. Checked: ${candidates.join(', ')}`);
}

function parseCloseSeries(csvContent: string, label: string): ParsedSeries {
  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length === 0) {
    throw new Error(`CSV ${label} is empty`);
  }

  const closePrices = new Array<number>(lines.length);
  let firstOpenTimeUs = 0;
  let lastCloseTimeUs = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fields = line.split(',');
    if (fields.length < 7) {
      throw new Error(`Invalid CSV row in ${label} at line ${i + 1}`);
    }

    const openTimeUs = Number(fields[0]);
    const closePrice = Number(fields[4]);
    const closeTimeUs = Number(fields[6]);

    if (!Number.isFinite(openTimeUs) || !Number.isFinite(closePrice) || !Number.isFinite(closeTimeUs)) {
      throw new Error(`Non-numeric value in ${label} at line ${i + 1}`);
    }

    if (i === 0) {
      firstOpenTimeUs = openTimeUs;
    }
    lastCloseTimeUs = closeTimeUs;
    closePrices[i] = closePrice;
  }

  return {
    closePrices,
    firstOpenTimeUs,
    lastCloseTimeUs,
  };
}

async function loadMarketData(): Promise<CachedMarketData> {
  if (cachedData) {
    return cachedData;
  }

  const dataRoot = await resolveDataRoot();
  const btcFile = path.join(
    dataRoot,
    'BTCUSDC-aggTrades-2025-03-03_07',
    'BTCUSDC-1s-2025-03-03.csv'
  );
  const goldFile = path.join(
    dataRoot,
    'XAUUSDC-aggTrades-2025-03-03_07',
    'XAUUSDC-1s-2025-03-03.csv'
  );

  const [btcCsv, goldCsv] = await Promise.all([
    readFile(btcFile, 'utf8'),
    readFile(goldFile, 'utf8'),
  ]);

  const btcSeries = parseCloseSeries(btcCsv, 'BTCUSDC-1s-2025-03-03.csv');
  const goldSeries = parseCloseSeries(goldCsv, 'XAUUSDC-1s-2025-03-03.csv');

  const datasetSeconds = Math.min(btcSeries.closePrices.length, goldSeries.closePrices.length);
  if (datasetSeconds <= 0) {
    throw new Error('No market data rows after parsing CSV files');
  }

  cachedData = {
    virtualStartUtcMs: VIRTUAL_START_UTC_MS,
    datasetSeconds,
    btcClosePrices: btcSeries.closePrices.slice(0, datasetSeconds),
    goldClosePrices: goldSeries.closePrices.slice(0, datasetSeconds),
    source: {
      btcFile: path.relative(dataRoot, btcFile),
      goldFile: path.relative(dataRoot, goldFile),
      btcDataStartUtcMs: Math.floor(btcSeries.firstOpenTimeUs / 1000),
      goldDataStartUtcMs: Math.floor(goldSeries.firstOpenTimeUs / 1000),
    },
  };

  return cachedData;
}

export async function GET() {
  try {
    const marketData = await loadMarketData();
    return NextResponse.json(marketData);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to load market history',
        details: message,
      },
      { status: 500 }
    );
  }
}
