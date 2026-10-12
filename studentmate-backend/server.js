import {MongoClient} from 'mongodb';
import {createApp} from './app.js';
const uri=process.env.MONGODB_URI;
const origins=(process.env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
if(!uri||!origins.length){console.error('Set MONGODB_URI and ALLOWED_ORIGINS before starting.');process.exit(1)}
const client=new MongoClient(uri,{serverSelectionTimeoutMS:15000,maxPoolSize:10});
try{await client.connect();const db=client.db(process.env.MONGODB_DB||'studentmate');await db.command({ping:1});await db.collection('users').createIndex({email:1},{unique:true});await db.collection('sessions').createIndex({tokenHash:1},{unique:true});await db.collection('sessions').createIndex({expiresAt:1},{expireAfterSeconds:0});const server=createApp(db,origins).listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('StudentMate API ready'));async function shutdown(){server.close(async()=>{await client.close();process.exit(0)});setTimeout(()=>process.exit(1),10000).unref()}process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown)}catch(e){console.error('Database startup failed:',e.name,'Check credentials and Atlas network access.');await client.close();process.exit(1)}
