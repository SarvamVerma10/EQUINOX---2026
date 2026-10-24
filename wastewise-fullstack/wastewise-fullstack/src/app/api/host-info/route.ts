import { NextResponse } from 'next/server';
import os from 'os';

export const dynamic = 'force-dynamic';

export async function GET() {
  const interfaces = os.networkInterfaces();
  let lanIp = 'localhost';

  // Find active non-internal IPv4 address (e.g. 10.x.x.x, 192.168.x.x)
  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      // Node 18+ uses family as 'IPv4' or 4
      const isIPv4 = iface.family === 'IPv4' || (iface.family as unknown) === 4;
      if (isIPv4 && !iface.internal) {
        lanIp = iface.address;
        break;
      }
    }
    if (lanIp !== 'localhost') break;
  }

  const port = process.env.PORT || '3000';
  const url = lanIp !== 'localhost' ? `http://${lanIp}:${port}` : `http://localhost:${port}`;

  return NextResponse.json({
    ip: lanIp,
    port,
    url
  });
}
