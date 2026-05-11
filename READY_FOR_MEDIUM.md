# การพัฒนา AI Auto-Captions Generator ประสิทธิภาพสูง ด้วย Next.js และการประยุกต์ใช้ Hybrid Architecture บน Apple Silicon M4 🎬💻

ในปัจจุบันกระบวนการผลิตคอนเทนต์วิดีโอสั้นสำหรับแพลตฟอร์มอย่าง **TikTok, Reels, และ YouTube Shorts** มีความต้องการการสร้างซับไตเติ้ลอัตโนมัติที่แม่นยำและสวยงามสูง แม้ปัจจุบันจะมีโซลูชันที่ใช้งานผ่านแอปพลิเคชันมือถือมากมาย แต่ผู้ใช้งานส่วนใหญ่มักประสบปัญหาเรื่องความยืดหยุ่นในการออกแบบตัวอักษร (Customization) และปัญหาการลดทอนของคุณภาพวิดีโอจากการบีบอัดไฟล์ที่ไม่เหมาะสม

บทความนี้จะมาแชร์แนวคิดการออกแบบระบบ (System Design) และสถาปัตยกรรมทางเทคนิคที่ผมพัฒนาขึ้นมา โดยเน้นการใช้ประโยชน์สูงสุดจาก **Large Language Model** และขุมพลังการประมวลผลในเครื่องส่วนบุคคลระดับ **MacBook Pro M4** เพื่อสร้างสรรค์งานวิดีโอที่มีความคมชัดสูงครับ

---
🖼️ **[👉 จุดที่ 1: แทรกรูปหน้าตา UI ของเว็บไซต์ / แอปพลิเคชันของคุณตรงนี้ 👈]**
---

---

## 1. การออกแบบกระบวนการทำงาน (System Workflow)

เพื่อให้เห็นภาพรวมของกระบวนการทำงานทั้งหมด ตั้งแต่การรับข้อมูล (Video Input) ไปจนถึงการเขียนซับไฟล์ (Subtitle Burning) ผมได้จัดทำ Flow การทำงานของสถาปัตยกรรมแบบ Hybrid นี้ไว้ดังภาพแผนภาพด้านล่างครับ

