# การ deploy EduAnalyzeAI ขึ้น VPS (eduanalyze.itkukps.tech)

เอกสารนี้อธิบายว่าระบบ deploy ทำงานอย่างไร อะไรเตรียมไว้ใน repo แล้ว และขั้นตอนที่เจ้าของโปรเจกต์ต้องทำเองบน Mac, บน VPS และใน GitHub
คำสั่งทั้งหมดเขียนสำหรับ macOS + bash (บน Mac) และ Ubuntu + root (บน VPS)

> ห้ามวางรหัสผ่าน, token, private key หรือเนื้อหาไฟล์ `.env` / `db.env` ลงในแชท, issue, commit หรือ log ใดๆ

---

## 1. ภาพรวม

```text
git push main ─► CI (lint + tsc + test + docker build ทดลอง)
                  └─ผ่าน─► Deploy: build 3 images ─► GHCR (private, แท็ก latest + sha-xxxxxxx)
                                    └─► ssh vps "deploy sha-xxxxxxx"
                                          └─ VPS: กุญแจถูกบังคับให้รันได้แค่ deploy/ssh-deploy-gate.sh
                                               └─► deploy/remote-deploy.sh sha-xxxxxxx
                                                     backup DB ─► pull ─► up -d ─► ตรวจ health

ผู้ใช้ ─► https://eduanalyze.itkukps.tech ─► Nginx บน VPS (certbot)
            ├─ /api/* ─► 127.0.0.1:3401 ─► container backend (NestJS) ─┐
            └─ /*     ─► 127.0.0.1:3400 ─► container frontend (Next.js) │
                                       migrate (รัน prisma migrate deploy แล้วจบ)
                                       postgres 16.15 (volume eduanalyze_postgres_data, ไม่เปิดพอร์ต)
```

ลำดับการเริ่ม: `postgres` (healthy) → `migrate` (exit 0) → `backend` (healthy) → `frontend`

GitHub Actions **ไม่คัดลอกไฟล์ใดๆ ขึ้น VPS** และสั่งได้แค่ `deploy <แท็ก>` ไฟล์ `docker-compose.yml` และ `deploy/*.sh` บน VPS คุณอัปเดตเองด้วย scp (หัวข้อ 7.1)

### ค่าจริงของโปรเจกต์

| รายการ | ค่า |
|---|---|
| GitHub repo | `Patcharadnaimingchua/eduanalyze-ai` |
| โดเมน | `eduanalyze.itkukps.tech` (A → `179.197.241.30`) |
| โฟลเดอร์บน VPS | `~/eduanalyze` (= `/root/eduanalyze`) |
| Compose project | `eduanalyze` → volume `eduanalyze_postgres_data`, network `eduanalyze_default` (ไม่ชน `app_*`) |
| พอร์ตบน VPS | frontend `127.0.0.1:3400`, backend `127.0.0.1:3401` (ไม่ชนแอป Lab ที่ 3300) |
| Images | `ghcr.io/patcharadnaimingchua/eduanalyze-ai-backend`, `-frontend`, `-migrator` |
| Nginx | `/etc/nginx/sites-available/eduanalyze` + ลิงก์ `/etc/nginx/sites-enabled/zz-eduanalyze` |
| Google callback | `https://eduanalyze.itkukps.tech/api/auth/google/callback` |
| VPS หมดอายุ | **2026-11-11** |

สิ่งที่ห้ามแตะบน VPS: ไฟล์ site `equipment` และใบรับรองของมัน, container `app-app-1` / `app-db-1`, ทุกอย่างที่ขึ้นต้นด้วย `app_`, `~/app`

---

## 2. สิ่งที่เตรียมไว้ใน repo แล้ว

| ไฟล์ | หน้าที่ |
|---|---|
| `apps/backend/Dockerfile` | multi-stage: `runtime` (API, ผู้ใช้ `node`, HEALTHCHECK `/api/health`) และ `migrator` (รัน `prisma migrate deploy` แล้วจบ, มี `seed.ts` ไว้รันมือ) |
| `apps/backend/docker-entrypoint.sh` | สร้าง `DATABASE_URL` ภายใน container จาก `POSTGRES_*` |
| `apps/frontend/Dockerfile` | Next.js standalone, ผู้ใช้ `node`, HEALTHCHECK `/login`, รับ `NEXT_PUBLIC_*` 6 ตัวเป็น build arg |
| `.dockerignore` | กัน `.env*`, `db.env`, `.backups`, `private-data`, `.design-ref`, `DEPLOY_GUIDE.md` ฯลฯ ไม่ให้เข้า image |
| `docker-compose.yml` | ใช้ได้ทั้งในเครื่องและบน VPS (postgres pin `16.15`, migrate รับแค่ข้อมูล DB) |
| `docker-compose.override.yml` | เฉพาะในเครื่อง: เปิด DB ที่ `127.0.0.1:5433` (ไม่ copy ขึ้น VPS) |
| `.github/workflows/ci.yml` | workflow ชื่อ `CI` |
| `.github/workflows/deploy.yml` | workflow ชื่อ `Deploy` (build + push GHCR + สั่ง `deploy <แท็ก>` ผ่าน SSH + rollback) |
| `.github/dependabot.yml` | PR อัปเดต action (pin ด้วย commit SHA) และ base image รายสัปดาห์ |
| `deploy/make-env.sh` | สร้าง `~/eduanalyze/.env`, `db.env`, `backups/`, `logs/` พร้อมสุ่มความลับให้ |
| `deploy/ssh-deploy-gate.sh` | forced command ของกุญแจ GitHub Actions: รับแค่ `deploy sha-<hex>` |
| `deploy/remote-deploy.sh` | สคริปต์ deploy บน VPS (ล้มเมื่อไหร่คืนแท็กเดิมใน `.env` ให้) |
| `deploy/nginx.conf` | config Nginx ของโดเมนนี้ (HTTP ก่อน แล้วให้ certbot เติม HTTPS) |
| `deploy/backup-db.sh` | `pg_dump` ไป `~/eduanalyze/backups/` เก็บ 14 วัน |
| `deploy/restore-test.sh` | ทดสอบ restore ลง container ชั่วคราว ไม่แตะ DB จริง |
| `deploy/create-first-admin.sh` | สร้าง SUPER_ADMIN คนแรก (ครั้งเดียว) |
| `apps/backend/src/cli/create-first-admin.ts` | โค้ดที่สคริปต์ข้างบนเรียก (มี test) |

