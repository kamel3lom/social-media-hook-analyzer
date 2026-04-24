/* Social Media Hook Analyzer
 * A client-side rule-based analyzer for social media hooks.
 * No external dependencies. No server. Works on GitHub Pages.
 */

"use strict";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const state = {
  latest: null,
  installPrompt: null
};

const platformProfiles = {
  youtube: {
    label: "يوتيوب",
    idealMin: 38,
    idealMax: 72,
    maxLen: 100,
    style: "وعد واضح + نتيجة ملموسة + كلمة مفتاحية قابلة للبحث",
    weight: { clarity: 1.2, benefit: 1.25, curiosity: 1.05, specificity: 1.1, brevity: 0.9 }
  },
  tiktok: {
    label: "تيك توك",
    idealMin: 12,
    idealMax: 45,
    maxLen: 80,
    style: "ضربة سريعة + فضول مباشر + صياغة محكية خفيفة دون إطالة",
    weight: { clarity: 1.0, benefit: 1.0, curiosity: 1.3, specificity: 0.9, brevity: 1.25 }
  },
  instagram: {
    label: "إنستغرام",
    idealMin: 18,
    idealMax: 58,
    maxLen: 90,
    style: "جملة مشوقة + فائدة قابلة للحفظ + لمسة بصرية/شخصية",
    weight: { clarity: 1.05, benefit: 1.15, curiosity: 1.15, specificity: 1.0, brevity: 1.05 }
  },
  x: {
    label: "X / تويتر",
    idealMin: 20,
    idealMax: 95,
    maxLen: 260,
    style: "تكثيف حاد + رأي أو فائدة واضحة + قابلية للنقاش",
    weight: { clarity: 1.2, benefit: 1.05, curiosity: 1.05, specificity: 1.0, brevity: 1.05 }
  },
  facebook: {
    label: "فيسبوك",
    idealMin: 28,
    idealMax: 120,
    maxLen: 240,
    style: "سرد قصير + وعد واضح + سؤال أو موقف يفتح التعليقات",
    weight: { clarity: 1.1, benefit: 1.05, curiosity: 1.0, specificity: 1.0, brevity: 0.85 }
  },
  linkedin: {
    label: "لينكدإن",
    idealMin: 42,
    idealMax: 140,
    maxLen: 240,
    style: "قيمة مهنية + خبرة أو درس + لغة موثوقة لا تستجدي الانتباه",
    weight: { clarity: 1.25, benefit: 1.25, curiosity: 0.85, specificity: 1.15, brevity: 0.85 }
  },
  general: {
    label: "عام",
    idealMin: 24,
    idealMax: 85,
    maxLen: 180,
    style: "وضوح + فائدة + فضول دون تضليل",
    weight: { clarity: 1.1, benefit: 1.1, curiosity: 1.1, specificity: 1.05, brevity: 1.0 }
  }
};

const contentTypeLabels = {
  educational: "تعليمي",
  news: "خبر",
  story: "قصة",
  offer: "عرض/خدمة",
  debate: "جدلي",
  entertainment: "ترفيهي",
  portfolio: "عرض أعمال"
};

const toneLabels = {
  professional: "احترافية",
  curious: "فضولية",
  bold: "قوية",
  friendly: "ودية",
  academic: "أكاديمية",
  dramatic: "درامية"
};

