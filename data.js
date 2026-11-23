// Seed data for the demo. Everything is stored in the browser (localStorage),
// so the client can click around freely; "Reset demo" restores this state.
function seedData() {
  const categories = [
    { id: 'nuts', name: 'Nuts', emoji: '🥜' },
    { id: 'dried', name: 'Dried Fruits', emoji: '🍇' },
    { id: 'seeds', name: 'Seeds', emoji: '🌻' },
    { id: 'mixes', name: 'Mixes', emoji: '🥣' },
    { id: 'snacks', name: 'Snacks & Sweets', emoji: '🍫' },
  ];

  const P = (id, sku, name, cat, emoji, pack, price, extra = {}) => ({
    id, sku, name, cat, emoji, pack, price, offerPrice: null, isNew: false,
    active: true, stock: 200, origin: '', tags: '', desc: '', ...extra,
  });

  const products = [
    P('p1', 'NUT-ALM-05', 'Almonds, raw', 'nuts', '🌰', '5 kg bag', 42.5, { origin: 'Spain', tags: 'bajame badem almond' }),
    P('p2', 'NUT-ALM-R05', 'Almonds, roasted & salted', 'nuts', '🌰', '5 kg bag', 46.0, { origin: 'Spain', tags: 'bajame badem' }),
    P('p3', 'NUT-CSH-05', 'Cashews W320', 'nuts', '🥜', '5 kg bag', 54.0, { origin: 'Vietnam', tags: 'shqeme indijski orah cashew', offerPrice: 49.0 }),
    P('p4', 'NUT-WAL-05', 'Walnut kernels', 'nuts', '🌰', '5 kg bag', 38.0, { origin: 'Chile', tags: 'arra orah walnut' }),
    P('p5', 'NUT-HAZ-05', 'Hazelnuts, roasted', 'nuts', '🌰', '5 kg bag', 44.0, { origin: 'Turkey', tags: 'lajthi lesnik hazelnut' }),
    P('p6', 'NUT-PIS-05', 'Pistachios, roasted & salted', 'nuts', '🥜', '5 kg bag', 72.0, { origin: 'Iran', tags: 'fistik pistachio', isNew: true }),
    P('p7', 'NUT-PEA-10', 'Peanuts, roasted', 'nuts', '🥜', '10 kg bag', 28.0, { origin: 'Argentina', tags: 'kikirik peanut' }),
    P('p8', 'DRY-APR-05', 'Dried apricots', 'dried', '🍑', '5 kg box', 36.0, { origin: 'Turkey', tags: 'kajsi apricot' }),
    P('p9', 'DRY-FIG-05', 'Dried figs', 'dried', '🫐', '5 kg box', 33.0, { origin: 'Turkey', tags: 'fiq smokva fig' }),
    P('p10', 'DRY-DAT-05', 'Medjool dates', 'dried', '🌴', '5 kg box', 48.0, { origin: 'Israel', tags: 'hurma dates', isNew: true }),
    P('p11', 'DRY-RAI-10', 'Raisins, golden', 'dried', '🍇', '10 kg box', 31.0, { origin: 'Iran', tags: 'rrush i thate suvo grozdje raisin', offerPrice: 27.5 }),
    P('p12', 'DRY-CRN-05', 'Dried cranberries', 'dried', '🍒', '5 kg box', 39.0, { origin: 'USA', tags: 'brusnica cranberry' }),
    P('p13', 'DRY-PLM-05', 'Dried plums, pitted', 'dried', '🫐', '5 kg box', 29.0, { origin: 'Serbia', tags: 'kumbulla shljiva prune' }),
    P('p14', 'SEE-SUN-10', 'Sunflower seeds, roasted', 'seeds', '🌻', '10 kg bag', 19.0, { tags: 'fara luledielli suncokret' }),
    P('p15', 'SEE-PUM-05', 'Pumpkin seeds', 'seeds', '🎃', '5 kg bag', 34.0, { tags: 'fara kungulli bundeva' }),
    P('p16', 'SEE-CHI-05', 'Chia seeds', 'seeds', '🌱', '5 kg bag', 27.0, { tags: 'chia' }),
    P('p17', 'MIX-STU-05', 'Student mix', 'mixes', '🥣', '5 kg bag', 32.0, { tags: 'studentski mix trail' }),
    P('p18', 'MIX-PRE-05', 'Premium nut mix', 'mixes', '🥣', '5 kg bag', 58.0, { tags: 'mix premium', isNew: true }),
    P('p19', 'SNK-CHA-03', 'Chocolate-coated almonds', 'snacks', '🍫', '3 kg box', 37.0, { tags: 'cokollate chocolate' }),
    P('p20', 'SNK-LOK-03', 'Turkish delight (lokum)', 'snacks', '🍬', '3 kg box', 24.0, { tags: 'llokum lokum' }),
  ];

  const customers = [
    {
      id: 'c1', business: 'Market Ana Sh.p.k.', nipt: 'L91234567A', contact: 'Ana Hoxha',
      phone: '+355 69 111 2233', email: 'orders@marketana.example',
      points: [
        { id: 'pt1', name: 'Market Ana — Center', address: 'Rr. Myslym Shyri 12, Tirana' },
        { id: 'pt2', name: 'Market Ana — Kombinat', address: 'Rr. Ali Visha 40, Tirana' },
        { id: 'pt3', name: 'Market Ana — Durrës', address: 'Lagjja 13, Rr. Taulantia, Durrës' },
      ],
    },
    {
      id: 'c2', business: 'Café Lumi', nipt: 'K81122334B', contact: 'Arben Lumi',
      phone: '+355 68 222 3344', email: 'lumi@cafe.example',
      points: [{ id: 'pt4', name: 'Café Lumi', address: 'Bulevardi Zogu I, Tirana' }],
    },
  ];

  const drivers = [
    { id: 'd1', name: 'Gent (Van 1)', phone: '+355690000001' },
    { id: 'd2', name: 'Ilir (Van 2)', phone: '+355690000002' },
  ];

  const posts = [
    { id: 'n1', type: 'offer', title: 'November offer: Cashews & Raisins', body: 'Cashews W320 now €49 / 5 kg and golden raisins €27.50 / 10 kg until the end of the month.', published: true, createdAt: daysAgo(3) },
    { id: 'n2', type: 'news', title: 'New in stock: Medjool dates & Premium mix', body: 'Fresh season Medjool dates and our new Premium nut mix are now available for order.', published: true, createdAt: daysAgo(8) },
  ];

  // Past orders so "My Orders" and "Buy Again" have content.
  const mk = (no, cust, pt, items, status, ago, driver) => {
    const c = customers.find(x => x.id === cust);
    const point = c.points.find(x => x.id === pt);
    const lines = items.map(([pid, qty]) => {
      const p = products.find(x => x.id === pid);
      return { pid, name: p.name, sku: p.sku, pack: p.pack, price: p.offerPrice ?? p.price, qty };
    });
    const created = daysAgo(ago);
    const order = { id: 'o' + no, no: 'FR-' + no, customerId: cust, point: { ...point }, items: lines, note: '', deliveryDate: '', status, driverId: driver || null, createdAt: created, history: [] };
    const flow = ['received', 'processing', 'out', 'delivered'];
    const idx = flow.indexOf(status);
    for (let i = 0; i <= idx; i++) order.history.push({ status: flow[i], at: new Date(new Date(created).getTime() + i * 5 * 3600e3).toISOString() });
    return order;
  };

  const orders = [
    mk(1001, 'c1', 'pt1', [['p1', 2], ['p3', 1], ['p8', 2], ['p14', 1]], 'delivered', 26, 'd1'),
    mk(1002, 'c1', 'pt2', [['p1', 1], ['p4', 2], ['p11', 1]], 'delivered', 19, 'd2'),
    mk(1003, 'c2', 'pt4', [['p17', 2], ['p20', 1]], 'delivered', 15, 'd1'),
    mk(1004, 'c1', 'pt1', [['p1', 3], ['p3', 2], ['p8', 1], ['p17', 2]], 'delivered', 11, 'd1'),
    mk(1005, 'c1', 'pt3', [['p5', 1], ['p9', 2], ['p14', 2]], 'out', 1, 'd2'),
    mk(1006, 'c1', 'pt1', [['p3', 1], ['p6', 1], ['p10', 1]], 'processing', 0),
    mk(1007, 'c2', 'pt4', [['p18', 1], ['p19', 1]], 'received', 0),
  ];

  const problems = [
    { id: 'r1', orderId: 'o1002', customerId: 'c1', type: 'Damaged product', text: 'One bag of walnuts was torn on arrival.', status: 'resolved', createdAt: daysAgo(18), reply: 'Sorry! We credited one bag on your next invoice.' },
  ];

  return {
    version: 1, nextOrderNo: 1008, vat: 0.20,
    company: { name: 'Frugea', phone: '+355 69 000 0000', whatsapp: '355690000000' },
    categories, products, customers, drivers, posts, orders, problems,
    favorites: { c1: ['p6', 'p12'], c2: [] },
    carts: { c1: [], c2: [] },
    session: null,
  };
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9 + (n % 6), 15, 0, 0);
  return d.toISOString();
}