การใช้งานในเครื่องแบบเดิมไม่เปลี่ยน: `docker compose up -d postgres` ยังได้ DB เดิมที่พอร์ต 5433 (ตอนนี้ผูกแค่ 127.0.0.1) และ volume เดิม `eduanalyze-ai_postgres_data`
(ครั้งแรกหลังอัปเดตไฟล์นี้ compose จะสร้าง container postgres ใหม่ด้วย image `postgres:16.15` — major เดิม ข้อมูลอยู่ใน volume ไม่หาย)

---

## 3. ขั้นตอนที่คุณต้องทำเอง

ทำตามลำดับ 3.1 → 3.12

ข้อควรระวังตอนทำงานผ่าน SSH (เจอจริงตอน deploy ครั้งแรก):
- เปิด SSH ด้วย `ssh -o ServerAliveInterval=30 <user>@<host>` เพื่อไม่ให้ session หลุดเมื่อเงียบนาน
- ก่อนวางคำสั่งทุกครั้ง ดู prompt ว่าอยู่เครื่องไหน (Mac หรือ VPS) และอย่าวางหลายบล็อกต่อกันตอนยังไม่แน่ใจ — ถ้า session หลุดกลางทาง บล็อกที่เหลือจะไปรันบนเครื่องผิด

### 3.1 ตรวจไฟล์ แล้ว commit + push (บน Mac)

```bash
cd ~/Downloads/Projects/eduanalyze-ai
git status
git diff
git add .dockerignore .gitignore docker-compose.yml docker-compose.override.yml \
  .github deploy docs/DEPLOY.md ENV_VARS.md README.md TODO.md \
  apps/backend/Dockerfile apps/backend/docker-entrypoint.sh apps/backend/.env.example \
  apps/backend/src/main.ts apps/backend/src/cli apps/backend/src/common/email/email.service.ts \
  apps/backend/src/modules/auth/auth.service.forgot-password.spec.ts \
  apps/backend/src/modules/ai-analysis/ai-analysis.service.ts \
  apps/backend/src/modules/ai-analysis/ai-analysis.service.spec.ts \
  apps/frontend/Dockerfile apps/frontend/next.config.mjs
git status   # ต้องไม่มี .env, db.env, DEPLOY_GUIDE.md, .backups
git commit -m "add docker images, ci/cd workflows and vps deploy scripts"
git push origin main
```

เปิด `https://github.com/Patcharadnaimingchua/eduanalyze-ai/actions`:
- `CI` ต้องเขียวทั้ง job `Lint, type-check, test` และ `Docker build (...)` 3 ตัว
- จากนั้น `Deploy` จะรันเอง: job `Build and push images` สร้าง image ใน GHCR ส่วน job `Deploy to VPS` จะถูกข้าม (ยังไม่ได้ตั้ง Secrets) — ถูกต้องแล้ว
- จดแท็ก `sha-xxxxxxx` จาก log ของ job build (ขั้น `tag`) หรือดูที่ `https://github.com/Patcharadnaimingchua?tab=packages`

### 3.2 DNS

ตั้งไว้แล้ว ตรวจจาก Mac:

```bash
dig +short eduanalyze.itkukps.tech   # ต้องได้ 179.197.241.30
```

### 3.3 เตรียมค่าที่ต้องกรอกเอง (ยังไม่ต้องพิมพ์ที่ไหน)

- **Gmail App Password** สำหรับบัญชีที่ใช้ส่งอีเมล: Google Account → Security → 2-Step Verification → App passwords → สร้างรหัส 16 ตัว
- **Google OAuth** (ถ้าจะเปิดปุ่ม "เข้าสู่ระบบด้วย Google"): Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application)
  - Authorized JavaScript origins: `https://eduanalyze.itkukps.tech`
  - Authorized redirect URIs: `https://eduanalyze.itkukps.tech/api/auth/google/callback`
  - ถ้ายังไม่ใช้ Google ข้ามได้ ปุ่มจะถูกซ่อนไว้

### 3.4 เตรียมโฟลเดอร์และสร้าง `.env` บน VPS

จาก Mac คัดลอกไฟล์ที่ VPS ต้องใช้ (ยังใช้รหัสผ่าน root ได้จนถึงข้อ 3.11):

```bash
cd ~/Downloads/Projects/eduanalyze-ai
ssh root@179.197.241.30 'mkdir -p -m 700 ~/eduanalyze/deploy'
scp docker-compose.yml root@179.197.241.30:eduanalyze/
scp deploy/*.sh deploy/nginx.conf root@179.197.241.30:eduanalyze/deploy/
```

เข้า VPS แล้วสร้าง `.env`:

```bash
ssh root@179.197.241.30
chown -R root:root ~/eduanalyze
chmod 700 ~/eduanalyze ~/eduanalyze/deploy ~/eduanalyze/deploy/*.sh   # สคริปต์รันด้วยสิทธิ์ root: ห้ามให้คนอื่นเขียนได้
bash ~/eduanalyze/deploy/make-env.sh
```

สคริปต์จะถาม 4 ค่า (Gmail ที่ใช้ส่ง, App Password, Google client ID, Google client secret) — ช่องรหัสจะไม่แสดงตัวอักษร, กด Enter เพื่อข้ามได้
ทุกอย่างอื่นถูกสุ่มหรือตั้งให้แล้ว: รหัส DB, JWT secrets 3 ตัว, `TOTP_ENCRYPTION_KEY`, `TRUST_PROXY_HOPS=1`,
`CORS_ORIGIN` / `FRONTEND_URL` = `https://eduanalyze.itkukps.tech`, `SELF_SIGNUP_ALLOWED_DOMAINS=ku.th`, Gmail SMTP `smtp.gmail.com:587`,
`ANTHROPIC_API_KEY=disabled` (ปิด AI — หัวข้อ 8), `NODE_ENV=production` (ทำให้ cookie เป็น Secure), `IMAGE_TAG=` ว่าง (deploy แรกจะตั้งให้)
และสร้าง `~/eduanalyze/backups` กับ `~/eduanalyze/logs` สิทธิ์ 700

