"use strict";

const $ = (selector) => document.querySelector(selector);
const CONFIG = window.EE_INDEX_STUDIO_CONFIG || {};
const CITIES = window.GEO_CITIES || [];
const INDICES = window.GEO_INDICES || [];
const STYLES = window.GEO_STYLE_PRESETS || {};

const SCOPE = ["https://www.googleapis.com/auth/earthengine.readonly"];
const EE_AUTH_SCOPE = "https://www.googleapis.com/auth/earthengine";
const EE_AUTH_TIMEOUT_MS = 60000;

const S = {
  map: null,
  aoiLayer: null,
  eeLayer: null,
  connected: false,
  current: null,
  oauthPrepared: false,
  clientId: localStorage.getItem("ee_oauth_client_id") || CONFIG.OAUTH_CLIENT_ID || "",
  projectId: localStorage.getItem("ee_cloud_project_id") || CONFIG.CLOUD_PROJECT_ID || ""
};

function init() {
  initMap();
  fillControls();
  bindEvents();
  updateIndexInfo();
  updateDates();
  drawAoi();
  setStatus([
    "الواجهة جاهزة.",
    "اضغط ربط Earth Engine لفتح نافذة تسجيل الدخول.",
    "إذا لم تفتح النافذة، اسمح بالنوافذ المنبثقة لهذا الموقع."
  ]);
  writeLog("Ready.");
  prepareOauthSilently();
}

function initMap() {
  S.map = L.map("map", { zoomControl: true, preferCanvas: true }).setView([30.0444, 31.2357], 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    crossOrigin: true,
    attribution: "&copy; OpenStreetMap"
  }).addTo(S.map);
}

function fillControls() {
  $("#city").innerHTML = CITIES
    .map((c) => `<option value="${c.id}">${escapeHtml(c.ar)} — ${escapeHtml(c.en)}</option>`)
    .join("");
  $("#city").value = CONFIG.DEFAULT_CITY || "cairo";

  $("#idx").innerHTML = INDICES
    .map((i) => `<option value="${i.id}">${escapeHtml(i.ar)} (${escapeHtml(i.id)})</option>`)
    .join("");
  $("#idx").value = CONFIG.DEFAULT_INDEX || "NDVI";

  $("#style").value = CONFIG.DEFAULT_STYLE || "luxury";
  $("#sensor").value = CONFIG.DEFAULT_SENSOR || "auto";
  $("#email").value = CONFIG.DEFAULT_EMAIL || "";

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1984 }, (_, i) => currentYear - i);
  $("#year").innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join("");
  $("#year").value = String(currentYear - 1);
}

function bindEvents() {
  $("#settingsBtn").addEventListener("click", openSettings);
  $("#saveSettings").addEventListener("click", saveSettings);
  $("#connectBtn").addEventListener("click", () => connectByPopup().catch(handleError));

  $("#form").addEventListener("submit", (event) => {
    event.preventDefault();
    runAnalysis().catch(handleError);
  });

  $("#idx").addEventListener("change", updateIndexInfo);
  $("#year").addEventListener("change", updateDates);
  $("#city").addEventListener("change", drawAoi);
  $("#bbox").addEventListener("change", drawAoi);
  $("#fit").addEventListener("click", fitAoi);
  $("#clear").addEventListener("click", clearLayer);
  $("#reset").addEventListener("click", () => window.location.reload());

  $("#geojson").addEventListener("click", downloadGeoJSON);
  $("#shp").addEventListener("click", () => downloadSHP().catch(handleError));
  $("#png").addEventListener("click", () => downloadPNG().catch(handleError));
  $("#posterpng").addEventListener("click", () => downloadPosterPNG().catch(handleError));
  $("#tif").addEventListener("click", () => downloadTIF().catch(handleError));
  $("#script").addEventListener("click", copyScript);
  $("#report").addEventListener("click", copyReport);
}

function openSettings() {
  $("#clientId").value = S.clientId || "";
  $("#projectId").value = S.projectId || "";
  $("#settings").showModal();
}

function saveSettings() {
  S.clientId = $("#clientId").value.trim();
  S.projectId = $("#projectId").value.trim();
  localStorage.setItem("ee_oauth_client_id", S.clientId);
  localStorage.setItem("ee_cloud_project_id", S.projectId);
  $("#settings").close();
  showToast("تم حفظ الإعدادات محليًا.");
  writeLog("Settings saved locally.");
  prepareOauthSilently();
}

function prepareOauthSilently() {
  S.oauthPrepared = true;
  writeLog("Silent OAuth disabled in v1.0.2. Use connect button for Google Identity Services Token Flow.");
}

