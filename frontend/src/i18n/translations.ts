export type Language = 'en' | 'hi';

export interface Translations {
  // Navigation
  brandTitle: string;
  brandSubtitle: string;
  liveSheet: string;
  mockMode: string;
  connecting: string;
  connected: string;
  syncing: string;
  disconnected: string;
  forceSyncBtn: string;
  simulateBtn: string;
  architectureBtn: string;
  takeTourBtn: string;
  overviewBtn: string;
  sheetViewBtn: string;
  languageSelect: string;

  // Collaborator Bar
  collaboratorYou: string;
  changeNickname: string;
  activeSeats: string;
  seatsOccupiedTooltip: string;
  activeCollaboratorTooltip: string;
  viewingSheet: string;

  // Metrics Bar
  rowsSynced: string;
  activeColumns: string;
  chunkWindow: string;
  rowsPerPage: string;
  lastSynced: string;
  justNow: string;

  // Data Table
  tableTitle: string;
  tableSubtitle: string;
  searchPlaceholder: string;
  addColumnBtn: string;
  addRowBtn: string;
  columnNamePlaceholder: string;
  saveColBtn: string;
  rowIdHeader: string;
  actionsHeader: string;
  editBtn: string;
  submitBtn: string;
  savingBtn: string;
  cancelBtn: string;
  deleteBtn: string;
  deleteConfirm: string;
  noRowsFound: string;
  editingBy: string;
  pageOf: string;
  prevPage: string;
  nextPage: string;
  pageSize: string;

  // Activity Feed
  activityTitle: string;
  activitySubtitle: string;
  liveStreamBadge: string;
  noActivityYet: string;
  sourceWeb: string;
  sourceSheets: string;
  sourceWebhook: string;
  sourcePoller: string;

  // Conflict Resolution Modal
  conflictTitle: string;
  conflictWarning: string;
  conflictDescription: string;
  localAttempted: string;
  remoteSheet: string;
  keepMineBtn: string;
  acceptRemoteBtn: string;
  reviewMergeBtn: string;

  // Simulate Direct Sheet Edit Modal
  simulateTitle: string;
  simulateSubtitle: string;
  simulateRowLabel: string;
  simulateValuesLabel: string;
  simulateExecuteBtn: string;
  simulatingBtn: string;

  // Capacity Lock Screen
  capacityLimitEnforced: string;
  capacityTitle: string;
  capacityDescription: string;
  capacitySeatsOccupied: string;
  currentlyActive: string;
  checkSeatBtn: string;
  checkingSeatBtn: string;
  autoRecheckIn: string;

  // Tour Guide
  tourStep: string;
  tourOf: string;
  tourPrev: string;
  tourNext: string;
  tourFinish: string;
  tourSkip: string;

  // Tour Steps Content
  tourStep1Title: string;
  tourStep1Desc: string;
  tourStep2Title: string;
  tourStep2Desc: string;
  tourStep3Title: string;
  tourStep3Desc: string;
  tourStep4Title: string;
  tourStep4Desc: string;
  tourStep5Title: string;
  tourStep5Desc: string;
  tourStep6Title: string;
  tourStep6Desc: string;
  tourStep7Title: string;
  tourStep7Desc: string;

  // History Page
  historyNav: string;
  spreadsheetNav: string;
  historyTitle: string;
  historySubtitle: string;
  historyBackBtn: string;
  historyClearBtn: string;
  historyTotalEvents: string;
  historyGoogleSheets: string;
  historyWebEdits: string;
  historyWebhooks: string;
  historySourceFilter: string;
  historyFilterAll: string;
  historyFilterSheets: string;
  historyFilterWeb: string;
  historyFilterWebhook: string;
  historySearchPlaceholder: string;
  historyLiveStream: string;
  historyShowing: string;
  historyNoEvents: string;
  historyNoEventsSession: string;
  historyNoFilterMatch: string;
  historyPayloadData: string;
  historyBadgeWeb: string;
  historyBadgeWebhook: string;
  historyBadgeSheets: string;
  historyBadgePoller: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    // Navigation
    brandTitle: 'Google Sheets Sync',
    brandSubtitle: 'Bi-Directional Spreadsheet Synchronization',
    liveSheet: 'Live Google Sheet',
    mockMode: 'Offline / Disconnected',
    connecting: 'Connecting...',
    connected: 'Connected',
    syncing: 'Syncing...',
    disconnected: 'Disconnected',
    forceSyncBtn: 'Force Sync',
    simulateBtn: 'Simulate Edit',
    architectureBtn: 'Architecture',
    takeTourBtn: 'Tour Guide',
    overviewBtn: 'Overview',
    sheetViewBtn: 'Spreadsheet',
    languageSelect: 'Language',