ตรวจ (แสดงเฉพาะชื่อตัวแปร ไม่แสดงค่า):

```bash
ls -l ~/eduanalyze/.env ~/eduanalyze/db.env            # ต้องเป็น -rw-------
ls -ld ~/eduanalyze/backups ~/eduanalyze/logs          # ต้องเป็น drwx------
grep -oE '^[A-Z_0-9]+=' ~/eduanalyze/.env | tr '\n' ' '
```

แก้ค่าที่ข้ามไว้ภายหลังด้วย `nano ~/eduanalyze/.env` แล้ว `cd ~/eduanalyze && docker compose up -d --no-build`

**สำรองไฟล์ความลับ:** เก็บสำเนา `.env` และ `db.env` ไว้นอก VPS ในที่ปลอดภัย (เช่น secure note ใน password manager)
ถ้า `TOTP_ENCRYPTION_KEY` หาย ผู้ใช้ทุกคนที่เปิด 2FA จะใช้ 2FA ไม่ได้อีก

### 3.5 ให้ VPS ดึง image จาก GHCR ได้

Image เป็น private ต้อง login ครั้งเดียว:

1. บน GitHub: Settings → Developer settings → Personal access tokens → **Tokens (classic)** → Generate new token
   - เลือก scope **`read:packages` อย่างเดียว**, ตั้งวันหมดอายุ (เช่น 90 วัน แล้วจดวันต่ออายุไว้)
2. บน VPS:

```bash
docker login ghcr.io -u Patcharadnaimingchua
# Password: วาง token ตรงนี้ (ที่ prompt บน VPS เท่านั้น)
```

### 3.6 เริ่มระบบครั้งแรกบน VPS

ใช้แท็ก `sha-xxxxxxx` ที่จดไว้จากข้อ 3.1 (ไม่ใช้ `latest` — แท็ก `latest` ไม่ถูกบันทึกในประวัติ จึง rollback กลับมาหาไม่ได้):

```bash
bash ~/eduanalyze/deploy/remote-deploy.sh sha-xxxxxxx
```

สคริปต์จะ pull image ของแอป (postgres ใช้เวอร์ชันที่ pin ไว้ ไม่ถูก pull ซ้ำ), เริ่ม `postgres → migrate → backend → frontend` แล้วตรวจ health
ผลที่ต้องได้คือ `Deploy of sha-xxxxxxx is healthy.` และแท็กถูกบันทึกใน `~/eduanalyze/.image-tag-history`
ตรวจเพิ่ม:

```bash
cd ~/eduanalyze
docker compose ps                       # migrate = Exited (0), ที่เหลือ healthy
curl -s http://127.0.0.1:3401/api/health   # {"status":"ok"}
docker stats --no-stream | grep eduanalyze  # หน่วยความจำแต่ละตัวไม่เกิน limit 512M
docker ps --format '{{.Names}}' | grep '^app-'   # แอป Lab ยังรันอยู่ ไม่ถูกแตะ
```

ถ้าขึ้น `unauthorized` ตอน pull → ทำข้อ 3.5 ใหม่

### 3.7 Nginx + HTTPS (บน VPS, root)

```bash
cp ~/eduanalyze/deploy/nginx.conf /etc/nginx/sites-available/eduanalyze
ln -s /etc/nginx/sites-available/eduanalyze /etc/nginx/sites-enabled/zz-eduanalyze
nginx -t && systemctl reload nginx
curl -sI http://eduanalyze.itkukps.tech/api/health | head -1    # HTTP/1.1 200 OK
```

ชื่อลิงก์ `zz-eduanalyze` ตั้งใจให้เรียงหลัง `equipment` เพื่อให้คำขอที่เข้าด้วย IP ตรงๆ ยังไปที่ site เดิมเหมือนก่อน

ออกใบรับรองแยกสำหรับโดเมนนี้เท่านั้น:

```bash
certbot --nginx -d eduanalyze.itkukps.tech --redirect
certbot certificates                 # ต้องเห็นใบ eduanalyze.itkukps.tech แยกจากใบเดิมของ itkukps.tech
certbot renew --dry-run
nginx -t && systemctl reload nginx
curl -sI https://eduanalyze.itkukps.tech/api/health | head -1   # HTTP/2 200 หรือ HTTP/1.1 200
curl -sI https://itkukps.tech | head -1                          # site เดิมยังตอบปกติ
```

certbot จะแก้ไฟล์ `/etc/nginx/sites-available/eduanalyze` เอง (เพิ่ม 443 และ redirect) — ห้าม copy `deploy/nginx.conf` ทับไฟล์นี้อีก
ถ้าจำเป็นต้องทับ ให้รัน certbot คำสั่งเดิมซ้ำ

### 3.8 ข้อมูลคณะ/หลักสูตร (seed) — รันครั้งเดียว

ต้องรัน **6 สคริปต์** ตามลำดับนี้ (ไม่มี user และไม่มีข้อมูลนิสิต ทุกตัวรันซ้ำได้ไม่ซ้ำข้อมูล):

| # | สคริปต์ | ผล |
|---|---|---|
| 1 | `seed.ts` | คณะ LASCI + ภาควิชา/สาขา/หลักสูตร |
| 2 | `import-ict-2564.ts` | วิชา ICT 2564 = **43 วิชา** (ตัดออก 3 วิชา จากเดิม 46) |
| 3 | `import-ict-2564-gened.ts` | วิชาศึกษาทั่วไป 2564 = **17 วิชา** |
| 4 | `import-ict-2569.ts` | วิชา ICT 2569 = **50 วิชา** |
| 5 | `seed-plo-2564.ts` | PLO1–6 ของ 2564 |
| 6 | `import-ict-clo-plo.ts` | CLO/PLO/mapping (ใช้ `private-data`) |