async function connectByPopup() {
  if (typeof ee === "undefined" || !ee.data) {
    throw new Error("لم يتم تحميل مكتبة Earth Engine. تحقق من الاتصال بالإنترنت أو من حظر السكربتات الخارجية.");
  }

  if (!window.google || !google.accounts || !google.accounts.oauth2) {
    throw new Error("لم يتم تحميل Google Identity Services. عطّل مانع الإعلانات مؤقتًا أو حدّث الصفحة Ctrl+Shift+R.");
  }

  const clientId = String(S.clientId || "").trim();
  if (!clientId || !clientId.endsWith(".apps.googleusercontent.com")) {
    openSettings();
    throw new Error("OAuth Client ID غير موجود أو غير صحيح. أدخله كاملًا من الإعدادات.");
  }

  setAuth("work");
  setButtons(false);
  setStatus([
    "تم فتح تسجيل الدخول عبر Google.",
    "اختر الحساب ثم وافق على صلاحية Earth Engine إن ظهرت شاشة الموافقة.",
    "إذا لم تكتمل العملية خلال دقيقة، اسمح بالنوافذ المنبثقة والكوكيز ثم جرّب مجددًا."
  ]);
  writeLog("Starting Google Identity Services token flow...");

  return new Promise((resolve, reject) => {
    let completed = false;

    const fail = (message) => {
      if (completed) return;
      completed = true;
      setButtons(true);
      setAuth(false);
      reject(new Error(message));
    };

    const timeoutId = window.setTimeout(() => {
      fail("انتهت مهلة تسجيل الدخول. غالبًا تم حظر النافذة أو لم تكتمل موافقة Google. جرّب نافذة خفية واسمح بالكوكيز والنوافذ المنبثقة.");
    }, EE_AUTH_TIMEOUT_MS);

    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: EE_AUTH_SCOPE,
        prompt: "consent",
        callback: (response) => {
          if (completed) return;
          completed = true;
          window.clearTimeout(timeoutId);

          if (!response) {
            setButtons(true);
            setAuth(false);
            reject(new Error("لم يرجع Google أي استجابة من تسجيل الدخول."));
            return;
          }

          if (response.error) {
            setButtons(true);
            setAuth(false);
            reject(new Error(response.error_description || response.error));
            return;
          }

          if (!response.access_token) {
            setButtons(true);
            setAuth(false);
            reject(new Error("لم يتم الحصول على Access Token. تأكد أن البريد ضمن Test users وأن Earth Engine مفعل للحساب."));
            return;
          }

          const expiresIn = Number(response.expires_in || 3600);
          const projectId = String(S.projectId || "").trim();

          writeLog("Access token received. Passing token to Earth Engine...");

          try {
            ee.data.setAuthToken(
              clientId,
              "Bearer",
              response.access_token,
              expiresIn,
              [EE_AUTH_SCOPE],
              () => {
                writeLog("Auth token set. Initializing Earth Engine...");
                ee.initialize(
                  null,
                  null,
                  () => {
                    S.connected = true;
                    setAuth(true);
                    setButtons(true);
                    setStatus([
                      "تم الاتصال بـ Earth Engine بنجاح.",
                      projectId ? `Cloud Project ID: ${projectId}` : "لم يتم تحديد Cloud Project ID؛ إذا ظهر خطأ لاحقًا ضعه في الإعدادات.",
                      "يمكنك الآن تنفيذ التحليل."
                    ]);
                    writeLog("Earth Engine initialized successfully.");
                    showToast("تم الاتصال بـ Earth Engine.");
                    resolve(true);
                  },
                  (error) => {
                    setButtons(true);
                    setAuth(false);
                    reject(new Error(formatEeError(error)));
                  },
                  null,
                  projectId || undefined
                );
              },
              false,
              true
            );
          } catch (error) {
            setButtons(true);
            setAuth(false);
            reject(error);
          }
        },
        error_callback: (error) => {
          window.clearTimeout(timeoutId);
          fail(error?.message || error?.type || "فشل تسجيل الدخول عبر Google Identity Services.");
        }
      });

      tokenClient.requestAccessToken({ prompt: "consent" });
    } catch (error) {
      window.clearTimeout(timeoutId);
      fail(error?.message || String(error));
    }
  });
}

