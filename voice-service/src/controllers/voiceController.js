require('dotenv').config();
const fetch = require('node-fetch');

// Lấy thông tin cấu hình VAPI
const getVapiConfig = async (req, res) => {
  try {
    const userId = req.user.id;

    // Lấy thông tin client instance từ header nếu có
    const clientInstance = req.headers['x-client-instance'] || 'unknown-client';

    // Chỉ log trong môi trường phát triển
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Client: ${clientInstance}] Getting VAPI config for user: ${userId}`);
    }

    // Lấy thông tin cài đặt của người dùng từ user-service
    const userSettings = await getUserSettings(userId, req.headers.authorization);

    // Kiểm tra xem người dùng có cài đặt VAPI API key không
    const vapiApiKey = userSettings?.vapi_api_key || process.env.VAPI_API_KEY;

    if (!vapiApiKey) {
      return res.status(400).json({
        error: 'VAPI API key not configured',
        message: 'Please configure your VAPI API key in settings'
      });
    }

    // Trả về cấu hình VAPI
    return res.status(200).json({
      config: {
        apiKey: vapiApiKey,
        language: userSettings?.language || 'vi'
      }
    });
  } catch (error) {
    console.error(`Error getting VAPI config: ${error.message}`);
    return res.status(500).json({ error: 'Failed to get VAPI config' });
  }
};

// Lấy VAPI Web Token cho frontend
const getVapiWebToken = async (req, res) => {
  try {
    const userId = req.user.id;

    // Lấy thông tin client instance từ header nếu có
    const clientInstance = req.headers['x-client-instance'] || 'unknown-client';

    // Chỉ log trong môi trường phát triển
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Client: ${clientInstance}] Getting VAPI Web Token for user: ${userId}`);
    }

    // Lấy thông tin cài đặt của người dùng từ user-service
    const userSettings = await getUserSettings(userId, req.headers.authorization);

    // Sử dụng token từ cài đặt người dùng hoặc từ biến môi trường
    const vapiWebToken = userSettings?.vapi_web_token || process.env.VAPI_WEB_TOKEN;

    if (!vapiWebToken) {
      return res.status(400).json({
        error: 'VAPI Web Token not configured',
        message: 'Please configure your VAPI Web Token in settings'
      });
    }

    // Định nghĩa assistant
    const assistant = {
      name: "Trợ lý Serna",
      firstMessage: "Xin chào! Tôi là trợ lý Serna. Tôi có thể giúp gì cho bạn?",
      transcriber: {
        provider: "google",
        model: "gemini-2.0-flash",
        language: "Multilingual", // Tiếng Việt
      },
      voice: {
        provider: "vapi",
        voiceId: "Cole", // ID giọng nói
        // stability: 0.4,
        // similarityBoost: 0.8,
        // speed: 0.9,
        // style: 0.5,
        // useSpeakerBoost: true,
      },
      model: {
        provider: "google", // Sử dụng provider được hỗ trợ
        model: "gemini-2.0-flash", // Sử dụng model được hỗ trợ
        messages: [
          {
            role: "system",
            content: `Bạn là một trợ lý AI thông minh và thân thiện. Hãy giúp đỡ người dùng một cách tốt nhất.

            Hướng dẫn:
            - Luôn lịch sự và chuyên nghiệp
            - Trả lời ngắn gọn và rõ ràng
            - Đây là cuộc trò chuyện bằng giọng nói, vì vậy hãy giữ câu trả lời ngắn gọn
            - Sử dụng ngôn ngữ tự nhiên, thân thiện
            - Giao tiếp bằng tiếng Việt`,
          },
        ],
      },
      clientMessages: [],
      serverMessages: []
    };

    // Trả về token và cấu hình assistant
    return res.status(200).json({
      token: vapiWebToken,
      assistant: assistant
    });
  } catch (error) {
    console.error(`Error getting VAPI Web Token: ${error.message}`);
    return res.status(500).json({ error: 'Failed to get VAPI Web Token' });
  }
};

// Tạo cuộc gọi mới
const createCall = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title } = req.body;

    // Lấy thông tin client instance từ header nếu có
    const clientInstance = req.headers['x-client-instance'] || 'unknown-client';

    // Chỉ log trong môi trường phát triển
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Client: ${clientInstance}] Creating new call for user: ${userId} with title: ${title || 'New Call'}`);
    }

    // Tạo ID cho cuộc gọi mới
    const callId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Tạo đối tượng cuộc gọi mới
    const newCall = {
      id: callId,
      user_id: userId,
      title: title || 'New Call',
      status: 'created',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Lưu cuộc gọi vào cache
    const callCache = req.app.locals.callCache;
    const userCallsKey = `calls_${userId}`;

    if (callCache.has(userCallsKey)) {
      const userCalls = callCache.get(userCallsKey);
      callCache.set(userCallsKey, [newCall, ...userCalls]);
    } else {
      callCache.set(userCallsKey, [newCall]);
    }

    // Lưu thông tin phiên gọi
    const activeCalls = req.app.locals.activeCalls;
    activeCalls.set(callId, {
      userId,
      clientInstance,
      lastActivity: Date.now(),
      isProcessing: false
    });

    return res.status(201).json({ call: newCall });
  } catch (error) {
    console.error(`Error creating call: ${error.message}`);
    return res.status(500).json({ error: 'Failed to create call' });
  }
};

// Lấy thông tin cuộc gọi
const getCallById = async (req, res) => {
  try {
    const userId = req.user.id;
    const callId = req.params.callId;

    // Lấy thông tin client instance từ header nếu có
    const clientInstance = req.headers['x-client-instance'] || 'unknown-client';

    // Chỉ log trong môi trường phát triển
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Client: ${clientInstance}] Getting call info for user: ${userId}, call: ${callId}`);
    }

    // Lấy thông tin cuộc gọi từ cache
    const callCache = req.app.locals.callCache;
    const userCallsKey = `calls_${userId}`;

    if (callCache.has(userCallsKey)) {
      const userCalls = callCache.get(userCallsKey);
      const call = userCalls.find(c => c.id === callId);

      if (call) {
        return res.status(200).json({ call });
      }
    }

    return res.status(404).json({ error: 'Call not found' });
  } catch (error) {
    console.error(`Error getting call: ${error.message}`);
    return res.status(500).json({ error: 'Failed to get call' });
  }
};

