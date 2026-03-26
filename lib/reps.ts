// Rep configuration — maps Shiftly emails to their Google Sheet tabs and pay structures

export interface RepConfig {
  email: string;
  name: string;
  sheetTab: string;       // exact tab name in the Google Sheet
  payStructure: 'standard' | 'jr-custom';
  role: 'rep' | 'manager';
}

// Tab names assumed to match first name or display name in the sheet
// UPDATE sheetTab values if Ryan uses different tab names
export const REPS: RepConfig[] = [
  { email: 'anthony@shiftlyauto.com',  name: 'Anthony',  sheetTab: 'Anthony',  payStructure: 'standard',  role: 'rep' },
  { email: 'JR@shiftlyauto.com',       name: 'JR',       sheetTab: 'JR',       payStructure: 'jr-custom', role: 'rep' },
  { email: 'Dawson@shiftlyauto.com',   name: 'Dawson',   sheetTab: 'Dawson',   payStructure: 'standard',  role: 'rep' },
  { email: 'gdykema@shiftlyauto.com',  name: 'Gabriel',   sheetTab: 'Gabriel', payStructure: 'standard',  role: 'rep' },
  { email: 'alex@shiftlyauto.com',     name: 'Alex',     sheetTab: 'Alex',     payStructure: 'standard',  role: 'rep' },
  { email: 'Jeremy@shiftlyauto.com',   name: 'Jeremy',   sheetTab: 'Jeremy',   payStructure: 'standard',  role: 'rep' },
  // Managers — can see all reps
  { email: 'ryan@shiftlyauto.com',     name: 'Ryan',     sheetTab: '',         payStructure: 'standard',  role: 'manager' },
  { email: 'brandon@shiftlyauto.com',  name: 'Brandon',  sheetTab: '',         payStructure: 'standard',  role: 'manager' },
];

export function getRepByEmail(email: string): RepConfig | undefined {
  return REPS.find(r => r.email.toLowerCase() === email.toLowerCase());
}

export function getAllRepTabs(): string[] {
  return REPS.filter(r => r.role === 'rep' && r.sheetTab).map(r => r.sheetTab);
}
