import axios from 'axios';
import {Platform} from 'react-native';
import {tokenStore} from './tokenStore';

const DEV_IP = '10.20.16.181'; // Your machine IP changed from .193 to .181
const BASE_URL = Platform.OS === 'android' ? `http://${DEV_IP}:5001` : `http://${DEV_IP}:5001`;
// Note: Use http://10.0.2.2:5000 if using a standard Android Emulator on the same machine

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

axiosInstance.interceptors.request.use(config => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});