function formatEeError(error) {
  if (!error) return "فشل تهيئة Earth Engine.";
  if (typeof error === "string") return error;
  if (error.message) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function initializeEarthEngine(source) {
  try {
    ee.initialize(
      null,
      null,
      () => {
        S.connected = true;
        setAuth(true);
        setStatus([
          "تم الاتصال بـ Earth Engine بنجاح.",
          "اختر المؤشر والمدينة والسنة ثم اضغط تنفيذ التحليل."
        ]);
        writeLog(`Earth Engine initialized via ${source}.`);
        showToast("تم الاتصال بـ Earth Engine.");
      },
      (error) => handleError(error)
    );
  } catch (error) {
    handleError(error);
  }
}

async function runAnalysis() {
  if (!S.connected) {
    await connectByPopup();
  }

  const p = readParams();
  validateParams(p);
  setButtons(false);
  setAuth("work");
  writeLog(`Analysis started: ${p.indexId} | ${p.city.en} | ${p.start} → ${p.end}`);

  const aoi = ee.Geometry.Rectangle(p.bbox, null, false);
  const comp = buildComposite(p, aoi);
  const img = computeIndex(comp.image, p.def).rename(p.indexId).clip(aoi);

  // v2 cartographic engine: classify the raw index into meaningful GIS classes
  // instead of drawing a vague single-color continuous rectangle.
  const styled = classifyImageForMap(img, p.def, p.styleId);
  const displayImg = styled.image;
  const vis = styled.vis;

  clearLayer();

  const mapId = await eePromise((resolve, reject) => {
    displayImg.getMap(vis, (data, error) => (error ? reject(error) : resolve(data)));
  });

  S.eeLayer = L.tileLayer(mapId.urlFormat, {
    attribution: "Google Earth Engine",
    opacity: p.styleId === "poster" ? 0.78 : 0.72
  }).addTo(S.map);

  S.current = { p, aoi, img, displayImg, vis, comp, classSpec: styled.classSpec };
  updateLegend(p.def, vis, styled.classSpec);
  $("#title").textContent = `${p.def.ar} — ${p.city.ar} — ${p.year}`;
  drawAoi();
  fitAoi();
  enableExportButtonsV103(true);

  try {
    await updateStats(img, aoi, p.scale, p.indexId);
  } catch (statsError) {
    resetStats();
    writeLog("STATS_WARNING_MEMORY_SAFE_V103: " + safeEeMessageV103(statsError));
    setStatus([
      `تم عرض مؤشر ${p.indexId} على الخريطة بنجاح.`,
      "تعذر حساب الإحصاءات بسبب حد الذاكرة في Earth Engine، لكن أزرار التصدير متاحة الآن.",
      "للمدن الكبيرة: استخدم دقة 100 أو 250 مترًا، أو قلّل مساحة AOI أو الفترة الزمنية."
    ]);
  }

  setButtons(true);
  setAuth(true);
  setStatus([
    `تم تنفيذ مؤشر ${p.indexId}.`,
    `المصدر: ${comp.label}.`,
    `الدقة: ${p.scale} متر.`,
    "تم تحويل القيم الخام إلى طبقات تفسيرية ملوّنة لقراءة التوزيع المكاني بوضوح.",
    "يمكن الآن تنزيل PNG أو GeoTIFF أو نسخ كود التصدير الكبير.",
    "إذا فشل تنزيل GeoTIFF المباشر بسبب الذاكرة، استخدم كود التصدير الكبير."
  ]);
  writeLog("Analysis completed.");
  showToast("تم التحليل بنجاح.");
}

function readParams() {
  const cityDef = CITIES.find((c) => c.id === $("#city").value) || CITIES[0];
  const indexDef = INDICES.find((i) => i.id === $("#idx").value) || INDICES[0];
  const year = Number($("#year").value);
  const bbox = parseBbox($("#bbox").value) || cityDef.bbox;

  return {
    city: cityDef,
    def: indexDef,
    indexId: indexDef.id,
    year,
    start: $("#start").value || `${year}-01-01`,
    end: $("#end").value || `${year}-12-31`,
    bbox,
    sensor: $("#sensor").value,
    styleId: $("#style").value,
    cloud: Number($("#cloud").value || 35),
    scale: Number($("#scale").value || 30),
    email: $("#email").value.trim()
  };
}

function validateParams(p) {
  if (!p.bbox || p.bbox.length !== 4) throw new Error("AOI غير صالح.");
  if (p.start > p.end) throw new Error("تاريخ البداية بعد تاريخ النهاية.");
  if (p.def.forceSensor === "landsat" && p.sensor === "s2") throw new Error("مؤشر LST يحتاج Landsat.");
}

function chooseSensor(p) {
  if (p.def.forceSensor === "landsat") return "landsat";
  if (p.sensor !== "auto") return p.sensor;
  return p.year >= 2017 ? "s2" : "landsat";
}

function buildComposite(p, aoi) {
  if (chooseSensor(p) === "s2") {
    return {
      label: "Sentinel-2 SR Harmonized",
      image: ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(aoi)
        .filterDate(p.start, p.end)
        .filter(ee.Filter.lte("CLOUDY_PIXEL_PERCENTAGE", p.cloud))
        .map(maskS2)
        .median()
    };
  }

  return {
    label: "Landsat Collection 2 Level 2",
    image: buildLandsatCollection(p, aoi).median()
  };
}

function maskS2(img) {
  const scl = img.select("SCL");
  const mask = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10)).and(scl.neq(11));
  return img
    .updateMask(mask)
    .select(["B2", "B3", "B4", "B5", "B8", "B11", "B12"], ["BLUE", "GREEN", "RED", "RE1", "NIR", "SWIR1", "SWIR2"])
    .multiply(0.0001)
    .copyProperties(img, ["system:time_start"]);
}

