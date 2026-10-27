import type { User, AuthResponse } from '../types';
import { ApiError } from './api';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

export async function signup(data: {
  full_name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
  } catch {
    throw new ApiError(0, 'Unable to connect to the authentication server. Please check your network connection.');
  }

  if (!response.ok) {
    let errorDetail = 'Signup failed';
    try {
      const errData = await response.json();
      errorDetail = errData.detail || errorDetail;
    } catch {
      errorDetail = await response.text();
    }
    throw new ApiError(response.status, errorDetail);
  }

  return response.json();
}

export async function login(data: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
  } catch {
    throw new ApiError(0, 'Unable to connect to the authentication server. Please check your network connection.');
  }

  if (!response.ok) {
    let errorDetail = 'Login failed';
    try {
      const errData = await response.json();
      errorDetail = errData.detail || errorDetail;
    } catch {
      errorDetail = await response.text();
    }
    throw new ApiError(response.status, errorDetail);
  }

  return response.json();
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // Ignore network error on logout to allow local state cleanup
  }
}

export async function getMe(): Promise<User> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      credentials: 'include',
    });
  } catch {
    throw new ApiError(0, 'Unable to connect to the authentication server.');
  }

  if (!response.ok) {
    let errorDetail = 'Not authenticated';
    try {
      const errData = await response.json();
      errorDetail = errData.detail || errorDetail;
    } catch {
      errorDetail = await response.text();
    }
    throw new ApiError(response.status, errorDetail);
  }

  return response.json();
}

export async function updateProfile(data: { full_name: string }): Promise<User> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
  } catch {
    throw new ApiError(0, 'Unable to connect to server.');
  }

  if (!response.ok) {
    let errorDetail = 'Failed to update profile';
    try {
      const errData = await response.json();
      errorDetail = errData.detail || errorDetail;
    } catch {
      errorDetail = await response.text();
    }
    throw new ApiError(response.status, errorDetail);
  }

  return response.json();
}

export async function changePassword(data: {
  current_password: string;
  new_password: string;
}): Promise<{ message: string }> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
  } catch {
    throw new ApiError(0, 'Unable to connect to server.');
  }

  if (!response.ok) {
    let errorDetail = 'Failed to change password';
    try {
      const errData = await response.json();
      errorDetail = errData.detail || errorDetail;
    } catch {
      errorDetail = await response.text();
    }
    throw new ApiError(response.status, errorDetail);
  }

  return response.json();
}
