
import axios from 'axios';

const test = async () => {
  try {
    const res = await axios.get('http://localhost:8082/api/payouts/admin/all', {
      headers: {
        'Authorization': 'Bearer <MANUAL_TOKEN_HERE_IF_NEEDED>' 
      }
    });
    console.log(JSON.stringify(res.data.data[0], null, 2));
  } catch (e) {
    console.error('Test failed');
  }
};
// test();
