const assets = {
  logo: "assets/favicon.jpeg",
  cover: "assets/cover.png",
  farmer: "assets/farmer-onboarding.png",
  supporter: "assets/supporter.png",
  trust: "assets/trust.png",
  adoption: "assets/adoption-process.png",
  admin: "assets/admin.png",
  revenue: "assets/revenue.png",
};

const programConfig = {
  adoptionAmount: 5000,
};

const supabaseConfig = {
  url: "https://kbrpjigxqchldjnjyuem.supabase.co",
  publishableKey: "sb_publishable_MS2gZ9VOqi5Vs2-KfXpH3g_Mc8uKc9i",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticnBqaWd4cWNobGRqbmp5dWVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzOTUyMzAsImV4cCI6MjA5ODk3MTIzMH0.fp2yqR1Ba0YFxT8WWDzXA92FrGoi7f1EeuwxToo9VVg",
  projectRef: "kbrpjigxqchldjnjyuem",
};

const supabaseBridge = {
  client: null,
  status: "loading",
  dataSource: "Connecting",
  lastSync: "",
  message: "Connecting to secure MyOrchard records.",
  authMessage: "",
  init() {
    const supabaseGlobal = typeof supabase !== "undefined" ? supabase : null;
    const supabaseFactory = window.supabase?.createClient || globalThis.supabase?.createClient || supabaseGlobal?.createClient;
    if (!supabaseFactory) return;

    this.client = supabaseFactory(supabaseConfig.url, supabaseConfig.publishableKey || supabaseConfig.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    this.status = "connected";
    this.dataSource = "Supabase ready";
    this.message = "Reading verified orchard records from Supabase.";
  },
  async loadSession() {
    if (!this.client) return;
    try {
      const { data, error } = await this.client.auth.getSession();
      if (error) throw error;
      if (data?.session) await applyAuthSession(data.session, { silent: true });
      this.client.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_OUT") {
          clearSession();
          render();
          return;
        }
        if (session && ["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) {
          await applyAuthSession(session, { silent: true });
          render();
        }
      });
    } catch (error) {
      this.authMessage = error.message || "Could not restore session.";
    }
  },
  async sync() {
    if (!this.client) return false;

    const [orchardRows, verificationRows, updateRows, adoptionRows, settingsRows] = await Promise.all([
      this.readTable("orchards"),
      this.readTable("verifications"),
      this.readTable("farmer_updates"),
      this.readTable("adoptions"),
      this.readTable("program_settings"),
    ]);

    let loaded = false;

    const liveOrchardRows = orchardRows?.filter((row) => !seedRecordIds.has(String(firstValue(row, ["slug", "id", "orchard_id"], "")).toLowerCase())) || [];
    const liveVerificationRows =
      verificationRows?.filter((row) => {
        const id = String(firstValue(row, ["slug", "farm_slug", "orchard_id"], "")).toLowerCase();
        const farm = String(firstValue(row, ["farm", "farm_name", "orchard_name"], "")).toLowerCase();
        return !seedRecordIds.has(id) && !seedFarmNames.has(farm);
      }) || [];

    if (liveOrchardRows.length) {
      orchards.splice(0, orchards.length, ...liveOrchardRows.map(mapSupabaseOrchard));
      loaded = true;
    }

    if (liveVerificationRows.length) {
      state.verifications = liveVerificationRows.map(mapSupabaseVerification);
      loaded = true;
    }

    if (updateRows?.length && liveOrchardRows.length) {
      state.farmerUpdates = updateRows.map(mapSupabaseUpdate);
      loaded = true;
    }

    if (adoptionRows?.length) {
      state.adoptions = adoptionRows.map(mapSupabaseAdoption);
      loaded = true;
    }

    if (settingsRows?.length) {
      applyProgramSettings(settingsRows[0]);
    }

    this.lastSync = new Date().toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (loaded) {
      this.status = "live";
      this.dataSource = "Supabase live data";
      this.message = "Live Supabase rows are powering this interface.";
    } else {
      this.status = "empty";
      this.dataSource = "No published rows";
      this.message = "Supabase is connected, but no orchard records are published yet.";
    }

    return loaded;
  },
  async readTable(table) {
    try {
      const { data, error } = await this.client.from(table).select("*").limit(50);
      if (error || !Array.isArray(data)) return null;
      return data;
    } catch {
      return null;
    }
  },
  async signOut() {
    if (!this.client) return;
    await this.client.auth.signOut();
  },
};

window.MyOrchardSupabase = supabaseBridge;

const districts = ["Sindhudurg", "Ratnagiri", "Kolhapur"];

const fallbackImages = [assets.trust, assets.supporter, assets.farmer, assets.revenue];
const seedRecordIds = new Set(["patil", "kadam", "naik"]);
const seedFarmNames = new Set(["patil cashew farm", "kadam orchard", "naik cashew farm"]);

let orchards = [];

const nav = {
  farmer: [
    ["dashboard", "Dashboard", "layout-dashboard"],
    ["onboarding", "Orchard", "clipboard-check"],
    ["updates", "Updates", "camera"],
    ["profile", "Profile", "user"],
  ],
  supporter: [
    ["home", "Home", "home"],
    ["orchards", "Orchards", "tree-pine"],
    ["adoption", "My Adoption", "badge-check"],
    ["updates", "Updates", "bell"],
    ["profile", "Profile", "user"],
  ],
  admin: [
    ["dashboard", "Dashboard", "layout-dashboard"],
    ["farmers", "Farmers", "users"],
    ["orchards", "Orchards", "tree-pine"],
    ["verifications", "Verify", "shield-check"],
    ["payments", "Payments", "wallet"],
    ["reports", "Reports", "bar-chart-3"],
    ["settings", "Settings", "settings"],
  ],
};

const state = {
  role: null,
  session: null,
  lang: localStorage.getItem("myorchard_language") || "en",
  authMode: "signin",
  authRole: "supporter",
  authEmail: "",
  authPassword: "",
  authName: "",
  authMessage: "",
  authBusy: false,
  adminEmails: [
    "admin@myorchard.app",
    "admin@kalpavrikshaagro.com",
    "team@kalpavrikshaagro.com",
    "raashifshaikh70@gmail.com",
  ],
  farmerTab: "onboarding",
  supporterTab: "home",
  adminTab: "dashboard",
  farmerStep: 0,
  farmerSubmitted: false,
  toast: "",
  selectedFarmId: "",
  orchardSearch: "",
  districtFilter: "All",
  treeCount: 1,
  paymentMethod: "UPI",
  adoptionComplete: false,
  adoptionRecord: null,
  updateDraft: "",
  updateTitle: "",
  updatePhotos: [],
  profileEditMode: false,
  settingsDraft: {
    adoptionAmount: "5000",
    cropFocus: "Cashew",
    verificationRequirement: "KYC, location, tree count",
    updateFrequency: "Monthly",
    launchDistricts: "Sindhudurg, Ratnagiri, Kolhapur",
  },
  paymentForm: {
    supporterName: "",
    mobile: "",
  },
  supporterProfile: {
    name: "Supporter",
    handle: "@myorchard",
    mobile: "Add mobile number",
    email: "Add email",
    location: "Add location",
    bio: "Complete your profile to keep certificates, adopted trees, and farm updates in one place.",
  },
  supporterProfileDraft: {
    name: "",
    mobile: "",
    location: "",
    bio: "",
  },
  farmerProfile: {
    handle: "@yourorchard",
    location: "Add village and district",
    bio: "Complete onboarding to build a verified public profile for supporters.",
  },
  farmerForm: {
    fullName: "",
    mobile: "",
    aadhaar: "",
    district: "Sindhudurg",
    village: "",
    orchardName: "",
    acres: "",
    totalTrees: "",
    crop: "Cashew",
    ownership: "Owned",
    bank: "",
    account: "",
  },
  farmerUpdates: [],
  verifications: [],
  adoptions: [],
};

const app = document.querySelector("#app");

function icon(name) {
  return `<i data-lucide="${name}" class="icon"></i>`;
}

