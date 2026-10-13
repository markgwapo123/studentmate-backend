import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../app.js';
import {hashPassword,emptyWorkspace} from '../security.js';

test('admin dashboard is role protected and excludes private workspace content',async t=>{
 let serial=0;const rows={users:[],sessions:[]};
 function match(row,q){return Object.entries(q).every(([k,v])=>v&&typeof v==='object'&&'$gt'in v?row[k]>v.$gt:row[k]===v)}
 const db={command:async()=>({ok:1}),collection:name=>({
  insertOne:async doc=>{const _id=String(++serial);rows[name].push({...doc,_id});return{insertedId:_id}},
  findOne:async q=>rows[name].find(r=>match(r,q))||null,
  countDocuments:async q=>rows[name].filter(r=>match(r,q)).length,
  find:q=>{let found=rows[name].filter(r=>match(r,q));return{sort(){return this},limit(n){found=found.slice(0,n);return this},toArray:async()=>found}},
  deleteOne:async q=>{rows[name]=rows[name].filter(r=>!match(r,q))},
  updateOne:async(q,u)=>{const r=rows[name].find(x=>match(x,q));if(!r)return{matchedCount:0};Object.assign(r,u.$set);r.revision+=u.$inc.revision;return{matchedCount:1}}
 })};
 const student={_id:'student-id',name:'Student',email:'student@example.com',role:'student',passwordHash:await hashPassword('student-password-123'),workspace:{...emptyWorkspace('Student'),tasks:[{title:'Private assignment'}],notes:[{body:'Private note'}]},revision:0,createdAt:new Date()};
 const admin={_id:'admin-id',name:'Admin',email:'admin@example.com',role:'admin',passwordHash:await hashPassword('admin-password-123'),workspace:emptyWorkspace('Admin'),revision:0,createdAt:new Date()};
 rows.users.push(student,admin);
 const server=createApp(db,['https://student.example']).listen(0,'127.0.0.1');
 await new Promise(r=>server.once('listening',r));
 t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port;
 async function req(path,method='GET',body,token){const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;const r=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});return{status:r.status,data:r.status===204?null:await r.json()}}
 const studentLogin=await req('/api/auth/login','POST',{email:student.email,password:'student-password-123'});
 const adminLogin=await req('/api/auth/login','POST',{email:admin.email,password:'admin-password-123'});
 assert.equal(studentLogin.data.user.role,'student');assert.equal(adminLogin.data.user.role,'admin');
 assert.equal((await req('/api/admin/dashboard')).status,401);
 assert.equal((await req('/api/admin/dashboard','GET',undefined,studentLogin.data.token)).status,403);
 const dashboard=await req('/api/admin/dashboard','GET',undefined,adminLogin.data.token);
 assert.equal(dashboard.status,200);assert.equal(dashboard.data.metrics.students,1);assert.equal(dashboard.data.metrics.assignments,1);assert.equal(dashboard.data.users[0].email,'student@example.com');assert.equal(JSON.stringify(dashboard.data).includes('Private note'),false);assert.equal(JSON.stringify(dashboard.data).includes('Private assignment'),false);
 const created=await req('/api/auth/register','POST',{name:'New Student',email:'new@example.com',password:'new-student-password-123'});assert.equal(created.data.user.role,'student');
});