const lexicon = {
  ar: {
    question: ["كيف", "لماذا", "متى", "أين", "هل", "ما", "ماذا", "كم"],
    benefit: ["تعلم", "طريقة", "خطوات", "دليل", "شرح", "نتيجة", "حل", "أداة", "أفضل", "أسرع", "احترافي", "مجاني", "دقيق", "قالب", "برومبت", "خطة", "تجربة"],
    curiosity: ["سر", "خطأ", "أخطر", "لا يعرف", "لن تصدق", "قبل", "بعد", "الحقيقة", "سبب", "مفاجأة", "مخفي", "يكشف", "يفشل", "ينجح"],
    specificity: ["رقم", "أرقام", "دراسة", "خريطة", "مثال", "حالة", "قبل وبعد", "2026", "3", "5", "7", "10", "%"],
    emotion: ["مذهل", "صادم", "قوي", "خطير", "مهم", "فاخر", "مبهر", "غريب", "مرعب", "مؤلم"],
    cta: ["احفظ", "شارك", "اكتب", "جرّب", "شاهد", "تابع", "اضغط", "اسأل", "علّق"],
    weak: ["جميل", "رائع", "مميز", "شيء", "أشياء", "موضوع", "بعض", "متنوع", "عام"],
    clickbait: ["لن تصدق", "صدمة", "كارثة", "خطير جدا", "لا يفوتك", "أقوى شيء", "سر رهيب"]
  },
  en: {
    question: ["how", "why", "when", "where", "what", "which", "can", "will"],
    benefit: ["learn", "guide", "steps", "method", "tool", "template", "better", "faster", "free", "professional", "result", "fix", "workflow"],
    curiosity: ["secret", "mistake", "truth", "hidden", "before", "after", "revealed", "fails", "works", "why"],
    specificity: ["case", "example", "study", "map", "2026", "3", "5", "7", "10", "%"],
    emotion: ["powerful", "shocking", "smart", "serious", "important", "premium", "strange"],
    cta: ["save", "share", "try", "watch", "follow", "comment", "ask", "click"],
    weak: ["nice", "great", "things", "stuff", "topic", "various", "amazing"],
    clickbait: ["you won't believe", "shocking", "insane", "crazy", "must watch", "secret trick"]
  }
};

const templatesAr = {
  educational: [
    "كيف {verb} {topic} دون {pain}؟",
    "{number} خطوات لتحويل {topic} إلى نتيجة واضحة",
    "قبل أن تستخدم {topic}: انتبه إلى هذا الخطأ",
    "دليل سريع: كيف تبدأ في {topic} من الصفر؟",
    "الطريقة العملية لفهم {topic} دون تعقيد"
  ],
  news: [
    "ما الذي تغيّر في {topic}؟ شرح سريع دون تهويل",
    "{topic}: أهم ما حدث ولماذا يهمك",
    "تحديث مهم حول {topic}: الخلاصة في دقيقة",
    "ما وراء خبر {topic}: التأثير الحقيقي"
  ],
  story: [
    "جربت {topic} وكانت النتيجة غير متوقعة",
    "ما تعلمته بعد تجربة {topic} عمليًا",
    "قصة قصيرة تكشف خطأ شائعًا في {topic}",
    "من الفكرة إلى النتيجة: تجربتي مع {topic}"
  ],
  offer: [
    "هل تحتاج إلى {topic}؟ هذا ما يمكن إنجازه لك",
    "خدمة {topic}: نتيجة أوضح ووقت أقل",
    "قبل طلب خدمة {topic}: اعرف ما الذي ستحصل عليه",
    "حوّل {topic} إلى عمل احترافي جاهز للاستخدام"
  ],
  debate: [
    "المشكلة ليست في {topic}… بل في طريقة استخدامه",
    "لماذا يفشل كثيرون في {topic} رغم توفر الأدوات؟",
    "رأي صريح: {topic} ليس حلًا سحريًا",
    "أكبر وهم منتشر حول {topic}"
  ],
  entertainment: [
    "تحدي {topic}: النتيجة فاجأتني",
    "ماذا يحدث لو استخدمنا {topic} بهذه الطريقة؟",
    "تجربة سريعة مع {topic} تستحق المشاهدة",
    "جانب غريب في {topic} لا ينتبه له كثيرون"
  ],
  portfolio: [
    "من بيانات عادية إلى نتيجة احترافية: هذا مثال على {topic}",
    "قبل وبعد: كيف تغيّر {topic} بهذه المعالجة؟",
    "نموذج عمل جديد في {topic} — النتيجة النهائية",
    "كيف صممت هذا العمل في {topic} خطوة بخطوة؟"
  ]
};

const templatesEn = {
  educational: [
    "How to use {topic} without {pain}",
    "{number} practical steps to improve {topic}",
    "Before you try {topic}, avoid this mistake",
    "A simple guide to mastering {topic}",
    "The practical way to understand {topic}"
  ],
  news: [
    "What changed in {topic} and why it matters",
    "{topic}: the key update in plain language",
    "The real impact behind {topic}",
    "A quick breakdown of the latest {topic} update"
  ],
  story: [
    "I tested {topic}, and the result surprised me",
    "What I learned after trying {topic}",
    "A short story that exposes a common {topic} mistake",
    "From idea to result: my experience with {topic}"
  ],
  offer: [
    "Need {topic}? Here is what can be done",
    "{topic} service: clearer results in less time",
    "Before ordering {topic}, know what you should get",
    "Turn {topic} into a professional deliverable"
  ],
  debate: [
    "The problem is not {topic} — it is how people use it",
    "Why many creators fail at {topic}",
    "Honest take: {topic} is not magic",
    "The biggest myth about {topic}"
  ],
  entertainment: [
    "{topic} challenge: the result was unexpected",
    "What happens when we use {topic} this way?",
    "A quick {topic} experiment worth watching",
    "The strange side of {topic} people miss"
  ],
  portfolio: [
    "From raw input to a professional result: {topic}",
    "Before and after: how {topic} changed the outcome",
    "A new {topic} project — final result",
    "How I built this {topic} work step by step"
  ]
};

