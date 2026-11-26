/** The six spend buckets the Brex page and agent share. */
export const BREX_SPEND_BUCKETS = [
  "software",
  "cloud",
  "travel",
  "meals",
  "marketing",
  "other",
] as const;
export type BrexSpendBucket = (typeof BREX_SPEND_BUCKETS)[number];

/** Brex expense categories, from the Expenses API reference. */
export const BREX_EXPENSE_CATEGORIES = [
  "ADVERTISING_AND_MARKETING",
  "GROCERY",
  "TELEPHONY",
  "OFFICE_SUPPLIES",
  "PRIVATE_AIR_TRAVEL",
  "CLOTHING",
  "CAR_RENTAL",
  "VEHICLE_EXPENSES",
  "RESTAURANTS",
  "GAMBLING",
  "FLOWERS",
  "ELECTRONICS",
  "LEGAL_SERVICES",
  "UTILITIES",
  "FURNITURE",
  "BARS_AND_NIGHTLIFE",
  "LAUNDRY",
  "EVENT_EXPENSES",
  "SHIPPING",
  "OTHER_TRAVEL_EXPENSES",
  "CHARITY",
  "SOFTWARE_NON_RECURRING",
  "LODGING",
  "FACILITIES_EXPENSES",
  "SERVERS",
  "CONFERENCES",
  "FOOD_DELIVERY",
  "RENT",
  "AIRLINE_EXPENSES",
  "OTHER_BUSINESS_EXPENSES",
  "BANK_AND_FINANCIAL_FEES",
  "BOOKS_AND_NEWSPAPERS",
  "CONSULTANT_AND_CONTRACTOR",
  "CORPORATE_INSURANCE",
  "DIGITAL_GOODS",
  "FEES_AND_LICENSES_AND_TAXES",
  "GAS_AND_FUEL",
  "GENERAL_MERCHANDISE",
  "MEDICAL",
  "MEMBERSHIPS_AND_CLUBS",
  "PARKING_EXPENSES",
  "POLITICAL_DONATIONS",
  "PUBLIC_TRANSPORTATION",
  "RECURRING_SOFTWARE_AND_SAAS",
  "RIDESHARE_AND_TAXI",
  "TOLL_AND_BRIDGE_FEES",
  "TRAINING_AND_EDUCATION",
  "TRAVEL_WIFI",
] as const;
export type BrexExpenseCategory = (typeof BREX_EXPENSE_CATEGORIES)[number];

/** Every known Brex expense category has exactly one bucket; unknown values fall through. */
export const BREX_EXPENSE_CATEGORY_BUCKETS: Record<BrexExpenseCategory, BrexSpendBucket> = {
  ADVERTISING_AND_MARKETING: "marketing",
  GROCERY: "meals",
  TELEPHONY: "software",
  OFFICE_SUPPLIES: "other",
  PRIVATE_AIR_TRAVEL: "travel",
  CLOTHING: "other",
  CAR_RENTAL: "travel",
  VEHICLE_EXPENSES: "travel",
  RESTAURANTS: "meals",
  GAMBLING: "other",
  FLOWERS: "other",
  ELECTRONICS: "other",
  LEGAL_SERVICES: "other",
  UTILITIES: "other",
  FURNITURE: "other",
  BARS_AND_NIGHTLIFE: "meals",
  LAUNDRY: "other",
  EVENT_EXPENSES: "marketing",
  SHIPPING: "other",
  OTHER_TRAVEL_EXPENSES: "travel",
  CHARITY: "other",
  SOFTWARE_NON_RECURRING: "software",
  LODGING: "travel",
  FACILITIES_EXPENSES: "other",
  SERVERS: "cloud",
  CONFERENCES: "other",
  FOOD_DELIVERY: "meals",
  RENT: "other",
  AIRLINE_EXPENSES: "travel",
  OTHER_BUSINESS_EXPENSES: "other",
  BANK_AND_FINANCIAL_FEES: "other",
  BOOKS_AND_NEWSPAPERS: "other",
  CONSULTANT_AND_CONTRACTOR: "other",
  CORPORATE_INSURANCE: "other",
  DIGITAL_GOODS: "software",
  FEES_AND_LICENSES_AND_TAXES: "other",
  GAS_AND_FUEL: "travel",
  GENERAL_MERCHANDISE: "other",
  MEDICAL: "other",
  MEMBERSHIPS_AND_CLUBS: "other",
  PARKING_EXPENSES: "travel",
  POLITICAL_DONATIONS: "other",
  PUBLIC_TRANSPORTATION: "travel",
  RECURRING_SOFTWARE_AND_SAAS: "software",
  RIDESHARE_AND_TAXI: "travel",
  TOLL_AND_BRIDGE_FEES: "travel",
  TRAINING_AND_EDUCATION: "other",
  TRAVEL_WIFI: "travel",
} as const;

/** Common merchant category codes, used only when an expense has no Brex category. */
export const BREX_MCC_BUCKETS: Record<string, BrexSpendBucket> = {
  "4121": "travel", // taxicabs and rideshares
  "4131": "travel", // bus lines
  "4214": "other", // motor freight and trucking
  "4215": "other", // courier services
  "4784": "travel", // tolls and bridge fees
  "4789": "travel", // transportation services
  "5013": "other", // motor vehicle supplies and new parts
  "5044": "software", // office equipment
  "5045": "software", // computers and computer peripherals
  "5046": "software", // commercial equipment
  "5411": "meals", // grocery stores and supermarkets
  "5422": "meals", // freezers and lockers
  "5441": "meals", // candy and nut stores
  "5451": "meals", // dairy products
  "5462": "meals", // bakeries
  "5499": "meals", // miscellaneous food stores
  "5541": "travel", // service stations
  "5542": "travel", // automated fuel dispensers
  "5811": "meals", // caterers
  "5812": "meals", // eating places and restaurants
  "5813": "meals", // drinking places
  "5814": "meals", // fast food restaurants
  "5817": "software", // digital goods: large digital goods merchants
  "5818": "software", // digital goods: multi-category
  "5912": "other", // drug stores and pharmacies
  "5921": "meals", // package stores and beer
  "5999": "other", // miscellaneous retail stores
  "7011": "travel", // hotels and motels
  "7021": "travel", // timeshares
  "7512": "travel", // car rental agencies
  "7513": "travel", // truck and utility trailer rentals
  "7519": "travel", // motor home and recreational vehicle rentals
  "7523": "travel", // parking lots and garages
  "7531": "travel", // automotive body repair shops
  "7534": "travel", // tire retreading and repair
  "7535": "travel", // paint shops
  "7538": "travel", // automotive service shops
  "7542": "travel", // car washes
  "7549": "travel", // towing services
  "7311": "marketing", // advertising services
  "7312": "marketing", // advertising agencies
  "7372": "software", // computer programming and data processing
  "7375": "software", // information retrieval services
  "5734": "software", // computer software stores
  "5732": "software", // electronics stores
  "5733": "software", // music stores
  "4816": "software", // computer network services
  "4899": "software", // cable and other pay television services
};

/** Resolve one expense or transaction to its spend bucket. */
export function brexSpendBucket(input: {
  category?: string | null;
  mcc?: string | null;
}): BrexSpendBucket {
  const category = input.category ?? null;
  if (category && category in BREX_EXPENSE_CATEGORY_BUCKETS)
    return BREX_EXPENSE_CATEGORY_BUCKETS[category as BrexExpenseCategory];
  const mcc = input.mcc?.trim() ?? "";
  return BREX_MCC_BUCKETS[mcc] ?? "other";
}
