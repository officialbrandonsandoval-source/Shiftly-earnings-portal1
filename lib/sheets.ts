// Google Sheets reader — reads directly from public sheet via CSV export
// No API key or credentials needed for public sheets

const SHEET_ID = '1l7FcHInnagyvzEM_Op2RY53NSZBnL6wsYuyaVsj3beU';
const CACHE_TTL = 60 * 1000; // 60 seconds

let cache: { data: SheetDeal[]; ts: number } | null = null;

export interface SheetDeal {
  date: string;
  dealerName: string;
  clientName: string;
  product: string;
  monthlyPrice: number;
  setupFee: number;
  term: number;
  half: 'front' | 'back';
  repEmail?: string;
  repName?: string;
  sheetTab?: string;
}

// Fetch with a 5-second timeout to prevent hanging
async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function fetchSheetCSV(gid = '0'): Promise<string> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
  return res.text();
}

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  const lines = csv.split('\n');
  for (const line of lines) {
    const cols: string[] = [];
    let inQuote = false, cell = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQuote = !inQuote; continue; }
      if (c === ',' && !inQuote) { cols.push(cell.trim()); cell = ''; continue; }
      cell += c;
    }
    cols.push(cell.trim());
    rows.push(cols);
  }
  return rows;
}

function parseMoney(val: string): number {
  return parseFloat(val.replace(/[$,]/g, '')) || 0;
}

function parseDeals(rows: string[][], sheetTab = 'Sheet1'): SheetDeal[] {
  const deals: SheetDeal[] = [];

  // Find "FRONT CHECK DEALS" header row
  let frontStart = -1, backStart = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0]?.includes('FRONT CHECK DEALS') || rows[i][0]?.includes('FRONT OF MONTH CHECK')) {
      frontStart = i;
    }
    if (rows[i][9]?.includes('BACK CHECK DEALS') || rows[i][9]?.includes('BACK OF MONTH CHECK')) {
      backStart = i;
    }
  }

  // Find data header row (Date, Dealer Name, Product...)
  let dataHeaderRow = -1;
  for (let i = Math.max(0, frontStart); i < rows.length; i++) {
    if (rows[i][0] === 'Date' || rows[i][0]?.toLowerCase() === 'date') {
      dataHeaderRow = i;
      break;
    }
  }

  if (dataHeaderRow === -1) return deals;

  // Parse front half deals (cols 0-7)
  for (let i = dataHeaderRow + 1; i < rows.length; i++) {
    const row = rows[i];
    const date = row[0];
    if (!date || date === '' || date === '0' || !date.match(/\d/)) continue;
    const monthlyPrice = parseMoney(row[4]);
    const setupFee = parseMoney(row[5]);
    if (monthlyPrice === 0 && setupFee === 0) continue;

    deals.push({
      date,
      dealerName: row[1] || '',
      clientName: row[2] || row[1] || '',
      product: row[3] || 'Tool',
      monthlyPrice,
      setupFee,
      term: parseInt(row[6]) || 1,
      half: 'front',
      sheetTab,
    });
  }

  // Parse back half deals (cols 9-16)
  for (let i = dataHeaderRow + 1; i < rows.length; i++) {
    const row = rows[i];
    const date = row[9];
    if (!date || date === '' || !date.match(/\d/)) continue;
    const monthlyPrice = parseMoney(row[13]);
    const setupFee = parseMoney(row[14]);
    if (monthlyPrice === 0 && setupFee === 0) continue;

    deals.push({
      date,
      dealerName: row[10] || '',
      clientName: row[11] || row[10] || '',
      product: row[12] || 'Tool',
      monthlyPrice,
      setupFee,
      term: parseInt(row[15]) || 1,
      half: 'back',
      sheetTab,
    });
  }

  return deals;
}

export async function getSheetDeals(repEmail?: string): Promise<SheetDeal[]> {
  // Check cache
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    const data = repEmail ? cache.data.filter(d => !d.repEmail || d.repEmail === repEmail) : cache.data;
    return data;
  }

  try {
    const csv = await fetchSheetCSV('0');
    const rows = parseCSV(csv);
    const deals = parseDeals(rows, 'Sheet1');

    cache = { data: deals, ts: Date.now() };
    return repEmail ? deals.filter(d => !d.repEmail || d.repEmail === repEmail) : deals;
  } catch (err) {
    console.error('Sheet fetch error:', err);
    return getMockDeals();
  }
}