const stopWordsAr = new Set(["في", "من", "على", "عن", "إلى", "الى", "هذا", "هذه", "ذلك", "التي", "الذي", "مع", "أو", "و", "ثم", "كما", "هل", "كيف", "لماذا"]);
const stopWordsEn = new Set(["the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with", "how", "why", "what", "this", "that", "is", "are"]);

function normalizeText(text) {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'");
}

function isArabic(text) {
  return /[\u0600-\u06FF]/.test(text);
}

function tokenize(text) {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}%#]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function countMatches(tokens, words, originalText = "") {
  const lower = originalText.toLowerCase();
  let score = 0;
  words.forEach((word) => {
    const w = word.toLowerCase();
    if (w.includes(" ")) {
      if (lower.includes(w)) score += 1;
    } else if (tokens.includes(w)) {
      score += 1;
    }
  });
  return score;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function weightedAverage(metrics, weights) {
  const keys = Object.keys(metrics);
  let totalWeight = 0;
  let total = 0;

  keys.forEach((key) => {
    const w = weights[key] || 1;
    total += metrics[key] * w;
    totalWeight += w;
  });

  return totalWeight ? total / totalWeight : 0;
}

function analyzeHook(input) {
  const text = normalizeText(input.text);
  const platform = platformProfiles[input.platform] || platformProfiles.general;
  const lang = isArabic(text) ? "ar" : "en";
  const lex = lexicon[lang];
  const tokens = tokenize(text);
  const length = text.length;
  const wordCount = tokens.length;
  const hasQuestion = /[؟?]/.test(text) || countMatches(tokens, lex.question, text) > 0;
  const hasNumber = /(\d+|[٠-٩]+|%|٪)/.test(text);
  const hasColon = /[:：]/.test(text);
  const hasDash = /[-–—]/.test(text);
  const hasKeyword = input.mainKeyword ? text.toLowerCase().includes(input.mainKeyword.toLowerCase()) : true;

  const benefitHits = countMatches(tokens, lex.benefit, text);
  const curiosityHits = countMatches(tokens, lex.curiosity, text);
  const specificityHits = countMatches(tokens, lex.specificity, text) + (hasNumber ? 1 : 0);
  const emotionHits = countMatches(tokens, lex.emotion, text);
  const ctaHits = countMatches(tokens, lex.cta, text);
  const weakHits = countMatches(tokens, lex.weak, text);
  const clickbaitHits = countMatches(tokens, lex.clickbait, text);

  const clarityBase = wordCount >= 3 ? 55 : 25;
  const clarity = clamp(
    clarityBase +
      (hasQuestion ? 8 : 0) +
      (hasColon || hasDash ? 7 : 0) +
      (benefitHits ? 12 : 0) -
      weakHits * 9 -
      (wordCount > 22 ? 10 : 0),
    0,
    100
  );

  const benefit = clamp(32 + benefitHits * 18 + ctaHits * 8 + (input.goal === "trust" ? 5 : 0) + (hasKeyword ? 5 : -10), 0, 100);

  const curiosity = clamp(28 + curiosityHits * 18 + (hasQuestion ? 14 : 0) + emotionHits * 7 + (hasNumber ? 8 : 0), 0, 100);

  const specificity = clamp(25 + specificityHits * 18 + (hasNumber ? 17 : 0) + (input.audience ? 8 : 0) + (input.mainKeyword ? 12 : 0), 0, 100);

  const lengthPenalty = length < platform.idealMin
    ? (platform.idealMin - length) * 1.2
    : length > platform.idealMax
      ? (length - platform.idealMax) * 0.85
      : 0;

  const brevity = clamp(92 - lengthPenalty - Math.max(0, wordCount - 18) * 1.5, 0, 100);

  const platformFit = clamp(
    55 +
      (length >= platform.idealMin && length <= platform.idealMax ? 25 : 0) +
      (input.platform === "x" && length <= 220 ? 8 : 0) +
      (input.platform === "tiktok" && hasQuestion ? 8 : 0) +
      (input.platform === "youtube" && (benefitHits || input.mainKeyword) ? 8 : 0) +
      (input.platform === "linkedin" && weakHits === 0 ? 6 : 0) -
      clickbaitHits * 8,
    0,
    100
  );

  let metrics = { clarity, benefit, curiosity, specificity, brevity, platformFit };
  let score = Math.round(weightedAverage(metrics, platform.weight));

  if (input.avoidClickbait) {
    score = clamp(score - clickbaitHits * 7, 0, 100);
  }

  const diagnosis = buildDiagnosis({
    text,
    lang,
    platform,
    input,
    metrics,
    length,
    wordCount,
    benefitHits,
    curiosityHits,
    specificityHits,
    weakHits,
    clickbaitHits,
    hasQuestion,
    hasNumber
  });

  const suggestions = generateSuggestions({
    text,
    lang: input.language,
    detectedLang: lang,
    input,
    score,
    metrics
  });

  return {
    id: cryptoRandomId(),
    createdAt: new Date().toISOString(),
    input,
    score,
    label: getScoreLabel(score),
    summary: getScoreSummary(score, platform),
    metrics,
    diagnosis,
    suggestions
  };
}

