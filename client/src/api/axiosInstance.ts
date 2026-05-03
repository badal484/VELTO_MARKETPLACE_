import {tokenStore} from './tokenStore';

const DEV_URL = 'http://192.168.0.143:8082';
const PROD_URL = 'https://velto-marketplace.onrender.com';

export const BASE_URL = PROD_URL; // Standalone production build for any device access

type LogoutHandler = () => void;
let _logoutHandler: LogoutHandler | null = null;
let _verifyingSession = false;

export const setLogoutHandler = (handler: LogoutHandler) => {
  _logoutHandler = handler;
};

// When any request returns 401, verify the session before logging out.
// This prevents background polling failures from kicking out a valid session.
const handleUnauthorized = async (triggerUrl: string) => {
  if (!_logoutHandler || _verifyingSession || triggerUrl === '/api/auth/me') {
    // If it's /api/auth/me itself that 401'd, logout immediately
    if (triggerUrl === '/api/auth/me') {
      tokenStore.clear();
      _logoutHandler?.();
    }
    return;
  }
  _verifyingSession = true;
  try {
    const token = tokenStore.get();
    if (!token) { _verifyingSession = false; return; }
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token.trim()}`,
      },
    });
    if (res.status === 401) {
      tokenStore.clear();
      _logoutHandler?.();
    }
  } catch {
    // network error — don't logout
  } finally {
    _verifyingSession = false;
  }
};

export const axiosInstance = {
  get: async (url: string, config?: any) => {
    let token = tokenStore.get();
    const headers: any = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(config?.headers || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }

    console.log(`[FETCH] GET ${BASE_URL}${url}`);
    try {
      const response = await fetch(`${BASE_URL}${url}`, {
        method: 'GET',
        headers,
      });
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.log(`[FETCH] JSON PARSE ERROR [${url}]:`, text.substring(0, 100));
        throw new Error('Invalid JSON response from server');
      }

      if (!response.ok) {
        if (response.status === 401) handleUnauthorized(url);
        const error: any = new Error(data?.message || `Request failed with status ${response.status}`);
        error.response = { data, status: response.status };
        error.status = response.status;
        throw error;
      }

      console.log(`[FETCH] SUCCESS: ${url} (Status: ${response.status})`);
      return { data };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Unknown error';
      console.log(`[FETCH] ERROR: ${url} ->`, msg);
      throw err;
    }
  },
  post: async (url: string, body?: any, config?: any) => {
    let token = tokenStore.get();
    const isFormData = body instanceof FormData;
    const headers: any = {
      'Accept': 'application/json',
      ...(isFormData ? {} : {'Content-Type': 'application/json'}),
      ...(config?.headers || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }

    // CRITICAL: For FormData, we MUST NOT set Content-Type manually,
    // as fetch needs to append the boundary parameter.
    if (isFormData && headers['Content-Type']) {
      delete headers['Content-Type'];
    }

    console.log(`[FETCH] POST ${BASE_URL}${url}`);
    try {
      const response = await fetch(`${BASE_URL}${url}`, {
        method: 'POST',
        headers,
        body: isFormData ? body : JSON.stringify(body),
      });
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid JSON response from server');
      }

      if (!response.ok) {
        if (response.status === 401) handleUnauthorized(url);
        const error: any = new Error(data?.message || `Request failed with status ${response.status}`);
        error.response = { data, status: response.status };
        error.status = response.status;
        throw error;
      }

      console.log(`[FETCH] SUCCESS: ${url} (Status: ${response.status})`);
      return { data };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Unknown error';
      console.log(`[FETCH] ERROR: ${url} ->`, msg);
      throw err;
    }
  },
  patch: async (url: string, body?: any, config?: any) => {
    let token = tokenStore.get();
    const isFormData = body instanceof FormData;
    const headers: any = {
      'Accept': 'application/json',
      ...(isFormData ? {} : {'Content-Type': 'application/json'}),
      ...(config?.headers || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }

    if (isFormData && headers['Content-Type']) {
      delete headers['Content-Type'];
    }
    
    try {
      const response = await fetch(`${BASE_URL}${url}`, {
        method: 'PATCH',
        headers: isFormData ? { ...headers } : { ...headers, 'Content-Type': 'application/json' },
        body: isFormData ? body : JSON.stringify(body),
      });
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid JSON response from server');
      }

      if (!response.ok) {
        if (response.status === 401) handleUnauthorized(url);
        const error: any = new Error(data?.message || `Request failed with status ${response.status}`);
        error.response = { data, status: response.status };
        error.status = response.status;
        throw error;
      }

      return { data };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Unknown error';
      console.log(`[FETCH] ERROR: ${url} ->`, msg);
      throw err;
    }
  },
  delete: async (url: string, config?: any) => {
    let token = tokenStore.get();
    const headers: any = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(config?.headers || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }

    try {
      const response = await fetch(`${BASE_URL}${url}`, {
        method: 'DELETE',
        headers,
      });
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid JSON response from server');
      }

      if (!response.ok) {
        if (response.status === 401) handleUnauthorized(url);
        const error: any = new Error(data?.message || `Request failed with status ${response.status}`);
        error.response = { data, status: response.status };
        error.status = response.status;
        throw error;
      }

      return { data };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Unknown error';
      console.log(`[FETCH] ERROR: ${url} ->`, msg);
      throw err;
    }
  },
  put: async (url: string, body?: any, config?: any) => {
    let token = tokenStore.get();
    const isFormData = body instanceof FormData;
    const headers: any = {
      'Accept': 'application/json',
      ...(isFormData ? {} : {'Content-Type': 'application/json'}),
      ...(config?.headers || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }

    if (isFormData && headers['Content-Type']) {
      delete headers['Content-Type'];
    }

    try {
      const response = await fetch(`${BASE_URL}${url}`, {
        method: 'PUT',
        headers: isFormData ? { ...headers } : { ...headers, 'Content-Type': 'application/json' },
        body: isFormData ? body : JSON.stringify(body),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid JSON response from server');
      }

      if (!response.ok) {
        if (response.status === 401) handleUnauthorized(url);
        const error: any = new Error(data?.message || `Request failed with status ${response.status}`);
        error.response = { data, status: response.status };
        error.status = response.status;
        throw error;
      }

      return { data };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Unknown error';
      console.log(`[FETCH] ERROR: ${url} ->`, msg);
      throw err;
    }
  }
};