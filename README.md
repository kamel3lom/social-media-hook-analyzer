# Earth Engine Index Studio

أداة ويب جاهزة للنشر على GitHub Pages لتحليل مؤشرات الاستشعار عن بعد عبر Google Earth Engine.

## الوظائف

- تسجيل دخول المستخدم عبر Google Earth Engine OAuth.
- اختيار المدينة، السنة، المؤشر، المستشعر، ونمط الإخراج.
- عرض النتيجة على خريطة Leaflet.
- تنزيل PNG، وGeoTIFF محدود الحجم، وAOI بصيغة GeoJSON، وAOI كـ Shapefile.
- نسخ تقرير التحليل.

## المؤشرات
NDVI, EVI, SAVI, MSAVI, NDMI, GCI, NDWI, MNDWI, AWEI, NDBI, UI, BSI, NBR, NDSI, LST.

## مهم جداً

لا يمكن أن تعمل أي أداة Earth Engine منشورة على GitHub Pages مباشرة بدون OAuth Client ID وحساب Earth Engine مفعل. لا تضع أي Service Account أو مفاتيح سرية داخل هذا المشروع.

## الإعداد

1. أنشئ OAuth Client ID من Google Cloud Console.
2. أضف نطاق GitHub Pages في Authorized JavaScript origins:

```text
https://YOUR_USERNAME.github.io
```

3. افتح `config.js` وضع:

```js
OAUTH_CLIENT_ID: "YOUR_CLIENT_ID.apps.googleusercontent.com"
```

أو أدخله من زر الإعدادات داخل الأداة.

## النشر

ارفع الملفات إلى جذر مستودع GitHub، ثم فعّل GitHub Pages من Settings > Pages واختر main / root.

## ملاحظة عن GeoTIFF

التنزيل المباشر مناسب للمخرجات الصغيرة والمتوسطة. للمساحات الكبيرة استخدم Earth Engine Code Editor ومهام Export.

kamel3lom

## v1.0.1 OAuth Popup Fix

تم تعديل آلية الربط مع Earth Engine لتتبع نمط Google الرسمي بصورة أدق:

- تهيئة OAuth صامتة عند تحميل الصفحة أو حفظ الإعدادات.
- فتح نافذة تسجيل الدخول عبر `ee.data.authenticateViaPopup()` مباشرة من زر المستخدم.
- إضافة مهلة تشخيصية تظهر السبب المحتمل إذا بقيت الحالة على "جارٍ التنفيذ".
- إصلاح أسماء دوال السجل والحالة والتنبيه حتى لا تتعارض مع عناصر HTML.

إذا بقي الربط متوقفًا، تحقق من:

1. السماح بالنوافذ المنبثقة للموقع.
2. وجود `https://kamel3lom.github.io` في Authorized JavaScript origins.
3. إضافة بريدك ضمن Test users في OAuth consent screen.
4. تفعيل Earth Engine API على مشروع Google Cloud.


## v1.0.2 — إصلاح نهائي لمسار الربط

تعتمد هذه النسخة على Google Identity Services Token Flow بدل الاعتماد على iframe الصامت الذي قد يسبب `idpiframe_initialization_failed`.

بعد الرفع افتح الموقع هكذا لكسر الكاش:

```text
https://kamel3lom.github.io/اسم-المستودع/?v=1.0.2
```

داخل إعدادات الأداة:
- OAuth Client ID: الصق المعرّف الكامل المنتهي بـ `.apps.googleusercontent.com`
- Cloud Project ID: ضع معرف مشروع Google Cloud إذا ظهر خطأ يطلب مشروعًا. مثال: `kamel3lom-geoindex`


## v1.0.3 — إصلاح تعطيل أزرار التنزيل عند خطأ الذاكرة

إذا ظهرت رسالة `User memory limit exceeded` فهذا يعني أن Google Earth Engine نجح في عرض الطبقة على الخريطة، لكنه فشل في حساب الإحصاءات أو تجهيز تنزيل مباشر لأن مساحة المنطقة/الدقة/الفترة الزمنية ثقيلة.

تم في هذه النسخة:
- تفعيل أزرار التصدير بعد عرض الطبقة حتى إذا فشل حساب الإحصاءات.
- تخفيف حساب الإحصاءات باستخدام `tileScale` ومقياس 250 مترًا.
- جعل PNG يبدأ بحجم 1200 ثم يحاول 800 عند الفشل.
- جعل GeoTIFF المباشر يستخدم 100 متر كحد أدنى للمناطق الكبيرة.
- إبقاء كود التصدير الكبير هو الخيار الأقوى للمخرجات الثقيلة.


## v2.0 — Cartographic Classification Engine

هذه النسخة لا تعرض المؤشر كطبقة خام مبهمة، بل تحوّله إلى خريطة تفسيرية مصنفة:

- NDVI: ماء/ظل، نبات ضعيف، متوسط، جيد، كثيف.
- NDBI/UI: غير عمراني، عمران منخفض، متوسط، مرتفع، نواة عمرانية كثيفة.
- NDWI/MNDWI/AWEI: جاف، رطوبة، مياه محتملة، مياه واضحة.
- LST: بارد، معتدل، دافئ، حار، حار جدًا.
- BSI/NBR/NDSI وغيرها: تصنيفات تفسيرية مناسبة لكل مؤشر.

الإضافات:
- تنزيل PNG للطبقة المصنفة.
- تنزيل بوستر PNG من الخريطة الحية مع العنوان والليجند.
- ليجند تصنيفي واضح بدل تدرج مبهم فقط.
- ألوان أكثر تباينًا حسب نوع المؤشر.
