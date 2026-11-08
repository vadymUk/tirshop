/** Local translations for catalog texts stored in the database (English source). */
type Row = [source: string, ua: string, ru: string, pl: string];

const rows: Row[] = [
  // Category descriptions
  ["Sleep and rest essentials for the truck cab.", "Усе необхідне для сну та відпочинку в кабіні вантажівки.", "Всё необходимое для сна и отдыха в кабине грузовика.", "Wszystko do spania i odpoczynku w kabinie ciężarówki."],
  ["12V appliances and gear for eating well on the road.", "Прилади 12 В та приладдя для смачного харчування в дорозі.", "Приборы 12 В и аксессуары для вкусного питания в дороге.", "Urządzenia 12 V i akcesoria do dobrego jedzenia w trasie."],
  ["Navigation, dash cams and power for long hauls.", "Навігація, відеореєстратори та живлення для дальніх рейсів.", "Навигация, видеорегистраторы и питание для дальних рейсов.", "Nawigacja, wideorejestratory i zasilanie na długie trasy."],
  ["Hi-vis, gloves and emergency equipment required in the EU.", "Світловідбивні жилети, рукавиці та аварійне обладнання, обов’язкове в ЄС.", "Светоотражающие жилеты, перчатки и аварийное оборудование, обязательное в ЕС.", "Odzież odblaskowa, rękawice i wyposażenie awaryjne wymagane w UE."],
  ["Everything for quick roadside fixes and cab upkeep.", "Усе для швидкого ремонту в дорозі та догляду за кабіною.", "Всё для быстрого ремонта в дороге и ухода за кабиной.", "Wszystko do szybkich napraw w trasie i dbania o kabinę."],

  // Cab Comfort
  ["Memory Foam Truck Mattress 80x190", "Матрац із піни з пам’яттю для вантажівки 80x190", "Матрас из пены с памятью для грузовика 80x190", "Materac z pianki memory do ciężarówki 80x190"],
  ["Orthopedic 8 cm mattress sized for truck sleeper cabs.", "Ортопедичний матрац 8 см для спальних кабін вантажівок.", "Ортопедический матрас 8 см для спальных кабин грузовиков.", "Ortopedyczny materac 8 cm dopasowany do kabin sypialnych ciężarówek."],
  ["Dual-density memory foam with a removable washable cover and anti-slip base. Designed to fit standard sleeper bunks.", "Піна з пам’яттю подвійної щільності зі знімним чохлом, який можна прати, та протиковзною основою. Розрахований на стандартні спальні місця.", "Пена с памятью двойной плотности со съёмным стираемым чехлом и противоскользящей основой. Рассчитан на стандартные спальные места.", "Pianka memory o podwójnej gęstości ze zdejmowanym, nadającym się do prania pokrowcem i antypoślizgowym spodem. Pasuje do standardowych leżanek."],
  ["Blackout Curtain Set for Cab", "Комплект затемнювальних штор для кабіни", "Комплект затемняющих штор для кабины", "Zestaw zaciemniających zasłon do kabiny"],
  ["Thermal blackout curtains for windscreen and side windows.", "Термошторы для лобового та бічних вікон.", "Термошторы для лобового и боковых окон.", "Zasłony termiczne na szybę przednią i okna boczne."],
  ["Reflective, light-blocking set that keeps the cab cool in summer and warm in winter.", "Відбивальний комплект, що не пропускає світло: влітку в кабіні прохолодно, взимку тепло.", "Отражающий комплект, не пропускающий свет: летом в кабине прохладно, зимой тепло.", "Odblaskowy zestaw blokujący światło, dzięki któremu w kabinie jest chłodno latem i ciepło zimą."],
  ["Lumbar Support Seat Cushion", "Подушка на сидіння з підтримкою попереку", "Подушка на сиденье с поддержкой поясницы", "Poduszka na siedzenie z podparciem lędźwi"],
  ["Ergonomic cushion to reduce back fatigue on long drives.", "Ергономічна подушка, що зменшує втому спини в довгих поїздках.", "Эргономичная подушка, уменьшающая усталость спины в долгих поездках.", "Ergonomiczna poduszka zmniejszająca zmęczenie pleców w długiej jeździe."],
  ["Breathable mesh cover with adjustable strap and high-density foam.", "Чохол з повітропроникної сітки, регульований ремінь і піна високої щільності.", "Чехол из дышащей сетки, регулируемый ремень и пена высокой плотности.", "Oddychający pokrowiec z siatki, regulowany pasek i pianka o wysokiej gęstości."],

  // Kitchen & Cooking
  ["12V Portable Cooler 24L", "Портативний автохолодильник 12 В, 24 л", "Портативный автохолодильник 12 В, 24 л", "Przenośna lodówka samochodowa 12 V, 24 l"],
  ["Thermoelectric cooler that runs from the cab socket.", "Термоелектричний холодильник, що працює від гнізда в кабіні.", "Термоэлектрический холодильник, работающий от розетки в кабине.", "Lodówka termoelektryczna zasilana z gniazda w kabinie."],
  ["Cools to 18 °C below ambient, with 12V DC and 230V AC cables included.", "Охолоджує на 18 °C нижче температури навколишнього середовища, у комплекті кабелі 12 В DC та 230 В AC.", "Охлаждает на 18 °C ниже температуры окружающей среды, в комплекте кабели 12 В DC и 230 В AC.", "Chłodzi do 18 °C poniżej temperatury otoczenia, w zestawie przewody 12 V DC i 230 V AC."],
  ["12V Electric Lunch Box", "Електричний ланчбокс 12 В", "Электрический ланчбокс 12 В", "Elektryczny lunchbox 12 V"],
  ["Heat meals on the road straight from the cigarette lighter.", "Розігрівайте їжу в дорозі прямо від прикурювача.", "Разогревайте еду в дороге прямо от прикуривателя.", "Podgrzewaj posiłki w trasie prosto z zapalniczki samochodowej."],
  ["Stainless steel container with a removable tray and secure latch.", "Контейнер із нержавіючої сталі зі знімним лотком і надійним фіксатором.", "Контейнер из нержавеющей стали со съёмным лотком и надёжной защёлкой.", "Pojemnik ze stali nierdzewnej ze zdejmowaną tacką i pewnym zatrzaskiem."],
  ["Insulated Travel Mug 500 ml", "Термокружка 500 мл", "Термокружка 500 мл", "Kubek termiczny 500 ml"],
  ["Keeps drinks hot for 12 hours; fits cab cup holders.", "Тримає напої гарячими 12 годин; підходить до підстаканників у кабіні.", "Держит напитки горячими 12 часов; подходит для подстаканников в кабине.", "Utrzymuje ciepło napojów przez 12 godzin; pasuje do uchwytów na kubki w kabinie."],
  ["Double-wall stainless steel with a leak-proof, one-hand lid.", "Подвійні стінки з нержавіючої сталі, герметична кришка для відкривання однією рукою.", "Двойные стенки из нержавеющей стали, герметичная крышка с открыванием одной рукой.", "Podwójne ścianki ze stali nierdzewnej, szczelna pokrywka otwierana jedną ręką."],

  // Electronics
  ["Truck GPS Navigator 9\"", "GPS-навігатор для вантажівок 9\"", "GPS-навигатор для грузовиков 9\"", "Nawigacja GPS dla ciężarówek 9\""],
  ["Truck-specific routing with height, weight and tunnel restrictions.", "Маршрути для вантажівок з урахуванням обмежень за висотою, вагою та тунелями.", "Маршруты для грузовиков с учётом ограничений по высоте, весу и туннелям.", "Wyznaczanie tras dla ciężarówek z uwzględnieniem ograniczeń wysokości, masy i tuneli."],
  ["Lifetime EU map updates, live traffic and parking POI database.", "Довічні оновлення карт ЄС, актуальна інформація про трафік і база паркувань.", "Пожизненные обновления карт ЕС, актуальная информация о трафике и база парковок.", "Dożywotnie aktualizacje map UE, ruch drogowy na żywo i baza parkingów."],
  ["Dual-Channel Dash Cam 2K", "Двоканальний відеореєстратор 2K", "Двухканальный видеорегистратор 2K", "Dwukanałowy wideorejestrator 2K"],
  ["Front and cabin recording with loop storage and G-sensor.", "Запис дороги та кабіни із циклічним записом і G-сенсором.", "Запись дороги и кабины с циклической записью и G-сенсором.", "Nagrywanie drogi i kabiny z zapisem w pętli i czujnikiem G."],
  ["Wide-angle night vision, parking mode and 24V truck-compatible power cable.", "Широкий кут огляду, нічне бачення, режим паркування та кабель живлення, сумісний з 24 В.", "Широкий угол обзора, ночное видение, режим парковки и кабель питания, совместимый с 24 В.", "Szeroki kąt widzenia, noktowizor, tryb parkingowy i przewód zasilający zgodny z 24 V."],
  ["24V to 12V Voltage Converter 20A", "Перетворювач напруги 24 В на 12 В, 20 А", "Преобразователь напряжения 24 В в 12 В, 20 А", "Przetwornica napięcia 24 V na 12 V, 20 A"],
  ["Safely power 12V devices from a 24V truck system.", "Безпечно живіть пристрої 12 В від бортової мережі вантажівки 24 В.", "Безопасно питайте устройства 12 В от бортовой сети грузовика 24 В.", "Bezpiecznie zasilaj urządzenia 12 V z instalacji ciężarówki 24 V."],
  ["Waterproof, overload and short-circuit protected, with a mounting bracket.", "Водонепроникний, із захистом від перевантаження та короткого замикання, з кріпленням.", "Водонепроницаемый, с защитой от перегрузки и короткого замыкания, с креплением.", "Wodoodporna, z zabezpieczeniem przed przeciążeniem i zwarciem, z uchwytem montażowym."],

  // Safety & Workwear
  ["High-Visibility Vest EN ISO 20471", "Сигнальний жилет EN ISO 20471", "Сигнальный жилет EN ISO 20471", "Kamizelka ostrzegawcza EN ISO 20471"],
  ["Class 2 reflective vest, mandatory in many EU countries.", "Світловідбивний жилет класу 2, обов’язковий у багатьох країнах ЄС.", "Светоотражающий жилет класса 2, обязательный во многих странах ЕС.", "Kamizelka odblaskowa klasy 2, obowiązkowa w wielu krajach UE."],
  ["Breathable fabric with adjustable closure; available in yellow.", "Повітропроникна тканина з регульованою застібкою; доступний у жовтому кольорі.", "Дышащая ткань с регулируемой застёжкой; доступен в жёлтом цвете.", "Oddychająca tkanina z regulowanym zapięciem; dostępna w kolorze żółtym."],
  ["Warning Triangle & First Aid Kit Set", "Набір: знак аварійної зупинки та аптечка", "Набор: знак аварийной остановки и аптечка", "Zestaw: trójkąt ostrzegawczy i apteczka"],
  ["E-marked triangle and DIN 13164 first aid kit.", "Знак аварійної зупинки з маркуванням E та аптечка DIN 13164.", "Знак аварийной остановки с маркировкой E и аптечка DIN 13164.", "Trójkąt ostrzegawczy z homologacją E i apteczka DIN 13164."],
  ["Compliant with European road regulations; stored in a compact hard case.", "Відповідає європейським правилам дорожнього руху; зберігається в компактному жорсткому кейсі.", "Соответствует европейским правилам дорожного движения; хранится в компактном жёстком кейсе.", "Zgodny z europejskimi przepisami drogowymi; przechowywany w kompaktowym twardym etui."],
  ["Anti-Slip Work Gloves (3 pairs)", "Робочі рукавиці з антиковзним покриттям (3 пари)", "Рабочие перчатки с противоскользящим покрытием (3 пары)", "Rękawice robocze antypoślizgowe (3 pary)"],
  ["Durable gloves for load securing and fueling.", "Міцні рукавиці для кріплення вантажу та заправки.", "Прочные перчатки для крепления груза и заправки.", "Wytrzymałe rękawice do mocowania ładunku i tankowania."],
  ["Nitrile-coated palm for grip, breathable back, sizes M to XL.", "Долоня з нітриловим покриттям для кращого захоплення, повітропроникна спинка, розміри M–XL.", "Ладонь с нитриловым покрытием для лучшего хвата, дышащая спинка, размеры M–XL.", "Dłoń powlekana nitrylem dla lepszego chwytu, oddychający wierzch, rozmiary M–XL."],

  // Tools & Maintenance
  ["Heavy-Duty Tyre Pressure Gauge", "Професійний манометр для шин", "Профессиональный манометр для шин", "Profesjonalny manometr do opon"],
  ["Accurate gauge up to 16 bar for truck tyres.", "Точний манометр до 16 бар для шин вантажівок.", "Точный манометр до 16 бар для шин грузовиков.", "Dokładny manometr do 16 barów do opon ciężarowych."],
  ["Brass fittings, bleed valve and protective rubber cover.", "Латунні фітинги, випускний клапан і захисний гумовий чохол.", "Латунные фитинги, спускной клапан и защитный резиновый чехол.", "Mosiężne złączki, zawór spustowy i ochronna gumowa osłona."],
  ["LED Rechargeable Work Light", "Акумуляторний LED-ліхтар для роботи", "Аккумуляторный LED-фонарь для работы", "Akumulatorowa lampa robocza LED"],
  ["Magnetic COB work light with hook for night repairs.", "Магнітний COB-ліхтар із гачком для нічного ремонту.", "Магнитный COB-фонарь с крючком для ночного ремонта.", "Magnetyczna lampa robocza COB z hakiem do nocnych napraw."],
  ["1000 lumens, USB-C charging and 5 lighting modes.", "1000 люменів, заряджання через USB-C і 5 режимів освітлення.", "1000 люменов, зарядка через USB-C и 5 режимов освещения.", "1000 lumenów, ładowanie USB-C i 5 trybów oświetlenia."],
  ["Cab Cleaning Kit", "Набір для прибирання кабіни", "Набор для уборки кабины", "Zestaw do czyszczenia kabiny"],
  ["Microfibre cloths, brushes and interior cleaner.", "Серветки з мікрофібри, щітки та засіб для чищення салону.", "Салфетки из микрофибры, щётки и средство для чистки салона.", "Ściereczki z mikrofibry, szczotki i środek do czyszczenia wnętrza."],
  ["Everything to keep the cab fresh between stops.", "Усе, щоб кабіна залишалася свіжою між зупинками.", "Всё, чтобы кабина оставалась свежей между остановками.", "Wszystko, by kabina była świeża między postojami."],
];

export const catalogTranslations = {
  ua: Object.fromEntries(rows.map((r) => [r[0], r[1]])),
  ru: Object.fromEntries(rows.map((r) => [r[0], r[2]])),
  pl: Object.fromEntries(rows.map((r) => [r[0], r[3]])),
} as Record<"ua" | "ru" | "pl", Record<string, string>>;

/** English source texts whose UA/RU/PL translation contains the word, so search works in any site language. */
export function findCatalogSources(word: string): string[] {
  const needle = word.toLocaleLowerCase();
  return rows
    .filter((row) => row.slice(1).some((text) => text.toLocaleLowerCase().includes(needle)))
    .map((row) => row[0]);
}
