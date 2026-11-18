# RCM · Report Studio

เว็บรายงานภาษาไทย ใช้ **Next.js + TypeScript + Tailwind CSS v4** พร้อม API ฝั่งเซิร์ฟเวอร์ด้วย TypeScript / MySQL2

## Deploy ด้วย Docker — พอร์ต 9000

เปิด Docker Desktop แล้วรันในโฟลเดอร์โปรเจกต์:

```powershell
Copy-Item .env.example .env
docker compose up -d --build
```

เปิด http://localhost:9000 โดยค่าเริ่มต้นเป็นข้อมูลตัวอย่าง

```powershell
docker compose ps
docker compose logs --tail=50
docker compose down
```

หากเปลี่ยนค่าฐานข้อมูลใน `.env` ให้รัน `docker compose up -d --force-recreate`

กรณีฐานข้อมูลอยู่บนเครื่องเดียวกับ Docker Desktop ให้ใช้ `RCM_DB_HOST=host.docker.internal` หรือ `HOSXP_DB_HOST=host.docker.internal` กรณีอยู่บนเครื่องโรงพยาบาลอีกเครื่องให้ใช้ IP หรือชื่อเซิร์ฟเวอร์ที่ container เข้าถึงได้

ก่อนใช้ข้อมูลจริงผ่าน Docker ตั้ง `DEMO_MODE=false` และกรอก `HOSXP_DB_*` ใน `.env` จากนั้นเปิดเว็บผ่าน HTTPS และเข้าสู่ระบบด้วยบัญชี HOSxP เว็บตรวจ `opduser.loginname` และ `opduser.passweb` (MD5 ตามโครงสร้างเดิม) และปฏิเสธบัญชีที่ `account_disable` ระบุว่าถูกปิด หากต้องการจำกัดกลุ่มผู้ใช้ ให้ระบุค่า `opduser.groupname` ใน `HOSXP_LOGIN_GROUPS` คั่นด้วยจุลภาค

โหมดทดลองเข้าผ่านปุ่ม “เข้าโหมดทดลอง” และใช้ข้อมูลสมมติ บัญชี HOSxP ใช้ได้เมื่อเปิดโหมดข้อมูลจริงเท่านั้น เซสชันหมดอายุใน 8 ชั่วโมงหรือเมื่อรีสตาร์ตเว็บ

Image ไม่บรรจุ `.env` เข้าไป ใช้ส่งค่าเข้าฝั่งเซิร์ฟเวอร์ผ่าน Compose ตอนรัน และรันด้วยผู้ใช้ node ที่ไม่ใช่ root

## เริ่มใช้งานโดยไม่ใช้ Docker

ต้องมี Node.js 22.13 ขึ้นไป (แนะนำ 24 LTS)

```powershell
npm ci
Copy-Item .env.example .env
npm run build
npm start
```

เปิด http://127.0.0.1:9000 หรือดับเบิลคลิก `เริ่มเว็บ.cmd` หลังติดตั้งแพ็กเกจแล้ว

`npm run dev` เปิดหน้าเว็บแบบแก้แล้วอัปเดตอัตโนมัติ พร้อม API ล็อกอินและรายงานที่ http://127.0.0.1:3000 โดยอ่าน `.env` ในโฟลเดอร์เดียวกับ `package.json` เมื่อเริ่มโปรแกรม กด Ctrl+C แล้วรัน `npm run dev` อีกครั้งหลังแก้ `.env` ตั้ง `DEMO_MODE=false` พร้อมค่า `HOSXP_DB_*` เพื่อทดสอบล็อกอิน HOSxP และเพิ่ม `RCM_DB_*` สำหรับรายงาน RCM

`npm start` เปิดเว็บที่ build แล้ว ส่วน Docker ใช้พอร์ต 9000

ในโหมด dev ค่า `DEMO_MODE` และ `*_DB_*` ที่อยู่ในไฟล์ `.env` มีลำดับก่อนค่าจาก shell เทอร์มินัลจะแสดงพาธไฟล์ แหล่งที่มาของค่าโหมด และสถานะการตั้งค่า โดยไม่แสดงข้อมูลเชื่อมต่อ

