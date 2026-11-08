import type { Language } from "@/lib/translations";

/**
 * PLACEHOLDER legal/information texts. They are generic drafts, NOT legal advice and do not
 * guarantee compliance with any law. Text inside [[double brackets]] is rendered as a highlighted
 * placeholder that the shop owner must replace; the whole text must be reviewed by a qualified
 * lawyer before production.
 */
export type LegalPageId = "privacy" | "terms" | "shipping" | "returns";

export type LegalSection = { heading: string; body: string[] };
export type LegalContent = {
  title: string;
  intro: string;
  sections: LegalSection[];
};

type Ui = {
  draftTitle: string;
  draftBody: string;
  lastUpdated: string;
  contactTitle: string;
  contactBody: string;
};

export const legalUi: Record<Language, Ui> = {
  ua: {
    draftTitle: "Чернетка — потребує заміни перед запуском",
    draftBody:
      "Це шаблонний текст-заповнювач. Він не є юридичною консультацією та не гарантує відповідності законодавству. Власник магазину має замінити всі виділені поля [[…]] і перевірити документ з юристом.",
    lastUpdated: "Остання зміна:",
    contactTitle: "Контакти",
    contactBody: "Контактні дані продавця: [[КОНТАКТНИЙ EMAIL ПРОДАВЦЯ]], [[ТЕЛЕФОН]].",
  },
  ru: {
    draftTitle: "Черновик — требует замены перед запуском",
    draftBody:
      "Это шаблонный текст-заполнитель. Он не является юридической консультацией и не гарантирует соответствие законодательству. Владелец магазина должен заменить все выделенные поля [[…]] и проверить документ с юристом.",
    lastUpdated: "Последнее изменение:",
    contactTitle: "Контакты",
    contactBody: "Контактные данные продавца: [[КОНТАКТНЫЙ EMAIL ПРОДАВЦА]], [[ТЕЛЕФОН]].",
  },
  pl: {
    draftTitle: "Wersja robocza — wymaga uzupełnienia przed uruchomieniem",
    draftBody:
      "To tekst zastępczy. Nie stanowi porady prawnej i nie gwarantuje zgodności z przepisami. Właściciel sklepu musi zastąpić wszystkie wyróżnione pola [[…]] i skonsultować dokument z prawnikiem.",
    lastUpdated: "Ostatnia zmiana:",
    contactTitle: "Kontakt",
    contactBody: "Dane kontaktowe sprzedawcy: [[E-MAIL KONTAKTOWY SPRZEDAWCY]], [[TELEFON]].",
  },
};

const SELLER = {
  ua: "[[НАЗВА ТА ПРАВОВА ФОРМА ПРОДАВЦЯ]], [[ЮРИДИЧНА АДРЕСА]], [[NIP / РЕЄСТРАЦІЙНІ ДАНІ]]",
  ru: "[[НАЗВАНИЕ И ПРАВОВАЯ ФОРМА ПРОДАВЦА]], [[ЮРИДИЧЕСКИЙ АДРЕС]], [[NIP / РЕГИСТРАЦИОННЫЕ ДАННЫЕ]]",
  pl: "[[NAZWA I FORMA PRAWNA SPRZEDAWCY]], [[ADRES SIEDZIBY]], [[NIP / DANE REJESTROWE]]",
};

