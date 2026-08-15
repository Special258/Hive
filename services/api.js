/**
 * Centralized API service for HIVE
 */

class ApiService {
  constructor() {
    this.baseUrl = '/api';
  }

  getHeaders() {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async handleResponse(response) {
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Server returned an invalid response.');
    }

    if (!response.ok) {
      const isAdminPage = /\/admin(?:-|\.html|$)/.test(window.location.pathname);
      if ((response.status === 401 || (response.status === 403 && isAdminPage)) && !window.location.pathname.endsWith('index.html')) {
        // Handle unauthorized globally
        if (response.status === 401) localStorage.removeItem('hiveUser');
        window.location.href = response.status === 403 ? 'dashboard.html' : 'index.html';
      }
      throw new Error(data.error || 'An unexpected error occurred.');
    }

    return data;
  }

  async get(endpoint) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async post(endpoint, body) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse(response);
  }

  async put(endpoint, body) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse(response);
  }

  async delete(endpoint) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }
}

export const api = new ApiService();