function buildLandsatCollection(p, aoi) {
  const ids = p.year >= 2021
    ? ["LANDSAT/LC09/C02/T1_L2", "LANDSAT/LC08/C02/T1_L2"]
    : p.year >= 2013
      ? ["LANDSAT/LC08/C02/T1_L2"]
      : p.year >= 1999
        ? ["LANDSAT/LE07/C02/T1_L2"]
        : ["LANDSAT/LT05/C02/T1_L2"];

  return ids
    .map((id) => ee.ImageCollection(id)
      .filterBounds(aoi)
      .filterDate(p.start, p.end)
      .filter(ee.Filter.lte("CLOUD_COVER", p.cloud))
      .map((img) => maskLandsat(img, id)))
    .reduce((a, b) => a.merge(b));
}

function maskLandsat(img, id) {
  const qa = img.select("QA_PIXEL");
  const mask = qa.bitwiseAnd(1 << 4).eq(0)
    .and(qa.bitwiseAnd(1 << 3).eq(0))
    .and(qa.bitwiseAnd(1 << 5).eq(0))
    .and(qa.bitwiseAnd(1 << 1).eq(0));

  const isL89 = id.includes("LC08") || id.includes("LC09");
  const opticalBands = isL89
    ? ["SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B6", "SR_B7"]
    : ["SR_B1", "SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B7"];

  const optical = img
    .select(opticalBands, ["BLUE", "GREEN", "RED", "NIR", "SWIR1", "SWIR2"])
    .multiply(0.0000275)
    .add(-0.2);

  const thermal = img
    .select(isL89 ? "ST_B10" : "ST_B6")
    .multiply(0.00341802)
    .add(149)
    .subtract(273.15)
    .rename("THERMAL");

  return optical.addBands(thermal).updateMask(mask).copyProperties(img, ["system:time_start"]);
}

function computeIndex(img, def) {
  const b = (name) => img.select(name);
  const BLUE = b("BLUE");
  const GREEN = b("GREEN");
  const RED = b("RED");
  const NIR = b("NIR");
  const SWIR1 = b("SWIR1");
  const SWIR2 = b("SWIR2");

  switch (def.id) {
    case "NDVI": return img.normalizedDifference(["NIR", "RED"]);
    case "EVI": return NIR.subtract(RED).multiply(2.5).divide(NIR.add(RED.multiply(6)).subtract(BLUE.multiply(7.5)).add(1));
    case "SAVI": return NIR.subtract(RED).multiply(1.5).divide(NIR.add(RED).add(0.5));
    case "MSAVI": {
      const t = NIR.multiply(2).add(1);
      return t.subtract(t.pow(2).subtract(NIR.subtract(RED).multiply(8)).sqrt()).divide(2);
    }
    case "NDMI": return img.normalizedDifference(["NIR", "SWIR1"]);
    case "GCI": return NIR.divide(GREEN).subtract(1);
    case "NDWI": return img.normalizedDifference(["GREEN", "NIR"]);
    case "MNDWI": return img.normalizedDifference(["GREEN", "SWIR1"]);
    case "AWEI": return GREEN.subtract(SWIR1).multiply(4).subtract(NIR.multiply(0.25).add(SWIR2.multiply(2.75)));
    case "NDBI": return img.normalizedDifference(["SWIR1", "NIR"]);
    case "UI": return img.normalizedDifference(["SWIR2", "NIR"]);
    case "BSI": return SWIR1.add(RED).subtract(NIR.add(BLUE)).divide(SWIR1.add(RED).add(NIR).add(BLUE));
    case "NBR": return img.normalizedDifference(["NIR", "SWIR2"]);
    case "NDSI": return img.normalizedDifference(["GREEN", "SWIR1"]);
    case "LST": return b("THERMAL");
    default: throw new Error("مؤشر غير معروف.");
  }
}


