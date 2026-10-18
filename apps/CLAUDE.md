# Instructions for Claude Code

- ตอบกลับเป็นภาษาไทยเสมอ ไม่ว่าคำถามจะเป็นภาษาอะไร
- Code, variable name, comment ในโค้ดยังคงเป็นภาษาอังกฤษตามมาตรฐาน
  (แค่ prose/explanation ที่ตอบกลับให้เป็นภาษาไทย)
- อ่าน PROJECT_CONTEXT.md และ CONVENTIONS.md ก่อนเริ่มงานทุกครั้ง
- รายงานผลทดสอบ/QA summary/สรุปงาน ให้ตอบเป็นข้อความในแชทเสมอ ไม่ต้อง publish เป็น web artifact/HTML ไฟล์ ยกเว้นผู้ใช้ร้องขอโดยตรง — ประหยัด token
- กฎ Docker/ฐานข้อมูล (ดู apps/backend/CONVENTIONS.md §10): ห้าม `docker compose down -v` / `docker-compose down -v`, `docker volume rm/prune`, `docker system prune` ในทุกกรณี ใช้ `npm run docker:stop` เพื่อหยุดระบบ
- ห้ามหยุด สตาร์ท หรือแตะ container/volume ของโปรเจกต์อื่น (เช่น pm25-pipeline) แม้พอร์ตจะชน ให้หาว่าอะไรจองพอร์ตแล้วรายงาน
- ต้องรัน `bash scripts/db-backup.sh <label>` ก่อนรอบ QA/ทดสอบทุกรอบที่แตะ Docker ถ้าต้องล้างข้อมูลทดสอบให้ใช้ seed หรือ API
- งานดีไซน์/UI ฝั่ง frontend: อ่าน frontend/DESIGN.md ก่อนเริ่มงาน
