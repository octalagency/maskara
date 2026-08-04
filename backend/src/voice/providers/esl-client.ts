import * as net from 'net';

/**
 * Minimal FreeSWITCH Event Socket (ESL) inbound client.
 */
export class EslClient {
  static async api(
    host: string,
    port: number,
    password: string,
    command: string,
    timeoutMs = 25_000,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port });
      let buf = '';
      let authed = false;
      let settled = false;
      const timer = setTimeout(() => {
        fail(new Error(`ESL timeout after ${timeoutMs}ms (${host}:${port})`));
      }, timeoutMs);

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        reject(err);
      };

      const done = (body: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.end();
        resolve(body);
      };

      const readFrames = () => {
        while (true) {
          const sep = buf.indexOf('\n\n');
          if (sep < 0) return;
          const headerBlock = buf.slice(0, sep);
          buf = buf.slice(sep + 2);

          const headers: Record<string, string> = {};
          for (const line of headerBlock.split('\n')) {
            const c = line.indexOf(':');
            if (c > 0) {
              headers[line.slice(0, c).trim().toLowerCase()] = line
                .slice(c + 1)
                .trim();
            }
          }

          const len = Number(headers['content-length'] || 0);
          let body = '';
          if (len > 0) {
            if (buf.length < len) {
              buf = headerBlock + '\n\n' + buf;
              return;
            }
            body = buf.slice(0, len);
            buf = buf.slice(len);
          }

          const ctype = (headers['content-type'] || '').toLowerCase();
          const reply = headers['reply-text'] || body;

          if (ctype.includes('rude-rejection') || /access denied/i.test(body)) {
            fail(
              new Error(
                'ESL Access Denied — allow Docker CIDR in event_socket apply-inbound-acl',
              ),
            );
            return;
          }

          if (ctype.includes('auth/request')) {
            socket.write(`auth ${password}\n\n`);
            continue;
          }

          if (!authed) {
            if (/^\+OK/i.test(reply)) {
              authed = true;
              socket.write(`api ${command}\n\n`);
              continue;
            }
            if (/^-ERR/i.test(reply)) {
              fail(new Error(`ESL auth failed: ${reply}`));
              return;
            }
            continue;
          }

          // Command result
          done(body || reply || '');
          return;
        }
      };

      socket.setEncoding('utf8');
      socket.on('error', (err) => fail(err));
      socket.on('data', (chunk: string) => {
        buf += chunk;
        readFrames();
      });
    });
  }
}
