# 🩺 DM Remission Health Cloud (Firestore & GitHub Ready)

เว็บแอปพลิเคชันสารสนเทศทางการแพทย์ สำหรับบันทึก ติดตาม และวิเคราะห์ผลตัวชี้วัดสุขภาพในการเข้าสู่ภาวะสงบของเบาหวาน (**Diabetes Mellitus Remission Program - 20 สัปดาห์**) พร้อมระบบความปลอดภัยระดับสากล (OWASP Top 10, PDPA, HIPAA) รองรับฐานข้อมูล **Google Cloud Firestore (Firebase)**

---

## 🚀 1. วิธีนำโปรเจกต์ขึ้น GitHub (Push to GitHub)

โปรเจกต์นี้ได้รับการตั้งค่า Git และทำ Initial Commit พร้อม `.gitignore` ป้องกันคีย์ลับรั่วไหลไว้ให้เรียบร้อยแล้ว ท่านสามารถนำขึ้น GitHub ได้ด้วยขั้นตอนง่ายๆ ดังนี้:

### ขั้นตอนที่ 1: สร้าง Repository บน GitHub
1. ไปที่ [GitHub.com](https://github.com) แล้วลงชื่อเข้าใช้
2. คลิกปุ่ม **New** (หรือเครื่องหมาย `+` มุมขวาบน) เพื่อสร้าง Repository ใหม่
3. ตั้งชื่อ Repository เช่น `dm-remission-app`
4. เลือกระดับความปลอดภัยเป็น **Private** (แนะนำสำหรับระบบข้อมูลสุขภาพ) หรือ Public
5. **ไม่ต้องติ๊ก** "Add a README file" หรือ ".gitignore" (เพราะในโปรเจกต์มีครบแล้ว)
6. คลิก **Create repository**

### ขั้นตอนที่ 2: เชื่อมโยงและ Push โค้ดขึ้น GitHub
เปิด Terminal / PowerShell ในโฟลเดอร์นี้ แล้วรันคำสั่ง:

```bash
# 1. เชื่อมโยงไปยัง GitHub Repository ของท่าน (แทนที่ <username> และ <repo-name> ด้วยของท่าน)
git remote add origin https://github.com/<username>/<repo-name>.git

# 2. ทำการ Push โค้ดทั้งหมดขึ้น GitHub
git push -u origin main
```

*(หมายเหตุ: ไฟล์สำคัญที่เป็นความลับ เช่น `serviceAccountKey.json`, `.env`, และไฟล์ฐานข้อมูล จะถูก `.gitignore` ป้องกันไม่ให้อัปโหลดขึ้น GitHub โดยอัตโนมัติ เพื่อความปลอดภัยสูงสุด)*

---

## 🔥 2. วิธีเชื่อมต่อ Google Cloud Firestore | Firebase

ระบบรองรับ **Google Cloud Firestore** ผ่าน `firebase-admin` SDK ซึ่งมีความปลอดภัยสูงสุดและควบคุมสิทธิ์ผ่าน Server-side ได้อย่างสมบูรณ์แบบ:

### ขั้นตอนที่ 1: สร้าง Firebase Project และเปิดใช้งาน Firestore
1. ไปที่ [Firebase Console](https://console.firebase.google.com/) แล้วคลิก **"Create a project"** (หรือเพิ่มโปรเจกต์)
2. ตั้งชื่อโปรเจกต์ เช่น `dm-remission-health` แล้วกด Create
3. ในแถบเมนูด้านซ้าย ไปที่ **Build** &rarr; **Firestore Database**
4. คลิก **"Create database"** &rarr; เลือก Location (เช่น `asia-southeast1` สิงคโปร์ เพื่อความเร็วสูงสุดในไทย)
5. เลือกโหมด **"Start in production mode"** แล้วกด Create

### ขั้นตอนที่ 2: ดาวน์โหลด Service Account Key
1. ที่มุมบนซ้ายข้าง Project Overview คลิกที่ไอคอนเฟือง ⚙️ &rarr; **Project settings**
2. ไปที่แท็บ **"Service accounts"**
3. คลิกปุ่ม **"Generate new private key"** (สร้างคีย์ส่วนตัวใหม่)
4. ไฟล์ JSON จะถูกดาวน์โหลดลงเครื่อง ให้เปลี่ยนชื่อไฟล์นั้นเป็น:
   ```
   serviceAccountKey.json
   ```
5. นำไฟล์ `serviceAccountKey.json` มาวางไว้ที่ **โฟลเดอร์หลักของโปรเจกต์นี้** (`c:\Antigravity\remission001\`)

### ขั้นตอนที่ 3: สั่ง Seed ข้อมูลตั้งต้นเข้าสู่ Firestore
เมื่อวางไฟล์ `serviceAccountKey.json` เรียบร้อยแล้ว ให้รันคำสั่ง:

```bash
npm run seed:firestore
```

ระบบจะทำการสร้าง Collections และนำเข้าข้อมูลตั้งต้นไปยัง Firestore อัตโนมัติ:
* 👥 **`users`**: บัญชี Admin, Doctor (นพ.สมชาย), Patient (นายสมศักดิ์)
* 🗂️ **`patients`**: ข้อมูลคนไข้ 3 ราย (HN-68001, HN-68002, HN-68003) พร้อมเลขประจำตัวประชาชน 13 หลัก
* 📊 **`health_records`**: ข้อมูลสุขภาพ 4 สัปดาห์แรก (28 วัน) คำนวณกราฟความดัน น้ำตาล และก้าวเดิน
* 🛡️ **`audit_logs`**: บันทึกประวัติความปลอดภัยการย้ายข้อมูล

---

## 🌟 โครงสร้างข้อมูลบน Cloud Firestore (Collections Hierarchy)

```
firestore/
├── users/ (คอลเลกชันผู้ใช้งานระบบ)
│   ├── admin
│   ├── dr.somchai
│   └── patient01
│
├── patients/ (คอลเลกชันผู้ป่วยรายบุคคล)
│   ├── 1/ (HN-68001 นายสมศักดิ์ สุขใจ)
│   │   └── health_records/ (Subcollection ข้อมูลสุขภาพรายวัน 20 สัปดาห์)
│   │       ├── w1_d1 (สัปดาห์ 1 วันที่ 1)
│   │       ├── w1_d2 ...
│   │       └── w4_d7 (สัปดาห์ 4 วันที่ 7)
│   ├── 2/ (HN-68002 นางวิภาวรรณ มีสุข)
│   └── 3/ (HN-68003 นายประเสริฐ เกษมสุข)
│
└── audit_logs/ (เก็บบันทึกประวัติการเข้าดูและแก้ไขตามมาตรฐาน PDPA)
```

---

## 💻 3. คำสั่งที่ใช้งานบ่อย (Commands Reference)

| คำสั่ง | คำอธิบาย |
| :--- | :--- |
| `npm start` | เปิดรัน Web Server ที่ `http://localhost:3000` |
| `npm run seed:firestore` | นำเข้าข้อมูลตัวอย่างทั้งหมดเข้าสู่ Cloud Firestore |
| `npm run seed` | นำเข้าข้อมูลตัวอย่างเข้าสู่ฐานข้อมูล Local SQLite สำรอง |
| `git status` | ตรวจสอบสถานะไฟล์ก่อน commit/push |
| `git push origin main` | ส่งโค้ดขึ้น GitHub |

---

## 🛡️ มาตรฐานความปลอดภัย (Security Architecture)
* **OWASP Top 10 Compliant**: ป้องกัน SQLi, NoSQLi, XSS, CSRF และ IDOR
* **HIPAA & PDPA Ready**: รหัสผ่านเข้ารหัสด้วย Bcrypt (Cost 12), มีระบบตรวจจับ Brute-Force Lockout, และเก็บบันทึก Audit Trail ทุกครั้งที่มีการเข้าถึงข้อมูลคนไข้
* **Zero Horizontal Scroll**: ดีไซน์ Responsive ฟิตพอดีกับทุกขนาดหน้าจอ 100%

---

## 👨‍⚕️ ผู้พัฒนาและสงวนลิขสิทธิ์ (Copyright & Author)
* **ออกแบบและพัฒนาโดย:** **นายเดียร์ เบญจาวิริยะวงศ์**
* **ตำแหน่ง:** นักวิชาการสาธารณสุขชำนาญการ รพ.สต.ควนลัง
* **ลิขสิทธิ์:** &copy; 2026 สงวนลิขสิทธิ์ ระบบติดตามการเข้าสู่ภาวะสงบของเบาหวาน (DM Remission Health Tracker) เพื่อการพัฒนานวัตกรรมการดูแลสุขภาพชุมชน

