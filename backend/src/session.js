import {createHmac, timingSafeEqual} from 'node:crypto';

const SECRET = () => process.env.SESSION_SECRET;
const encode = data => Buffer.from(JSON.stringify(data)).toString('base64url');
const signature = value => createHmac('sha256', SECRET()).update(value).digest('base64url');
export function generarToken(usuario) {
  const payload = encode({sub:String(usuario.id), rol:usuario.rol, exp:Date.now()+8*60*60*1000});
  return `${payload}.${signature(payload)}`;
}
export function verificarToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, hash, ...rest] = token.split('.');
  if (rest.length || !payload || !hash) return null;
  const wanted=Buffer.from(signature(payload));
  const actual=Buffer.from(hash);
  if (wanted.length!==actual.length || !timingSafeEqual(wanted, actual)) return null;
  try {const body=JSON.parse(Buffer.from(payload,'base64url').toString());
    return Number.isFinite(body.exp) && body.exp>Date.now() && /^\d+$/.test(body.sub) ? body : null;
  } catch { return null; }
}
export const extraerCookie = (req, name='autos_session') => {
  const list=(req.headers.cookie||'').split(';').map(s=>s.trim());
  const cookie=list.find(s=>s.startsWith(name+'='));
  return cookie ? decodeURIComponent(cookie.slice(name.length+1)) : null;
};
export const cookieOptions = {
  httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'strict', path:'/', maxAge:8*60*60*1000
};