// Mock data fallback
export function getMockDeals(): SheetDeal[] {
  const now = new Date();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  return [
    { date: `${m}/3/${y}`, dealerName: 'ABC Motors', clientName: 'ABC Motors', product: 'Tool', monthlyPrice: 299, setupFee: 500, term: 6, half: 'front', repEmail: 'anthony@shiftlyauto.com', repName: 'Anthony' },
    { date: `${m}/5/${y}`, dealerName: 'Sunrise Auto', clientName: 'Sunrise Auto', product: 'Bundle Tool', monthlyPrice: 499, setupFee: 750, term: 12, half: 'front', repEmail: 'jr@shiftlyauto.com', repName: 'JR' },
    { date: `${m}/7/${y}`, dealerName: 'Pacific Honda', clientName: 'Pacific Honda', product: 'Ads', monthlyPrice: 349, setupFee: 500, term: 6, half: 'front', repEmail: 'dawson@shiftlyauto.com', repName: 'Dawson' },
    { date: `${m}/10/${y}`, dealerName: 'Desert Cars', clientName: 'Desert Cars', product: 'Ads', monthlyPrice: 399, setupFee: 600, term: 3, half: 'front', repEmail: 'jr@shiftlyauto.com', repName: 'JR' },
    { date: `${m}/12/${y}`, dealerName: 'Metro Chevy', clientName: 'Metro Chevy', product: 'Tool', monthlyPrice: 299, setupFee: 500, term: 3, half: 'front', repEmail: 'alex@shiftlyauto.com', repName: 'Alex' },
    { date: `${m}/14/${y}`, dealerName: 'Lakeside BMW', clientName: 'Lakeside BMW', product: 'Bundle Tool', monthlyPrice: 549, setupFee: 800, term: 12, half: 'front', repEmail: 'gdykema@shiftlyauto.com', repName: 'G Dykema' },
    { date: `${m}/18/${y}`, dealerName: 'Valley Ford', clientName: 'Valley Ford', product: 'Bundle Ads', monthlyPrice: 599, setupFee: 900, term: 6, half: 'back', repEmail: 'anthony@shiftlyauto.com', repName: 'Anthony' },
    { date: `${m}/20/${y}`, dealerName: 'Summit Toyota', clientName: 'Summit Toyota', product: 'Tool', monthlyPrice: 299, setupFee: 500, term: 6, half: 'back', repEmail: 'jeremy@shiftlyauto.com', repName: 'Jeremy' },
    { date: `${m}/22/${y}`, dealerName: 'Mesa Auto', clientName: 'Mesa Auto', product: 'Tool', monthlyPrice: 299, setupFee: 500, term: 1, half: 'back', repEmail: 'jr@shiftlyauto.com', repName: 'JR' },
    { date: `${m}/25/${y}`, dealerName: 'Coastal Kia', clientName: 'Coastal Kia', product: 'Ads', monthlyPrice: 399, setupFee: 600, term: 3, half: 'back', repEmail: 'dawson@shiftlyauto.com', repName: 'Dawson' },
  ];
}

// Parse a Google Sheets URL to extract sheet ID and optional gid/tab
export function parseSheetUrl(input: string): { sheetId: string; gid?: string; tab?: string } | null {
  if (!input) return null;

  // Full URL: https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=123
  const urlMatch = input.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) {
    const sheetId = urlMatch[1];
    const gidMatch = input.match(/[#?&]gid=(\d+)/);
    return { sheetId, gid: gidMatch?.[1] };
  }

  // If it's just a tab name (legacy support), use default sheet
  if (!input.includes('/') && !input.includes('http')) {
    return { sheetId: SHEET_ID, tab: input };
  }

  return null;
}

// Fetch deals from a specific Google Sheet URL or tab name
export async function getSheetDealsByUrl(sheetInput: string): Promise<SheetDeal[]> {
  if (!sheetInput) return [];

  const parsed = parseSheetUrl(sheetInput);
  if (!parsed) return [];

  try {
    let url: string;
    if (parsed.tab) {
      // Legacy tab name — use default sheet ID with tab
      url = `https://docs.google.com/spreadsheets/d/${parsed.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(parsed.tab)}`;
    } else if (parsed.gid) {
      // Full URL with gid
      url = `https://docs.google.com/spreadsheets/d/${parsed.sheetId}/gviz/tq?tqx=out:csv&gid=${parsed.gid}`;
    } else {
      // Full URL, default to first tab
      url = `https://docs.google.com/spreadsheets/d/${parsed.sheetId}/gviz/tq?tqx=out:csv&gid=0`;
    }

    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const csv = await res.text();
    const rows = parseCSV(csv);
    return parseDeals(rows, parsed.tab || 'Sheet1');
  } catch {
    return [];
  }
}

// Per-rep sheet fetcher — fetches a specific tab by name (legacy)
export async function getSheetDealsByTab(tabName: string): Promise<SheetDeal[]> {
  if (!tabName) return [];
  return getSheetDealsByUrl(tabName);
}

// Fetch all reps' deals (for manager view)
export async function getAllRepDeals(): Promise<SheetDeal[]> {
  const { REPS } = await import('./reps');
  const repTabs = REPS.filter(r => r.role === 'rep' && r.sheetTab);
  
  const results = await Promise.allSettled(
    repTabs.map(async (rep) => {
      const deals = await getSheetDealsByTab(rep.sheetTab);
      return deals.map(d => ({ ...d, repEmail: rep.email, repName: rep.name } as SheetDeal));
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<SheetDeal[]> => r.status === 'fulfilled')
    .flatMap(r => r.value);
}