function getClassSpec(def, styleId) {
  const id = def.id;
  const luxury = styleId === "luxury" || styleId === "poster";
  const thermal = styleId === "thermal";

  const specs = {
    NDVI: {
      min: 1, max: 5,
      breaks: [-0.05, 0.15, 0.35, 0.55],
      palette: luxury ? ["#263238", "#b45309", "#facc15", "#65a30d", "#14532d"] : ["#7f1d1d", "#f97316", "#fde047", "#65a30d", "#166534"],
      labels: ["ماء/ظل أو قيم سالبة", "غطاء نباتي ضعيف", "غطاء نباتي متوسط", "غطاء نباتي جيد", "غطاء نباتي كثيف"]
    },
    EVI: {
      min: 1, max: 5,
      breaks: [0.05, 0.18, 0.35, 0.55],
      palette: ["#7f1d1d", "#f97316", "#fde047", "#65a30d", "#14532d"],
      labels: ["منخفض جدًا", "منخفض", "متوسط", "مرتفع", "مرتفع جدًا"]
    },
    SAVI: {
      min: 1, max: 5,
      breaks: [0.05, 0.18, 0.35, 0.55],
      palette: ["#7f1d1d", "#f97316", "#fde047", "#65a30d", "#14532d"],
      labels: ["سطح عارٍ/ضعيف", "نبات ضعيف", "نبات متوسط", "نبات جيد", "نبات كثيف"]
    },
    MSAVI: {
      min: 1, max: 5,
      breaks: [0.05, 0.18, 0.35, 0.55],
      palette: ["#7f1d1d", "#f97316", "#fde047", "#65a30d", "#14532d"],
      labels: ["سطح عارٍ", "ضعيف", "متوسط", "جيد", "كثيف"]
    },
    NDMI: {
      min: 1, max: 5,
      breaks: [-0.25, -0.05, 0.15, 0.35],
      palette: ["#7c2d12", "#d97706", "#fde68a", "#2dd4bf", "#0f766e"],
      labels: ["جفاف شديد", "جفاف", "رطوبة منخفضة", "رطوبة متوسطة", "رطوبة مرتفعة"]
    },
    GCI: {
      min: 1, max: 5,
      breaks: [0.2, 0.8, 1.6, 3.0],
      palette: ["#7f1d1d", "#f97316", "#fde047", "#65a30d", "#14532d"],
      labels: ["كلوروفيل منخفض جدًا", "منخفض", "متوسط", "مرتفع", "مرتفع جدًا"]
    },
    NDWI: {
      min: 1, max: 5,
      breaks: [-0.30, -0.05, 0.15, 0.35],
      palette: ["#7c2d12", "#f59e0b", "#d9f99d", "#38bdf8", "#075985"],
      labels: ["جاف/عمران", "رطوبة ضعيفة", "رطوبة متوسطة", "مياه محتملة", "مياه واضحة"]
    },
    MNDWI: {
      min: 1, max: 5,
      breaks: [-0.25, 0.0, 0.20, 0.45],
      palette: ["#7c2d12", "#f59e0b", "#d9f99d", "#38bdf8", "#075985"],
      labels: ["غير مائي", "رطوبة ضعيفة", "رطوبة/قنوات محتملة", "مياه سطحية", "مياه واضحة"]
    },
    AWEI: {
      min: 1, max: 5,
      breaks: [-1.5, -0.5, 0.5, 1.5],
      palette: ["#7c2d12", "#f59e0b", "#d9f99d", "#38bdf8", "#075985"],
      labels: ["غير مائي", "ضعيف", "انتقال", "مياه محتملة", "مياه قوية"]
    },
    NDBI: {
      min: 1, max: 5,
      breaks: [-0.15, 0.0, 0.12, 0.25],
      palette: luxury ? ["#0f766e", "#a3e635", "#fde047", "#f97316", "#dc2626"] : ["#2dd4bf", "#bef264", "#fde047", "#fb923c", "#b91c1c"],
      labels: ["غير عمراني/نبات أو ماء", "عمران منخفض", "عمران متوسط", "عمران مرتفع", "نواة عمرانية كثيفة"]
    },
    UI: {
      min: 1, max: 5,
      breaks: [-0.15, 0.0, 0.12, 0.25],
      palette: ["#0f766e", "#a3e635", "#fde047", "#f97316", "#dc2626"],
      labels: ["غير عمراني", "منخفض", "متوسط", "مرتفع", "كثيف"]
    },
    BSI: {
      min: 1, max: 5,
      breaks: [-0.20, 0.0, 0.20, 0.40],
      palette: ["#1d4ed8", "#84cc16", "#facc15", "#d97706", "#7c2d12"],
      labels: ["ماء/نبات", "تربة قليلة الظهور", "تربة مكشوفة متوسطة", "تربة عارية", "تربة/سطوح عارية شديدة"]
    },
    NBR: {
      min: 1, max: 5,
      breaks: [-0.30, -0.10, 0.10, 0.30],
      palette: ["#7f1d1d", "#ef4444", "#facc15", "#86efac", "#166534"],
      labels: ["حرق/تدهور شديد", "تدهور", "انتقال", "نبات متوسط", "نبات/تعافٍ جيد"]
    },
    NDSI: {
      min: 1, max: 5,
      breaks: [-0.10, 0.10, 0.25, 0.40],
      palette: ["#7c2d12", "#f59e0b", "#bae6fd", "#60a5fa", "#ffffff"],
      labels: ["غير ثلجي", "انتقال", "ثلج ضعيف", "ثلج متوسط", "ثلج واضح"]
    },
    LST: {
      min: 1, max: 5,
      breaks: [25, 32, 38, 45],
      palette: thermal ? ["#1d4ed8", "#38bdf8", "#facc15", "#f97316", "#b91c1c"] : ["#2563eb", "#67e8f9", "#fde047", "#f97316", "#dc2626"],
      labels: ["بارد", "معتدل", "دافئ", "حار", "حار جدًا"]
    }
  };

  return specs[id] || {
    min: 1, max: 5,
    breaks: [def.min + (def.max - def.min) * 0.2, def.min + (def.max - def.min) * 0.4, def.min + (def.max - def.min) * 0.6, def.min + (def.max - def.min) * 0.8],
    palette: ["#1d4ed8", "#67e8f9", "#fde047", "#f97316", "#dc2626"],
    labels: ["منخفض جدًا", "منخفض", "متوسط", "مرتفع", "مرتفع جدًا"]
  };
}