- ทุกตัว**ยกเว้น `seed.ts`** เป็น dry-run โดยปริยาย ต้องใส่ `--apply` จึงจะเขียนจริง; `seed.ts` เขียนจริงทันที และปฏิเสธเมื่อ `NODE_ENV=production` จึงต้องส่ง `ALLOW_PROD_SEED=yes` **เฉพาะในคำสั่งที่รัน** (ห้ามใส่ใน `.env`)
- ใน image `migrator` มีเฉพาะ `seed.ts` (กับ `upsert-active.ts` และ seed-guard) สคริปต์ที่เหลือต้อง `scp` ขึ้น VPS แล้ว mount ทีละไฟล์เข้าไปที่ `/app/apps/backend/prisma/` (อ่านอย่างเดียว) ไม่ต้อง build image ใหม่
- `import-ict-clo-plo.ts` อ่าน `prisma/private-data/` (เฉพาะ `table_*.csv` และ `curriculum.txt` เท่านั้น ห้ามส่งไฟล์อื่น เช่น `career-*`, `*.bak-*`, `meta.json`) และเขียนไฟล์รายงานกลับลงโฟลเดอร์นั้น จึงต้อง mount แบบ**เขียนได้** และให้เจ้าของเป็น uid 1000 (user `node` ใน image) แล้ว**ลบทิ้งทันทีเมื่อเสร็จ** เพราะเป็นข้อมูลหลักสูตรที่ไม่เปิดเผย

**เตรียมไฟล์ (บน Mac)** — แล้ววางลง VPS:

```bash
# บน Mac, ที่ root ของ repo
ssh -o ServerAliveInterval=30 root@<VPS_HOST> 'mkdir -p ~/seed-files/private-data'
scp apps/backend/prisma/{import-ict-2564,import-ict-2564-gened,import-ict-2569,seed-plo-2564,import-ict-clo-plo}.ts root@<VPS_HOST>:~/seed-files/
scp apps/backend/prisma/private-data/table_*.csv apps/backend/prisma/private-data/curriculum.txt root@<VPS_HOST>:~/seed-files/private-data/
```

```bash
# บน VPS
chown -R 1000:1000 ~/seed-files/private-data && chmod -R u+rwX ~/seed-files/private-data
```

**สร้าง `seed-all.sh` บน VPS ด้วย heredoc** (อย่าวางโค้ดสคริปต์ทั้งก้อนลง terminal ตรงๆ ให้สร้างเป็นไฟล์แล้วค่อยรัน เพราะ terminal ที่วางหลายบรรทัดอาจกิน input กลางทาง):

```bash
cat > ~/seed-all.sh <<'EOF'
#!/usr/bin/env bash
# Runs the 6 curriculum seed scripts in order. Each script except seed.ts is
# shown as a dry run first, then asks y/N before --apply.
set -euo pipefail
cd ~/eduanalyze
SRC="$HOME/seed-files"

# run_script NAME [extra docker args via EXTRA_ARGS] -- [script args]
run_script() {
  local name="$1"; shift
  local mount=()
  if [ "$name" != "seed" ]; then
    mount=(-v "$SRC/$name.ts:/app/apps/backend/prisma/$name.ts:ro")
  fi
  # -T and </dev/null: docker must not read this script's stdin (the y/N answers).
  docker compose run --rm --no-deps -T -e ALLOW_PROD_SEED=yes \
    "${mount[@]}" "${EXTRA_ARGS[@]}" migrate \
    /app/node_modules/.bin/ts-node "prisma/$name.ts" "$@" </dev/null
}

step() {
  local name="$1"
  echo; echo "=== $name: dry run ==="
  run_script "$name"
  local answer
  read -r -p "Apply $name? [y/N] " answer
  case "$answer" in
    y | Y) run_script "$name" --apply ;;
    *) echo "Stopped before $name."; exit 1 ;;
  esac
}

EXTRA_ARGS=()
echo "=== seed (writes immediately) ==="
read -r -p "Run seed.ts? [y/N] " answer
case "$answer" in y | Y) run_script seed ;; *) echo "Stopped."; exit 1 ;; esac

step import-ict-2564
step import-ict-2564-gened
step import-ict-2569
step seed-plo-2564

# Needs the private data, writable (it writes its report there), owner uid 1000.
EXTRA_ARGS=(-v "$SRC/private-data:/app/apps/backend/prisma/private-data")
step import-ict-clo-plo
echo; echo "Done. Now delete ~/seed-files/private-data and run the checks in the docs."
EOF
bash -n ~/seed-all.sh && bash ~/seed-all.sh
```

**ตรวจหลัง seed** (ไม่แสดงรหัสผ่านหรือ URL):

```bash
cd ~/eduanalyze
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select (select count(*) from courses) as courses, (select count(*) from clos) as clos, (select count(*) from users) as users"'
```

ผลที่ถูกต้อง: `courses` = **110** (43 + 17 + 50), `clos` = **129**, `users` = **0**

เมื่อเสร็จ**ลบข้อมูลหลักสูตรออกจาก VPS**:

```bash
rm -rf ~/seed-files/private-data
rm -f ~/seed-files/*.ts      # จะเก็บ .ts ไว้รันซ้ำก็ได้ เพราะไม่ใช่ข้อมูลลับ
```

หมายเหตุ: `totalCredits` ส่วนใหญ่เป็นค่าชั่วคราว 132 (จริงเฉพาะ ICT 2564 = 126 และ ICT 2569 = 120) ให้แก้เป็นค่าจริงผ่านหน้าเว็บของ SUPER_ADMIN

### 3.9 ผู้ดูแลระบบคนแรก (SUPER_ADMIN)

API ไม่อนุญาตให้สร้าง SUPER_ADMIN จึงใช้สคริปต์นี้ครั้งเดียว สคริปต์จะ **ถาม** อีเมลและชื่อ (ไม่รับเป็น argument เพื่อไม่ให้ไปอยู่ใน `ps` หรือ history):

