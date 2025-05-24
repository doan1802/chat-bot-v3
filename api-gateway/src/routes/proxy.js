const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { verifyToken } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

// Proxy middleware options for user service
const userServiceProxy = createProxyMiddleware({
  target: process.env.USER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/user-service': '/api', // rewrite path
  },
  // Tăng timeout để xử lý các request lâu hơn
  proxyTimeout: 30000, // 30 giây
  // Tối ưu hóa buffer để tăng hiệu suất
  buffer: {
    enabled: true,
    maxBodySize: 10 * 1024 * 1024, // 10MB
  },
  onProxyReq: (_proxyReq, req, _res) => {
    // Luôn ghi lại thời gian bắt đầu để tính thời gian xử lý
    req.startTime = Date.now();

    // Chỉ log trong môi trường phát triển và không phải OPTIONS hoặc health check
    if (process.env.NODE_ENV === 'development' &&
        req.method !== 'OPTIONS' &&
        !req.originalUrl.includes('/health')) {
      console.log(`[${new Date().toISOString()}] Proxying request to user service: ${req.method} ${req.originalUrl}`);
    }
  },
  onProxyRes: (proxyRes, req, _res) => {
    // Tính thời gian xử lý
    const duration = Date.now() - (req.startTime || Date.now());

    // Chỉ log các response chậm (> 1000ms) hoặc lỗi
    if (duration > 1000 || proxyRes.statusCode >= 400) {
      console.log(`[${new Date().toISOString()}] Response from user service: ${proxyRes.statusCode} (${duration}ms) for ${req.method} ${req.originalUrl}`);
    }
    // Trong môi trường phát triển, log thêm các request không phải OPTIONS và health check
    else if (process.env.NODE_ENV === 'development' &&
             req.method !== 'OPTIONS' &&
             !req.originalUrl.includes('/health')) {
      console.log(`[${new Date().toISOString()}] Response from user service: ${proxyRes.statusCode} (${duration}ms) for ${req.method} ${req.originalUrl}`);
    }
  },
  onError: (err, req, res) => {
    console.error(`[${new Date().toISOString()}] Proxy error: ${err.message} for ${req.method} ${req.originalUrl}`);
    res.status(500).json({ error: 'Proxy error', message: err.message });
  }
});

// Proxy middleware options for chat service
const chatServiceProxy = createProxyMiddleware({
  target: process.env.CHAT_SERVICE_URL || 'http://localhost:3004',
  changeOrigin: true,
  pathRewrite: {
    '^/api/chat-service': '/api', // rewrite path
  },
  // Tăng timeout để xử lý các request lâu hơn, đặc biệt là gọi Gemini API
  proxyTimeout: 60000, // 60 giây
  // Tối ưu hóa buffer để tăng hiệu suất
  buffer: {
    enabled: true,
    maxBodySize: 10 * 1024 * 1024, // 10MB
  },
  onProxyReq: (_proxyReq, req, _res) => {
    // Luôn ghi lại thời gian bắt đầu để tính thời gian xử lý
    req.startTime = Date.now();

    // Chỉ log trong môi trường phát triển và không phải OPTIONS hoặc health check
    if (process.env.NODE_ENV === 'development' &&
        req.method !== 'OPTIONS' &&
        !req.originalUrl.includes('/health')) {
      console.log(`[${new Date().toISOString()}] Proxying request to chat service: ${req.method} ${req.originalUrl}`);
    }
  },
  onProxyRes: (proxyRes, req, _res) => {
    // Tính thời gian xử lý
    const duration = Date.now() - (req.startTime || Date.now());

    // Chỉ log các response chậm (> 1000ms) hoặc lỗi
    if (duration > 1000 || proxyRes.statusCode >= 400) {
      console.log(`[${new Date().toISOString()}] Response from chat service: ${proxyRes.statusCode} (${duration}ms) for ${req.method} ${req.originalUrl}`);
    }
    // Trong môi trường phát triển, log thêm các request không phải OPTIONS và health check
    else if (process.env.NODE_ENV === 'development' &&
             req.method !== 'OPTIONS' &&
             !req.originalUrl.includes('/health')) {
      console.log(`[${new Date().toISOString()}] Response from chat service: ${proxyRes.statusCode} (${duration}ms) for ${req.method} ${req.originalUrl}`);
    }
  },
  onError: (err, req, res) => {
    console.error(`[${new Date().toISOString()}] Proxy error: ${err.message} for ${req.method} ${req.originalUrl}`);
    res.status(500).json({ error: 'Proxy error', message: err.message });
  }
});

