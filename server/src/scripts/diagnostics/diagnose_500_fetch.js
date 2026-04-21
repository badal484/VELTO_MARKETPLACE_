async function test(params, label) {
  try {
    console.log(`Testing ${label}...`);
    const searchParams = new URLSearchParams(params);
    const url = `http://localhost:5000/api/products?${searchParams.toString()}`;
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok) {
        console.log(`  Result: SUCCESS (${data.data.length} products)`);
    } else {
        console.log(`  Result: FAILED (${res.status})`);
        console.log(`  Error: ${data.message || 'Unknown error'}`);
        if (data.debug) {
            console.log(`  Stack: ${data.debug.split('\n')[0]}`);
        }
    }
  } catch (err) {
    console.log(`  Result: FETCH FAILED`);
    console.log(`  Error: ${err.message}`);
  }
}

async function runTests() {
  await test({ lat: 12.9716, lng: 77.5946, radius: 20 }, 'Standard Search (20km)');
  await test({ lat: 12.9716, lng: 77.5946, radius: 100 }, 'Wide Search (100km)');
  await test({ lat: 12.9716, lng: 77.5946, radius: 20, search: 'mobile' }, 'Text Search');
  await test({ lat: 12.9716, lng: 77.5946, radius: 20, category: 'Electronics' }, 'Category Search');
}

runTests();
