export const LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { code: "th", label: "Thai", nativeLabel: "ภาษาไทย" },
  { code: "my", label: "Burmese", nativeLabel: "မြန်မာဘာသာ" },
];

export const DEFAULT_LANG = "en";
export const LS_LANG_KEY = "pan_language";

const translations = {
  en: {
    app: { title: "Paan Counter" },
    nav: { pos: "POS", stock: "Stock", credit: "Credit Accounts", menu: "Menu" },
    pos: {
      todaySales: "Today's Sales", billsToday: "Bills Today", khataDue: "Khata Due", lowStock: "Low Stock",
      scanBarcode: "Scan Barcode", scanPlaceholder: "Scan barcode or type & press Enter...",
      items: "Items", reviewOrder: "Review Order", checkout: "Checkout",
      addToCart: "Add to Cart", cart: "Cart", clearCart: "Clear Cart",
      subtotal: "Subtotal", discount: "Discount", vat: "VAT", total: "TOTAL",
      cash: "Cash", promptpay: "PromptPay", bankTransfer: "Bank Transfer", udhaar: "Udhaar",
      paymentMode: "Payment Mode", cashReceived: "Cash Received", change: "Change",
      selectCustomer: "Select Customer", newCustomer: "New Customer",
      transactionComplete: "Transaction completed successfully!",
      notEnoughStock: "Not enough stock available for this selection.",
      exceedStock: "Cannot add more. Exceeds total available stock!",
      enterCash: "Received cash must be greater or equal to total.",
      selectUdhaar: "Please select a customer for Udhaar.",
      quickAdd10: "+10", quickAdd50: "+50", quickAdd100: "+100", quickAdd500: "+500",
    },
    inventory: {
      title: "Inventory Manager",
      stock: "Stock", purchaseOrders: "Purchase Orders",
      costValue: "Cost Value", salesValue: "Sales Value", estProfit: "Est. Profit",
      totalPurchaseCost: "Total purchase cost", ifAllSells: "If all stock sells",
      addProduct: "Add New Product", editProduct: "Edit Product",
      productName: "Product Name", category: "Category", barcode: "Barcode (optional)",
      costPrice: "Cost Price", sellingPrice: "Selling Price",
      currentStock: "Current Stock", lowStockLimit: "Low Stock Alert Limit (sticks/pcs)",
      linkVariants: "Link Single / Box product variants (Cigarette items)",
      packSize: "Pcs/Sticks per Box", boxCostPrice: "Box Cost Price", boxSellingPrice: "Box Selling Price",
      boxStock: "Current Boxes Stock", looseStock: "Current Loose Pcs Stock",
      updateProduct: "Update Product", addProductBtn: "Add Product", cancel: "Cancel",
      productStockStatus: "Product Stock Status", refresh: "Refresh",
      product: "Product", cost: "Cost", sell: "Sell", stock: "Stock", restock: "Restock", actions: "Actions",
      edit: "Edit", history: "History", delete: "Delete",
      saved: "Product saved successfully!", pleaseFill: "Please fill all pricing fields.",
      pleaseFillStock: "Please fill stock amount.", pleaseFillVariant: "Please fill all box/pack variant fields.",
    },
    credit: {
      title: "Credit Accounts", search: "Search customers...",
      outstanding: "Outstanding", noBalance: "No outstanding balance",
      ledger: "Ledger", settlePayment: "Settle Payment",
      paymentAmount: "Payment Amount", addNote: "Add note (optional)",
      settle: "Settle", settled: "Payment settled successfully!",
      paymentHistory: "Payment History", customer: "Customer",
      totalPurchases: "Total Purchases", visitAgain: "Visit again",
    },
    admin: {
      title: "Menu",
      reports: "Reports", expenses: "Expenses", users: "Users",
      cashOnHand: "Cash on Hand", settings: "Settings", errorLogs: "Error Logs",
    },
    reports: {
      overview: "Overview", products: "Products", customers: "Customers",
      hours: "Hours", staff: "Staff", bills: "Bills", settings: "Settings",
      totalSales: "Total Sales", totalProfit: "Total Profit", totalExpenses: "Total Expenses",
      totalDiscounts: "Total Discounts", daysRevenue: "7-Day Revenue vs Expenses",
      monthlyPnL: "Monthly P&L", cashFlow: "Cash Flow Summary",
      paymentModes: "Payment Modes",
    },
    common: {
      close: "Close", save: "Save", delete: "Delete", edit: "Edit",
      loading: "Loading...", noData: "No data available",
      confirm: "Are you sure?", yes: "Yes", no: "No", cancel: "Cancel",
      print: "Print / PDF", download: "Download",
      success: "Success", error: "Error",
    },
    shift: {
      title: "Shift Management", openShift: "Open New Shift", closeShift: "Close Shift",
      startingCash: "Starting Cash (฿)", actualCash: "Actual Cash Count (฿)",
      status: "Status", opened: "Opened", starting: "Starting Cash",
      expected: "Expected Cash", actual: "Actual Cash", difference: "Difference",
      openedSuccess: "Shift opened successfully!", closedSuccess: "Shift closed successfully!",
      noOpen: "No open shift", todayShifts: "Today's Shifts",
      open: "Open", closed: "Closed",
    },
    purchase: {
      title: "Purchase Orders", newOrder: "+ New Order", supplier: "Supplier",
      items: "Items", notes: "Notes (optional)", createOrder: "Create Order",
      receive: "Receive", cancel: "Cancel", pending: "⏳ Pending",
      received: "✓ Received", cancelled: "✕ Cancelled", noOrders: "No purchase orders yet.",
      addItem: "+ Add Item", selectProduct: "Select product...",
    },
    auth: {
      enterPin: "Enter your PIN", login: "Login", logout: "Log Out",
      invalidPin: "Invalid PIN. Try again.", maxAttempts: "Maximum attempts reached.",
    },
    coh: {
      title: "Cash on Hand", balance: "Balance", transfer: "Transfer",
      pendingApprovals: "Pending Approvals", history: "History",
      approve: "Approve", reject: "Reject",
    },
    return: {
      title: "Return Items", returnReason: "Return reason (optional)",
      refundTotal: "Refund Total", processReturn: "Process Return",
      selectItems: "Select at least one item to return.",
      processed: "Return processed! Refund amount:",
    },
    priceHistory: {
      title: "Price History", noChanges: "No price changes recorded yet.",
      current: "Current", cost: "Cost", by: "by",
    },
    lowStock: { title: "Low Stock Alert", count: "product(s) low on stock" },
  },

  hi: {
    app: { title: "पान काउंटर" },
    nav: { pos: "POS", stock: "स्टॉक", credit: "क्रेडिट खाते", menu: "मेनू" },
    pos: {
      todaySales: "आज की बिक्री", billsToday: "आज के बिल", khataDue: "बकाया खाता", lowStock: "कम स्टॉक",
      scanBarcode: "बारकोड स्कैन करें", scanPlaceholder: "बारकोड स्कैन करें या टाइप करें...",
      items: "आइटम", reviewOrder: "ऑर्डर देखें", checkout: "चेकआउट",
      addToCart: "कार्ट में जोड़ें", cart: "कार्ट", clearCart: "कार्ट खाली करें",
      subtotal: "उप-योग", discount: "छूट", vat: "वैट", total: "कुल",
      cash: "नकद", promptpay: "प्रॉम्प्टपे", bankTransfer: "बैंक ट्रांसफर", udhaar: "उधार",
      paymentMode: "भुगतान मोड", cashReceived: "प्राप्त नकद", change: "बाकी",
      selectCustomer: "ग्राहक चुनें", newCustomer: "नया ग्राहक",
      transactionComplete: "लेन-देन सफलतापूर्वक पूरा हुआ!",
      notEnoughStock: "इस चयन के लिए पर्याप्त स्टॉक नहीं है।",
      exceedStock: "और नहीं जोड़ सकते। कुल उपलब्ध स्टॉक से अधिक है!",
      enterCash: "प्राप्त नकद कुल राशि से अधिक या बराबर होनी चाहिए।",
      selectUdhaar: "कृपया उधार के लिए ग्राहक चुनें।",
      quickAdd10: "+१०", quickAdd50: "+५०", quickAdd100: "+१००", quickAdd500: "+५००",
    },
    inventory: {
      title: "इन्वेंटरी मैनेजर", stock: "स्टॉक", purchaseOrders: "खरीद ऑर्डर",
      costValue: "लागत मूल्य", salesValue: "बिक्री मूल्य", estProfit: "अनुमानित लाभ",
      totalPurchaseCost: "कुल खरीद लागत", ifAllSells: "यदि सारा स्टॉक बिके",
      addProduct: "नया उत्पाद जोड़ें", editProduct: "उत्पाद संपादित करें",
      productName: "उत्पाद का नाम", category: "श्रेणी", barcode: "बारकोड (वैकल्पिक)",
      costPrice: "लागत मूल्य (฿)", sellingPrice: "विक्रय मूल्य (฿)",
      currentStock: "वर्तमान स्टॉक", lowStockLimit: "कम स्टॉक सीमा",
      linkVariants: "सिंगल/बॉक्स वेरिएंट लिंक करें (सिगरेट)",
      packSize: "प्रति बॉक्स पीस", boxCostPrice: "बॉक्स लागत मूल्य", boxSellingPrice: "बॉक्स विक्रय मूल्य",
      boxStock: "बॉक्स स्टॉक", looseStock: "खुले पीस स्टॉक",
      updateProduct: "उत्पाद अपडेट करें", addProductBtn: "उत्पाद जोड़ें", cancel: "रद्द करें",
      productStockStatus: "उत्पाद स्टॉक स्थिति", refresh: "रिफ्रेश",
      product: "उत्पाद", cost: "लागत", sell: "बिक्री", stock: "स्टॉक", restock: "रीस्टॉक", actions: "कार्रवाई",
      edit: "संपादित", history: "इतिहास", delete: "हटाएं",
      saved: "उत्पाद सफलतापूर्वक सेव हुआ!", pleaseFill: "कृपया सभी मूल्य फील्ड भरें।",
      pleaseFillStock: "कृपया स्टॉक राशि भरें।", pleaseFillVariant: "कृपया सभी बॉक्स/पैक फील्ड भरें।",
    },
    credit: {
      title: "क्रेडिट खाते", search: "ग्राहक खोजें...",
      outstanding: "बकाया", noBalance: "कोई बकाया नहीं",
      ledger: "लेजर", settlePayment: "भुगतान निपटान",
      paymentAmount: "भुगतान राशि", addNote: "नोट जोड़ें (वैकल्पिक)",
      settle: "निपटान", settled: "भुगतान सफलतापूर्वक निपटाया गया!",
      paymentHistory: "भुगतान इतिहास", customer: "ग्राहक",
      totalPurchases: "कुल खरीद", visitAgain: "फिर आएं",
    },
    admin: {
      title: "मेनू", reports: "रिपोर्ट", expenses: "खर्च", users: "उपयोगकर्ता",
      cashOnHand: "नकद शेष", settings: "सेटिंग्स", errorLogs: "एरर लॉग",
    },
    reports: {
      overview: "अवलोकन", products: "उत्पाद", customers: "ग्राहक",
      hours: "घंटे", staff: "स्टाफ", bills: "बिल", settings: "सेटिंग्स",
      totalSales: "कुल बिक्री", totalProfit: "कुल लाभ", totalExpenses: "कुल खर्च",
      totalDiscounts: "कुल छूट", daysRevenue: "७ दिन का राजस्व बनाम खर्च",
      monthlyPnL: "मासिक लाभ-हानि", cashFlow: "नकद प्रवाह सारांश",
      paymentModes: "भुगतान मोड",
    },
    common: {
      close: "बंद करें", save: "सेव करें", delete: "हटाएं", edit: "संपादित करें",
      loading: "लोड हो रहा है...", noData: "कोई डेटा उपलब्ध नहीं",
      confirm: "क्या आपको यकीन है?", yes: "हाँ", no: "नहीं", cancel: "रद्द करें",
      print: "प्रिंट / PDF", download: "डाउनलोड",
      success: "सफल", error: "त्रुटि",
    },
    shift: {
      title: "शिफ्ट प्रबंधन", openShift: "नई शिफ्ट खोलें", closeShift: "शिफ्ट बंद करें",
      startingCash: "शुरुआती नकद (฿)", actualCash: "वास्तविक नकद गणना (฿)",
      status: "स्थिति", opened: "खोला गया", starting: "शुरुआती नकद",
      expected: "अपेक्षित नकद", actual: "वास्तविक", difference: "अंतर",
      openedSuccess: "शिफ्ट सफलतापूर्वक खोली गई!", closedSuccess: "शिफ्ट सफलतापूर्वक बंद हुई!",
      noOpen: "कोई खुली शिफ्ट नहीं", todayShifts: "आज की शिफ्टें",
      open: "खुला", closed: "बंद",
    },
    purchase: {
      title: "खरीद ऑर्डर", newOrder: "+ नया ऑर्डर", supplier: "आपूर्तिकर्ता",
      items: "आइटम", notes: "नोट (वैकल्पिक)", createOrder: "ऑर्डर बनाएं",
      receive: "प्राप्त करें", cancel: "रद्द करें", pending: "⏳ लंबित",
      received: "✓ प्राप्त", cancelled: "✕ रद्द", noOrders: "अभी तक कोई खरीद ऑर्डर नहीं।",
      addItem: "+ आइटम जोड़ें", selectProduct: "उत्पाद चुनें...",
    },
    auth: {
      enterPin: "अपना PIN दर्ज करें", login: "लॉगिन", logout: "लॉग आउट",
      invalidPin: "गलत PIN। पुनः प्रयास करें।", maxAttempts: "अधिकतम प्रयास समाप्त।",
    },
    coh: {
      title: "नकद शेष", balance: "शेष", transfer: "ट्रांसफर",
      pendingApprovals: "लंबित स्वीकृतियाँ", history: "इतिहास",
      approve: "स्वीकृत", reject: "अस्वीकृत",
    },
    return: {
      title: "वापसी आइटम", returnReason: "वापसी का कारण (वैकल्पिक)",
      refundTotal: "रिफंड कुल", processReturn: "वापसी प्रक्रिया करें",
      selectItems: "कम से कम एक आइटम चुनें।", processed: "वापसी संसाधित! रिफंड राशि:",
    },
    priceHistory: {
      title: "मूल्य इतिहास", noChanges: "अभी तक कोई मूल्य परिवर्तन दर्ज नहीं हुआ।",
      current: "वर्तमान", cost: "लागत", by: "द्वारा",
    },
    lowStock: { title: "कम स्टॉक अलर्ट", count: "उत्पादों में स्टॉक कम है" },
  },

  th: {
    app: { title: "พานเคาน์เตอร์" },
    nav: { pos: "POS", stock: "สต็อก", credit: "บัญชีเครดิต", menu: "เมนู" },
    pos: {
      todaySales: "ยอดขายวันนี้", billsToday: "บิลวันนี้", khataDue: "ยอดค้างชำระ", lowStock: "สต็อกน้อย",
      scanBarcode: "สแกนบาร์โค้ด", scanPlaceholder: "สแกนบาร์โค้ดหรือพิมพ์...",
      items: "รายการ", reviewOrder: "ตรวจสอบออเดอร์", checkout: "ชำระเงิน",
      addToCart: "เพิ่มในตะกร้า", cart: "ตะกร้า", clearCart: "ล้างตะกร้า",
      subtotal: "ยอดรวมก่อนหัก", discount: "ส่วนลด", vat: "VAT", total: "รวม",
      cash: "เงินสด", promptpay: "พร้อมเพย์", bankTransfer: "โอนธนาคาร", udhaar: "เครดิต",
      paymentMode: "วิธีการชำระเงิน", cashReceived: "รับเงินสด", change: "เงินทอน",
      selectCustomer: "เลือกลูกค้า", newCustomer: "ลูกค้าใหม่",
      transactionComplete: "ธุรกรรมสำเร็จแล้ว!",
      notEnoughStock: "สต็อกไม่เพียงพอสำหรับการเลือกนี้",
      exceedStock: "ไม่สามารถเพิ่มได้ เกินสต็อกที่มีอยู่!",
      enterCash: "เงินสดที่รับต้องมากกว่าหรือเท่ากับยอดรวม",
      selectUdhaar: "กรุณาเลือกลูกค้าสำหรับเครดิต",
      quickAdd10: "+๑๐", quickAdd50: "+๕๐", quickAdd100: "+๑๐๐", quickAdd500: "+๕๐๐",
    },
    inventory: {
      title: "จัดการสต็อก", stock: "สต็อก", purchaseOrders: "ใบสั่งซื้อ",
      costValue: "ต้นทุน", salesValue: "มูลค่าขาย", estProfit: "กำไรประมาณการ",
      addProduct: "เพิ่มสินค้าใหม่", editProduct: "แก้ไขสินค้า",
      productName: "ชื่อสินค้า", category: "หมวดหมู่", barcode: "บาร์โค้ด (ไม่บังคับ)",
      costPrice: "ราคาทุน (฿)", sellingPrice: "ราคาขาย (฿)",
      currentStock: "สต็อกปัจจุบัน", lowStockLimit: "ขีดจำกัดสต็อกน้อย",
      linkVariants: "เชื่อมโยงรูปแบบเดี่ยว/กล่อง (บุหรี่)",
      saved: "บันทึกสินค้าสำเร็จ!",
      edit: "แก้ไข", history: "ประวัติ", delete: "ลบ",
    },
    credit: {
      title: "บัญชีเครดิต", search: "ค้นหาลูกค้า...",
      outstanding: "ยอดค้างชำระ", settle: "ชำระ",
    },
    admin: {
      title: "เมนู", reports: "รายงาน", expenses: "ค่าใช้จ่าย", users: "ผู้ใช้",
      cashOnHand: "เงินสดในมือ", settings: "ตั้งค่า", errorLogs: "บันทึกข้อผิดพลาด",
    },
    reports: {
      overview: "ภาพรวม", products: "สินค้า", customers: "ลูกค้า",
      hours: "ชั่วโมง", staff: "พนักงาน", bills: "บิล", settings: "ตั้งค่า",
      totalSales: "ยอดขายรวม", totalProfit: "กำไรรวม",
    },
    common: {
      close: "ปิด", save: "บันทึก", delete: "ลบ", edit: "แก้ไข",
      loading: "กำลังโหลด...", noData: "ไม่มีข้อมูล",
      confirm: "คุณแน่ใจหรือ?", yes: "ใช่", no: "ไม่ใช่", cancel: "ยกเลิก",
      print: "พิมพ์ / PDF",
      success: "สำเร็จ", error: "ข้อผิดพลาด",
    },
    shift: {
      title: "จัดการกะ", openShift: "เปิดกะใหม่", closeShift: "ปิดกะ",
      startingCash: "เงินสดเริ่มต้น (฿)", actualCash: "นับเงินสดจริง (฿)",
      openedSuccess: "เปิดกะสำเร็จ!", closedSuccess: "ปิดกะสำเร็จ!",
    },
    purchase: {
      title: "ใบสั่งซื้อ", newOrder: "+ ใบสั่งใหม่", supplier: "ผู้จำหน่าย",
      createOrder: "สร้างใบสั่งซื้อ", noOrders: "ยังไม่มีใบสั่งซื้อ",
    },
    auth: { enterPin: "ใส่ PIN ของคุณ", login: "เข้าสู่ระบบ", logout: "ออกจากระบบ" },
    return: { title: "คืนสินค้า", refundTotal: "ยอดคืนเงิน", processReturn: "ดำเนินการคืน" },
  },

  my: {
    app: { title: "ပန်ကောင်တာ" },
    nav: { pos: "POS", stock: "စတော့", credit: "အကြွေးအကောင့်များ", menu: "မီနူး" },
    pos: {
      todaySales: "ယနေ့ရောင်းရငွေ", billsToday: "ယနေ့ဘေလ်များ", khataDue: "အကြွေးကျန်", lowStock: "စတော့နည်း",
      scanBarcode: "ဘားကုဒ်စကင်ဖတ်ရန်", scanPlaceholder: "ဘားကုဒ်စကင်ဖတ်ပါ သို့မဟုတ် ရိုက်ထည့်ပါ...",
      items: "ပစ္စည်းများ", reviewOrder: "အော်ဒါစစ်ဆေးရန်", checkout: "ငွေရှင်းရန်",
      cash: "ငွေသား", promptpay: "PromptPay", bankTransfer: "ဘဏ်လွှဲ", udhaar: "အကြွေး",
      subtotal: "စုစုပေါင်းခံ", discount: "လျှော့စျေး", vat: "VAT", total: "စုစုပေါင်း",
      transactionComplete: "ငွေပေးငွေယူအောင်မြင်ပါသည်!",
    },
    inventory: {
      title: "စတော့စီမံခန့်ခွဲမှု", stock: "စတော့", purchaseOrders: "ဝယ်ယူမှုမှာယူချက်များ",
      costValue: "ကုန်ကျစရိတ်", salesValue: "ရောင်းဈေး", estProfit: "ခန့်မှန်းအမြတ်",
      addProduct: "ထုတ်ကုန်အသစ်ထည့်ရန်", editProduct: "ထုတ်ကုန်ပြင်ဆင်ရန်",
      productName: "ထုတ်ကုန်အမည်", category: "အမျိုးအစား",
      saved: "ထုတ်ကုန်သိမ်းဆည်းပြီးပါပြီ!",
      edit: "ပြင်ဆင်", history: "မှတ်တမ်း", delete: "ဖျက်ရန်",
    },
    credit: {
      title: "အကြွေးအကောင့်များ", search: "ဖောက်သည်ရှာရန်...",
      outstanding: "ကျန်ငွေ", settle: "ပေးချေရန်",
    },
    admin: {
      title: "မီနူး", reports: "အစီရင်ခံစာများ", expenses: "ကုန်ကျစရိတ်များ", users: "အသုံးပြုသူများ",
      cashOnHand: "လက်ထဲငွေ", settings: "ဆက်တင်များ", errorLogs: "အမှားမှတ်တမ်းများ",
    },
    reports: {
      overview: "ခြုံငုံသုံးသပ်ချက်", products: "ထုတ်ကုန်များ", customers: "ဖောက်သည်များ",
      hours: "နာရီများ", staff: "ဝန်ထမ်းများ", bills: "ဘေလ်များ", settings: "ဆက်တင်များ",
      totalSales: "စုစုပေါင်းရောင်းရငွေ",
    },
    common: {
      close: "ပိတ်ရန်", save: "သိမ်းရန်", delete: "ဖျက်ရန်", edit: "ပြင်ဆင်ရန်",
      loading: "ဖွင့်နေသည်...", noData: "ဒေတာမရှိပါ",
      confirm: "သေချာပါသလား?", yes: "ဟုတ်", no: "မဟုတ်", cancel: "ပယ်ဖျက်",
      print: "ပုံနှိပ် / PDF",
      success: "အောင်မြင်", error: "အမှား",
    },
    shift: {
      title: "အဆိုင်းစီမံခန့်ခွဲမှု", openShift: "အဆိုင်းအသစ်ဖွင့်ရန်", closeShift: "အဆိုင်းပိတ်ရန်",
      startingCash: "အစငွေ (฿)", actualCash: "ငွေအရေအတွက်အမှန် (฿)",
    },
    purchase: {
      title: "ဝယ်ယူမှုမှာယူချက်များ", newOrder: "+ မှာယူချက်အသစ်", supplier: "ပေးသွင်းသူ",
      noOrders: "ဝယ်ယူမှုမှာယူချက်မရှိသေးပါ။",
    },
    auth: { enterPin: "သင့် PIN ထည့်ပါ", login: "ဝင်ရန်", logout: "ထွက်ရန်" },
    return: { title: "ပစ္စည်းပြန်အမ်းရန်", refundTotal: "ငွေပြန်အမ်းစုစုပေါင်း", processReturn: "ပြန်အမ်းခြင်းလုပ်ဆောင်ရန်" },
  },
};

export default translations;

export function t(key, lang = "en") {
  const keys = key.split(".");
  let val = translations[lang];
  for (const k of keys) {
    if (val && val[k] !== undefined) val = val[k];
    else return key;
  }
  return val;
}

export function useT(lang) {
  return (key) => t(key, lang);
}