function money(value) {
  return `Rs. ${Number(value).toLocaleString("en-IN")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function isAdminEmail(value) {
  return state.adminEmails.includes(normalizeEmail(value));
}

function hasAdminAccess() {
  return state.role === "admin" && state.session?.role === "admin" && isAdminEmail(state.session.email);
}

function roleLabel(role) {
  if (role === "farmer") return "Farmer";
  if (role === "supporter") return "Supporter";
  return "Team";
}

const mrText = {
  "Connecting people with orchards": "बागांशी लोकांना जोडणारे",
  "MyOrchard app": "मायऑर्चर्ड अॅप",
  "A verified orchard network where farmers publish trusted farm profiles and supporters follow real tree progress.":
    "शेतकरी विश्वसनीय बाग प्रोफाइल प्रकाशित करतात आणि समर्थक झाडांची खरी प्रगती पाहतात असे सत्यापित बाग नेटवर्क.",
  "Verified farms": "सत्यापित शेती",
  "Live updates": "थेट अपडेट्स",
  "3 districts": "३ जिल्हे",
  "Farmer": "शेतकरी",
  "Supporter": "समर्थक",
  "Secure account access": "सुरक्षित खाते प्रवेश",
  "Sign in to continue": "पुढे जाण्यासाठी साइन इन करा",
  "Create your MyOrchard account": "तुमचे मायऑर्चर्ड खाते तयार करा",
  "Sign in": "साइन इन",
  "Sign up": "साइन अप",
  "Email address": "ईमेल पत्ता",
  "Password": "पासवर्ड",
  "Full name": "पूर्ण नाव",
  "Continue as Supporter": "समर्थक म्हणून पुढे जा",
  "Continue as Farmer": "शेतकरी म्हणून पुढे जा",
  "Create Supporter account": "समर्थक खाते तयार करा",
  "Create Farmer account": "शेतकरी खाते तयार करा",
  "Sign out": "साइन आउट",
  "Dashboard": "डॅशबोर्ड",
  "Orchard": "बाग",
  "Updates": "अपडेट्स",
  "Profile": "प्रोफाइल",
  "Home": "होम",
  "Orchards": "बागा",
  "My Adoption": "माझे दत्तक",
  "Farmers": "शेतकरी",
  "Verify": "तपासणी",
  "Payments": "पेमेंट्स",
  "Reports": "अहवाल",
  "Settings": "सेटिंग्ज",
  "Farmer onboarding": "शेतकरी नोंदणी",
  "Basic information": "मूलभूत माहिती",
  "Mobile number": "मोबाइल नंबर",
  "District": "जिल्हा",
  "Village": "गाव",
  "Next": "पुढे",
  "Back": "मागे",
  "Submit for verification": "तपासणीसाठी सबमिट करा",
  "Farm updates": "शेती अपडेट्स",
  "New field update": "नवीन शेत अपडेट",
  "Update title": "अपडेट शीर्षक",
  "Update details": "अपडेट तपशील",
  "Add photos": "फोटो जोडा",
  "Publish update": "अपडेट प्रकाशित करा",
  "Edit": "संपादित करा",
  "Post update": "अपडेट पोस्ट करा",
  "Welcome": "स्वागत आहे",
  "Find orchards": "बागा शोधा",
  "Recommended orchards": "शिफारस केलेल्या बागा",
  "View all": "सर्व पहा",
  "Search verified farms and choose trees available for adoption.": "सत्यापित शेत शोधा आणि दत्तकासाठी उपलब्ध झाडे निवडा.",
  "Reset": "रीसेट",
  "No orchards published yet": "अजून कोणतीही बाग प्रकाशित नाही",
  "Adopt a tree": "झाड दत्तक घ्या",
  "Browse orchards": "बागा पाहा",
  "No farm selected": "शेत निवडलेले नाही",
  "Payment": "पेमेंट",
  "Supporter name": "समर्थकाचे नाव",
  "Adoption summary": "दत्तक सारांश",
  "Adoption complete": "दत्तक पूर्ण",
  "Download certificate": "प्रमाणपत्र डाउनलोड करा",
  "Contact": "संपर्क",
  "Adoption history": "दत्तक इतिहास",
  "Saved farms": "जतन केलेली शेते",
  "Dashboard overview": "डॅशबोर्ड आढावा",
  "Verification queue": "तपासणी यादी",
  "Approve": "मंजूर करा",
  "Review": "पुनरावलोकन",
  "Farm verification": "शेती तपासणी",
  "Export": "निर्यात",
  "Export CSV": "CSV निर्यात",
  "Save settings": "सेटिंग्ज जतन करा",
  "Data connection": "डेटा कनेक्शन",
  "No pending verifications.": "प्रलंबित तपासणी नाही.",
};

const mrPlaceholders = {
  "you@example.com": "tumhi@example.com",
  "Minimum 8 characters": "किमान ८ अक्षरे",
  "Your full name": "तुमचे पूर्ण नाव",
  "Search by farm, farmer, or district": "शेत, शेतकरी किंवा जिल्हा शोधा",
  "Enter supporter name": "समर्थकाचे नाव लिहा",
  "Enter mobile number": "मोबाइल नंबर लिहा",
  "Example: Flowering stage completed": "उदा: फुलोरा टप्पा पूर्ण झाला",
  "Write what changed in the orchard this month": "या महिन्यात बागेत काय बदलले ते लिहा",
};

function setLanguage(lang, persist = true) {
  state.lang = lang === "mr" ? "mr" : "en";
  if (persist) localStorage.setItem("myorchard_language", state.lang);
}

function translateTextValue(value) {
  if (state.lang !== "mr") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  const translated = mrText[trimmed];
  if (!translated) return value;
  return value.replace(trimmed, translated);
}

function applyLanguageToDom() {
  if (state.lang !== "mr") return;
  const walker = document.createTreeWalker(app, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    node.nodeValue = translateTextValue(node.nodeValue);
  });
  app.querySelectorAll("input[placeholder], textarea[placeholder]").forEach((input) => {
    const translated = mrPlaceholders[input.getAttribute("placeholder")];
    if (translated) input.setAttribute("placeholder", translated);
  });
}

function currentUserId() {
  return state.session?.userId || "";
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function monthKey(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 7);
  return date.toISOString().slice(0, 7);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function clearSession() {
  state.role = null;
  state.session = null;
  state.authPassword = "";
  state.profileEditMode = false;
}

function authFailureMessage(error) {
  const message = String(error?.message || error || "Authentication failed.");
  if (/invalid login credentials/i.test(message)) return "Email or password is incorrect.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email before signing in.";
  if (/user already registered/i.test(message)) return "This email is already registered. Use Sign in.";
  return message;
}

async function readAdminAccess(email) {
  if (!supabaseBridge.client || !email) return false;
  const { data, error } = await supabaseBridge.client
    .from("app_admins")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  if (error) return isAdminEmail(email);
  return Boolean(data?.email);
}

async function upsertUserProfile({ session, role, fullName, language = state.lang }) {
  if (!supabaseBridge.client || !session?.user) return null;
  const email = normalizeEmail(session.user.email);
  const fallbackName = fullName || session.user.user_metadata?.full_name || roleLabel(role);
  const payload = {
    user_id: session.user.id,
    email,
    full_name: fallbackName,
    role,
    preferred_language: language,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseBridge.client
    .from("user_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .maybeSingle();
  if (error) return null;
  return data;
}

function applyProfileToState(profile, role) {
  if (!profile) return;
  if (profile.preferred_language) setLanguage(profile.preferred_language, false);

  if (role === "supporter") {
    state.supporterProfile.name = profile.full_name || state.supporterProfile.name;
    state.supporterProfile.email = profile.email || state.supporterProfile.email;
    state.supporterProfile.mobile = profile.mobile || state.supporterProfile.mobile;
    state.supporterProfile.location = profile.location || state.supporterProfile.location;
    state.supporterProfile.bio = profile.bio || state.supporterProfile.bio;
  }

  if (role === "farmer") {
    state.farmerForm.fullName = state.farmerForm.fullName || profile.full_name || "";
    state.farmerForm.mobile = state.farmerForm.mobile || profile.mobile || "";
  }
}

async function applyAuthSession(session, options = {}) {
  if (!session?.user) return;
  const email = normalizeEmail(session.user.email);
  const admin = await readAdminAccess(email);
  const requestedRole = session.user.user_metadata?.role;
  const role = admin ? "admin" : ["farmer", "supporter"].includes(requestedRole) ? requestedRole : state.authRole;
  const fullName = session.user.user_metadata?.full_name || state.authName.trim() || roleLabel(role);
  const profile = await upsertUserProfile({ session, role, fullName });

  state.session = {
    userId: session.user.id,
    email,
    name: profile?.full_name || fullName,
    role,
  };
  state.role = role;
  state.authPassword = "";
  state.authMessage = "";
  applyProfileToState(profile, role);

  if (role === "admin") state.adminTab = "dashboard";
  if (role === "farmer") state.farmerTab = state.farmerSubmitted ? "dashboard" : "onboarding";
  if (role === "supporter") state.supporterTab = "home";

  if (!options.silent) state.toast = role === "admin" ? "Management access unlocked" : `Welcome, ${state.session.name}`;
}

function firstValue(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function numberValue(row, keys, fallback = 0) {
  const value = Number(firstValue(row, keys, fallback));
  return Number.isFinite(value) ? value : fallback;
}

function mapSupabaseOrchard(row, index) {
  const totalTrees = numberValue(row, ["total_trees", "totalTrees", "trees"], 0);
  const adopted = numberValue(row, ["adopted", "adopted_trees", "adoptedTrees"], 0);
  const available = numberValue(row, ["available", "available_trees", "availableTrees"], Math.max(totalTrees - adopted, 0));

  return {
    id: String(firstValue(row, ["slug", "id", "orchard_id"], `farm-${index + 1}`)),
    name: String(firstValue(row, ["name", "orchard_name", "farm"], "Verified Orchard")),
    farmer: String(firstValue(row, ["farmer", "farmer_name", "owner_name"], "Registered Farmer")),
    district: String(firstValue(row, ["district"], "Sindhudurg")),
    village: String(firstValue(row, ["village"], "Konkan")),
    state: String(firstValue(row, ["state"], "Maharashtra")),
    acres: String(firstValue(row, ["acres", "land_acres"], "1.0")),
    totalTrees,
    adopted,
    available,
    rating: String(firstValue(row, ["rating"], "4.7")),
    income: numberValue(row, ["income", "farmer_income"], 0),
    image: String(firstValue(row, ["image", "image_url", "photo_url"], fallbackImages[index % fallbackImages.length])),
    coordinates: String(firstValue(row, ["coordinates", "geo", "lat_lng"], "15.9042 N, 73.8216 E")),
    summary: String(firstValue(row, ["summary", "description"], "A verified orchard connected through the MyOrchard program.")),
  };
}

function mapSupabaseVerification(row, index) {
  return {
    id: String(firstValue(row, ["id", "verification_id"], `v-${index + 1}`)),
    userId: String(firstValue(row, ["user_id"], "")),
    farmer: String(firstValue(row, ["farmer", "farmer_name"], "Registered Farmer")),
    farm: String(firstValue(row, ["farm", "farm_name", "orchard_name"], "Verified Orchard")),
    district: String(firstValue(row, ["district"], "Sindhudurg")),
    village: String(firstValue(row, ["village"], "")),
    acres: String(firstValue(row, ["acres"], "0")),
    crop: String(firstValue(row, ["crop"], "Cashew")),
    mobile: String(firstValue(row, ["mobile"], "")),
    bank: String(firstValue(row, ["bank_name", "bank"], "")),
    account: String(firstValue(row, ["account_number", "account"], "")),
    status: String(firstValue(row, ["status", "verification_status"], "Pending")),
    trees: numberValue(row, ["trees", "total_trees", "totalTrees"], 0),
    createdAt: String(firstValue(row, ["created_at"], "")),
  };
}

function mapSupabaseUpdate(row) {
  return {
    title: String(firstValue(row, ["title"], "Farm progress update")),
    date: new Date(firstValue(row, ["date", "created_at", "updated_at"], new Date().toISOString())).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    body: String(firstValue(row, ["body", "note", "description"], "New orchard update from the farmer.")),
    photos: Array.isArray(row?.photo_names) ? row.photo_names : [],
  };
}

function mapSupabaseAdoption(row) {
  return {
    id: String(firstValue(row, ["id"], "")),
    supporterName: String(firstValue(row, ["supporter_name"], "")),
    orchardSlug: String(firstValue(row, ["orchard_slug"], "")),
    treeCount: numberValue(row, ["tree_count"], 1),
    totalAmount: numberValue(row, ["total_amount"], 0),
    paymentMethod: String(firstValue(row, ["payment_method"], "")),
    status: String(firstValue(row, ["payment_status"], "Paid")),
    certificateId: String(firstValue(row, ["certificate_id"], "")),
    createdAt: String(firstValue(row, ["created_at"], "")),
    month: monthKey(firstValue(row, ["created_at"], "")),
  };
}

function applyProgramSettings(row) {
  if (!row) return;
  programConfig.adoptionAmount = numberValue(row, ["adoption_amount"], programConfig.adoptionAmount);
  state.settingsDraft = {
    adoptionAmount: String(programConfig.adoptionAmount),
    cropFocus: String(firstValue(row, ["crop_focus"], state.settingsDraft.cropFocus)),
    verificationRequirement: String(firstValue(row, ["verification_requirement"], state.settingsDraft.verificationRequirement)),
    updateFrequency: String(firstValue(row, ["update_frequency"], state.settingsDraft.updateFrequency)),
    launchDistricts: String(firstValue(row, ["launch_districts"], state.settingsDraft.launchDistricts)),
  };
}

function selectedFarm() {
  return orchards.find((farm) => farm.id === state.selectedFarmId) || orchards[0] || null;
}

function orchardTotals() {
  return orchards.reduce(
    (totals, farm) => {
      totals.trees += Number(farm.totalTrees) || 0;
      totals.adopted += Number(farm.adopted) || 0;
      totals.available += Number(farm.available) || 0;
      totals.income += Number(farm.income) || 0;
      return totals;
    },
    { trees: 0, adopted: 0, available: 0, income: 0 },
  );
}

function farmerTotalTrees() {
  return Number(state.farmerForm.totalTrees) || 0;
}

function farmerDisplayName() {
  return state.farmerForm.fullName.trim() || "farmer";
}

function farmerOrchardName() {
  return state.farmerForm.orchardName.trim() || "Your orchard";
}

function supporterDisplayName() {
  return state.supporterProfile.name.trim() && state.supporterProfile.name !== "Supporter" ? state.supporterProfile.name : "MyOrchard supporter";
}

function renderEmptyState(title, body, iconName = "leaf") {
  return `<div class="empty-state">${icon(iconName)}<h2>${title}</h2><p class="muted">${body}</p></div>`;
}

function farmerSubmissionReady() {
  return ["fullName", "mobile", "village", "orchardName", "acres", "totalTrees", "bank", "account"].every((field) =>
    String(state.farmerForm[field] || "").trim(),
  );
}

async function upsertFarmerVerification() {
  if (!farmerSubmissionReady()) return { ok: false, message: "Complete farmer, orchard, tree, and bank details before submitting." };
  if (!supabaseBridge.client || !currentUserId()) return { ok: false, message: "Sign in with a farmer account before submitting." };

  const payload = {
    user_id: currentUserId(),
    farmer_name: state.farmerForm.fullName.trim(),
    farm_name: state.farmerForm.orchardName.trim(),
    district: state.farmerForm.district,
    village: state.farmerForm.village.trim(),
    acres: Number(state.farmerForm.acres) || 0,
    crop: state.farmerForm.crop,
    mobile: state.farmerForm.mobile.trim(),
    bank_name: state.farmerForm.bank.trim(),
    account_number: state.farmerForm.account.trim(),
    total_trees: farmerTotalTrees(),
    status: "Pending",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseBridge.client
    .from("verifications")
    .upsert(payload, { onConflict: "farm_name,farmer_name" })
    .select()
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  const record = mapSupabaseVerification(data, 0);
  state.verifications = [record, ...state.verifications.filter((item) => item.id !== record.id)];
  return { ok: true, record };
}

async function saveFarmerUpdate() {
  const title = state.updateTitle.trim() || "Farm progress update";
  const body = state.updateDraft.trim();
  if (!body) return { ok: false, message: "Write update details before publishing." };
  if (!supabaseBridge.client || !currentUserId()) return { ok: false, message: "Sign in with a farmer account before publishing updates." };

  const farmSlug = slugify(state.farmerForm.orchardName);
  const payload = {
    user_id: currentUserId(),
    orchard_slug: farmSlug || null,
    title,
    body,
    photo_names: state.updatePhotos,
  };
  const { data, error } = await supabaseBridge.client.from("farmer_updates").insert(payload).select().maybeSingle();
  if (error) return { ok: false, message: error.message };
  state.farmerUpdates.unshift(mapSupabaseUpdate(data));
  state.updateTitle = "";
  state.updateDraft = "";
  state.updatePhotos = [];
  return { ok: true };
}

async function saveAdoption() {
  const farm = selectedFarm();
  if (!farm) return { ok: false, message: "Choose a verified farm before payment." };
  if (!supabaseBridge.client || !currentUserId()) return { ok: false, message: "Sign in with a supporter account before payment." };
  const supporterName = state.paymentForm.supporterName.trim() || supporterDisplayName();
  const certificateId = `MYO-${farm.id.toUpperCase()}-${Date.now().toString().slice(-6)}`;
  const payload = {
    user_id: currentUserId(),
    supporter_name: supporterName,
    supporter_mobile: state.paymentForm.mobile.trim() || null,
    orchard_slug: farm.id,
    tree_count: state.treeCount,
    total_amount: programConfig.adoptionAmount * state.treeCount,
    payment_method: state.paymentMethod,
    payment_status: "Paid",
    certificate_id: certificateId,
  };
  const { data, error } = await supabaseBridge.client.from("adoptions").insert(payload).select().maybeSingle();
  if (error) return { ok: false, message: error.message };
  const record = mapSupabaseAdoption(data);
  state.adoptions = [record, ...state.adoptions.filter((item) => item.id !== record.id)];
  return { ok: true, record };
}

async function saveVerificationStatus(id, status) {
  const item = state.verifications.find((entry) => entry.id === id);
  if (!item) return { ok: false, message: "Verification record not found." };
  if (!supabaseBridge.client || !hasAdminAccess()) return { ok: false, message: "Sign in with an admin account before reviewing." };

  const { data, error } = await supabaseBridge.client
    .from("verifications")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) return { ok: false, message: error.message };

  const updated = mapSupabaseVerification(data || { ...item, status }, 0);
  state.verifications = state.verifications.map((entry) => (entry.id === id ? updated : entry));

  if (status === "Verified") {
    const slug = slugify(item.farm);
    const orchardPayload = {
      slug,
      name: item.farm,
      farmer_name: item.farmer,
      district: item.district,
      village: item.village || "Konkan",
      acres: Number(item.acres) || 0,
      total_trees: Number(item.trees) || 0,
      adopted_trees: 0,
      available_trees: Number(item.trees) || 0,
      image_url: assets.trust,
      summary: `${item.crop || "Cashew"} orchard verified through the MyOrchard program.`,
      created_by: item.userId || null,
      updated_at: new Date().toISOString(),
    };
    const { data: orchardData, error: orchardError } = await supabaseBridge.client
      .from("orchards")
      .upsert(orchardPayload, { onConflict: "slug" })
      .select()
      .maybeSingle();
    if (!orchardError && orchardData) {
      const orchard = mapSupabaseOrchard(orchardData, 0);
      orchards = [orchard, ...orchards.filter((farm) => farm.id !== orchard.id)];
    }
  }

  return { ok: true };
}

function beginSupporterProfileEdit() {
  state.supporterProfileDraft = {
    name: state.supporterProfile.name === "Supporter" ? "" : state.supporterProfile.name,
    mobile: state.supporterProfile.mobile.startsWith("Add ") ? "" : state.supporterProfile.mobile,
    location: state.supporterProfile.location.startsWith("Add ") ? "" : state.supporterProfile.location,
    bio: state.supporterProfile.bio,
  };
  state.profileEditMode = true;
}

async function saveSupporterProfile() {
  const profile = {
    name: state.supporterProfileDraft.name.trim() || state.supporterProfile.name,
    mobile: state.supporterProfileDraft.mobile.trim() || "Add mobile number",
    location: state.supporterProfileDraft.location.trim() || "Add location",
    bio: state.supporterProfileDraft.bio.trim() || state.supporterProfile.bio,
  };

  if (supabaseBridge.client && currentUserId()) {
    const { error } = await supabaseBridge.client
      .from("user_profiles")
      .update({
        full_name: profile.name,
        mobile: profile.mobile,
        location: profile.location,
        bio: profile.bio,
        preferred_language: state.lang,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", currentUserId());
    if (error) return { ok: false, message: error.message };
  }

  state.supporterProfile = {
    ...state.supporterProfile,
    name: profile.name,
    mobile: profile.mobile,
    location: profile.location,
    bio: profile.bio,
  };
  state.profileEditMode = false;
  return { ok: true };
}

async function saveProgramSettings() {
  const adoptionAmount = Number(state.settingsDraft.adoptionAmount);
  if (!Number.isFinite(adoptionAmount) || adoptionAmount <= 0) {
    return { ok: false, message: "Enter a valid adoption amount." };
  }
  if (!supabaseBridge.client || !hasAdminAccess()) return { ok: false, message: "Sign in with an admin account before saving settings." };

  const payload = {
    id: "program",
    adoption_amount: Math.round(adoptionAmount),
    crop_focus: state.settingsDraft.cropFocus.trim() || "Cashew",
    verification_requirement: state.settingsDraft.verificationRequirement.trim() || "KYC, location, tree count",
    update_frequency: state.settingsDraft.updateFrequency.trim() || "Monthly",
    launch_districts: state.settingsDraft.launchDistricts.trim() || "Sindhudurg, Ratnagiri, Kolhapur",
    updated_by: currentUserId(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseBridge.client
    .from("program_settings")
    .upsert(payload, { onConflict: "id" })
    .select()
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  applyProgramSettings(data);
  return { ok: true };
}

function render(preserveFocus = false) {
  const active = document.activeElement;
  const preserveKey = preserveFocus ? active?.dataset?.preserve : null;
  const caret = preserveKey && "selectionStart" in active ? active.selectionStart : null;

  if (!state.role) {
    app.innerHTML = renderWelcome() + renderToast();
  } else if (hasAdminAccess()) {
    app.innerHTML = renderTopbar("Admin") + renderAdmin() + renderToast();
  } else if (state.role === "admin") {
    state.role = null;
    state.session = null;
    state.authMessage = "Please sign in with an approved team email.";
    app.innerHTML = renderWelcome() + renderToast();
  } else {
    app.innerHTML = renderTopbar(roleLabel(state.role)) + renderRoleShell(state.role) + renderToast();
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }

  applyLanguageToDom();

  if (preserveKey) {
    const next = document.querySelector(`[data-preserve="${preserveKey}"]`);
    if (next) {
      next.focus();
      if (caret !== null && "setSelectionRange" in next) {
        next.setSelectionRange(caret, caret);
      }
    }
  }
}

function renderBrand() {
  return `
    <div class="brand">
      <span class="brand-mark brand-logo" aria-hidden="true">
        <img class="brand-image" src="${assets.logo}" alt="" />
      </span>
      <span>MyOrchard</span>
    </div>
  `;
}

function renderLanguageSwitch() {
  return `
    <div class="lang-switch" aria-label="Language switch">
      <button class="lang-btn ${state.lang === "en" ? "active" : ""}" type="button" data-action="language" data-lang="en">EN</button>
      <button class="lang-btn ${state.lang === "mr" ? "active" : ""}" type="button" data-action="language" data-lang="mr">मराठी</button>
    </div>
  `;
}

function renderToast() {
  if (!state.toast) return "";
  return `<div class="toast" role="status" aria-live="polite">${icon("check-circle-2")} ${escapeHtml(state.toast)}</div>`;
}

function renderTopbar(label) {
  const account = state.session?.email
    ? `<span class="pill account-pill">${icon("user-round-check")} ${escapeHtml(state.session.email)}</span>`
    : "";
  return `
    <header class="topbar">
      ${renderBrand()}
      <div class="top-actions">
        <span class="pill gold">${icon("leaf")} ${label}</span>
        ${account}
        <span class="pill">${icon("shield-check")} Kalpavriksha Agro</span>
        ${renderLanguageSwitch()}
        <button class="btn secondary" type="button" data-action="switch-role">
          ${icon("log-out")} Sign out
        </button>
      </div>
    </header>
  `;
}

function renderWelcome() {
  return `
    <main class="welcome">
      <section class="welcome-visual" aria-label="MyOrchard orchard visual">
        <img src="${assets.farmer}" alt="Farmer in a verified cashew orchard" />
      </section>
      <section class="welcome-panel">
        <div class="welcome-brand-row">${renderBrand()} ${renderLanguageSwitch()}</div>
        <div>
          <span class="eyebrow">${icon("leaf")} Connecting people with orchards</span>
          <h1>MyOrchard app</h1>
          <p class="welcome-copy">
            A verified orchard network where farmers publish trusted farm profiles and supporters follow real tree progress.
          </p>
        </div>
        <div class="context-strip">
          <div class="context-item">
            <b>Verified farms</b>
            <span>KYC, orchard details, and location checks before listing</span>
          </div>
          <div class="context-item">
            <b>Live updates</b>
            <span>Farmers share photos, notes, and progress in one place</span>
          </div>
          <div class="context-item">
            <b>3 districts</b>
            <span>Sindhudurg, Ratnagiri, Kolhapur</span>
          </div>
        </div>
        <div class="role-grid">
          ${renderRoleCard("farmer", "Farmer", "tractor", "Register your orchard, submit verification details, and keep supporters updated.")}
          ${renderRoleCard("supporter", "Supporter", "heart-handshake", "Browse verified orchards, choose trees, and receive progress updates.")}
        </div>
        ${renderAuthPanel()}
      </section>
    </main>
  `;
}

function renderAuthPanel() {
  const isSignup = state.authMode === "signup";
  const selectedLabel = roleLabel(state.authRole);
  return `
    <section class="auth-card" aria-label="Account access">
      <div class="auth-head">
        <div>
          <span class="eyebrow">${icon("shield-check")} Secure account access</span>
          <h2>${isSignup ? "Create your MyOrchard account" : "Sign in to continue"}</h2>
        </div>
        <div class="auth-tabs" role="tablist" aria-label="Account mode">
          <button class="auth-tab ${!isSignup ? "active" : ""}" type="button" data-action="auth-mode" data-mode="signin">${icon("log-in")} Sign in</button>
          <button class="auth-tab ${isSignup ? "active" : ""}" type="button" data-action="auth-mode" data-mode="signup">${icon("user-plus")} Sign up</button>
        </div>
      </div>

      <div class="auth-role-grid" aria-label="Account type">
        ${["farmer", "supporter"]
          .map(
            (role) => `
              <button class="auth-role ${state.authRole === role ? "active" : ""}" type="button" data-action="auth-role" data-role="${role}">
                ${icon(role === "farmer" ? "tractor" : "heart-handshake")}
                <span>${roleLabel(role)}</span>
              </button>
            `,
          )
          .join("")}
      </div>

      <div class="auth-form">
        ${
          isSignup
            ? `<label class="form-row">
                <span class="label">Full name</span>
                <input class="input" type="text" autocomplete="name" value="${escapeHtml(state.authName)}" placeholder="Your full name" data-field="authName" data-preserve="auth-name" />
              </label>`
            : ""
        }
        <label class="form-row">
          <span class="label">Email address</span>
          <input class="input" type="email" autocomplete="email" value="${escapeHtml(state.authEmail)}" placeholder="you@example.com" data-field="authEmail" data-preserve="auth-email" />
        </label>
        <label class="form-row">
          <span class="label">Password</span>
          <input class="input" type="password" autocomplete="${isSignup ? "new-password" : "current-password"}" value="${escapeHtml(state.authPassword)}" placeholder="Minimum 8 characters" data-field="authPassword" data-preserve="auth-password" />
        </label>
        <button class="btn auth-submit" type="button" data-action="auth-submit" ${state.authBusy ? "disabled" : ""}>
          ${icon(state.authBusy ? "loader-2" : isSignup ? "user-plus" : "arrow-right")} ${
            state.authBusy ? "Connecting..." : isSignup ? `Create ${selectedLabel} account` : `Continue as ${selectedLabel}`
          }
        </button>
      </div>

      ${
        state.authMessage
          ? `<p class="auth-message" role="status" aria-live="polite">${escapeHtml(state.authMessage)}</p>`
          : `<p class="auth-note">${icon("lock-keyhole")} Approved team emails unlock management tools after sign in.</p>`
      }
    </section>
  `;
}

function renderWelcomePreview() {
  return `
    <div class="phone-preview">
      <div class="phone-status">
        <span>9:41</span>
        <span>${icon("signal")} ${icon("battery-full")}</span>
      </div>
      <div class="phone-head">
        ${renderBrand()}
        <span class="tag">${icon("shield-check")} Verified</span>
      </div>
      ${renderOrchardScene("large")}
      <div class="phone-card-stack">
        <div class="phone-card">
          <span class="metric-icon">${icon("tree-pine")}</span>
          <div><strong>Verified</strong><span>orchard profiles</span></div>
        </div>
        <div class="phone-card">
          <span class="metric-icon">${icon("camera")}</span>
          <div><strong>Updates</strong><span>from the farm</span></div>
        </div>
      </div>
      <button class="btn" type="button" data-action="choose-role" data-role="supporter">${icon("heart-handshake")} Explore orchards</button>
    </div>
    <div class="trust-stack" aria-hidden="true">
      <div class="trust-card"><b>Verified farms</b><span>KYC, geo-tagging, tree count</span></div>
      <div class="trust-card"><b>Monthly updates</b><span>Photos, harvest notes, progress</span></div>
      <div class="trust-card"><b>Clear records</b><span>Certificates, receipts, and activity history</span></div>
    </div>
  `;
}

function renderRoleCard(role, title, iconName, body) {
  return `
    <button class="role-card" type="button" data-action="choose-role" data-role="${role}">
      <span class="role-icon">${icon(iconName)}</span>
      <h2>${title}</h2>
      <p>${body}</p>
      <strong><span class="role-full-action">Start ${title} account</span><span class="role-mobile-action">Select</span></strong>
    </button>
  `;
}

function renderOrchardScene(size = "medium") {
  return `
    <div class="orchard-scene ${size}">
      <div class="sky-line"></div>
      <div class="sun-dot"></div>
      <div class="tree-row row-a">${Array.from({ length: 7 }, (_, index) => `<span style="--i:${index}"></span>`).join("")}</div>
      <div class="tree-row row-b">${Array.from({ length: 6 }, (_, index) => `<span style="--i:${index}"></span>`).join("")}</div>
      <div class="field-lines">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="map-pin">${icon("map-pin")}</div>
    </div>
  `;
}

function renderMiniOrchardMark() {
  return `
    <span class="mini-sun"></span>
    <span class="mini-tree"></span>
    <span class="mini-tree"></span>
    <span class="mini-tree"></span>
  `;
}

function renderRoleShell(role) {
  const currentTab = role === "farmer" ? state.farmerTab : state.supporterTab;
  const content = role === "farmer" ? renderFarmerContent() : renderSupporterContent();
  return `
    <div class="shell">
      <aside class="rail">
        <div class="rail-section">
          <span class="rail-label">${role}</span>
          ${renderNavItems(role, currentTab)}
        </div>
        <div class="rail-label">Program</div>
        <div class="card">
          <span class="tag gold">${icon("shield-check")} Trust workflow</span>
          <p class="muted" style="margin-top:10px">Verified orchard profiles, supporter updates, and secure records in one place.</p>
        </div>
      </aside>
      <main class="main">${content}</main>
      <nav class="bottom-nav">${renderNavItems(role, currentTab)}</nav>
    </div>
  `;
}

function renderNavItems(role, active) {
  return nav[role]
    .map(
      ([id, label, iconName]) => `
        <button class="nav-item ${active === id ? "active" : ""}" type="button"
          data-action="nav" data-role="${role}" data-tab="${id}">
          ${icon(iconName)} <span>${label}</span>
        </button>
      `,
    )
    .join("");
}

function renderFarmerContent() {
  switch (state.farmerTab) {
    case "dashboard":
      return renderFarmerDashboard();
    case "onboarding":
      return renderFarmerOnboarding();
    case "updates":
      return renderFarmerUpdates();
    case "profile":
      return renderFarmerProfile();
    default:
      return renderFarmerDashboard();
  }
}

function renderSupporterContent() {
  switch (state.supporterTab) {
    case "home":
      return renderSupporterHome();
    case "orchards":
      return renderOrchardListing();
    case "farm":
      return renderFarmDetail();
    case "adoption":
      return state.adoptionComplete ? renderCertificateScreen() : renderAdoptionPayment();
    case "updates":
      return renderSupporterUpdates();
    case "profile":
      return renderSupporterProfile();
    default:
      return renderSupporterHome();
  }
}

function renderPageTitle(title, body, actions = "") {
  return `
    <div class="page-title">
      <div>
        <h1>${title}</h1>
        <p>${body}</p>
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ""}
    </div>
  `;
}

function renderFarmerOnboarding() {
  const steps = ["Basic info", "KYC", "Orchard", "Review"];
  return `
    ${renderPageTitle(
      "Farmer onboarding",
      "Register the farmer, verify identity, capture orchard details, and submit for admin approval.",
      state.farmerSubmitted
        ? `<span class="pill">${icon("shield-check")} Submitted</span>`
        : `<span class="pill clay">${icon("clock")} In progress</span>`,
    )}
    <div class="content-grid">
      <section>
        <div class="stepper">
          ${steps
            .map(
              (step, index) => `
                <div class="step ${index === state.farmerStep ? "active" : ""} ${index < state.farmerStep ? "done" : ""}">
                  <span class="step-number">${index + 1}</span>
                  <span>${step}</span>
                </div>
              `,
            )
            .join("")}
        </div>
        <div class="form-panel">
          ${renderFarmerStep()}
          <div class="page-actions" style="margin-top:18px">
            ${
              state.farmerStep > 0
                ? `<button class="btn secondary" type="button" data-action="farmer-back">${icon("arrow-left")} Back</button>`
                : ""
            }
            ${
              state.farmerStep < 3
                ? `<button class="btn" type="button" data-action="farmer-next">Next ${icon("chevron-right")}</button>`
                : `<button class="btn gold" type="button" data-action="farmer-submit">${icon("send")} Submit for verification</button>`
            }
          </div>
        </div>
      </section>
      <aside>
        <div class="image-panel">
          <img src="${assets.farmer}" alt="Farmer onboarding with geo tagging" />
        </div>
        <div class="card" style="margin-top:14px">
          <div class="section-title">
            <h3>Verification checklist</h3>
            ${icon("clipboard-check")}
          </div>
          <div class="timeline">
            ${["Farmer identity", "Bank details", "Geo-tagged location", "Crop and tree count"].map(
              (item) => `
                <div class="timeline-item">
                  <span class="timeline-dot">${icon("check")}</span>
                  <div class="timeline-card"><strong>${item}</strong></div>
                </div>
              `,
            ).join("")}
          </div>
        </div>
      </aside>
    </div>
  `;
}

function inputRow(label, field, type = "text", full = false) {
  const value = escapeHtml(state.farmerForm[field] || "");
  return `
    <label class="form-row ${full ? "full" : ""}">
      <span class="label">${label}</span>
      <input class="input" type="${type}" value="${value}" data-field="${field}" data-preserve="farmer-${field}" />
    </label>
  `;
}

function selectRow(label, field, options, full = false) {
  const value = state.farmerForm[field] || "";
  return `
    <label class="form-row ${full ? "full" : ""}">
      <span class="label">${label}</span>
      <select class="select" data-field="${field}">
        ${options
          .map((option) => `<option value="${option}" ${value === option ? "selected" : ""}>${option}</option>`)
          .join("")}
      </select>
    </label>
  `;
}

function renderFarmerStep() {
  if (state.farmerStep === 0) {
    return `
      <div class="section-title"><h2>Basic information</h2><span class="tag">${icon("user")} Farmer</span></div>
      <div class="form-grid">
        ${inputRow("Full name", "fullName")}
        ${inputRow("Mobile number", "mobile")}
        ${selectRow("District", "district", districts)}
        ${inputRow("Village", "village")}
      </div>
    `;
  }

  if (state.farmerStep === 1) {
    return `
      <div class="section-title"><h2>KYC and payment details</h2><span class="tag gold">${icon("shield-check")} Secure</span></div>
      <div class="form-grid">
        ${inputRow("Aadhaar number", "aadhaar")}
        ${inputRow("Bank name", "bank")}
        ${inputRow("Account number", "account")}
        ${selectRow("Ownership type", "ownership", ["Owned", "Leased", "Family owned"])}
      </div>
    `;
  }

  if (state.farmerStep === 2) {
    return `
      <div class="section-title"><h2>Orchard details</h2><span class="tag">${icon("map-pin")} Geo tagged</span></div>
      <div class="form-grid">
        ${inputRow("Orchard name", "orchardName")}
        ${inputRow("Total land acres", "acres", "number")}
        ${inputRow("Total trees", "totalTrees", "number")}
        ${selectRow("Crop type", "crop", ["Cashew", "Mango", "Coconut", "Mixed orchard"])}
        <label class="form-row full">
          <span class="label">Upload orchard photos</span>
          <input class="input" type="file" multiple />
        </label>
      </div>
    `;
  }

  return `
    <div class="section-title"><h2>Review submission</h2><span class="tag clay">${icon("file-text")} Ready</span></div>
    <div class="grid-2">
      <div class="card">
        <span class="label">Farmer</span>
        <h3>${escapeHtml(state.farmerForm.fullName || "Name pending")}</h3>
        <p class="muted">${escapeHtml(state.farmerForm.village || "Village pending")}, ${escapeHtml(state.farmerForm.district)}</p>
      </div>
      <div class="card">
        <span class="label">Orchard</span>
        <h3>${escapeHtml(farmerOrchardName())}</h3>
        <p class="muted">${escapeHtml(state.farmerForm.totalTrees || "0")} ${escapeHtml(state.farmerForm.crop)} trees across ${escapeHtml(state.farmerForm.acres || "0")} acres</p>
      </div>
    </div>
  `;
}

function renderFarmerDashboard() {
  const name = escapeHtml(farmerDisplayName());
  const totalTrees = farmerTotalTrees();
  return `
    ${renderPageTitle(
      `Hello, ${name}`,
      "Track orchard verification, listed trees, supporter interest, and field activity.",
      `<button class="btn" type="button" data-action="nav" data-role="farmer" data-tab="updates">${icon("upload")} Upload update</button>`,
    )}
    <div class="dashboard-grid">
      ${metric("Total trees", totalTrees, "tree-pine", "Submitted for listing")}
      ${metric("Adopted trees", "0", "heart-handshake", "Updates after first adoption")}
      ${metric("Available trees", totalTrees, "clock", "Ready after verification")}
      ${metric("Account status", state.farmerSubmitted ? "Submitted" : "Draft", "shield-check", "Verification workflow")}
    </div>
    <div class="content-grid">
      <section>
        <div class="visual-band">
          <div>
            <span class="tag">${icon("shield-check")} Verification active</span>
            <h2>${escapeHtml(farmerOrchardName())}</h2>
            <p>${escapeHtml(state.farmerForm.crop)} orchard in ${escapeHtml(state.farmerForm.district)} with verification tracking and monthly growth reporting.</p>
            <div class="meta-row">
              <span class="tag gold">${escapeHtml(state.farmerForm.acres || "0")} acres</span>
              <span class="tag">${escapeHtml(state.farmerForm.crop)}</span>
              <span class="tag clay">${state.farmerSubmitted ? "Submitted for review" : "Draft profile"}</span>
            </div>
          </div>
          <img src="${assets.trust}" alt="Verified orchard trust view" />
        </div>
        <div class="section" style="margin-top:18px">
          <div class="section-title"><h2>Recent adoptions</h2><button class="btn secondary" type="button" data-action="export-csv" data-export="farmer-adoptions">${icon("download")} Export</button></div>
          <div class="list">
            ${renderEmptyState("No adoptions yet", "Adoption records will appear here after your orchard is approved and supporters adopt trees.", "heart-handshake")}
          </div>
        </div>
      </section>
      <aside class="card">
        <div class="section-title"><h2>Activity</h2>${icon("bell")}</div>
        ${state.farmerUpdates.length ? renderTimeline(state.farmerUpdates) : renderEmptyState("No updates yet", "Publish your first field update after submitting the orchard profile.", "camera")}
      </aside>
    </div>
  `;
}

function renderFarmerUpdates() {
  return `
    ${renderPageTitle("Farm updates", "Publish growth notes for supporters who adopted trees from your orchard.")}
    <div class="content-grid">
      <section class="form-panel">
        <div class="section-title"><h2>New field update</h2><span class="tag">${icon("camera")} Monthly</span></div>
        <label class="form-row full">
          <span class="label">Update title</span>
          <input class="input" value="${escapeHtml(state.updateTitle)}" placeholder="Example: Flowering stage completed" data-field="updateTitle" data-preserve="new-update-title" />
        </label>
        <label class="form-row full" style="margin-top:14px">
          <span class="label">Update details</span>
          <textarea class="textarea" placeholder="Write what changed in the orchard this month" data-field="updateDraft" data-preserve="update-draft">${escapeHtml(state.updateDraft)}</textarea>
        </label>
        <input class="sr-only-file" id="update-photo-input" type="file" multiple accept="image/*" data-field="updatePhotos" />
        ${
          state.updatePhotos.length
            ? `<p class="muted" style="margin-top:10px">${escapeHtml(state.updatePhotos.join(", "))}</p>`
            : ""
        }
        <div class="page-actions" style="margin-top:14px">
          <button class="btn secondary" type="button" data-action="choose-update-photos">${icon("image")} Add photos</button>
          <button class="btn" type="button" data-action="publish-update">${icon("send")} Publish update</button>
        </div>
      </section>
      <aside class="card">
        <div class="section-title"><h2>Published updates</h2>${icon("history")}</div>
        ${state.farmerUpdates.length ? renderTimeline(state.farmerUpdates) : renderEmptyState("No published updates", "Your field notes will appear here after you publish them.", "history")}
      </aside>
    </div>
  `;
}

function renderFarmerProfile() {
  const location = `${state.farmerForm.village || "Village pending"}, ${state.farmerForm.district}`;
  return `
    ${renderPageTitle("Profile", "Your public farmer identity, trust status, and payout readiness.")}
    <section class="profile-shell">
      <div class="profile-cover">
        ${renderOrchardScene("cover")}
      </div>
      <div class="profile-head">
        <div class="avatar xl">${icon("tractor")}</div>
        <div>
          <div class="meta-row">
            <h2>${escapeHtml(farmerDisplayName())}</h2>
            <span class="pill">${icon("shield-check")} ${state.farmerSubmitted ? "Submitted farmer" : "Verification draft"}</span>
          </div>
          <p class="muted">${state.farmerProfile.handle} - ${escapeHtml(location)}</p>
          <p>${state.farmerSubmitted ? "Your orchard profile is ready for verification review." : state.farmerProfile.bio}</p>
        </div>
        <div class="profile-actions">
          <button class="btn secondary" type="button" data-action="edit-farmer-profile">${icon("edit-3")} Edit</button>
          <button class="btn" type="button" data-action="nav" data-role="farmer" data-tab="updates">${icon("camera")} Post update</button>
        </div>
      </div>
      <div class="profile-stats">
        <div><strong>${escapeHtml(state.farmerForm.totalTrees || "0")}</strong><span>Trees</span></div>
        <div><strong>0</strong><span>Adopted</span></div>
        <div><strong>${state.farmerSubmitted ? "Review" : "Draft"}</strong><span>Status</span></div>
        <div><strong>${state.farmerUpdates.length}</strong><span>Updates</span></div>
      </div>
    </section>
    <div class="profile-grid">
      <section class="card">
        <div class="section-title"><h2>Account</h2><span class="tag">${icon("user")} Private</span></div>
        <div class="info-list">
          <div><span>Mobile</span><strong>${escapeHtml(state.farmerForm.mobile || "Pending")}</strong></div>
          <div><span>Bank</span><strong>${escapeHtml(state.farmerForm.bank || "Pending")}</strong></div>
          <div><span>Account</span><strong>${escapeHtml(state.farmerForm.account || "Pending")}</strong></div>
        </div>
      </section>
      <section class="card">
        <div class="section-title"><h2>Orchard</h2><span class="tag gold">${icon("tree-pine")} ${escapeHtml(state.farmerForm.crop)}</span></div>
        <div class="info-list">
          <div><span>Name</span><strong>${escapeHtml(farmerOrchardName())}</strong></div>
          <div><span>Location</span><strong>${escapeHtml(location)}</strong></div>
          <div><span>Land</span><strong>${escapeHtml(state.farmerForm.acres || "0")} acres</strong></div>
        </div>
      </section>
      <section class="card">
        <div class="section-title"><h2>Trust checklist</h2><span class="tag">${icon("badge-check")} Complete</span></div>
        ${renderChecklist(["KYC verified", "Bank ready", "Location geo-tagged", "Monthly update rhythm"])}
      </section>
    </div>
  `;
}

function renderSupporterHome() {
  const totals = orchardTotals();
  return `
    ${renderPageTitle(
      "Welcome",
      "Browse verified cashew orchards and stay connected to real farm progress.",
      `<button class="btn" type="button" data-action="nav" data-role="supporter" data-tab="orchards">${icon("search")} Find orchards</button>`,
    )}
    <div class="dashboard-grid">
      ${metric("Published farms", orchards.length, "tree-pine", "Verified orchard profiles")}
      ${metric("Available trees", totals.available, "leaf", "Open for adoption")}
      ${metric("Districts", new Set(orchards.map((farm) => farm.district)).size, "map-pin", "Launch coverage")}
      ${metric("Certificates", state.adoptionComplete ? "1" : "0", "badge-check", "After adoption")}
    </div>
    <div class="content-grid">
      <section>
        <div class="visual-band">
          <div>
            <span class="tag gold">${icon("heart-handshake")} Supporter journey</span>
            <h2>Adopt cashew trees from real farmer orchards</h2>
            <p>Every farm profile includes verification status, tree availability, location, and progress updates before checkout.</p>
            <div class="meta-row">
              ${districts.map((district) => `<button class="chip" type="button" data-action="district-chip" data-district="${district}">${district}</button>`).join("")}
            </div>
          </div>
          <img src="${assets.supporter}" alt="Supporter impact view" />
        </div>
        <div class="section" style="margin-top:18px">
          <div class="section-title"><h2>Recommended orchards</h2><button class="btn secondary" type="button" data-action="nav" data-role="supporter" data-tab="orchards">${icon("filter")} View all</button></div>
          <div class="list">${orchards.length ? orchards.slice(0, 3).map(renderOrchardCard).join("") : renderEmptyState("No orchards published yet", "Verified farms will appear here as soon as they are approved by the team.", "tree-pine")}</div>
        </div>
      </section>
      <aside class="card">
        <div class="section-title"><h2>Impact updates</h2>${icon("bar-chart-3")}</div>
        ${state.adoptionComplete
          ? renderTimeline([
              { title: "Adoption confirmed", date: todayLabel(), body: "Your certificate is ready and the first farm update will follow." },
            ])
          : renderEmptyState("No impact updates yet", "Adopt from a verified farm to start receiving progress notes and certificates.", "bell")}
      </aside>
    </div>
  `;
}

function renderOrchardListing() {
  const filtered = orchards.filter((farm) => {
    const term = state.orchardSearch.trim().toLowerCase();
    const matchesTerm =
      !term ||
      farm.name.toLowerCase().includes(term) ||
      farm.farmer.toLowerCase().includes(term) ||
      farm.district.toLowerCase().includes(term);
    const matchesDistrict = state.districtFilter === "All" || farm.district === state.districtFilter;
    return matchesTerm && matchesDistrict;
  });

  return `
    ${renderPageTitle("Orchards", "Search verified farms and choose trees available for adoption.")}
    <div class="toolbar">
      <label class="input-wrap">
        ${icon("search")}
        <input class="input" placeholder="Search by farm, farmer, or district" value="${escapeHtml(state.orchardSearch)}"
          data-filter="search" data-preserve="orchard-search" />
      </label>
      <select class="select" data-filter="district">
        ${["All", ...districts].map((district) => `<option value="${district}" ${state.districtFilter === district ? "selected" : ""}>${district}</option>`).join("")}
      </select>
      <button class="btn secondary" type="button" data-action="clear-filters">${icon("rotate-ccw")} Reset</button>
    </div>
    <div class="list">
      ${filtered.length ? filtered.map(renderOrchardCard).join("") : renderEmptyState("No orchards published yet", "Verified farms will appear here after the team approves orchard records in Supabase.", "tree-pine")}
    </div>
  `;
}

function renderOrchardCard(farm) {
  return `
    <article class="list-card">
      <img class="thumb" src="${farm.image}" alt="${farm.name}" />
      <div>
        <div class="meta-row">
          <h3>${farm.name}</h3>
          <span class="tag">${icon("shield-check")} Verified</span>
        </div>
        <p>${farm.farmer} - ${farm.village}, ${farm.district}</p>
        <div class="mini-row">
          <span class="tag gold">${farm.available} trees available</span>
          <span class="tag">${farm.rating} rating</span>
          <span class="tag clay">Verified listing</span>
        </div>
      </div>
      <button class="btn secondary" type="button" data-action="open-farm" data-farm="${farm.id}">
        View farm ${icon("chevron-right")}
      </button>
    </article>
  `;
}

function renderFarmDetail() {
  const farm = selectedFarm();
  if (!farm) {
    return `
      ${renderPageTitle(
        "Farm details",
        "Verified farms will appear here after the team publishes orchard records.",
        `<button class="btn secondary" type="button" data-action="nav" data-role="supporter" data-tab="orchards">${icon("arrow-left")} Back to orchards</button>`,
      )}
      ${renderEmptyState("No farm selected", "Choose a verified orchard from the listing once farms are available.", "tree-pine")}
    `;
  }
  return `
    ${renderPageTitle(
      farm.name,
      `${farm.farmer} - ${farm.village}, ${farm.district}, ${farm.state}`,
      `<button class="btn secondary" type="button" data-action="nav" data-role="supporter" data-tab="orchards">${icon("arrow-left")} Back</button>
       <button class="btn" type="button" data-action="start-adoption">${icon("heart-handshake")} Adopt trees</button>`,
    )}
    <section class="farm-hero">
      <div class="farm-photo">
        <img src="${farm.image}" alt="${farm.name} orchard" />
      </div>
      <aside class="farm-summary">
        <span class="pill">${icon("shield-check")} Verified farm</span>
        <h1>${farm.name}</h1>
        <p class="muted">${farm.summary}</p>
        <div class="stat-line">
          <div class="stat-box"><small>Farm size</small><strong>${farm.acres} acres</strong></div>
          <div class="stat-box"><small>Total trees</small><strong>${farm.totalTrees}</strong></div>
          <div class="stat-box"><small>Available</small><strong>${farm.available}</strong></div>
        </div>
        <div class="card">
          <span class="label">Geo tagged coordinates</span>
          <p class="muted" style="margin-top:7px">${farm.coordinates}</p>
        </div>
        <button class="btn" type="button" data-action="start-adoption">${icon("credit-card")} Adopt from this farm</button>
      </aside>
    </section>
    <div class="grid-3">
      <div class="card"><span class="metric-icon">${icon("shield-check")}</span><h3>Verified identity</h3><p class="muted">Farmer profile and farm details reviewed by Kalpavriksha Agro.</p></div>
      <div class="card"><span class="metric-icon">${icon("map-pin")}</span><h3>Physical connection</h3><p class="muted">Farm location and coordinates visible before adoption.</p></div>
      <div class="card"><span class="metric-icon">${icon("camera")}</span><h3>Continuous updates</h3><p class="muted">Photo and growth updates keep supporters connected.</p></div>
    </div>
  `;
}

function renderAdoptionPayment() {
  const farm = selectedFarm();
  if (!farm) {
    return `
      ${renderPageTitle(
        "Adopt a tree",
        "Choose a verified farm before starting checkout.",
        `<button class="btn secondary" type="button" data-action="nav" data-role="supporter" data-tab="orchards">${icon("arrow-left")} Browse orchards</button>`,
      )}
      ${renderEmptyState("No farm selected", "Adoption checkout will be available after selecting a published orchard.", "heart-handshake")}
    `;
  }
  const unit = programConfig.adoptionAmount;
  const total = unit * state.treeCount;

  return `
    ${renderPageTitle(
      "Adopt a tree",
      `${farm.name} - ${farm.district}`,
      `<button class="btn secondary" type="button" data-action="open-farm" data-farm="${farm.id}">${icon("arrow-left")} Farm details</button>`,
    )}
    <section class="adoption-layout">
      <div class="card">
        <div class="section-title"><h2>Your selection</h2><span class="tag">${icon("shield-check")} Verified</span></div>
        <div class="list-card" style="grid-template-columns:96px minmax(0,1fr)">
          <img class="thumb" src="${farm.image}" alt="${farm.name}" />
          <div>
            <h3>${farm.name}</h3>
            <p>${farm.farmer} - ${farm.village}, ${farm.district}</p>
            <div class="mini-row"><span class="tag gold">${farm.available} available</span></div>
          </div>
        </div>
        <div class="section" style="margin-top:18px">
          <div class="section-title">
            <h3>Number of trees</h3>
            <div class="counter">
              <button class="icon-btn" type="button" data-action="tree-count" data-delta="-1" aria-label="Decrease tree count">${icon("minus")}</button>
              <span class="counter-value">${state.treeCount}</span>
              <button class="icon-btn" type="button" data-action="tree-count" data-delta="1" aria-label="Increase tree count">${icon("plus")}</button>
            </div>
          </div>
          <div class="payment-breakdown">
            <div class="breakdown-row"><span>Adoption amount per tree</span><strong>${money(unit)}</strong></div>
            <div class="breakdown-row"><span>Selected trees</span><strong>${state.treeCount}</strong></div>
            <div class="breakdown-row"><span>Receipt and certificate</span><strong>Included</strong></div>
            <div class="breakdown-row"><span>Total</span><strong>${money(total)}</strong></div>
          </div>
        </div>
      </div>
      <div class="form-panel">
        <div class="section-title"><h2>Payment</h2><span class="pill">${icon("lock")} Secure</span></div>
        <div class="method-grid">
          ${["UPI", "Card", "Net banking"].map(
            (method) => `
              <button class="chip ${state.paymentMethod === method ? "active" : ""}" type="button" data-action="payment-method" data-method="${method}">
                ${icon(method === "UPI" ? "smartphone" : method === "Card" ? "credit-card" : "landmark")} ${method}
              </button>
            `,
          ).join("")}
        </div>
        <div class="grid-2" style="margin-top:18px">
          <label class="form-row">
            <span class="label">Supporter name</span>
            <input class="input" placeholder="Enter supporter name" value="${escapeHtml(state.paymentForm.supporterName)}" data-field="paymentSupporterName" data-preserve="payment-name" />
          </label>
          <label class="form-row">
            <span class="label">Mobile number</span>
            <input class="input" placeholder="Enter mobile number" value="${escapeHtml(state.paymentForm.mobile)}" data-field="paymentMobile" data-preserve="payment-mobile" />
          </label>
        </div>
        <div class="card" style="margin-top:18px">
          <div class="section-title"><h3>Adoption summary</h3><span class="tag gold">${state.treeCount} tree${state.treeCount > 1 ? "s" : ""}</span></div>
          <p class="muted">A digital certificate and monthly orchard updates will be added to My Adoption after payment.</p>
        </div>
        <div class="page-actions" style="margin-top:18px">
          <button class="btn gold" type="button" data-action="complete-payment">${icon("lock-keyhole")} Pay ${money(total)}</button>
        </div>
      </div>
    </section>
  `;
}

function renderCertificateScreen() {
  const farm = selectedFarm();
  if (!farm) {
    return `
      ${renderPageTitle("Adoption complete", "No selected farm found.", "")}
      ${renderEmptyState("Certificate unavailable", "Please choose an orchard and complete checkout again.", "badge-check")}
    `;
  }
  return `
    ${renderPageTitle(
      "Adoption complete",
      "Your certificate and farm update timeline are ready.",
      `<button class="btn secondary" type="button" data-action="new-adoption">${icon("tree-pine")} Adopt another tree</button>`,
    )}
    <div class="adoption-layout">
      <section class="certificate">
        <span class="brand" style="justify-content:center">${renderBrand()}</span>
        <p class="eyebrow" style="justify-content:center;margin-top:18px">${icon("badge-check")} Certificate of tree adoption</p>
        <h1>This is to certify that</h1>
        <span class="recipient">${escapeHtml(supporterDisplayName())}</span>
        <p class="muted">has adopted</p>
        <h2>${state.treeCount} Cashew Tree${state.treeCount > 1 ? "s" : ""}</h2>
        <p class="muted">from ${farm.name}, ${farm.district}, Maharashtra</p>
        <div class="meta-row" style="justify-content:center;margin-top:18px">
          <span class="tag gold">Date: ${todayLabel()}</span>
          <span class="tag">Certificate ID: ${escapeHtml(state.adoptionRecord?.certificateId || `MYO-${farm.id.toUpperCase()}-${state.treeCount}`)}</span>
        </div>
      </section>
      <aside class="card">
        <div class="section-title"><h2>Adoption updates</h2>${icon("bell")}</div>
        ${renderTimeline([
          { title: "Adoption confirmed", date: todayLabel(), body: `${state.treeCount} tree adoption added to ${farm.name}.` },
          { title: "Receipt generated", date: todayLabel(), body: `${money(programConfig.adoptionAmount * state.treeCount)} recorded for this adoption.` },
          { title: "First field update", date: "After farmer update", body: "The farmer will share a monthly photo and growth note." },
        ])}
        <div class="page-actions" style="margin-top:18px">
          <button class="btn" type="button" data-action="download-certificate">${icon("download")} Download certificate</button>
        </div>
      </aside>
    </div>
  `;
}

function renderSupporterUpdates() {
  const farm = selectedFarm();
  return `
    ${renderPageTitle("Updates", "Track tree progress, farmer notes, and adoption milestones.")}
    <div class="content-grid">
      <section class="card">
        <div class="section-title"><h2>${farm ? farm.name : "Farm updates"}</h2><span class="tag">${state.adoptionComplete ? `${state.treeCount} tree${state.treeCount > 1 ? "s" : ""}` : "No adoption yet"}</span></div>
        ${state.adoptionComplete && farm
          ? renderTimeline([
              { title: "Adoption confirmed", date: todayLabel(), body: `${state.treeCount} tree adoption added to ${farm.name}.` },
              { title: "First field update", date: "After farmer update", body: "The farmer will share a monthly photo and growth note." },
            ])
          : renderEmptyState("No updates yet", "Updates will begin after you adopt from a verified orchard.", "bell")}
      </section>
      <aside class="image-panel">
        <img src="${assets.trust}" alt="Farm transparency update" />
      </aside>
    </div>
  `;
}

function renderSupporterProfile() {
  return `
    ${renderPageTitle("Profile", "Your adoption identity, certificates, saved farms, and impact summary.")}
    <section class="profile-shell">
      <div class="profile-cover supporter-cover">
        ${renderOrchardScene("cover")}
      </div>
      <div class="profile-head">
        <div class="avatar xl">${icon("heart-handshake")}</div>
        <div>
          <div class="meta-row">
            <h2>${state.supporterProfile.name}</h2>
            <span class="pill">${icon("leaf")} Green supporter</span>
          </div>
          <p class="muted">${state.supporterProfile.handle} - ${state.supporterProfile.location}</p>
          <p>${state.supporterProfile.bio}</p>
        </div>
        <div class="profile-actions">
          <button class="btn secondary" type="button" data-action="edit-supporter-profile">${icon("edit-3")} Edit</button>
          <button class="btn" type="button" data-action="nav" data-role="supporter" data-tab="orchards">${icon("tree-pine")} Adopt</button>
        </div>
      </div>
      <div class="profile-stats">
        <div><strong>${state.adoptionComplete ? state.treeCount : 0}</strong><span>Trees</span></div>
        <div><strong>${state.adoptionComplete ? 1 : 0}</strong><span>Farmers</span></div>
        <div><strong>${state.adoptionComplete ? 1 : 0}</strong><span>Certificates</span></div>
        <div><strong>${orchards.length}</strong><span>Farms live</span></div>
      </div>
    </section>
    <div class="profile-grid">
      <section class="card">
        <div class="section-title"><h2>Contact</h2><span class="tag">${icon("lock")} Private</span></div>
        ${state.profileEditMode ? renderSupporterProfileEditor() : `
          <div class="info-list">
            <div><span>Mobile</span><strong>${state.supporterProfile.mobile}</strong></div>
            <div><span>Email</span><strong>${state.supporterProfile.email}</strong></div>
            <div><span>Location</span><strong>${state.supporterProfile.location}</strong></div>
          </div>
        `}
      </section>
      <section class="card">
        <div class="section-title"><h2>Adoption history</h2>${icon("badge-check")}</div>
        <div class="list">
          ${state.adoptionComplete && selectedFarm()
            ? `<div class="list-card compact"><div><h3>${selectedFarm().name}</h3><p>${state.treeCount} tree${state.treeCount > 1 ? "s" : ""} - certificate ready</p></div><span class="pill">Active</span></div>`
            : renderEmptyState("No adoption history", "Adopt from a verified farm to build your certificate timeline.", "badge-check")}
        </div>
      </section>
      <section class="card">
        <div class="section-title"><h2>Saved farms</h2><button class="btn secondary" type="button" data-action="nav" data-role="supporter" data-tab="orchards">${icon("search")} Browse</button></div>
        ${orchards.length ? renderChecklist(orchards.slice(0, 3).map((farm) => farm.name)) : renderEmptyState("No saved farms yet", "Browse verified farms and save the ones you want to revisit.", "search")}
      </section>
    </div>
  `;
}

function renderSupporterProfileEditor() {
  return `
    <div class="form-grid profile-edit-grid">
      <label class="form-row full">
        <span class="label">Full name</span>
        <input class="input" value="${escapeHtml(state.supporterProfileDraft.name)}" data-field="supporterName" data-preserve="supporter-name" />
      </label>
      <label class="form-row full">
        <span class="label">Mobile number</span>
        <input class="input" value="${escapeHtml(state.supporterProfileDraft.mobile)}" data-field="supporterMobile" data-preserve="supporter-mobile" />
      </label>
      <label class="form-row full">
        <span class="label">Location</span>
        <input class="input" value="${escapeHtml(state.supporterProfileDraft.location)}" data-field="supporterLocation" data-preserve="supporter-location" />
      </label>
      <label class="form-row full">
        <span class="label">Bio</span>
        <textarea class="textarea compact" data-field="supporterBio" data-preserve="supporter-bio">${escapeHtml(state.supporterProfileDraft.bio)}</textarea>
      </label>
    </div>
    <div class="page-actions" style="margin-top:12px">
      <button class="btn secondary" type="button" data-action="cancel-profile-edit">${icon("x")} Cancel</button>
      <button class="btn" type="button" data-action="save-supporter-profile">${icon("save")} Save profile</button>
    </div>
  `;
}

function renderAdmin() {
  return `
    <div class="admin-shell">
      <aside class="admin-rail">
        ${renderBrand()}
        <div class="rail-label" style="color:rgba(255,253,246,.72)">Admin tools</div>
        <div class="rail-section">${renderNavItems("admin", state.adminTab)}</div>
      </aside>
      <main class="main">${renderAdminContent()}</main>
      <nav class="bottom-nav">${renderNavItems("admin", state.adminTab)}</nav>
    </div>
  `;
}

function renderAdminContent() {
  switch (state.adminTab) {
    case "farmers":
      return renderAdminFarmers();
    case "orchards":
      return renderAdminOrchards();
    case "verifications":
      return renderAdminVerifications();
    case "payments":
      return renderAdminPayments();
    case "reports":
      return renderAdminReports();
    case "settings":
      return renderAdminSettings();
    default:
      return renderAdminDashboard();
  }
}

function renderAdminDashboard() {
  const totals = orchardTotals();
  return `
    ${renderPageTitle(
      "Dashboard overview",
      "Monitor farmer onboarding, orchard inventory, adoptions, and operational health.",
      `<span class="pill gold">${icon("calendar")} Jul 2026</span>`,
    )}
    <div class="dashboard-grid">
      ${metric("Farmers in review", state.verifications.length, "users", "Verification records")}
      ${metric("Published orchards", orchards.length, "tree-pine", "Live farm listings")}
      ${metric("Trees available", totals.available, "leaf", "Open inventory")}
      ${metric("Trees adopted", totals.adopted, "heart-handshake", "Across live farms")}
    </div>
    <div class="content-grid">
      <section class="card">
        <div class="section-title"><h2>Adoptions over time</h2><span class="tag">This year</span></div>
        ${renderChart()}
      </section>
      <aside class="card">
        <div class="section-title"><h2>Verification queue</h2><button class="btn secondary" type="button" data-action="nav" data-role="admin" data-tab="verifications">${icon("arrow-right")} Open</button></div>
        <div class="list">
          ${state.verifications.filter((item) => item.status === "Pending").map(renderQueueItem).join("") || `<p class="muted">No pending verifications.</p>`}
        </div>
      </aside>
    </div>
  `;
}

function renderAdminFarmers() {
  return `
    ${renderPageTitle("Farmers", "Review registered farmers, KYC state, and payout readiness.")}
    <div class="list">
      ${state.verifications.length ? state.verifications.map((item) => `
        <div class="list-card compact">
          <div>
            <h3>${item.farmer}</h3>
            <p>${item.farm} - ${item.district} - ${item.trees} trees</p>
          </div>
          <span class="pill ${item.status === "Pending" ? "clay" : ""}">${item.status}</span>
        </div>
      `).join("") : renderEmptyState("No farmer records", "New farmer verification records will appear here from Supabase.", "users")}
    </div>
  `;
}

function renderAdminOrchards() {
  return `
    ${renderPageTitle("Orchards", "Manage registered farms, tree inventory, adoption availability, and locations.")}
    <div class="list">${orchards.length ? orchards.map(renderOrchardCard).join("") : renderEmptyState("No orchards published", "Approved orchards will appear here after records are created in Supabase.", "tree-pine")}</div>
  `;
}

function renderAdminVerifications() {
  return `
    ${renderPageTitle("Farm verification", "Approve KYC and geo-tagged orchard submissions before public listing.")}
    <div class="list">${state.verifications.length ? state.verifications.map(renderQueueItem).join("") : renderEmptyState("No verification queue", "Farmer submissions will appear here when they are ready for review.", "shield-check")}</div>
  `;
}

function renderAdminPayments() {
  const totals = orchardTotals();
  const collected = state.adoptions.reduce((sum, adoption) => sum + Number(adoption.totalAmount || 0), 0);
  return `
    ${renderPageTitle("Payments", "Track adoption receipts, certificate readiness, and payout operations.")}
    <div class="dashboard-grid">
      ${metric("Collected", money(collected), "banknote", "From live adoption counts")}
      ${metric("Adopted trees", state.adoptions.reduce((sum, adoption) => sum + Number(adoption.treeCount || 0), 0), "tree-pine", "Across saved adoptions")}
      ${metric("Receipts", state.adoptions.length, "badge-check", "Certificate-linked records")}
      ${metric("Pending review", state.verifications.filter((item) => item.status === "Pending").length, "clock", "Farmer records")}
    </div>
    <div class="card">
      <div class="section-title"><h2>Recent collections</h2><button class="btn secondary" type="button" data-action="export-csv" data-export="admin-payments">${icon("download")} Export CSV</button></div>
      <div class="list">
        ${state.adoptions.length ? state.adoptions.map((adoption) => `
          <div class="list-card compact">
            <div><h3>${escapeHtml(adoption.certificateId || "Certificate pending")}</h3><p>${escapeHtml(adoption.supporterName)} - ${adoption.treeCount} adopted tree${adoption.treeCount > 1 ? "s" : ""}</p></div>
            <span class="pill">${money(adoption.totalAmount)}</span>
          </div>
        `).join("") : renderEmptyState("No payment records yet", "Collections will appear after supporters complete adoption checkout.", "wallet")}
      </div>
    </div>
  `;
}

function renderAdminReports() {
  const totals = orchardTotals();
  return `
    ${renderPageTitle("Reports", "View adoption, farmer support, and sustainability indicators.")}
    <div class="grid-2">
      <div class="card">
        <div class="section-title"><h2>Impact summary</h2><span class="tag gold">Live inventory</span></div>
        ${renderImpactSummary(totals)}
      </div>
      <div class="card">
        <div class="section-title"><h2>Monthly trend</h2><span class="tag">Adoptions</span></div>
        ${renderChart()}
      </div>
    </div>
  `;
}

function renderAdminSettings() {
  return `
    ${renderPageTitle("Settings", "Configure districts, crop types, adoption amount, and approval rules.")}
    <div class="grid-2">
      <div class="form-panel">
        <div class="form-grid">
          <label class="form-row"><span class="label">Adoption amount per tree</span><input class="input" value="${escapeHtml(state.settingsDraft.adoptionAmount)}" data-setting="adoptionAmount" data-preserve="setting-adoption" /></label>
          <label class="form-row"><span class="label">Crop focus</span><input class="input" value="${escapeHtml(state.settingsDraft.cropFocus)}" data-setting="cropFocus" data-preserve="setting-crop" /></label>
          <label class="form-row"><span class="label">Verification requirement</span><input class="input" value="${escapeHtml(state.settingsDraft.verificationRequirement)}" data-setting="verificationRequirement" data-preserve="setting-verification" /></label>
          <label class="form-row"><span class="label">Update frequency</span><input class="input" value="${escapeHtml(state.settingsDraft.updateFrequency)}" data-setting="updateFrequency" data-preserve="setting-frequency" /></label>
          <label class="form-row full"><span class="label">Launch districts</span><input class="input" value="${escapeHtml(state.settingsDraft.launchDistricts)}" data-setting="launchDistricts" data-preserve="setting-districts" /></label>
        </div>
        <div class="page-actions" style="margin-top:18px"><button class="btn" type="button" data-action="save-settings">${icon("save")} Save settings</button></div>
      </div>
      ${renderSupabaseStatus()}
    </div>
  `;
}

function renderSupabaseStatus() {
  const connected = ["connected", "live", "empty"].includes(supabaseBridge.status);
  const live = supabaseBridge.status === "live";
  return `
    <section class="card">
      <div class="section-title">
        <h2>Data connection</h2>
        <span class="tag ${connected ? "" : "clay"}">${icon(live ? "database" : connected ? "plug-zap" : "database-zap")} ${live ? "Live data" : connected ? "Supabase ready" : "Connecting"}</span>
      </div>
      <div class="info-list">
        <div><span>Project ref</span><strong>${supabaseConfig.projectRef}</strong></div>
        <div><span>Endpoint</span><strong>supabase.co</strong></div>
        <div><span>Client key</span><strong>Publishable</strong></div>
        <div><span>Data source</span><strong>${supabaseBridge.dataSource}</strong></div>
        <div><span>Tables checked</span><strong>orchards, verifications, updates</strong></div>
        <div><span>Last sync</span><strong>${supabaseBridge.lastSync || "Waiting"}</strong></div>
      </div>
      <p class="muted" style="margin-top:14px">${supabaseBridge.message}</p>
      <p class="muted" style="margin-top:8px">Server-only database URLs are kept out of the frontend.</p>
    </section>
  `;
}

function renderQueueItem(item) {
  const isPending = item.status === "Pending";
  return `
    <div class="queue-item">
      <div>
        <h3>${item.farm}</h3>
        <p>${item.farmer} - ${item.district} - ${item.trees} trees</p>
        <div class="mini-row"><span class="tag ${isPending ? "clay" : ""}">${item.status}</span></div>
      </div>
      <div class="page-actions">
        ${
          isPending
            ? `<button class="btn" type="button" data-action="admin-verify" data-id="${item.id}">${icon("shield-check")} Approve</button>
               <button class="btn secondary" type="button" data-action="admin-review" data-id="${item.id}">${icon("message-square-warning")} Review</button>`
            : `<span class="pill">${icon("check")} Live</span>`
        }
      </div>
    </div>
  `;
}

function metric(label, value, iconName, hint) {
  return `
    <div class="metric-card">
      <div class="metric-top">
        <small>${label}</small>
        <span class="metric-icon">${icon(iconName)}</span>
      </div>
      <strong>${value}</strong>
      <span>${hint}</span>
    </div>
  `;
}

function renderTimeline(items) {
  return `
    <div class="timeline">
      ${items
        .map(
          (item) => `
            <div class="timeline-item">
              <span class="timeline-dot">${icon("leaf")}</span>
              <div class="timeline-card">
                <strong>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(item.date)} - ${escapeHtml(item.body)}</p>
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderChecklist(items) {
  return `
    <div class="check-list">
      ${items.map((item) => `<div>${icon("check-circle-2")} <span>${item}</span></div>`).join("")}
    </div>
  `;
}

function renderChart() {
  if (!state.adoptions.length) {
    return renderEmptyState("No adoption trend yet", "Monthly adoption bars will appear after live adoption records are saved.", "bar-chart-3");
  }
  const monthCounts = new Map();
  state.adoptions.forEach((adoption) => {
    monthCounts.set(adoption.month, (monthCounts.get(adoption.month) || 0) + adoption.treeCount);
  });
  const max = Math.max(...monthCounts.values(), 1);
  const bars = Array.from(monthCounts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, count]) => {
      const date = new Date(`${month}-01T00:00:00Z`);
      const label = date.toLocaleString("en-IN", { month: "short" });
      return [label, Math.max(8, Math.round((count / max) * 90))];
    });
  return `
    <div class="chart">
      ${bars.map(([label, height]) => `<div class="bar-wrap"><div class="bar" style="height:${height}%"></div><span>${label}</span></div>`).join("")}
    </div>
  `;
}

function renderImpactSummary(totals) {
  return `
    <div class="revenue-model">
      <div class="split-ring">
        <span>${totals.available}</span>
        <strong>Open trees</strong>
      </div>
      <div class="split-copy">
        <div><b>${orchards.length}</b><span>published orchard profiles</span></div>
        <div><b>${totals.adopted}</b><span>trees already adopted across live farms</span></div>
        <div><b>${totals.trees}</b><span>total trees tracked in the current program data</span></div>
      </div>
    </div>
  `;
}

function toCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? "");
          return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
        })
        .join(","),
    )
    .join("\n");
}

function downloadTextFile(filename, content, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
}

function exportCsv(type) {
  if (type === "farmer-adoptions") {
    const rows = [
      ["Supporter", "Trees", "Date", "Status"],
      ...state.adoptions.map((adoption) => [
        adoption.supporterName,
        String(adoption.treeCount),
        adoption.createdAt ? new Date(adoption.createdAt).toLocaleDateString("en-IN") : "",
        adoption.status,
      ]),
    ];
    if (rows.length === 1) rows.push(["", "", "", "No adoption records yet"]);
    return downloadTextFile("myorchard-farmer-adoptions.csv", toCsv(rows), "text/csv");
  }

  if (type === "admin-payments") {
    const rows = [
      ["Certificate", "Supporter", "Trees", "Total amount", "Status"],
      ...state.adoptions.map((adoption) => [
        adoption.certificateId,
        adoption.supporterName,
        String(adoption.treeCount),
        String(adoption.totalAmount),
        adoption.status,
      ]),
    ];
    if (rows.length === 1) rows.push(["", "", "", "", "No payment records yet"]);
    return downloadTextFile("myorchard-admin-payments.csv", toCsv(rows), "text/csv");
  }

  return "";
}

function downloadCertificate() {
  const farm = selectedFarm();
  if (!farm) return "";
  const content = [
    "MYORCHARD CERTIFICATE OF TREE ADOPTION",
    "",
    `This is to certify that ${supporterDisplayName()} has adopted`,
    `${state.treeCount} Cashew Tree${state.treeCount > 1 ? "s" : ""}`,
    `from ${farm.name}, ${farm.district}, Maharashtra.`,
    "",
    `Date: ${todayLabel()}`,
    `Certificate ID: ${state.adoptionRecord?.certificateId || `MYO-${farm.id.toUpperCase()}-${state.treeCount}`}`,
  ].join("\n");
  return downloadTextFile("myorchard-adoption-certificate.txt", content, "text/plain");
}

async function handleAuthSubmit() {
  const email = normalizeEmail(state.authEmail);
  const password = state.authPassword;
  const name = state.authName.trim();
  const errors = [];

  if (state.authMode === "signup" && !name) errors.push("Enter your full name.");
  if (!isValidEmail(email)) errors.push("Enter a valid email address.");
  if (password.length < 8) errors.push("Use a password with at least 8 characters.");

  if (errors.length) {
    state.authMessage = errors[0];
    render(true);
    return;
  }

  if (!supabaseBridge.client) {
    state.authMessage = "Supabase is not available. Check the backend connection before signing in.";
    render(true);
    return;
  }

  state.authBusy = true;
  state.authMessage = "";
  render(true);

  try {
    if (state.authMode === "signup") {
      const { data, error } = await supabaseBridge.client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            role: state.authRole,
            preferred_language: state.lang,
          },
        },
      });
      if (error) throw error;
      if (data?.session) {
        await applyAuthSession(data.session);
        await supabaseBridge.sync();
      } else {
        state.authMessage = "Account created. Please confirm your email, then sign in.";
        state.authMode = "signin";
      }
      return;
    }

    const { data, error } = await supabaseBridge.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await applyAuthSession(data.session);
    await supabaseBridge.sync();
  } catch (error) {
    state.authMessage = authFailureMessage(error);
  } finally {
    state.authBusy = false;
    render();
  }
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;

  if (action === "language") {
    setLanguage(target.dataset.lang);
    if (supabaseBridge.client && currentUserId()) {
      await supabaseBridge.client
        .from("user_profiles")
        .update({ preferred_language: state.lang, updated_at: new Date().toISOString() })
        .eq("user_id", currentUserId());
    }
    render(true);
    return;
  }

  if (action === "choose-role") {
    state.authMode = "signup";
    state.authRole = target.dataset.role;
    state.authMessage = "";
    state.toast = "";
    render(true);
    return;
  }

  if (action === "auth-mode") {
    state.authMode = target.dataset.mode;
    state.authMessage = "";
    render(true);
    return;
  }

  if (action === "auth-role") {
    state.authRole = target.dataset.role;
    state.authMessage = "";
    render(true);
    return;
  }

  if (action === "auth-submit") {
    await handleAuthSubmit();
    return;
  }

  if (action === "switch-role") {
    await supabaseBridge.signOut();
    clearSession();
    state.toast = "";
    render();
    return;
  }

  if (action === "export-csv") {
    const filename = exportCsv(target.dataset.export);
    if (filename) {
      state.toast = `${filename} downloaded`;
      render();
    }
    return;
  }

  if (action === "edit-farmer-profile") {
    state.farmerTab = "onboarding";
    state.toast = "Edit farmer and orchard details in onboarding.";
    render();
    return;
  }

  if (action === "edit-supporter-profile") {
    beginSupporterProfileEdit();
    render();
    return;
  }

  if (action === "cancel-profile-edit") {
    state.profileEditMode = false;
    render();
    return;
  }

  if (action === "save-supporter-profile") {
    const result = await saveSupporterProfile();
    state.toast = result.ok ? "Profile saved" : result.message;
    render();
    return;
  }

  if (action === "save-settings") {
    const result = await saveProgramSettings();
    state.toast = result.ok ? "Settings saved" : result.message;
    render();
    return;
  }

  if (action === "download-certificate") {
    const filename = downloadCertificate();
    state.toast = filename ? `${filename} downloaded` : "Choose a farm before downloading a certificate";
    render();
    return;
  }

  if (action === "nav") {
    const role = target.dataset.role;
    const tab = target.dataset.tab;
    state.toast = "";
    if (role === "farmer") state.farmerTab = tab;
    if (role === "supporter") state.supporterTab = tab;
    if (role === "admin") state.adminTab = tab;
    render();
    return;
  }

  if (action === "district-chip") {
    state.districtFilter = target.dataset.district;
    state.supporterTab = "orchards";
    render();
    return;
  }

  if (action === "clear-filters") {
    state.orchardSearch = "";
    state.districtFilter = "All";
    render();
    return;
  }

  if (action === "open-farm") {
    state.selectedFarmId = target.dataset.farm;
    state.supporterTab = "farm";
    render();
    return;
  }

  if (action === "start-adoption") {
    state.adoptionComplete = false;
    state.supporterTab = "adoption";
    render();
    return;
  }

  if (action === "tree-count") {
    state.treeCount = Math.max(1, Math.min(25, state.treeCount + Number(target.dataset.delta)));
    render();
    return;
  }

  if (action === "payment-method") {
    state.paymentMethod = target.dataset.method;
    render();
    return;
  }

  if (action === "new-adoption") {
    state.adoptionComplete = false;
    state.treeCount = 1;
    state.supporterTab = "orchards";
    render();
    return;
  }

  if (action === "farmer-next") {
    state.farmerStep = Math.min(3, state.farmerStep + 1);
    render();
    return;
  }

  if (action === "farmer-back") {
    state.farmerStep = Math.max(0, state.farmerStep - 1);
    render();
    return;
  }

  if (action === "farmer-submit") {
    if (!farmerSubmissionReady()) {
      state.toast = "Complete farmer, orchard, tree, and bank details before submitting.";
      render();
      return;
    }
    const result = await upsertFarmerVerification();
    if (!result.ok) {
      state.toast = result.message;
      render();
      return;
    }
    state.farmerSubmitted = true;
    state.farmerTab = "dashboard";
    state.toast = "Orchard submitted for verification";
    render();
    return;
  }

  if (action === "choose-update-photos") {
    document.querySelector("#update-photo-input")?.click();
    return;
  }

  if (action === "publish-update") {
    const result = await saveFarmerUpdate();
    state.toast = result.ok ? "Farm update published" : result.message;
    render();
    return;
  }

  if (action === "admin-verify" || action === "admin-review") {
    const result = await saveVerificationStatus(target.dataset.id, action === "admin-verify" ? "Verified" : "Needs review");
    state.toast = result.ok ? `Verification marked ${action === "admin-verify" ? "Verified" : "Needs review"}` : result.message;
    render();
    return;
  }

  if (action === "complete-payment") {
    const result = await saveAdoption();
    if (result.ok) {
      state.adoptionComplete = true;
      state.adoptionRecord = result.record;
    } else {
      state.toast = result.message;
    }
    render();
    return;
  }
});

document.addEventListener("input", (event) => {
  const target = event.target;

  if (target.dataset.field && target.dataset.field in state.farmerForm) {
    state.farmerForm[target.dataset.field] = target.value;
    return;
  }

  if (target.dataset.field === "updateDraft") {
    state.updateDraft = target.value;
    return;
  }

  if (target.dataset.field === "updateTitle") {
    state.updateTitle = target.value;
    return;
  }

  if (target.dataset.field === "paymentSupporterName") {
    state.paymentForm.supporterName = target.value;
    return;
  }

  if (target.dataset.field === "paymentMobile") {
    state.paymentForm.mobile = target.value;
    return;
  }

  if (target.dataset.field === "supporterName") {
    state.supporterProfileDraft.name = target.value;
    return;
  }

  if (target.dataset.field === "supporterMobile") {
    state.supporterProfileDraft.mobile = target.value;
    return;
  }

  if (target.dataset.field === "supporterLocation") {
    state.supporterProfileDraft.location = target.value;
    return;
  }

  if (target.dataset.field === "supporterBio") {
    state.supporterProfileDraft.bio = target.value;
    return;
  }

  if (["authEmail", "authPassword", "authName"].includes(target.dataset.field)) {
    state[target.dataset.field] = target.value;
    state.authMessage = "";
    return;
  }

  if (target.dataset.setting && target.dataset.setting in state.settingsDraft) {
    state.settingsDraft[target.dataset.setting] = target.value;
    return;
  }

  if (target.dataset.filter === "search") {
    state.orchardSearch = target.value;
    render(true);
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;

  if (target.dataset.field && target.dataset.field in state.farmerForm) {
    state.farmerForm[target.dataset.field] = target.value;
    return;
  }

  if (target.dataset.filter === "district") {
    state.districtFilter = target.value;
    render();
  }

  if (target.dataset.field === "updatePhotos") {
    state.updatePhotos = Array.from(target.files || []).map((file) => file.name);
    render();
  }
});

async function bootApp() {
  supabaseBridge.init();
  render();
  await supabaseBridge.loadSession();
  await supabaseBridge.sync();
  render();
}

bootApp();
