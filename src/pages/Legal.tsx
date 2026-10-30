import { Link } from 'react-router-dom';
import { useI18n, type Lang, type TranslationKey } from '../i18n';
import { Icon } from '../components/ui';

type Page = 'privacy' | 'terms' | 'cookies';

interface Section {
  h: string;
  p?: string[];
  list?: string[];
}

const UPDATED = '2026-10-30';

const CONTENT: Record<Page, Record<Lang, Section[]>> = {
  /* ------------------------------------------------------------------ */
  privacy: {
    en: [
      {
        h: 'What this document is',
        p: [
          'This Privacy Policy describes how this deployment of AI Platform handles information. It is written for this specific installation, not for a hypothetical company, and it should be reviewed by a qualified lawyer before you publish it.',
        ],
      },
      {
        h: 'Data we process',
        list: [
          'Account data: email address, display name and profile photo, supplied by Firebase Authentication when you sign in with email or Google.',
          'Conversations: chat titles, messages, attachments metadata, ratings and archive state, stored per user.',
          'Files: documents and images you upload, stored per user and readable only by your account.',
          'Projects: names, descriptions, custom instructions and the files/models you link to them.',
          'Preferences: theme, language, accent colour, font size, default model, voice and retention choices.',
          'Provider connections: the fact that a provider is connected and a non-reversible hint of the key (for example the last four characters). The key itself never reaches the browser.',
        ],
      },
      {
        h: 'Where the data lives',
        list: [
          'When Firebase is configured and you are signed in, conversations, projects, files and settings live in your project\'s Cloud Firestore and Firebase Storage, under a per-user path protected by Security Rules.',
          'When Firebase is not configured, nothing leaves the browser: data is kept in this browser\'s localStorage and the interface shows a permanent "setup required" state. Clearing site data removes it.',
          'Provider API keys and integration tokens are stored only on the server gateway, encrypted at rest. They are never written to localStorage, never returned to the client after saving and never logged.',
        ],
      },
      {
        h: 'Third-party services',
        list: [
          'Firebase (Google) — authentication, database, file storage. Governed by Google\'s terms and the Google Privacy Policy.',
          'AI providers you connect (OpenAI, Anthropic, Google, and others) — your prompt and any file you attach are forwarded to the provider you selected, to generate the answer. Each provider processes that content under its own policy.',
          'Web search and image sources (Wikipedia / Wikimedia Commons and other open sources) — used only when you enable search; results and image credits are shown with the answer.',
          'Simple Icons CDN — used to display official vendor logos. It receives a standard HTTP request for the logo file.',
        ],
      },
      {
        h: 'How your prompt reaches a provider',
        p: [
          'The browser never calls a vendor API directly. Requests go to the server gateway, which attaches the credential you stored, applies the model parameters you selected and streams the response back. Keys are stripped from every log line.',
        ],
      },
      {
        h: 'Analytics and profiling',
        p: [
          'No analytics, advertising or session-replay tool is loaded by default. Optional analytics cookies stay off until you accept them in the cookie banner, and rejecting them changes nothing about how the product works.',
        ],
      },
      {
        h: 'Your rights',
        list: [
          'Export everything you own from Settings → Privacy & data → Export my data (a JSON file with your chats, projects, files and preferences).',
          'Delete your chat history from Settings → Privacy & data → Delete chat history.',
          'Delete individual files from the Library, and individual conversations from the sidebar.',
          'Disconnect a provider or an integration at any time, which also deletes the stored credential.',
          'Delete your account from Settings → Account → Delete account. This removes the authentication record and the per-user data path in Firestore and Storage. Residual backups age out according to your Firebase project\'s retention configuration.',
        ],
      },
      {
        h: 'Data retention',
        p: [
          'History is kept until you delete it, unless you select the "temporary" retention option. Temporary chats are not written to your history at all and are discarded when you leave the conversation. The retention setting declares intent for this deployment; the enforcement window is configured on the server.',
        ],
      },
      {
        h: 'Children and lawful basis',
        p: [
          'The service is not directed at children under 13. Where the GDPR or similar rules apply, processing is based on the performance of the contract (providing the service you asked for) and, for optional analytics, on your consent.',
        ],
      },
    ],
    ar: [
      {
        h: 'ما الذي يتناوله هذا المستند',
        p: [
          'يصفت هذه السياسة الخاصية بالخصوصية طريقة معالجة بيانات هذا النسخة من منصة AI Platform. كُتبت لتناسب هذا التشغيل بالتحديد، ويجب مراجعتها من محامٍ مختص قبل نشرها.',
        ],
      },
      {
        h: 'البيانات التي نعالجها',
        list: [
          'بيانات الحساب: البريد الإلكتروني والاسم الظاهر وصورة الملف الشخصي، التي يوفّرها Firebase Authentication عند تسجيل الدخول بالبريد أو Google.',
          'المحادثات: عناوين المحادثات والرسائل وبيانات المرفقات والتقييمات وحالة الأرشفة، مخزّنة لكل مستخدم.',
          'الملفات: المستندات والصور التي ترفعها، مخزّنة لكل مستخدم ومتاحة لحسابك وحدك.',
          'المشاريع: الأسماء والوصف والتعليمات المخصّصة والملفات والنماذج المرتبطة بها.',
          'التفضيلات: المظهر واللغة واللون المميّز وحجم الخط والنموذج الافتراضي والصوت ومدة الاحتفاظ.',
          'اتصالات المزودين: 사실 اتصال المزود ورمز غير قابل للعكس للمفتاح (مثل آخر أربعة أحرف) فقط. المفتاح نفسه لا يصل إلى المتصفح أبداً.',
        ],
      },
      {
        h: 'أين تُخزَّن البيانات',
        list: [
          'عند تهيئة Firebase وتسجيل الدخول، تُخزَّن المحادثات والمشاريع والملفات والإعدادات في Cloud Firestore وFirebase Storage داخل مشروعك، تحت مسار خاص بالمستخدم ويحميه Security Rules.',
          'عند عدم تهيئة Firebase، لا يغادر أي شيء المتصفح: تبقى البيانات في localStorage ويعرض الواجهة حالة "الإعداد مطلوب" دائماً. مسح بيانات الموقع يحذفها.',
          'مفاتيح مزودي الذكاء الاصطناعي ورموز التكاملات تُخزَّن على بوابة الخادم فقط وتُشفَّر. لا تُكتب في localStorage ولا تُعاد إلى المتصفح بعد الحفظ ولا تُسجَّل في أي سجل.',
        ],
      },
      {
        h: 'خدمات الأطراف الثالثة',
        list: [
          'Firebase (Google) — المصادقة وقاعدة البيانات وتخزين الملفات، وتخضع لشروط Google وسياساتها.',
          'مزودو الذكاء الاصطناعي الذين تربطهم (OpenAI وAnthropic وGoogle وغيرها) — يُحال نص طلبك وأي مرفق إلى المزود الذي اخترته لتوليد الإجابة، ويعالج كل مزود ذلك المحتوى وفق سياسته.',
          'البحث في الويب ومصادر الصور (ويكيبيديا وويكيمايديا كومنز وغيرها من المصادر المفتوحة) — تُستخدم فقط عند تفعيل البحث، وتُعرض النتائج وإسناد الصور مع الإجابة.',
          'Simple Icons CDN — لعرض الشعارات الرسمية للمزودين، ويُرسل طلب HTTP عادي لملف الشعار.',
        ],
      },
      {
        h: 'كيف يصل طلبك إلى المزود',
        p: [
          'المتصفح لا يستدعي أي واجهة لمزود مباشرة. تمر الطلبات عبر بوابة الخادم التي تضيف المحفوظ لديها وتُطبّق إعدادات النموذج التي اخترتها وتعيد البث تدريجياً. تُحذف المفاتيح من كل سجلات البرامج.',
        ],
      },
      {
        h: 'التحليلات والتصنيف',
        p: [
          'لا تُحمَّل أي أدوات تحليل أو إعلانات أو تسجيل جلسات افتراضياً. تبقى ملفات تعريف الارتباط التحليلية اختيارية معطّلة حتى موافقتك في الشريط، ورفضها لا يغيّر طريقة عمل المنصة.',
        ],
      },
      {
        h: 'حقوقك',
        list: [
          'تصدير كل بياناتك من الإعدادات ← الخصوصية والبيانات ← تصدير بياناتي (ملف JSON يضم محادثاتك ومشاريعك وملفاتك وتفضيلاتك).',
          'حذف سجل المحادثات من الإعدادات ← الخصوصية والبيانات.',
          'حذف ملفات مفردة من المكتبة ومحادثات مفردة من الشريط الجانبي.',
          'إلغاء اتصال أي مزود أو تكامل في أي وقت، وهو ما يحذف المفتاح المخزّن معه.',
          'حذف الحساب من الإعدادات ← الحساب ← حذف الحساب، وهو ما يزيل سجل المصادقة ومسار بياناتك في Firestore وStorage.',
        ],
      },
      {
        h: 'مدة الاحتفاظ',
        p: [
          'يُحفظ السجل حتى تحذفه، ما لم تختر خيار الاحتفاظ المؤقت. المحادثات المؤقتة لا تُكتب في السجل أصلاً وتُهجر عند مغادرتها. إعداد الاحتفاظ يعبّر عن نيّة هذه النسخة، وتطبيقه الفعلي يُضبط على الخادم.',
        ],
      },
      {
        h: 'الأطفال والأساس القانوني',
        p: [
          'الخدمة غير موجّهة لمن هم دون 13 عاماً. وعند تطبيق GDPR أو ما يماثلها، ينصب المعالجة على تنفيذ العقد (تقديم الخدمة التي طلبتها)، وعلى موافقتك في حالة التحليلات الاختيارية.',
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  terms: {
    en: [
      {
        h: 'Acceptance',
        p: [
          'By using AI Platform you agree to these terms. If you are using it on behalf of an organisation, you confirm that you are allowed to bind that organisation to them.',
        ],
      },
      {
        h: 'What the service is',
        p: [
          'AI Platform is a workspace that routes your prompts, files and instructions to the AI providers you connect, and can call the developer integrations you authorise. It does not host its own models.',
        ],
      },
      {
        h: 'Your account',
        list: [
          'You are responsible for keeping your credentials secret and for everything that happens under your account.',
          'You must provide accurate registration information and keep it current.',
          'You can delete your account at any time from Settings. Deletion is permanent for the data held in your user path.',
        ],
      },
      {
        h: 'Acceptable use',
        list: [
          'Do not use the service to violate applicable law, infringe third-party rights, or circumvent the security or rate limits of any provider.',
          'Do not attempt to extract another user\'s data, probe infrastructure, or use the gateway to proxy unrestricted traffic.',
          'Do not paste secrets you are not authorised to share into prompts, files or integration tokens.',
        ],
      },
      {
        h: 'Third-party terms and costs',
        p: [
          'Your use of each connected provider, model and integration is also governed by that vendor\'s terms. Model usage may incur charges on your own vendor accounts; those charges are billed by the vendor, not by this deployment, and you are responsible for monitoring them. Output quality and availability are controlled by the providers and are not guaranteed.',
        ],
      },
      {
        h: 'No warranties',
        p: [
          'The service is provided "as is" and "as available". To the extent permitted by law, no warranty of merchantability, fitness for a particular purpose or non-infringement is given, and no result produced by a model is warranted to be accurate, complete or safe for reliance without your own review.',
        ],
      },
      {
        h: 'Limitation of liability',
        p: [
          'To the extent permitted by law, the operator is not liable for indirect, incidental or consequential damages, nor for lost profits or data, arising from your use of the service or of any model or integration reachable through it. Nothing here limits liability that cannot be limited by law.',
        ],
      },
      {
        h: 'Termination',
        p: [
          'You may stop using the service at any time. The operator may suspend access for a material breach of these terms, for non-payment to a provider, or where continued operation would be unlawful.',
        ],
      },
      {
        h: 'Changes',
        p: [
          'These terms may be updated. The "last updated" date on this page shows the current version. Continued use after a change means you accept the new terms.',
        ],
      },
    ],
    ar: [
      {
        h: 'القبول',
        p: [
          'باستخدامك منصة AI Platform فإنك توافق على هذه الشروط. وإذا تستخدمها نيابة عن مؤسسة فإنك تؤكد صلاحيتك لربطها بها.',
        ],
      },
      {
        h: 'طبيعة الخدمة',
        p: [
          'المنصة مساحة عمل توجّه طلباتك وملفاتك وتعليماتك إلى مزودي الذكاء الاصطناعي الذين تربطهم، ويمكنها استدعاء التكاملات التي تفوضها. لا تستضيف المنصة نماذجها الخاصة.',
        ],
      },
      {
        h: 'حسابك',
        list: [
          'أنت مسؤول عن سرّ بيانات دخولك وعن كل ما يتم من حسابك.',
          'يجب تقديم بيانات تسجيل دقيقة وتحديثها.',
          'يمكنك حذف حسابك في أي وقت من الإعدادات، وهو حذف دائم لبيانات مسارك الخاص.',
        ],
      },
      {
        h: 'الاستخدام المقبول',
        list: [
          'يُمنع استخدام الخدمة لمخالفة أي قانون أو انتهاك حقوق الغير أو تجاوز حماية أو حدود أي مزود.',
          'يُمنع محاولة الوصول لبيانات مستخدم آخر أو استكشاف البنية التحتية أو استخدام البوابة ك وسيط لمرور غير محدود.',
          'يُمنع لصق أسرار غير مصرّح لك بمشاركتها داخل الطلبات أو الملفات أو رموز التكاملات.',
        ],
      },
      {
        h: 'شروط الأطراف الثالثة والتكاليف',
        p: [
          'يظل استخدامك لكل مزود ونموذج وتكامل خاضعاً لشروط ذلك المزود. وقد تترتّب رسوم على حساباتك لدى المزودين، وتُحتسب من المزود لا من هذه النسخة، وأنت مسؤول عن متابعتها. جودة الإتاحة والنتائج يحددها المزود ولا تُضمن.',
        ],
      },
      {
        h: 'عدم الضمانات',
        p: [
          'تُقدَّم الخدمة "كما هي" و"حسب توفرها". وفي حدود ما يسمح به القانون لا تُقدَّم أي ضمانات بشأن الملاءمة أو الغير إصابة، ولا يُضمن أن أي نتيجة من نموذج دقيق أو كامل أو آمن للاعتماد دون مراجعتك أنت.',
        ],
      },
      {
        h: 'حدود المسؤولية',
        p: [
          'في حدود ما يسمح به القانون، لا يتحمل المشغّل أي أضرار غير مباشرة أو عرضية أو تبعية، ولا الأرباح أو البيانات المفقودة الناشئة عن استخدامك للخدمة أو لأي نموذج أو تكامل عبرها. ولا يحدّ هذا النص من أي مسؤولية لا يجوز تقييدها قانوناً.',
        ],
      },
      {
        h: 'الإنهاء',
        p: [
          'يمكنك التوقف عن استخدام الخدمة في أي وقت. ويمكن للمشغّل تعليق الوصول عند مخالفة جوهرية لهذه الشروط أو عند عدم سداد مستحقاتك للمزود أو عندما يصبح التشغيل غير قانوني.',
        ],
      },
      {
        h: 'التعديلات',
        p: [
          'قد تُحدَّث هذه الشروط، ويظهر تاريخ آخر تحديث أعلى الصفحة. واستخدامك الخدمة بعد التعديل يعني قبولك للنسخة الجديدة.',
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  cookies: {
    en: [
      {
        h: 'What a cookie is',
        p: [
          'A cookie is a small piece of data a site stores in your browser. This deployment also uses browser localStorage, which plays the same role for preferences and for data held when Firebase is not configured.',
        ],
      },
      {
        h: 'Strictly necessary storage',
        list: [
          'Firebase Authentication session — keeps you signed in between visits. Without it you are signed out on every page load.',
          'aiplatform.settings.v1 — theme, language, accent, font size, density, motion, background and chat preferences.',
          'aiplatform.lang / aiplatform.sidebar.collapsed / aiplatform.cookies — language direction, sidebar state and your cookie choice.',
          'aiplatform.workspace.v1 — conversations, projects and files, only when Firebase is not configured (local-only mode). It is never sent anywhere.',
        ],
      },
      {
        h: 'Optional storage',
        list: [
          'Analytics cookies — disabled by default and only set if you press Accept in the cookie banner. They collect aggregated usage counts only, no cross-site tracking and no advertising identifiers.',
        ],
      },
      {
        h: 'Third-party requests',
        p: [
          'No third-party advertising or tracking cookie is set by this deployment. Third-party requests that do occur are functional: Firebase for sign-in, the selected AI provider for your prompt, and the logo CDN for vendor marks. Those services set their own cookies under their own policies when you use them.',
        ],
      },
      {
        h: 'Managing cookies',
        list: [
          'Reject optional cookies at any time by clearing the aiplatform.cookies value or by using your browser settings.',
          'Block or delete cookies in your browser — note that blocking necessary cookies signs you out and stops local mode from remembering your data.',
          'Clearing site data removes every value listed above.',
        ],
      },
    ],
    ar: [
      {
        h: 'ما هو ملف تعريف الارتباط',
        p: [
          'هو مقدار صغير من البيانات يخزّنه الموقع في متصفحك. وتعتمد هذه النسخة كذلك على localStorage الذي يؤدي الدور نفسه للتفضيلات وللبيانات عند عدم تهيئة Firebase.',
        ],
      },
      {
        h: 'التخزين الضروري',
        list: [
          'جلسة Firebase Authentication — تبقيك مسجّل الدخول بين الزيارات، وتعطيلها يعني الخروج عند كل تحميل.',
          'aiplatform.settings.v1 — المظهر واللغة واللون وحجم الخط والكثافة والحركة والخلفية وتفضيلات المحادثة.',
          'aiplatform.lang و aiplatform.sidebar.collapsed و aiplatform.cookies — اتجاه اللغة وحالة الشريط واختيارك للكوكيز.',
          'aiplatform.workspace.v1 — المحادثات والمشاريع والملفات، فقط عند عدم تهيئة Firebase (وضع محلي)، ولا يُرسل إلى أي مكان.',
        ],
      },
      {
        h: 'التخزين الاختياري',
        list: [
          'كوكيز التحليلات — معطّلة افتراضياً ولا تُنشأ إلا عند ضغطك "قبول" في شريط الموافقة، وتجمع عدّادات استخدام مجمّعة فقط دون تتبّع إعلاني.',
        ],
      },
      {
        h: 'طلبات طرف ثالث',
        p: [
          'لا تضع هذه النسخة أي كوكيز إعلاني أو تتبّع من طرف ثالث. الطلبات الخارجية الوظيفية فقط هي: Firebase للدخول، والمزود المختار لطلبك، وشبكة الشعارات لعلامات المزودين؛ وتخضع هذه الخدمات لسياساتها الخاصة.',
        ],
      },
      {
        h: 'إدارة الكوكيز',
        list: [
          'يمكنك رفض الاختياري في أي وقت بمسح القيمة aiplatform.cookies أو عبر إعدادات المتصفح.',
          'حظر أو حذف الكوكيز من متصفحك — مع العلم أن حظر الضروري يخرجك من الحساب ويمنع الوضع المحلي من تذكّر بياناتك.',
          'مسح بيانات الموقع يحذف كل القيم المذكورة أعلاه.',
        ],
      },
    ],
  },
};

const TITLES: Record<Page, TranslationKey> = {
  privacy: 'legal.privacy',
  terms: 'legal.terms',
  cookies: 'legal.cookies',
};

export default function LegalPage({ page }: { page: Page }) {
  const { t, lang } = useI18n();
  const sections = CONTENT[page][lang];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <Icon name="shield" className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-[1.5rem] font-extrabold tracking-tight text-[var(--text)]">{t(TITLES[page])}</h1>
            <p className="text-[0.78rem] text-[var(--text-3)]">
              {t('legal.updated')}: {UPDATED}
            </p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {(['privacy', 'terms', 'cookies'] as Page[]).map((p) => (
            <Link
              key={p}
              to={`/${p === 'privacy' ? 'privacy' : p === 'terms' ? 'terms' : 'cookies'}`}
              className={
                p === page
                  ? 'rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[0.8rem] font-bold text-white'
                  : 'rounded-full border border-[var(--border)] bg-[var(--panel)] px-3.5 py-1.5 text-[0.8rem] font-semibold text-[var(--text-2)] hover:border-[var(--border-strong)]'
              }
            >
              {t(TITLES[p])}
            </Link>
          ))}
        </div>

        <div className="space-y-6">
          {sections.map((s, i) => (
            <section key={i} className="card p-5">
              <h2 className="text-[1.05rem] font-bold text-[var(--text)]">
                <span className="me-2 font-mono text-[0.8rem] text-[var(--accent-text)]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {s.h}
              </h2>
              {s.p?.map((para, j) => (
                <p key={j} className="mt-2 text-[0.88rem] leading-[1.85] text-[var(--text-2)]">
                  {para}
                </p>
              ))}
              {s.list && (
                <ul className="mt-3 space-y-2">
                  {s.list.map((item, j) => (
                    <li key={j} className="flex gap-2.5 text-[0.87rem] leading-[1.8] text-[var(--text-2)]">
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-[#f5a524]/40 bg-[color-mix(in_srgb,#f5a524_12%,transparent)] p-4">
          <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-[#f5a524]" />
          <p className="text-[0.83rem] leading-relaxed text-[var(--text-2)]">{t('legal.notLegalAdvice')}</p>
        </div>

        <p className="mt-6 text-center">
          <Link to="/" className="text-[0.84rem] font-semibold text-[var(--accent-text)] hover:underline">
            {t('common.goHome')}
          </Link>
        </p>
      </div>
    </div>
  );
}