function classifyImageForMap(img, def, styleId) {
  const spec = getClassSpec(def, styleId);
  let classified = ee.Image(1);
  spec.breaks.forEach((breakValue, i) => {
    classified = classified.where(img.gte(breakValue), i + 2);
  });
  classified = classified.updateMask(img.mask()).rename(`${def.id}_class`);
  return { image: classified, vis: { min: spec.min, max: spec.max, palette: spec.palette }, classSpec: spec };
}

function makeClassLegendHtml(spec) {
  if (!spec || !spec.labels) return "";
  return spec.labels.map((label, i) => {
    const color = spec.palette[i] || "#ccc";
    return `<span class="class-chip"><i style="background:${color}"></i>${escapeHtml(label)}</span>`;
  }).join("");
}


function getVisParams(def, styleId) {
  const preset = STYLES[styleId] || STYLES.luxury || STYLES.classic;
  const palette = preset.palettes[def.family] || preset.palettes.vegetation;
  return { min: def.min, max: def.max, palette };
}


function enableExportButtonsV103(enabled) {
  ["png", "posterpng", "tif", "shp", "script", "report"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !enabled;
  });
}

function safeEeMessageV103(error) {
  if (!error) return "Unknown Earth Engine error";
  if (typeof error === "string") return error;
  if (error.message) return error.message;
  try { return JSON.stringify(error); } catch { return String(error); }
}

async function updateStats(img, aoi, scale, band) {
  const reducer = ee.Reducer.mean()
    .combine({ reducer2: ee.Reducer.minMax(), sharedInputs: true })
    .combine({ reducer2: ee.Reducer.stdDev(), sharedInputs: true });

  const stats = await eePromise((resolve, reject) => {
    img.reduceRegion({
      reducer,
      geometry: aoi,
      scale: Math.max(Number(scale) || 30, 250),
      bestEffort: true,
      tileScale: 8,
      maxPixels: 1e7
    }).evaluate((data, error) => (error ? reject(error) : resolve(data)));
  });

  $("#mean").textContent = formatNumber(stats[`${band}_mean`]);
  $("#min").textContent = formatNumber(stats[`${band}_min`]);
  $("#max").textContent = formatNumber(stats[`${band}_max`]);
  $("#std").textContent = formatNumber(stats[`${band}_stdDev`]);
}

function updateIndexInfo() {
  const def = INDICES.find((x) => x.id === $("#idx").value) || INDICES[0];
  $("#desc").textContent = def.description;
  $("#formula").textContent = def.formula;
  if (def.forceSensor) $("#sensor").value = "landsat";
}

function updateDates() {
  const y = Number($("#year").value);
  $("#start").value = `${y}-01-01`;
  $("#end").value = `${y}-12-31`;
}

