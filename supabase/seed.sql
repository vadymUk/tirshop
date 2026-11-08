-- Sample catalog for local/dev. Safe to re-run (idempotent on slug).
insert into public.categories (name, slug, description) values
  ('Cab Comfort',        'cab-comfort',        'Sleep and rest essentials for the truck cab.'),
  ('Kitchen & Cooking',  'kitchen-cooking',    '12V appliances and gear for eating well on the road.'),
  ('Electronics',        'electronics',        'Navigation, dash cams and power for long hauls.'),
  ('Safety & Workwear',  'safety-workwear',    'Hi-vis, gloves and emergency equipment required in the EU.'),
  ('Tools & Maintenance','tools-maintenance',  'Everything for quick roadside fixes and cab upkeep.')
on conflict (slug) do nothing;

insert into public.products
  (category_id, name, slug, short_description, description, price, currency, stock_quantity)
select c.id, v.name, v.slug, v.short_description, v.description, v.price, 'EUR', v.stock
from (values
  ('cab-comfort', 'Memory Foam Truck Mattress 80x190', 'memory-foam-truck-mattress',
   'Orthopedic 8 cm mattress sized for truck sleeper cabs.',
   'Dual-density memory foam with a removable washable cover and anti-slip base. Designed to fit standard sleeper bunks.', 129.90, 25),
  ('cab-comfort', 'Blackout Curtain Set for Cab', 'blackout-curtain-set',
   'Thermal blackout curtains for windscreen and side windows.',
   'Reflective, light-blocking set that keeps the cab cool in summer and warm in winter.', 59.00, 40),
  ('cab-comfort', 'Lumbar Support Seat Cushion', 'lumbar-support-seat-cushion',
   'Ergonomic cushion to reduce back fatigue on long drives.',
   'Breathable mesh cover with adjustable strap and high-density foam.', 34.50, 60),
  ('kitchen-cooking', '12V Portable Cooler 24L', '12v-portable-cooler-24l',
   'Thermoelectric cooler that runs from the cab socket.',
   'Cools to 18 °C below ambient, with 12V DC and 230V AC cables included.', 89.00, 30),
  ('kitchen-cooking', '12V Electric Lunch Box', '12v-electric-lunch-box',
   'Heat meals on the road straight from the cigarette lighter.',
   'Stainless steel container with a removable tray and secure latch.', 32.90, 50),
  ('kitchen-cooking', 'Insulated Travel Mug 500 ml', 'insulated-travel-mug-500ml',
   'Keeps drinks hot for 12 hours; fits cab cup holders.',
   'Double-wall stainless steel with a leak-proof, one-hand lid.', 19.90, 120),
  ('electronics', 'Truck GPS Navigator 9"', 'truck-gps-navigator-9',
   'Truck-specific routing with height, weight and tunnel restrictions.',
   'Lifetime EU map updates, live traffic and parking POI database.', 219.00, 18),
  ('electronics', 'Dual-Channel Dash Cam 2K', 'dual-channel-dash-cam-2k',
   'Front and cabin recording with loop storage and G-sensor.',
   'Wide-angle night vision, parking mode and 24V truck-compatible power cable.', 109.00, 35),
  ('electronics', '24V to 12V Voltage Converter 20A', '24v-to-12v-voltage-converter',
   'Safely power 12V devices from a 24V truck system.',
   'Waterproof, overload and short-circuit protected, with a mounting bracket.', 27.50, 80),
  ('safety-workwear', 'High-Visibility Vest EN ISO 20471', 'hi-vis-vest-en-iso-20471',
   'Class 2 reflective vest, mandatory in many EU countries.',
   'Breathable fabric with adjustable closure; available in yellow.', 7.90, 200),
  ('safety-workwear', 'Warning Triangle & First Aid Kit Set', 'warning-triangle-first-aid-set',
   'E-marked triangle and DIN 13164 first aid kit.',
   'Compliant with European road regulations; stored in a compact hard case.', 24.90, 90),
  ('safety-workwear', 'Anti-Slip Work Gloves (3 pairs)', 'anti-slip-work-gloves-3-pack',
   'Durable gloves for load securing and fueling.',
   'Nitrile-coated palm for grip, breathable back, sizes M to XL.', 14.90, 150),
  ('tools-maintenance', 'Heavy-Duty Tyre Pressure Gauge', 'heavy-duty-tyre-pressure-gauge',
   'Accurate gauge up to 16 bar for truck tyres.',
   'Brass fittings, bleed valve and protective rubber cover.', 22.00, 70),
  ('tools-maintenance', 'LED Rechargeable Work Light', 'led-rechargeable-work-light',
   'Magnetic COB work light with hook for night repairs.',
   '1000 lumens, USB-C charging and 5 lighting modes.', 29.90, 85),
  ('tools-maintenance', 'Cab Cleaning Kit', 'cab-cleaning-kit',
   'Microfibre cloths, brushes and interior cleaner.',
   'Everything to keep the cab fresh between stops.', 21.00, 55)
) as v(category_slug, name, slug, short_description, description, price, stock)
join public.categories c on c.slug = v.category_slug
on conflict (slug) do nothing;
