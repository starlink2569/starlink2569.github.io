# พุทธทาส 6 แผ่น — คลังเสียงธรรมะ

Mobile responsive PWA สำหรับค้นหาและเปิดฟังไฟล์ MP3 จาก OneDrive public share ของผู้ใช้

## Features
- Search ชื่อตอน เลขตอน หมวดหมู่
- Filter แผ่น/หมวด
- Favorite ในเครื่องผู้ใช้
- Shuffle / Repeat state / next / previous
- Share app และ share clip ด้วย deep link `?track=`
- PWA install บน iOS/Android
- คู่มือภาษาไทยและ feedback email

## Playback note
OneDrive ใช้ stream URL แบบ `tempauth` ชั่วคราวภายใน preview player จึงไม่ฝัง direct token URL ลงใน repo แอปเปิด OneDrive public preview ของ item แต่ละรายการแทนเพื่อให้ลิงก์ public ใช้ได้ยาวกว่าและไม่เผย token ค่ะ
