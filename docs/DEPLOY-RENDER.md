# Deploy ขึ้น Render (ฟรี)

ระบบขึ้นเป็น 3 ส่วนตาม `render.yaml`: ฐานข้อมูล `eduanalyze-db`, API `eduanalyze-sakorn-api`, หน้าเว็บ `eduanalyze-sakorn-web`
เปิดใช้งานที่ `https://eduanalyze-sakorn-web.onrender.com` (ถ้า Render เติมท้ายชื่อให้ ดูหัวข้อ "ถ้าชื่อเว็บไม่ตรง")

> ห้ามวางรหัสผ่าน, External Database URL หรือค่า SMTP ลงในแชท, issue หรือ commit

## ข้อจำกัดของแพ็กฟรี
- ไม่มีคนใช้ 15 นาที บริการจะหลับ คนแรกที่เข้าต้องรอปลุกราว 1 นาที (หน้าเว็บและ API ปลุกแยกกัน)
- ฐานข้อมูลฟรีหมดอายุ 30 วันหลังสร้าง ต้องอัปเกรดหรือสร้างใหม่แล้วย้ายข้อมูลอีกรอบ
- migration ไม่รันอัตโนมัติ: ข้อมูลและโครงสร้างตารางมาจากการย้ายข้อมูลในขั้นที่ 4

## ขั้นตอน

1. **สมัคร Render** ที่ https://render.com ด้วยบัญชี GitHub ที่มี repo `sakornk-stack/it-project`
2. **สร้างจาก Blueprint**: Dashboard → New → Blueprint → เลือก repo `it-project` (branch `main`) → Render อ่าน `render.yaml` แล้วถามค่าที่ตั้งเป็น `sync: false`
   - `TOTP_ENCRYPTION_KEY`: สุ่มเลขฐาน 16 ยาว 64 ตัว ในเครื่องด้วย PowerShell แล้วคัดลอกไปวาง (เก็บสำรองไว้ที่ปลอดภัย)
     ```powershell
     -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
     ```
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: คัดลอกค่าเดียวกับใน `apps/backend/.env` ในเครื่อง
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: คัดลอกจาก `apps/backend/.env` ในเครื่อง (OAuth client ของโปรเจกต์ EduAnalyze ใน Google Cloud) แล้วเพิ่ม redirect URI `https://eduanalyze-sakorn-web.onrender.com/api/auth/google/callback` ใน Google Cloud → Clients → EduAnalyze
   - กด Apply แล้วรอ build ทั้งสองบริการ (ครั้งแรกราว 10–15 นาที)
3. **เช็กว่าขึ้นแล้ว**: เปิด `https://eduanalyze-sakorn-api.onrender.com/api/health` ต้องได้ `{"status":"ok"}` (ตอนนี้ยังล็อกอินไม่ได้ เพราะฐานข้อมูลยังว่าง)
4. **ย้ายข้อมูลจากเครื่องนี้ขึ้นไป** (Docker ในเครื่องต้องเปิดอยู่):
   - Render → `eduanalyze-db` → Connect → คัดลอก **External Database URL**
   - ในโฟลเดอร์โปรเจกต์ เปิด PowerShell แล้วรัน `.\scripts\restore-to-render.ps1` → วาง URL เมื่อถูกถาม (ไม่แสดงบนจอ)
   - สคริปต์แทนที่ข้อมูลทั้งหมดในฐานข้อมูลของ Render ด้วยข้อมูลในเครื่อง
5. **ลองใช้**: เปิด `https://eduanalyze-sakorn-web.onrender.com` บนคอมหรือมือถือ ล็อกอินด้วยบัญชี demo

## ถ้าชื่อเว็บไม่ตรง
ถ้าชื่อ `eduanalyze-sakorn-api` หรือ `eduanalyze-sakorn-web` ถูกคนอื่นใช้แล้ว Render จะเติมท้ายชื่อให้ เช่น `eduanalyze-sakorn-web-ab12.onrender.com`
ให้แก้ค่าใน `render.yaml` ให้ตรงกับชื่อจริง แล้ว push ใหม่:
- ฝั่ง API: `FRONTEND_URL`, `CORS_ORIGIN`, `GOOGLE_CALLBACK_URL`
- ฝั่งหน้าเว็บ: `API_PROXY_TARGET`

## อัปเดตเวอร์ชัน
push ขึ้น `main` ของ `it-project` แล้ว Render จะ build และ deploy ใหม่ให้เอง ข้อมูลในฐานข้อมูลไม่หาย
ถ้าการเปลี่ยนแปลงมี migration ใหม่ (`apps/backend/prisma/migrations`) ให้รันจากเครื่องนี้ เพราะแพ็กฟรีไม่มี Render Shell (ใช้ External Database URL เดียวกับขั้นที่ 4 วางในหน้าต่าง PowerShell เท่านั้น):
```powershell
docker compose build migrate
docker compose run --rm -e DATABASE_URL="<External Database URL>" migrate
```
