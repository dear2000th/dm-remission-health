# 🩺 DM Remission Health Tracker Application

แอปพลิเคชันเว็บสำหรับบันทึก ติดตาม และวิเคราะห์ผลตัวชี้วัดสุขภาพในการเข้าสู่ภาวะสงบของเบาหวาน (**Diabetes Mellitus Remission Program - 20 สัปดาห์**) พร้อมระบบฐานข้อมูลรายบุคคล กราฟ Interactive และมาตรฐานความปลอดภัยขั้นสูง (OWASP Top 10, PDPA, HIPAA)

---

## 🌟 คุณสมบัติเด่น (Features)

1. **ระบบฐานข้อมูลผู้ป่วยรายบุคคล (Multi-Patient Database)**:
   - จัดเก็บข้อมูลแยกตาม HN และชื่อ-นามสกุล
   - บันทึกข้อมูลสุขภาพครบ 20 สัปดาห์ (140 วัน) ทั้ง 7 ตัวชี้วัด:
     - ความดันโลหิต บน / ล่าง (Blood Pressure - Systolic / Diastolic)
     - น้ำตาลมื้อแรก: ก่อนอาหาร (Fasting) และ หลังอาหาร
     - น้ำตาลมื้อสุดท้าย: ก่อนอาหาร และ หลังอาหาร
     - จำนวนก้าวเดินประจำวัน (Daily Steps)
2. **ระบบคำนวณและวิเคราะห์ค่าเฉลี่ยอัตโนมัติ (Analytics Engine)**:
   - ถอดแบบสูตรคำนวณจากไฟล์ Excel เดิม (`[All_New]_หาค่าเฉลี่ย_DM_Remis.xlsm`)
   - **แก้ไขปัญหา `#DIV/0!`**: คำนวณค่าเฉลี่ยได้ทันทีแม้ยังบันทึกข้อมูลไม่ครบ 7 วัน
   - คำนวณแถวสรุป **เฉลี่ยรวม (Grand Total Average)** ตลอด 20 สัปดาห์
   - ประเมินคะแนน **DM Remission Score %** พร้อมสถานะบ่งชี้ทางการแพทย์
3. **กราฟแสดงแนวโน้มสุขภาพ (Interactive Health Visualizations)**:
   - กราฟเส้นแนวโน้มความดันโลหิต (Systolic & Diastolic) เทียบกับเกณฑ์ปกติ 120/80 mmHg
   - กราฟเส้นระดับน้ำตาลสะสม (มื้อแรก & มื้อสุดท้าย ก่อน/หลังอาหาร)
   - กราฟแท่งสถิติก้าวเดินเฉลี่ยเทียบกับเป้าหมาย 8,000 ก้าว/วัน
4. **ฟังก์ชันจำลองปุ่ม VBA Macro (ClearSpecific20Blocks)**:
   - ปุ่ม **"ล้างข้อมูลบล็อก (Reset)"** พร้อมกล่องยืนยันความปลอดภัย สามารถเลือกได้ว่าจะล้างทั้ง 20 สัปดาห์ หรือล้างเฉพาะสัปดาห์ที่ต้องการ โดยไม่ลบประวัติผู้ป่วย
5. **ระบบความปลอดภัยสูงสุด ป้องกัน Hacker (Enterprise Security Architecture)**:
   - **SQL Injection Prevention (100%)**: ใช้ Parameterized Prepared Statements ทั้งหมด
   - **BOLA / IDOR Protection**: คนไข้สามารถดูและบันทึกได้เฉพาะข้อมูลของตนเองเท่านั้น ระบบจะบล็อกการเข้าถึงข้อมูลคนไข้อื่นทันที (HTTP 403 Forbidden)
   - **Brute-Force & Credential Stuffing Guard**: จำกัดความถี่ในการล็อกอิน (Rate Limiter) และล็อกบัญชีอัตโนมัติ 15 นาทีหากใส่รหัสผ่านผิดเกิน 5 ครั้ง
   - **Password Security**: เข้ารหัสด้วย **Bcrypt (Cost Factor = 12)** พร้อม Salt ไม่เก็บรหัสผ่านเป็น Plaintext
   - **Web Security Headers**: ป้องกัน XSS, Clickjacking, MIME-sniffing ด้วย Helmet & Strict Content Security Policy (CSP)
   - **Immutable Audit Trail**: เก็บบันทึกประวัติทุกการกระทำ (ใคร ดูข้อมูลคนไข้คนไหน เวลาใด จาก IP ใด) ตรวจสอบย้อนหลังได้ตลอดเวลา

---

## 🚀 วิธีการเปิดใช้งาน (Getting Started)

แอปพลิเคชันกำลังเปิดทำงานอยู่ที่:
👉 **[http://localhost:3000](http://localhost:3000)**

### บัญชีทดสอบที่มีในระบบ (Demo Accounts):

| บทบาท (Role) | Username | Password | สิทธิ์การเข้าถึง |
| :--- | :--- | :--- | :--- |
| **👨‍⚕️ แพทย์ (Doctor)** | `dr.somchai` | `Doctor@123456` | ดูแลคนไข้ทุกคน, เพิ่มคนไข้ใหม่, บันทึก/แก้ไขข้อมูล, ดูกราฟวิเคราะห์ |
| **🧑‍🦱 ผู้ป่วย (Patient)** | `patient01` | `Patient@123456` | ดูและบันทึกข้อมูลได้เฉพาะของตนเอง (HN-68001 นายสมศักดิ์ สุขใจ) |
| **⚙️ ผู้ดูแลระบบ (Admin)** | `admin` | `Admin@123456` | สิทธิ์สูงสุดในระบบ, ตรวจสอบ Security Audit Logs |

*(หน้าจอล็อกอินมีปุ่ม **One-Click Quick Login** ให้กดเข้าใช้งานได้ทันทีโดยไม่ต้องพิมพ์)*

---

## 📂 โครงสร้างโปรเจกต์

```
c:\Antigravity\remission001\
├── server.js                  # Express Web Server + Security Middlewares + Helmet + CSP
├── database.js                # SQLite Database (PRAGMA WAL, Prepared Statements, Indexes)
├── seed.js                    # ข้อมูลตั้งต้นและคนไข้ทดสอบ
├── remission_data.sqlite      # ไฟล์ฐานข้อมูล SQLite
├── middleware/
│   ├── auth.js                # JWT Verification, Role-Based Access Control, IDOR Guard
│   └── audit.js               # Audit Trail Logger (HIPAA/PDPA Compliance)
├── routes/
│   ├── auth.js                # Authentication, Login, Rate Limiting, Lockout
│   ├── patients.js            # Patient Management CRUD
│   ├── records.js             # 20-Week Daily Records Upsert & Block Reset
│   ├── analytics.js           # 20-Week Average Calculations & Chart Data
│   └── audit.js               # Security Audit Logs API
├── public/
│   ├── index.html             # Responsive Single Page Application Dashboard
│   ├── css/style.css          # Healthcare UI Theme (Prompt Font, Color-Coded Badges)
│   └── js/
│       ├── api.js             # Security-Aware Fetch API Client
│       ├── charts.js          # Chart.js Visualizations (BP, Glucose, Steps)
│       └── app.js             # State Controller, Modals, Accordions, Data Tables
└── README.md
```