function buildDiagnosis(ctx) {
  const items = [];
  const platform = ctx.platform;

  if (!ctx.text) {
    return ["لم يتم إدخال نص للتحليل."];
  }

  if (ctx.length < platform.idealMin) {
    items.push(`النص قصير جدًا لمنصة ${platform.label}. يحتاج وعدًا أوضح أو فائدة أكثر تحديدًا.`);
  }

  if (ctx.length > platform.idealMax) {
    items.push(`النص أطول من المثالي لمنصة ${platform.label}. اختصره أو انقل التفاصيل إلى الوصف.`);
  }

  if (ctx.benefitHits === 0) {
    items.push("الفائدة غير ظاهرة بما يكفي. أضف نتيجة واضحة: ماذا سيكسب القارئ أو المشاهد؟");
  }

  if (ctx.curiosityHits === 0 && !ctx.hasQuestion) {
    items.push("عنصر الفضول ضعيف. أضف سؤالًا أو مفارقة أو خطأ شائعًا دون تضليل.");
  }

  if (ctx.specificityHits === 0 && !ctx.hasNumber) {
    items.push("العنوان عام. الأرقام، المقارنة، المثال، أو كلمة مفتاحية محددة سترفع قوته.");
  }

  if (ctx.weakHits > 0) {
    items.push("هناك كلمات عامة مثل: رائع/جميل/أشياء. استبدلها بنتيجة أو مشكلة محددة.");
  }

  if (ctx.clickbaitHits > 0) {
    items.push("توجد رائحة Clickbait. اجعل الوعد قويًا لكن قابلًا للتصديق حتى لا تخسر الثقة.");
  }

  if (ctx.metrics.platformFit < 60) {
    items.push(`صياغة الهوك لا تطابق تمامًا طبيعة ${platform.label}. النمط الأنسب: ${platform.style}.`);
  }

  if (items.length === 0) {
    items.push("الهوك جيد من حيث الوضوح والفائدة والفضول. يمكن تحسينه بإضافة رقم أو نتيجة أكثر تحديدًا.");
  }

  return items.slice(0, 6);
}

function getScoreLabel(score) {
  if (score >= 85) return "هوك قوي جدًا";
  if (score >= 72) return "هوك جيد";
  if (score >= 58) return "هوك متوسط";
  if (score >= 40) return "هوك ضعيف يحتاج تحسينًا";
  return "هوك ضعيف جدًا";
}

function getScoreSummary(score, platform) {
  if (score >= 85) return `العنوان مناسب جدًا لمنصة ${platform.label}. يحتاج فقط اختبار نسخة بديلة A/B.`;
  if (score >= 72) return `العنوان صالح للنشر، لكن يمكن رفعه بإضافة فائدة أدق أو فضول أنظف.`;
  if (score >= 58) return `الفكرة مفهومة، لكن الهوك لا يزال متوسط التأثير. يحتاج وضوحًا وفائدة أقوى.`;
  if (score >= 40) return `العنوان لا يلتقط الانتباه بما يكفي. أعد بناءه حول نتيجة أو مشكلة محددة.`;
  return `العنوان عام أو غامض. يحتاج صياغة جديدة لا ترقيعًا بسيطًا.`;
}

