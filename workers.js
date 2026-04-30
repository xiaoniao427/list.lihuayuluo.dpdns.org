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

// 处理设备信息上传
async function handleUpload(request, env) {
  try {
    const data = await request.json();

    // 验证时间戳 (±10秒)
    const currentTime = Date.now();
    if (Math.abs(currentTime - data.timestamp) > 10000) {
      return new Response('Invalid timestamp', { status: 403 });
    }

    // 确保用户名不为空
    let username = data.username || "UnknownPlayer";

    // 使用 device_id 作为主键，存储用户名和时间戳
    const deviceData = {
      username: username,
      device_id: data.device_id,
      last_updated: currentTime
    };

    // 存储到KV (覆盖旧记录)
    await env.DEVICE_INFO.put(data.device_id, JSON.stringify(deviceData));
    return new Response('OK');
  } catch (e) {
    return new Response('Error processing request', { status: 500 });
  }
}

// 处理黑名单检查
async function handleBanCheck(request, env) {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get('device_id');

  if (!deviceId) {
    return new Response('Missing device_id', { status: 400 });
  }

  // 检查黑名单KV
  const banned = await env.BAN_LIST.get(deviceId);
  return banned
    ? new Response('banned')
    : new Response('allowed');
}

// 处理黑名单管理
async function handleBanManager(request, env) {
  try {
    const { action, device_id, auth_key } = await request.json();

    // 从环境变量读取管理员密钥，若未设置则直接拒绝
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
