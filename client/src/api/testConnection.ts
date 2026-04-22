import {axiosInstance} from './axiosInstance';

export const testConnection = async () => {
  const urls = [
    'http://10.0.2.2:8082/api/debug/count',
    'http://localhost:8082/api/debug/count',
    'http://127.0.0.1:8082/api/debug/count',
  ];

  console.log('--- STARTING DIAGNOSTIC TEST ---');
  
  // 1. Test raw fetch
  for (const url of urls) {
    try {
      console.log(`[RAW FETCH] Testing ${url}...`);
      const response = await fetch(url);
      const data = await response.json();
      console.log(`✅ RAW FETCH SUCCESS [${url}]:`, data);
    } catch (err: any) {
      console.log(`❌ RAW FETCH FAIL [${url}]:`, err.message);
    }
  }

  // 2. Test our axiosInstance (which is now fetch-based)
  try {
    console.log(`[AXIOS INSTANCE] Testing /api/debug/count...`);
    const res = await axiosInstance.get('/api/debug/count');
    console.log(`✅ AXIOS INSTANCE SUCCESS:`, res.data);
  } catch (err: any) {
    const msg = err.response?.data?.message || err.message || 'Unknown Error';
    console.log(`❌ AXIOS INSTANCE FAIL:`, msg);
  }
  
  console.log('--- DIAGNOSTIC TEST FINISHED ---');
};