function drawAoi() {
  if (!S.map) return;
  const cityDef = CITIES.find((c) => c.id === $("#city").value) || CITIES[0];
  const bbox = parseBbox($("#bbox").value) || cityDef.bbox;
  const [x1, y1, x2, y2] = bbox;

  if (S.aoiLayer) S.map.removeLayer(S.aoiLayer);
  S.aoiLayer = L.rectangle([[y1, x1], [y2, x2]], {
    color: "#22d3ee",
    weight: 2,
    fillColor: "#22d3ee",
    fillOpacity: 0.055,
    dashArray: "6 6"
  }).addTo(S.map);
}

function fitAoi() {
  const cityDef = CITIES.find((c) => c.id === $("#city").value) || CITIES[0];
  const bbox = parseBbox($("#bbox").value) || cityDef.bbox;
  const [x1, y1, x2, y2] = bbox;
  S.map.fitBounds([[y1, x1], [y2, x2]], { padding: [24, 24] });
}

function clearLayer() {
  if (S.eeLayer) {
    S.map.removeLayer(S.eeLayer);
    S.eeLayer = null;
  }
}

function updateLegend(def, vis, classSpec) {
  $("#legendName").textContent = `${def.id} — ${def.ar}`;
  $("#legendRange").textContent = classSpec ? "تصنيف تفسيري GIS" : `${def.min} → ${def.max}`;
  $("#ramp").style.background = `linear-gradient(90deg, ${vis.palette.join(",")})`;

  let classes = document.getElementById("classLegend");
  if (!classes) {
    classes = document.createElement("div");
    classes.id = "classLegend";
    classes.className = "class-legend";
    document.querySelector(".legend").appendChild(classes);
  }
  classes.innerHTML = classSpec ? makeClassLegendHtml(classSpec) : "";
}

function makeGeoJSON() {
  const p = readParams();
  const [x1, y1, x2, y2] = p.bbox;
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: {
        city_ar: p.city.ar,
        city_en: p.city.en,
        index: p.indexId,
        year: p.year,
        signature: CONFIG.APP_SIGNATURE || "kamel3lom"
      },
      geometry: {
        type: "Polygon",
        coordinates: [[[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]]]
      }
    }]
  };
}

function downloadGeoJSON() {
  const p = readParams();
  downloadText(`AOI_${safeName(p.city.en)}_${p.year}.geojson`, JSON.stringify(makeGeoJSON(), null, 2), "application/geo+json");
}

async function downloadSHP() {
  if (!S.connected) return showToast("اتصل بـ Earth Engine أولًا.");
  const p = readParams();
  const aoi = ee.Geometry.Rectangle(p.bbox, null, false);
  const fc = ee.FeatureCollection([ee.Feature(aoi, { city: p.city.en, index: p.indexId, year: p.year })]);
  const url = await eePromise((resolve, reject) => {
    fc.getDownloadURL({ format: "SHP", filename: `AOI_${safeName(p.city.en)}_${p.year}` }, (data, error) => (error ? reject(error) : resolve(data)));
  });
  openUrl(url);
}

async function downloadPNG() {
  ensureAnalysis();
  const { p, displayImg, vis } = S.current;
  const visual = displayImg.visualize(vis);

  try {
    const url = await eePromise((resolve, reject) => {
      visual.getThumbURL({
        region: ee.Geometry.Rectangle(p.bbox, null, false),
        dimensions: 1200,
        format: "png"
      }, (data, error) => (error ? reject(error) : resolve(data)));
    });
    openUrl(url);
  } catch (error) {
    writeLog("PNG_DOWNLOAD_WARNING_V103: " + safeEeMessageV103(error));
    const url = await eePromise((resolve, reject) => {
      visual.getThumbURL({
        region: ee.Geometry.Rectangle(p.bbox, null, false),
        dimensions: 800,
        format: "png"
      }, (data, err) => (err ? reject(err) : resolve(data)));
    });
    openUrl(url);
  }
}

