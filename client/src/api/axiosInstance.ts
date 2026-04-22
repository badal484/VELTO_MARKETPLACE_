import {Platform} from 'react-native';
import {tokenStore} from './tokenStore';

const BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8082' : 'http://localhost:8082';

export const axiosInstance = {
  get: async (url: string, config?: any) => {
    const token = tokenStore.get();
    const headers: any = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(config?.headers || {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'GET',
      headers,
    });
    
    const data = await response.json();
    if (!response.ok) throw { response: { data, status: response.status } };
    return { data };
  },
  post: async (url: string, body?: any, config?: any) => {
    const token = tokenStore.get();
    const headers: any = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(config?.headers || {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    if (!response.ok) throw { response: { data, status: response.status } };
    return { data };
  },
  patch: async (url: string, body?: any, config?: any) => {
    const token = tokenStore.get();
    const headers: any = {
      'Accept': 'application/json',
      ...(config?.headers || {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Handle FormData if body is FormData
    const isFormData = body instanceof FormData;
    
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'PATCH',
      headers: isFormData ? { ...headers } : { ...headers, 'Content-Type': 'application/json' },
      body: isFormData ? body : JSON.stringify(body),
    });
    
    const data = await response.json();
    if (!response.ok) throw { response: { data, status: response.status } };
    return { data };
  },
  delete: async (url: string, config?: any) => {
    const token = tokenStore.get();
    const headers: any = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(config?.headers || {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'DELETE',
      headers,
    });
    
    const data = await response.json();
    if (!response.ok) throw { response: { data, status: response.status } };
    return { data };
  }
};