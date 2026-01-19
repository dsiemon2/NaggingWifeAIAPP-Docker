import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database for Nagging Wife AI...');

  // ==============================
  // SUPER ADMIN (Platform Owner)
  // ==============================
  const superAdminPassword = await bcrypt.hash('superadmin123', 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@system.local' },
    update: {},
    create: {
      email: 'superadmin@system.local',
      password: superAdminPassword,
      name: 'System Administrator',
      role: 'SUPER_ADMIN',
      groupId: null, // Super admin has no group
      emailVerified: true,
    },
  });
  console.log('Created super admin:', superAdmin.email);

  // ==============================
  // DEMO FAMILY GROUP
  // ==============================
  const group = await prisma.group.upsert({
    where: { domain: 'family.local' },
    update: {},
    create: {
      name: 'Smith Family',
      domain: 'family.local',
      planType: 'plus',
      isActive: true,
    },
  });
  console.log('Created family group:', group.name);

  // ==============================
  // GROUP_ADMIN - Family Account Owner (Husband - the one who pays!)
  // ==============================
  const adminPassword = await bcrypt.hash('admin123', 12);
  const groupAdmin = await prisma.user.upsert({
    where: { email: 'john@family.local' },
    update: {},
    create: {
      email: 'john@family.local',
      username: 'john',
      password: adminPassword,
      name: 'John Smith',
      role: 'GROUP_ADMIN',
      groupId: group.id,
      birthDate: new Date('1985-07-15'),
      emailVerified: true,
    },
  });
  console.log('Created GROUP_ADMIN:', groupAdmin.email);

  // ==============================
  // PARTNER - Spouse (The "Nagging Wife")
  // ==============================
  const partnerPassword = await bcrypt.hash('partner123', 12);
  const partner = await prisma.user.upsert({
    where: { email: 'sarah@family.local' },
    update: {},
    create: {
      email: 'sarah@family.local',
      username: 'sarah',
      password: partnerPassword,
      name: 'Sarah Smith',
      role: 'PARTNER',
      groupId: group.id,
      birthDate: new Date('1987-03-15'),
      emailVerified: true,
    },
  });
  console.log('Created PARTNER:', partner.email);

  // ==============================
  // MEMBER (Adult Child - 18+)
  // ==============================
  const adultMemberPassword = await bcrypt.hash('member123', 12);
  const adultMember = await prisma.user.upsert({
    where: { email: 'emma@family.local' },
    update: {},
    create: {
      email: 'emma@family.local',
      username: 'emma',
      password: adultMemberPassword,
      name: 'Emma Smith',
      role: 'MEMBER',
      groupId: group.id,
      birthDate: new Date('2002-05-20'), // Adult (over 18)
      emailVerified: true,
    },
  });
  console.log('Created MEMBER (adult):', adultMember.email);

  // ==============================
  // MEMBER (Minor Child - Under 18)
  // ==============================
  const minorMemberPassword = await bcrypt.hash('member123', 12);
  const minorMember = await prisma.user.upsert({
    where: { email: 'bobby@family.local' },
    update: {},
    create: {
      email: 'bobby@family.local',
      username: 'bobby',
      password: minorMemberPassword,
      name: 'Bobby Smith',
      role: 'MEMBER',
      groupId: group.id,
      birthDate: new Date('2010-11-10'), // Minor (under 18)
      emailVerified: true,
    },
  });
  console.log('Created MEMBER (minor):', minorMember.email);

  console.log(`
====================================
  TEST USER CREDENTIALS
====================================

SUPER_ADMIN (Platform Owner):
  Email: superadmin@system.local
  Password: superadmin123

GROUP_ADMIN (Family Admin - John):
  Email: john@family.local
  Password: admin123

PARTNER (Spouse - Sarah):
  Email: sarah@family.local
  Password: partner123

MEMBER - Adult (Emma, 22):
  Email: emma@family.local
  Password: member123
  (Can see billing)

MEMBER - Minor (Bobby, 14):
  Email: bobby@family.local
  Password: member123
  (Cannot see billing)

====================================
  `);

  // ==============================
  // APP CONFIG - Nagging Wife AI
  // ==============================
  await prisma.appConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      appName: 'Nagging Wife AI',
      selectedVoice: 'nova',
      assistantMode: 'helpful',
      maxSessionMins: 30,
      transcriptionEnabled: true,
      autoSummaryEnabled: true,
      primaryLanguage: 'en',
      greeting: 'Hey honey! Let me help you remember what you need to do to keep that happy wife, happy life!',
      notificationsEnabled: true,
      reminderFrequency: 'daily',
    },
  });
  console.log('Created app config');

  // ==============================
  // IMPORTANT DATES
  // ==============================
  const importantDates = [
    {
      id: 'date-wife-bday',
      title: "Wife's Birthday",
      dateType: 'birthday',
      person: 'Sarah',
      date: new Date('2025-03-15'),
      recurring: true,
      reminderDays: 14,
      notes: 'She mentioned wanting that spa day package',
      giftIdeas: ['Spa day package', 'Diamond earrings', 'Weekend getaway', 'New handbag'],
    },
    {
      id: 'date-anniversary',
      title: 'Wedding Anniversary',
      dateType: 'anniversary',
      person: 'Sarah',
      date: new Date('2025-06-22'),
      recurring: true,
      reminderDays: 21,
      notes: '10 year anniversary! Make it special!',
      giftIdeas: ['Renew vows trip', 'Diamond necklace', 'Second honeymoon to Italy', 'Custom photo album'],
    },
    {
      id: 'date-mom-bday',
      title: "Mom's Birthday",
      dateType: 'birthday',
      person: 'Mom',
      date: new Date('2025-05-08'),
      recurring: true,
      reminderDays: 10,
      notes: 'Send flowers and call early',
      giftIdeas: ['Flower arrangement', 'Gift basket', 'Family photo session'],
    },
    {
      id: 'date-mil-bday',
      title: "Mother-in-Law's Birthday",
      dateType: 'birthday',
      person: 'Mother-in-Law',
      date: new Date('2025-09-12'),
      recurring: true,
      reminderDays: 14,
      notes: 'Ask Sarah for gift ideas - be extra thoughtful!',
      giftIdeas: ['Day spa gift card', 'Kitchen gadgets', 'Garden supplies'],
    },
    {
      id: 'date-valentines',
      title: "Valentine's Day",
      dateType: 'holiday',
      date: new Date('2025-02-14'),
      recurring: true,
      reminderDays: 14,
      notes: 'Make dinner reservations early! Dont forget flowers AND chocolate',
      giftIdeas: ['Roses', 'Jewelry', 'Romantic dinner', 'Weekend trip'],
    },
    {
      id: 'date-mothers-day',
      title: "Mother's Day",
      dateType: 'holiday',
      date: new Date('2025-05-11'),
      recurring: true,
      reminderDays: 14,
      notes: 'Breakfast in bed, brunch reservation for her and her mom',
      giftIdeas: ['Spa treatment', 'Jewelry', 'Flowers', 'Day off from chores'],
    },
    {
      id: 'date-first-date',
      title: 'Anniversary of First Date',
      dateType: 'anniversary',
      person: 'Sarah',
      date: new Date('2025-04-03'),
      recurring: true,
      reminderDays: 7,
      notes: 'Italian restaurant where we had our first date',
      giftIdeas: ['Recreate first date', 'Nostalgic gift'],
    },
  ];

  for (const date of importantDates) {
    await prisma.importantDate.upsert({
      where: { id: date.id },
      update: {},
      create: date,
    });
  }
  console.log('Created important dates');

  // ==============================
  // WIFE'S WISHLIST
  // ==============================
  const wishlistItems = [
    {
      id: 'wish-spa',
      name: 'Luxury Spa Day Package',
      description: 'Full day spa treatment at The Grand Spa',
      category: 'experiences',
      priority: 'high',
      priceRange: '$200-300',
      productUrl: 'https://example.com/spa-package',
      occasion: 'birthday',
      notes: 'She mentioned this twice last month',
    },
    {
      id: 'wish-earrings',
      name: 'Diamond Stud Earrings',
      description: '1 carat diamond studs, white gold setting',
      category: 'jewelry',
      priority: 'must-have',
      priceRange: '$500-1000',
      productUrl: 'https://example.com/diamond-earrings',
      occasion: 'anniversary',
      notes: 'Her friend has similar ones she admires',
    },
    {
      id: 'wish-handbag',
      name: 'Coach Crossbody Bag',
      description: 'Brown leather, medium size',
      category: 'clothing',
      priority: 'normal',
      priceRange: '$200-350',
      productUrl: 'https://example.com/coach-bag',
      occasion: 'christmas',
    },
    {
      id: 'wish-kitchenaid',
      name: 'KitchenAid Stand Mixer',
      description: 'Artisan Series, Empire Red color',
      category: 'home',
      priority: 'high',
      priceRange: '$350-450',
      productUrl: 'https://example.com/kitchenaid',
      occasion: 'christmas',
      notes: 'Has been asking about this for baking projects',
    },
    {
      id: 'wish-yoga',
      name: 'Yoga Class Membership',
      description: '6-month unlimited at Hot Yoga Studio',
      category: 'experiences',
      priority: 'normal',
      priceRange: '$400-600',
      occasion: 'just-because',
    },
    {
      id: 'wish-perfume',
      name: 'Chanel No. 5 Perfume',
      description: 'Large bottle, 3.4 oz',
      category: 'beauty',
      priority: 'normal',
      priceRange: '$100-150',
      occasion: 'valentines',
      notes: 'Her signature scent, running low',
    },
    {
      id: 'wish-watch',
      name: 'Apple Watch Series 9',
      description: 'Rose Gold, with Milanese loop band',
      category: 'electronics',
      priority: 'high',
      priceRange: '$400-500',
      occasion: 'birthday',
    },
    {
      id: 'wish-blanket',
      name: 'Luxury Weighted Blanket',
      description: '15lb, gray velvet cover',
      category: 'home',
      priority: 'low',
      priceRange: '$100-150',
      notes: 'Good stocking stuffer idea',
    },
    {
      id: 'wish-necklace',
      name: 'Personalized Name Necklace',
      description: 'Gold, with kids names',
      category: 'jewelry',
      priority: 'normal',
      priceRange: '$150-250',
      occasion: 'mothers-day',
    },
    {
      id: 'wish-trip',
      name: 'Weekend Trip to Napa Valley',
      description: 'Wine tasting tour and B&B stay',
      category: 'experiences',
      priority: 'must-have',
      priceRange: '$800-1200',
      occasion: 'anniversary',
      notes: 'Perfect 10 year anniversary gift!',
    },
  ];

  for (const item of wishlistItems) {
    await prisma.wishlistItem.upsert({
      where: { id: item.id },
      update: {},
      create: item,
    });
  }
  console.log('Created wishlist items');

  // ==============================
  // CHORES & HONEY-DO'S
  // ==============================
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const chores = [
    {
      id: 'chore-faucet',
      title: 'Fix leaky kitchen faucet',
      description: 'The faucet has been dripping for 2 weeks',
      category: 'repair',
      priority: 'high',
      status: 'pending',
      dueDate: tomorrow,
      estimatedTime: 60,
      assignedTo: 'John',
      notes: 'Might need new washer from hardware store',
    },
    {
      id: 'chore-lawn',
      title: 'Mow the lawn',
      description: 'Front and back yard',
      category: 'yard',
      priority: 'normal',
      status: 'pending',
      dueDate: new Date(Date.now() + 86400000 * 3),
      recurring: 'weekly',
      estimatedTime: 90,
      assignedTo: 'John',
    },
    {
      id: 'chore-gutters',
      title: 'Clean out gutters',
      description: 'Leaves building up from fall',
      category: 'yard',
      priority: 'high',
      status: 'pending',
      dueDate: nextWeek,
      estimatedTime: 120,
      assignedTo: 'John',
      notes: 'Borrow ladder from neighbor Dave',
    },
    {
      id: 'chore-groceries',
      title: 'Pick up groceries',
      description: 'Get items from the shopping list on fridge',
      category: 'errand',
      priority: 'urgent',
      status: 'in_progress',
      dueDate: new Date(),
      estimatedTime: 45,
      assignedTo: 'John',
      notes: 'Dont forget the organic milk!',
    },
    {
      id: 'chore-garage',
      title: 'Organize the garage',
      description: 'Clean up workbench, organize tools',
      category: 'household',
      priority: 'low',
      status: 'pending',
      dueDate: new Date(Date.now() + 86400000 * 14),
      estimatedTime: 180,
      assignedTo: 'John',
      notes: 'Get storage bins from Costco',
    },
    {
      id: 'chore-oil',
      title: 'Oil change for SUV',
      description: 'Due at 75,000 miles',
      category: 'errand',
      priority: 'normal',
      status: 'pending',
      dueDate: new Date(Date.now() + 86400000 * 5),
      recurring: 'monthly',
      estimatedTime: 60,
      assignedTo: 'John',
    },
    {
      id: 'chore-fence',
      title: 'Fix fence gate latch',
      description: 'Gate wont close properly',
      category: 'repair',
      priority: 'normal',
      status: 'pending',
      dueDate: nextWeek,
      estimatedTime: 30,
      assignedTo: 'John',
    },
    {
      id: 'chore-trash',
      title: 'Take out trash',
      description: 'Trash day is tomorrow!',
      category: 'household',
      priority: 'urgent',
      status: 'pending',
      dueDate: tomorrow,
      recurring: 'weekly',
      estimatedTime: 10,
      assignedTo: 'John',
    },
    {
      id: 'chore-lightbulb',
      title: 'Replace porch light bulb',
      description: 'Front porch light burned out',
      category: 'repair',
      priority: 'normal',
      status: 'completed',
      completedAt: new Date(Date.now() - 86400000),
      estimatedTime: 15,
      assignedTo: 'John',
    },
    {
      id: 'chore-bathroom',
      title: 'Recaulk master bathroom tub',
      description: 'Caulk is getting moldy',
      category: 'project',
      priority: 'high',
      status: 'pending',
      dueDate: new Date(Date.now() + 86400000 * 10),
      estimatedTime: 90,
      assignedTo: 'John',
      notes: 'Buy white silicone caulk',
    },
  ];

  for (const chore of chores) {
    await prisma.chore.upsert({
      where: { id: chore.id },
      update: {},
      create: chore,
    });
  }
  console.log('Created chores');

  // ==============================
  // GIFT ORDERS
  // ==============================
  const giftOrders = [
    {
      id: 'order-flowers-vday',
      recipientName: 'Sarah Smith',
      occasion: 'valentines',
      giftName: 'Dozen Red Roses',
      description: 'Long stem roses with babys breath',
      vendor: '1800flowers',
      amount: 89.99,
      orderType: 'flowers',
      status: 'delivered',
      trackingNumber: 'TRACK123456',
      deliveryDate: new Date('2025-02-14'),
      orderDate: new Date('2025-02-10'),
      transactionId: 'txn_flowers_001',
    },
    {
      id: 'order-perfume',
      recipientName: 'Sarah Smith',
      occasion: 'just-because',
      giftName: 'Chanel No. 5',
      description: '3.4 oz bottle',
      vendor: 'Nordstrom',
      amount: 142.00,
      orderType: 'product',
      status: 'shipped',
      trackingNumber: 'NORD789012',
      deliveryDate: new Date(Date.now() + 86400000 * 3),
      orderDate: new Date(),
      transactionId: 'txn_perfume_001',
    },
    {
      id: 'order-spa',
      recipientName: 'Sarah Smith',
      occasion: 'birthday',
      giftName: 'Spa Day Gift Certificate',
      description: 'Full day package at The Grand Spa',
      vendor: 'The Grand Spa',
      amount: 275.00,
      orderType: 'experience',
      status: 'pending',
      notes: 'Schedule delivery for March 10th',
    },
    {
      id: 'order-mothers-flowers',
      recipientName: 'Mom',
      occasion: 'mothers-day',
      giftName: 'Spring Flower Arrangement',
      description: 'Mixed tulips and lilies',
      vendor: 'ProFlowers',
      amount: 65.00,
      orderType: 'flowers',
      status: 'pending',
      deliveryDate: new Date('2025-05-11'),
      notes: 'Same address as last year',
    },
  ];

  for (const order of giftOrders) {
    await prisma.giftOrder.upsert({
      where: { id: order.id },
      update: {},
      create: order,
    });
  }
  console.log('Created gift orders');

  // ==============================
  // SEASONAL REMINDERS
  // ==============================
  const seasonalReminders = [
    {
      id: 'season-valentines',
      name: "Valentine's Day",
      description: 'Show her how much you love her!',
      season: 'valentines',
      reminderDays: 21,
      message: "Valentine's Day is coming! Time to plan something romantic.",
      giftSuggestions: ['Roses', 'Jewelry', 'Romantic dinner', 'Chocolate', 'Weekend getaway'],
      adCategory: 'seasonal',
      isActive: true,
    },
    {
      id: 'season-christmas',
      name: 'Christmas',
      description: 'Make it a memorable holiday season',
      season: 'christmas',
      reminderDays: 30,
      message: 'Christmas is approaching! Start shopping for her wishlist items.',
      giftSuggestions: ['Items from wishlist', 'Jewelry', 'Electronics', 'Stocking stuffers', 'Experiences'],
      adCategory: 'seasonal',
      isActive: true,
    },
    {
      id: 'season-mothers',
      name: "Mother's Day",
      description: "Celebrate the mother of your children",
      season: 'mothers-day',
      reminderDays: 21,
      message: "Mother's Day reminder! Dont forget your wife AND your mom.",
      giftSuggestions: ['Flowers', 'Brunch reservation', 'Spa day', 'Jewelry', 'Day off from chores'],
      adCategory: 'seasonal',
      isActive: true,
    },
    {
      id: 'season-birthday',
      name: 'Birthday Season',
      description: 'Birthday reminders and gift ideas',
      season: 'birthday',
      reminderDays: 14,
      message: 'A birthday is coming up! Check the wishlist for gift ideas.',
      giftSuggestions: ['Check wishlist', 'Plan a party', 'Make a reservation', 'Personalized gift'],
      isActive: true,
    },
    {
      id: 'season-anniversary',
      name: 'Anniversary',
      description: 'Celebrate your love',
      season: 'anniversary',
      reminderDays: 21,
      message: 'Your anniversary is approaching! Make it special.',
      giftSuggestions: ['Romantic trip', 'Jewelry', 'Recreate first date', 'Renew vows', 'Custom gift'],
      isActive: true,
    },
    {
      id: 'season-thanksgiving',
      name: 'Thanksgiving',
      description: 'Be thankful for your family',
      season: 'thanksgiving',
      reminderDays: 14,
      message: 'Thanksgiving is coming! Help with preparations and show gratitude.',
      giftSuggestions: ['Help with cooking', 'Host the family', 'Write a thank you note'],
      isActive: true,
    },
    {
      id: 'season-newyear',
      name: 'New Year',
      description: 'Start the year right',
      season: 'new-year',
      reminderDays: 14,
      message: "New Year's is coming! Plan something special to celebrate together.",
      giftSuggestions: ['New Year party', 'Resolution support', 'Romantic evening'],
      isActive: true,
    },
  ];

  for (const reminder of seasonalReminders) {
    await prisma.seasonalReminder.upsert({
      where: { id: reminder.id },
      update: {},
      create: reminder,
    });
  }
  console.log('Created seasonal reminders');

  // ==============================
  // ADS - REGULAR GUY ADS
  // ==============================
  const ads = [
    // Hunting
    {
      id: 'ad-hunting-1',
      title: 'Cabelas Pro Series Hunting Gear',
      description: 'Get 20% off all hunting equipment this season',
      category: 'hunting',
      imageUrl: 'https://images.unsplash.com/photo-1516820612845-a13894592046?w=300&h=200&fit=crop',
      linkUrl: 'https://example.com/cabelas',
      advertiser: 'Cabelas',
      priority: 10,
      placement: 'sidebar',
      isActive: true,
    },
    {
      id: 'ad-hunting-2',
      title: 'Bass Pro Shops Fall Sale',
      description: 'Rifles, ammo, and more - 25% off',
      category: 'hunting',
      imageUrl: 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=300&h=200&fit=crop',
      linkUrl: 'https://example.com/basspro',
      advertiser: 'Bass Pro Shops',
      priority: 8,
      placement: 'sidebar',
      isActive: true,
    },
    // Fishing
    {
      id: 'ad-fishing-1',
      title: 'Shimano Fishing Reels',
      description: 'Professional grade reels for serious anglers',
      category: 'fishing',
      imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=300&h=200&fit=crop',
      linkUrl: 'https://example.com/shimano',
      advertiser: 'Shimano',
      priority: 10,
      placement: 'sidebar',
      isActive: true,
    },
    // Tools
    {
      id: 'ad-tools-1',
      title: 'DeWalt Power Tool Set',
      description: 'Complete 20V MAX tool kit - Save $150',
      category: 'tools',
      imageUrl: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=300&h=200&fit=crop',
      linkUrl: 'https://example.com/dewalt',
      advertiser: 'DeWalt',
      priority: 15,
      placement: 'sidebar',
      isActive: true,
    },
    {
      id: 'ad-tools-2',
      title: 'Milwaukee Tool Sale',
      description: 'Buy one get one 50% off',
      category: 'tools',
      imageUrl: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=300&h=200&fit=crop',
      linkUrl: 'https://example.com/milwaukee',
      advertiser: 'Milwaukee Tool',
      priority: 12,
      placement: 'sidebar',
      isActive: true,
    },
    // Survival
    {
      id: 'ad-survival-1',
      title: 'Emergency Preparedness Kit',
      description: '72-hour survival kit for the whole family',
      category: 'survival',
      imageUrl: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=300&h=200&fit=crop',
      linkUrl: 'https://example.com/survival',
      advertiser: 'Ready America',
      priority: 8,
      placement: 'sidebar',
      isActive: true,
    },
    // DIY
    {
      id: 'ad-diy-1',
      title: 'Home Depot DIY Workshops',
      description: 'Free weekend workshops - Learn new skills',
      category: 'diy',
      imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=200&fit=crop',
      linkUrl: 'https://example.com/homedepot',
      advertiser: 'Home Depot',
      priority: 10,
      placement: 'sidebar',
      isActive: true,
    },
    {
      id: 'ad-diy-2',
      title: 'Lowes Tool Rental',
      description: 'Rent professional tools for your next project',
      category: 'diy',
      imageUrl: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=300&h=200&fit=crop',
      linkUrl: 'https://example.com/lowes',
      advertiser: 'Lowes',
      priority: 8,
      placement: 'sidebar',
      isActive: true,
    },
    // Cars & Trucks
    {
      id: 'ad-trucks-1',
      title: 'Ford F-150 Year-End Sale',
      description: '0% APR financing on new F-150s',
      category: 'cars-trucks',
      imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=728&h=200&fit=crop',
      linkUrl: 'https://example.com/ford',
      advertiser: 'Ford',
      priority: 20,
      placement: 'banner',
      isActive: true,
    },
    {
      id: 'ad-trucks-2',
      title: 'AutoZone Parts Sale',
      description: '20% off all truck accessories',
      category: 'cars-trucks',
      imageUrl: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=300&h=200&fit=crop',
      linkUrl: 'https://example.com/autozone',
      advertiser: 'AutoZone',
      priority: 10,
      placement: 'sidebar',
      isActive: true,
    },
    // Sports
    {
      id: 'ad-sports-1',
      title: 'NFL Sunday Ticket',
      description: 'Never miss a game this season',
      category: 'sports',
      imageUrl: 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=728&h=200&fit=crop',
      linkUrl: 'https://example.com/nfl',
      advertiser: 'DirecTV',
      priority: 15,
      placement: 'banner',
      isActive: true,
    },
    // Seasonal Ads
    {
      id: 'ad-seasonal-valentines',
      title: '1-800-Flowers Valentines Special',
      description: 'Roses starting at $49.99 - Free delivery',
      category: 'seasonal',
      imageUrl: 'https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?w=728&h=200&fit=crop',
      linkUrl: 'https://example.com/flowers',
      advertiser: '1-800-Flowers',
      startDate: new Date('2025-01-15'),
      endDate: new Date('2025-02-14'),
      priority: 25,
      placement: 'announcement-bar',
      isActive: true,
    },
    {
      id: 'ad-seasonal-christmas',
      title: 'Zales Holiday Sale',
      description: 'Save 40% on diamond jewelry',
      category: 'seasonal',
      imageUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=728&h=200&fit=crop',
      linkUrl: 'https://example.com/zales',
      advertiser: 'Zales',
      startDate: new Date('2025-11-15'),
      endDate: new Date('2025-12-25'),
      priority: 25,
      placement: 'announcement-bar',
      isActive: true,
    },
    {
      id: 'ad-seasonal-mothers',
      title: 'ProFlowers Mothers Day',
      description: 'Beautiful bouquets for Mom - Order early!',
      category: 'seasonal',
      imageUrl: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=728&h=200&fit=crop',
      linkUrl: 'https://example.com/proflowers',
      advertiser: 'ProFlowers',
      startDate: new Date('2025-04-20'),
      endDate: new Date('2025-05-11'),
      priority: 25,
      placement: 'announcement-bar',
      isActive: true,
    },
    // Hero placement
    {
      id: 'ad-hero-1',
      title: 'Never Forget Another Anniversary',
      description: 'Nagging Wife AI reminds you of all important dates',
      category: 'seasonal',
      imageUrl: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=1200&h=400&fit=crop',
      linkUrl: '#',
      advertiser: 'Nagging Wife AI',
      priority: 100,
      placement: 'hero',
      isActive: true,
    },
  ];

  for (const ad of ads) {
    await prisma.ad.upsert({
      where: { id: ad.id },
      update: { imageUrl: ad.imageUrl },
      create: ad,
    });
  }
  console.log('Created ads');

  // ==============================
  // PAYMENT GATEWAYS (All 5 gateways - Stripe enabled by default)
  // ==============================
  const paymentGateways = [
    {
      id: 'gateway-stripe',
      provider: 'stripe',
      isEnabled: true,
      publishableKey: 'pk_test_51Example123456789',
      secretKey: 'sk_test_51Example123456789',
      webhookSecret: 'whsec_example123456789',
      testMode: true,
      achEnabled: true,
    },
    {
      id: 'gateway-paypal',
      provider: 'paypal',
      isEnabled: false,
      clientId: 'AYExample123456789PayPalClientId',
      clientSecret: 'EGExample123456789PayPalSecret',
      webhookId: 'WH-Example123456789',
      testMode: true,
    },
    {
      id: 'gateway-braintree',
      provider: 'braintree',
      isEnabled: false,
      merchantId: 'example_merchant_id',
      publicKey: 'example_public_key',
      privateKey: 'example_private_key',
      testMode: true,
    },
    {
      id: 'gateway-square',
      provider: 'square',
      isEnabled: false,
      applicationId: 'sq0idp-example123456789',
      accessToken: 'EAAAE-example123456789',
      locationId: 'L-example123456789',
      webhookSignatureKey: 'sqws-example123456789',
      testMode: true,
    },
    {
      id: 'gateway-authorize',
      provider: 'authorize',
      isEnabled: false,
      apiLoginId: 'example_api_login',
      transactionKey: 'example_transaction_key',
      signatureKey: 'example_signature_key',
      testMode: true,
    },
  ];

  for (const gateway of paymentGateways) {
    await prisma.paymentGateway.upsert({
      where: { provider: gateway.provider },
      update: {},
      create: gateway,
    });
  }
  console.log('Created payment gateways');

  // ==============================
  // AI AGENTS - Nagging Wife AI
  // ==============================
  const aiAgents = [
    {
      id: 'agent-reminder',
      name: 'Reminder Nagger',
      description: 'Reminds you about important dates, chores, and tasks',
      systemPrompt: 'You are a helpful but persistent reminder assistant. Your job is to make sure the husband never forgets important dates, anniversaries, or tasks. Be friendly but firm - a gentle nag that helps maintain a happy marriage. Use humor when appropriate.',
      model: 'gpt-4o-realtime',
      voice: 'nova',
      temperature: 0.7,
      isActive: true,
    },
    {
      id: 'agent-gift',
      name: 'Gift Suggester',
      description: 'Suggests thoughtful gifts based on wishlist and occasions',
      systemPrompt: 'You are a gift suggestion expert. Help husbands find the perfect gifts for their wives based on her wishlist, past preferences, and upcoming occasions. Provide specific, thoughtful suggestions with where to buy them.',
      model: 'gpt-4o',
      voice: 'alloy',
      temperature: 0.8,
      isActive: true,
    },
    {
      id: 'agent-chore',
      name: 'Honey-Do Helper',
      description: 'Helps prioritize and remind about household chores',
      systemPrompt: 'You are a helpful household task manager. Help the husband prioritize his honey-do list, provide tips for completing tasks efficiently, and gently remind him when things are overdue. Be supportive but keep him accountable.',
      model: 'gpt-4o-realtime',
      voice: 'echo',
      temperature: 0.6,
      isActive: true,
    },
    {
      id: 'agent-date-planner',
      name: 'Date Night Planner',
      description: 'Helps plan romantic date nights and special occasions',
      systemPrompt: 'You are a romantic date night planning expert. Help husbands plan memorable dates, anniversaries, and special occasions. Suggest restaurants, activities, and romantic gestures that will impress their wives.',
      model: 'gpt-4o',
      voice: 'shimmer',
      temperature: 0.8,
      isActive: true,
    },
  ];

  for (const agent of aiAgents) {
    await prisma.aIAgent.upsert({
      where: { id: agent.id },
      update: {},
      create: agent,
    });
  }
  console.log('Created AI agents');

  // ==============================
  // AI TOOLS - Nagging Wife AI
  // ==============================
  const aiTools = [
    {
      id: 'tool-order-flowers',
      name: 'order_flowers',
      description: 'Order flowers from 1-800-Flowers or other vendors',
      type: 'function',
      schema: {
        type: 'object',
        properties: {
          recipientName: { type: 'string', description: 'Name of recipient' },
          flowerType: { type: 'string', description: 'Type of flowers (roses, tulips, mixed)' },
          deliveryDate: { type: 'string', description: 'Delivery date' },
          deliveryAddress: { type: 'string', description: 'Delivery address' },
          message: { type: 'string', description: 'Card message' },
        },
        required: ['recipientName', 'flowerType', 'deliveryDate'],
      },
      isActive: true,
    },
    {
      id: 'tool-add-reminder',
      name: 'add_reminder',
      description: 'Add a new reminder for an important date',
      type: 'function',
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Reminder title' },
          date: { type: 'string', description: 'Date to remember' },
          reminderDays: { type: 'number', description: 'Days before to remind' },
          notes: { type: 'string', description: 'Additional notes' },
        },
        required: ['title', 'date'],
      },
      isActive: true,
    },
    {
      id: 'tool-add-chore',
      name: 'add_chore',
      description: 'Add a new chore to the honey-do list',
      type: 'function',
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Chore title' },
          priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
          dueDate: { type: 'string', description: 'Due date' },
          notes: { type: 'string', description: 'Additional notes' },
        },
        required: ['title'],
      },
      isActive: true,
    },
    {
      id: 'tool-add-wishlist',
      name: 'add_to_wishlist',
      description: 'Add an item to the wife\'s wishlist',
      type: 'function',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Item name' },
          category: { type: 'string', description: 'Category (jewelry, electronics, etc.)' },
          priceRange: { type: 'string', description: 'Price range' },
          productUrl: { type: 'string', description: 'Link to product' },
          notes: { type: 'string', description: 'Additional notes' },
        },
        required: ['name'],
      },
      isActive: true,
    },
    {
      id: 'tool-send-reminder',
      name: 'send_reminder',
      description: 'Send SMS or email reminder',
      type: 'webhook',
      schema: {
        type: 'object',
        properties: {
          channel: { type: 'string', enum: ['sms', 'email', 'push'] },
          message: { type: 'string', description: 'Reminder message' },
        },
        required: ['channel', 'message'],
      },
      endpoint: '/api/notifications/send',
      isActive: true,
    },
    {
      id: 'tool-calendar-sync',
      name: 'sync_calendar',
      description: 'Sync important dates with Google/Apple Calendar',
      type: 'api',
      schema: {
        type: 'object',
        properties: {
          provider: { type: 'string', enum: ['google', 'apple', 'outlook'] },
          eventType: { type: 'string', description: 'Type of event to sync' },
        },
        required: ['provider'],
      },
      endpoint: '/api/calendar/sync',
      isActive: true,
    },
  ];

  for (const tool of aiTools) {
    await prisma.aITool.upsert({
      where: { id: tool.id },
      update: {},
      create: tool,
    });
  }
  console.log('Created AI tools');

  // ==============================
  // LANGUAGES (24 languages)
  // ==============================
  // 24 languages as required by CLAUDE.md - ALL ENABLED
  const languages = [
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', enabled: true },
    { code: 'zh', name: 'Chinese (Mandarin)', nativeName: '中文', enabled: true },
    { code: 'cs', name: 'Czech', nativeName: 'Čeština', enabled: true },
    { code: 'da', name: 'Danish', nativeName: 'Dansk', enabled: true },
    { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', enabled: true },
    { code: 'en', name: 'English', nativeName: 'English', enabled: true },
    { code: 'fi', name: 'Finnish', nativeName: 'Suomi', enabled: true },
    { code: 'fr', name: 'French', nativeName: 'Français', enabled: true },
    { code: 'de', name: 'German', nativeName: 'Deutsch', enabled: true },
    { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', enabled: true },
    { code: 'he', name: 'Hebrew', nativeName: 'עברית', enabled: true },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', enabled: true },
    { code: 'it', name: 'Italian', nativeName: 'Italiano', enabled: true },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', enabled: true },
    { code: 'ko', name: 'Korean', nativeName: '한국어', enabled: true },
    { code: 'no', name: 'Norwegian', nativeName: 'Norsk', enabled: true },
    { code: 'pl', name: 'Polish', nativeName: 'Polski', enabled: true },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', enabled: true },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', enabled: true },
    { code: 'es', name: 'Spanish', nativeName: 'Español', enabled: true },
    { code: 'sv', name: 'Swedish', nativeName: 'Svenska', enabled: true },
    { code: 'th', name: 'Thai', nativeName: 'ไทย', enabled: true },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', enabled: true },
    { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', enabled: true },
  ];

  for (const lang of languages) {
    await prisma.language.upsert({
      where: { code: lang.code },
      update: {},
      create: lang,
    });
  }
  console.log('Created 24 languages');

  // ==============================
  // WEBHOOKS
  // ==============================
  const webhooks = [
    {
      id: 'webhook-calendar',
      name: 'Google Calendar Sync',
      url: 'https://hooks.example.com/calendar',
      events: ['reminder.created', 'date.created', 'chore.completed'],
      secret: 'whsec_calendar123',
      isActive: true,
    },
    {
      id: 'webhook-flowers',
      name: '1-800-Flowers Integration',
      url: 'https://api.1800flowers.com/webhook',
      events: ['gift.ordered', 'gift.delivered'],
      secret: 'flowers_secret_key',
      isActive: true,
    },
  ];

  for (const webhook of webhooks) {
    await prisma.webhook.upsert({
      where: { id: webhook.id },
      update: {},
      create: webhook,
    });
  }
  console.log('Created webhooks');

  // ==============================
  // SMS SETTINGS
  // ==============================
  await prisma.sMSSettings.upsert({
    where: { id: 'sms-default' },
    update: {},
    create: {
      id: 'sms-default',
      provider: 'twilio',
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_PHONE_NUMBER || '',
      enableReminders: true,
      reminderHours: 24,
      isActive: true,
    },
  });
  console.log('Created SMS settings');

  // ==============================
  // CALL TRANSFER
  // ==============================
  const callTransfers = [
    {
      id: 'transfer-florist',
      name: 'Local Florist',
      description: 'Transfer to local florist for custom orders',
      phoneNumber: '+15559876543',
      priority: 10,
      isActive: true,
    },
    {
      id: 'transfer-restaurant',
      name: 'Restaurant Reservations',
      description: 'Transfer to make restaurant reservations',
      phoneNumber: '+15551112222',
      priority: 8,
      isActive: true,
    },
    {
      id: 'transfer-spa',
      name: 'Spa Booking',
      description: 'Book spa appointments',
      phoneNumber: '+15553334444',
      priority: 5,
      isActive: true,
    },
  ];

  for (const transfer of callTransfers) {
    await prisma.callTransfer.upsert({
      where: { id: transfer.id },
      update: {},
      create: transfer,
    });
  }
  console.log('Created call transfer targets');

  // ==============================
  // DTMF MENU
  // ==============================
  const dtmfMenus = [
    { id: 'dtmf-1', name: 'Repeat Reminder', digit: '1', action: 'repeat', prompt: 'Press 1 to hear the reminder again', isActive: true },
    { id: 'dtmf-2', name: 'Snooze Reminder', digit: '2', action: 'snooze', prompt: 'Press 2 to snooze for 1 hour', isActive: true },
    { id: 'dtmf-3', name: 'Mark Complete', digit: '3', action: 'complete', prompt: 'Press 3 to mark task as complete', isActive: true },
    { id: 'dtmf-0', name: 'Order Flowers', digit: '0', action: 'transfer', targetId: 'transfer-florist', prompt: 'Press 0 to be connected to order flowers', isActive: true },
    { id: 'dtmf-star', name: 'Gift Ideas', digit: '*', action: 'gift_ideas', prompt: 'Press star for gift suggestions', isActive: true },
    { id: 'dtmf-hash', name: 'End Call', digit: '#', action: 'end', prompt: 'Press pound to end the call', isActive: true },
  ];

  for (const menu of dtmfMenus) {
    await prisma.dTMFMenu.upsert({
      where: { id: menu.id },
      update: {},
      create: menu,
    });
  }
  console.log('Created DTMF menu options');

  // ==============================
  // LOGIC RULES
  // ==============================
  const logicRules = [
    {
      id: 'rule-upcoming-date',
      name: 'Upcoming Date Alert',
      description: 'Send reminder when important date is approaching',
      trigger: 'date.approaching',
      conditions: [{ field: 'daysUntil', operator: '<=', value: 7 }],
      actions: [
        { type: 'sms', template: 'date_reminder' },
        { type: 'push', template: 'date_reminder' },
      ],
      priority: 10,
      isActive: true,
    },
    {
      id: 'rule-overdue-chore',
      name: 'Overdue Chore Nag',
      description: 'Increase nagging frequency for overdue chores',
      trigger: 'chore.overdue',
      conditions: [{ field: 'daysOverdue', operator: '>=', value: 1 }],
      actions: [
        { type: 'sms', template: 'chore_overdue' },
        { type: 'voice', template: 'chore_nag' },
      ],
      priority: 15,
      isActive: true,
    },
    {
      id: 'rule-wishlist-sale',
      name: 'Wishlist Item On Sale',
      description: 'Alert when a wishlist item goes on sale',
      trigger: 'wishlist.sale_detected',
      conditions: [{ field: 'discount', operator: '>=', value: 20 }],
      actions: [{ type: 'push', template: 'sale_alert' }],
      priority: 8,
      isActive: true,
    },
    {
      id: 'rule-gift-delivery',
      name: 'Gift Delivery Confirmation',
      description: 'Confirm when gift has been delivered',
      trigger: 'gift.delivered',
      conditions: [],
      actions: [
        { type: 'sms', template: 'delivery_confirmation' },
        { type: 'email', template: 'delivery_confirmation' },
      ],
      priority: 5,
      isActive: true,
    },
  ];

  for (const rule of logicRules) {
    await prisma.logicRule.upsert({
      where: { id: rule.id },
      update: {},
      create: rule,
    });
  }
  console.log('Created logic rules');

  // ==============================
  // FUNCTIONS
  // ==============================
  const functions = [
    {
      id: 'fn-days-until',
      name: 'calculateDaysUntil',
      description: 'Calculate days until an important date',
      code: `function calculateDaysUntil(targetDate) {
  const today = new Date();
  const target = new Date(targetDate);
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}`,
      parameters: [{ name: 'targetDate', type: 'Date', description: 'The target date' }],
      returnType: 'number',
      isActive: true,
    },
    {
      id: 'fn-gift-budget',
      name: 'calculateGiftBudget',
      description: 'Suggest gift budget based on occasion',
      code: `function calculateGiftBudget(occasion, yearsMarried) {
  const baseBudgets = {
    birthday: 150,
    anniversary: 200,
    christmas: 200,
    valentines: 100,
    'mothers-day': 75,
    'just-because': 50
  };
  const base = baseBudgets[occasion] || 50;
  const multiplier = 1 + (yearsMarried * 0.05);
  return Math.round(base * multiplier);
}`,
      parameters: [
        { name: 'occasion', type: 'string', description: 'The occasion type' },
        { name: 'yearsMarried', type: 'number', description: 'Years married' },
      ],
      returnType: 'number',
      isActive: true,
    },
    {
      id: 'fn-nag-level',
      name: 'calculateNagLevel',
      description: 'Determine how much to nag based on overdue days',
      code: `function calculateNagLevel(daysOverdue) {
  if (daysOverdue <= 0) return 'gentle';
  if (daysOverdue <= 2) return 'reminder';
  if (daysOverdue <= 5) return 'firm';
  if (daysOverdue <= 7) return 'persistent';
  return 'full-nag';
}`,
      parameters: [{ name: 'daysOverdue', type: 'number', description: 'Days past due date' }],
      returnType: 'string',
      isActive: true,
    },
  ];

  for (const fn of functions) {
    await prisma.function.upsert({
      where: { id: fn.id },
      update: {},
      create: fn,
    });
  }
  console.log('Created functions');

  // ==============================
  // PAYMENTS (Sample transactions)
  // ==============================
  const payments = [
    {
      id: 'pay-001',
      amount: 89.99,
      currency: 'USD',
      status: 'completed',
      method: 'card',
      transactionId: 'txn_flowers_vday',
      description: 'Valentines Day Roses - 1-800-Flowers',
      groupId: group.id,
    },
    {
      id: 'pay-002',
      amount: 275.00,
      currency: 'USD',
      status: 'completed',
      method: 'card',
      transactionId: 'txn_spa_001',
      description: 'Spa Day Gift Certificate',
      groupId: group.id,
    },
    {
      id: 'pay-003',
      amount: 142.00,
      currency: 'USD',
      status: 'completed',
      method: 'paypal',
      transactionId: 'txn_perfume_001',
      description: 'Chanel No. 5 - Nordstrom',
      groupId: group.id,
    },
    {
      id: 'pay-004',
      amount: 65.00,
      currency: 'USD',
      status: 'pending',
      method: 'card',
      description: 'Mothers Day Flowers - ProFlowers',
      groupId: group.id,
    },
    {
      id: 'pay-005',
      amount: 9.99,
      currency: 'USD',
      status: 'completed',
      method: 'card',
      transactionId: 'txn_sub_001',
      description: 'Nagging Wife AI - Monthly Subscription',
      groupId: group.id,
    },
  ];

  for (const payment of payments) {
    await prisma.payment.upsert({
      where: { id: payment.id },
      update: {},
      create: payment,
    });
  }
  console.log('Created sample payments');

  // ==============================
  // SESSIONS (Nagging Check-ins)
  // ==============================
  const sessions = [
    {
      id: 'sess-001',
      name: 'John Smith',
      email: 'john@family.local',
      topic: 'chores',
      status: 'completed',
      scheduledAt: new Date(Date.now() - 86400000 * 7),
      completedAt: new Date(Date.now() - 86400000 * 7),
      score: 7.5,
      notes: 'Good progress on chores, forgot anniversary date',
      duration: 30,
      transcript: [
        { role: 'assistant', content: 'Hey honey! Let me check on your chores today.' },
        { role: 'user', content: 'Hi, I finished most of them.' },
        { role: 'assistant', content: 'Did you take out the trash?' },
        { role: 'user', content: 'Yes, done this morning.' },
        { role: 'assistant', content: 'Great! What about the leaky faucet?' },
        { role: 'user', content: 'Still working on it, need parts from the store.' },
      ],
      summary: 'Completed trash duty, faucet repair in progress. Overall good effort.',
      groupId: group.id,
    },
    {
      id: 'sess-002',
      name: 'John Smith',
      email: 'john@family.local',
      topic: 'gifts',
      status: 'completed',
      scheduledAt: new Date(Date.now() - 86400000 * 5),
      completedAt: new Date(Date.now() - 86400000 * 5),
      score: 8.0,
      notes: 'Remembered to order flowers, excellent!',
      duration: 20,
      transcript: [
        { role: 'assistant', content: "Let's talk about romance planning!" },
        { role: 'user', content: "I ordered flowers for Valentine's Day." },
        { role: 'assistant', content: 'Wonderful! Did you make dinner reservations?' },
        { role: 'user', content: 'Yes, at our favorite Italian place.' },
        { role: 'assistant', content: 'Perfect! She will love that.' },
      ],
      summary: 'Excellent romance planning. Flowers ordered and dinner reservations made.',
      groupId: group.id,
    },
    {
      id: 'sess-003',
      name: 'John Smith',
      email: 'john@family.local',
      topic: 'dates',
      status: 'completed',
      scheduledAt: new Date(Date.now() - 86400000 * 3),
      completedAt: new Date(Date.now() - 86400000 * 3),
      score: 6.0,
      notes: 'Needs improvement on remembering important dates',
      duration: 25,
      transcript: [
        { role: 'assistant', content: 'When is your anniversary?' },
        { role: 'user', content: 'Um... June something?' },
        { role: 'assistant', content: 'Its June 22nd! You should write that down.' },
      ],
      summary: 'Needs to work on remembering important dates.',
      groupId: group.id,
    },
    {
      id: 'sess-004',
      name: 'John Smith',
      email: 'john@family.local',
      topic: 'chores',
      status: 'completed',
      scheduledAt: new Date(Date.now() - 86400000 * 1),
      completedAt: new Date(Date.now() - 86400000 * 1),
      score: 9.0,
      notes: 'Great job completing the honey-do list!',
      duration: 15,
      transcript: [
        { role: 'assistant', content: 'Checking in on your honey-do list!' },
        { role: 'user', content: 'I finished everything today!' },
        { role: 'assistant', content: 'Amazing! Even the gutters?' },
        { role: 'user', content: 'Yes, borrowed the ladder from Dave and got it done.' },
        { role: 'assistant', content: 'Your wife is going to be so happy!' },
      ],
      summary: 'Outstanding performance! All honey-do items completed.',
      groupId: group.id,
    },
    {
      id: 'sess-005',
      name: 'John Smith',
      email: 'john@family.local',
      topic: 'gifts',
      status: 'scheduled',
      scheduledAt: new Date(Date.now() + 86400000 * 1),
      groupId: group.id,
    },
    {
      id: 'sess-006',
      name: 'John Smith',
      email: 'john@family.local',
      topic: 'general',
      status: 'scheduled',
      scheduledAt: new Date(Date.now() + 86400000 * 3),
      groupId: group.id,
    },
    {
      id: 'sess-007',
      name: 'Bob Smith',
      email: 'bob@family.local',
      topic: 'general',
      status: 'completed',
      scheduledAt: new Date(Date.now() - 86400000 * 2),
      completedAt: new Date(Date.now() - 86400000 * 2),
      score: 7.0,
      notes: 'Helped with health check reminders',
      duration: 20,
      transcript: [
        { role: 'assistant', content: 'Did you schedule your annual checkup?' },
        { role: 'user', content: 'Yes, its next week.' },
      ],
      summary: 'Good progress on health reminders.',
      groupId: group.id,
    },
  ];

  for (const sess of sessions) {
    await prisma.session.upsert({
      where: { id: sess.id },
      update: {},
      create: sess,
    });
  }
  console.log('Created sessions (nagging check-ins)');

  // ==============================
  // AUDIT LOG
  // ==============================
  const auditLogs = [
    { id: 'log-001', action: 'LOGIN', entity: 'User', entityId: groupAdmin.id, userId: groupAdmin.id, groupId: group.id, details: { method: 'password' }, ipAddress: '192.168.1.100' },
    { id: 'log-002', action: 'CREATE', entity: 'Chore', entityId: 'chore-faucet', userId: groupAdmin.id, groupId: group.id, details: { title: 'Fix leaky kitchen faucet' } },
    { id: 'log-003', action: 'UPDATE', entity: 'Chore', entityId: 'chore-groceries', userId: groupAdmin.id, groupId: group.id, details: { status: 'in_progress' } },
    { id: 'log-004', action: 'CREATE', entity: 'GiftOrder', entityId: 'order-flowers-vday', userId: groupAdmin.id, groupId: group.id, details: { amount: 89.99 } },
    { id: 'log-005', action: 'VIEW', entity: 'Wishlist', userId: groupAdmin.id, groupId: group.id, details: { itemsViewed: 10 } },
    { id: 'log-006', action: 'CREATE', entity: 'ImportantDate', entityId: 'date-wife-bday', userId: groupAdmin.id, groupId: group.id, details: { title: "Wife's Birthday" } },
    { id: 'log-007', action: 'UPDATE', entity: 'AppConfig', entityId: 'default', userId: groupAdmin.id, details: { selectedVoice: 'nova' } },
    { id: 'log-008', action: 'LOGOUT', entity: 'User', entityId: groupAdmin.id, userId: groupAdmin.id, groupId: group.id, details: {} },
  ];

  for (const log of auditLogs) {
    await prisma.auditLog.upsert({
      where: { id: log.id },
      update: {},
      create: log,
    });
  }
  console.log('Created audit logs');

  // ==============================
  // BRANDING - Purple Theme (#9333ea)
  // ==============================
  await prisma.branding.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      logoUrl: '',
      faviconUrl: '',
      primaryColor: '#9333ea',
      secondaryColor: '#7e22ce',
      accentColor: '#a855f7',
      headingFont: 'Inter',
      bodyFont: 'Inter',
    },
  });
  console.log('Created branding with Purple theme');

  // ==============================
  // STORE INFO
  // ==============================
  await prisma.storeInfo.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      businessName: 'Nagging Wife AI',
      tagline: 'Your Helpful Reminder Assistant',
      description: 'AI assistant that helps husbands remember important dates, chores, and gifts - Happy Wife, Happy Life!',
      address: '',
      phone: '',
      email: '',
      website: '',
      businessHours: 'Always On Duty!',
      timezone: 'America/New_York',
    },
  });
  console.log('Created store info');

  // ==============================
  // FEATURES - Purple Theme (#9333ea)
  // ==============================
  await prisma.features.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      faqEnabled: false,
      stickyBarEnabled: false,
      stickyBarText: '',
      stickyBarBgColor: '#9333ea',
      stickyBarLink: '',
      stickyBarLinkText: '',
      liveChatEnabled: false,
      chatProvider: 'builtin',
      chatWelcomeMessage: 'Hi honey! How can I help you today?',
      chatAgentName: 'Wifey',
      chatWidgetColor: '#9333ea',
      chatPosition: 'bottom-right',
      chatShowOnMobile: true,
      chatWidgetId: '',
      chatEmbedCode: '',
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: false,
      orderConfirmations: true,
      marketingEmails: false,
      appointmentReminders: true,
      facebookUrl: '',
      twitterUrl: '',
      instagramUrl: '',
      linkedinUrl: '',
      youtubeUrl: '',
      tiktokUrl: '',
      shareOnFacebook: true,
      shareOnTwitter: true,
      shareOnLinkedin: false,
      shareOnWhatsapp: true,
      shareOnEmail: true,
      copyLinkButton: true,
    },
  });
  console.log('Created features with Purple theme');

  // ==============================
  // PAYMENT SETTINGS
  // ==============================
  await prisma.paymentSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      enabled: false,
      stripeEnabled: false,
      stripePublishableKey: '',
      stripeTestMode: true,
      paypalEnabled: false,
      paypalClientId: '',
      paypalSandbox: true,
      squareEnabled: false,
      squareAppId: '',
      squareSandbox: true,
    },
  });
  console.log('Created payment settings');

  console.log('\n✅ Nagging Wife AI database seeded successfully!');
  console.log('\n📋 Login credentials:');
  console.log('---');
  console.log('Super Admin:');
  console.log('  Email: superadmin@system.local');
  console.log('  Password: superadmin123');
  console.log('---');
  console.log('Family Admin (Husband):');
  console.log('  Email: john@family.local');
  console.log('  Username: john');
  console.log('  Password: admin123');
  console.log('---');
  console.log('Manager:');
  console.log('  Email: bob@family.local');
  console.log('  Username: bob');
  console.log('  Password: manager123');
  console.log('\n🎯 Happy Wife, Happy Life!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