    // Collaborator Bar
    collaboratorYou: 'You',
    changeNickname: 'Edit your nickname',
    activeSeats: 'Active Seats',
    seatsOccupiedTooltip: 'Active Collaborators: {count} of {max} maximum allowed',
    activeCollaboratorTooltip: 'Active peer • {status}',
    viewingSheet: 'Viewing sheet',

    // Metrics Bar
    rowsSynced: 'Rows Synced',
    activeColumns: 'Active Columns',
    chunkWindow: 'Chunk Window',
    rowsPerPage: 'rows / page',
    lastSynced: 'Last Synchronized',
    justNow: 'Just now',

    // Data Table
    tableTitle: 'Synchronized Sheet Data',
    tableSubtitle: 'Dynamic columns & chunked pagination with live peer cursor tracking',
    searchPlaceholder: 'Search table rows...',
    addColumnBtn: 'Add Column',
    addRowBtn: 'Add Row',
    columnNamePlaceholder: 'Column header (e.g. Status, Notes)',
    saveColBtn: 'Create',
    rowIdHeader: 'Row',
    actionsHeader: 'Actions',
    editBtn: 'Edit',
    submitBtn: 'Submit',
    savingBtn: 'Saving...',
    cancelBtn: 'Cancel',
    deleteBtn: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this row?',
    noRowsFound: 'No rows on this page. Click "+ Add Row" or insert rows directly in your Google Sheet.',
    editingBy: 'Currently editing: ',
    pageOf: 'Page {page} of {total}',
    prevPage: 'Previous Page',
    nextPage: 'Next Page',
    pageSize: 'Page Size',

    // Activity Feed
    activityTitle: 'Audit & Synchronization Feed',
    activitySubtitle: 'Real-time trace of Webhook events, Poller checks, and user modifications',
    liveStreamBadge: 'Live Event Stream',
    noActivityYet: 'No synchronization events recorded yet. Perform an edit or simulate a change to see activity.',
    sourceWeb: 'Web App',
    sourceSheets: 'Google Sheets',
    sourceWebhook: 'Apps Script Webhook',
    sourcePoller: 'Background Poller',

    // Conflict Resolution Modal
    conflictTitle: 'Data Collision Detected (OCC 409)',
    conflictWarning: 'Simultaneous Modification Alert',
    conflictDescription: 'This row was modified in Google Sheets while you were editing it. Please choose how to resolve this difference:',
    localAttempted: 'Your Proposed Values (Website)',
    remoteSheet: 'Current Remote Sheet Values (Google Sheets)',
    keepMineBtn: 'Force Overwrite (Keep Mine)',
    acceptRemoteBtn: 'Accept Sheet Version',
    reviewMergeBtn: 'Review & Re-Edit',

    // Simulate Direct Sheet Edit Modal
    simulateTitle: 'Simulate Direct Google Sheet Edit',
    simulateSubtitle: 'Test real-time webhook ingestion & poller reconciliation without opening Google Sheets',
    simulateRowLabel: 'Target Row ID',
    simulateValuesLabel: 'Simulated Column Values',
    simulateExecuteBtn: 'Trigger Sheet Edit Event',
    simulatingBtn: 'Dispatched to Poller...',