## ตั้งค่าฐานข้อมูล

แก้ `.env` เฉพาะฝั่งเซิร์ฟเวอร์:

```dotenv
DEMO_MODE=false
RCM_DB_HOST=YOUR_RCM_SERVER
RCM_DB_PORT=3306
RCM_DB_NAME=rcmdb
RCM_DB_USER=YOUR_READ_ONLY_USER
RCM_DB_PASSWORD=YOUR_PASSWORD
RCM_DB_CHARSET=TIS620_THAI_CI

HOSXP_DB_HOST=YOUR_HOSXP_SERVER
HOSXP_DB_PORT=3306
HOSXP_DB_NAME=hos
HOSXP_DB_USER=YOUR_READ_ONLY_USER
HOSXP_DB_PASSWORD=YOUR_PASSWORD
HOSXP_DB_CHARSET=TIS620_THAI_CI
```

โหมดข้อมูลจริงต้องตั้ง HOSxP เพื่อเข้าสู่ระบบ ตั้ง RCM เพิ่มเมื่อจะเปิดรายงานที่อ่านจาก RCM ถ้าใช้ UTF-8 ให้เปลี่ยน charset ตามฐานข้อมูล เช่น `UTF8MB4_UNICODE_CI` แล้วรีสตาร์ตเซิร์ฟเวอร์

ใช้บัญชีที่มีสิทธิ SELECT เฉพาะตารางรายงาน โปรแกรมใช้คำสั่ง SELECT ที่กำหนดไว้และ transaction แบบ READ ONLY ไม่เรียกใช้ script, EXE หรือ SQL จาก ZIP ไม่แก้ไขตารางเดิม

เมื่อเชื่อมข้อมูลจริง ตัวกรองช่วงเวลาเลือก “กำหนดวันที่เอง” เพื่อดูข้อมูลปีอื่นได้ ตัวเลขจะไม่สลับกลับไปเป็นข้อมูลตัวอย่างเมื่อเชื่อมต่อล้มเหลว

## รายงาน

| รายงาน | ตาราง | วันที่ | ยอดเรียกเก็บ | ยอดชดเชย/ชำระ |
|---|---|---|---|---|
| ตอบกลับ REP | RCM.repdata | AdmDate | Collected | Compensated |
| ตอบกลับ e-Claim | RCM.repeclaim | AdmDate | Collected | Compensated |
| ตอบกลับ FDH | RCM.repfdh | AdmDate | Collected | Compensated |
| สถานะส่งเบิก | RCM.repstatus | AdmDate | Collected | Compensated |
| Seamless | RCM.seamless | AdmDate | Collected | Compensated |
| รับชำระ KTB | RCM.ktb | KTBDate | Income | Amount |
| HOSxP OPD | HOSxP.vn_stat | vstdate | income | paid_money |
| HOSxP IPD | HOSxP.an_stat | dchdate | income | paid_money |

ตาราง RCM อ้างอิง schema ที่พบใน `RCM161169.zip` ส่วน vn_stat/an_stat ตรวจคอลัมน์จริงเมื่อเชื่อมต่อ รุ่นโครงสร้างที่ต่างกันอาจต้องปรับ mapping ใน `server.ts` ทดสอบ e-Claim และ KTB กับ MariaDB ที่มีข้อมูลสมมติแล้ว ผลเทียบกับฐานโรงพยาบาลจริงยังรอการทดสอบ

“ส่วนต่างรอชดเชย” = ผลรวม `max(0, เรียกเก็บ - ชดเชย)` ใช้ติดตามรายการ ไม่ใช่การกระทบยอดลูกหนี้ตามบัญชี รายงาน HOSxP ใช้ยอด paid_money ซึ่งไม่ใช่ยอดเงินชดเชยกองทุน สิทธิจาก HOSxP จะแสดงเป็นรหัส pttype ตามจริง ยังไม่ join ตารางชื่อสิทธิ