function extractTopic(text, mainKeyword) {
  if (mainKeyword && mainKeyword.trim()) return mainKeyword.trim();

  const lang = isArabic(text) ? "ar" : "en";
  const stops = lang === "ar" ? stopWordsAr : stopWordsEn;
  const tokens = tokenize(text)
    .filter((t) => !stops.has(t))
    .filter((t) => t.length > 2 && !/^\d+$/.test(t));

  if (!tokens.length) return lang === "ar" ? "هذه الفكرة" : "this idea";

  const freq = {};
  tokens.forEach((t) => {
    freq[t] = (freq[t] || 0) + 1;
  });

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word)
    .join(" ");
}

function inferPain(contentType, lang) {
  if (lang === "en") {
    const map = {
      educational: "confusion",
      news: "hype",
      story: "guesswork",
      offer: "wasting time",
      debate: "common myths",
      entertainment: "boring intros",
      portfolio: "weak presentation"
    };
    return map[contentType] || "mistakes";
  }

  const map = {
    educational: "التعقيد",
    news: "التهويل",
    story: "التخمين",
    offer: "إضاعة الوقت",
    debate: "الأوهام الشائعة",
    entertainment: "المقدمات المملة",
    portfolio: "العرض الضعيف"
  };

  return map[contentType] || "الأخطاء";
}

function pickNumber(goal) {
  const map = {
    views: 5,
    saves: 7,
    comments: 3,
    clicks: 4,
    trust: 6,
    sales: 5
  };
  return map[goal] || 5;
}

function fillTemplate(template, data) {
  return template
    .replaceAll("{topic}", data.topic)
    .replaceAll("{pain}", data.pain)
    .replaceAll("{number}", String(data.number))
    .replaceAll("{verb}", data.verb);
}

function generateSuggestions(ctx) {
  const target = Number(ctx.input.suggestionCount || 10);
  const wantsAr = ctx.lang === "ar" || ctx.lang === "both";
  const wantsEn = ctx.lang === "en" || ctx.lang === "both";
  const sourceText = ctx.text;
  const topic = extractTopic(sourceText, ctx.input.mainKeyword);
  const contentType = ctx.input.contentType || "educational";
  const goal = ctx.input.goal || "views";
  const audience = normalizeText(ctx.input.audience);
  const platform = platformProfiles[ctx.input.platform] || platformProfiles.general;
  const signature = ctx.input.addKamelSignature ? " #kamel3lom" : "";

  const suggestions = [];

  if (wantsAr) {
    const data = {
      topic,
      pain: inferPain(contentType, "ar"),
      number: pickNumber(goal),
      verb: "تستخدم"
    };

    const base = templatesAr[contentType] || templatesAr.educational;
    base.forEach((tpl) => {
      suggestions.push(makeSuggestion(fillTemplate(tpl, data) + signature, "ar", "صياغة أساسية", platform));
    });

    suggestions.push(makeSuggestion(`أكبر خطأ في ${topic} وكيف تتجنبه من البداية${signature}`, "ar", "خطأ شائع", platform));
    suggestions.push(makeSuggestion(`${pickNumber(goal)} أشياء ترفع جودة ${topic} فورًا${signature}`, "ar", "قائمة قابلة للحفظ", platform));
    suggestions.push(makeSuggestion(`لماذا لا ينجح ${topic} مع كثير من الناس؟${signature}`, "ar", "فضول تحليلي", platform));

    if (audience) {
      suggestions.push(makeSuggestion(`لـ ${audience}: طريقة عملية لتحسين ${topic} دون تعقيد${signature}`, "ar", "تخصيص الجمهور", platform));
    }

    if (ctx.input.tone === "bold") {
      suggestions.push(makeSuggestion(`رأي صريح: أغلب من يتحدث عن ${topic} يشرح نصف الحقيقة${signature}`, "ar", "رأي جريء", platform));
    }

    if (ctx.input.tone === "academic") {
      suggestions.push(makeSuggestion(`${topic}: قراءة منهجية مختصرة بدل الانطباعات العامة${signature}`, "ar", "أكاديمي", platform));
    }
  }

  if (wantsEn) {
    const topicEn = isArabic(topic) ? transliterateTopic(topic) : topic;
    const data = {
      topic: topicEn,
      pain: inferPain(contentType, "en"),
      number: pickNumber(goal),
      verb: "use"
    };

    const base = templatesEn[contentType] || templatesEn.educational;
    base.forEach((tpl) => {
      suggestions.push(makeSuggestion(fillTemplate(tpl, data) + signature, "en", "Base rewrite", platform));
    });

    suggestions.push(makeSuggestion(`The biggest ${topicEn} mistake — and how to avoid it${signature}`, "en", "Common mistake", platform));
    suggestions.push(makeSuggestion(`${pickNumber(goal)} ways to improve ${topicEn} today${signature}`, "en", "Save-worthy list", platform));
    suggestions.push(makeSuggestion(`Why ${topicEn} does not work for most people${signature}`, "en", "Curiosity", platform));

    if (audience && !isArabic(audience)) {
      suggestions.push(makeSuggestion(`For ${audience}: a practical way to improve ${topicEn}${signature}`, "en", "Audience fit", platform));
    }
  }

  return dedupeSuggestions(suggestions)
    .map((item) => ({
      ...item,
      scoreEstimate: estimateSuggestionScore(item.text, ctx.input.platform)
    }))
    .sort((a, b) => b.scoreEstimate - a.scoreEstimate)
    .slice(0, target);
}

