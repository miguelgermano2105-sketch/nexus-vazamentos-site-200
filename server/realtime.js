const clients = new Set();

/** Registra uma conexão SSE (chat público em tempo real). */
export function addClient(res, userId) {
  const client = { res, userId, id: Math.random().toString(36).slice(2) };
  clients.add(client);
  return () => clients.delete(client);
}

export function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of [...clients]) {
    try {
      client.res.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}

export function connectionCount() {
  return clients.size;
}

export function startHeartbeat() {
  const timer = setInterval(() => {
    for (const client of [...clients]) {
      try {
        client.res.write(': ping\n\n');
      } catch {
        clients.delete(client);
      }
    }
  }, 20_000);
  timer.unref?.();
  return timer;
}