    // Capacity Lock Screen
    capacityLimitEnforced: 'Capacity Limit Enforced',
    capacityTitle: 'Sheet Capacity Reached',
    capacityDescription: 'This synchronized sheet is capped at a strict maximum of 10 concurrent active collaborators to guarantee conflict-free real-time synchronization.',
    capacitySeatsOccupied: 'Active Seats Occupied',
    currentlyActive: 'Currently Active in Sheet',
    checkSeatBtn: 'Check For Available Seat',
    checkingSeatBtn: 'Checking for Open Seat...',
    autoRecheckIn: 'Automatically re-checking queue in',

    // Tour Guide
    tourStep: 'Step',
    tourOf: 'of',
    tourPrev: 'Previous',
    tourNext: 'Next',
    tourFinish: 'Got It! Let\'s Start',
    tourSkip: 'Skip Tour',

    // Tour Steps Content
    tourStep1Title: 'Real-Time SyncGrid Overview',
    tourStep1Desc: 'Welcome! This application keeps your web interface and Google Sheets continuously synchronized in real-time with sub-second latency.',
    tourStep2Title: 'Connection & Engine Status',
    tourStep2Desc: 'Monitors your live WebSocket link with the Node.js gateway and indicates your Google Sheets connection status.',
    tourStep3Title: 'Control Center & Developer Tools',
    tourStep3Desc: '• Force Sync: Manually pulls the latest Google Sheets data and updates the grid immediately.\n• History: Opens the live audit feed displaying all spreadsheet updates and synchronization events.\n• Tour Guide: Re-launches this interactive guided tour at any time.',
    tourStep4Title: 'Collaborators & 10-Seat Capacity',
    tourStep4Desc: '• Collaborators & Nickname: Every user receives a unique nickname, color, and icon (click the edit icon to change your nickname).\n• 10-Seat Capacity: Up to 10 users can collaborate simultaneously with automatic capacity enforcement.\n• Theme & Language: Toggle between Light and Dark mode, and switch the interface language between English and Hindi.',
    tourStep5Title: 'Live Metrics & Chunked Windows',
    tourStep5Desc: 'Displays total rows synced, dynamic column counts, and chunk pagination windows so large sheets never overwhelm browser memory.',
    tourStep6Title: 'Interactive Spreadsheet Grid',
    tourStep6Desc: 'Click or double-click any cell to edit directly inline or use the formula bar above. Navigate with arrow keys, and see live colored cursor badges and real-time typing indicators when teammates collaborate!',
    tourStep7Title: 'Audit & Synchronization History',
    tourStep7Desc: 'Click the "History" button in the top navigation bar at any time to open the complete live event stream, showing every edit, Google Sheets sync, and webhook trigger.',

