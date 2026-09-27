/** Round rupee amounts that look like SIPs or bank transfers, not UPI spend. */
export function isRecurringTransferAmount(rupees: number): boolean {
  if (rupees < 5000) return false
  return Math.abs(rupees % 1000) < 0.05
}

export type ClassifiedStatement = {
  categoryId: string
  flow: 'inflow' | 'outflow' | 'transfer'
  merchant: string
}

export const statementCategoryOptions = [
  { id: 'unknown', name: 'Unknown', flow: null },
  { id: 'salary', name: 'Salary', flow: 'inflow' },
  { id: 'bank-interest', name: 'Bank interest / dividends', flow: 'inflow' },
  { id: 'lifestyle-groceries', name: 'Groceries', flow: 'outflow' },
  { id: 'lifestyle-food', name: 'Food delivery / restaurants', flow: 'outflow' },
  { id: 'lifestyle-shopping', name: 'Shopping', flow: 'outflow' },
  { id: 'lifestyle-travel', name: 'Travel / commute', flow: 'outflow' },
  { id: 'lifestyle-utilities', name: 'Utilities / phone / internet', flow: 'outflow' },
  { id: 'lifestyle-medical', name: 'Medical', flow: 'outflow' },
  { id: 'lifestyle-entertainment', name: 'Entertainment', flow: 'outflow' },
  { id: 'lifestyle-services', name: 'Services / government', flow: 'outflow' },
  { id: 'rent-home', name: 'Rent', flow: 'outflow' },
  { id: 'credit-card-payment', name: 'Credit-card payment', flow: 'transfer' },
  { id: 'sip-mf', name: 'Mutual-fund investment', flow: 'transfer' },
  { id: 'stock-market', name: 'Stock investment', flow: 'transfer' },
  { id: 'personal-transfer', name: 'Personal transfer', flow: 'transfer' },
  { id: 'other-income', name: 'Other income', flow: 'inflow' },
  { id: 'other-expense', name: 'Other expense', flow: 'outflow' },
] as const

type Rule = {
  id: string
  merchant: string
  pattern: RegExp
  flow?: ClassifiedStatement['flow']
}

const rules: Rule[] = [
  { id: 'salary', merchant: 'Salary', pattern: /\bsalary\b/i, flow: 'inflow' },
  { id: 'bank-interest', merchant: 'Bank interest / dividends', pattern: /interest credit|intdiv|dividend/i, flow: 'inflow' },
  {
    id: 'stock-market',
    merchant: 'Self stock transfer',
    pattern: /stock mark|groww invest|groww withdraw|growwstock/i,
    flow: 'transfer',
  },
  { id: 'sip-mf', merchant: 'Mutual fund SIP', pattern: /mutualfund|mutual fund/i, flow: 'outflow' },
  { id: 'rent-home', merchant: 'Rent', pattern: /\brent\b/i, flow: 'outflow' },
  { id: 'credit-card-payment', merchant: 'SBI credit card', pattern: /credit card payment/i },
  {
    id: 'lifestyle-groceries',
    merchant: 'Groceries',
    pattern: /blinkit|zepto|amazon pay groceries|akshayakalpa|namdhari|\bgrocer(?:y|ies)\b/i,
  },
  {
    id: 'lifestyle-food',
    merchant: 'Food delivery / restaurants',
    pattern: /zomato|swiggy|restaurant|cafe|canteen|bakery|pizza|burger/i,
  },
  {
    id: 'lifestyle-shopping',
    merchant: 'Shopping',
    pattern: /amazon|flipkart|myntra|nykaa|westside|bonkers|off duty|untitled|decathlon|innovist|muscleblaze|eversub/i,
  },
  {
    id: 'lifestyle-travel',
    merchant: 'Travel / commute',
    pattern: /uber|\bola\b|rapido|\bmetro\b|bmtc|msrtc|irctc|confirm ticket|happyfares|abhibus/i,
  },
  {
    id: 'lifestyle-utilities',
    merchant: 'Utilities / phone / internet',
    pattern: /airtel|jio|actcorp|atria convergence|electric|bescom|wifi|broadband|prepaid|postpaid|gail/i,
  },
  { id: 'lifestyle-medical', merchant: 'Medical', pattern: /medical|pharma|pharmacy|apollo|shailaja/i },
  {
    id: 'lifestyle-entertainment',
    merchant: 'Entertainment',
    pattern: /bookmyshow|bigtree|pvr|inox|google play|playstore|netflix|hotstar|spotify|steam/i,
  },
  { id: 'lifestyle-services', merchant: 'Services / government', pattern: /passport|xerox|seva|courier|print/i },
]

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/** Best-effort display label only. It never decides the category. */
export function statementCounterparty(memo: string): string {
  const parts = memo
    .replace(/^\d{2}[/-]\d{2}[/-]\d{4}(?:\s+\d{2}[/-]\d{2}[/-]\d{4})?\s*/i, '')
    .split(/[/|]/)
    .map((part) =>
      part
        .replace(/[^a-z0-9 .&'-]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(
      (part) =>
        part.length >= 3 &&
        !/^(upi|neft|imps|inft|ach|debit|credit|transfer|payment|ref|txn|dr|cr|by|to)$/i.test(part) &&
        !/^\d+$/.test(part) &&
        !part.includes('@'),
    )
  const candidate = parts.find((part) => /[a-z]{3}/i.test(part))
  return candidate ? titleCase(candidate.slice(0, 60)) : 'Unknown recipient'
}

export function classifyStatementMemo(memo: string, detectedFlow: ClassifiedStatement['flow'], rupees = 0): ClassifiedStatement {
  void rupees
  const rule = rules.find((item) => item.pattern.test(memo))
  if (rule) {
    return {
      categoryId: rule.id,
      flow: rule.flow ?? detectedFlow,
      merchant: rule.merchant,
    }
  }
  return {
    categoryId: 'unknown',
    flow: detectedFlow,
    merchant: statementCounterparty(memo),
  }
}

export function isLifestyleCategory(categoryId: string | null | undefined): boolean {
  return Boolean(
    categoryId &&
    (categoryId.startsWith('lifestyle-') ||
      categoryId === 'rent-home' ||
      categoryId === 'credit-card-payment' ||
      categoryId === 'unknown' ||
      categoryId === 'other-expense'),
  )
}

export function lifestyleAmountMinor(categoryId: string | null | undefined, amountMinor: number): number {
  if (categoryId === 'rent-home' && amountMinor >= 2_800_000) return 1_500_000
  return amountMinor
}
