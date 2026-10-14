import {MongoClient} from 'mongodb';
import {hashPassword,emptyWorkspace} from './security.js';
import {createApp} from './app.js';
import {startKeepAlive} from './utils/keepAlive.js';
import {monitorMongo} from './utils/mongoHealth.js';
let stopKeepAlive=()=>{};
const uri=process.env.MONGODB_URI;
const origins=(process.env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
if(!uri||!origins.length){console.error('Set MONGODB_URI and ALLOWED_ORIGINS before starting.');process.exit(1)}
const client=new MongoClient(uri,{serverSelectionTimeoutMS:15000,maxPoolSize:10});
const mongoHealth=monitorMongo(client);
try{await client.connect();mongoHealth.markConnected();const db=client.db(process.env.MONGODB_DB||'studentmate');await db.command({ping:1});await db.collection('users').createIndex({email:1},{unique:true});
 await db.collection('users').updateMany({role:{$exists:false}},{$set:{role:'student'}});
 const adminEmail=(process.env.ADMIN_EMAIL||'').trim().toLowerCase();const adminPassword=process.env.ADMIN_PASSWORD||'';
 if(Boolean(adminEmail)!==Boolean(adminPassword))throw new Error('Set both ADMIN_EMAIL and ADMIN_PASSWORD to bootstrap the admin account.');
 if(adminEmail){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)||adminPassword.length<16||adminPassword.length>128)throw new Error('ADMIN_EMAIL must be valid and ADMIN_PASSWORD must be 16–128 characters.');const existing=await db.collection('users').findOne({email:adminEmail});if(existing&&existing.role!=='admin')throw new Error('ADMIN_EMAIL belongs to a student account. Choose a different email; student accounts are never promoted automatically.');if(!existing){const name=(process.env.ADMIN_NAME||'StudentMate Admin').trim().slice(0,40);await db.collection('users').insertOne({email:adminEmail,name,role:'admin',passwordHash:await hashPassword(adminPassword),workspace:emptyWorkspace(name),revision:0,createdAt:new Date()});console.log('Initial admin account created.')}}await db.collection('sessions').createIndex({tokenHash:1},{unique:true});await db.collection('sessions').createIndex({expiresAt:1},{expireAfterSeconds:0});const server=createApp(db,origins,{isMongoConnected:mongoHealth.isConnected}).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>{console.log('StudentMate API ready');stopKeepAlive=startKeepAlive()});async function shutdown(){stopKeepAlive();server.close(async()=>{await client.close();process.exit(0)});setTimeout(()=>process.exit(1),10000).unref()}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown)}catch(e){console.error('Database startup failed:',e.name,'Check credentials and Atlas network access.');await client.close();process.exit(1)}
