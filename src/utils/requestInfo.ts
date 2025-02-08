import { Request } from 'express';
import { UAParser } from 'ua-parser-js';

export const getRequestInfo = (req: Request) => {
  // Get IP address
  const ip = req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.headers['x-forwarded-for']?.toString().split(',')[0];

  // Get OS info using user agent
  const parser = new UAParser(req.headers['user-agent']);
  const os = parser.getOS().name + ' ' + (parser.getOS().version || '');
  console.log(os);
  console.log(ip);

  return { ip, os };
};
