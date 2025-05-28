// API Configuration for both local and production environments
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000' 
  : `https://${window.location.hostname}`;

window.API_CONFIG = { API_BASE_URL };