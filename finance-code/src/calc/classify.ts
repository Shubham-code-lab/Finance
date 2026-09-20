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

type Rule = {
  id: string
  merchant: string
  pattern: RegExp
  flow?: ClassifiedStatement['flow']
}

const rules: Rule[] = [
  { id: 'salary', merchant: 'Amagi Media Labs', pattern: /amagi media|salary|neft-hdfch/i, flow: 'inflow' },
  { id: 'bank-interest', merchant: 'Bank interest / dividends', pattern: /interest credit|intdiv|dividend/i, flow: 'inflow' },
  {
    id: 'stock-market',
    merchant: 'Self stock transfer',
    pattern: /stock mark|groww invest|groww withdraw|growwstock/i,
    flow: 'transfer',
  },
  { id: 'sip-mf', merchant: 'Mutual fund SIP', pattern: /mutualfund|mutual fund/i, flow: 'outflow' },
  { id: 'rent-home', merchant: 'Home rent', pattern: /s j arun|arun kumar|9739009054|rent/i, flow: 'outflow' },
  { id: 'roommate-reimbursement', merchant: 'Roommate reimbursement', pattern: /rangaswamy|splitwise/i, flow: 'transfer' },
  { id: 'friend-reimbursement', merchant: 'Friend reimbursement', pattern: /aman praka|aman prakash|prakashaman/i, flow: 'transfer' },
  { id: 'credit-card-payment', merchant: 'SBI credit card', pattern: /credit card payment/i },
  {
    id: 'lifestyle-groceries',
    merchant: 'Groceries',
    pattern: /blinkit|zepto|village ma|village market|amazon pay groceries|akshayakalpa|simplinamd|namdhari|milk|grocery|market/i,
  },
  {
    id: 'lifestyle-food',
    merchant: 'Food delivery / restaurants',
    pattern:
      /zomato|swiggy|aadams|uphara|sirvi|high table|biryani|restaurant|cafe|kitchen|canteen|juice|bakery|tea|coffee|pizza|burger|mithai/i,
  },
  {
    id: 'lifestyle-shopping',
    merchant: 'Shopping',
    pattern: /amazon|flipkart|myntra|nykaa|westside|bonkers|off duty|untitled|decathlon|innovist|muscleblaze|eversub/i,
  },
  {
    id: 'lifestyle-travel',
    merchant: 'Travel / commute',
    pattern: /uber|ola|rapido|metro|bmtc|msrtc|irctc|confirm ti|confirm ticket|happyfares|abhibus|bus|rail|train/i,
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

export function classifyStatementMemo(memo: string, detectedFlow: ClassifiedStatement['flow'], rupees = 0): ClassifiedStatement {
  const rule = rules.find((item) => item.pattern.test(memo))
  if (rule) {
    return {
      categoryId: rule.id,
      flow: rule.flow ?? detectedFlow,
      merchant: rule.merchant,
    }
  }
  if (detectedFlow === 'outflow' && isRecurringTransferAmount(rupees)) {
    return { categoryId: 'large-transfer', flow: 'transfer', merchant: 'Large transfer' }
  }
  return {
    categoryId: detectedFlow === 'inflow' ? 'other-credit' : 'uncategorized-spend',
    flow: detectedFlow,
    merchant: detectedFlow === 'inflow' ? 'Other credit' : 'Other spend',
  }
}

export function isLifestyleCategory(categoryId: string | null | undefined): boolean {
  return Boolean(
    categoryId &&
    (categoryId.startsWith('lifestyle-') ||
      categoryId === 'rent-home' ||
      categoryId === 'credit-card-payment' ||
      categoryId === 'uncategorized-spend'),
  )
}

export function lifestyleAmountMinor(categoryId: string | null | undefined, amountMinor: number): number {
  if (categoryId === 'rent-home' && amountMinor >= 2_800_000) return 1_500_000
  return amountMinor
}
