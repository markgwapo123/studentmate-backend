import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
export const tokenHash=token=>createHash('sha256').update(token).digest('hex');
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64);return `${salt}:${key.toString('hex')}`}
export async function verifyPassword(password,stored){const [salt,hex]=stored.split(':');const expected=Buffer.from(hex,'hex');const actual=await scrypt(password,salt,64);return expected.length===actual.length&&timingSafeEqual(expected,actual)}
export function validCredentials(body){return body&&typeof body.email==='string'&&body.email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)&&typeof body.password==='string'&&body.password.length>=12&&body.password.length<=128}
export const emptyWorkspace=name=>({name,subjects:[],tasks:[],notes:[],schedule:[],sessions:0,focus:25,break:5});