    // History Page
    historyNav: 'History',
    spreadsheetNav: 'Spreadsheet',
    historyTitle: 'Audit & Synchronization Feed',
    historySubtitle: 'Real-time audit log of spreadsheet edits, background polling events, and bi-directional updates.',
    historyBackBtn: 'Back to Spreadsheet',
    historyClearBtn: 'Clear View',
    historyTotalEvents: 'Total Events',
    historyGoogleSheets: 'Google Sheets',
    historyWebEdits: 'Web Edits',
    historyWebhooks: 'Webhooks',
    historySourceFilter: 'Source:',
    historyFilterAll: 'All',
    historyFilterSheets: 'Google Sheets',
    historyFilterWeb: 'Web',
    historyFilterWebhook: 'Webhook',
    historySearchPlaceholder: 'Search events, row #, descriptions...',
    historyLiveStream: 'Live Event Stream',
    historyShowing: 'Showing {shown} of {total} entries',
    historyNoEvents: 'No audit events found',
    historyNoEventsSession: 'No synchronizations or edits have occurred in this session yet.',
    historyNoFilterMatch: 'No log entries match your current search or source filter.',
    historyPayloadData: 'Event Payload Data:',
    historyBadgeWeb: 'Web Client',
    historyBadgeWebhook: 'Apps Script Webhook',
    historyBadgeSheets: 'Google Sheets',
    historyBadgePoller: 'Poller Sync',
  },

  hi: {
    // Navigation
    brandTitle: 'गूगल शीट्स सिंक',
    brandSubtitle: 'द्विदिशीय स्प्रेडशीट सिंक्रोनाइज़ेशन',
    liveSheet: 'लाइव गूगल शीट',
    mockMode: 'डिस्कनेक्टेड मोड',
    connecting: 'कनेक्ट हो रहा है...',
    connected: 'कनेक्टेड',
    syncing: 'सिंक हो रहा है...',
    disconnected: 'डिस्कनेक्टेड',
    forceSyncBtn: 'मैन्युअल सिंक',
    simulateBtn: 'शीट एडिट सिमुलेट करें',
    architectureBtn: 'आर्किटेक्चर',
    takeTourBtn: 'गाइडेड टूर',
    overviewBtn: 'अवलोकन',
    sheetViewBtn: 'स्प्रेडशीट',
    languageSelect: 'भाषा',

    // Collaborator Bar
    collaboratorYou: 'आप',
    changeNickname: 'अपना उपनाम बदलें',
    activeSeats: 'सक्रिय सीटें',
    seatsOccupiedTooltip: 'सक्रिय सहयोगी: {count} / {max} अधिकतम स्वीकृत',
    activeCollaboratorTooltip: 'सक्रिय साथी • {status}',
    viewingSheet: 'शीट देख रहे हैं',

    // Metrics Bar
    rowsSynced: 'सिंक की गई पंक्तियाँ',
    activeColumns: 'सक्रिय कॉलम',
    chunkWindow: 'चंक विंडो',
    rowsPerPage: 'पंक्तियाँ / पृष्ठ',
    lastSynced: 'अंतिम सिंक्रोनाइज़ेशन',
    justNow: 'अभी-अभी',

    // Data Table
    tableTitle: 'सिंक्रोनाइज़्ड शीट डेटा',
    tableSubtitle: 'डायनामिक कॉलम, चंक पेजिनेशन और लाइव साथी कर्सर ट्रैकिंग',
    searchPlaceholder: 'तालिका में खोजें...',
    addColumnBtn: 'कॉलम जोड़ें',
    addRowBtn: 'पंक्ति जोड़ें',
    columnNamePlaceholder: 'कॉलम का नाम (उदा. स्थिति, टिप्पणियाँ)',
    saveColBtn: 'बनाएं',
    rowIdHeader: 'पंक्ति',
    actionsHeader: 'क्रियाएँ',
    editBtn: 'संपादित करें',
    submitBtn: 'सबमिट करें',
    savingBtn: 'सहेजा जा रहा है...',
    cancelBtn: 'रद्द करें',
    deleteBtn: 'हटाएं',
    deleteConfirm: 'क्या आप वाकई इस पंक्ति को हटाना चाहते हैं?',
    noRowsFound: 'इस पृष्ठ पर कोई पंक्ति नहीं है। "+ पंक्ति जोड़ें" पर क्लिक करें या सीधे गूगल शीट में दर्ज करें।',
    editingBy: 'वर्तमान में संपादनकर्ता: ',
    pageOf: 'पृष्ठ {page} / {total}',
    prevPage: 'पिछला पृष्ठ',
    nextPage: 'अगला पृष्ठ',
    pageSize: 'पृष्ठ आकार',

    // Activity Feed
    activityTitle: 'ऑडिट और सिंक्रोनाइज़ेशन फ़ीड',
    activitySubtitle: 'वेबहुक ईवेंट, पोलर चेक और उपयोगकर्ता परिवर्तनों का लाइव रिकॉर्ड',
    liveStreamBadge: 'लाइव ईवेंट स्ट्रीम',
    noActivityYet: 'अभी तक कोई सिंक्रोनाइज़ेशन गतिविधि दर्ज नहीं हुई है। गतिविधि देखने के लिए संपादन या सिमुलेशन करें।',
    sourceWeb: 'वेब एप्लिकेशन',
    sourceSheets: 'गूगल शीट्स',
    sourceWebhook: 'ऐप्स स्क्रिप्ट वेबहुक',
    sourcePoller: 'बैकग्राउंड पोलर',

    // Conflict Resolution Modal
    conflictTitle: 'डेटा टकराव पाया गया (OCC 409)',
    conflictWarning: 'एक साथ संशोधन चेतावनी',
    conflictDescription: 'जब आप संपादन कर रहे थे, उसी समय गूगल शीट में यह पंक्ति बदल दी गई। कृपया समाधान चुनें:',
    localAttempted: 'आपके प्रस्तावित मान (वेबसाइट)',
    remoteSheet: 'गूगल शीट के वर्तमान मान',
    keepMineBtn: 'मेरा मान रखें (ओवरराइट करें)',
    acceptRemoteBtn: 'गूगल शीट संस्करण स्वीकार करें',
    reviewMergeBtn: 'पुनरावलोकन और संपादित करें',

    // Simulate Direct Sheet Edit Modal
    simulateTitle: 'गूगल शीट में सीधा संपादन सिमुलेट करें',
    simulateSubtitle: 'गूगल शीट खोले बिना रीयल-टाइम वेबहुक और पोलर सिंक का परीक्षण करें',
    simulateRowLabel: 'लक्ष्य पंक्ति संख्या (Row ID)',
    simulateValuesLabel: 'सिमुलेट किए गए कॉलम मान',
    simulateExecuteBtn: 'शीट संपादन ईवेंट ट्रिगर करें',
    simulatingBtn: 'पोलर को भेजा गया...',

    // Capacity Lock Screen
    capacityLimitEnforced: 'क्षमता सीमा लागू',
    capacityTitle: 'शीट क्षमता पूरी हो गई है',
    capacityDescription: 'टकराव-मुक्त रीयल-टाइम सिंक्रोनाइज़ेशन सुनिश्चित करने के लिए यह शीट अधिकतम 10 सक्रिय उपयोगकर्ताओं तक सीमित है।',
    capacitySeatsOccupied: 'सक्रिय सीटें भरी हुई हैं',
    currentlyActive: 'शीट में वर्तमान में सक्रिय सहयोगी',
    checkSeatBtn: 'उपलब्ध सीट की जाँच करें',
    checkingSeatBtn: 'सीट की जाँच की जा रही है...',
    autoRecheckIn: 'कतार की स्वचालित पुनः जाँच होगी',

    // Tour Guide
    tourStep: 'चरण',
    tourOf: 'का',
    tourPrev: 'पिछला',
    tourNext: 'अगला',
    tourFinish: 'समझ गया! शुरू करें',
    tourSkip: 'टूर छोड़ें',

    // Tour Steps Content
    tourStep1Title: 'रीयल-टाइम सिंकग्रिड अवलोकन',
    tourStep1Desc: 'स्वागत है! यह एप्लिकेशन आपके वेब इंटरफ़ेस और गूगल शीट्स को बिना किसी देरी के वास्तविक समय में सिंक्रनाइज़ रखता है।',
    tourStep2Title: 'कनेक्शन और इंजन स्थिति',
    tourStep2Desc: 'यह नोड.जेएस गेटवे के साथ आपके लाइव वेबसॉकेट कनेक्शन की निगरानी करता है और दिखाता है कि आप लाइव गूगल शीट से जुड़े हैं या टेस्ट मोड में।',
    tourStep3Title: 'कंट्रोल सेंटर और डेवलपर टूल्स',
    tourStep3Desc: '• मैन्युअल सिंक: गूगल शीट्स से तुरंत नया डेटा ग्रिड में लोड करता है।\n• हिस्ट्री: सभी सिंक और एडिट इवेंट्स का लाइव ऑडिट लॉग खोलता है।\n• टूर गाइड: किसी भी समय इस इंटरैक्टिव गाइड को दोबारा शुरू करता है।',
    tourStep4Title: 'सहयोगी और 10-सीट क्षमता सीमा',
    tourStep4Desc: '• सहयोगी और उपनाम: प्रत्येक उपयोगकर्ता को एक अनूठा उपनाम, रंग और आइकन मिलता है (अपना उपनाम बदलने के लिए एडिट आइकन पर क्लिक करें)।\n• 10-सीट क्षमता: स्वचालित क्षमता सीमा के साथ अधिकतम 10 लोग एक साथ काम कर सकते हैं।\n• थीम और भाषा: लाइट और डार्क मोड के बीच टॉगल करें, और अंग्रेजी व हिंदी के बीच भाषा बदलें।',
    tourStep5Title: 'लाइव मेट्रिक्स और चंक विंडो',
    tourStep5Desc: 'यहाँ कुल सिंक की गई पंक्तियाँ, डायनामिक कॉलम और चंक पेजिनेशन दिखाई देते हैं ताकि बड़ी शीट्स से ब्राउज़र धीमा न हो।',
    tourStep6Title: 'इंटरैक्टिव स्प्रेडशीट ग्रिड',
    tourStep6Desc: 'किसी भी सेल पर क्लिक या डबल-क्लिक करके सीधे इनलाइन संपादित करें या ऊपर दिए गए फॉर्मूला बार का उपयोग करें। तीर कुंजियों से नेविगेट करें और जब साथी काम कर रहे हों तो उनके लाइव रंगीन कर्सर देखें!',
    tourStep7Title: 'ऑडिट और सिंक्रोनाइज़ेशन हिस्ट्री',
    tourStep7Desc: 'शीर्ष नेविगेशन बार में "हिस्ट्री" बटन पर क्लिक करके हर स्प्रेडशीट संपादन, गूगल शीट्स सिंक और वेबहुक इवेंट का पूरा लाइव स्ट्रीम देखें।',

    // History Page
    historyNav: 'हिस्ट्री',
    spreadsheetNav: 'स्प्रेडशीट',
    historyTitle: 'ऑडिट और सिंक्रोनाइज़ेशन हिस्ट्री',
    historySubtitle: 'स्प्रेडशीट संपादन, बैकग्राउंड पोलिंग और दोतरफा अपडेट का वास्तविक समय ऑडिट लॉग।',
    historyBackBtn: 'स्प्रेडशीट पर वापस जाएं',
    historyClearBtn: 'लॉग साफ़ करें',
    historyTotalEvents: 'कुल इवेंट्स',
    historyGoogleSheets: 'गूगल शीट्स',
    historyWebEdits: 'वेब संपादन',
    historyWebhooks: 'वेबहुक',
    historySourceFilter: 'स्रोत:',
    historyFilterAll: 'सभी',
    historyFilterSheets: 'गूगल शीट्स',
    historyFilterWeb: 'वेब',
    historyFilterWebhook: 'वेबहुक',
    historySearchPlaceholder: 'इवेंट्स, पंक्ति #, विवरण खोजें...',
    historyLiveStream: 'लाइव इवेंट स्ट्रीम',
    historyShowing: '{total} में से {shown} प्रविष्टियां दिखाई जा रही हैं',
    historyNoEvents: 'कोई ऑडिट इवेंट नहीं मिला',
    historyNoEventsSession: 'इस सत्र में अभी तक कोई सिंक या संपादन नहीं हुआ है।',
    historyNoFilterMatch: 'आपके वर्तमान खोज या फ़िल्टर से कोई लॉग प्रविष्टि मेल नहीं खाती।',
    historyPayloadData: 'इवेंट डेटा (पेलोड):',
    historyBadgeWeb: 'वेब क्लाइंट',
    historyBadgeWebhook: 'ऐप्स स्क्रिप्ट वेबहुक',
    historyBadgeSheets: 'गूगल शीट्स',
    historyBadgePoller: 'पोलर सिंक',
  },
};
