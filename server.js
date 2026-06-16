import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { existsSync, readFileSync, writeFileSync } from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;
const CATALOG_FILE = './distributorCatalog.json';

const DISTRIBUTORS = [
  {
    id: 'addison',
    name: 'Addison Automatics',
    website: 'https://www.addisonautomatics.com/catalog/',
    type: 'public-catalog',
    enabled: true,
    notes: 'Public catalog search exposes part numbers and descriptions. Pricing requires Addison login.',
    categories: [
      { code: 'RE021', name: 'ADC CONTROLS' },
      { code: 'RE022', name: 'AMR CONTROLS' },
      { code: 'PA001', name: 'BEA PARTS' },
      { code: 'RE002', name: 'BESAM CONTROLS' },
      { code: 'RM002', name: 'BESAM OPER/MTR' },
      { code: 'PA002', name: 'BESAM PARTS' },
      { code: 'PN002', name: 'BESAM NEW' },
      { code: 'RE003', name: 'BWN CONTROLS' },
      { code: 'RM003', name: 'BWN OPER/MTR' },
      { code: 'PA003', name: 'BWN PARTS' },
      { code: 'RE004', name: 'DOR-O-MATIC CONTROLS' },
      { code: 'RM004', name: 'DOR-O-MATIC OPER/MTR' },
      { code: 'PA004', name: 'DOR-O-MATIC PARTS' },
      { code: 'RE005', name: 'DORMA CONTROLS' },
      { code: 'RM005', name: 'DORMA OPER/MTR' },
      { code: 'PA005', name: 'DORMA PARTS' },
      { code: 'PN005', name: 'DORMA NEW' },
      { code: 'PA020', name: 'GILDOR PARTS' },
      { code: 'RE007', name: 'GYRO TECH CONTROLS' },
      { code: 'RM007', name: 'GYRO TECH OPER/MTR' },
      { code: 'PA007', name: 'GYRO TECH PARTS' },
      { code: 'PN007', name: 'GYRO TECH NEW' },
      { code: 'RE008', name: 'HORTON CONTROLS' },
      { code: 'RM008', name: 'HORTON OPER/MTR' },
      { code: 'PA008', name: 'HORTON PARTS' },
      { code: 'PN008', name: 'HORTON NEW' },
      { code: 'PA012', name: 'HUNTER' },
      { code: 'PN012', name: 'HUNTER NEW' },
      { code: 'PA009', name: 'KAWNEER PARTS' },
      { code: 'RE010', name: 'KEANE-MONROE CONTROLS' },
      { code: 'RM010', name: 'KEANE-MONROE OPER/MTR' },
      { code: 'PA010', name: 'KEANE-MONROE PARTS' },
      { code: 'RE006', name: 'LCN CONTROLS' },
      { code: 'RM006', name: 'LCN OPER/MTR' },
      { code: 'PA006', name: 'LCN PARTS' },
      { code: 'MCLSR', name: 'MANUAL CLOSERS AND PARTS' },
      { code: 'PA023', name: 'NORTON PARTS' },
      { code: 'PA017', name: 'OPTEX PARTS' },
      { code: 'APUSH', name: 'PUSH PLATES' },
      { code: 'RE014', name: 'R-K CONTROLS' },
      { code: 'RM014', name: 'R-K OPER/MTR' },
      { code: 'PA014', name: 'R-K PARTS' },
      { code: 'RE013', name: 'RECORD CONTROLS' },
      { code: 'RM013', name: 'RECORD OPER/MTR' },
      { code: 'PA013', name: 'RECORD PARTS' },
      { code: 'PN013', name: 'RECORD NEW' },
      { code: 'PA015', name: 'ROTO SW PARTS' },
      { code: 'RE018', name: 'STANLEY CONTROLS' },
      { code: 'RM018', name: 'STANLEY OPER/MTR' },
      { code: 'PA018', name: 'STANLEY PARTS' },
      { code: 'PN018', name: 'STANLEY NEW' },
      { code: 'PA019', name: 'TLS PARTS' },
      { code: 'RE016', name: 'TORMAX CONTROLS' },
      { code: 'RM016', name: 'TORMAX OPER/MTR' },
      { code: 'PA016', name: 'TORMAX PARTS' },
    ],
  },
  {
    id: 'door-controls',
    name: 'Door Controls USA',
    website: 'https://doorcontrolsusa.com/',
    type: 'managed-distributor',
    enabled: true,
    notes: 'Managed distributor entry. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'horton',
    name: 'Horton Automatics',
    website: 'https://www.hortondoors.com/',
    type: 'managed-distributor',
    enabled: true,
    notes: 'Managed distributor entry. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'bea',
    name: 'BEA Americas',
    website: 'https://us.beasensors.com/',
    type: 'managed-distributor',
    enabled: true,
    notes: 'Managed distributor entry. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'service-spring',
    name: 'Service Spring Corp',
    website: 'https://www.servicespring.com/',
    type: 'managed-distributor',
    enabled: true,
    notes: 'Managed distributor entry. Catalog/order links are hosted through shop.servicespring.com; scraper not connected yet.',
    categories: [],
  },
  {
    id: 'multi-fab',
    name: 'Multi-Fab Products',
    website: 'https://www.multi-fab.com/',
    type: 'managed-distributor',
    enabled: true,
    notes: 'Managed distributor entry. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'nabco-gyrotech',
    name: 'NABCO / Gyro Tech',
    website: 'https://www.nabcoentrances.com/',
    type: 'managed-distributor',
    enabled: true,
    notes: 'Managed distributor entry. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'assa-abloy-besam',
    name: 'Besam / ASSA ABLOY Entrance Systems',
    website: 'https://www.assaabloyentrance.com/us/en',
    type: 'managed-manufacturer',
    enabled: true,
    notes: 'Manufacturer entry from Addison categories. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'dormakaba',
    name: 'dormakaba',
    website: 'https://www.dormakaba.com/us-en',
    type: 'managed-manufacturer',
    enabled: true,
    notes: 'Manufacturer entry from Addison categories. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'dor-o-matic',
    name: 'Dor-O-Matic',
    website: 'https://us.allegion.com/en/home/products/brands/dor-o-matic.html',
    type: 'managed-manufacturer',
    enabled: true,
    notes: 'Manufacturer entry from Addison categories. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'lcn',
    name: 'LCN',
    website: 'https://us.allegion.com/en/home/products/categories/door-controls/closers/lcn.html',
    type: 'managed-manufacturer',
    enabled: true,
    notes: 'Manufacturer entry from Addison categories. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'norton-rixson',
    name: 'Norton Rixson',
    website: 'https://www.nortonrixson.com/',
    type: 'managed-manufacturer',
    enabled: true,
    notes: 'Manufacturer entry from Addison categories. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'optex',
    name: 'OPTEX',
    website: 'https://www.optexamerica.com/',
    type: 'managed-manufacturer',
    enabled: true,
    notes: 'Manufacturer entry from Addison categories. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'record-usa',
    name: 'Record USA',
    website: 'https://www.recorddoors.com/',
    type: 'managed-manufacturer',
    enabled: true,
    notes: 'Manufacturer entry from Addison categories. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'roto-frank',
    name: 'Roto Frank',
    website: 'https://www.roto-frank.com/us/',
    type: 'managed-manufacturer',
    enabled: true,
    notes: 'Manufacturer entry from Addison categories. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'stanley-access',
    name: 'Stanley Access Technologies',
    website: 'https://www.stanleyaccess.com/',
    type: 'managed-manufacturer',
    enabled: true,
    notes: 'Manufacturer entry from Addison categories. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'tormax',
    name: 'TORMAX',
    website: 'https://www.tormax.com/usa/',
    type: 'managed-manufacturer',
    enabled: true,
    notes: 'Manufacturer entry from Addison categories. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'kawneer',
    name: 'Kawneer',
    website: 'https://www.kawneer.us/',
    type: 'managed-manufacturer',
    enabled: true,
    notes: 'Manufacturer entry from Addison categories. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'hunter-automatics',
    name: 'Hunter Automatics',
    website: 'https://www.hunterautomatics.com/',
    type: 'managed-manufacturer',
    enabled: true,
    notes: 'Manufacturer entry from Addison categories. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-adams-rite',
    name: 'Adams Rite',
    website: 'https://www.automaticsandmore.com/category-s/389.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-automatic-door-operators',
    name: 'Automatic Door Operators',
    website: 'https://www.automaticsandmore.com/category-s/280.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-bea',
    name: 'BEA',
    website: 'https://www.automaticsandmore.com/category-s/128.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-besam',
    name: 'Besam',
    website: 'https://www.automaticsandmore.com/besam-assa-abloy-automatic-door-parts-s/122.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-bircher',
    name: 'Bircher',
    website: 'https://www.automaticsandmore.com/category-s/402.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-boon-edam',
    name: 'Boon Edam',
    website: 'https://www.automaticsandmore.com/boon-edam-revolving-door-parts-s/243.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-bwn-sierra',
    name: 'BWN / Sierra',
    website: 'https://www.automaticsandmore.com/category-s/242.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-camden',
    name: 'Camden',
    website: 'https://www.automaticsandmore.com/category-s/376.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-curran',
    name: 'Curran',
    website: 'https://www.automaticsandmore.com/category-s/397.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-decals',
    name: 'Decals',
    website: 'https://www.automaticsandmore.com/category-s/131.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-detex',
    name: 'Detex',
    website: 'https://www.automaticsandmore.com/category-s/401.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-door-controls',
    name: 'Door Controls',
    website: 'https://www.automaticsandmore.com/category-s/348.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-dorma',
    name: 'Dorma',
    website: 'https://www.automaticsandmore.com/dorma-automatic-door-parts-s/125.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-doromatic',
    name: 'Doromatic',
    website: 'https://www.automaticsandmore.com/doromatic-automatic-door-parts-s/124.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-electric-strikes-locks',
    name: 'Electric Strikes / Locks',
    website: 'https://www.automaticsandmore.com/category-s/315.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-gildor',
    name: 'Gildor',
    website: 'https://www.automaticsandmore.com/gildor-automatic-door-parts-s/192.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-hardware',
    name: 'Hardware',
    website: 'https://www.automaticsandmore.com/category-s/202.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-horton',
    name: 'Horton',
    website: 'https://www.automaticsandmore.com/horton-door-parts-s/123.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-hotron',
    name: 'Hotron',
    website: 'https://www.automaticsandmore.com/category-s/193.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-hunter-ditech-entrematic',
    name: 'Hunter / Ditech Entrematic',
    website: 'https://www.automaticsandmore.com/hunter-automatic-door-parts-s/130.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-ingenico',
    name: 'Ingenico',
    website: 'https://www.automaticsandmore.com/category-s/395.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-international',
    name: 'International',
    website: 'https://www.automaticsandmore.com/category-s/200.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-km-systems',
    name: 'K/M Systems',
    website: 'https://www.automaticsandmore.com/keane-monroe-automatic-door-parts-s/191.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-lcn',
    name: 'LCN',
    website: 'https://www.automaticsandmore.com/category-s/365.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-maglocks',
    name: 'Maglocks',
    website: 'https://www.automaticsandmore.com/category-s/316.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-motion-access',
    name: 'Motion Access',
    website: 'https://www.automaticsandmore.com/category-s/306.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-ms-sedco',
    name: 'M/S Sedco',
    website: 'https://www.automaticsandmore.com/category-s/195.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-nabco',
    name: 'NABCO',
    website: 'https://www.automaticsandmore.com/nabco-automatic-door-parts-s/121.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-norton',
    name: 'Norton',
    website: 'https://www.automaticsandmore.com/category-s/398.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-optex-industrial',
    name: 'OPTEX (Industrial)',
    website: 'https://www.automaticsandmore.com/category-s/127.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-push-plates',
    name: 'Push Plates',
    website: 'https://www.automaticsandmore.com/category-s/274.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-quad-systems',
    name: 'Quad Systems',
    website: 'https://www.automaticsandmore.com/category-s/391.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-quikserv',
    name: 'QuikServ',
    website: 'https://www.automaticsandmore.com/category-s/374.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-ready-access',
    name: 'Ready Access',
    website: 'https://www.automaticsandmore.com/ready-access-window-parts-s/196.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-record',
    name: 'Record',
    website: 'https://www.automaticsandmore.com/record-ada-door-parts-s/129.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-secura-key',
    name: 'Secura Key',
    website: 'https://www.automaticsandmore.com/category-s/378.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-security-door-controls',
    name: 'Security Door Controls',
    website: 'https://www.automaticsandmore.com/category-s/360.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-sensors',
    name: 'Sensors',
    website: 'https://www.automaticsandmore.com/category-s/194.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-stanley',
    name: 'Stanley',
    website: 'https://www.automaticsandmore.com/stanley-automatic-door-parts-s/106.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-touchless-activation',
    name: 'Touchless Activation',
    website: 'https://www.automaticsandmore.com/category-s/290.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-tormax',
    name: 'Tormax',
    website: 'https://www.automaticsandmore.com/tormax-automatic-door-systems-s/126.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-ultimate',
    name: 'Ultimate',
    website: 'https://www.automaticsandmore.com/category-s/201.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
  {
    id: 'am-stainless-steel-posts',
    name: 'Stainless Steel Posts',
    website: 'https://www.automaticsandmore.com/category-s/343.htm',
    type: 'automatics-and-more-category',
    enabled: true,
    notes: 'Automatics & More category link. Catalog scraper not connected yet.',
    categories: [],
  },
];

const PUBLIC_SITE_CONNECTORS = {
  'door-controls': {
    kind: 'storefront',
    category: 'Door Controls USA catalog',
    searchUrl: 'https://www.doorcontrolsusa.com/search?q={query}',
    seedUrls: ['https://www.doorcontrolsusa.com/products'],
    include: [/\/products\//i],
    connectionLevel: 'search-link',
    connectionLabel: 'Search-link fallback',
    connectionClue: 'Needs a stronger connection: Door Controls blocks anonymous scraping here. Best next step is an approved product feed, Shopify API access, or account-backed catalog export.',
    blockedMessage: 'Door Controls USA blocks anonymous catalog scraping from this environment; direct search link is connected.',
  },
  horton: {
    kind: 'manufacturer-products',
    category: 'Horton product pages',
    sitemapUrls: ['https://www.hortondoors.com/sitemap.xml'],
    seedUrls: ['https://www.hortondoors.com/resources/brochures/'],
    include: [/\/sliding-door-systems\//i, /\/swinging-door-systems\//i, /\/revolving-door-systems\//i, /\/resources\/brochures/i],
    connectionLevel: 'page-index',
    connectionLabel: 'Public page index',
    connectionClue: 'Needs a stronger connection for repair parts: public Horton pages are product/literature pages, not a priced parts catalog.',
  },
  bea: {
    kind: 'manufacturer-products',
    category: 'BEA products',
    sitemapUrls: ['https://us.beasensors.com/product-sitemap.xml', 'https://us.beasensors.com/accessory-sitemap.xml'],
    seedUrls: ['https://us.beasensors.com/en/products/'],
    include: [/\/en\/product\//i, /\/en\/accessory\//i, /\/en\/products\//i],
    connectionLevel: 'page-index',
    connectionLabel: 'Public product index',
    connectionClue: 'Good public product coverage, but no distributor pricing/stock. Stronger connection would be a BEA product export or distributor feed.',
  },
  'service-spring': {
    kind: 'storefront',
    category: 'Service Spring catalog',
    sitemapUrls: ['https://shop.servicespring.com/sitemap.xml'],
    seedUrls: ['https://shop.servicespring.com/'],
    include: [/servicespring\.com\/category\//i, /shop\.servicespring\.com\/.*(?:operator|spring|hardware|part|door)/i],
    connectionLevel: 'category-index',
    connectionLabel: 'Public category index',
    connectionClue: 'Needs a stronger connection for SKUs/prices: public sitemap exposes category pages more reliably than item-level catalog rows.',
  },
  'nabco-gyrotech': {
    kind: 'manufacturer-products',
    category: 'NABCO products and literature',
    sitemapUrls: ['https://www.nabcoentrances.com/sitemap.xml'],
    seedUrls: ['https://www.nabcoentrances.com/products/'],
    include: [/\/products\//i, /\/heading\//i, /\/service\//i],
    connectionLevel: 'page-index',
    connectionLabel: 'Public page index',
    connectionClue: 'Needs a stronger connection for parts: NABCO public pages are product/literature pages, not a priced parts catalog.',
  },
  'assa-abloy-besam': {
    kind: 'manufacturer-products',
    category: 'ASSA ABLOY Entrance Systems',
    searchUrl: 'https://www.assaabloyentrance.com/us/en/search?q={query}',
    seedUrls: ['https://www.assaabloyentrance.com/us/en/products'],
    include: [/\/products/i, /\/automatic/i, /\/entrance/i],
    connectionLevel: 'search-link',
    connectionLabel: 'Search/landing fallback',
    connectionClue: 'Needs a stronger connection: public site search is connected, but item-level Besam parts require a catalog feed or account-backed source.',
  },
  dormakaba: {
    kind: 'manufacturer-products',
    category: 'dormakaba products',
    searchUrl: 'https://www.dormakaba.com/us-en/search?query={query}',
    seedUrls: ['https://www.dormakaba.com/us-en/offering/products'],
    include: [/\/products/i, /\/automatic/i, /\/door/i],
    connectionLevel: 'search-link',
    connectionLabel: 'Search/landing fallback',
    connectionClue: 'Needs a stronger connection: public pages are broad product pages; parts/pricing need a feed, API, or account catalog.',
  },
  'dor-o-matic': {
    kind: 'manufacturer-products',
    category: 'Dor-O-Matic brand page',
    seedUrls: ['https://us.allegion.com/en/home/products/brands/dor-o-matic.html'],
    include: [/dor-o-matic/i],
    connectionLevel: 'landing-page',
    connectionLabel: 'Brand-page fallback',
    connectionClue: 'Needs a stronger connection: public brand page only. Dor-O-Matic item-level parts need an Allegion/distributor catalog source.',
  },
  lcn: {
    kind: 'manufacturer-products',
    category: 'LCN brand page',
    seedUrls: ['https://us.allegion.com/en/home/products/categories/door-controls/closers/lcn.html'],
    include: [/lcn/i, /closers/i],
    connectionLevel: 'landing-page',
    connectionLabel: 'Brand-page fallback',
    connectionClue: 'Needs a stronger connection: public LCN page is not a parts feed. Use an Allegion/distributor catalog source for item-level rows.',
  },
  'norton-rixson': {
    kind: 'manufacturer-products',
    category: 'Norton Rixson products',
    searchUrl: 'https://www.nortonrixson.com/en/search?q={query}',
    seedUrls: ['https://www.nortonrixson.com/'],
    include: [/\/products/i, /norton/i, /rixson/i],
    connectionLevel: 'search-link',
    connectionLabel: 'Search/landing fallback',
    connectionClue: 'Needs a stronger connection: public pages do not expose reliable SKU/pricing rows.',
  },
  optex: {
    kind: 'manufacturer-products',
    category: 'OPTEX products',
    searchUrl: 'https://www.optexamerica.com/search?q={query}',
    seedUrls: ['https://www.optexamerica.com/products/'],
    include: [/\/products/i, /sensor/i],
    connectionLevel: 'search-link',
    connectionLabel: 'Search/landing fallback',
    connectionClue: 'Needs a stronger connection for availability/pricing: public OPTEX pages are product pages, not distributor inventory.',
  },
  'record-usa': {
    kind: 'manufacturer-products',
    category: 'Record USA products',
    searchUrl: 'https://www.recorddoors.com/search?q={query}',
    seedUrls: ['https://www.recorddoors.com/products/'],
    include: [/\/products/i, /automatic/i, /door/i],
    connectionLevel: 'search-link',
    connectionLabel: 'Search/landing fallback',
    connectionClue: 'Needs a stronger connection: public Record pages do not expose a repair-parts catalog feed.',
  },
  'roto-frank': {
    kind: 'manufacturer-products',
    category: 'Roto Frank products',
    searchUrl: 'https://www.roto-frank.com/us/search/?q={query}',
    seedUrls: ['https://www.roto-frank.com/us/'],
    include: [/\/product/i, /door/i, /window/i],
    connectionLevel: 'search-link',
    connectionLabel: 'Search/landing fallback',
    connectionClue: 'Needs a stronger connection: public Roto pages are not item-level distributor rows.',
  },
  'stanley-access': {
    kind: 'manufacturer-products',
    category: 'Stanley Access products',
    searchUrl: 'https://www.stanleyaccess.com/search?q={query}',
    seedUrls: ['https://www.stanleyaccess.com/products/'],
    include: [/\/products/i, /automatic/i, /door/i],
    connectionLevel: 'search-link',
    connectionLabel: 'Search/landing fallback',
    connectionClue: 'Needs a stronger connection for Stanley parts: public product pages are connected, but prices/SKUs need a catalog feed.',
  },
  tormax: {
    kind: 'manufacturer-products',
    category: 'TORMAX products',
    searchUrl: 'https://www.tormax.com/usa/en/search/?q={query}',
    seedUrls: ['https://www.tormax.com/usa/en/products/'],
    include: [/\/products/i, /automatic/i, /door/i],
    connectionLevel: 'search-link',
    connectionLabel: 'Search/landing fallback',
    connectionClue: 'Needs a stronger connection: public TORMAX pages do not expose priced repair-part rows.',
  },
  kawneer: {
    kind: 'manufacturer-products',
    category: 'Kawneer products',
    searchUrl: 'https://www.kawneer.us/search?q={query}',
    seedUrls: ['https://www.kawneer.us/products/'],
    include: [/\/products/i, /door/i, /entrance/i],
    connectionLevel: 'search-link',
    connectionLabel: 'Search/landing fallback',
    connectionClue: 'Needs a stronger connection: public Kawneer pages are broad product pages, not a replacement-parts feed.',
  },
  'hunter-automatics': {
    kind: 'manufacturer-products',
    category: 'Hunter Automatics',
    seedUrls: ['https://www.hunterautomatics.com/'],
    include: [/product/i, /door/i, /operator/i],
    connectionLevel: 'landing-page',
    connectionLabel: 'Landing-page fallback',
    connectionClue: 'Needs a stronger connection: public site has only a landing/page crawl here; item-level parts require a vendor feed or distributor catalog.',
  },
};

app.use(cors());
app.use(express.json({ limit: '64mb' })); // vendor price lists pasted/uploaded as CSV can be 100s of KB (Door Controls ≈ 527KB)

function readCatalogStore() {
  if (!existsSync(CATALOG_FILE)) {
    return { updatedAt: null, items: [] };
  }
  try {
    const data = JSON.parse(readFileSync(CATALOG_FILE, 'utf-8'));
    return { updatedAt: data.updatedAt || null, items: Array.isArray(data.items) ? data.items : [] };
  } catch (err) {
    console.error('Catalog read error:', err.message);
    return { updatedAt: null, items: [] };
  }
}

function writeCatalogStore(items) {
  const store = { updatedAt: new Date().toISOString(), items };
  writeFileSync(CATALOG_FILE, JSON.stringify(store, null, 2));
  return store;
}

// ── Per-distributor import format profiles ───────────────────────────────────
// Each vendor lays their price list out the SAME way every time, but differently
// from every other vendor. So we LEARN a distributor's layout on first import and
// reuse it on every later upload — matching columns by header NAME (robust to the
// vendor reordering columns), and letting an admin pin/correct a column once so it
// sticks. profile = { headerRow, columns: { field: "Header Text" }, updatedAt }.
const IMPORT_PROFILES_FILE = './distributorImportProfiles.json';
function readImportProfiles() {
  if (!existsSync(IMPORT_PROFILES_FILE)) return {};
  try { return JSON.parse(readFileSync(IMPORT_PROFILES_FILE, 'utf-8')) || {}; }
  catch (err) { console.error('Import profile read error:', err.message); return {}; }
}
function writeImportProfile(distributorId, profile) {
  const all = readImportProfiles();
  all[distributorId] = { ...profile, updatedAt: new Date().toISOString() };
  writeFileSync(IMPORT_PROFILES_FILE, JSON.stringify(all, null, 2));
  return all[distributorId];
}

// ── Import change log ────────────────────────────────────────────────────────
// The catalog is a LIVING dataset — vendors raise/drop prices on their own
// schedules. Every import records what changed (added / price up / price down /
// missing) + the biggest movers + any format drift, so we can see "what changed
// and when" per vendor instead of silently overwriting. Last 50 events per vendor.
const CHANGE_LOG_FILE = './distributorChangeLog.json';
function readChangeLog() {
  if (!existsSync(CHANGE_LOG_FILE)) return {};
  try { return JSON.parse(readFileSync(CHANGE_LOG_FILE, 'utf-8')) || {}; }
  catch (err) { console.error('Change log read error:', err.message); return {}; }
}
function appendChangeLog(distributorId, event) {
  const all = readChangeLog();
  const list = Array.isArray(all[distributorId]) ? all[distributorId] : [];
  list.unshift(event);
  all[distributorId] = list.slice(0, 50);
  writeFileSync(CHANGE_LOG_FILE, JSON.stringify(all, null, 2));
  return all[distributorId];
}

// ── Price-list import (CSV/TSV) ──────────────────────────────────────────────
// Distributors periodically send updated parts/price lists. parseDelimited handles
// quoted fields, embedded commas/newlines, CRLF, a BOM, and auto-detects comma / tab
// / semicolon delimiters so most "Save As CSV" exports from Excel just work.
function parseDelimited(text) {
  const raw = String(text || '').replace(/^﻿/, '');
  if (!raw.trim()) return [];
  const nl = raw.indexOf('\n');
  const firstLine = nl === -1 ? raw : raw.slice(0, nl);
  const delim = firstLine.includes('\t') ? '\t' : (firstLine.includes(';') && !firstLine.includes(',')) ? ';' : ',';
  const rows = [];
  let field = '', row = [], inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch === '\r') { /* ignore */ }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Real vendor price lists never match a fixed template: the header is buried
// under title/preamble rows, column names vary wildly, category rows are
// interleaved, prices carry float noise, and merged cells leave gaps. This
// parser adapts to the file instead of forcing the file to adapt to us:
//   detectHeaderRow → find the real header anywhere in the first 40 rows
//   mapImportHeaders → fuzzy-match + content-sample columns to our fields
//   sectionCategory  → treat one-cell "BUTT HINGES" rows as a running category
// Aliases are ordered most-specific-first; longer/exact matches outscore loose ones.
const IMPORT_COLUMN_ALIASES = {
  part: ['part number', 'part no', 'part #', 'part', 'sku', 'item number', 'item #', 'item', 'model', 'catalog number', 'catalog #', 'product code', 'entry name', 'distributor part', 'stock number', 'number'],
  description: ['description', 'desc', 'item description', 'product name', 'product', 'title', 'details', 'name'],
  price: ['list price', 'msrp', 'retail price', 'list', 'retail', 'suggested price', 'unit price', 'amount', 'each', 'price'],
  // "net" = our cost from the vendor (a.k.a. discount/dealer/jobber/wholesale price). A true
  // percentage column (Discount % = 0.5) is rejected later by the ≤1 value-fraction guard.
  net: ['net price', 'discount price', 'dealer price', 'jobber price', 'wholesale price', 'distributor price', 'your price', 'your cost', 'our price', 'our cost', 'buy price', 'sell price', 'disc price', 'd c price', 'dc price', 'net', 'cost', 'disc', 'discount', 'dealer', 'jobber', 'wholesale', 'whsl', 'buy'],
  category: ['discount group', 'product line', 'item group name', 'item group', 'category', 'group', 'class', 'family', 'type', 'cat'],
  manufacturerPart: ['manufacturer part', 'mfg part', 'mfr part', 'oem part', 'oem code', 'manufacturer', 'mfg', 'mfr', 'oem'],
  quantity: ['quantity on hand', 'qty on hand', 'quantity', 'on hand', 'in stock', 'qty', 'stock'],
  condition: ['condition', 'cond', 'status'],
  image: ['image url', 'image', 'photo', 'thumbnail'],
  link: ['link', 'product url', 'url', 'source', 'web'],
  uom: ['unit of measure', 'uom', 'um', 'unit'],
};
const IMPORT_PRICE_FIELDS = new Set(['price', 'net']);
const IMPORT_FIELD_KEYS = new Set(Object.keys(IMPORT_COLUMN_ALIASES));
const importNorm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const importHasWord = (hay, needle) => (' ' + hay + ' ').includes(' ' + needle + ' ');

function parseImportPrice(v) {
  if (v == null || String(v).trim() === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100; // round away vendor float noise (338.3960625 → 338.4)
}

// Sample the data under a column to learn its shape (numeric? fractional? text?).
function importColumnStats(rows, headerRowIdx, colIdx, sampleN = 40) {
  let numeric = 0, fraction = 0, text = 0, filled = 0, total = 0;
  for (let r = headerRowIdx + 1; r < rows.length && total < sampleN; r++) {
    const s = String((rows[r] && rows[r][colIdx]) ?? '').trim();
    total++;
    if (!s) continue;
    filled++;
    const n = parseFloat(s.replace(/[^0-9.\-]/g, ''));
    const isNum = Number.isFinite(n) && /[0-9]/.test(s) && /^[\s$£€]*[-0-9.,%]+\s*%?$/.test(s);
    if (isNum) { numeric++; if (Math.abs(n) <= 1) fraction++; }
    else if (/[a-z]/i.test(s)) text++;
  }
  return { numeric, fraction, text, filled, total };
}

function importScoreHeaderField(headerNorm, field) {
  if (!headerNorm) return 0;
  let best = 0;
  for (const alias of IMPORT_COLUMN_ALIASES[field]) {
    let s = 0;
    if (headerNorm === alias) s = 100 + alias.length;
    else if (importHasWord(headerNorm, alias)) s = 60 + alias.length;
    else if (alias.length >= 4 && importHasWord(alias, headerNorm)) s = 40 + headerNorm.length;
    if (s > best) best = s;
  }
  return best;
}

// Map a header row → { field: colIdx }. Greedy 1:1 assignment by score, with
// content sampling to reject percentage columns and back-fill description/part.
function mapImportHeaders(rows, headerRowIdx) {
  const header = rows[headerRowIdx] || [];
  const stats = header.map((_, c) => importColumnStats(rows, headerRowIdx, c));
  const pairs = [];
  header.forEach((h, c) => {
    const hn = importNorm(h);
    if (!hn) return;
    for (const field of Object.keys(IMPORT_COLUMN_ALIASES)) {
      const s = importScoreHeaderField(hn, field);
      if (!s) continue;
      // A "price"/"cost" column whose values are all ≤1 is a percentage (e.g. Discount % = 0.5), not money.
      if (IMPORT_PRICE_FIELDS.has(field) && stats[c].numeric > 0 && stats[c].fraction === stats[c].numeric) continue;
      pairs.push({ c, field, s });
    }
  });
  pairs.sort((a, b) => b.s - a.s || a.c - b.c);
  const map = {}, usedCol = new Set();
  for (const p of pairs) {
    if (map[p.field] !== undefined || usedCol.has(p.c)) continue;
    map[p.field] = p.c; usedCol.add(p.c);
  }
  // Fallback: description = the unused, mostly-text column with the most words.
  if (map.description === undefined) {
    let best = -1, bestScore = 0;
    header.forEach((_, c) => {
      if (usedCol.has(c)) return;
      const score = stats[c].text - stats[c].numeric;
      if (stats[c].text >= 2 && score > bestScore) { bestScore = score; best = c; }
    });
    if (best >= 0) { map.description = best; usedCol.add(best); }
  }
  // Fallback: part = first unused, mostly-filled column (vendor code).
  if (map.part === undefined) {
    let best = -1;
    header.forEach((_, c) => {
      if (best >= 0 || usedCol.has(c)) return;
      if (stats[c].filled >= Math.max(2, stats[c].total * 0.5)) best = c;
    });
    if (best >= 0) { map.part = best; usedCol.add(best); }
  }
  return map;
}

// Find the header row: the row within the first 40 that resolves the most of
// our fields AND yields a part column. Skips title/preamble/blank lead-in rows.
function detectHeaderRow(rows) {
  const limit = Math.min(rows.length, 40);
  let bestRow = 0, bestScore = -1;
  for (let r = 0; r < limit; r++) {
    const row = rows[r] || [];
    const nonEmpty = row.filter(c => String(c ?? '').trim()).length;
    if (nonEmpty < 2) continue;
    const map = mapImportHeaders(rows, r);
    if (map.part === undefined) continue;
    const fields = Object.keys(map).length;
    const hasMoney = map.price !== undefined || map.cost !== undefined;
    const score = fields * 10 + (hasMoney ? 5 : 0) + nonEmpty - r; // earlier + richer wins
    if (score > bestScore) { bestScore = score; bestRow = r; }
  }
  return bestRow;
}

// A category/section divider row: a single heading-like cell, no price.
// e.g. Direct Hardware's "BUTT HINGES" / "EXIT DEVICES" rows → running category.
function sectionCategory(row, map) {
  const cells = (row || []).map((c, i) => [String(c ?? '').trim(), i]).filter(([v]) => v);
  if (cells.length !== 1) return null;
  const [val, idx] = cells[0];
  if (map.part !== undefined && idx !== map.part && idx !== 0) return null;
  if (val.length < 3 || parseImportPrice(val) != null) return null;
  const letters = (val.match(/[a-z]/gi) || []).length;
  const looksHeading = /[a-z].*[ &/].*[a-z]/i.test(val) || (/^[A-Z0-9 ()/&.\-]+$/.test(val) && letters >= 3);
  return looksHeading ? val.replace(/\s+/g, ' ') : null;
}
function importSlug(s) {
  return String(s || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'X';
}

function textFromHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/&#038;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function attrFromHtml(html, attr) {
  const match = String(html || '').match(new RegExp(`${attr}=['"]([^'"]+)['"]`, 'i'));
  return match?.[1] || '';
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8211;/g, '-')
    .replace(/&#8217;/g, "'");
}

function normalizeUrl(url, base = 'https://www.automaticsandmore.com/') {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

function isPublicSiteConnected(distributor) {
  return Boolean(PUBLIC_SITE_CONNECTORS[distributor.id]);
}

function distributorConnectionInfo(distributor) {
  if (distributor.id === 'addison') {
    return {
      level: 'solid-catalog',
      label: 'Solid catalog scraper',
      clue: 'Connected to Addison public catalog rows. Pricing still requires Addison login.',
      needsStrongerConnection: false,
    };
  }
  if (distributor.type === 'automatics-and-more-category') {
    return {
      level: 'solid-catalog',
      label: 'Solid category scraper',
      clue: 'Connected to Automatics & More category pages with item rows and public prices when available.',
      needsStrongerConnection: false,
    };
  }
  const connector = PUBLIC_SITE_CONNECTORS[distributor.id];
  if (connector) {
    return {
      level: connector.connectionLevel || 'public-site',
      label: connector.connectionLabel || 'Public site connector',
      clue: connector.connectionClue || 'Connected through public pages. A stronger connection would use an official feed, API, or account-backed catalog.',
      needsStrongerConnection: true,
    };
  }
  return {
    level: 'not-connected',
    label: 'Not connected',
    clue: 'No connector is configured yet.',
    needsStrongerConnection: true,
  };
}

function publicConnectorNotes(distributor) {
  const info = distributorConnectionInfo(distributor);
  return `${info.label}. ${info.clue}`;
}

function publicSearchUrl(distributor, query = '') {
  const connector = PUBLIC_SITE_CONNECTORS[distributor.id];
  if (!connector?.searchUrl) return distributor.website;
  return connector.searchUrl.replace('{query}', encodeURIComponent(query || distributor.name));
}

function extractSitemapUrls(xml) {
  return [...String(xml || '').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map(match => decodeHtml(match[1]).trim())
    .filter(Boolean);
}

async function fetchText(url, timeoutMs = 18000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 PartFinder public catalog connector',
        'Accept': 'text/html,application/xhtml+xml,application/xml,text/xml',
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function collectPublicSiteUrls(distributor, connector) {
  const urls = new Set(connector.seedUrls || []);
  const queue = [...(connector.sitemapUrls || [])];
  const seenSitemaps = new Set();
  const errors = [];
  const maxSitemaps = 12;

  while (queue.length && seenSitemaps.size < maxSitemaps) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || seenSitemaps.has(sitemapUrl)) continue;
    seenSitemaps.add(sitemapUrl);
    try {
      const xml = await fetchText(sitemapUrl, 18000);
      for (const loc of extractSitemapUrls(xml)) {
        if (/sitemap/i.test(loc) && queue.length < maxSitemaps) {
          queue.push(loc);
        } else {
          urls.add(loc);
        }
      }
    } catch (err) {
      errors.push({ distributor: distributor.id, url: sitemapUrl, error: err.message || String(err) });
    }
  }

  return {
    urls: [...urls].filter(url => {
      const include = connector.include || [];
      return include.length === 0 || include.some(pattern => pattern.test(url));
    }),
    errors,
  };
}

function pageTitleFromHtml(html, fallback) {
  return decodeHtml(textFromHtml(
    String(html || '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
    String(html || '').match(/<meta[^>]+property=['"]og:title['"][^>]+content=['"]([^'"]+)['"]/i)?.[1] ||
    String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
    fallback
  )).replace(/\s+[|–-]\s+.*$/, '').trim();
}

function pageDescriptionFromHtml(html, fallback) {
  return decodeHtml(textFromHtml(
    String(html || '').match(/<meta[^>]+name=['"]description['"][^>]+content=['"]([^'"]+)['"]/i)?.[1] ||
    String(html || '').match(/<meta[^>]+property=['"]og:description['"][^>]+content=['"]([^'"]+)['"]/i)?.[1] ||
    String(html || '').match(/<p[^>]*>([\s\S]{40,400}?)<\/p>/i)?.[1] ||
    fallback
  )).trim();
}

function pageImageFromHtml(html, baseUrl) {
  return normalizeUrl(
    String(html || '').match(/<meta[^>]+property=['"]og:image['"][^>]+content=['"]([^'"]+)['"]/i)?.[1] ||
    String(html || '').match(/<img[^>]+src=['"]([^'"]+)['"]/i)?.[1] ||
    '',
    baseUrl
  );
}

function connectedLandingItem(distributor, connector, reason = '') {
  return {
    id: `${distributor.id}-connected-source`,
    distributorId: distributor.id,
    distributor: distributor.name,
    categoryCode: connector.kind || 'public-site',
    category: connector.category || distributor.name,
    addisonPart: distributor.id,
    manufacturerPart: '',
    description: reason || `Connected public source for ${distributor.name}`,
    title: `${distributor.name} public catalog`,
    price: null,
    priceLabel: 'Public source',
    condition: 'source',
    thumbnail: '',
    image: '',
    link: publicSearchUrl(distributor),
    connectionLevel: connector.connectionLevel || 'public-site',
    connectionLabel: connector.connectionLabel || 'Public site connector',
    connectionClue: connector.connectionClue || reason || '',
    updatedAt: new Date().toISOString(),
  };
}

async function scrapePublicSiteDistributor(distributor) {
  const connector = PUBLIC_SITE_CONNECTORS[distributor.id];
  if (!connector) throw new Error('Public site connector not configured for this entry.');

  const { urls, errors } = await collectPublicSiteUrls(distributor, connector);
  const selectedUrls = urls.slice(0, connector.maxPages || 24);
  const items = [];
  const concurrency = connector.concurrency || 6;

  for (let i = 0; i < selectedUrls.length; i += concurrency) {
    const batch = selectedUrls.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map(async url => {
      const html = await fetchText(url, 12000);
      const title = pageTitleFromHtml(html, distributor.name);
      if (!title || title.toLowerCase() === distributor.name.toLowerCase()) return null;
      return {
        id: `${distributor.id}-${Buffer.from(url).toString('base64url').slice(0, 36)}`,
        distributorId: distributor.id,
        distributor: distributor.name,
        categoryCode: connector.kind || 'public-site',
        category: connector.category || distributor.name,
        addisonPart: title,
        manufacturerPart: '',
        description: pageDescriptionFromHtml(html, title),
        title,
        price: null,
        priceLabel: 'See source',
        condition: 'source',
        thumbnail: pageImageFromHtml(html, url),
        image: pageImageFromHtml(html, url),
        link: url,
        connectionLevel: connector.connectionLevel || 'public-site',
        connectionLabel: connector.connectionLabel || 'Public site connector',
        connectionClue: connector.connectionClue || '',
        updatedAt: new Date().toISOString(),
      };
    }));
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        items.push(result.value);
      } else if (result.status === 'rejected') {
        errors.push({ distributor: distributor.id, url: batch[index], error: result.reason?.message || String(result.reason) });
      }
    });
  }

  const deduped = Array.from(new Map(items.map(item => [item.link, item])).values());
  if (deduped.length === 0) {
    deduped.push(connectedLandingItem(distributor, connector, connector.blockedMessage));
  }
  return { items: deduped, errors };
}

function parseMoneyValue(value) {
  const n = parseFloat(String(value || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseAddisonRows(html, category) {
  const rows = [];
  const rowRe = /<div class='row row-product'>([\s\S]*?)<\/div><\/div>/g;
  for (const match of html.matchAll(rowRe)) {
    const rowHtml = match[0];
    const text = textFromHtml(rowHtml);
    const addisonPart = text.match(/Addison Part#:\s*([^\s]+)/i)?.[1] || '';
    if (!addisonPart) continue;
    const mfgPart = text.match(/Mfg Part#:\s*(.*?)\s{0,2}(?=[A-Z0-9][A-Z0-9 ,./#&+-]{6,}\s+\(login for price\)|\(login for price\)|Login$)/i)?.[1]?.trim() || '';
    const descMatch = rowHtml.match(/<strong>([\s\S]*?)<\/strong>/i);
    const description = textFromHtml(descMatch?.[1] || '');
    rows.push({
      id: `addison-${category.code}-${addisonPart}`,
      distributorId: 'addison',
      distributor: 'Addison Automatics',
      categoryCode: category.code,
      category: category.name,
      addisonPart,
      manufacturerPart: mfgPart.replace(/^,+/, '').trim(),
      description,
      price: null,
      priceLabel: '(login for price)',
      condition: description.includes('RBLT') ? 'rebuilt' : 'unknown',
      thumbnail: attrFromHtml(rowHtml, 'src'),
      image: attrFromHtml(rowHtml, 'href'),
      link: 'https://www.addisonautomatics.com/catalog/',
      updatedAt: new Date().toISOString(),
    });
  }
  return rows;
}

async function fetchAddisonCategory(category) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const params = new URLSearchParams({
      'post-action': 'parts-search',
      'part-group-code': category.code,
      search: '',
    });
    const url = `https://www.addisonautomatics.com/catalog/?${params}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PartFinder distributor catalog refresh; contact sales@addisonautomatics.com',
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Addison ${category.code} returned HTTP ${response.status}`);
    const html = await response.text();
    return parseAddisonRows(html, category);
  } finally {
    clearTimeout(timer);
  }
}

async function scrapeAddisonCatalog(categories) {
  const items = [];
  const errors = [];
  const concurrency = 4;

  for (let i = 0; i < categories.length; i += concurrency) {
    const batch = categories.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map(category => fetchAddisonCategory(category)));
    results.forEach((result, index) => {
      const category = batch[index];
      if (result.status === 'fulfilled') {
        items.push(...result.value);
      } else {
        errors.push({ categoryCode: category.code, category: category.name, error: result.reason?.message || String(result.reason) });
      }
    });
  }

  return { items, errors };
}

function automaticsAndMoreCategoryId(url) {
  return String(url || '').match(/-s\/(\d+)\.htm|category-s\/(\d+)\.htm/i)?.slice(1).find(Boolean) || '';
}

function automaticsAndMorePageUrl(distributor, page = 1) {
  const categoryId = automaticsAndMoreCategoryId(distributor.website);
  const url = new URL(distributor.website);
  if (categoryId) {
    url.searchParams.set('searching', 'Y');
    url.searchParams.set('sort', '13');
    url.searchParams.set('cat', categoryId);
    url.searchParams.set('show', '300');
    url.searchParams.set('page', String(page));
  }
  return url.toString();
}

function parseAutomaticsAndMoreProducts(html, distributor) {
  const parts = String(html || '').split('<div class="v-product"').slice(1);
  return parts.map((part, index) => {
    const block = `<div class="v-product"${part}`;
    const link = normalizeUrl(block.match(/<a[^>]+href="([^"]+)"[^>]+class="v-product__img"/i)?.[1] ||
      block.match(/<a[^>]+class="v-product__title[^"]*"[^>]+href="([^"]+)"/i)?.[1] ||
      block.match(/<a[^>]+href="([^"]+)"/i)?.[1]);
    const thumbnail = normalizeUrl(block.match(/<img[^>]+src="([^"]+)"/i)?.[1]);
    const title = textFromHtml(block.match(/<span itemprop="name">([\s\S]*?)<\/span>/i)?.[1] ||
      block.match(/class="v-product__title[^"]*"[^>]*title="([^"]+)"/i)?.[1] || '');
    if (!title) return null;
    const description = textFromHtml(block.match(/<p itemprop="description"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '');
    const sku = title.split(' - ')[0]?.trim() || link.match(/product-p\/([^/.]+)\.htm/i)?.[1] || '';
    const price = parseMoneyValue(block.match(/itemprop=['"]price['"][^>]+content=['"]([^'"]+)['"]/i)?.[1] ||
      block.match(/Our Price:<\/font>\s*\$?\s*<span[^>]*>([^<]+)/i)?.[1]);
    const listPrice = parseMoneyValue(block.match(/List Price:\s*\$?([0-9,.]+)/i)?.[1]);
    return {
      id: `${distributor.id}-${sku || index}`,
      distributorId: distributor.id,
      distributor: distributor.name,
      categoryCode: automaticsAndMoreCategoryId(distributor.website),
      category: distributor.name,
      addisonPart: sku,
      manufacturerPart: sku,
      description: description || title,
      title,
      price,
      listPrice,
      priceLabel: price ? `$${price.toFixed(2)}` : 'Price unavailable',
      condition: 'new',
      thumbnail,
      image: thumbnail,
      link,
      updatedAt: new Date().toISOString(),
    };
  }).filter(Boolean);
}

async function fetchAutomaticsAndMoreCategoryPage(distributor, page = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(automaticsAndMorePageUrl(distributor, page), {
      headers: {
        'User-Agent': 'Mozilla/5.0 PartFinder catalog refresh',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${distributor.name} returned HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function scrapeAutomaticsAndMoreCategory(distributor) {
  const items = [];
  const errors = [];
  const seenFirstItems = new Set();
  const maxPages = 8;

  for (let page = 1; page <= maxPages; page++) {
    try {
      const html = await fetchAutomaticsAndMoreCategoryPage(distributor, page);
      const pageItems = parseAutomaticsAndMoreProducts(html, distributor);
      if (pageItems.length === 0) break;
      const firstId = pageItems[0]?.id;
      if (firstId && seenFirstItems.has(firstId)) break;
      if (firstId) seenFirstItems.add(firstId);
      items.push(...pageItems);
      if (pageItems.length < 300) break;
    } catch (err) {
      errors.push({ distributor: distributor.id, page, error: err.message || String(err) });
      break;
    }
  }

  const deduped = Array.from(new Map(items.map(item => [item.id, item])).values());
  return { items: deduped, errors };
}

async function scrapeDistributor(distributor, body = {}) {
  if (distributor.id === 'addison') {
    const requestedCodes = Array.isArray(body?.categoryCodes) ? body.categoryCodes : [];
    const categories = requestedCodes.length
      ? distributor.categories.filter(category => requestedCodes.includes(category.code))
      : distributor.categories;
    return await scrapeAddisonCatalog(categories);
  }
  if (distributor.type === 'automatics-and-more-category') {
    return await scrapeAutomaticsAndMoreCategory(distributor);
  }
  if (isPublicSiteConnected(distributor)) {
    return await scrapePublicSiteDistributor(distributor);
  }
  throw new Error('Catalog scraper not connected for this entry yet.');
}

function filterCatalogItems(items, q = '', distributorId = '') {
  const needle = q.trim().toLowerCase();
  return items.filter(item => {
    if (distributorId && item.distributorId !== distributorId) return false;
    if (!needle) return true;
    return [
      item.distributor,
      item.category,
      item.addisonPart,
      item.manufacturerPart,
      item.description,
    ].some(value => String(value || '').toLowerCase().includes(needle));
  });
}

app.get('/api/sources', (req, res) => {
  const data = JSON.parse(readFileSync('./sources.json', 'utf-8'));
  res.json(data.sources.map(source => {
    if (source.id === 'bigquery') {
      return { ...source, enabled: isBigQueryConfigured(), configured: isBigQueryConfigured() };
    }
    if (source.id === 'apify') {
      return { ...source, enabled: isApifyConfigured(), configured: isApifyConfigured() };
    }
    return source;
  }));
});

app.get('/api/distributors', (req, res) => {
  const store = readCatalogStore();
  const counts = store.items.reduce((acc, item) => {
    acc[item.distributorId] = (acc[item.distributorId] || 0) + 1;
    return acc;
  }, {});
  res.json({
    distributors: DISTRIBUTORS.map(distributor => ({
      ...distributor,
      notes: publicConnectorNotes(distributor),
      connected: distributor.id === 'addison' || distributor.type === 'automatics-and-more-category' || isPublicSiteConnected(distributor),
      connection: distributorConnectionInfo(distributor),
      searchUrl: publicSearchUrl(distributor),
      itemCount: counts[distributor.id] || 0,
      lastCatalogUpdate: store.updatedAt,
    })),
  });
});

app.get('/api/distributor-catalog', (req, res) => {
  const { q = '', distributor = '' } = req.query;
  const store = readCatalogStore();
  const items = filterCatalogItems(store.items, String(q), String(distributor));
  res.json({
    updatedAt: store.updatedAt,
    count: items.length,
    items,
  });
});

// Import / update a distributor's parts + price list from a pasted/uploaded CSV.
// MERGE semantics (non-destructive): rows update matching parts by part number and
// add new ones; any existing item NOT present in the upload is left untouched, so
// parts the distributor no longer lists (or parts we added ourselves) persist.
app.post('/api/distributors/:id/import', (req, res) => {
  const distributor = DISTRIBUTORS.find(d => d.id === req.params.id);
  if (!distributor) return res.status(404).json({ error: 'Unknown distributor' });

  const csv = req.body?.csv;
  if (!csv || !String(csv).trim()) return res.status(400).json({ error: 'No price-list content provided.' });
  const defaultCategory = String(req.body?.defaultCategory || '').trim();

  const rows = parseDelimited(csv);
  if (rows.length < 2) return res.status(400).json({ error: 'Need a header row plus at least one data row.' });
  const headerRow = detectHeaderRow(rows);
  const headerCells = (rows[headerRow] || []).map(h => String(h ?? '').trim());
  const cols = mapImportHeaders(rows, headerRow);

  // This vendor always sends the same layout → reuse the learned profile, and let an
  // admin pin/correct a column by header NAME (override wins). Matching by header TEXT
  // survives the vendor reordering columns between files.
  const colForHeaderName = (name) => {
    const target = importNorm(name);
    if (!target) return undefined;
    let idx = headerCells.findIndex(h => importNorm(h) === target);
    if (idx < 0) idx = headerCells.findIndex(h => importNorm(h) && (importHasWord(importNorm(h), target) || importHasWord(target, importNorm(h))));
    return idx >= 0 ? idx : undefined;
  };
  const savedProfile = readImportProfiles()[distributor.id] || null;
  const overrides = (req.body?.overrides && typeof req.body.overrides === 'object') ? req.body.overrides : {};
  const pinned = { ...(savedProfile?.columns || {}), ...overrides }; // saved layout, then admin corrections
  for (const [field, headerName] of Object.entries(pinned)) {
    if (!IMPORT_FIELD_KEYS.has(field)) continue;
    if (headerName == null || String(headerName).trim() === '') { delete cols[field]; continue; } // explicit "none"
    const idx = colForHeaderName(headerName);
    if (idx !== undefined) cols[field] = idx;
  }
  if (cols.part === undefined) {
    return res.status(400).json({ error: 'No part-number column found. Add a header like "Part Number", "SKU", "Item", or "Product".', headers: headerCells });
  }
  // priceMode: 'list' shows MSRP/list as the headline price, 'net' shows our cost.
  // Net is ALWAYS captured into netPrice regardless — this only controls the displayed number.
  const priceMode = (req.body?.priceMode === 'net' || req.body?.priceMode === 'list')
    ? req.body.priceMode : (savedProfile?.priceMode || 'list');

  // ── Format-drift detection ──
  // Vendors change their layout on their own schedule. Compare this file's headers
  // to the ones we saw last time: a column we relied on disappearing is a WARNING;
  // brand-new columns are captured (not dropped) so the data is never lost and the
  // admin can promote them to a real field via the mapping editor.
  const mappedIdx = new Set(Object.values(cols));
  const unmappedCols = headerCells.map((h, i) => ({ h, i })).filter(x => x.h && !mappedIdx.has(x.i));
  const formatWarnings = [];
  const priorHeaders = savedProfile?.headers || (savedProfile?.columns ? Object.values(savedProfile.columns) : null);
  let newColumns = [], removedColumns = [];
  if (priorHeaders) {
    const priorSet = new Set(priorHeaders.map(importNorm));
    const nowSet = new Set(headerCells.filter(Boolean).map(importNorm));
    newColumns = headerCells.filter(h => h && !priorSet.has(importNorm(h)));
    removedColumns = priorHeaders.filter(h => h && !nowSet.has(importNorm(h)));
    // A field we mapped last time that we can no longer place is the dangerous case.
    for (const [field, savedHeader] of Object.entries(savedProfile?.columns || {})) {
      if (!savedHeader) continue;
      if (cols[field] === undefined) formatWarnings.push({ field, was: savedHeader, now: null, msg: `Column for "${field}" (was “${savedHeader}”) is missing — value not imported until remapped.` });
      else if (importNorm(headerCells[cols[field]]) !== importNorm(savedHeader)) formatWarnings.push({ field, was: savedHeader, now: headerCells[cols[field]], msg: `"${field}" moved from “${savedHeader}” to “${headerCells[cols[field]]}”.` });
    }
  }

  const store = readCatalogStore();
  const others = store.items.filter(it => it.distributorId !== distributor.id);
  const mine = store.items.filter(it => it.distributorId === distributor.id);
  const keyOf = (part) => `${distributor.id}::${String(part || '').trim().toUpperCase()}`;
  const byKey = new Map();
  mine.forEach(it => byKey.set(keyOf(it.addisonPart || it.manufacturerPart || it.id), it));

  const now = new Date().toISOString();
  const priorCount = mine.length; // parts we already had for this vendor (for partial-upload guard)
  let added = 0, updated = 0, skipped = 0, sections = 0, withNet = 0, withList = 0;
  let priceUp = 0, priceDown = 0, unchanged = 0;
  const movers = []; // { part, description, field, from, to, deltaPct, dir }
  const addedSample = []; // brand-new parts this import
  const seenKeys = new Set();
  let currentCategory = '';
  const hasPrice = cols.price !== undefined;
  const hasNet = cols.net !== undefined;
  const hasQty = cols.quantity !== undefined;
  const round2 = (n) => Math.round(n * 100) / 100;

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    if (row.every(c => !String(c || '').trim())) continue; // blank line
    const sec = sectionCategory(row, cols); // "BUTT HINGES" divider → running category
    if (sec) { currentCategory = sec; sections++; continue; }
    const cell = (f) => (cols[f] !== undefined ? String(row[cols[f]] ?? '').trim() : '');
    const part = cell('part');
    if (!part) { skipped++; continue; }
    seenKeys.add(keyOf(part));
    const list = hasPrice ? parseImportPrice(row[cols.price]) : null;
    const net = hasNet ? parseImportPrice(row[cols.net]) : null;
    const sell = priceMode === 'net' ? (net != null ? net : list) : (list != null ? list : net);
    if (net != null) withNet++;
    if (list != null) withList++;
    const qty = hasQty ? parseImportPrice(row[cols.quantity]) : null;
    const rowCategory = cell('category') || currentCategory;
    // Capture any unmapped columns so a vendor adding a field never loses data.
    let extra = null;
    for (const uc of unmappedCols) { const v = String(row[uc.i] ?? '').trim(); if (v) (extra ||= {})[uc.h] = v; }
    const existing = byKey.get(keyOf(part));

    // ── Classify the change vs what we had ──
    const beforeList = existing ? (existing.listPrice ?? null) : null;
    const beforeNet = existing ? (existing.netPrice ?? null) : null;
    let priceMoved = false;
    if (existing) {
      const oldV = beforeNet != null ? beforeNet : beforeList;
      const newV = net != null ? net : list;
      const field = (net != null && beforeNet != null) ? 'net' : 'list';
      const from = field === 'net' ? beforeNet : beforeList;
      const to = field === 'net' ? net : list;
      if (from != null && to != null && from !== to) {
        priceMoved = true;
        const dir = to > from ? 'priceUp' : 'priceDown';
        if (dir === 'priceUp') priceUp++; else priceDown++;
        movers.push({ part, description: (existing.description || part).slice(0, 48), field, from, to, deltaPct: from > 0 ? round2(((to - from) / from) * 100) : null, dir });
      } else {
        unchanged++;
      }
    }
    const priceHistEntry = (existing ? priceMoved : (list != null || net != null))
      ? { at: now, list: list ?? null, net: net ?? null } : null;

    if (existing) {
      if (cell('description')) existing.description = cell('description');
      if (rowCategory) existing.category = rowCategory;
      if (cell('manufacturerPart')) existing.manufacturerPart = cell('manufacturerPart');
      if (cell('condition')) existing.condition = cell('condition');
      if (cell('uom')) existing.uom = cell('uom');
      if (cell('image')) { existing.image = cell('image'); if (!existing.thumbnail) existing.thumbnail = cell('image'); }
      if (cell('link')) existing.link = cell('link');
      if (extra) existing.extra = { ...(existing.extra || {}), ...extra };
      if (hasPrice || hasNet) { existing.price = sell; existing.priceLabel = sell != null ? '' : (existing.priceLabel || '(call for price)'); }
      if (list != null) existing.listPrice = list;
      if (net != null) existing.netPrice = net;
      if (qty != null) existing.quantity = qty;
      if (priceHistEntry) existing.priceHistory = [...(existing.priceHistory || []), priceHistEntry].slice(-24);
      existing.lastSeenInList = now;
      // It's in the vendor's current list → available to sell. Clear any prior discontinued flags.
      const wasUnavailable = existing.available === false;
      existing.available = true;
      existing.availability = 'active';
      if (existing.missingSince) delete existing.missingSince;
      if (existing.missedImports) delete existing.missedImports;
      if (wasUnavailable) existing.reactivatedAt = now;
      existing.updatedAt = now;
      existing.source = 'price-list';
      updated++;
    } else {
      const category = rowCategory || defaultCategory || 'PRICE LIST';
      const item = {
        id: `${distributor.id}-${importSlug(category)}-${importSlug(part)}`,
        distributorId: distributor.id,
        distributor: distributor.name,
        categoryCode: '',
        category,
        addisonPart: part,
        manufacturerPart: cell('manufacturerPart'),
        description: cell('description') || part,
        price: sell,
        priceLabel: sell != null ? '' : '(call for price)',
        condition: cell('condition') || 'new',
        thumbnail: cell('image') || '',
        image: cell('image') || '',
        link: cell('link') || distributor.website || '',
        updatedAt: now,
        lastSeenInList: now,
        addedAt: now,
        available: true,
        availability: 'active',
        source: 'price-list',
      };
      if (list != null) item.listPrice = list;
      if (net != null) item.netPrice = net;
      if (qty != null) item.quantity = qty;
      if (cell('uom')) item.uom = cell('uom');
      if (extra) item.extra = extra;
      if (priceHistEntry) item.priceHistory = [priceHistEntry];
      byKey.set(keyOf(part), item);
      mine.push(item);
      if (addedSample.length < 50) addedSample.push({ part, description: (item.description || '').slice(0, 48), price: sell });
      added++;
    }
  }

  // Parts we have for this vendor (from a prior price list) that are NOT in this file →
  // candidate discontinued = can't be sold. Non-destructive: we FLAG (available=false),
  // never delete.
  //
  // GUARD: a vendor may send a PARTIAL list (one category). If this file covers only a
  // small fraction of what we already had, treat absent parts as "not in this upload"
  // rather than mass-discontinuing them — otherwise sales would see hundreds of false
  // "unavailable" flags. Only when coverage is high do absences mean discontinued.
  // coverage = how many parts we already had did this file re-list (updated / prior).
  const coverage = priorCount > 0 ? updated / priorCount : 1;
  const partialUpload = priorCount >= 20 && coverage < 0.5;
  const discontinued = [];      // newly flagged unavailable this import
  const stillMissing = [];      // already-flagged, still absent
  if (!partialUpload) {
    for (const it of mine) {
      if (it.source !== 'price-list') continue;
      const k = keyOf(it.addisonPart || it.manufacturerPart || it.id);
      if (seenKeys.has(k)) continue;
      const firstMiss = !it.missingSince;
      if (firstMiss) it.missingSince = now;
      it.missedImports = (it.missedImports || 0) + 1;
      it.available = false;
      it.availability = 'discontinued';
      const rec = { part: it.addisonPart || it.id, description: (it.description || '').slice(0, 48), missingSince: it.missingSince, missedImports: it.missedImports, lastPrice: it.price ?? it.netPrice ?? it.listPrice ?? null };
      if (firstMiss) discontinued.push(rec); else stillMissing.push(rec);
    }
  }
  const missing = [...discontinued, ...stillMissing];

  const nextStore = writeCatalogStore([...others, ...mine]);
  // Learn / refresh this vendor's layout (incl. full header list for drift detection next time).
  const mapping = Object.fromEntries(Object.entries(cols).map(([field, idx]) => [field, headerCells[idx] || '']));
  const profile = writeImportProfile(distributor.id, { headerRow, columns: mapping, headers: headerCells.filter(Boolean), priceMode });

  // Biggest movers first — that's what "be aware ASAP" means.
  movers.sort((a, b) => Math.abs(b.deltaPct || 0) - Math.abs(a.deltaPct || 0));
  const changes = {
    added, priceUp, priceDown, unchanged,
    discontinued: discontinued.length, stillUnavailable: stillMissing.length,
    partialUpload, coverage: round2(coverage),
    newColumns, removedColumns, formatWarnings,
    topMovers: movers.slice(0, 12), addedSample: addedSample.slice(0, 12), discontinuedSample: discontinued.slice(0, 12),
  };
  // Persist the event so "what changed and when" is browsable later (per-vendor change feed).
  appendChangeLog(distributor.id, {
    at: now, distributor: distributor.name, headerRow: headerRow + 1, priceMode, partialUpload, coverage: round2(coverage),
    counts: { added, updated, priceUp, priceDown, unchanged, discontinued: discontinued.length },
    newColumns, removedColumns, formatWarnings,
    topMovers: movers.slice(0, 25), addedSample: addedSample.slice(0, 25), discontinuedSample: discontinued.slice(0, 25),
  });

  res.json({
    ok: true,
    distributor: distributor.name,
    added,
    updated,
    skipped,
    sections,
    withNet,
    withList,
    priceMode,
    learned: !savedProfile, // first time we saw this vendor's layout
    headerRow: headerRow + 1, // 1-based for humans
    headers: headerCells,
    mapping,
    profile,
    changes,
    totalForDistributor: mine.length,
    totalCatalog: nextStore.items.length,
    updatedAt: nextStore.updatedAt,
  });
});

// Per-vendor change feed — recent imports with movers + format drift (and a global view).
app.get('/api/distributors/:id/changes', (req, res) => {
  const distributor = DISTRIBUTORS.find(d => d.id === req.params.id);
  if (!distributor) return res.status(404).json({ error: 'Unknown distributor' });
  res.json({ distributor: distributor.id, events: readChangeLog()[distributor.id] || [] });
});

// Availability — parts that can't be sold (discontinued / not in latest list). Consumed by the
// Nexus sales dashboard so reps don't quote something that isn't available. ?id= filters a vendor.
app.get('/api/availability', (req, res) => {
  const store = readCatalogStore();
  const id = String(req.query.id || '').trim();
  const items = store.items.filter(it => (!id || it.distributorId === id));
  const unavailable = items.filter(it => it.available === false).map(it => ({
    distributorId: it.distributorId, distributor: it.distributor,
    part: it.addisonPart || it.id, description: it.description,
    availability: it.availability || 'discontinued', missingSince: it.missingSince || null,
    missedImports: it.missedImports || 0, lastPrice: it.price ?? it.netPrice ?? it.listPrice ?? null,
  }));
  const total = items.length;
  const available = items.filter(it => it.available !== false).length;
  res.json({ updatedAt: store.updatedAt, total, available, unavailable });
});
app.get('/api/changes', (req, res) => {
  const all = readChangeLog();
  const flat = [];
  for (const [distId, events] of Object.entries(all)) for (const e of (events || [])) flat.push({ distributorId: distId, ...e });
  flat.sort((a, b) => (a.at < b.at ? 1 : -1));
  res.json({ events: flat.slice(0, 100) });
});

// View / set / forget a distributor's saved import format profile (admin correction surface).
app.get('/api/distributors/:id/import-profile', (req, res) => {
  const distributor = DISTRIBUTORS.find(d => d.id === req.params.id);
  if (!distributor) return res.status(404).json({ error: 'Unknown distributor' });
  res.json({ distributor: distributor.id, profile: readImportProfiles()[distributor.id] || null });
});
app.put('/api/distributors/:id/import-profile', (req, res) => {
  const distributor = DISTRIBUTORS.find(d => d.id === req.params.id);
  if (!distributor) return res.status(404).json({ error: 'Unknown distributor' });
  const existing = readImportProfiles()[distributor.id] || {};
  const columns = (req.body?.columns && typeof req.body.columns === 'object') ? req.body.columns : existing.columns || {};
  const priceMode = (req.body?.priceMode === 'net' || req.body?.priceMode === 'list') ? req.body.priceMode : existing.priceMode || 'list';
  const headerRow = Number.isInteger(req.body?.headerRow) ? req.body.headerRow : existing.headerRow ?? 0;
  res.json({ ok: true, profile: writeImportProfile(distributor.id, { headerRow, columns, priceMode }) });
});
app.delete('/api/distributors/:id/import-profile', (req, res) => {
  const distributor = DISTRIBUTORS.find(d => d.id === req.params.id);
  if (!distributor) return res.status(404).json({ error: 'Unknown distributor' });
  const all = readImportProfiles();
  delete all[distributor.id];
  writeFileSync(IMPORT_PROFILES_FILE, JSON.stringify(all, null, 2));
  res.json({ ok: true });
});

app.post('/api/distributors/:id/refresh', async (req, res) => {
  const distributor = DISTRIBUTORS.find(d => d.id === req.params.id);
  if (!distributor) return res.status(404).json({ error: 'Unknown distributor' });

  try {
    const result = await scrapeDistributor(distributor, req.body || {});
    const scraped = result.items;
    const store = readCatalogStore();
    const otherItems = store.items.filter(item => item.distributorId !== distributor.id);
    const nextStore = writeCatalogStore([...otherItems, ...scraped]);
    res.json({
      distributor: distributor.id,
      refreshedAt: nextStore.updatedAt,
      count: scraped.length,
      totalCount: nextStore.items.length,
      errors: result.errors || [],
    });
  } catch (err) {
    console.error('Distributor refresh error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/distributors/refresh-automatics-and-more', async (_req, res) => {
  const targets = DISTRIBUTORS.filter(d => d.type === 'automatics-and-more-category');
  const allItems = [];
  const errors = [];
  const summaries = [];
  const concurrency = 3;

  try {
    for (let i = 0; i < targets.length; i += concurrency) {
      const batch = targets.slice(i, i + concurrency);
      const results = await Promise.allSettled(batch.map(distributor => scrapeAutomaticsAndMoreCategory(distributor)));
      results.forEach((result, index) => {
        const distributor = batch[index];
        if (result.status === 'fulfilled') {
          allItems.push(...result.value.items);
          errors.push(...result.value.errors);
          summaries.push({ distributor: distributor.id, count: result.value.items.length });
        } else {
          const error = result.reason?.message || String(result.reason);
          errors.push({ distributor: distributor.id, error });
          summaries.push({ distributor: distributor.id, count: 0, error });
        }
      });
    }

    const targetIds = new Set(targets.map(d => d.id));
    const store = readCatalogStore();
    const otherItems = store.items.filter(item => !targetIds.has(item.distributorId));
    const nextStore = writeCatalogStore([...otherItems, ...allItems]);
    res.json({
      refreshedAt: nextStore.updatedAt,
      count: allItems.length,
      totalCount: nextStore.items.length,
      summaries,
      errors,
    });
  } catch (err) {
    console.error('Automatics & More refresh error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/distributors/refresh-connected', async (_req, res) => {
  const targets = DISTRIBUTORS.filter(distributor =>
    distributor.enabled &&
    (distributor.id === 'addison' || distributor.type === 'automatics-and-more-category' || isPublicSiteConnected(distributor))
  );
  const allItems = [];
  const errors = [];
  const summaries = [];
  const concurrency = 3;

  try {
    for (let i = 0; i < targets.length; i += concurrency) {
      const batch = targets.slice(i, i + concurrency);
      const results = await Promise.allSettled(batch.map(distributor => scrapeDistributor(distributor)));
      results.forEach((result, index) => {
        const distributor = batch[index];
        if (result.status === 'fulfilled') {
          allItems.push(...result.value.items);
          errors.push(...result.value.errors);
          summaries.push({ distributor: distributor.id, count: result.value.items.length });
        } else {
          const error = result.reason?.message || String(result.reason);
          errors.push({ distributor: distributor.id, error });
          summaries.push({ distributor: distributor.id, count: 0, error });
        }
      });
    }

    const targetIds = new Set(targets.map(d => d.id));
    const store = readCatalogStore();
    const otherItems = store.items.filter(item => !targetIds.has(item.distributorId));
    const nextStore = writeCatalogStore([...otherItems, ...allItems]);
    res.json({
      refreshedAt: nextStore.updatedAt,
      count: allItems.length,
      totalCount: nextStore.items.length,
      summaries,
      errors,
    });
  } catch (err) {
    console.error('Connected distributor refresh error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function isBigQueryConfigured() {
  return Boolean(
    process.env.BIGQUERY_PROJECT &&
    process.env.BIGQUERY_DATASET &&
    process.env.BIGQUERY_TABLE
  );
}

function getBigQueryColumn(name, fallback) {
  return process.env[`BIGQUERY_${name}_COLUMN`] || fallback;
}

function safeIdentifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value || '')) {
    throw new Error(`Invalid BigQuery identifier: ${value}`);
  }
  return value;
}

function safeTablePath() {
  const project = process.env.BIGQUERY_PROJECT;
  const dataset = process.env.BIGQUERY_DATASET;
  const table = process.env.BIGQUERY_TABLE;
  for (const part of [project, dataset, table]) {
    if (!/^[A-Za-z0-9_-]+$/.test(part || '')) {
      throw new Error(`Invalid BigQuery table path segment: ${part}`);
    }
  }
  return `\`${project}.${dataset}.${table}\``;
}

async function searchBigQueryParts(searchTerm, condition) {
  if (!isBigQueryConfigured()) return [];

  const { BigQuery } = await import('@google-cloud/bigquery');
  const bigquery = new BigQuery({
    projectId: process.env.BIGQUERY_PROJECT,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });

  const titleColumn = safeIdentifier(getBigQueryColumn('TITLE', 'title'));
  const sourceColumn = safeIdentifier(getBigQueryColumn('SOURCE', 'source'));
  const priceColumn = safeIdentifier(getBigQueryColumn('PRICE', 'price'));
  const shippingColumn = safeIdentifier(getBigQueryColumn('SHIPPING', 'shipping'));
  const conditionColumn = safeIdentifier(getBigQueryColumn('CONDITION', 'condition'));
  const linkColumn = safeIdentifier(getBigQueryColumn('LINK', 'link'));
  const thumbnailColumn = safeIdentifier(getBigQueryColumn('THUMBNAIL', 'thumbnail'));
  const searchColumn = safeIdentifier(getBigQueryColumn('SEARCH', 'search_text'));

  const conditionFilter = condition && condition !== 'Any'
    ? `AND LOWER(CAST(${conditionColumn} AS STRING)) = LOWER(@condition)`
    : '';

  const sql = `
    SELECT
      CAST(${titleColumn} AS STRING) AS title,
      CAST(${sourceColumn} AS STRING) AS source,
      SAFE_CAST(${priceColumn} AS FLOAT64) AS price,
      SAFE_CAST(${shippingColumn} AS FLOAT64) AS shipping,
      CAST(${conditionColumn} AS STRING) AS condition,
      CAST(${linkColumn} AS STRING) AS link,
      CAST(${thumbnailColumn} AS STRING) AS thumbnail
    FROM ${safeTablePath()}
    WHERE LOWER(CAST(${searchColumn} AS STRING)) LIKE CONCAT('%', LOWER(@q), '%')
    ${conditionFilter}
    ORDER BY price ASC
    LIMIT 50
  `;

  const [rows] = await bigquery.query({
    query: sql,
    params: {
      q: searchTerm,
      ...(condition && condition !== 'Any' ? { condition } : {}),
    },
  });

  return rows.map((item, index) => ({
    id: `bigquery-${index}`,
    title: item.title || 'Untitled part',
    source: item.source || 'BigQuery Inventory',
    price: Number(item.price) || 0,
    shipping: Number(item.shipping) || 0,
    condition: (item.condition || 'unknown').toString().toLowerCase(),
    link: item.link || '#',
    thumbnail: item.thumbnail || null,
    via: 'bigquery',
  }));
}

// ── Apify scrapers ───────────────────────────────────────────────────────────
// Runs an Apify Actor (web scraper) and maps its dataset items into the same
// result shape the UI expects. This powers the "scrape" sources (McMaster-Carr,
// Parts Town, Grainger, …) that sources.json declares but this server didn't
// implement on its own. No token = graceful no-op, exactly like BigQuery above.
function isApifyConfigured() {
  return Boolean(process.env.APIFY_TOKEN);
}

// First present value across a list of likely key names (actors vary).
function firstKey(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function parseMoney(v) {
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

async function searchApify(searchTerm) {
  if (!isApifyConfigured()) return [];

  // Actor id (default Google Shopping Scraper). Slash → ~ for the REST path.
  const actor = (process.env.APIFY_ACTOR || 'apify/google-shopping-scraper').replace('/', '~');
  // Actors take different input keys — keep it configurable. Default actor
  // wants { queries: "<term>" }.
  const queryKey = process.env.APIFY_QUERY_KEY || 'queries';
  const extraInput = process.env.APIFY_INPUT_JSON ? JSON.parse(process.env.APIFY_INPUT_JSON) : {};
  const input = { [queryKey]: searchTerm, maxItems: 20, ...extraInput };

  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(process.env.APIFY_TOKEN)}&timeout=90`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 95000);
  let items = [];
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!r.ok) throw new Error(`Apify ${r.status}: ${(await r.text()).slice(0, 200)}`);
    items = await r.json();
  } finally {
    clearTimeout(timer);
  }
  console.log(`[apify] actor=${actor} returned ${Array.isArray(items) ? items.length : 'non-array'} items`);

  const actorLabel = (process.env.APIFY_ACTOR || 'scraper').split('/').pop();
  return (Array.isArray(items) ? items : []).map((item, index) => {
    // Google Shopping Scraper (burbn) shape: the buyable data lives in `offer`,
    // with product_* fields alongside. Other actors fall through to the
    // generic heuristic below.
    const offer = item.offer || {};
    const photo = Array.isArray(item.product_photos) ? item.product_photos[0] : undefined;
    return {
      id: `apify-${index}`,
      title: firstKey(item, ['title', 'name', 'productName']) || offer.offer_title || item.product_title || 'Untitled part',
      source: firstKey(item, ['source', 'merchant', 'seller', 'sellerName', 'shopName', 'store']) || offer.store_name || `Apify · ${actorLabel}`,
      price: parseMoney(firstKey(item, ['price', 'priceValue', 'salePrice', 'currentPrice']) ?? offer.price),
      shipping: parseMoney(firstKey(item, ['shipping', 'shippingPrice', 'deliveryPrice']) ?? offer.shipping),
      condition: String(firstKey(item, ['condition']) || offer.product_condition || 'new').toLowerCase(),
      // Prefer the real store link from the offer over Google's redirect URL.
      link: offer.offer_page_url || firstKey(item, ['link', 'url', 'productLink', 'productUrl', 'itemUrl']) || item.product_page_url || '#',
      thumbnail: firstKey(item, ['thumbnail', 'image', 'imageUrl', 'imageURL']) || photo ||
        (Array.isArray(item.images) ? item.images[0] : null),
      via: 'apify',
    };
  }).filter(r => r.title !== 'Untitled part' && r.price > 0);
}

app.get('/api/search', async (req, res) => {
  const { q, condition } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  const results = [];

  try {
    const catalogResults = filterCatalogItems(readCatalogStore().items, String(q)).slice(0, 50);
    results.push(...catalogResults.map((item, index) => ({
      id: `catalog-${index}-${item.id}`,
      title: item.description || item.addisonPart,
      source: item.distributor,
      price: Number(item.price) || 0,
      shipping: 0,
      condition: item.condition || 'catalog',
      link: item.link,
      thumbnail: item.thumbnail || null,
      via: 'catalog',
      catalog: item,
    })));
  } catch (err) {
    console.error('Catalog search error:', err.message);
  }

  try {
    const bigQueryResults = await searchBigQueryParts(q, condition);
    results.push(...bigQueryResults);
  } catch (err) {
    console.error('BigQuery search error:', err.message);
  }

  try {
    const apifyResults = await searchApify(q);
    results.push(...apifyResults);
  } catch (err) {
    console.error('Apify search error:', err.message);
  }

  try {
    const params = new URLSearchParams({
      engine: 'google_shopping',
      q: q,
      api_key: process.env.SERPAPI_KEY,
      num: 20,
    });

    if (condition && condition !== 'Any') {
      params.append('tbs', condition === 'Used' ? 'mr:1,avg_rating:100,condition:1' : '');
    }

    const serpRes = await fetch(`https://serpapi.com/search.json?${params}`);
    const serpData = await serpRes.json();

    if (serpData.shopping_results) {
      serpData.shopping_results.forEach(item => {
        results.push({
          id: item.position,
          title: item.title,
          source: item.source || 'Google Shopping',
          price: parseFloat(item.price?.replace(/[^0-9.]/g, '')) || 0,
          shipping: parseFloat(item.shipping?.replace(/[^0-9.]/g, '')) || 0,
          condition: item.second_hand_condition ? 'used' : 'new',
          link: item.link || item.product_link || '#',
          thumbnail: item.thumbnail || null,
          via: 'serpapi'
        });
      });
    }
  } catch (err) {
    console.error('SerpApi error:', err.message);
  }

  results.sort((a, b) => a.price - b.price);
  res.json({ results, count: results.length, query: q });
});

const partfinderServer = app.listen(PORT, '0.0.0.0', () => {
  console.log(`PartFinder server running on port ${PORT}`);
});
// Fail loudly (and clearly) if the port is already taken instead of crashing obscurely.
partfinderServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n✗ PartFinder cannot start: port ${PORT} is already in use.`);
    console.error(`  Find the process with:  lsof -nP -iTCP:${PORT} -sTCP:LISTEN   (mac)`);
    console.error(`                          netstat -ano | findstr :${PORT}        (windows)`);
    console.error(`  Stop it, or change PORT in .env, then restart.\n`);
  } else {
    console.error(`✗ PartFinder failed to bind port ${PORT}:`, err.message);
  }
  process.exit(1);
});
