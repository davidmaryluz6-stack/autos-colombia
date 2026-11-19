import { Duplex } from 'node:stream';
import { IncomingMessage, ServerResponse } from 'node:http';

export function invocarApp(app, path, { method = 'GET', body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const socket = new Duplex({
      read() { },
      write(_chunk, _enc, cb) {
        cb();
      },
    });
    socket.remoteAddress = '127.0.0.1';

    const req = new IncomingMessage(socket);
    req.method = method;
    req.url = path;
    req.headers = {
      host: 'localhost:3000',
      ...(payload ? { 'content-type': 'application/json', 'content-length': String(payload.length) } : {}),
      ...(cookie ? { cookie } : {}),
    };
    if (payload) {
      req.push(payload);
    }
    req.push(null);

    const res = new ServerResponse(req);
    res.assignSocket(socket);

    const chunks = [];
    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);
    res.write = (chunk, encoding, cb) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      return origWrite(chunk, encoding, cb);
    };
    res.end = (chunk, encoding, cb) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      origEnd(chunk, encoding, cb);
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const setCookieHeader = res.getHeader('set-cookie');
        const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
        resolve({
          status: res.statusCode,
          data: raw ? JSON.parse(raw) : null,
          cookie: cookieStr ? String(cookieStr).split(';')[0] : null,
        });
      } catch (err) {
        reject(err);
      }
    };

    app(req, res);
  });
}

