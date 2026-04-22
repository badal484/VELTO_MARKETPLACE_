const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api/products';

async function test(params, label) {
  try {
    console.log(`Testing ${label}...`);
    const res = await axios.get(BASE_URL, { params });
    console.log(`  Result: SUCCESS (${res.data.data.length} products)`);
  } catch (err) {
    console.log(`  Result: FAILED (${err.response?.status})`);
    console.log(`  Error: ${err.response?.data?.message || err.message}`);
    if (err.response?.data?.debug) {
      console.log(`  Stack: ${err.response.data.debug.split('\n')[0]}`);
    }
  }
}

async function runTests() {
  await test({ lat: 12.9716, lng: 77.5946, radius: 20 }, 'Standard Search');
  await test({ lat: 12.9716, lng: 77.5946, radius: 20, search: 'mobile' }, 'Text Search');
  await test({ lat: 12.9716, lng: 77.5946, radius: 20, category: 'Electronics' }, 'Category Search');
  await test({ lat: 12.9716, lng: 77.5946, radius: 20, minPrice: 0, maxPrice: 50000 }, 'Price Search');
  await test({ lat: 'abc', lng: 'def' }, 'Invalid Coordinates');
}

runTests();