// Cập nhật trạng thái cuộc gọi
const updateCallStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const callId = req.params.callId;
    const { status } = req.body;

    // Lấy thông tin client instance từ header nếu có
    const clientInstance = req.headers['x-client-instance'] || 'unknown-client';

    // Chỉ log trong môi trường phát triển
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Client: ${clientInstance}] Updating call status for user: ${userId}, call: ${callId}, status: ${status}`);
    }

    // Lấy thông tin cuộc gọi từ cache
    const callCache = req.app.locals.callCache;
    const userCallsKey = `calls_${userId}`;

    if (callCache.has(userCallsKey)) {
      const userCalls = callCache.get(userCallsKey);
      const callIndex = userCalls.findIndex(c => c.id === callId);

      if (callIndex !== -1) {
        // Cập nhật trạng thái cuộc gọi
        userCalls[callIndex].status = status;
        userCalls[callIndex].updated_at = new Date().toISOString();

        // Lưu lại vào cache
        callCache.set(userCallsKey, userCalls);

        return res.status(200).json({ call: userCalls[callIndex] });
      }
    }

    return res.status(404).json({ error: 'Call not found' });
  } catch (error) {
    console.error(`Error updating call status: ${error.message}`);
    return res.status(500).json({ error: 'Failed to update call status' });
  }
};

// Kết thúc cuộc gọi
const endCall = async (req, res) => {
  try {
    const userId = req.user.id;
    const callId = req.params.callId;

    // Lấy thông tin client instance từ header nếu có
    const clientInstance = req.headers['x-client-instance'] || 'unknown-client';

    // Chỉ log trong môi trường phát triển
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Client: ${clientInstance}] Ending call for user: ${userId}, call: ${callId}`);
    }

    // Lấy thông tin cuộc gọi từ cache
    const callCache = req.app.locals.callCache;
    const userCallsKey = `calls_${userId}`;

    if (callCache.has(userCallsKey)) {
      const userCalls = callCache.get(userCallsKey);
      const callIndex = userCalls.findIndex(c => c.id === callId);

      if (callIndex !== -1) {
        // Cập nhật trạng thái cuộc gọi
        userCalls[callIndex].status = 'ended';
        userCalls[callIndex].updated_at = new Date().toISOString();
        userCalls[callIndex].ended_at = new Date().toISOString();

        // Lưu lại vào cache
        callCache.set(userCallsKey, userCalls);

        // Xóa khỏi activeCalls
        const activeCalls = req.app.locals.activeCalls;
        activeCalls.delete(callId);

        return res.status(200).json({ call: userCalls[callIndex] });
      }
    }

    return res.status(404).json({ error: 'Call not found' });
  } catch (error) {
    console.error(`Error ending call: ${error.message}`);
    return res.status(500).json({ error: 'Failed to end call' });
  }
};

// Lấy lịch sử cuộc gọi của người dùng
const getCallHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    // Lấy thông tin client instance từ header nếu có
    const clientInstance = req.headers['x-client-instance'] || 'unknown-client';

    // Chỉ log trong môi trường phát triển
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Client: ${clientInstance}] Getting call history for user: ${userId}`);
    }

    // Lấy lịch sử cuộc gọi từ cache
    const callCache = req.app.locals.callCache;
    const userCallsKey = `calls_${userId}`;

    if (callCache.has(userCallsKey)) {
      const userCalls = callCache.get(userCallsKey);
      return res.status(200).json({ calls: userCalls });
    }

    return res.status(200).json({ calls: [] });
  } catch (error) {
    console.error(`Error getting call history: ${error.message}`);
    return res.status(500).json({ error: 'Failed to get call history' });
  }
};

// Hàm helper để lấy thông tin cài đặt của người dùng từ user-service
async function getUserSettings(userId, authHeader) {
  try {
    const userServiceUrl = process.env.USER_SERVICE_URL;

    if (!userServiceUrl) {
      throw new Error('USER_SERVICE_URL not configured');
    }

    const response = await fetch(`${userServiceUrl}/api/settings`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      },
      timeout: 5000
    });

    if (!response.ok) {
      throw new Error(`Failed to get user settings: ${response.status}`);
    }

    const data = await response.json();
    return data.settings;
  } catch (error) {
    console.error(`Error getting user settings: ${error.message}`);
    return null;
  }
}

module.exports = {
  getVapiConfig,
  getVapiWebToken,
  createCall,
  getCallById,
  updateCallStatus,
  endCall,
  getCallHistory
};