```bash
bash ~/eduanalyze/deploy/create-first-admin.sh
```

- สร้างเฉพาะ `users` + `user_roles` (SUPER_ADMIN) + `user_auth_methods` (PASSWORD) ใน transaction เดียว ไม่สร้าง StudentProfile
- ปฏิเสธถ้ามี SUPER_ADMIN อยู่แล้ว หรืออีเมลนี้มีบัญชีแล้ว
- รหัสผ่านเริ่มต้นเป็นค่าสุ่มที่ทิ้งทันที ไม่มีใครรู้; สคริปต์แสดงเฉพาะ id และอีเมลแบบปิดบัง (เช่น `a***@ku.th`)

จากนั้นตั้งรหัสจริง: เปิด `https://eduanalyze.itkukps.tech/forgot-password` → ใส่อีเมลเดียวกัน → เปิดลิงก์ในอีเมล → ตั้งรหัส
(ขั้นนี้ทดสอบว่า Gmail SMTP ใช้ได้ไปในตัว; หน้านี้ตอบข้อความเดียวกันเสมอไม่ว่าอีเมลจะมีบัญชีหรือไม่)
แนะนำให้เปิด 2FA ให้บัญชีนี้ทันทีหลังเข้าสู่ระบบ

ข้อควรรู้ (เจอตอน deploy ครั้งแรก):
- ตั้งรหัสผ่านของบัญชีแรกผ่านปุ่ม **"ลืมรหัสผ่าน?"** ในหน้า login เท่านั้น — **ไม่ใช่แท็บสมัครสมาชิก** (อีเมลนี้มีบัญชีอยู่แล้ว การสมัครจะถูกปฏิเสธ)
- 1 อีเมลมีได้ 1 บัญชี ถ้าต้องการทดสอบหลายบทบาทด้วยกล่องจดหมายเดียว ให้ใช้ plus-address เช่น `name+staff@gmail.com`, `name+instructor@gmail.com` (อีเมลถึงกล่องเดียวกัน แต่ระบบนับเป็นคนละบัญชี)
- สคริปต์ตรวจก่อนสร้าง: ต้องพิมพ์อีเมลซ้ำเพื่อยืนยัน, ปฏิเสธโดเมนทดสอบ (`test.local`, `example.com`, `localhost`, `.local`, `.test`, `.invalid`), แสดงอีเมลแบบปิดบังแล้วถาม `y/N` ก่อนสร้างจริง

#### ลำดับสร้างบัญชีผู้ใช้

1. **SUPER_ADMIN** — สร้างด้วยสคริปต์ข้างบน
2. **STAFF** — SUPER_ADMIN สร้างผ่านหน้าเว็บ ต้องกำหนด**ขอบเขต** (คณะ/ภาควิชา/สาขา/หลักสูตร) เสมอ
3. **อาจารย์ (INSTRUCTOR)** — ไม่ใช้ขอบเขต แต่ใช้ **การมอบหมายรายวิชา**: STAFF เป็นผู้มอบหมายอาจารย์เข้ารายวิชาที่ `/staff/curriculum` (SUPER_ADMIN มอบหมายเองไม่ได้ ต้องมี STAFF ก่อน)
4. **ADMIN** สร้างได้เฉพาะ STAFF ภายในขอบเขตของตัวเองเท่านั้น

### 3.10 กุญแจ SSH: ของคุณเอง และของ GitHub Actions (จำกัดสิทธิ์)

**ก. กุญแจส่วนตัวของคุณ** (ใช้เข้า shell แทนรหัสผ่าน — ต้องมีก่อนปิดรหัสผ่านในข้อ 3.11):

```bash
ls ~/.ssh/id_ed25519.pub || ssh-keygen -t ed25519 -C "patcharad-mac"
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@179.197.241.30            # ใส่รหัส root
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes root@179.197.241.30 'echo personal key ok'
```

**ข. กุญแจ deploy** (สร้างใหม่เฉพาะงานนี้) แล้วติดตั้งพร้อม `restrict,command=...` ในบรรทัดเดียวกัน:

```bash
ssh-keygen -t ed25519 -C "github-actions-eduanalyze" -f ~/.ssh/eduanalyze_deploy -N ""
printf 'restrict,command="/root/eduanalyze/deploy/ssh-deploy-gate.sh" %s\n' "$(cat ~/.ssh/eduanalyze_deploy.pub)" \
  | ssh -i ~/.ssh/id_ed25519 root@179.197.241.30 'umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys'
```

- `restrict` = ไม่มี shell (pty), ไม่ forward port/agent/X11
- `command=` = ไม่ว่า client จะขออะไร sshd จะรัน `ssh-deploy-gate.sh` แทน สคริปต์อ่าน `SSH_ORIGINAL_COMMAND` แล้วยอมรับแค่ `deploy sha-<hex 7-40 ตัว>` (regex `^deploy (sha-[0-9a-f]{7,40})$`) จากนั้นเรียก `remote-deploy.sh <แท็ก>` อย่างอื่นปฏิเสธทั้งหมด (scp ก็ใช้ไม่ได้)

ทดสอบว่าถูกจำกัดจริง (`-o IdentitiesOnly=yes` สำคัญ: บังคับใช้เฉพาะกุญแจ deploy ไม่ให้ ssh-agent ส่งกุญแจส่วนตัวแทน):

```bash
ssh -i ~/.ssh/eduanalyze_deploy -o IdentitiesOnly=yes root@179.197.241.30 'ls /'               # ต้องได้ "Refused: this key may only run 'deploy sha-<hex>'."
ssh -i ~/.ssh/eduanalyze_deploy -o IdentitiesOnly=yes root@179.197.241.30                       # ไม่มี shell: Refused เช่นกัน
ssh -i ~/.ssh/eduanalyze_deploy -o IdentitiesOnly=yes root@179.197.241.30 'deploy sha-zzz'      # แท็กผิดรูปแบบ: Refused
ssh -i ~/.ssh/eduanalyze_deploy -o IdentitiesOnly=yes root@179.197.241.30 'deploy sha-xxxxxxx'  # (แท็กจริงจากข้อ 3.1) deploy ได้
```

