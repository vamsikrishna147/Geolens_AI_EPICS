import React, { createContext, useContext, useState } from 'react';

const translations = {
  en: {
    // Top Bar
    'SYSTEM ONLINE': 'SYSTEM ONLINE',
    'REGION: GLOBAL': 'REGION: GLOBAL',
    'SOURCES: NASA, ESA, OSM': 'SOURCES: NASA, ESA, OSM',
    
    // Left Nav
    'Mission Control': 'Mission Control',
    'Map Layers': 'Map Layers',
    'Data & Validation': 'Data & Validation',
    'TimeLens Analysis': 'TimeLens Analysis',
    'Workspace': 'Workspace',
    'Datasets': 'Datasets',
    'Projects': 'Projects',
    'Reports': 'Reports',
    'History': 'History',

    // Right Console
    'AI Mission Console': 'AI Mission Console',
    'LIVE WORKFLOW TELEMETRY': 'LIVE WORKFLOW TELEMETRY',
    'TELEMETRY': 'TELEMETRY',
    'ASSISTANT': 'ASSISTANT',
    '1. REQUIREMENT ANALYSIS': '1. REQUIREMENT ANALYSIS',
    '2. DATA ACQUISITION': '2. DATA ACQUISITION',
    '3. GEOSPATIAL PROCESSING': '3. GEOSPATIAL PROCESSING',
    '4. INTELLIGENCE SYNTHESIS': '4. INTELLIGENCE SYNTHESIS',
    'Awaiting directive...': 'Awaiting directive...',
    'GENERATE OFFICIAL REPORT': 'GENERATE OFFICIAL REPORT',
    'OPEN TIMELENS COMPARISON': 'OPEN TIMELENS COMPARISON',

    // Bottom Command
    'Awaiting Mission Parameters... (e.g. Analyze flood damage in Assam)': 'Awaiting Mission Parameters... (e.g. Analyze flood damage in Assam)',
    'EXECUTE': 'EXECUTE',
    'Ask AI Assistant or enter a mission directive...': 'Ask AI Assistant or enter a mission directive...',
    'AI Assistant is working...': 'AI Assistant is working...',
    'Compare Hyderabad urban growth': 'Compare Hyderabad urban growth',
    'Detect flood affected regions': 'Detect flood affected regions'
  },
  hi: {
    // Hindi
    'SYSTEM ONLINE': 'सिस्टम ऑनलाइन',
    'REGION: GLOBAL': 'क्षेत्र: वैश्विक',
    'SOURCES: NASA, ESA, OSM': 'स्रोत: NASA, ESA, OSM',
    
    'Mission Control': 'मिशन नियंत्रण',
    'Map Layers': 'मानचित्र परतें',
    'Data & Validation': 'डेटा और सत्यापन',
    'TimeLens Analysis': 'टाइमलेंस विश्लेषण',
    'Workspace': 'कार्यक्षेत्र',
    'Datasets': 'डेटासेट',
    'Projects': 'परियोजनाएं',
    'Reports': 'रिपोर्ट',
    'History': 'इतिहास',

    'AI Mission Console': 'AI मिशन कंसोल',
    'LIVE WORKFLOW TELEMETRY': 'लाइव वर्कफ़्लो टेलीमेट्री',
    'TELEMETRY': 'टेलीमेट्री',
    'ASSISTANT': 'सहायक',
    '1. REQUIREMENT ANALYSIS': '1. आवश्यकता विश्लेषण',
    '2. DATA ACQUISITION': '2. डेटा अधिग्रहण',
    '3. GEOSPATIAL PROCESSING': '3. भू-स्थानिक प्रसंस्करण',
    '4. INTELLIGENCE SYNTHESIS': '4. खुफिया संश्लेषण',
    'Awaiting directive...': 'निर्देश की प्रतीक्षा...',
    'GENERATE OFFICIAL REPORT': 'आधिकारिक रिपोर्ट जनरेट करें',
    'OPEN TIMELENS COMPARISON': 'टाइमलेंस तुलना खोलें',

    'Awaiting Mission Parameters... (e.g. Analyze flood damage in Assam)': 'मिशन मापदंडों की प्रतीक्षा... (जैसे: असम में बाढ़ के नुकसान का विश्लेषण करें)',
    'EXECUTE': 'निष्पादित करें',
    'Ask AI Assistant or enter a mission directive...': 'AI सहायक से पूछें या मिशन निर्देश दर्ज करें...',
    'AI Assistant is working...': 'AI सहायक काम कर रहा है...',
    'Compare Hyderabad urban growth': 'हैदराबाद शहरी विकास की तुलना करें',
    'Detect flood affected regions': 'बाढ़ प्रभावित क्षेत्रों का पता लगाएं'
  },
  te: {
    // Telugu
    'SYSTEM ONLINE': 'సిస్టమ్ ఆన్‌లైన్',
    'REGION: GLOBAL': 'ప్రాంతం: గ్లోబల్',
    'SOURCES: NASA, ESA, OSM': 'మూలాలు: NASA, ESA, OSM',
    
    'Mission Control': 'మిషన్ కంట్రోల్',
    'Map Layers': 'మ్యాప్ లేయర్‌లు',
    'Data & Validation': 'డేటా & ధ్రువీకరణ',
    'TimeLens Analysis': 'టైమ్‌లెన్స్ విశ్లేషణ',
    'Workspace': 'కార్యస్థలం',
    'Datasets': 'డేటాసెట్‌లు',
    'Projects': 'ప్రాజెక్ట్‌లు',
    'Reports': 'నివేదికలు',
    'History': 'చరిత్ర',

    'AI Mission Console': 'AI మిషన్ కన్సోల్',
    'LIVE WORKFLOW TELEMETRY': 'లైవ్ వర్క్‌ఫ్లో టెలిమెట్రీ',
    'TELEMETRY': 'టెలిమెట్రీ',
    'ASSISTANT': 'సహాయకుడు',
    '1. REQUIREMENT ANALYSIS': '1. అవసరాల విశ్లేషణ',
    '2. DATA ACQUISITION': '2. డేటా సేకరణ',
    '3. జియోస్పేషియల్ ప్రాసెసింగ్': '3. జియోస్పేషియల్ ప్రాసెసింగ్',
    '4. INTELLIGENCE SYNTHESIS': '4. ఇంటెలిజెన్స్ సింథసిస్',
    'Awaiting directive...': 'ఆదేశం కోసం వేచి ఉంది...',
    'GENERATE OFFICIAL REPORT': 'అధికారిక నివేదికను రూపొందించండి',
    'OPEN TIMELENS COMPARISON': 'టైమ్‌లెన్స్ పోలికను తెరవండి',

    'Awaiting Mission Parameters... (e.g. Analyze flood damage in Assam)': 'మిషన్ పారామితుల కోసం వేచి ఉంది... (ఉదా: అస్సాంలో వరద నష్టాన్ని విశ్లేషించండి)',
    'EXECUTE': 'అమలు చేయండి',
    'Ask AI Assistant or enter a mission directive...': 'AI అసిస్టెంట్‌ని అడగండి లేదా మిషన్ ఆదేశాన్ని నమోదు చేయండి...',
    'AI Assistant is working...': 'AI అసిస్టెంట్ పని చేస్తున్నారు...',
    'Compare Hyderabad urban growth': 'హైదరాబాద్ పట్టణ వృద్ధిని సరిపోల్చండి',
    'Detect flood affected regions': 'వరద ప్రభావిత ప్రాంతాలను గుర్తించండి'
  },
  ta: {
    // Tamil
    'SYSTEM ONLINE': 'சிஸ்டம் ஆன்லைன்',
    'REGION: GLOBAL': 'பகுதி: குளோபல்',
    'SOURCES: NASA, ESA, OSM': 'ஆதாரங்கள்: NASA, ESA, OSM',
    
    'Mission Control': 'மிஷன் கட்டுப்பாடு',
    'Map Layers': 'வரைபட அடுக்குகள்',
    'Data & Validation': 'தரவு & சரிபார்ப்பு',
    'TimeLens Analysis': 'டைம்லென்ஸ் பகுப்பாய்வு',
    'Workspace': 'பணியிடம்',
    'Datasets': 'தரவுத்தொகுப்புகள்',
    'Projects': 'திட்டங்கள்',
    'Reports': 'அறிக்கைகள்',
    'History': 'வரலாறு',

    'AI Mission Console': 'AI மிஷன் கன்சோல்',
    'LIVE WORKFLOW TELEMETRY': 'லைவ் வொர்க்ஃப்ளோ டெலிமெட்ரி',
    'TELEMETRY': 'டெலிமெட்ரி',
    'ASSISTANT': 'உதவியாளர்',
    '1. REQUIREMENT ANALYSIS': '1. தேவை பகுப்பாய்வு',
    '2. DATA ACQUISITION': '2. தரவு கையகப்படுத்தல்',
    '3. GEOSPATIAL PROCESSING': '3. புவியியல் செயலாக்கம்',
    '4. INTELLIGENCE SYNTHESIS': '4. நுண்ணறிவு தொகுப்பு',
    'Awaiting directive...': 'கட்டளைக்காக காத்திருக்கிறது...',
    'GENERATE OFFICIAL REPORT': 'அதிகாரப்பூர்வ அறிக்கையை உருவாக்கவும்',
    'OPEN TIMELENS COMPARISON': 'டைம்லென்ஸ் ஒப்பீட்டைத் திறக்கவும்',

    'Awaiting Mission Parameters... (e.g. Analyze flood damage in Assam)': 'மிஷன் அளவுருக்களுக்காக காத்திருக்கிறது...',
    'EXECUTE': 'செயல்படுத்து',
    'Ask AI Assistant or enter a mission directive...': 'AI உதவியாளரிடம் கேளுங்கள் அல்லது ஒரு கட்டளையை உள்ளிடவும்...',
    'AI Assistant is working...': 'AI உதவியாளர் வேலை செய்கிறார்...',
    'Compare Hyderabad urban growth': 'ஹைதராபாத் நகர்ப்புற வளர்ச்சியை ஒப்பிடுக',
    'Detect flood affected regions': 'வெள்ளத்தால் பாதிக்கப்பட்ட பகுதிகளைக் கண்டறியவும்'
  },
  bn: {
    // Bengali
    'SYSTEM ONLINE': 'সিস্টেম অনলাইন',
    'REGION: GLOBAL': 'অঞ্চল: গ্লোবাল',
    'SOURCES: NASA, ESA, OSM': 'উত্স: NASA, ESA, OSM',
    
    'Mission Control': 'মিশন নিয়ন্ত্রণ',
    'Map Layers': 'ম্যাপ লেয়ার',
    'Datasets': 'ডেটাসেট',
    'Projects': 'প্রকল্প',
    'Reports': 'প্রতিবেদন',
    'History': 'ইতিহাস',

    'AI Mission Console': 'AI মিশন কনসোল',
    'LIVE WORKFLOW TELEMETRY': 'লাইভ ওয়ার্কফ্লো টেলিমেট্রি',
    '1. REQUIREMENT ANALYSIS': '1. প্রয়োজনীয়তা বিশ্লেষণ',
    '2. DATA ACQUISITION': '2. ডেটা সংগ্রহ',
    '3. GEOSPATIAL PROCESSING': '3. জিওস্পেশিয়াল প্রসেসিং',
    '4. INTELLIGENCE SYNTHESIS': '4. ইন্টেলিজেন্স সংশ্লেষণ',
    'Awaiting directive...': 'নির্দেশের অপেক্ষায়...',
    'GENERATE OFFICIAL REPORT': 'অফিসিয়াল রিপোর্ট তৈরি করুন',
    'OPEN TIMELENS COMPARISON': 'টাইমলেন্স তুলনা খুলুন',

    'Awaiting Mission Parameters... (e.g. Analyze flood damage in Assam)': 'মিশন পরামিতিগুলির অপেক্ষায়...',
    'EXECUTE': 'চালান',
    'Ask AI Assistant or enter a mission directive...': 'এআই সহকারীকে জিজ্ঞাসা করুন বা একটি নির্দেশিকা লিখুন...',
    'AI Assistant is working...': 'এআই সহকারী কাজ করছে...',
    'Compare Hyderabad urban growth': 'হায়দ্রাবাদের নগর বৃদ্ধির তুলনা করুন',
    'Detect flood affected regions': 'বন্যা কবলিত অঞ্চল শনাক্ত করুন'
  }
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      return localStorage.getItem('geolens_language') || 'en';
    } catch {
      return 'en';
    }
  });

  const setLanguage = (lang) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('geolens_language', lang);
    } catch {
      // ignore
    }
  };

  const t = (key) => {
    if (!key) return '';
    return (translations[language] && translations[language][key]) || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