![System Workflow Diagram](https://mermaid.ink/img/Z3JhcGggVEQKICAgIEFbVXNlciBVcGxvYWRzIFZpZGVvXSAtLT4gQltFeHRyYWN0IEF1ZGlvIHVzaW5nIEZGbXBlZy53YXNtXQogICAgQiAtLT4gQ1tTZW5kIEF1ZGlvIERhdGEgdG8gTmV4dC5qcyBCYWNrZW5kIEFQSV0KICAgIEMgLS0+IERbUmVxdWVzdCBHZW1pbmkgQUkgQVBJIHdpdGggU3RydWN0dXJlZCBKU09OIFNjaGVtYV0KICAgIEQgLS0+IEVbQUkgUmV0dXJucyBXb3JkLUxldmVsIFRpbWVzdGFtcHMgSlNPTl0KICAgIEUgLS0+IEZbQ29udmVydCB0byBDaHVua2VkIFN1YnRpdGxlc10KICAgIEYgLS0+IEd7VXNlciBDbGlja3MgRXhwb3J0fQogICAgRyAtLT4gSHtOYXRpdmUgRkZtcGVnP30KICAgIEggLS0gWWVzIC0tPiBJW1BPU1QgdG8gL2FwaS9leHBvcnQgQmFja2VuZCBBUEldCiAgICBJIC0tPiBKW1J1biBOYXRpdmUgRkZtcGVnIGxpYngyNjRdCiAgICBKIC0tPiBLW1JldHVybiBIaWdoLVF1YWxpdHkgRXhwb3J0IFN0cmVhbV0KICAgIEggLS0gTm8gLS0+IExbUnVuIEJyb3dzZXIgZmZtcGVnLndhc21dCiAgICBMIC0tPiBLCiAgICBLIC0tPiBOW1RyaWdnZXIgRG93bmxvYWRd)

---

## 2. ความแม่นยำระดับคำ: Google Gemini AI (Structured Metadata)

กุญแจสำคัญของการถอดเสียงภาษาไทยคือการกำหนดโมเดลที่เข้าใจบริบทเสียงได้ดี ผมเลือกใช้ **Google Gemini 1.5/2.5 Flash** ผ่าน API ในการประมวลผลเสียง (Audio Transcription)

ทางเทคนิคผมได้ประยุกต์ใช้ฟีเจอร์ **Structured Output (JSON Schema)** ในการบังคับ (Strict Compliance) ให้ AI คืนข้อมูลกลับมาในโครงสร้าง JSON Array ที่ประกอบด้วย `word`, `start_time` และ `end_time` อย่างเคร่งครัด ดังโค้ดตัวอย่างด้านล่างนี้ครับ:

```typescript
// บังคับ Schema เพื่อให้ AI ตอบกลับมาเป็น Array of Objects ที่ประกอบด้วย Word-Level Timestamps
responseSchema: {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      word: { type: SchemaType.STRING },
      start_time: { type: SchemaType.NUMBER },
      end_time: { type: SchemaType.NUMBER }
    },
    required: ["word", "start_time", "end_time"]
  }
}
```

ความแม่นยำระดับ Metadata นี้ ช่วยลดภาระการจัดการ Data Normalization บนฝั่ง Frontend ได้เป็นอย่างดี และทำให้การแสดงผลซับไตเติ้ลสอดคล้องกับเวลาจริงอย่างสมบูรณ์

---

## 3. ข้อจำกัดเชิงเทคนิคของเบราว์เซอร์ (The Bottleneck of WebAssembly)

ในการพัฒนาระบบครั้งแรก ผมเลือกใช้เทคโนโลยี **FFmpeg.wasm** ซึ่งทำงานบน WebAssembly (WASM) ภายในสภาพแวดล้อมเบราว์เซอร์ เพื่อประโยชน์ในการประมวลผลแบบ Decentralized Client-side แต่กลับพบข้อจำกัดสำคัญสองประการ:

1. **Memory Constraint**: เบราว์เซอร์ส่วนใหญ่จำกัดหน่วยความจำ Heap ของ WebAssembly ไว้ประมาณ 2-4GB ซึ่งไม่เพียงพอต่อการเข้ารหัสวิดีโอขนาด 1080p หรือ 4K ที่มีความซับซ้อนสูง
2. **Performance and Quality Trade-off**: เพื่อให้ระบบประมวลผลสำเร็จโดยไม่เกิดอาการแครช (Crash) จำเป็นต้องลดคุณภาพพารามิเตอร์ (เช่น การปรับ CRF สูง และ Preset ที่เร็ว) ส่งผลโดยตรงต่อคุณภาพพิกเซลที่ลดทอนลงอย่างเห็นได้ชัด

---

## 4. แนวทางแก้ปัญหาด้วย Hybrid Native Architecture

เพื่อก้าวข้ามขีดจำกัดข้างต้น ผมจึงปรับโครงสร้างสถาปัตยกรรมไปสู่รูปแบบ **Hybrid Native Model** โดยใช้งานในลักษณะ Local Environment เพื่อเชื่อมต่อการทำงานร่วมกับฮาร์ดแวร์โดยตรง

### ลำดับขั้นตอนการประมวลผล (Execution Sequence)
เมื่อมีคำสั่ง Export ระบบจะทำงานสอดคล้องระหว่าง Client และ Local Node.js Server ตามลำดับดังแผนภาพต่อไปนี้:

![Sequence Diagram](https://mermaid.ink/img/c2VxdWVuY2VEaWFncmFtCiAgICBhdXRvbnVtYmVyCiAgICBhY3RvciBVc2VyCiAgICBwYXJ0aWNpcGFudCBCcm93c2VyIGFzIEZyb250ZW5kCiAgICBwYXJ0aWNpcGFudCBMb2NhbEFQSSBhcyBOZXh0LmpzIEFQSQogICAgcGFydGljaXBhbnQgQUkgYXMgR2VtaW5pIEFQSQogICAgcGFydGljaXBhbnQgTmF0aXZlRkYgYXMgTmF0aXZlIEZGbXBlZwogICAgVXNlci0+PkJyb3dzZXI6IFVwbG9hZCAmIEVkaXQKICAgIEJyb3dzZXItPj5Mb2NhbEFQSTogUE9TVCAvYXBpL3RyYW5zY3JpYmUKICAgIExvY2FsQVBJLT4+QUk6IFJlcXVlc3QgRGF0YQogICAgQUktLT4+TG9jYWxBUEk6IFJldHVybiBKU09OCiAgICBMb2NhbEFQSS0tPj5Ccm93c2VyOiBQYXNzIERhdGEKICAgIFVzZXItPj5Ccm93c2VyOiBFeHBvcnQKICAgIEJyb3dzZXItPj5Mb2NhbEFQSTogUE9TVCAvYXBpL2V4cG9ydAogICAgYWx0IEhhcyBOYXRpdmUgRkYKICAgICAgICBMb2NhbEFQSS0+Pk5hdGl2ZUZGOiBFeGVjIGxpYngyNjQKICAgICAgICBOYXRpdmVGRi0tPj5Mb2NhbEFQSTogRmlsZSBTdHJlYW0KICAgICAgICBMb2NhbEFQSS0tPj5Ccm93c2VyOiBSZXNwb25zZQogICAgZWxzZSBObyBOYXRpdmUKICAgICAgICBMb2NhbEFQSS0tPj5Ccm93c2VyOiBFcnJvcgogICAgICAgIEJyb3dzZXItPj5Ccm93c2VyOiBSdW4gZmZtcGVnLndhc21KCiAgICBlbmQKICAgIEJyb3dzZXItPj5Vc2VyOiBEb3dubG9hZCBWaWRlbw==)

### ข้อดีของการประมวลผลบน Node.js ร่วมกับ MacBook Pro M4
การย้ายกระบวนการ Encoding ออกจาก Sandbox ของเบราว์เซอร์มายัง Local Backend API ทำให้เราเข้าถึงทรัพยากรเครื่องได้อย่างไม่มีขีดจำกัด โดยผมได้ปรับแต่งคำสั่ง FFmpeg ให้ทำงานแบบ **Cinema-Grade High Quality** ดังนี้ครับ:

```typescript
// ใช้ระบบประมวลผล CPU-based libx264 ตั้งค่าสูงสุดเพื่อรักษาทุกพิกเซล
// Preset slow ช่วยให้การวิเคราะห์วัตถุและขอบตัวอักษรคมกริบ ไร้รอยแตก
let ffmpegCmd = `ffmpeg -y -i "${videoPath}" -vf "ass=${assPath}" -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p -c:a copy "${outputPath}"`;

await execAsync(ffmpegCmd);
```

* **การใช้ทรัพยากรหน่วยความจำเต็มพิกัด**: หมดปัญหาเรื่องหน่วยความจำไม่เพียงพอ เพราะสามารถดึงแรมส่วนกลางของระบบมาใช้วิเคราะห์โครงสร้างเฟรมภาพได้อย่างเต็มที่
* **คุณภาพระดับการผลิตมืออาชีพ (Cinema-Grade)**: เลือกใช้พารามิเตอร์แบบ Ultra-high quality เช่น **CRF 14 และ Preset Slow** เพื่อคงรายละเอียดความคมชัดระดับ Lossless
* **การกระจายงานขนาน (Multi-core Threading)**: สถาปัตยกรรม M4 มี Performance Cores จำนวนมาก ซึ่งเหมาะสมอย่างยิ่งต่อการประมวลผลภาพเชิงลึก ทำให้ระยะเวลาในการ Render สั้นลงอย่างมาก

---

## สรุปและตัวอย่างการนำไปประยุกต์ใช้งานจริง

สถาปัตยกรรมรูปแบบนี้นอกจากจะให้ผลลัพธ์วิดีโอที่คมชัดแล้ว ยังช่วยยกระดับ Workflow การทำงานของ Content Creator ให้มีความเป็นมืออาชีพมากยิ่งขึ้น สำหรับท่านที่สนใจ สามารถรับชมผลงานจริงที่ผลิตโดยใช้ระบบนี้จากวิดีโอรีวิวสินค้าด้านล่างได้เลยครับ

---
🖼️ **[👉 จุดที่ 2: แทรกรูปผลลัพธ์วิดีโอที่มีซับไตเติ้ลสวยงามของคุณตรงนี้ 👈]**
---

🎥 **รับชมตัวอย่างวิดีโอที่ผลิตโดยระบบนี้**: [ 👉 ใส่ลิงค์คลิป TikTok รีวิวสินค้าของคุณตรงนี้ครับ 👈 ]

หวังว่าบทความนี้จะเป็นประโยชน์ต่อ Developer ที่กำลังมองหาวิธีบูรณาการ AI, FFmpeg และการจัดการงานประมวลผลข้อมูลขนาดใหญ่บนสถาปัตยกรรมสมัยใหม่ครับ หากมีความเห็นหรือข้อเสนอแนะเพิ่มเติม สามารถร่วมแลกเปลี่ยนได้ในส่วนคอมเมนต์เลยครับผม

---

## 📚 เอกสารอ้างอิงและแหล่งเรียนรู้เพิ่มเติม (References)
- **Next.js 15 Official Documentation**: [nextjs.org/docs](https://nextjs.org/docs)
- **Google Gemini API - Structured Outputs with JSON Schema**: [ai.google.dev/gemini-api/docs/structured-output](https://ai.google.dev/gemini-api/docs/structured-output)
- **FFmpeg.wasm WebAssembly Wrapper**: [ffmpegwasm.netlify.app](https://ffmpegwasm.netlify.app/)
- **H.264 Video Encoding Guide (CRF and Preset settings)**: [FFmpeg Wiki](https://trac.ffmpeg.org/wiki/Encode/H.264)

#SoftwareEngineering #AIIntegration #GeminiAPI #ArchitectureDesign #M4Performance #VideoProcessing #SystemDesign
