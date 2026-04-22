import {Platform} from 'react-native';

export const testConnection = async () => {
  const urls = [
    'http://10.0.2.2:8082/api/debug/count',
    'http://localhost:8082/api/debug/count',
    'http://127.0.0.1:8082/api/debug/count',
    'http://192.168.0.143:8082/api/debug/count'
  ];

  console.log('--- STARTING CONNECTION TEST ---');
  for (const url of urls) {
    try {
      console.log(`Testing ${url}...`);
      const start = Date.now();
      const response = await fetch(url, { method: 'GET', timeout: 3000 } as any);
      const data = await response.json();
      console.log(`✅ SUCCESS [${url}] in ${Date.now() - start}ms:`, data);
    } catch (err: any) {
      console.log(`❌ FAIL [${url}]:`, err.message);
    }
  }
  console.log('--- CONNECTION TEST FINISHED ---');
};