// Proxy middleware options for voice service
const voiceServiceProxy = createProxyMiddleware({
  target: process.env.VOICE_SERVICE_URL || 'http://localhost:3005',
  changeOrigin: true,
  pathRewrite: function (path, req) {
    console.log('Original path:', path);
    // Lấy phần path sau /api/voice-service/voice
    const newPath = '/api/voice' + path.replace(/^\/api\/voice-service\/voice/, '');
    console.log('Rewritten path:', newPath);
    return newPath;
  },
  // Tăng timeout để xử lý các request lâu hơn
  proxyTimeout: 10000, // 10 giây
  timeout: 10000, // 10 giây
  onProxyReq: (_proxyReq, req, _res) => {
    // Luôn ghi lại thời gian bắt đầu để tính thời gian xử lý
    req.startTime = Date.now();

    // Chỉ log trong môi trường phát triển và không phải OPTIONS hoặc health check
    if (process.env.NODE_ENV === 'development' &&
        req.method !== 'OPTIONS' &&
        !req.originalUrl.includes('/health')) {
      console.log(`[${new Date().toISOString()}] Proxying request to voice service: ${req.method} ${req.originalUrl}`);
    }
  },
  onError: (err, req, res) => {
    console.error(`[${new Date().toISOString()}] Voice service proxy error: ${err.message} for ${req.method} ${req.originalUrl}`);
    res.status(500).json({ error: 'Voice service proxy error', message: err.message });
  },
  onProxyRes: (proxyRes, req, _res) => {
    // Tính thời gian xử lý
    const duration = Date.now() - (req.startTime || Date.now());

    // Chỉ log các response chậm (> 1000ms) hoặc lỗi
    if (duration > 1000 || proxyRes.statusCode >= 400) {
      console.log(`[${new Date().toISOString()}] Response from voice service: ${proxyRes.statusCode} (${duration}ms) for ${req.method} ${req.originalUrl}`);
    }
    // Trong môi trường phát triển, log thêm các request không phải OPTIONS và health check
    else if (process.env.NODE_ENV === 'development' &&
             req.method !== 'OPTIONS' &&
             !req.originalUrl.includes('/health')) {
      console.log(`[${new Date().toISOString()}] Response from voice service: ${proxyRes.statusCode} (${duration}ms) for ${req.method} ${req.originalUrl}`);
    }
  },
  onError: (err, req, res) => {
    console.error(`[${new Date().toISOString()}] Proxy error: ${err.message} for ${req.method} ${req.originalUrl}`);
    res.status(500).json({ error: 'Proxy error', message: err.message });
  }
});

// Public routes (không yêu cầu xác thực)
router.use('/api/user-service/auth', userServiceProxy);

// Protected routes (yêu cầu xác thực)
router.use('/api/user-service/users', verifyToken, userServiceProxy);
router.use('/api/user-service/settings', verifyToken, userServiceProxy);

// Chat service routes (yêu cầu xác thực)
router.use('/api/chat-service/chats', verifyToken, chatServiceProxy);

// Voice service routes (yêu cầu xác thực)
router.use('/api/voice-service/voice', verifyToken, (req, res) => {
  console.log('Full path:', req.originalUrl);
  console.log('Path:', req.path);
  console.log('Base URL:', req.baseUrl);

  // Lấy phần path sau /api/voice-service/voice
  const newPath = '/api/voice' + req.path;
  console.log('Rewritten path:', newPath);

  // Tạo URL mới
  const targetUrl = `${process.env.VOICE_SERVICE_URL || 'http://localhost:3005'}${newPath}`;
  console.log('Target URL:', targetUrl);

  // Chuyển tiếp yêu cầu bằng axios
  const axios = require('axios');

  // Tạo headers mới
  const headers = { ...req.headers };
  delete headers.host; // Xóa header host để tránh xung đột

  // Tạo config cho axios
  const config = {
    method: req.method,
    url: targetUrl,
    headers: headers,
    data: req.body,
    timeout: 10000, // 10 giây
  };

  // Gọi API
  axios(config)
    .then(response => {
      // Trả về response
      res.status(response.status).json(response.data);
    })
    .catch(error => {
      console.error(`[${new Date().toISOString()}] Voice service error:`, error.message);
      if (error.response) {
        // Lỗi từ server
        res.status(error.response.status).json(error.response.data);
      } else if (error.request) {
        // Không nhận được response
        res.status(500).json({ error: 'No response from voice service', message: error.message });
      } else {
        // Lỗi khác
        res.status(500).json({ error: 'Voice service error', message: error.message });
      }
    });
});

// Log để debug
console.log('Voice service proxy configured with target:', process.env.VOICE_SERVICE_URL || 'http://localhost:3005');

module.exports = router;