export const legalContent: Record<LegalPageId, Record<Language, LegalContent>> = {
  privacy: {
    ua: {
      title: "Політика конфіденційності",
      intro: "Цей документ описує, які персональні дані обробляє магазин у зв'язку з використанням сайту та оформленням замовлень.",
      sections: [
        { heading: "1. Адміністратор даних", body: [`Адміністратор персональних даних: ${SELLER.ua}.`] },
        {
          heading: "2. Які дані ми обробляємо",
          body: [
            "Дані облікового запису (email), дані замовлення (ім'я, email, телефон, адреса доставки, примітки), вміст кошика та обраних товарів, а також технічні дані, необхідні для роботи сайту (файли cookie для входу, мови та теми).",
          ],
        },
        {
          heading: "3. Цілі та правові підстави",
          body: [
            "Виконання замовлень і зв'язок з покупцем, ведення облікового запису, безпека сайту, виконання обов'язків за законом.",
            "[[ВКАЖІТЬ ПРАВОВІ ПІДСТАВИ ОБРОБКИ ЗГІДНО З ЗАСТОСОВНИМ ЗАКОНОДАВСТВОМ]]",
          ],
        },
        {
          heading: "4. Одержувачі даних",
          body: [
            "Дані можуть передаватися постачальникам послуг, що забезпечують роботу магазину (хостинг і база даних, надсилання email, у майбутньому — платіжні та кур'єрські сервіси): [[ПЕРЕЛІК ОДЕРЖУВАЧІВ ТА КРАЇН ОБРОБКИ]].",
          ],
        },
        { heading: "5. Строк зберігання", body: ["[[ВКАЖІТЬ СТРОКИ ЗБЕРІГАННЯ ДАНИХ ЗАМОВЛЕНЬ ТА ОБЛІКОВИХ ЗАПИСІВ]]"] },
        {
          heading: "6. Ваші права",
          body: [
            "Ви можете запросити доступ до даних, їх виправлення, видалення, обмеження обробки чи перенесення, а також подати скаргу до наглядового органу. [[ВКАЖІТЬ ПОРЯДОК ЗВЕРНЕННЯ ТА НАГЛЯДОВИЙ ОРГАН]]",
          ],
        },
      ],
    },
    ru: {
      title: "Политика конфиденциальности",
      intro: "Этот документ описывает, какие персональные данные обрабатывает магазин в связи с использованием сайта и оформлением заказов.",
      sections: [
        { heading: "1. Администратор данных", body: [`Администратор персональных данных: ${SELLER.ru}.`] },
        {
          heading: "2. Какие данные мы обрабатываем",
          body: [
            "Данные учётной записи (email), данные заказа (имя, email, телефон, адрес доставки, примечания), содержимое корзины и избранного, а также технические данные, необходимые для работы сайта (cookie для входа, языка и темы).",
          ],
        },
        {
          heading: "3. Цели и правовые основания",
          body: [
            "Выполнение заказов и связь с покупателем, ведение учётной записи, безопасность сайта, исполнение требований закона.",
            "[[УКАЖИТЕ ПРАВОВЫЕ ОСНОВАНИЯ ОБРАБОТКИ СОГЛАСНО ПРИМЕНИМОМУ ЗАКОНОДАТЕЛЬСТВУ]]",
          ],
        },
        {
          heading: "4. Получатели данных",
          body: [
            "Данные могут передаваться поставщикам услуг, обеспечивающим работу магазина (хостинг и база данных, отправка email, в будущем — платёжные и курьерские сервисы): [[ПЕРЕЧЕНЬ ПОЛУЧАТЕЛЕЙ И СТРАН ОБРАБОТКИ]].",
          ],
        },
        { heading: "5. Срок хранения", body: ["[[УКАЖИТЕ СРОКИ ХРАНЕНИЯ ДАННЫХ ЗАКАЗОВ И УЧЁТНЫХ ЗАПИСЕЙ]]"] },
        {
          heading: "6. Ваши права",
          body: [
            "Вы можете запросить доступ к данным, их исправление, удаление, ограничение обработки или перенос, а также подать жалобу в надзорный орган. [[УКАЖИТЕ ПОРЯДОК ОБРАЩЕНИЯ И НАДЗОРНЫЙ ОРГАН]]",
          ],
        },
      ],
    },
    pl: {
      title: "Polityka prywatności",
      intro: "Dokument opisuje, jakie dane osobowe przetwarza sklep w związku z korzystaniem z serwisu i składaniem zamówień.",
      sections: [
        { heading: "1. Administrator danych", body: [`Administrator danych osobowych: ${SELLER.pl}.`] },
        {
          heading: "2. Jakie dane przetwarzamy",
          body: [
            "Dane konta (e-mail), dane zamówienia (imię i nazwisko, e-mail, telefon, adres dostawy, uwagi), zawartość koszyka i ulubionych oraz dane techniczne niezbędne do działania serwisu (pliki cookie logowania, języka i motywu).",
          ],
        },
        {
          heading: "3. Cele i podstawy prawne",
          body: [
            "Realizacja zamówień i kontakt z klientem, prowadzenie konta, bezpieczeństwo serwisu, wypełnianie obowiązków prawnych.",
            "[[WSKAŻ PODSTAWY PRAWNE PRZETWARZANIA ZGODNIE Z OBOWIĄZUJĄCYMI PRZEPISAMI]]",
          ],
        },
        {
          heading: "4. Odbiorcy danych",
          body: [
            "Dane mogą być przekazywane dostawcom usług niezbędnych do działania sklepu (hosting i baza danych, wysyłka e-mail, w przyszłości — płatności i kurierzy): [[LISTA ODBIORCÓW I KRAJÓW PRZETWARZANIA]].",
          ],
        },
        { heading: "5. Okres przechowywania", body: ["[[WSKAŻ OKRESY PRZECHOWYWANIA DANYCH ZAMÓWIEŃ I KONT]]"] },
        {
          heading: "6. Twoje prawa",
          body: [
            "Możesz żądać dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania lub przeniesienia oraz wnieść skargę do organu nadzorczego. [[WSKAŻ SPOSÓB KONTAKTU I ORGAN NADZORCZY]]",
          ],
        },
      ],
    },
  },

  terms: {
    ua: {
      title: "Умови та положення",
      intro: "Ці умови регулюють користування сайтом і оформлення замовлень.",
      sections: [
        { heading: "1. Продавець", body: [`Продавець: ${SELLER.ua}.`] },
        {
          heading: "2. Замовлення",
          body: [
            "Оформлюючи замовлення, ви пропонуєте придбати обрані товари. Після оформлення продавець зв'язується з вами для підтвердження замовлення та узгодження способу оплати й доставки. Договір вважається укладеним з моменту, який визначає продавець: [[ВКАЖІТЬ МОМЕНТ УКЛАДЕННЯ ДОГОВОРУ]].",
          ],
        },
        {
          heading: "3. Ціни та наявність",
          body: [
            "Ціни та залишки на сайті визначаються сервером на момент оформлення. Податки, у тому числі ПДВ, і вартість доставки: [[ВКАЖІТЬ ПОРЯДОК ВРАХУВАННЯ ПДВ І ДОСТАВКИ]].",
          ],
        },
        { heading: "4. Оплата", body: ["Спосіб і строки оплати: [[ВКАЖІТЬ ДОСТУПНІ СПОСОБИ ОПЛАТИ]]. Замовлення вважається оплаченим лише після підтвердження оплати продавцем."] },
        { heading: "5. Доставка та повернення", body: ["Див. сторінки «Інформація про доставку» та «Інформація про повернення»."] },
        { heading: "6. Скарги та рекламації", body: ["[[ВКАЖІТЬ ПОРЯДОК ПОДАННЯ І РОЗГЛЯДУ СКАРГ, ГАРАНТІЙНІ УМОВИ]]"] },
        { heading: "7. Застосовне право", body: ["[[ВКАЖІТЬ ЗАСТОСОВНЕ ПРАВО ТА ПОРЯДОК ВИРІШЕННЯ СПОРІВ]]"] },
      ],
    },
    ru: {
      title: "Условия и положения",
      intro: "Эти условия регулируют использование сайта и оформление заказов.",
      sections: [
        { heading: "1. Продавец", body: [`Продавец: ${SELLER.ru}.`] },
        {
          heading: "2. Заказы",
          body: [
            "Оформляя заказ, вы предлагаете приобрести выбранные товары. После оформления продавец связывается с вами для подтверждения заказа и согласования способа оплаты и доставки. Договор считается заключённым с момента, который определяет продавец: [[УКАЖИТЕ МОМЕНТ ЗАКЛЮЧЕНИЯ ДОГОВОРА]].",
          ],
        },
        {
          heading: "3. Цены и наличие",
          body: [
            "Цены и остатки определяются сервером на момент оформления. Налоги, включая НДС, и стоимость доставки: [[УКАЖИТЕ ПОРЯДОК УЧЁТА НДС И ДОСТАВКИ]].",
          ],
        },
        { heading: "4. Оплата", body: ["Способ и сроки оплаты: [[УКАЖИТЕ ДОСТУПНЫЕ СПОСОБЫ ОПЛАТЫ]]. Заказ считается оплаченным только после подтверждения оплаты продавцом."] },
        { heading: "5. Доставка и возврат", body: ["См. страницы «Информация о доставке» и «Информация о возврате»."] },
        { heading: "6. Жалобы и рекламации", body: ["[[УКАЖИТЕ ПОРЯДОК ПОДАЧИ И РАССМОТРЕНИЯ ЖАЛОБ, ГАРАНТИЙНЫЕ УСЛОВИЯ]]"] },
        { heading: "7. Применимое право", body: ["[[УКАЖИТЕ ПРИМЕНИМОЕ ПРАВО И ПОРЯДОК РАЗРЕШЕНИЯ СПОРОВ]]"] },
      ],
    },
    pl: {
      title: "Regulamin",
      intro: "Niniejszy regulamin określa zasady korzystania z serwisu i składania zamówień.",
      sections: [
        { heading: "1. Sprzedawca", body: [`Sprzedawca: ${SELLER.pl}.`] },
        {
          heading: "2. Zamówienia",
          body: [
            "Składając zamówienie, składasz ofertę zakupu wybranych produktów. Po złożeniu zamówienia sprzedawca kontaktuje się z Tobą w celu potwierdzenia zamówienia oraz ustalenia sposobu płatności i dostawy. Umowa zostaje zawarta w momencie określonym przez sprzedawcę: [[WSKAŻ MOMENT ZAWARCIA UMOWY]].",
          ],
        },
        {
          heading: "3. Ceny i dostępność",
          body: [
            "Ceny i stany magazynowe są ustalane przez serwer w chwili składania zamówienia. Podatki, w tym VAT, oraz koszty dostawy: [[WSKAŻ ZASADY UWZGLĘDNIANIA VAT I DOSTAWY]].",
          ],
        },
        { heading: "4. Płatność", body: ["Sposób i terminy płatności: [[WSKAŻ DOSTĘPNE METODY PŁATNOŚCI]]. Zamówienie jest uznawane za opłacone dopiero po potwierdzeniu płatności przez sprzedawcę."] },
        { heading: "5. Dostawa i zwroty", body: ["Zobacz strony „Informacje o dostawie” i „Informacje o zwrotach”."] },
        { heading: "6. Reklamacje", body: ["[[WSKAŻ TRYB SKŁADANIA I ROZPATRYWANIA REKLAMACJI ORAZ WARUNKI GWARANCJI]]"] },
        { heading: "7. Prawo właściwe", body: ["[[WSKAŻ PRAWO WŁAŚCIWE I SPOSÓB ROZWIĄZYWANIA SPORÓW]]"] },
      ],
    },
  },

  shipping: {
    ua: {
      title: "Інформація про доставку",
      intro: "Загальна інформація про доставку замовлень. Конкретні умови визначає продавець.",
      sections: [
        { heading: "1. Країни доставки", body: ["Доступні країни обираються під час оформлення замовлення. [[ВКАЖІТЬ ПОВНИЙ ПЕРЕЛІК КРАЇН ДОСТАВКИ]]"] },
        { heading: "2. Способи та вартість", body: ["[[ВКАЖІТЬ СЛУЖБИ ДОСТАВКИ, ТАРИФИ ТА БЕЗКОШТОВНУ ДОСТАВКУ, ЯКЩО Є]]"] },
        { heading: "3. Строки", body: ["Строк обробки замовлення: [[ВКАЖІТЬ СТРОК ОБРОБКИ]]. Орієнтовний строк доставки: [[ВКАЖІТЬ СТРОК ДОСТАВКИ]]. Строки є орієнтовними."] },
        { heading: "4. Підтвердження", body: ["Після оформлення продавець зв'яжеться з вами для підтвердження замовлення та узгодження оплати й доставки."] },
        { heading: "5. Пошкодження під час доставки", body: ["[[ВКАЖІТЬ ПОРЯДОК ОГЛЯДУ ПОСИЛКИ ТА ФІКСАЦІЇ ПОШКОДЖЕНЬ]]"] },
      ],
    },
    ru: {
      title: "Информация о доставке",
      intro: "Общая информация о доставке заказов. Конкретные условия определяет продавец.",
      sections: [
        { heading: "1. Страны доставки", body: ["Доступные страны выбираются при оформлении заказа. [[УКАЖИТЕ ПОЛНЫЙ ПЕРЕЧЕНЬ СТРАН ДОСТАВКИ]]"] },
        { heading: "2. Способы и стоимость", body: ["[[УКАЖИТЕ СЛУЖБЫ ДОСТАВКИ, ТАРИФЫ И БЕСПЛАТНУЮ ДОСТАВКУ, ЕСЛИ ЕСТЬ]]"] },
        { heading: "3. Сроки", body: ["Срок обработки заказа: [[УКАЖИТЕ СРОК ОБРАБОТКИ]]. Ориентировочный срок доставки: [[УКАЖИТЕ СРОК ДОСТАВКИ]]. Сроки являются ориентировочными."] },
        { heading: "4. Подтверждение", body: ["После оформления продавец свяжется с вами для подтверждения заказа и согласования оплаты и доставки."] },
        { heading: "5. Повреждения при доставке", body: ["[[УКАЖИТЕ ПОРЯДОК ОСМОТРА ПОСЫЛКИ И ФИКСАЦИИ ПОВРЕЖДЕНИЙ]]"] },
      ],
    },
    pl: {
      title: "Informacje o dostawie",
      intro: "Ogólne informacje o dostawie zamówień. Szczegółowe warunki określa sprzedawca.",
      sections: [
        { heading: "1. Kraje dostawy", body: ["Dostępne kraje wybierasz podczas składania zamówienia. [[WSKAŻ PEŁNĄ LISTĘ KRAJÓW DOSTAWY]]"] },
        { heading: "2. Sposoby i koszty", body: ["[[WSKAŻ PRZEWOŹNIKÓW, CENNIK ORAZ DARMOWĄ DOSTAWĘ, JEŚLI DOTYCZY]]"] },
        { heading: "3. Terminy", body: ["Czas realizacji zamówienia: [[WSKAŻ CZAS REALIZACJI]]. Orientacyjny czas dostawy: [[WSKAŻ CZAS DOSTAWY]]. Terminy mają charakter orientacyjny."] },
        { heading: "4. Potwierdzenie", body: ["Po złożeniu zamówienia sprzedawca skontaktuje się z Tobą w celu potwierdzenia zamówienia oraz ustalenia płatności i dostawy."] },
        { heading: "5. Uszkodzenia w transporcie", body: ["[[WSKAŻ ZASADY SPRAWDZANIA PRZESYŁKI I ZGŁASZANIA USZKODZEŃ]]"] },
      ],
    },
  },

  returns: {
    ua: {
      title: "Інформація про повернення",
      intro: "Загальна інформація про повернення товарів. Конкретні умови визначає продавець відповідно до застосовного законодавства.",
      sections: [
        { heading: "1. Право на відмову / повернення", body: ["[[ВКАЖІТЬ СТРОК ТА УМОВИ ВІДМОВИ ВІД ДОГОВОРУ ЗГІДНО З ЗАСТОСОВНИМ ЗАКОНОДАВСТВОМ ДЛЯ СПОЖИВАЧІВ]]"] },
        { heading: "2. Як оформити повернення", body: ["Зв'яжіться з продавцем за контактами нижче, вказавши номер замовлення. [[ВКАЖІТЬ ПРОЦЕДУРУ ТА ФОРМУ ЗАЯВИ]]"] },
        { heading: "3. Стан товару", body: ["[[ВКАЖІТЬ ВИМОГИ ДО СТАНУ ТА КОМПЛЕКТАЦІЇ ТОВАРУ]]"] },
        { heading: "4. Повернення коштів", body: ["[[ВКАЖІТЬ СТРОКИ ТА СПОСІБ ПОВЕРНЕННЯ КОШТІВ, ХТО СПЛАЧУЄ ЗА ПОВЕРНЕННЯ ПОСИЛКИ]]"] },
        { heading: "5. Товари, що не підлягають поверненню", body: ["[[ВКАЖІТЬ ВИНЯТКИ, ЯКЩО ВОНИ Є]]"] },
        { heading: "6. Дефектні товари", body: ["[[ВКАЖІТЬ ПОРЯДОК ГАРАНТІЇ ТА РЕКЛАМАЦІЙ]]"] },
      ],
    },
    ru: {
      title: "Информация о возврате",
      intro: "Общая информация о возврате товаров. Конкретные условия определяет продавец в соответствии с применимым законодательством.",
      sections: [
        { heading: "1. Право на отказ / возврат", body: ["[[УКАЖИТЕ СРОК И УСЛОВИЯ ОТКАЗА ОТ ДОГОВОРА СОГЛАСНО ПРИМЕНИМОМУ ПОТРЕБИТЕЛЬСКОМУ ЗАКОНОДАТЕЛЬСТВУ]]"] },
        { heading: "2. Как оформить возврат", body: ["Свяжитесь с продавцом по контактам ниже, указав номер заказа. [[УКАЖИТЕ ПРОЦЕДУРУ И ФОРМУ ЗАЯВЛЕНИЯ]]"] },
        { heading: "3. Состояние товара", body: ["[[УКАЖИТЕ ТРЕБОВАНИЯ К СОСТОЯНИЮ И КОМПЛЕКТАЦИИ ТОВАРА]]"] },
        { heading: "4. Возврат средств", body: ["[[УКАЖИТЕ СРОКИ И СПОСОБ ВОЗВРАТА СРЕДСТВ, КТО ОПЛАЧИВАЕТ ВОЗВРАТ ПОСЫЛКИ]]"] },
        { heading: "5. Товары, не подлежащие возврату", body: ["[[УКАЖИТЕ ИСКЛЮЧЕНИЯ, ЕСЛИ ОНИ ЕСТЬ]]"] },
        { heading: "6. Бракованные товары", body: ["[[УКАЖИТЕ ПОРЯДОК ГАРАНТИИ И РЕКЛАМАЦИЙ]]"] },
      ],
    },
    pl: {
      title: "Informacje o zwrotach",
      intro: "Ogólne informacje o zwrotach towarów. Szczegółowe warunki określa sprzedawca zgodnie z obowiązującymi przepisami.",
      sections: [
        { heading: "1. Prawo odstąpienia / zwrotu", body: ["[[WSKAŻ TERMIN I WARUNKI ODSTĄPIENIA OD UMOWY ZGODNIE Z PRZEPISAMI O OCHRONIE KONSUMENTÓW]]"] },
        { heading: "2. Jak zwrócić towar", body: ["Skontaktuj się ze sprzedawcą, podając numer zamówienia. [[WSKAŻ PROCEDURĘ I WZÓR OŚWIADCZENIA]]"] },
        { heading: "3. Stan towaru", body: ["[[WSKAŻ WYMAGANIA DOTYCZĄCE STANU I KOMPLETNOŚCI TOWARU]]"] },
        { heading: "4. Zwrot środków", body: ["[[WSKAŻ TERMINY I SPOSÓB ZWROTU ŚRODKÓW ORAZ KTO PONOSI KOSZT ZWROTU PRZESYŁKI]]"] },
        { heading: "5. Towary wyłączone ze zwrotu", body: ["[[WSKAŻ WYJĄTKI, JEŚLI WYSTĘPUJĄ]]"] },
        { heading: "6. Towary wadliwe", body: ["[[WSKAŻ ZASADY GWARANCJI I REKLAMACJI]]"] },
      ],
    },
  },
};