ข้อมูลตัวอย่างเป็นข้อมูลสร้างขึ้นทั้งหมด ไม่ได้ดึงข้อมูลผู้ป่วยจาก ZIP

## ความสามารถ

- ภาพรวม ติดตามชดเชย รายการรอชดเชย และรายงานตามช่วงวันที่ 8 ชุด พร้อมคลังเมนูอ้างอิงจากต้นฉบับ
- เปิดและส่งออก 3 รายงานอ้างอิง HOSxP จาก SQL4RCM.SQL ได้แก่ ค่าธรรมเนียมสิทธิ หมวดบัญชีค่ารักษา และค่ารักษาพยาบาล V4
- เปิดและส่งออก 18 เมนูในหมวด 5.1.1.3 สรุปกองทุน REP จาก RCM `repdata` ใช้วันส่งเบิกและเลือกถึงสิ้นวันของวันที่สิ้นสุด รวมยอดตาม `SubFund` และคงเงื่อนไข OPD/IPD กับสิทธิของแต่ละเมนู หากหนึ่ง `SubFund` มีหลาย `Fund` เว็บแสดงค่าต่ำสุดของ `Fund` ในกลุ่มเพื่อให้ผลคงที่ โดยยังรวมยอดทั้งหมดของ `SubFund` เช่นเดิม
- ตรวจไฟล์และเทียบยอด CSV จากไฟล์ยอดเรียกเก็บและไฟล์ตอบกลับตาม `claim_id` ตรวจรายการซ้ำ รูปแบบจำนวนเงิน และส่งออกผลเทียบยอด ไฟล์ถูกอ่านในเบราว์เซอร์
- กรองช่วงเวลา สิทธิ ประเภทบริการ และสถานะ
- ค้นหา HN / เลขที่รายการ / รหัสข้อผิดพลาด และแบ่งหน้า
- ดูรายละเอียดแถว และส่งออก CSV ทุกแถวตามตัวกรองโดยไม่ต้องเปลี่ยนหน้า
- “ส่งออกทุกชุด” สร้าง ZIP แยก CSV ตามรายงาน รายงานตามช่วงเวลาใช้ช่วงวันที่จากหน้าเว็บและครอบคลุมทุกสิทธิ ส่วนรายงานอ้างอิงส่งออกทุกแถว อ่าน `export-status.csv` เพื่อตรวจจำนวนแถวและผลของแต่ละชุด รายงานที่ยังอยู่ระหว่างย้ายจากต้นฉบับอยู่ในคลังเมนูอ้างอิง
- พิมพ์ / บันทึก PDF ผ่านเมนูพิมพ์ของเบราว์เซอร์
- หน้าจอปรับตามมือถือและเดสก์ท็อป

เมื่อรันโดยไม่ใช้ Docker เซิร์ฟเวอร์ฟังที่ localhost โดยปริยาย หากเปิดใช้งานจริงใน LAN ให้ใช้ reverse proxy HTTPS ของหน่วยงาน เว็บตรวจสิทธิ์เข้าระบบตามบัญชี HOSxP และกลุ่มที่ตั้งไว้ ผู้ใช้ที่ผ่านการตรวจเข้าถึงรายงานชุดเดียวกัน

## การตรวจสอบ

```powershell
npm test
npm run typecheck
npm run build
```

## โครงสร้าง

- `app/page.tsx` — หน้าจอและ interaction
- `app/globals.css` — Tailwind theme และ print styles
- `lib/reports.ts` — ประเภทรายงานและข้อมูลตัวอย่าง
- `lib/query.ts` — ตรวจตัวกรอง
- `server.ts` — static server และ API อ่าน MySQL ผ่าน .env
- `out/` — หน้าเว็บที่ build แล้ว

ชุดนี้ deploy ผ่าน Docker ที่พอร์ต 9000 ทั้งหน้าเว็บและ API อยู่ใน container เดียวกัน ค่าเชื่อมต่อฐานข้อมูลอ่านจาก `.env` ตอนรัน