function transliterateTopic(topic) {
  const dictionary = {
    "الذكاء": "AI",
    "الاصطناعي": "AI",
    "خرائط": "maps",
    "خريطة": "map",
    "بحث": "research",
    "دراسة": "study",
    "برومبت": "prompt",
    "تصميم": "design",
    "تحليل": "analysis",
    "احصائي": "statistical analysis",
    "إحصائي": "statistical analysis"
  };

  const words = tokenize(topic);
  const translated = words.map((word) => dictionary[word] || "").filter(Boolean);
  return translated.length ? Array.from(new Set(translated)).join(" ") : "this topic";
}

function makeSuggestion(text, lang, type, platform) {
  const clean = normalizeText(text);
  return {
    id: cryptoRandomId(),
    text: clean,
    lang,
    type,
    platform: platform.label,
    length: clean.length
  };
}

function dedupeSuggestions(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function estimateSuggestionScore(text, platformKey) {
  // Lightweight scoring for generated suggestions.
  // This must not call the full analyzer again; otherwise the UI enters
  // a repeated scoring loop and the analyze button appears to do nothing.
  const platform = platformProfiles[platformKey] || platformProfiles.general;
  const lang = isArabic(text) ? "ar" : "en";
  const lex = lexicon[lang];
  const tokens = tokenize(text);
  const cleanText = normalizeText(text);
  const length = cleanText.length;

  const hasQuestion = /[؟?]/.test(cleanText) || countMatches(tokens, lex.question, cleanText) > 0;
  const hasNumber = /(\d+|[٠-٩]+|%|٪)/.test(cleanText);
  const benefitHits = countMatches(tokens, lex.benefit, cleanText);
  const curiosityHits = countMatches(tokens, lex.curiosity, cleanText);
  const specificityHits = countMatches(tokens, lex.specificity, cleanText) + (hasNumber ? 1 : 0);
  const weakHits = countMatches(tokens, lex.weak, cleanText);
  const clickbaitHits = countMatches(tokens, lex.clickbait, cleanText);

  const lengthFit = length >= platform.idealMin && length <= platform.idealMax ? 28 : 8;
  const score =
    38 +
    lengthFit +
    Math.min(18, benefitHits * 7) +
    Math.min(16, curiosityHits * 6) +
    Math.min(12, specificityHits * 5) +
    (hasQuestion ? 7 : 0) +
    (hasNumber ? 7 : 0) -
    weakHits * 6 -
    clickbaitHits * 8;

  return Math.round(clamp(score, 0, 100));
}

function cryptoRandomId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readForm() {
  return {
    text: $("#hookText").value,
    platform: $("#platform").value,
    contentType: $("#contentType").value,
    audience: $("#audience").value,
    tone: $("#tone").value,
    language: $("#language").value,
    suggestionCount: $("#suggestionCount").value,
    avoidClickbait: $("#avoidClickbait").checked,
    addKamelSignature: $("#addKamelSignature").checked,
    mainKeyword: $("#mainKeyword").value,
    goal: $("#goal").value
  };
}

function validate(input) {
  const text = normalizeText(input.text);
  if (!text) return "اكتب فكرة منشور أو عنوان فيديو أولًا.";
  if (text.length < 4) return "النص قصير جدًا للتحليل. اكتب جملة أو عنوانًا واضحًا.";
  return "";
}

function renderResult(result) {
  state.latest = result;

  const scoreRing = $(".score-ring");
  scoreRing.style.setProperty("--score", String(result.score));
  scoreRing.style.setProperty("--ring-color", scoreColor(result.score));
  $("#scoreValue").textContent = result.score;
  $("#scoreLabel").textContent = result.label;
  $("#scoreSummary").textContent = result.summary;

  const metricLabels = {
    clarity: "الوضوح",
    benefit: "الفائدة",
    curiosity: "الفضول",
    specificity: "التحديد",
    brevity: "الاختصار",
    platformFit: "ملاءمة المنصة"
  };

  $("#metrics").innerHTML = Object.entries(result.metrics)
    .map(([key, value]) => `
      <div class="metric">
        <span>${metricLabels[key] || key}</span>
        <div class="bar"><i style="width:${Math.round(value)}%"></i></div>
        <strong>${Math.round(value)}</strong>
      </div>
    `)
    .join("");

  $("#diagnosisList").innerHTML = result.diagnosis.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

  $("#suggestions").innerHTML = result.suggestions
    .map((item, index) => `
      <article class="suggestion-card">
        <div class="suggestion-top">
          <div>
            <p>${index + 1}. ${escapeHtml(item.text)}</p>
            <div class="suggestion-meta">
              <span class="chip">${escapeHtml(item.type)}</span>
              <span class="chip">${escapeHtml(item.platform)}</span>
              <span class="chip">${item.length} حرفًا</span>
              <span class="chip">تقدير ${item.scoreEstimate}/100</span>
            </div>
          </div>
          <button class="copy-one" data-copy="${escapeHtmlAttr(item.text)}" type="button">نسخ</button>
        </div>
      </article>
    `)
    .join("");

  $("#copyReport").disabled = false;
  $("#copySuggestions").disabled = false;
  $("#downloadJson").disabled = false;
  $("#downloadCsv").disabled = false;

  saveToHistory(result);
  renderHistory();
}

function scoreColor(score) {
  if (score >= 80) return "var(--good)";
  if (score >= 60) return "var(--primary)";
  if (score >= 42) return "var(--warning)";
  return "var(--danger)";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeHtmlAttr(value) {
  return escapeHtml(value).replaceAll("\n", " ");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("تم النسخ بنجاح.");
  } catch {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.focus();
  area.select();
  try {
    document.execCommand("copy");
    showToast("تم النسخ بنجاح.");
  } catch {
    showToast("تعذر النسخ تلقائيًا. انسخ النص يدويًا.");
  } finally {
    area.remove();
  }
}

function reportText(result) {
  const metrics = Object.entries(result.metrics)
    .map(([key, val]) => `- ${key}: ${Math.round(val)}/100`)
    .join("\n");

  const diagnosis = result.diagnosis.map((x) => `- ${x}`).join("\n");
  const suggestions = result.suggestions.map((x, i) => `${i + 1}. ${x.text}`).join("\n");

  return [
    "Social Media Hook Analyzer",
    "===========================",
    `النص: ${result.input.text}`,
    `المنصة: ${platformProfiles[result.input.platform].label}`,
    `نوع المحتوى: ${contentTypeLabels[result.input.contentType] || result.input.contentType}`,
    `النبرة: ${toneLabels[result.input.tone] || result.input.tone}`,
    `النتيجة: ${result.score}/100 — ${result.label}`,
    "",
    "المؤشرات:",
    metrics,
    "",
    "التشخيص:",
    diagnosis,
    "",
    "اقتراحات أقوى:",
    suggestions,
    "",
    "kamel3lom"
  ].join("\n");
}

function suggestionsText(result) {
  return result.suggestions.map((x, i) => `${i + 1}. ${x.text}`).join("\n");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function toCsv(result) {
  const rows = [
    ["rank", "suggestion", "type", "platform", "length", "score_estimate"]
  ];

  result.suggestions.forEach((s, index) => {
    rows.push([index + 1, s.text, s.type, s.platform, s.length, s.scoreEstimate]);
  });

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function saveToHistory(result) {
  const history = getHistory();
  const entry = {
    id: result.id,
    createdAt: result.createdAt,
    text: result.input.text,
    platform: result.input.platform,
    score: result.score,
    result
  };

  const next = [entry, ...history.filter((h) => h.text !== entry.text)].slice(0, 8);
  localStorage.setItem("hookAnalyzerHistory", JSON.stringify(next));
}

function getHistory() {
  try {
    const raw = localStorage.getItem("hookAnalyzerHistory");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function renderHistory() {
  const history = getHistory();
  if (!history.length) {
    $("#historyList").innerHTML = `<p class="empty">لا يوجد سجل بعد.</p>`;
    return;
  }

  $("#historyList").innerHTML = history.map((item) => `
    <div class="history-item">
      <button type="button" data-history-id="${escapeHtmlAttr(item.id)}">
        <strong>${item.score}/100</strong>
        <div>${escapeHtml(item.text.slice(0, 88))}${item.text.length > 88 ? "…" : ""}</div>
        <small>${escapeHtml(platformProfiles[item.platform]?.label || item.platform)} — ${new Date(item.createdAt).toLocaleString("ar")}</small>
      </button>
    </div>
  `).join("");
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function clearForm() {
  $("#hookForm").reset();
  $("#hookText").value = "";
  $("#charCount").textContent = "0";
  $("#hookText").focus();
}

function initTheme() {
  const saved = localStorage.getItem("hookAnalyzerTheme");
  if (saved) {
    document.documentElement.dataset.theme = saved;
  }
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  if (current === "dark") {
    delete document.documentElement.dataset.theme;
    localStorage.setItem("hookAnalyzerTheme", "dark");
  } else {
    document.documentElement.dataset.theme = "light";
    localStorage.setItem("hookAnalyzerTheme", "light");
  }
}

function initPwaInstall() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    $("#installApp").hidden = false;
  });

  $("#installApp").addEventListener("click", async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    $("#installApp").hidden = true;
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // Silent fail: the app still works without offline cache.
      });
    });
  }
}