async function downloadPosterPNG() {
  ensureAnalysis();
  if (!window.html2canvas) {
    throw new Error("مكتبة تصدير البوستر لم تُحمّل. حدّث الصفحة أو تحقق من اتصال الإنترنت.");
  }

  const target = document.querySelector(".mapbox");
  const canvas = await html2canvas(target, {
    backgroundColor: "#07111f",
    scale: 2,
    useCORS: true,
    allowTaint: true,
    logging: false
  });

  const { p } = S.current;
  canvas.toBlob((blob) => {
    if (!blob) {
      showToast("تعذر إنشاء صورة البوستر.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GeoIndex_Poster_${p.indexId}_${safeName(p.city.en)}_${p.year}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }, "image/png", 0.96);
}

async function downloadTIF() {
  ensureAnalysis();
  const { p, img } = S.current;
  const directScale = Math.max(Number(p.scale) || 30, 100);

  try {
    const url = await eePromise((resolve, reject) => {
      img.getDownloadURL({
        name: `${p.indexId}_${safeName(p.city.en)}_${p.year}`,
        region: ee.Geometry.Rectangle(p.bbox, null, false),
        scale: directScale,
        crs: "EPSG:4326",
        fileFormat: "GeoTIFF"
      }, (data, error) => (error ? reject(error) : resolve(data)));
    });
    openUrl(url);
  } catch (error) {
    writeLog("GEOTIFF_DOWNLOAD_ERROR_V103: " + safeEeMessageV103(error));
    showToast("تعذر تنزيل GeoTIFF مباشرة بسبب حجم المنطقة/الذاكرة. انسخ كود التصدير الكبير وشغّله في Earth Engine Code Editor.");
    throw error;
  }
}

function copyScript() {
  ensureAnalysis();
  const { p } = S.current;
  const bbox = JSON.stringify(p.bbox);
  const vis = getVisParams(p.def, p.styleId);
  const palette = JSON.stringify(vis.palette);
  const code = `// Earth Engine Code Editor export script\n// Generated by Earth Engine Index Studio — ${CONFIG.APP_SIGNATURE || "kamel3lom"}\n\nvar aoi = ee.Geometry.Rectangle(${bbox}, null, false);\nvar startDate = '${p.start}';\nvar endDate = '${p.end}';\nvar cloudMax = ${p.cloud};\nvar scale = ${p.scale};\nvar indexId = '${p.indexId}';\n\n// Paste the full processing functions from the app README if you need large exports.\n// This quick script documents the selected export target.\nprint('AOI', aoi);\nprint('Index', indexId);\nprint('Palette', ${palette});\n\n// Use the app direct GeoTIFF/PNG buttons for small/medium areas.\n// For production exports, rebuild the same index in Earth Engine Code Editor and use Export.image.toDrive.\n`;
  copyText(code);
}

function copyReport() {
  ensureAnalysis();
  const p = S.current.p;
  const report = [
    "Earth Engine Index Studio",
    `Signature: ${CONFIG.APP_SIGNATURE || "kamel3lom"}`,
    `Email: ${p.email || "غير محدد"}`,
    `City: ${p.city.ar}/${p.city.en}`,
    `Index: ${p.indexId}`,
    `Year: ${p.year}`,
    `Period: ${p.start} to ${p.end}`,
    `Mean: ${$("#mean").textContent}`,
    `Min: ${$("#min").textContent}`,
    `Max: ${$("#max").textContent}`,
    `Std: ${$("#std").textContent}`
  ].join("\n");
  copyText(report);
}

function parseBbox(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parts = text.split(",").map((x) => Number(x.trim()));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    showToast("BBOX غير صحيح.");
    return null;
  }
  return parts;
}

function setStatus(items) {
  $("#status").innerHTML = items.map((x) => `<li>${escapeHtml(x)}</li>`).join("");
}

function setAuth(state) {
  const el = $("#authState");
  el.className = "dot " + (state === true ? "on" : state === "work" ? "work" : "off");
  el.textContent = state === true ? "متصل" : state === "work" ? "جارٍ التنفيذ" : "غير متصل";
}

function setButtons(enabled) {
  ["#connectBtn", "#settingsBtn", "#reset", "#fit", "#clear"].forEach((id) => {
    const btn = $(id);
    if (btn) btn.disabled = !enabled;
  });
  const submit = $("#form button[type='submit']");
  if (submit) submit.disabled = !enabled;
}

function ensureAnalysis() {
  if (!S.current) throw new Error("نفّذ التحليل أولًا.");
}

function eePromise(fn) {
  return new Promise(fn);
}

function formatNumber(value) {
  return value == null || Number.isNaN(Number(value)) ? "—" : Number(value).toFixed(4);
}

function safeName(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

function downloadText(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openUrl(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
  showToast("تم النسخ.");
}

function writeLog(message) {
  const el = $("#log");
  el.textContent = `[${new Date().toLocaleTimeString("ar")}] ${message}\n` + el.textContent;
}

function showToast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.classList.remove("show"), 3000);
}

function handleError(error) {
  setButtons(true);
  setAuth(S.connected ? true : false);
  const message = error?.message || String(error);
  writeLog("ERROR: " + message);
  setStatus(["حدث خطأ.", message]);
  showToast(message);
  console.error(error);
}

window.addEventListener("DOMContentLoaded", init);