**ค. host key ของ VPS (สำหรับ `VPS_SSH_KNOWN_HOSTS`)** — ได้มาแล้วต้องเทียบ fingerprint ก่อนใช้:

```bash
# บน Mac
ssh-keyscan -t ed25519 179.197.241.30 2>/dev/null > /tmp/eduanalyze_known_hosts
ssh-keygen -lf /tmp/eduanalyze_known_hosts
# บน VPS (เซสชันที่เข้าอยู่แล้ว หรือ Browser terminal ของ hPanel)
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

ค่า `SHA256:...` สองบรรทัดต้องตรงกันทุกตัวอักษร ถ้าไม่ตรง **หยุด** อย่าใช้ไฟล์นั้น (อาจมีคนดักกลางทาง)

**ง. ตั้งค่าใน GitHub:** repo → Settings → Secrets and variables → Actions

**Secrets** (แท็บ Secrets → New repository secret) — ต้องครบ 4 ตัวแรก ไม่งั้น job deploy จะถูกข้าม:

| ชื่อ | ค่า |
|---|---|
| `VPS_HOST` | `179.197.241.30` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | เนื้อหาไฟล์ `~/.ssh/eduanalyze_deploy` (private key) — `pbcopy < ~/.ssh/eduanalyze_deploy` แล้ววางในช่องของ GitHub |
| `VPS_SSH_KNOWN_HOSTS` | เนื้อหา `/tmp/eduanalyze_known_hosts` ที่เทียบ fingerprint แล้ว — `pbcopy < /tmp/eduanalyze_known_hosts` |
| `VPS_PORT` | ไม่ต้องตั้ง (ใช้ 22) |

**Variables** (แท็บ Variables, ไม่บังคับ — ถ้าไม่ตั้งจะใช้ค่า production ในวงเล็บ):

| ชื่อ | ค่า |
|---|---|
| `PUBLIC_URL` | `https://eduanalyze.itkukps.tech` (เปิดการตรวจ health จากภายนอกหลัง deploy) |
| `NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN` | `true` เมื่อกรอก Google OAuth ใน `.env` แล้ว (ค่าเริ่ม `false`) |
| `NEXT_PUBLIC_API_URL` | (`https://eduanalyze.itkukps.tech/api`) |
| `NEXT_PUBLIC_SELF_SIGNUP_DOMAINS` | (`ku.th`) — ห้ามใส่ `test.local` |
| `NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES` / `NEXT_PUBLIC_IDLE_WARNING_SECONDS` / `NEXT_PUBLIC_SESSION_MAX_HOURS` | (`30` / `60` / `8`) |

ค่า `NEXT_PUBLIC_*` ถูกฝังตอน build: เปลี่ยนแล้วต้อง Run workflow `Deploy` ใหม่

ลบไฟล์ชั่วคราว: `rm /tmp/eduanalyze_known_hosts`

### 3.11 ปิดการ login ด้วยรหัสผ่าน (หลังกุญแจส่วนตัวใช้ได้แล้วเท่านั้น)

กันตัวเองถูกล็อก: **เปิด Browser terminal ของ hPanel ไว้หนึ่งหน้าต่าง และเปิดเซสชัน SSH ค้างไว้อีกหนึ่ง** ตลอดขั้นนี้
ถ้ามีคนอื่นที่ยัง login เครื่องนี้ด้วยรหัสผ่าน ให้เขามีกุญแจก่อน

ในเซสชันที่เปิดค้างไว้ (root):

```bash
cat > /etc/ssh/sshd_config.d/00-eduanalyze-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
sshd -t && sshd -T | grep -Ei '^(passwordauthentication|kbdinteractiveauthentication|permitrootlogin)'
# ต้องได้: passwordauthentication no / kbdinteractiveauthentication no / permitrootlogin without-password
systemctl reload ssh
```

ชื่อไฟล์ขึ้นต้น `00-` เพราะ sshd ใช้ค่าแรกที่เจอ และไฟล์อื่นใน `sshd_config.d/` (เช่น `50-cloud-init.conf`) อาจตั้ง `PasswordAuthentication yes` ไว้

ทดสอบจาก Mac ในหน้าต่างใหม่ **ก่อน** ปิดเซสชันเดิม:

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes root@179.197.241.30 'echo key login ok'   # ต้องผ่าน
ssh -o PubkeyAuthentication=no -o PreferredAuthentications=password root@179.197.241.30  # ต้องได้ Permission denied (publickey)
```

ถ้าเข้าด้วยกุญแจไม่ได้: ใน Browser terminal ของ hPanel รัน `rm /etc/ssh/sshd_config.d/00-eduanalyze-hardening.conf && systemctl reload ssh` แล้วแก้กุญแจก่อน

### Google login (ถ้าจะเปิดใช้)

1. ใน `.env` บน VPS ต้องมี `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL=https://eduanalyze.itkukps.tech/api/auth/google/callback` — ตรวจโดย**ไม่แสดงค่า**:
   ```bash
   grep -E '^GOOGLE_(CLIENT_ID|CLIENT_SECRET|CALLBACK_URL)=.+' ~/eduanalyze/.env | sed 's/=.*/=<ตั้งแล้ว>/'
   ```
   ต้องเห็น 3 บรรทัด
2. Google Cloud Console → APIs & Services → Credentials → OAuth client (Web application):
   - Authorized redirect URI: `https://eduanalyze.itkukps.tech/api/auth/google/callback`
   - Authorized JavaScript origin: `https://eduanalyze.itkukps.tech`
3. GitHub → Settings → Variables: ตั้ง `NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN=true` — เป็นค่าที่**ฝังตอน build** ของ frontend จึง**ต้อง Run workflow `Deploy` ใหม่** หลังตั้ง ปุ่ม Google ถึงจะขึ้น (แค่แก้ `.env` บน VPS ไม่พอ)

### 3.12 Deploy ผ่าน GitHub Actions