function bindEvents() {
  $("#hookText").addEventListener("input", () => {
    $("#charCount").textContent = String($("#hookText").value.length);
  });

  $("#hookForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = readForm();
    const error = validate(input);
    if (error) {
      showToast(error);
      return;
    }

    const result = analyzeHook(input);
    renderResult(result);
  });

  $("#clearForm").addEventListener("click", clearForm);
  $("#toggleTheme").addEventListener("click", toggleTheme);

  $("#copyReport").addEventListener("click", () => {
    if (state.latest) copyText(reportText(state.latest));
  });

  $("#copySuggestions").addEventListener("click", () => {
    if (state.latest) copyText(suggestionsText(state.latest));
  });

  $("#downloadJson").addEventListener("click", () => {
    if (!state.latest) return;
    downloadFile("hook-analysis.json", JSON.stringify(state.latest, null, 2), "application/json;charset=utf-8");
  });

  $("#downloadCsv").addEventListener("click", () => {
    if (!state.latest) return;
    downloadFile("hook-suggestions.csv", toCsv(state.latest), "text/csv;charset=utf-8");
  });

  $("#suggestions").addEventListener("click", (event) => {
    const button = event.target.closest("[data-copy]");
    if (button) copyText(button.dataset.copy);
  });

  $("#historyList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-history-id]");
    if (!button) return;
    const id = button.dataset.historyId;
    const item = getHistory().find((entry) => entry.id === id);
    if (item && item.result) {
      renderResult(item.result);
      $("#hookText").value = item.result.input.text;
      $("#charCount").textContent = String($("#hookText").value.length);
      showToast("تم استرجاع التحليل من السجل.");
    }
  });

  $("#clearHistory").addEventListener("click", () => {
    localStorage.removeItem("hookAnalyzerHistory");
    renderHistory();
    showToast("تم حذف السجل.");
  });
}

function init() {
  initTheme();
  bindEvents();
  renderHistory();
  initPwaInstall();
  registerServiceWorker();

  // Demo text for first load without forcing an analysis.
  $("#charCount").textContent = String($("#hookText").value.length);
}

document.addEventListener("DOMContentLoaded", init);
