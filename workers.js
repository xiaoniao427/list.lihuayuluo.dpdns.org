export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/upload' && request.method === 'POST') {
      return handleUpload(request, env);
    } else if (path === '/ban-check' && request.method === 'GET') {
      return handleBanCheck(request, env);
    } else if (path === '/ban-manager' && request.method === 'POST') {
      return handleBanManager(request, env);
    }

    return new Response('Not found', { status: 404 });
  }
};

// 获取客户端真实 IP (优先取 x-real-ip，其次 x-forwarded-for，最后 remote address)
function getClientIP(request) {
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // 如果有多个代理，取第一个 IP
    return forwardedFor.split(',')[0].trim();
  }
  // 回退到连接地址
  return request.headers.get('cf-connecting-ip') || 'unknown';
}

// 处理设备信息上传
async function handleUpload(request, env) {
  try {
    const data = await request.json();

    // 验证时间戳 (±10秒)
    const currentTime = Date.now();
    if (Math.abs(currentTime - data.timestamp) > 10000) {
      return new Response('Invalid timestamp', { status: 403 });
    }

    const deviceId = data.device_id;
    if (!deviceId) {
      return new Response('Missing device_id', { status: 400 });
    }

    // 获取客户端真实 IP
    const clientIp = getClientIP(request);

    // 存储到KV: 键为 device_id，值为 { ip, device_id, last_updated }
    const deviceData = {
      device_id: deviceId,
      ip: clientIp,
      last_updated: currentTime
    };

    await env.DEVICE_INFO.put(deviceId, JSON.stringify(deviceData));
    return new Response('OK');
  } catch (e) {
    return new Response('Error processing request', { status: 500 });
  }
}

// 处理黑名单检查（不变）
async function handleBanCheck(request, env) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get('device_id');

  if (!deviceId) {
    return new Response('Missing device_id', { status: 400 });
  }

  const banned = await env.BAN_LIST.get(deviceId);
  return banned
    ? new Response('banned')
    : new Response('allowed');
}

// 处理黑名单管理（不变）
async function handleBanManager(request, env) {
  try {
    const { action, device_id, auth_key } = await request.json();

    const adminKey = env.ADMIN_AUTH_KEY;
    if (!adminKey || auth_key !== adminKey) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (action === 'ban') {
      await env.BAN_LIST.put(device_id, 'banned');
      return new Response('Banned');
    } else if (action === 'unban') {
      await env.BAN_LIST.delete(device_id);
      return new Response('Unbanned');
    } else {
      return new Response('Invalid action', { status: 400 });
    }
  } catch (e) {
    return new Response('Error processing request', { status: 500 });
  }
}
