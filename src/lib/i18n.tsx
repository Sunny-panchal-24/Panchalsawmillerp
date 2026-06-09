import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "hi" | "gu";

type Dict = Record<string, string>;

const translations: Record<Lang, Dict> = {
  en: {
    app_name: "Panchal Sawmill",
    tagline: "Sawmill Business Management",
    sign_in: "Sign In",
    sign_up: "Sign Up",
    sign_out: "Sign Out",
    email: "Email",
    password: "Password",
    full_name: "Full Name",
    welcome: "Welcome",
    dashboard: "Dashboard",
    language: "Language",
    create_account: "Create Account",
    already_have_account: "Already have an account?",
    need_account: "Need an account?",
    purchases: "Purchases",
    waste_wood_sales: "Waste Wood Sales",
    finished_wood_sales: "Finished Wood Sales",
    vendor_payments: "Vendor Payments",
    customer_receipts: "Customer Receipts",
    workers: "Workers",
    cash_book: "Cash Book",
    bank_book: "Bank Book",
    reports: "Reports",
    settings: "Settings",
    loading: "Loading...",
    coming_soon: "Coming soon",
  },
  hi: {
    app_name: "पंचाल सॉमिल",
    tagline: "सॉमिल व्यवसाय प्रबंधन",
    sign_in: "साइन इन",
    sign_up: "साइन अप",
    sign_out: "साइन आउट",
    email: "ईमेल",
    password: "पासवर्ड",
    full_name: "पूरा नाम",
    welcome: "स्वागत है",
    dashboard: "डैशबोर्ड",
    language: "भाषा",
    create_account: "खाता बनाएँ",
    already_have_account: "पहले से खाता है?",
    need_account: "खाता चाहिए?",
    purchases: "खरीद",
    waste_wood_sales: "वेस्ट वुड बिक्री",
    finished_wood_sales: "तैयार लकड़ी बिक्री",
    vendor_payments: "विक्रेता भुगतान",
    customer_receipts: "ग्राहक रसीद",
    workers: "मज़दूर",
    cash_book: "कैश बुक",
    bank_book: "बैंक बुक",
    reports: "रिपोर्ट",
    settings: "सेटिंग्स",
    loading: "लोड हो रहा है...",
    coming_soon: "जल्द आ रहा है",
  },
  gu: {
    app_name: "પંચાલ સોમિલ",
    tagline: "સોમિલ વ્યવસાય વ્યવસ્થાપન",
    sign_in: "સાઇન ઇન",
    sign_up: "સાઇન અપ",
    sign_out: "સાઇન આઉટ",
    email: "ઈમેલ",
    password: "પાસવર્ડ",
    full_name: "પૂરું નામ",
    welcome: "સ્વાગત છે",
    dashboard: "ડેશબોર્ડ",
    language: "ભાષા",
    create_account: "ખાતું બનાવો",
    already_have_account: "પહેલેથી ખાતું છે?",
    need_account: "ખાતું જોઈએ છે?",
    purchases: "ખરીદી",
    waste_wood_sales: "વેસ્ટ વુડ વેચાણ",
    finished_wood_sales: "તૈયાર લાકડું વેચાણ",
    vendor_payments: "વેન્ડર ચુકવણી",
    customer_receipts: "ગ્રાહક રસીદ",
    workers: "કામદારો",
    cash_book: "કેશ બુક",
    bank_book: "બેંક બુક",
    reports: "રિપોર્ટ",
    settings: "સેટિંગ્સ",
    loading: "લોડ થઈ રહ્યું છે...",
    coming_soon: "ટૂંક સમયમાં આવી રહ્યું છે",
  },
};

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "psm_lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? (localStorage.getItem(STORAGE_KEY) as Lang | null) : null;
    if (stored && translations[stored]) setLangState(stored);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, l);
  };

  const t = (key: string) => translations[lang][key] ?? translations.en[key] ?? key;

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
  { code: "gu", label: "ગુજરાતી" },
];