Actions → `Deploy` → Run workflow → branch `main` → (เว้น `rollback_tag` ว่าง) → Run
ต้องเห็นทั้ง 3 job เขียว และขั้น `Public health check` ผ่าน ต่อไปทุกครั้งที่ push main แล้ว CI ผ่าน ระบบจะ deploy เอง

---

## 4. ตรวจหลัง deploy

- [ ] `curl -s https://eduanalyze.itkukps.tech/api/health` → `{"status":"ok"}`
- [ ] `curl -sI https://eduanalyze.itkukps.tech/login` มี `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` อย่างละหนึ่งบรรทัด
- [ ] `http://eduanalyze.itkukps.tech` redirect ไป `https://`
- [ ] เข้าสู่ระบบด้วย SUPER_ADMIN ได้; DevTools → Application → Cookies: cookie refresh เป็น `Secure` + `HttpOnly`
- [ ] สมัครเองด้วยอีเมล `@ku.th` จริงของคุณเอง → อีเมลยืนยันมาถึง → สมัครเสร็จ
- [ ] สมัครด้วยอีเมลโดเมนอื่น (เช่น `@gmail.com`) → ถูกปฏิเสธ
- [ ] "ลืมรหัสผ่าน" → อีเมลมาถึง (ถ้าไม่มา: `cd ~/eduanalyze && docker compose logs backend | grep -i email`)
- [ ] (ถ้าเปิด Google) ปุ่ม Google ใช้ได้และกลับมาที่ `/api/auth/google/callback` ถูกต้อง
- [ ] การวิเคราะห์ด้วย AI ตอบข้อความไทย "ไม่สามารถให้บริการได้ในขณะนี้" (ปิดไว้ตามหัวข้อ 8)
- [ ] `https://itkukps.tech` (equipment) และแอป Lab ยังทำงานปกติ

---

## 5. Rollback และเมื่อ deploy ล้ม

ทุก deploy ที่สำเร็จด้วยแท็ก `sha-xxxxxxx` ถูกต่อท้ายใน `~/eduanalyze/.image-tag-history` (`<เวลา UTC> <แท็ก>`) และแท็กที่รันอยู่ก่อนหน้าถูกเขียนใน `~/eduanalyze/.previous-image-tag`
(`latest` ไม่ถูกบันทึกเป็น previous) ทุก deploy มี backup DB ชื่อ `*_pre-deploy.dump` ก่อนเสมอ

**ถ้า deploy ล้ม** (pull ไม่ได้, migrate ล้ม, หรือ health ไม่ผ่านภายใน 3 นาที):
- `IMAGE_TAG` ใน `.env` ถูกคืนเป็นค่าเดิมอัตโนมัติ
- log ของ Actions แสดงแค่ `docker compose ps` และคำสั่ง rollback; log ละเอียดอยู่บน VPS เท่านั้นที่ `~/eduanalyze/logs/deploy-<เวลา>-<แท็ก>.log` (สิทธิ์ 600)
- ถ้า migrate ล้ม container เดิมยังรันอยู่ (backend ไม่ถูกแทน); ถ้า health ล้ม container ใหม่อาจยังรันอยู่ ให้ rollback ตามข้อความที่แสดง

**วิธี rollback** (เลือกแท็กจาก `tail ~/eduanalyze/.image-tag-history` หรือ `cat ~/eduanalyze/.previous-image-tag`):
- **ทาง GitHub:** Actions → `Deploy` → Run workflow → `rollback_tag` = แท็กเก่า → ข้ามการ build แล้วสั่ง `deploy <แท็ก>` แบบเดียวกับ deploy ปกติ (ไม่คัดลอกไฟล์)
- **ทาง VPS:**

```bash
bash ~/eduanalyze/deploy/remote-deploy.sh "$(cat ~/eduanalyze/.previous-image-tag)"
```

ข้อควรระวัง: rollback ไม่ย้อน migration ของ DB ถ้าเวอร์ชันใหม่มี migration ที่ทำให้เวอร์ชันเก่าใช้ไม่ได้ ต้องคืน DB จาก backup ก่อน deploy:

```bash
cd ~/eduanalyze
bash deploy/backup-db.sh before-restore                      # สำรองสถานะปัจจุบันไว้ก่อน
ls -lt backups/ | head                                       # เลือกไฟล์ *_pre-deploy.dump ที่ถูกต้อง
bash deploy/restore-test.sh backups/<ไฟล์>.dump              # ยืนยันว่าไฟล์ใช้ได้
docker compose stop frontend backend
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction --exit-on-error' < backups/<ไฟล์>.dump
bash deploy/remote-deploy.sh <แท็กเก่า>
```

`--single-transaction --exit-on-error` ทำให้ถ้ามีข้อผิดพลาดใดๆ การ restore ทั้งหมดถูกยกเลิก DB อยู่ในสภาพเดิม ไม่ค้างครึ่งๆ กลางๆ

---

## 6. สำรองข้อมูลและทดสอบ restore

ก่อนตั้ง cron ให้แน่ใจว่ามีโฟลเดอร์ (make-env.sh สร้างให้แล้ว; คำสั่งนี้รันซ้ำได้):

```bash
mkdir -m 700 -p ~/eduanalyze/backups ~/eduanalyze/logs
```

สำรองทุกวัน 03:15 (บน VPS, root): `crontab -e` แล้วเพิ่มบรรทัด

```text
15 3 * * * /root/eduanalyze/deploy/backup-db.sh daily >> /root/eduanalyze/backups/backup.log 2>&1
```

- ไฟล์อยู่ที่ `~/eduanalyze/backups/` (สิทธิ์ 700/600) เก็บ 14 วัน (`KEEP_DAYS`) ไม่ส่งออกนอกเครื่อง
- ทดสอบ restore อย่างน้อยหลังตั้ง cron และเดือนละครั้ง:

```bash
bash ~/eduanalyze/deploy/backup-db.sh manual
bash ~/eduanalyze/deploy/restore-test.sh        # ใช้ไฟล์ล่าสุด, ต้องจบด้วย "restore test passed"
```

