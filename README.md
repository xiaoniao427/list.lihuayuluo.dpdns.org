# Cloudflare Worker: 设备管理与黑名单系统

这是一个用于管理游戏客户端设备信息和黑名单的Cloudflare Worker解决方案。它提供三个核心功能：
1. **设备信息上传**：客户端上传设备ID、用户名和时间戳
2. **黑名单检查**：客户端检查设备是否被封禁
3. **黑名单管理**：管理员管理黑名单设备

## 功能说明

### 1. 设备信息上传 (`/upload`)
- **方法**: POST
- **请求体**:
  ```json
  {
    "username": "玩家名",
    "device_id": "设备唯一ID",
    "timestamp": 时间戳毫秒数
  }
  ```
- **验证**:
  - 时间戳必须在服务器时间±10秒内
- **存储**:
  - 以`device_id`为键存储在`DEVICE_INFO` KV命名空间
  - 自动覆盖旧记录

### 2. 黑名单检查 (`/ban-check`)
- **方法**: GET
- **参数**: `device_id=设备ID`
- **响应**:
  - `banned`: 设备在黑名单中
  - `allowed`: 设备未被封禁

### 3. 黑名单管理 (`/ban-manager`)
- **方法**: POST
- **请求体**:
  ```json
  {
    "action": "ban" | "unban",
    "device_id": "设备ID",
    "auth_key": "管理员密钥"
  }
  ```
- **操作**:
  - `ban`: 添加设备到黑名单
  - `unban`: 从黑名单移除设备
- **安全**:
  - 需要有效的管理员密钥

## 部署步骤

### 1. 创建KV命名空间
```bash
# 创建设备信息存储
wrangler kv:namespace create "DEVICE_INFO"

# 创建黑名单存储
wrangler kv:namespace create "BAN_LIST"
```

### 2. 配置wrangler.toml
```toml
name = "device-management"
compatibility_date = "2023-05-15"

kv_namespaces = [
  { binding = "DEVICE_INFO", id = "<DEVICE_INFO_NAMESPACE_ID>" },
  { binding = "BAN_LIST", id = "<BAN_LIST_NAMESPACE_ID>" }
]
```

### 3. 部署Worker代码
```bash
wrangler deploy
```

### 4. 设置管理员密钥
在Worker的"设置"->"变量"中添加环境变量：
- 变量名: `ADMIN_KEY`
- 值: 您的安全密钥

## 使用示例

### 客户端上传设备信息
```java
// Java示例
public void uploadDeviceInfo(String username, String deviceId) {
    long timestamp = System.currentTimeMillis();
    JSONObject data = new JSONObject();
    data.put("username", username);
    data.put("device_id", deviceId);
    data.put("timestamp", timestamp);
    
    // 发送POST请求到 /upload
}
```

### 客户端检查黑名单
```java
// Java示例
public void checkBanStatus(String deviceId) {
    // 发送GET请求到 /ban-check?device_id=设备ID
    // 如果响应为"banned"，显示封禁窗口
}
```

### 管理员管理黑名单
```bash
# 封禁设备
curl -X POST https://your-worker.dev/ban-manager \
  -H "Content-Type: application/json" \
  -d '{"action":"ban", "device_id":"DEVICE123", "auth_key":"YOUR_ADMIN_KEY"}'

# 解封设备
curl -X POST https://your-worker.dev/ban-manager \
  -H "Content-Type: application/json" \
  -d '{"action":"unban", "device_id":"DEVICE123", "auth_key":"YOUR_ADMIN_KEY"}'
```

## 安全建议

1. **管理员密钥**:
   - 使用强密码作为管理员密钥
   - 定期轮换密钥
   - 不要在客户端代码中包含密钥

2. **时间戳验证**:
   - 防止重放攻击
   - 确保客户端时间与服务器同步

3. **HTTPS**:
   - 所有通信必须通过HTTPS
   - 启用Cloudflare的SSL/TLS加密

4. **速率限制**:
   - 在Cloudflare防火墙中配置速率限制
   - 防止暴力攻击

## 数据结构

### 设备信息存储 (DEVICE_INFO KV)
```json
{
  "device_id": "设备ID",
  "username": "玩家名",
  "last_updated": 1672531200000
}
```

### 黑名单存储 (BAN_LIST KV)
```
键: 设备ID
值: "banned" (仅标记存在)
```

## 错误代码

| 代码 | 说明                  | 可能原因                     |
|------|-----------------------|------------------------------|
| 400  | Bad Request           | 缺少必要参数或格式错误        |
| 401  | Unauthorized          | 无效的管理员密钥             |
| 403  | Forbidden             | 时间戳超出允许范围           |
| 404  | Not Found             | 请求的端点不存在             |
| 500  | Internal Server Error | 服务器内部错误               |

## 扩展建议

1. **审计日志**:
   ```javascript
   // 在ban-manager操作中添加日志记录
   await AUDIT_LOG.put(Date.now(), JSON.stringify({
     action,
     device_id,
     admin_ip: request.headers.get('CF-Connecting-IP')
   }));
   ```

2. **设备信息分析**:
   - 添加Cloudflare Analytics
   - 使用Workers Analytics Engine收集使用数据

3. **自动封禁系统**:
   ```javascript
   // 检测异常行为后自动封禁
   if (suspiciousActivity) {
     await BAN_LIST.put(deviceId, 'banned');
   }
   ```

4. **客户端验证增强**:
   ```javascript
   // 添加客户端签名验证
   const clientSignature = request.headers.get('X-Signature');
   const isValid = verifySignature(data, clientSignature);
   if (!isValid) return new Response('Invalid signature', { status: 403 });
   ```

## 维护说明

1. **定期备份**:
   ```bash
   # 备份KV数据
   wrangler kv:key get --namespace-id=DEVICE_INFO_NAMESPACE_ID
   wrangler kv:key get --namespace-id=BAN_LIST_NAMESPACE_ID
   ```

2. **监控**:
   - 设置Cloudflare Workers的警报
   - 监控错误率和延迟

3. **更新**:
   - 定期更新Worker依赖
   - 使用`wrangler update`命令更新CLI工具

4. **测试**:
   - 部署前在本地测试
   ```bash
   wrangler dev
   ```


**注意**: 请将文档中的所有`your-worker.dev`替换为您的实际Worker域名，并设置有效的管理员密钥。
