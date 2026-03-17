const target = process.argv[2] || 'http://127.0.0.1:5173/api/ai/health';

try {
  const response = await fetch(target);
  const data = await response.json();

  if (!response.ok) {
    console.error(`健康检查失败: ${response.status} ${JSON.stringify(data)}`);
    process.exit(1);
  }

  console.log(JSON.stringify({
    ok: true,
    target,
    data,
  }, null, 2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`健康检查请求失败: ${message}`);
  process.exit(1);
}