`restore-test.sh` เปิด postgres:16.15 ชั่วคราวชื่อ `eduanalyze-restore-test` แบบไม่มี network แล้วลบทิ้งพร้อมข้อมูลเมื่อจบ ไม่แตะ DB จริง

---

## 7. งานดูแลประจำ

```bash
cd ~/eduanalyze
docker compose ps
docker compose logs --tail 100 backend
docker compose restart backend
ls -lt logs/ | head                                       # log ของ deploy ที่ล้ม
df -h /                                                   # ดิสก์
docker image ls 'ghcr.io/patcharadnaimingchua/*'          # image เก่าสะสม
docker image rm ghcr.io/patcharadnaimingchua/eduanalyze-ai-backend:sha-<แท็กเก่ามาก>   # ลบทีละแท็กที่ไม่ใช้แล้ว
```

ห้ามใช้ `docker compose down -v`, `docker volume rm/prune`, `docker system prune` บน VPS นี้ (จะลบข้อมูลของแอปนี้หรือของแอปอื่น)
หยุดระบบด้วย `docker compose stop` เท่านั้น

### 7.1 อัปเดต compose/สคริปต์บน VPS (ทำเองด้วย scp)

GitHub Actions ไม่คัดลอกไฟล์ขึ้น VPS แล้ว เมื่อ commit ใดเปลี่ยน `docker-compose.yml` หรือ `deploy/*.sh`
ให้คัดลอกขึ้น VPS **ก่อน** push (หรือก่อน Run workflow) — ห้ามแก้ไฟล์เหล่านี้บน VPS ตรงๆ ให้แก้ใน repo แล้ว scp:

```bash
cd ~/Downloads/Projects/eduanalyze-ai
scp docker-compose.yml root@179.197.241.30:eduanalyze/
scp deploy/*.sh root@179.197.241.30:eduanalyze/deploy/
ssh root@179.197.241.30 'chown -R root:root ~/eduanalyze/deploy && chmod 700 ~/eduanalyze/deploy ~/eduanalyze/deploy/*.sh'
```

`deploy/nginx.conf` ไม่ต้องคัดลอกซ้ำ (certbot แก้ไฟล์บน VPS ไปแล้ว ดูข้อ 3.7)

### 7.2 กู้คืน SUPER_ADMIN คนเดียวที่ถูกระงับหรือถูกล็อก

`create-first-admin.sh` จะปฏิเสธเพราะยังมีแถว SUPER_ADMIN อยู่ ให้เปิดบัญชีเดิมกลับด้วย SQL (backup ก่อนเสมอ):

```bash
cd ~/eduanalyze
bash deploy/backup-db.sh before-admin-recovery
read -r -p "อีเมล SUPER_ADMIN: " ADMIN_EMAIL && export ADMIN_EMAIL
docker compose exec -T -e ADMIN_EMAIL postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
\getenv email ADMIN_EMAIL
UPDATE users
   SET "isActive" = true, "lockedUntil" = NULL, "failedLoginAttempts" = 0, "updatedAt" = now()
 WHERE lower(email) = lower(:'email')
   AND id IN (SELECT "userId" FROM user_roles WHERE role = 'SUPER_ADMIN');
SQL
unset ADMIN_EMAIL
```

- ต้องได้ `UPDATE 1` (ถ้าได้ `UPDATE 0` แปลว่าอีเมลไม่ตรงหรือบัญชีนั้นไม่ใช่ SUPER_ADMIN — ไม่มีอะไรเปลี่ยน)
- อีเมลส่งผ่าน environment และ `\getenv` จึงไม่อยู่ใน argv และถูก quote อย่างปลอดภัยด้วย `:'email'`
- ถ้าจำรหัสไม่ได้ ใช้หน้า "ลืมรหัสผ่าน" ต่อ; ถ้าเสียอุปกรณ์ 2FA ด้วย ลบแถว 2FA ของบัญชีนั้นตามที่ระบุใน comment ของ `TwoFactorCredential` ใน `schema.prisma`

### 7.3 สิ่งที่มีวันหมดอายุ

- **VPS หมดอายุ 2026-11-11** — ต่ออายุล่วงหน้า (แนะนำภายใน 2026-11-04) เพราะ backup อยู่บนเครื่องเดียวกัน ถ้า VPS ถูกลบ ข้อมูลและ backup หายพร้อมกัน
- token `read:packages` ตามวันหมดอายุที่ตั้งไว้ (ต่อแล้ว `docker login ghcr.io` ใหม่)
- ใบรับรอง certbot ต่ออายุเองอัตโนมัติ (ตรวจด้วย `certbot renew --dry-run`)
- PR จาก Dependabot (action/base image): ตรวจแล้ว merge ตามปกติ CI จะรันก่อนเสมอ

---

## 8. PDPA และข้อมูลจริง

- **ห้ามนำเข้าหรือกรอกข้อมูลนิสิตจริง** (รายชื่อ, รหัสนิสิต, ผลการเรียน) จนกว่าจะครบทั้งสองข้อ:
  1. นโยบายความเป็นส่วนตัว/การแจ้งเตือน (privacy notice) ได้รับการตรวจและอนุมัติแล้ว
  2. ทดสอบ restore (ข้อ 6) ผ่านแล้วบน VPS นี้
- ช่วงทดสอบใช้เฉพาะบัญชีของตัวเองและข้อมูลสมมติ
- **AI analysis ปิดบน production** (`ANTHROPIC_API_KEY=disabled`): endpoint ตอบ 503 ข้อความไทยทั่วไป **ก่อน** อ่านข้อมูลนิสิตหรือส่งอะไรออกไป
  เปิดได้ (ใส่คีย์จริงใน `.env`) ก็ต่อเมื่อ privacy policy ระบุการส่งข้อมูลผลการเรียนให้ผู้ให้บริการภายนอก (Anthropic) แล้ว **และ** มหาวิทยาลัยอนุญาต
- ไฟล์ backup, `logs/` และ `.env` / `db.env` มีข้อมูลส่วนบุคคลและความลับ: ห้ามส่งออกนอกเครื่อง ห้าม commit ห้ามแนบในแชท
