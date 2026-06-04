import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

app.get('/api/sources', (req, res) => {
  const data = JSON.parse(readFileSync('./sources.json', 'utf-8'));
  res.json(data.sources);
});

app.get('/api/search', async (req, res) => {
  const { q, condition } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Missing search query' });
  }

  const results = [];

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`PartFinder server running on port ${PORT}`);
});
